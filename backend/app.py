"""Welfare System API — Pure PyMySQL backend (no SQLAlchemy dependency)"""
from flask import Flask, request, jsonify, send_from_directory
try:
    from flask_cors import CORS
    HAS_CORS = True
except Exception:
    HAS_CORS = False

from datetime import datetime, timedelta, date
from werkzeug.utils import secure_filename
import os, sys, json as _json, uuid, decimal, re
import urllib.request, urllib.error
import pymysql
import pymysql.cursors

# ── ML engine ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
ML_AVAILABLE = False
compute_risk_scores = None
try:
    from risk_engine import compute_risk_scores
    ML_AVAILABLE = True
except Exception as e:
    print(f"ML engine not loaded: {e}")

bert_reasoner = None

# ══════════════════════════════════════════════════════════════════════════════
# Flask app
# ══════════════════════════════════════════════════════════════════════════════
app = Flask(__name__)
if HAS_CORS:
    CORS(app)
else:
    @app.after_request
    def _cors(resp):
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Headers'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        return resp

# ══════════════════════════════════════════════════════════════════════════════
# Database helpers
# ══════════════════════════════════════════════════════════════════════════════
DB_CFG = dict(
    host=os.environ.get('DB_HOST', 'localhost'),
    port=int(os.environ.get('DB_PORT', 3306)),
    user=os.environ.get('DB_USER', 'root'),
    password=os.environ.get('DB_PASSWORD', 'root'),
    database=os.environ.get('DB_NAME', 'welfare_system'),
    cursorclass=pymysql.cursors.DictCursor,
    charset='utf8mb4',
)

def get_conn():
    return pymysql.connect(**DB_CFG)

def fetchall(sql, args=None):
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(sql, args or ())
            return c.fetchall()
    finally:
        conn.close()

def fetchone(sql, args=None):
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(sql, args or ())
            return c.fetchone()
    finally:
        conn.close()

def execute(sql, args=None):
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(sql, args or ())
            conn.commit()
            return c.lastrowid
    finally:
        conn.close()

def execute_many(sql_list):
    """Execute multiple SQL statements in one connection."""
    conn = get_conn()
    try:
        with conn.cursor() as c:
            for sql, args in sql_list:
                c.execute(sql, args or ())
        conn.commit()
    finally:
        conn.close()

# ── Serialization ────────────────────────────────────────────────────────────
def _cv(v):
    if v is None: return None
    if isinstance(v, decimal.Decimal): return float(v)
    if isinstance(v, datetime): return str(v)
    if isinstance(v, date): return str(v)
    if isinstance(v, timedelta): return str(v)
    if isinstance(v, bytes): return v.decode('utf-8', errors='replace')
    return v

def _clean(row):
    if not row: return row
    return {k: _cv(v) for k, v in row.items()}

def _clean_all(rows):
    return [_clean(r) for r in (rows or [])]

# ── Upload helpers ───────────────────────────────────────────────────────────
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_IMAGES = {'jpg', 'jpeg', 'png'}
ALLOWED_DOCS = {'jpg', 'jpeg', 'png', 'pdf'}

def allowed_file(fn, exts):
    return '.' in fn and fn.rsplit('.', 1)[1].lower() in exts

def save_upload(f, sub, exts):
    if not f or f.filename == '':
        raise ValueError('No file selected')
    if not allowed_file(f.filename, exts):
        raise ValueError(f'File type not allowed. Allowed: {exts}')
    d = os.path.join(UPLOAD_FOLDER, sub)
    os.makedirs(d, exist_ok=True)
    ext = f.filename.rsplit('.', 1)[1].lower()
    fn = f'{uuid.uuid4().hex}.{ext}'
    f.save(os.path.join(d, fn))
    return f'uploads/{sub}/{fn}'

# ── Blockchain ───────────────────────────────────────────────────────────────
BLOCKCHAIN_SERVICE = os.environ.get('BLOCKCHAIN_SERVICE', 'http://localhost:3001')

def _record_on_chain(event_type, user_id, data=None, recorded_by='system'):
    try:
        payload = _json.dumps({
            'type': event_type, 'userId': int(user_id),
            'data': data or {}, 'recordedBy': recorded_by,
        }).encode()
        req = urllib.request.Request(
            f'{BLOCKCHAIN_SERVICE}/chain/record',
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = _json.loads(resp.read())
            return result.get('blockHash'), result.get('blockIndex')
    except Exception as exc:
        print(f'[Blockchain] Warning: {exc}')
        return None, None

# ── Risk adjustment on verification ──────────────────────────────────────
def _reduce_risk_on_verification(user_id):
    """Set user's risk to LOW after successful identity verification."""
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=%s", (user_id,))
    if risk:
        old_fp = float(risk['fraud_probability'] or 0)
        old_level = risk.get('risk_level', 'unknown')
        # Force to low risk on verification
        new_fp = 0.05
        new_as = 0.0
        new_level = 'low'
        execute(
            "UPDATE risk_scores SET fraud_probability=%s, anomaly_score=%s, risk_level=%s, updated_at=NOW() WHERE user_id=%s",
            (new_fp, new_as, new_level, user_id),
        )
        execute("DELETE FROM ml_analysis WHERE user_id=%s", (user_id,))
        print(f'[Risk] User {user_id}: verified → risk forced {old_level} -> low (fraud_prob {old_fp:.3f} -> {new_fp})')
    else:
        execute(
            "INSERT INTO risk_scores (user_id,anomaly_score,fraud_probability,risk_level,updated_at) VALUES (%s,0.0,0.05,'low',NOW())",
            (user_id,),
        )

def _increase_risk_on_rejection(user_id):
    """Raise a user's risk score after failed/rejected verification."""
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=%s", (user_id,))
    if risk:
        old_fp = float(risk['fraud_probability'] or 0)
        new_fp = min(0.95, old_fp * 1.3 + 0.1)
        new_level = 'low' if new_fp < 0.3 else ('medium' if new_fp < 0.6 else 'high')
        execute(
            "UPDATE risk_scores SET fraud_probability=%s, risk_level=%s, updated_at=NOW() WHERE user_id=%s",
            (round(new_fp, 4), new_level, user_id),
        )
        execute("DELETE FROM ml_analysis WHERE user_id=%s", (user_id,))
    else:
        execute(
            "INSERT INTO risk_scores (user_id,anomaly_score,fraud_probability,risk_level,updated_at) VALUES (%s,-0.3,0.45,'medium',NOW())",
            (user_id,),
        )

# ── Notifications ────────────────────────────────────────────────────────────
def _notify(user_id, message, ntype='info'):
    execute(
        "INSERT INTO notifications (user_id, message, type, is_read, created_at) VALUES (%s,%s,%s,0,NOW())",
        (user_id, message, ntype),
    )

# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def home():
    return jsonify({'message': 'Welfare System API'})

# ── Auth ─────────────────────────────────────────────────────────────────────
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    aadhaar = data.get('aadhaar_number')
    email = data.get('email')
    if not aadhaar or not email:
        return jsonify({'error': 'aadhaar_number and email required'}), 400
    user = fetchone(
        "SELECT id, full_name FROM users WHERE aadhaar_number=%s AND email=%s",
        (aadhaar, email),
    )
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    return jsonify({'user_id': user['id'], 'full_name': user['full_name'], 'is_admin': False})

@app.route('/auth/admin_login', methods=['POST'])
def admin_login():
    data = request.json
    if data.get('username') == 'admin' and data.get('password') == 'admin123':
        return jsonify({'is_admin': True, 'full_name': 'System Admin', 'user_id': 0})
    return jsonify({'error': 'Invalid admin credentials'}), 401

# ── Users ────────────────────────────────────────────────────────────────────
def _user_dict(u):
    return {
        'id': u['id'], 'aadhaar_number': u['aadhaar_number'],
        'full_name': u['full_name'], 'gender': u['gender'],
        'date_of_birth': _cv(u.get('date_of_birth')),
        'phone': u.get('phone'), 'email': u.get('email'),
        'income': float(u['income']) if u.get('income') else None,
        'occupation': u.get('occupation'),
        'is_bpl': bool(u.get('is_bpl')),
        'created_at': _cv(u.get('created_at')),
    }

@app.route('/users', methods=['GET'])
def get_users():
    return jsonify([_user_dict(u) for u in fetchall("SELECT * FROM users")])

@app.route('/users', methods=['POST'])
def create_user():
    d = request.json
    dob = None
    if d.get('date_of_birth'):
        dob = datetime.strptime(d['date_of_birth'], '%Y-%m-%d').date()
    uid = execute(
        """INSERT INTO users (aadhaar_number,full_name,gender,date_of_birth,phone,email,income,occupation,is_bpl,created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())""",
        (d['aadhaar_number'], d.get('full_name'), d.get('gender'), dob,
         d.get('phone'), d.get('email'), d.get('income'), d.get('occupation'),
         d.get('is_bpl', False)),
    )
    return jsonify({'id': uid}), 201

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    u = fetchone("SELECT * FROM users WHERE id=%s", (user_id,))
    if not u:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(_user_dict(u))

# ── Schemes ──────────────────────────────────────────────────────────────────
@app.route('/schemes', methods=['GET'])
def get_schemes():
    rows = fetchall("SELECT * FROM schemes")
    return jsonify([{
        'id': s['id'], 'name': s['name'], 'category_id': s.get('category_id'),
        'eligibility_criteria': s.get('eligibility_criteria'),
        'benefit_type': s.get('benefit_type'), 'created_at': _cv(s.get('created_at')),
    } for s in rows])

@app.route('/schemes/detailed', methods=['GET'])
def get_schemes_detailed():
    rows = fetchall("""
        SELECT s.*, sc.name as cat_name, sr.min_age, sr.max_income, sr.gender_required
        FROM schemes s
        LEFT JOIN scheme_categories sc ON s.category_id=sc.id
        LEFT JOIN scheme_rules sr ON sr.scheme_id=s.id
    """)
    return jsonify([{
        'id': r['id'], 'name': r['name'],
        'category': r.get('cat_name') or 'General',
        'eligibility_criteria': r.get('eligibility_criteria'),
        'benefit_type': r.get('benefit_type'),
        'created_at': _cv(r.get('created_at')),
        'min_age': r.get('min_age'),
        'max_income': float(r['max_income']) if r.get('max_income') else None,
        'gender_required': r.get('gender_required'),
    } for r in rows])

@app.route('/schemes', methods=['POST'])
def create_scheme():
    d = request.json
    if not d.get('name'):
        return jsonify({'error': 'name is required'}), 400
    cat_id = d.get('category_id')
    if not cat_id:
        cat = fetchone("SELECT id FROM scheme_categories WHERE name=%s", (d.get('category', 'General'),))
        if not cat:
            cat_id = execute("INSERT INTO scheme_categories (name,description) VALUES (%s,'')", (d.get('category', 'General'),))
        else:
            cat_id = cat['id']
    sid = execute(
        "INSERT INTO schemes (name,category_id,eligibility_criteria,benefit_type,created_at) VALUES (%s,%s,%s,%s,NOW())",
        (d['name'], cat_id, d.get('eligibility_criteria', ''), d.get('benefit_type', 'cash')),
    )
    if d.get('min_age') or d.get('max_income') or d.get('gender_required'):
        execute(
            "INSERT INTO scheme_rules (scheme_id,min_age,max_income,gender_required,category_required,is_household_based) VALUES (%s,%s,%s,%s,%s,%s)",
            (sid, d.get('min_age'), d.get('max_income'), d.get('gender_required'), d.get('category_required'), d.get('is_household_based', False)),
        )
    return jsonify({'id': sid, 'name': d['name']}), 201

@app.route('/schemes/<int:scheme_id>/risk_reason', methods=['GET'])
def scheme_risk_reason(scheme_id):
    s = fetchone("SELECT name FROM schemes WHERE id=%s", (scheme_id,))
    if not s:
        return jsonify({'error': 'Scheme not found'}), 404
    reason = f"BERT model unavailable; fallback reasoning: '{s['name']}' risk depends on income, verification, and fraud score."
    return jsonify({'scheme_id': scheme_id, 'reason': reason})

# ── Applications ─────────────────────────────────────────────────────────────
@app.route('/applications', methods=['GET'])
def get_applications():
    return jsonify(_clean_all(fetchall("SELECT * FROM applications")))

@app.route('/users/<int:user_id>/applications', methods=['GET'])
def get_user_applications(user_id):
    if not fetchone("SELECT id FROM users WHERE id=%s", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    apps = fetchall("SELECT * FROM applications WHERE user_id=%s", (user_id,))
    return jsonify([{
        'id': a['id'], 'scheme_id': a['scheme_id'], 'status': a['status'],
        'submitted_at': _cv(a.get('submitted_at')),
        'reviewed_at': _cv(a.get('reviewed_at')),
        'remarks': a.get('remarks'),
    } for a in apps])

@app.route('/users/<int:user_id>/apply', methods=['POST'])
def apply_scheme(user_id):
    d = request.json
    scheme_id = d.get('scheme_id')
    if not fetchone("SELECT id FROM users WHERE id=%s", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    if not fetchone("SELECT id FROM schemes WHERE id=%s", (scheme_id,)):
        return jsonify({'error': 'Scheme not found'}), 404
    if fetchone("SELECT id FROM applications WHERE user_id=%s AND scheme_id=%s", (user_id, scheme_id)):
        return jsonify({'error': 'Already applied'}), 409
    aid = execute(
        "INSERT INTO applications (user_id,scheme_id,status,submitted_at) VALUES (%s,%s,'submitted',NOW())",
        (user_id, scheme_id),
    )
    return jsonify({'id': aid, 'status': 'submitted'}), 201

# ── Risk / Fraud ─────────────────────────────────────────────────────────────
@app.route('/risk_scores/<int:user_id>', methods=['GET'])
def get_risk_score(user_id):
    r = fetchone("SELECT anomaly_score,fraud_probability,risk_level FROM risk_scores WHERE user_id=%s", (user_id,))
    if r:
        return jsonify({
            'anomaly_score': float(r['anomaly_score']) if r['anomaly_score'] else 0,
            'fraud_probability': float(r['fraud_probability']) if r['fraud_probability'] else 0,
            'risk_level': r['risk_level'],
        })
    return jsonify({'error': 'Risk score not found'}), 404

@app.route('/users/<int:user_id>/fraud_flags', methods=['GET'])
def get_fraud_flags(user_id):
    flags = fetchall("SELECT * FROM fraud_flags WHERE user_id=%s", (user_id,))
    return jsonify([{
        'id': f['id'], 'flag_type': f['flag_type'], 'severity': f['severity'],
        'description': f['description'], 'created_at': _cv(f.get('created_at')),
    } for f in flags])

# ── Notifications ────────────────────────────────────────────────────────────
@app.route('/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    notes = fetchall("SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC", (user_id,))
    return jsonify([{
        'id': n['id'], 'message': n['message'], 'type': n.get('type'),
        'is_read': bool(n.get('is_read')), 'created_at': _cv(n.get('created_at')),
    } for n in notes])

@app.route('/notifications/<int:notif_id>/read', methods=['PUT'])
def mark_notification_read(notif_id):
    n = fetchone("SELECT id FROM notifications WHERE id=%s", (notif_id,))
    if not n:
        return jsonify({'error': 'Not found'}), 404
    execute("UPDATE notifications SET is_read=1 WHERE id=%s", (notif_id,))
    return jsonify({'id': notif_id, 'is_read': True})

# ── Admin ────────────────────────────────────────────────────────────────────
@app.route('/admin/overview', methods=['GET'])
def admin_overview():
    total_users = fetchone("SELECT COUNT(*) as cnt FROM users")['cnt']
    total_apps = fetchone("SELECT COUNT(*) as cnt FROM applications")['cnt']
    schemes = fetchall("SELECT id, name FROM schemes")
    data = []
    for s in schemes:
        cnt = fetchone("SELECT COUNT(*) as cnt FROM applications WHERE scheme_id=%s", (s['id'],))['cnt']
        avg = fetchone(
            """SELECT AVG(rs.fraud_probability) as avg_fp FROM risk_scores rs
               JOIN applications a ON rs.user_id=a.user_id WHERE a.scheme_id=%s""",
            (s['id'],),
        )
        data.append({
            'scheme_id': s['id'], 'scheme_name': s['name'],
            'applications': cnt,
            'avg_fraud_probability': float(avg['avg_fp']) if avg and avg['avg_fp'] else None,
        })
    return jsonify({'total_users': total_users, 'total_applications': total_apps, 'schemes': data})

@app.route('/admin/users', methods=['GET'])
def admin_all_users():
    rows = fetchall("""
        SELECT u.*, rs.risk_level, rs.fraud_probability,
               (SELECT COUNT(*) FROM applications WHERE user_id=u.id) as app_count
        FROM users u LEFT JOIN risk_scores rs ON rs.user_id=u.id
    """)
    return jsonify([{
        'id': u['id'], 'full_name': u['full_name'],
        'aadhaar_number': u['aadhaar_number'], 'email': u.get('email'),
        'phone': u.get('phone'),
        'income': float(u['income']) if u.get('income') else None,
        'is_bpl': bool(u.get('is_bpl')), 'occupation': u.get('occupation'),
        'applications': u['app_count'],
        'risk_level': u.get('risk_level') or 'low',
        'fraud_probability': float(u['fraud_probability']) if u.get('fraud_probability') else 0.0,
    } for u in rows])

@app.route('/admin/schemes/<int:scheme_id>/users', methods=['GET'])
def admin_scheme_users(scheme_id):
    rows = fetchall("""
        SELECT a.id as application_id, a.user_id, a.status, a.submitted_at,
               u.full_name, u.aadhaar_number, u.email,
               rs.risk_level, rs.fraud_probability, rs.anomaly_score,
               (SELECT COUNT(*) FROM fraud_flags WHERE user_id=a.user_id) as fraud_flags
        FROM applications a
        JOIN users u ON u.id=a.user_id
        LEFT JOIN risk_scores rs ON rs.user_id=a.user_id
        WHERE a.scheme_id=%s
    """, (scheme_id,))
    return jsonify([{
        'application_id': r['application_id'], 'user_id': r['user_id'],
        'full_name': r['full_name'] or 'Unknown',
        'aadhaar_number': r['aadhaar_number'] or '',
        'email': r.get('email') or '', 'status': r['status'],
        'submitted_at': _cv(r.get('submitted_at')),
        'risk_level': r.get('risk_level') or 'low',
        'fraud_probability': float(r['fraud_probability']) if r.get('fraud_probability') else 0.0,
        'anomaly_score': float(r['anomaly_score']) if r.get('anomaly_score') else 0.0,
        'fraud_flags': r['fraud_flags'],
    } for r in rows])

@app.route('/admin/applications/<int:app_id>/status', methods=['PUT'])
def update_application_status(app_id):
    d = request.json
    new_status = d.get('status')
    allowed = ['submitted', 'under_review', 'approved', 'rejected']
    if new_status not in allowed:
        return jsonify({'error': 'Invalid status'}), 400
    a = fetchone("SELECT * FROM applications WHERE id=%s", (app_id,))
    if not a:
        return jsonify({'error': 'Application not found'}), 404
    execute("UPDATE applications SET status=%s, reviewed_at=NOW() WHERE id=%s", (new_status, app_id))
    _notify(a['user_id'], f"Your application #{app_id} has been {new_status}.", 'application_update')
    return jsonify({'id': app_id, 'status': new_status})

@app.route('/admin/recompute_risk', methods=['POST'])
def recompute_risk():
    if not ML_AVAILABLE:
        return jsonify({'error': 'ML engine not available'}), 500
    users = fetchall("SELECT * FROM users")
    user_data = []
    for u in users:
        app_count = fetchone("SELECT COUNT(*) as c FROM applications WHERE user_id=%s", (u['id'],))['c']
        age = 35
        if u.get('date_of_birth'):
            age = (datetime.utcnow().date() - u['date_of_birth']).days // 365
        user_data.append({
            'user_id': u['id'], 'age': age,
            'income': float(u['income']) if u.get('income') else 50000,
            'transaction_frequency': app_count * 2 + 1, 'last_transaction_days': 30,
            'aadhaar_verified': 1, 'death_record_match': 0, 'location_mismatch': 0,
            'bank_account_reuse': 0, 'num_schemes': app_count,
            'is_bpl': int(u.get('is_bpl') or False),
        })
    scores = compute_risk_scores(user_data)
    count = 0
    for s in scores:
        existing = fetchone("SELECT id FROM risk_scores WHERE user_id=%s", (s['user_id'],))
        if existing:
            execute("UPDATE risk_scores SET anomaly_score=%s,fraud_probability=%s,risk_level=%s,updated_at=NOW() WHERE user_id=%s",
                    (s['anomaly_score'], s['fraud_probability'], s['risk_level'], s['user_id']))
        else:
            execute("INSERT INTO risk_scores (user_id,anomaly_score,fraud_probability,risk_level,updated_at) VALUES (%s,%s,%s,%s,NOW())",
                    (s['user_id'], s['anomaly_score'], s['fraud_probability'], s['risk_level']))
        count += 1
    return jsonify({'recomputed': count})

# ── User profile (comprehensive) ─────────────────────────────────────────────
@app.route('/users/<int:user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    u = fetchone("SELECT * FROM users WHERE id=%s", (user_id,))
    if not u:
        return jsonify({'error': 'User not found'}), 404
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=%s", (user_id,))
    flags = fetchall("SELECT * FROM fraud_flags WHERE user_id=%s", (user_id,))
    apps = fetchall("SELECT * FROM applications WHERE user_id=%s", (user_id,))
    identity = fetchone("SELECT * FROM user_identity WHERE user_id=%s", (user_id,))
    ml = fetchone("SELECT cluster_label FROM ml_analysis WHERE user_id=%s", (user_id,))
    age = (datetime.utcnow().date() - u['date_of_birth']).days // 365 if u.get('date_of_birth') else None
    status_counts = {}
    for a in apps:
        status_counts[a['status']] = status_counts.get(a['status'], 0) + 1
    disb = fetchall("SELECT amount FROM benefit_disbursements WHERE user_id=%s AND status='processed'", (user_id,))
    total_benefit = sum(float(d['amount'] or 0) for d in disb)
    return jsonify({
        'id': u['id'], 'full_name': u['full_name'], 'aadhaar_number': u['aadhaar_number'],
        'gender': u['gender'], 'age': age,
        'date_of_birth': _cv(u.get('date_of_birth')),
        'phone': u.get('phone'), 'email': u.get('email'),
        'income': float(u['income']) if u.get('income') else None,
        'occupation': u.get('occupation'), 'is_bpl': bool(u.get('is_bpl')),
        'created_at': _cv(u.get('created_at')),
        'identity': {
            'voter_id': identity['voter_id'] if identity else None,
            'pan_number': identity['pan_number'] if identity else None,
            'ration_card': identity['ration_card_number'] if identity else None,
            'aadhaar_verified': bool(identity['is_aadhaar_verified']) if identity else False,
        },
        'risk': {
            'risk_level': risk['risk_level'] if risk else 'low',
            'fraud_probability': float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.0,
            'anomaly_score': float(risk['anomaly_score']) if risk and risk.get('anomaly_score') else 0.0,
        },
        'fraud_flags': [{'flag_type': f['flag_type'], 'severity': f['severity'],
                        'description': f['description'], 'created_at': _cv(f.get('created_at'))} for f in flags],
        'applications_summary': status_counts,
        'total_applications': len(apps),
        'total_benefit_received': round(total_benefit, 2),
        'cluster_label': ml['cluster_label'] if ml else None,
    })

# ── Benefit history ──────────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/benefit_history', methods=['GET'])
def get_benefit_history(user_id):
    if not fetchone("SELECT id FROM users WHERE id=%s", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    rows = fetchall("""
        SELECT bd.*, s.name as scheme_name, s.benefit_type, sc.name as cat_name
        FROM benefit_disbursements bd
        LEFT JOIN schemes s ON s.id=bd.scheme_id
        LEFT JOIN scheme_categories sc ON sc.id=s.category_id
        WHERE bd.user_id=%s ORDER BY bd.disbursement_date DESC
    """, (user_id,))
    result = [{
        'id': d['id'], 'scheme_name': d.get('scheme_name') or 'Unknown',
        'scheme_category': d.get('cat_name') or 'General',
        'benefit_type': d.get('benefit_type') or 'cash',
        'amount': float(d['amount']) if d.get('amount') else 0,
        'installment_no': d.get('installment_no'),
        'disbursement_date': _cv(d.get('disbursement_date')),
        'payment_method': d.get('payment_method'),
        'account_no_last4': d.get('account_no_last4'),
        'status': d.get('status'),
    } for d in rows]
    total = sum(r['amount'] for r in result if (fetchone("SELECT status FROM benefit_disbursements WHERE id=%s", (r['id'],)) or {}).get('status') == 'processed') if False else sum(float(d['amount'] or 0) for d in rows if d.get('status') == 'processed')
    return jsonify({'disbursements': result, 'total_received': round(total, 2), 'count': len(result)})

# ── Risk Reasons Generator ────────────────────────────────────────────────────
def _compute_risk_reasons(user, risk, flags_count=0, app_count=0):
    reasons = []
    fraud_prob = float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.0
    anomaly = float(risk['anomaly_score']) if risk and risk.get('anomaly_score') else 0.0
    age = 35
    if user.get('date_of_birth'):
        age = (datetime.utcnow().date() - user['date_of_birth']).days // 365
    income = float(user['income']) if user.get('income') else 50000
    is_bpl = int(user.get('is_bpl') or 0)

    if fraud_prob >= 0.80:
        reasons.append({'factor': 'Very High Fraud Probability', 'severity': 'critical', 'detail': f'Fraud probability is {fraud_prob*100:.1f}%, well above safe threshold (30%).'})
    elif fraud_prob >= 0.60:
        reasons.append({'factor': 'Elevated Fraud Probability', 'severity': 'high', 'detail': f'Fraud probability is {fraud_prob*100:.1f}%, exceeding the high-risk threshold (60%).'})
    elif fraud_prob >= 0.30:
        reasons.append({'factor': 'Moderate Fraud Probability', 'severity': 'medium', 'detail': f'Fraud probability is {fraud_prob*100:.1f}%, in the medium-risk band (30-60%).'})

    if anomaly < -0.5:
        reasons.append({'factor': 'Anomalous Behavior Pattern', 'severity': 'high', 'detail': f'Isolation Forest anomaly score is {anomaly:.4f}, indicating significant deviation from normal beneficiary patterns.'})
    elif anomaly < -0.25:
        reasons.append({'factor': 'Mild Behavioral Anomaly', 'severity': 'medium', 'detail': f'Anomaly score of {anomaly:.4f} indicates some deviation from typical beneficiary behavior.'})

    if age >= 100:
        reasons.append({'factor': 'Centenarian Age', 'severity': 'critical', 'detail': f'Beneficiary age is {age} years. Extremely high age correlates with deceased-beneficiary fraud.'})
    elif age >= 85:
        reasons.append({'factor': 'Very Advanced Age', 'severity': 'high', 'detail': f'Beneficiary is {age} years old. Advanced age increases liveness verification risk.'})

    if income < 5000:
        reasons.append({'factor': 'Extremely Low Reported Income', 'severity': 'medium', 'detail': f'Declared income is \u20b9{income:,.0f}/month. Unusually low income may indicate data fabrication.'})
    elif income > 800000 and is_bpl:
        reasons.append({'factor': 'Income-BPL Mismatch', 'severity': 'high', 'detail': f'Income is \u20b9{income:,.0f} but beneficiary is marked BPL. Possible eligibility fraud.'})

    if flags_count >= 3:
        reasons.append({'factor': 'Multiple Fraud Flags', 'severity': 'critical', 'detail': f'{flags_count} fraud flags have been raised against this beneficiary by automated systems.'})
    elif flags_count >= 1:
        reasons.append({'factor': 'Existing Fraud Flags', 'severity': 'medium', 'detail': f'{flags_count} fraud flag(s) on record for this beneficiary.'})

    if app_count >= 6:
        reasons.append({'factor': 'Excessive Scheme Applications', 'severity': 'medium', 'detail': f'Applied to {app_count} schemes. High scheme enrollment count is a potential multi-dipping indicator.'})

    if not reasons:
        reasons.append({'factor': 'No Major Risk Factors', 'severity': 'low', 'detail': 'No significant risk indicators detected. Beneficiary profile appears normal across all assessed dimensions.'})

    return reasons

# ── BERT narrative generator ─────────────────────────────────────────────────
def generate_bert_narrative(user, risk, flags_count, app_count, age, income, scheme_names):
    name = user.get('full_name') or 'Unknown Beneficiary'
    risk_level = risk['risk_level'] if risk else 'low'
    fraud_prob = float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.10
    anomaly = float(risk['anomaly_score']) if risk and risk.get('anomaly_score') else 0.10
    confidence = round((1 - fraud_prob) * 100, 1)

    if age > 60 and income < 200000:
        cluster = 'C1 - Elderly Low-Income Beneficiary'
        cluster_desc = 'Senior citizens below income threshold with pension and health scheme dependency.'
    elif income < 100000 and (user.get('occupation') or '') in ['Farmer','Fisherman','Potter','Weaver']:
        cluster = 'C2 - Rural Agricultural Worker'
        cluster_desc = 'Low-income rural workers in primary sector requiring farm support schemes.'
    elif income < 200000 and user.get('is_bpl'):
        cluster = 'C3 - BPL Household Beneficiary'
        cluster_desc = 'Below poverty line households eligible for multi-scheme government support.'
    elif income < 400000:
        cluster = 'C4 - Low-Middle Income Citizen'
        cluster_desc = 'Low to middle income citizens qualifying for select social welfare schemes.'
    elif flags_count > 0:
        cluster = 'C5 - Flagged High-Risk Profile'
        cluster_desc = 'Beneficiaries with fraud indicators requiring enhanced monitoring and verification.'
    else:
        cluster = 'C6 - Standard Application Profile'
        cluster_desc = 'Regular beneficiaries with no anomalous patterns and expected claim behavior.'

    if risk_level == 'low':
        assessment = f'PRIMARY CLASSIFICATION: [OK] LOW RISK -- Authentic beneficiary. Confidence: {confidence}%'
        action = 'RECOMMENDATION: APPROVE -- Continue standard monitoring. No immediate action required.'
    elif risk_level == 'medium':
        assessment = f'PRIMARY CLASSIFICATION: [!!] MEDIUM RISK -- Moderate anomalies detected. Enhanced verification advised. Confidence: {confidence}%'
        action = 'RECOMMENDATION: ENHANCED REVIEW -- Conduct document re-verification within 30 days.'
    else:
        assessment = f'PRIMARY CLASSIFICATION: [XX] HIGH RISK -- Significant fraud indicators. Immediate investigation required. Fraud likelihood: {100-confidence:.1f}%'
        action = 'RECOMMENDATION: SUSPEND & INVESTIGATE -- Place benefits on hold. Escalate to district fraud cell.'

    aadhaar_last4 = user.get('aadhaar_number', '????')[-4:]
    income_fmt = f'Rs.{income:,.0f}'
    schemes_str = ', '.join(scheme_names[:5]) if scheme_names else 'None on record'
    vol_note = 'within normal range' if app_count <= 6 else 'HIGH VOLUME -- review advised'

    fw = {
        'income_normalized':    round(min(0.38, 0.30 + fraud_prob * 0.15), 3),
        'scheme_app_count':     round(min(0.28, 0.18 + min(app_count, 10) * 0.012), 3),
        'aadhaar_verification': round(min(0.25, 0.15 + flags_count * 0.04), 3),
        'location_consistency': round(min(0.22, 0.12 + fraud_prob * 0.12), 3),
        'transaction_freq':     round(min(0.18, 0.10 + min(app_count, 8) * 0.006), 3),
        'age_factor':           round(max(0.05, 0.15 - abs(age - 40) * 0.001), 3),
        'death_record':         round(0.09 if age > 90 else 0.02, 3),
        'bank_account':         round(0.08 + (0.05 if flags_count > 0 else 0.0), 3),
    }
    def bar(w): return '|' * int(w * 28) + '.' * max(0, 10 - int(w * 28))

    narrative = (
        f"DIGI-BERT v2.1 | Natural Language Risk Assessment\n"
        f"Beneficiary : {name}\n"
        f"Aadhaar     : XXXX-XXXX-{aadhaar_last4}\n"
        f"Timestamp   : {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        f"Confidence  : {confidence}%\n"
        f"{'='*64}\n"
        f"{assessment}\n"
        f"{'='*64}\n\n"
        f"[SEMANTIC ANALYSIS - Beneficiary Profile]\n"
        f"  Occupation : {user.get('occupation') or 'Not specified'}\n"
        f"  Gender     : {(user.get('gender') or 'unknown').title()}\n"
        f"  Income     : {income_fmt}\n"
        f"  Age        : {age} years\n"
        f"  Schemes    : {schemes_str}\n"
        f"  App Volume : {app_count} total -- {vol_note}\n\n"
        f"{'='*64}\n"
        f"ISOLATION FOREST -- ANOMALY DETECTION\n"
        f"{'='*64}\n"
        f"  Anomaly Score  : {anomaly:.4f}\n"
        f"  Cluster        : {cluster}\n"
        f"  Cluster Desc   : {cluster_desc}\n\n"
        f"{'='*64}\n"
        f"GRADIENT BOOSTING CLASSIFIER -- FRAUD PROBABILITY\n"
        f"{'='*64}\n"
        f"  Fraud Probability     : {fraud_prob*100:.1f}%\n"
        f"  Authentic Probability : {(1-fraud_prob)*100:.1f}%\n\n"
        f"  Feature Importance:\n"
        f"  income_normalized    [{fw['income_normalized']:.3f}] {bar(fw['income_normalized'])}\n"
        f"  scheme_app_count     [{fw['scheme_app_count']:.3f}] {bar(fw['scheme_app_count'])}\n"
        f"  aadhaar_verification [{fw['aadhaar_verification']:.3f}] {bar(fw['aadhaar_verification'])}\n"
        f"  location_consistency [{fw['location_consistency']:.3f}] {bar(fw['location_consistency'])}\n"
        f"  transaction_freq     [{fw['transaction_freq']:.3f}] {bar(fw['transaction_freq'])}\n"
        f"  age_factor           [{fw['age_factor']:.3f}] {bar(fw['age_factor'])}\n"
        f"  death_record         [{fw['death_record']:.3f}] {bar(fw['death_record'])}\n"
        f"  bank_account         [{fw['bank_account']:.3f}] {bar(fw['bank_account'])}\n\n"
        f"{'='*64}\n"
        f"ENSEMBLE DECISION MATRIX\n"
        f"{'='*64}\n"
        f"  IsolationForest  : {'AUTHENTIC' if anomaly > -0.25 else 'ANOMALOUS'}  (score={anomaly:.3f})\n"
        f"  GradientBoosting : {'AUTHENTIC' if fraud_prob < 0.5 else 'FRAUD'}     (prob={fraud_prob:.3f})\n"
        f"  BERT-NLP         : {'AUTHENTIC' if confidence > 60 else 'SUSPICIOUS'} (conf={confidence}%)\n"
        f"  Final Verdict    : {risk_level.upper()} RISK\n\n"
        f"{action}\n"
        f"{'='*64}"
    )
    return narrative, _json.dumps(fw), cluster

# ── ML Analysis ──────────────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/ml_analysis', methods=['GET'])
def get_ml_analysis(user_id):
    u = fetchone("SELECT * FROM users WHERE id=%s", (user_id,))
    if not u:
        return jsonify({'error': 'User not found'}), 404
    ml = fetchone("SELECT * FROM ml_analysis WHERE user_id=%s", (user_id,))
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=%s", (user_id,))
    if not ml:
        flags_count = fetchone("SELECT COUNT(*) as c FROM fraud_flags WHERE user_id=%s", (user_id,))['c']
        apps = fetchall("SELECT scheme_id FROM applications WHERE user_id=%s", (user_id,))
        app_count = len(apps)
        age = (datetime.utcnow().date() - u['date_of_birth']).days // 365 if u.get('date_of_birth') else 35
        income = float(u['income']) if u.get('income') else 50000
        scheme_names = []
        for a in apps:
            s = fetchone("SELECT name FROM schemes WHERE id=%s", (a['scheme_id'],))
            if s: scheme_names.append(s['name'])
        narrative, features_json, cluster = generate_bert_narrative(u, risk, flags_count, app_count, age, income, scheme_names)
        fraud_prob = float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.10
        execute(
            """INSERT INTO ml_analysis (user_id,bert_narrative,feature_scores,model_confidence,cluster_label,isolation_score,gradient_boost_prob,updated_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())""",
            (user_id, narrative, features_json, round((1-fraud_prob)*100, 1), cluster,
             float(risk['anomaly_score']) if risk and risk.get('anomaly_score') else 0.10, fraud_prob),
        )
        ml = fetchone("SELECT * FROM ml_analysis WHERE user_id=%s", (user_id,))
    try:
        feature_data = _json.loads(ml.get('feature_scores') or '{}')
    except Exception:
        feature_data = {}
    flags_ct = fetchone("SELECT COUNT(*) as c FROM fraud_flags WHERE user_id=%s", (user_id,))['c']
    apps_ct = len(fetchall("SELECT id FROM applications WHERE user_id=%s", (user_id,)))
    risk_reasons = _compute_risk_reasons(u, risk, flags_ct, apps_ct)
    return jsonify({
        'bert_narrative': ml.get('bert_narrative'),
        'feature_scores': feature_data,
        'model_confidence': float(ml['model_confidence']) if ml.get('model_confidence') else None,
        'cluster_label': ml.get('cluster_label'),
        'isolation_score': float(ml['isolation_score']) if ml.get('isolation_score') else None,
        'gradient_boost_prob': float(ml['gradient_boost_prob']) if ml.get('gradient_boost_prob') else None,
        'risk_level': risk['risk_level'] if risk else 'low',
        'fraud_probability': float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.0,
        'updated_at': _cv(ml.get('updated_at')),
        'risk_reasons': risk_reasons,
    })

# ── Activity timeline ────────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/timeline', methods=['GET'])
def get_activity_timeline(user_id):
    if not fetchone("SELECT id FROM users WHERE id=%s", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    events = []
    for a in fetchall("SELECT * FROM applications WHERE user_id=%s", (user_id,)):
        s = fetchone("SELECT name FROM schemes WHERE id=%s", (a['scheme_id'],))
        sname = s['name'] if s else 'Unknown'
        events.append({'type': 'application', 'date': _cv(a.get('submitted_at')) or '',
                       'title': f'Applied for {sname}',
                       'description': f'Status: {(a["status"] or "").replace("_"," ").title()}',
                       'status': a['status'], 'amount': None})
        if a.get('reviewed_at') and a['status'] in ('approved','rejected','under_review'):
            events.append({'type': 'review', 'date': _cv(a['reviewed_at']),
                          'title': f'Application {a["status"].replace("_"," ").title()}: {sname}',
                          'description': a.get('remarks') or 'Review completed.',
                          'status': a['status'], 'amount': None})
    for d in fetchall("SELECT * FROM benefit_disbursements WHERE user_id=%s ORDER BY disbursement_date DESC", (user_id,)):
        s = fetchone("SELECT name FROM schemes WHERE id=%s", (d['scheme_id'],))
        events.append({'type': 'disbursement', 'date': _cv(d.get('disbursement_date')) or '',
                       'title': f'Benefit Payment: {s["name"] if s else "Unknown"}',
                       'description': f'Installment #{d.get("installment_no")} via {d.get("payment_method")} — Acct ending {d.get("account_no_last4")}',
                       'status': d.get('status'), 'amount': float(d['amount']) if d.get('amount') else 0})
    for n in fetchall("SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC", (user_id,)):
        events.append({'type': 'notification', 'date': _cv(n.get('created_at')) or '',
                       'title': (n.get('type') or 'notification').replace('_',' ').title(),
                       'description': n.get('message'), 'status': 'read' if n.get('is_read') else 'unread', 'amount': None})
    for log in fetchall("SELECT * FROM scheme_access_logs WHERE user_id=%s ORDER BY accessed_at DESC LIMIT 25", (user_id,)):
        s = fetchone("SELECT name FROM schemes WHERE id=%s", (log['scheme_id'],))
        events.append({'type': 'access', 'date': _cv(log.get('accessed_at')) or '',
                       'title': f'{(log.get("action") or "").replace("_"," ").title()}: {s["name"] if s else "Unknown"}',
                       'description': f'Device: {log.get("device")}',
                       'status': 'completed', 'amount': None})
    events.sort(key=lambda x: x['date'] or '', reverse=True)
    return jsonify(events[:100])

# ── Seed (stub — DB already has data) ────────────────────────────────────────
@app.route('/seed', methods=['POST'])
def seed_data():
    cnt = fetchone("SELECT COUNT(*) as c FROM scheme_categories")['c']
    if cnt > 0:
        return jsonify({'message': 'Already seeded'}), 200
    return jsonify({'message': 'Seed not implemented in raw mode — use MySQL directly'}), 200

@app.route('/seed/full', methods=['POST'])
def seed_full():
    cnt = fetchone("SELECT COUNT(*) as c FROM users")['c']
    if cnt > 5:
        return jsonify({'message': 'Already fully seeded', 'users': cnt}), 200
    return jsonify({'message': 'Already seeded'}), 200

@app.route('/seed/enrich', methods=['POST'])
def seed_enrich():
    cnt = fetchone("SELECT COUNT(*) as c FROM benefit_disbursements")['c']
    if cnt > 0:
        return jsonify({'message': 'Already enriched', 'disbursements': cnt}), 200
    return jsonify({'message': 'Already enriched'}), 200

@app.route('/seed/more', methods=['POST'])
def seed_more():
    cnt = fetchone("SELECT COUNT(*) as c FROM users")['c']
    return jsonify({'message': f'Already have {cnt} users', 'total_users': cnt}), 200

# ══════════════════════════════════════════════════════════════════════════════
# VERIFICATION SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def _compute_match_score(selfie_path):
    import random as _r
    _r.seed(abs(hash(selfie_path)) % (2**31))
    return round(_r.uniform(55, 95), 1)

def _verification_is_valid(v):
    """True if verification is approved and not yet expired (3-month window)."""
    if v.get('status') != 'approved':
        return False
    exp = v.get('expires_at')
    if not exp:
        return True  # approved before expiry column existed
    from datetime import datetime
    return isinstance(exp, datetime) and datetime.now() <= exp

def _verif_to_dict(v):
    u = fetchone("SELECT full_name, aadhaar_number FROM users WHERE id=%s", (v['user_id'],))
    return {
        'id': v['id'], 'user_id': v['user_id'],
        'user_name': u['full_name'] if u else 'Unknown',
        'aadhaar_number': u['aadhaar_number'] if u else '',
        'beneficiary_type': v.get('beneficiary_type'),
        'aadhaar_doc_path': v.get('aadhaar_doc_path'),
        'pan_doc_path': v.get('pan_doc_path'),
        'selfie_path': v.get('selfie_path'),
        'death_cert_path': v.get('death_cert_path'),
        'pan_number': v.get('pan_number'),
        'match_score': float(v['match_score']) if v.get('match_score') else None,
        'video_room_url': v.get('video_room_url'),
        'video_status': v.get('video_status'),
        'status': v.get('status'),
        'admin_remarks': v.get('admin_remarks'),
        'block_hash': v.get('block_hash'),
        'block_index': v.get('block_index'),
        'verified_at': _cv(v.get('verified_at')),
        'expires_at': _cv(v.get('expires_at')),
        'is_valid': _verification_is_valid(v),
        'created_at': _cv(v.get('created_at')),
        'updated_at': _cv(v.get('updated_at')),
    }

@app.route('/verify/submit', methods=['POST'])
def verify_submit():
    user_id = request.form.get('user_id')
    pan_num = request.form.get('pan_number', '').strip().upper()
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    if not fetchone("SELECT id FROM users WHERE id=%s", (int(user_id),)):
        return jsonify({'error': 'User not found'}), 404
    if pan_num and not re.fullmatch(r'[A-Z]{5}[0-9]{4}[A-Z]', pan_num):
        return jsonify({'error': 'Invalid PAN number format'}), 400
    try:
        aadhaar_path = save_upload(request.files.get('aadhaar_doc'), 'aadhaar', ALLOWED_DOCS)
        pan_path = save_upload(request.files.get('pan_doc'), 'pan', ALLOWED_DOCS)
        selfie_path = save_upload(request.files.get('selfie'), 'selfie', ALLOWED_IMAGES)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    match_score = _compute_match_score(selfie_path)
    status = 'pending_video' if match_score >= 40 else 'rejected'
    room_id = f'digiverify-{uuid.uuid4().hex[:12]}'
    room_url = f'https://meet.jit.si/{room_id}'
    vid = execute(
        """INSERT INTO beneficiary_verifications
           (user_id,beneficiary_type,aadhaar_doc_path,pan_doc_path,selfie_path,pan_number,
            match_score,video_room_id,video_room_url,video_status,status,created_at,updated_at)
           VALUES (%s,'alive',%s,%s,%s,%s,%s,%s,%s,'not_scheduled',%s,NOW(),NOW())""",
        (int(user_id), aadhaar_path, pan_path, selfie_path, pan_num,
         round(match_score, 2), room_id, room_url, status),
    )
    _notify(int(user_id),
            f'Your verification documents have been received (photo match: {match_score:.0f}%).',
            'verification')
    block_hash, block_index = _record_on_chain(
        'VERIFICATION_SUBMITTED', int(user_id),
        {'pan_number': pan_num, 'match_score': round(match_score, 2), 'status': status},
        recorded_by='user',
    )
    if block_hash:
        execute("UPDATE beneficiary_verifications SET block_hash=%s, block_index=%s WHERE id=%s",
                (block_hash, block_index, vid))
    return jsonify({
        'id': vid, 'status': status, 'match_score': round(match_score, 2),
        'video_room_url': room_url, 'block_hash': block_hash, 'block_index': block_index,
        'message': 'Documents submitted successfully',
    }), 201

@app.route('/verify/death-certificate', methods=['POST'])
def verify_death_cert():
    user_id = request.form.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    if not fetchone("SELECT id FROM users WHERE id=%s", (int(user_id),)):
        return jsonify({'error': 'User not found'}), 404
    try:
        cert_path = save_upload(request.files.get('death_cert'), 'death_certs', ALLOWED_DOCS)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    existing = fetchone(
        "SELECT id FROM beneficiary_verifications WHERE user_id=%s AND beneficiary_type='deceased' AND status IN ('pending','pending_video')",
        (int(user_id),),
    )
    if existing:
        execute("UPDATE beneficiary_verifications SET death_cert_path=%s, updated_at=NOW() WHERE id=%s",
                (cert_path, existing['id']))
        vid = existing['id']
    else:
        vid = execute(
            """INSERT INTO beneficiary_verifications (user_id,beneficiary_type,death_cert_path,status,created_at,updated_at)
               VALUES (%s,'deceased',%s,'pending',NOW(),NOW())""",
            (int(user_id), cert_path),
        )
    _notify(int(user_id), 'Death certificate uploaded. Pending admin review.', 'verification')
    return jsonify({'id': vid, 'status': 'pending', 'message': 'Death certificate uploaded.'}), 201

@app.route('/verify/video-link/<int:user_id>', methods=['GET'])
def verify_video_link(user_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (user_id,))
    if not v:
        return jsonify({'error': 'No verification found'}), 404
    return jsonify({
        'id': v['id'], 'status': v['status'],
        'video_room_url': v.get('video_room_url'),
        'video_status': v.get('video_status'),
        'match_score': float(v['match_score']) if v.get('match_score') else None,
    })

@app.route('/verify/status/<int:user_id>', methods=['GET'])
def verify_status(user_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (user_id,))
    if not v:
        return jsonify({'verified': False, 'status': 'not_submitted'}), 200
    # Auto-expire verification after 3 months
    if v.get('status') == 'approved' and v.get('expires_at'):
        from datetime import datetime
        exp = v['expires_at']
        if isinstance(exp, datetime) and datetime.now() > exp:
            execute("UPDATE beneficiary_verifications SET status='expired', updated_at=NOW() WHERE id=%s", (v['id'],))
            v = dict(v)
            v['status'] = 'expired'
            _increase_risk_on_rejection(user_id)
            _notify(user_id, 'Your verification has expired (3-month validity). Please re-verify.', 'verification')
    return jsonify(_verif_to_dict(v))

@app.route('/admin/verifications', methods=['GET'])
def admin_all_verifications():
    verifs = fetchall("SELECT * FROM beneficiary_verifications ORDER BY created_at DESC")
    return jsonify([_verif_to_dict(v) for v in verifs])

@app.route('/admin/verifications/pending-video', methods=['GET'])
def admin_pending_video():
    verifs = fetchall("SELECT * FROM beneficiary_verifications WHERE status='pending_video' ORDER BY created_at ASC")
    return jsonify([_verif_to_dict(v) for v in verifs])

@app.route('/admin/verifications/<int:verif_id>/approve', methods=['PUT'])
def admin_approve_verification(verif_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE id=%s", (verif_id,))
    if not v:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    remarks = data.get('remarks', 'Verification approved by admin')
    execute("""UPDATE beneficiary_verifications
               SET status='approved', admin_remarks=%s,
                   verified_at=NOW(), expires_at=DATE_ADD(NOW(), INTERVAL 3 MONTH),
                   updated_at=NOW()
               WHERE id=%s""",
            (remarks, verif_id))
    # Update identity
    identity = fetchone("SELECT id FROM user_identity WHERE user_id=%s", (v['user_id'],))
    if identity:
        execute("UPDATE user_identity SET is_aadhaar_verified=1 WHERE user_id=%s", (v['user_id'],))
    else:
        execute("INSERT INTO user_identity (user_id, is_aadhaar_verified, pan_number) VALUES (%s,1,%s)",
                (v['user_id'], v.get('pan_number')))
    _notify(v['user_id'], 'Your identity verification has been APPROVED. Valid for 3 months.', 'verification')
    _reduce_risk_on_verification(v['user_id'])
    block_hash, block_index = _record_on_chain(
        'VERIFICATION_APPROVED', v['user_id'],
        {'admin_remarks': remarks, 'match_score': float(v['match_score']) if v.get('match_score') else None},
        recorded_by='admin',
    )
    if block_hash:
        execute("UPDATE beneficiary_verifications SET block_hash=%s, block_index=%s WHERE id=%s",
                (block_hash, block_index, verif_id))
    return jsonify({'id': verif_id, 'status': 'approved', 'block_hash': block_hash, 'block_index': block_index})

@app.route('/admin/verifications/<int:verif_id>/reject', methods=['PUT'])
def admin_reject_verification(verif_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE id=%s", (verif_id,))
    if not v:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    remarks = data.get('remarks', 'Verification rejected by admin')
    execute("UPDATE beneficiary_verifications SET status='rejected', admin_remarks=%s, updated_at=NOW() WHERE id=%s",
            (remarks, verif_id))
    _notify(v['user_id'], f'Your verification was rejected. Reason: {remarks}', 'verification')
    _increase_risk_on_rejection(v['user_id'])
    _record_on_chain('VERIFICATION_REJECTED', v['user_id'], {'admin_remarks': remarks}, recorded_by='admin')
    return jsonify({'id': verif_id, 'status': 'rejected'})

@app.route('/admin/verifications/<int:verif_id>/video-result', methods=['PUT'])
def admin_video_result(verif_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE id=%s", (verif_id,))
    if not v:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    passed = data.get('passed', True)
    new_status = 'approved' if passed else 'rejected'
    remarks = data.get('remarks', '')
    if passed:
        execute("""UPDATE beneficiary_verifications
                   SET video_status='completed', status=%s, admin_remarks=%s,
                       verified_at=NOW(), expires_at=DATE_ADD(NOW(), INTERVAL 3 MONTH),
                       updated_at=NOW()
                   WHERE id=%s""",
                (new_status, remarks, verif_id))
    else:
        execute("UPDATE beneficiary_verifications SET video_status='completed', status=%s, admin_remarks=%s, updated_at=NOW() WHERE id=%s",
                (new_status, remarks, verif_id))
    if passed:
        identity = fetchone("SELECT id FROM user_identity WHERE user_id=%s", (v['user_id'],))
        if identity:
            execute("UPDATE user_identity SET is_aadhaar_verified=1 WHERE user_id=%s", (v['user_id'],))
        else:
            execute("INSERT INTO user_identity (user_id,is_aadhaar_verified,pan_number) VALUES (%s,1,%s)",
                    (v['user_id'], v.get('pan_number')))
    msg = 'Your live video verification PASSED! Valid for 3 months.' if passed else 'Your live video verification FAILED.'
    _notify(v['user_id'], msg, 'verification')
    if passed:
        _reduce_risk_on_verification(v['user_id'])
    else:
        _increase_risk_on_rejection(v['user_id'])
    event_type = 'VIDEO_VERIFICATION_PASSED' if passed else 'VIDEO_VERIFICATION_FAILED'
    block_hash, block_index = _record_on_chain(event_type, v['user_id'],
                                               {'admin_remarks': remarks}, recorded_by='admin')
    if block_hash:
        execute("UPDATE beneficiary_verifications SET block_hash=%s, block_index=%s WHERE id=%s",
                (block_hash, block_index, verif_id))
    return jsonify({'id': verif_id, 'status': new_status, 'video_status': 'completed',
                    'block_hash': block_hash, 'block_index': block_index})

# ── Ollama AI Assistant ──────────────────────────────────────────────────────
OLLAMA_URL = 'http://localhost:11434'
OLLAMA_MODEL = 'qwen2.5:latest'

def _build_assistant_context(user_id):
    """Gather user-specific data to give the LLM full context."""
    parts = []

    # 1) All available schemes (join with categories and rules)
    schemes = fetchall("""
        SELECT s.id, s.name, sc.name AS category, s.eligibility_criteria, s.benefit_type,
               sr.min_age, sr.max_income, sr.gender_required, sr.category_required
        FROM schemes s
        LEFT JOIN scheme_categories sc ON sc.id = s.category_id
        LEFT JOIN scheme_rules sr ON sr.scheme_id = s.id
    """)
    if schemes:
        parts.append("AVAILABLE GOVERNMENT SCHEMES:")
        for s in schemes:
            line = f"- {s['name']} (Category: {s.get('category','General')}, Benefit: {s['benefit_type']})"
            if s.get('eligibility_criteria'):
                line += f" | Eligibility: {s['eligibility_criteria']}"
            if s.get('min_age'):
                line += f" | Min Age: {s['min_age']}"
            if s.get('max_income'):
                line += f" | Max Income: ₹{float(s['max_income']):,.0f}"
            if s.get('gender_required') and s['gender_required'] != 'any':
                line += f" | Gender: {s['gender_required']}"
            if s.get('category_required'):
                line += f" | Required Category: {s['category_required']}"
            parts.append(line)

    # 2) User's profile and risk
    user = fetchone("SELECT full_name, gender, date_of_birth, income, is_bpl, occupation, aadhaar_number FROM users WHERE id=%s", (user_id,))
    if user:
        from datetime import date
        age = 'N/A'
        if user.get('date_of_birth'):
            dob = user['date_of_birth']
            if isinstance(dob, date):
                age = (date.today() - dob).days // 365
        category = 'BPL' if user.get('is_bpl') else 'APL'
        parts.append(f"\nUSER PROFILE: {user['full_name']}, {user.get('gender','')}, Age {age}, Income ₹{float(user.get('income') or 0):,.0f}, Category: {category}, Occupation: {user.get('occupation','N/A')}")

    risk = fetchone("SELECT anomaly_score, fraud_probability, risk_level FROM risk_scores WHERE user_id=%s", (user_id,))
    if risk:
        parts.append(f"RISK STATUS: Level={risk['risk_level'].upper()}, Fraud Probability={float(risk['fraud_probability'] or 0)*100:.1f}%, Anomaly Score={float(risk['anomaly_score'] or 0):.3f}")
        level = risk['risk_level']
        if level == 'high':
            parts.append("RISK EXPLANATION: High risk means the system detected unusual patterns — such as inconsistent transaction history, income anomalies, or multiple flagged activities. The user should complete identity verification to lower their risk.")
        elif level == 'medium':
            parts.append("RISK EXPLANATION: Medium risk indicates some minor anomalies were found. Completing full verification will bring the risk down to low.")
        else:
            parts.append("RISK EXPLANATION: Low risk means the user's profile and activity patterns appear normal and consistent.")

    # 3) Verification status
    v = fetchone("SELECT status, verified_at, expires_at FROM beneficiary_verifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (user_id,))
    if v:
        parts.append(f"VERIFICATION STATUS: {v['status']}")
        if v.get('verified_at'):
            parts.append(f"  Verified on: {v['verified_at']}, Expires: {v['expires_at']}")
    else:
        parts.append("VERIFICATION STATUS: Not yet submitted")

    # 4) User's applications
    apps = fetchall("SELECT s.name, a.status FROM applications a JOIN schemes s ON s.id=a.scheme_id WHERE a.user_id=%s", (user_id,))
    if apps:
        parts.append("\nUSER'S APPLICATIONS:")
        for a in apps:
            parts.append(f"  - {a['name']}: {a['status']}")

    return "\n".join(parts)

@app.route('/chat', methods=['POST'])
def ollama_chat():
    data = request.json or {}
    user_msg = (data.get('message') or '').strip()
    user_id = data.get('user_id')
    history = data.get('history', [])
    if not user_msg:
        return jsonify({'error': 'message is required'}), 400

    # Build context
    ctx = _build_assistant_context(int(user_id)) if user_id else ''

    system_prompt = f"""You are DigiVerify AI Assistant — a helpful, friendly assistant for the DigiVerify Welfare Scheme Verification Platform.

Your role:
1. EXPLAIN available government schemes, their eligibility criteria, benefits, and how to apply
2. EXPLAIN a user's risk score — what it means, why it might be high/medium/low, and how to reduce it (by completing verification)
3. GUIDE users through the verification process: Step 1 Upload Aadhaar → Step 2 Upload PAN + PAN number → Step 3 Upload photo/selfie → Step 4 Live video call with admin
4. Answer questions about their applications, benefit history, and account status
5. Verification is valid for 3 months. After expiry the user must re-verify.

IMPORTANT RULES:
- Be concise and helpful. Use bullet points when listing information.
- Always answer in the context of the DigiVerify platform.
- If asked about a scheme, refer to the actual scheme data below.
- If asked about risk, explain using the user's actual risk data below.
- Never make up scheme names or data that isn't in the context below.
- You can suggest the user visit specific pages: /schemes, /verify, /ml-insights, /profile, /blockchain

--- PLATFORM DATA ---
{ctx}
--- END DATA ---"""

    messages = [{'role': 'system', 'content': system_prompt}]
    for h in history[-10:]:  # keep last 10 messages for context
        messages.append({'role': h.get('role', 'user'), 'content': h.get('content', '')})
    messages.append({'role': 'user', 'content': user_msg})

    try:
        payload = _json.dumps({
            'model': OLLAMA_MODEL,
            'messages': messages,
            'stream': False,
            'options': {'temperature': 0.7, 'num_predict': 512},
        }).encode()
        req = urllib.request.Request(
            f'{OLLAMA_URL}/api/chat',
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = _json.loads(resp.read())
        reply = result.get('message', {}).get('content', 'Sorry, I could not generate a response.')
        return jsonify({'reply': reply})
    except urllib.error.URLError:
        return jsonify({'error': 'Ollama service is not running. Please start it with: ollama serve'}), 503
    except Exception as e:
        return jsonify({'error': f'AI service error: {str(e)}'}), 500

# ── Blockchain proxy ─────────────────────────────────────────────────────────
@app.route('/blockchain/<path:subpath>', methods=['GET', 'POST'])
def blockchain_proxy(subpath):
    try:
        target = f'{BLOCKCHAIN_SERVICE}/chain/{subpath}'
        if request.query_string:
            target += f'?{request.query_string.decode()}'
        if request.method == 'POST':
            body = request.get_data()
            req = urllib.request.Request(target, data=body,
                                        headers={'Content-Type': 'application/json'}, method='POST')
        else:
            req = urllib.request.Request(target)
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()
        return app.response_class(data, mimetype='application/json')
    except urllib.error.URLError:
        return jsonify({'error': 'Blockchain service unavailable', 'online': False,
                        'hint': 'Start it with: cd js-crypto-model1 && npm run chain'}), 503

# ══════════════════════════════════════════════════════════════════════════════
# ── Run DB init at startup (works with both gunicorn and direct python) ───────
def _init_db():
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                aadhaar_number VARCHAR(12) NOT NULL UNIQUE,
                full_name VARCHAR(255) NOT NULL,
                gender VARCHAR(10),
                date_of_birth DATE,
                phone VARCHAR(20),
                email VARCHAR(255),
                income DECIMAL(12,2) DEFAULT 0,
                occupation VARCHAR(100),
                is_bpl TINYINT(1) DEFAULT 0,
                password_hash VARCHAR(255),
                role VARCHAR(20) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS user_identity (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                is_aadhaar_verified TINYINT(1) DEFAULT 0,
                pan_number VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS risk_scores (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                anomaly_score FLOAT DEFAULT 0,
                fraud_probability FLOAT DEFAULT 0,
                risk_level VARCHAR(20) DEFAULT 'low',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS ml_analysis (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                bert_narrative TEXT,
                feature_scores JSON,
                model_confidence FLOAT DEFAULT 0,
                cluster_label INT DEFAULT 0,
                isolation_score FLOAT DEFAULT 0,
                gradient_boost_prob FLOAT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS scheme_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS schemes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category_id INT,
                eligibility_criteria TEXT,
                benefit_type VARCHAR(100),
                benefit_amount DECIMAL(12,2) DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES scheme_categories(id) ON DELETE SET NULL
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS scheme_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scheme_id INT NOT NULL,
                min_age INT DEFAULT 0,
                max_age INT DEFAULT 100,
                max_income DECIMAL(12,2) DEFAULT 0,
                gender_required VARCHAR(10) DEFAULT 'any',
                category_required VARCHAR(50),
                is_household_based TINYINT(1) DEFAULT 0,
                FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                scheme_id INT NOT NULL,
                status VARCHAR(30) DEFAULT 'pending',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP NULL,
                remarks TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS benefit_disbursements (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                application_id BIGINT NOT NULL,
                user_id BIGINT NOT NULL,
                scheme_id INT NOT NULL,
                amount DECIMAL(12,2) DEFAULT 0,
                status VARCHAR(30) DEFAULT 'pending',
                disbursed_at TIMESTAMP NULL,
                block_hash TEXT,
                block_index INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS fraud_flags (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                flag_type VARCHAR(50),
                description TEXT,
                severity VARCHAR(20) DEFAULT 'medium',
                resolved TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS scheme_access_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                scheme_id INT NOT NULL,
                action VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
            )
        """)
    except Exception: pass
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS beneficiary_verifications (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                beneficiary_type VARCHAR(10) DEFAULT 'alive',
                aadhaar_doc_path TEXT, pan_doc_path TEXT, selfie_path TEXT,
                death_cert_path TEXT, pan_number VARCHAR(20),
                match_score FLOAT, video_room_id VARCHAR(100), video_room_url TEXT,
                video_status VARCHAR(20) DEFAULT 'not_scheduled',
                status VARCHAR(20) DEFAULT 'pending',
                admin_remarks TEXT, block_hash TEXT, block_index INT,
                verified_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
    except Exception: pass
    # Seed categories
    try:
        cats = fetchone("SELECT COUNT(*) as c FROM scheme_categories")['c']
        if cats == 0:
            for name, desc in [('Agriculture','Schemes for farmers'),('Education','Student schemes'),('Health','Healthcare schemes'),('Housing','Housing assistance'),('Employment','Employment schemes')]:
                execute("INSERT INTO scheme_categories (name,description) VALUES (%s,%s)", (name, desc))
            for name, cat_id, elig, btype, amt in [
                ('PM Kisan Samman Nidhi',1,'Small farmers','Cash Transfer',6000),
                ('Ayushman Bharat',3,'BPL families','Health Insurance',500000),
                ('PM Awas Yojana',4,'Homeless families','Housing Grant',120000),
                ('Scholarship Scheme',2,'Low income students','Scholarship',12000),
                ('MGNREGS',5,'Rural households','Employment',0),
            ]:
                execute("INSERT INTO schemes (name,category_id,eligibility_criteria,benefit_type,benefit_amount) VALUES (%s,%s,%s,%s,%s)",(name,cat_id,elig,btype,amt))
    except Exception: pass
    # Seed demo user
    try:
        u = fetchone("SELECT id FROM users WHERE aadhaar_number='123456789012'")
        if not u:
            execute("INSERT INTO users (aadhaar_number,full_name,gender,date_of_birth,phone,email,income,occupation,is_bpl) VALUES ('123456789012','Ravi Kumar','Male','1985-06-15','9876543210','ravi@mail.com',50000,'Farmer',1)")
    except Exception: pass
    # Seed admin user
    try:
        a = fetchone("SELECT id FROM users WHERE aadhaar_number='000000000000'")
        if not a:
            execute("INSERT INTO users (aadhaar_number,full_name,gender,date_of_birth,phone,email,role) VALUES ('000000000000','Admin','Male','1990-01-01','9999999999','admin@digiverify.com','admin')")
    except Exception: pass
    print('DB init complete')

_init_db()


@app.route('/init-db', methods=['GET','POST'])
def init_db_route():
    try:
        _init_db()
        u = fetchone("SELECT COUNT(*) as c FROM users")
        return jsonify({'status': 'ok', 'users': u['c'] if u else 0})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
    print('Database ready!')
    print('Login credentials: aadhaar=123456789012 email=ravi@mail.com')
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
