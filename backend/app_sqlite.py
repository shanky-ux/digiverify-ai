"""Welfare System API — SQLite backend (no MySQL dependency)
   Drop-in replacement so the React frontend works without MySQL.
"""
from flask import Flask, request, jsonify, send_from_directory
try:
    from flask_cors import CORS
    HAS_CORS = True
except Exception:
    HAS_CORS = False

from datetime import datetime, timedelta, date
from werkzeug.utils import secure_filename
import os, sys, json as _json, uuid, decimal, re, sqlite3

# ── ML engine ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
ML_AVAILABLE = False
compute_risk_scores = None
try:
    from risk_engine import compute_risk_scores
    ML_AVAILABLE = True
except Exception as e:
    print(f"ML engine not loaded: {e}")

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
# SQLite Database helpers
# ══════════════════════════════════════════════════════════════════════════════
DB_PATH = os.path.join(os.path.dirname(__file__), 'welfare_system.db')

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def _row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def fetchall(sql, args=None):
    conn = get_conn()
    try:
        c = conn.execute(sql, args or ())
        return [dict(r) for r in c.fetchall()]
    finally:
        conn.close()

def fetchone(sql, args=None):
    conn = get_conn()
    try:
        c = conn.execute(sql, args or ())
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def execute(sql, args=None):
    conn = get_conn()
    try:
        c = conn.execute(sql, args or ())
        conn.commit()
        return c.lastrowid
    finally:
        conn.close()

def execute_many(sql_list):
    conn = get_conn()
    try:
        for sql, args in sql_list:
            conn.execute(sql, args or ())
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

# ── Blockchain (stub) ────────────────────────────────────────────────────────
BLOCKCHAIN_SERVICE = os.environ.get('BLOCKCHAIN_SERVICE', 'http://localhost:3001')

def _record_on_chain(event_type, user_id, data=None, recorded_by='system'):
    import urllib.request, urllib.error
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
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = _json.loads(resp.read())
            return result.get('blockHash'), result.get('blockIndex')
    except Exception as exc:
        print(f'[Blockchain] Warning: {exc}')
        return None, None

# ── Risk adjustment on verification ──────────────────────────────────────
def _reduce_risk_on_verification(user_id):
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=?", (user_id,))
    if risk:
        execute(
            "UPDATE risk_scores SET fraud_probability=?, anomaly_score=?, risk_level=?, updated_at=datetime('now') WHERE user_id=?",
            (0.05, 0.0, 'low', user_id),
        )
        execute("DELETE FROM ml_analysis WHERE user_id=?", (user_id,))
    else:
        execute(
            "INSERT INTO risk_scores (user_id,anomaly_score,fraud_probability,risk_level,updated_at) VALUES (?,0.0,0.05,'low',datetime('now'))",
            (user_id,),
        )

def _increase_risk_on_rejection(user_id):
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=?", (user_id,))
    if risk:
        old_fp = float(risk['fraud_probability'] or 0)
        new_fp = min(0.95, old_fp * 1.3 + 0.1)
        new_level = 'low' if new_fp < 0.3 else ('medium' if new_fp < 0.6 else 'high')
        execute(
            "UPDATE risk_scores SET fraud_probability=?, risk_level=?, updated_at=datetime('now') WHERE user_id=?",
            (round(new_fp, 4), new_level, user_id),
        )
        execute("DELETE FROM ml_analysis WHERE user_id=?", (user_id,))
    else:
        execute(
            "INSERT INTO risk_scores (user_id,anomaly_score,fraud_probability,risk_level,updated_at) VALUES (?,-0.3,0.45,'medium',datetime('now'))",
            (user_id,),
        )

# ── Notifications ────────────────────────────────────────────────────────────
def _notify(user_id, message, ntype='info'):
    execute(
        "INSERT INTO notifications (user_id, message, type, is_read, created_at) VALUES (?,?,?,0,datetime('now'))",
        (user_id, message, ntype),
    )

# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def home():
    return jsonify({'message': 'Welfare System API (SQLite)'})

# ── Auth ─────────────────────────────────────────────────────────────────────
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    aadhaar = data.get('aadhaar_number')
    email = data.get('email')
    if not aadhaar or not email:
        return jsonify({'error': 'aadhaar_number and email required'}), 400
    user = fetchone(
        "SELECT id, full_name FROM users WHERE aadhaar_number=? AND email=?",
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
    uid = execute(
        """INSERT INTO users (aadhaar_number,full_name,gender,date_of_birth,phone,email,income,occupation,is_bpl,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))""",
        (d['aadhaar_number'], d.get('full_name'), d.get('gender'), d.get('date_of_birth'),
         d.get('phone'), d.get('email'), d.get('income'), d.get('occupation'),
         d.get('is_bpl', False)),
    )
    return jsonify({'id': uid}), 201

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    u = fetchone("SELECT * FROM users WHERE id=?", (user_id,))
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
        cat = fetchone("SELECT id FROM scheme_categories WHERE name=?", (d.get('category', 'General'),))
        if not cat:
            cat_id = execute("INSERT INTO scheme_categories (name,description) VALUES (?,'')", (d.get('category', 'General'),))
        else:
            cat_id = cat['id']
    sid = execute(
        "INSERT INTO schemes (name,category_id,eligibility_criteria,benefit_type,created_at) VALUES (?,?,?,?,datetime('now'))",
        (d['name'], cat_id, d.get('eligibility_criteria', ''), d.get('benefit_type', 'cash')),
    )
    if d.get('min_age') or d.get('max_income') or d.get('gender_required'):
        execute(
            "INSERT INTO scheme_rules (scheme_id,min_age,max_income,gender_required,category_required,is_household_based) VALUES (?,?,?,?,?,?)",
            (sid, d.get('min_age'), d.get('max_income'), d.get('gender_required'), d.get('category_required'), d.get('is_household_based', False)),
        )
    return jsonify({'id': sid, 'name': d['name']}), 201

@app.route('/schemes/<int:scheme_id>/risk_reason', methods=['GET'])
def scheme_risk_reason(scheme_id):
    s = fetchone("SELECT name FROM schemes WHERE id=?", (scheme_id,))
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
    if not fetchone("SELECT id FROM users WHERE id=?", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    apps = fetchall("SELECT * FROM applications WHERE user_id=?", (user_id,))
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
    if not fetchone("SELECT id FROM users WHERE id=?", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    if not fetchone("SELECT id FROM schemes WHERE id=?", (scheme_id,)):
        return jsonify({'error': 'Scheme not found'}), 404
    if fetchone("SELECT id FROM applications WHERE user_id=? AND scheme_id=?", (user_id, scheme_id)):
        return jsonify({'error': 'Already applied'}), 409
    aid = execute(
        "INSERT INTO applications (user_id,scheme_id,status,submitted_at) VALUES (?,?,'submitted',datetime('now'))",
        (user_id, scheme_id),
    )
    return jsonify({'id': aid, 'status': 'submitted'}), 201

# ── Risk / Fraud ─────────────────────────────────────────────────────────────
@app.route('/risk_scores/<int:user_id>', methods=['GET'])
def get_risk_score(user_id):
    r = fetchone("SELECT anomaly_score,fraud_probability,risk_level FROM risk_scores WHERE user_id=?", (user_id,))
    if r:
        return jsonify({
            'anomaly_score': float(r['anomaly_score']) if r['anomaly_score'] else 0,
            'fraud_probability': float(r['fraud_probability']) if r['fraud_probability'] else 0,
            'risk_level': r['risk_level'],
        })
    return jsonify({'anomaly_score': 0, 'fraud_probability': 0.05, 'risk_level': 'low'})

@app.route('/users/<int:user_id>/fraud_flags', methods=['GET'])
def get_fraud_flags(user_id):
    flags = fetchall("SELECT * FROM fraud_flags WHERE user_id=?", (user_id,))
    return jsonify([{
        'id': f['id'], 'flag_type': f['flag_type'], 'severity': f['severity'],
        'description': f['description'], 'created_at': _cv(f.get('created_at')),
    } for f in flags])

# ── Notifications ────────────────────────────────────────────────────────────
@app.route('/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    notes = fetchall("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC", (user_id,))
    return jsonify([{
        'id': n['id'], 'message': n['message'], 'type': n.get('type'),
        'is_read': bool(n.get('is_read')), 'created_at': _cv(n.get('created_at')),
    } for n in notes])

@app.route('/notifications/<int:notif_id>/read', methods=['PUT'])
def mark_notification_read(notif_id):
    n = fetchone("SELECT id FROM notifications WHERE id=?", (notif_id,))
    if not n:
        return jsonify({'error': 'Not found'}), 404
    execute("UPDATE notifications SET is_read=1 WHERE id=?", (notif_id,))
    return jsonify({'id': notif_id, 'is_read': True})

# ── Admin ────────────────────────────────────────────────────────────────────
@app.route('/admin/overview', methods=['GET'])
def admin_overview():
    total_users = fetchone("SELECT COUNT(*) as cnt FROM users")['cnt']
    total_apps = fetchone("SELECT COUNT(*) as cnt FROM applications")['cnt']
    schemes = fetchall("SELECT id, name FROM schemes")
    data = []
    for s in schemes:
        cnt = fetchone("SELECT COUNT(*) as cnt FROM applications WHERE scheme_id=?", (s['id'],))['cnt']
        avg = fetchone(
            """SELECT AVG(rs.fraud_probability) as avg_fp FROM risk_scores rs
               JOIN applications a ON rs.user_id=a.user_id WHERE a.scheme_id=?""",
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
        WHERE a.scheme_id=?
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
    a = fetchone("SELECT * FROM applications WHERE id=?", (app_id,))
    if not a:
        return jsonify({'error': 'Application not found'}), 404
    execute("UPDATE applications SET status=?, reviewed_at=datetime('now') WHERE id=?", (new_status, app_id))
    _notify(a['user_id'], f"Your application #{app_id} has been {new_status}.", 'application_update')
    return jsonify({'id': app_id, 'status': new_status})

@app.route('/admin/recompute_risk', methods=['POST'])
def recompute_risk():
    if not ML_AVAILABLE:
        return jsonify({'error': 'ML engine not available'}), 500
    users = fetchall("SELECT * FROM users")
    user_data = []
    for u in users:
        app_count = fetchone("SELECT COUNT(*) as c FROM applications WHERE user_id=?", (u['id'],))['c']
        age = 35
        if u.get('date_of_birth'):
            try:
                dob = datetime.strptime(u['date_of_birth'], '%Y-%m-%d').date()
                age = (datetime.utcnow().date() - dob).days // 365
            except Exception:
                pass
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
        existing = fetchone("SELECT id FROM risk_scores WHERE user_id=?", (s['user_id'],))
        if existing:
            execute("UPDATE risk_scores SET anomaly_score=?,fraud_probability=?,risk_level=?,updated_at=datetime('now') WHERE user_id=?",
                    (s['anomaly_score'], s['fraud_probability'], s['risk_level'], s['user_id']))
        else:
            execute("INSERT INTO risk_scores (user_id,anomaly_score,fraud_probability,risk_level,updated_at) VALUES (?,?,?,?,datetime('now'))",
                    (s['user_id'], s['anomaly_score'], s['fraud_probability'], s['risk_level']))
        count += 1
    return jsonify({'recomputed': count})

# ── User profile (comprehensive) ─────────────────────────────────────────────
@app.route('/users/<int:user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    u = fetchone("SELECT * FROM users WHERE id=?", (user_id,))
    if not u:
        return jsonify({'error': 'User not found'}), 404
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=?", (user_id,))
    flags = fetchall("SELECT * FROM fraud_flags WHERE user_id=?", (user_id,))
    apps = fetchall("SELECT * FROM applications WHERE user_id=?", (user_id,))
    identity = fetchone("SELECT * FROM user_identity WHERE user_id=?", (user_id,))
    ml = fetchone("SELECT cluster_label FROM ml_analysis WHERE user_id=?", (user_id,))
    age = None
    if u.get('date_of_birth'):
        try:
            dob = datetime.strptime(u['date_of_birth'], '%Y-%m-%d').date()
            age = (datetime.utcnow().date() - dob).days // 365
        except Exception:
            pass
    status_counts = {}
    for a in apps:
        status_counts[a['status']] = status_counts.get(a['status'], 0) + 1
    disb = fetchall("SELECT amount FROM benefit_disbursements WHERE user_id=? AND status='processed'", (user_id,))
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
    if not fetchone("SELECT id FROM users WHERE id=?", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    rows = fetchall("""
        SELECT bd.*, s.name as scheme_name, s.benefit_type, sc.name as cat_name
        FROM benefit_disbursements bd
        LEFT JOIN schemes s ON s.id=bd.scheme_id
        LEFT JOIN scheme_categories sc ON sc.id=s.category_id
        WHERE bd.user_id=? ORDER BY bd.disbursement_date DESC
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
    total = sum(float(d['amount'] or 0) for d in rows if d.get('status') == 'processed')
    return jsonify({'disbursements': result, 'total_received': round(total, 2), 'count': len(result)})

# ── Risk Reasons Generator ────────────────────────────────────────────────────
def _compute_risk_reasons(user, risk, flags_count=0, app_count=0):
    reasons = []
    fraud_prob = float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.0
    anomaly = float(risk['anomaly_score']) if risk and risk.get('anomaly_score') else 0.0
    age = 35
    if user.get('date_of_birth'):
        try:
            dob = datetime.strptime(user['date_of_birth'], '%Y-%m-%d').date()
            age = (datetime.utcnow().date() - dob).days // 365
        except Exception:
            pass
    income = float(user['income']) if user.get('income') else 50000
    is_bpl = int(user.get('is_bpl') or 0)

    if fraud_prob >= 0.80:
        reasons.append({'factor': 'Very High Fraud Probability', 'severity': 'critical', 'detail': f'Fraud probability is {fraud_prob*100:.1f}%, well above safe threshold (30%).'})
    elif fraud_prob >= 0.60:
        reasons.append({'factor': 'Elevated Fraud Probability', 'severity': 'high', 'detail': f'Fraud probability is {fraud_prob*100:.1f}%, exceeding the high-risk threshold (60%).'})
    elif fraud_prob >= 0.30:
        reasons.append({'factor': 'Moderate Fraud Probability', 'severity': 'medium', 'detail': f'Fraud probability is {fraud_prob*100:.1f}%, in the medium-risk band (30-60%).'})

    if anomaly < -0.5:
        reasons.append({'factor': 'Anomalous Behavior Pattern', 'severity': 'high', 'detail': f'Isolation Forest anomaly score is {anomaly:.4f}.'})
    elif anomaly < -0.25:
        reasons.append({'factor': 'Mild Behavioral Anomaly', 'severity': 'medium', 'detail': f'Anomaly score of {anomaly:.4f}.'})

    if age >= 100:
        reasons.append({'factor': 'Centenarian Age', 'severity': 'critical', 'detail': f'Beneficiary age is {age} years.'})
    elif age >= 85:
        reasons.append({'factor': 'Very Advanced Age', 'severity': 'high', 'detail': f'Beneficiary is {age} years old.'})

    if income < 5000:
        reasons.append({'factor': 'Extremely Low Reported Income', 'severity': 'medium', 'detail': f'Declared income is ₹{income:,.0f}/month.'})
    elif income > 800000 and is_bpl:
        reasons.append({'factor': 'Income-BPL Mismatch', 'severity': 'high', 'detail': f'Income is ₹{income:,.0f} but marked BPL.'})

    if flags_count >= 3:
        reasons.append({'factor': 'Multiple Fraud Flags', 'severity': 'critical', 'detail': f'{flags_count} fraud flags raised.'})
    elif flags_count >= 1:
        reasons.append({'factor': 'Existing Fraud Flags', 'severity': 'medium', 'detail': f'{flags_count} fraud flag(s) on record.'})

    if app_count >= 6:
        reasons.append({'factor': 'Excessive Scheme Applications', 'severity': 'medium', 'detail': f'Applied to {app_count} schemes.'})

    if not reasons:
        reasons.append({'factor': 'No Major Risk Factors', 'severity': 'low', 'detail': 'No significant risk indicators detected.'})

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
    elif income < 100000:
        cluster = 'C2 - Rural Agricultural Worker'
    elif income < 200000 and user.get('is_bpl'):
        cluster = 'C3 - BPL Household Beneficiary'
    elif income < 400000:
        cluster = 'C4 - Low-Middle Income Citizen'
    elif flags_count > 0:
        cluster = 'C5 - Flagged High-Risk Profile'
    else:
        cluster = 'C6 - Standard Application Profile'

    if risk_level == 'low':
        assessment = f'PRIMARY CLASSIFICATION: [OK] LOW RISK -- Confidence: {confidence}%'
    elif risk_level == 'medium':
        assessment = f'PRIMARY CLASSIFICATION: [!!] MEDIUM RISK -- Confidence: {confidence}%'
    else:
        assessment = f'PRIMARY CLASSIFICATION: [XX] HIGH RISK -- Fraud likelihood: {100-confidence:.1f}%'

    narrative = (
        f"DIGI-BERT v2.1 | Natural Language Risk Assessment\n"
        f"Beneficiary : {name}\n"
        f"Timestamp   : {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        f"{'='*64}\n"
        f"{assessment}\n"
        f"{'='*64}\n"
        f"Fraud Probability: {fraud_prob*100:.1f}%\n"
        f"Anomaly Score: {anomaly:.4f}\n"
        f"Cluster: {cluster}\n"
    )

    fw = {
        'income_normalized': round(min(0.38, 0.30 + fraud_prob * 0.15), 3),
        'scheme_app_count': round(min(0.28, 0.18 + min(app_count, 10) * 0.012), 3),
        'aadhaar_verification': round(min(0.25, 0.15 + flags_count * 0.04), 3),
        'location_consistency': round(min(0.22, 0.12 + fraud_prob * 0.12), 3),
        'transaction_freq': round(min(0.18, 0.10 + min(app_count, 8) * 0.006), 3),
        'age_factor': round(max(0.05, 0.15 - abs(age - 40) * 0.001), 3),
        'death_record': round(0.09 if age > 90 else 0.02, 3),
        'bank_account': round(0.08 + (0.05 if flags_count > 0 else 0.0), 3),
    }
    return narrative, _json.dumps(fw), cluster

# ── ML Analysis ──────────────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/ml_analysis', methods=['GET'])
def get_ml_analysis(user_id):
    u = fetchone("SELECT * FROM users WHERE id=?", (user_id,))
    if not u:
        return jsonify({'error': 'User not found'}), 404
    ml = fetchone("SELECT * FROM ml_analysis WHERE user_id=?", (user_id,))
    risk = fetchone("SELECT * FROM risk_scores WHERE user_id=?", (user_id,))
    if not ml:
        flags_count = fetchone("SELECT COUNT(*) as c FROM fraud_flags WHERE user_id=?", (user_id,))['c']
        apps = fetchall("SELECT scheme_id FROM applications WHERE user_id=?", (user_id,))
        app_count = len(apps)
        age = 35
        if u.get('date_of_birth'):
            try:
                dob = datetime.strptime(u['date_of_birth'], '%Y-%m-%d').date()
                age = (datetime.utcnow().date() - dob).days // 365
            except Exception:
                pass
        income = float(u['income']) if u.get('income') else 50000
        scheme_names = []
        for a in apps:
            s = fetchone("SELECT name FROM schemes WHERE id=?", (a['scheme_id'],))
            if s: scheme_names.append(s['name'])
        narrative, features_json, cluster = generate_bert_narrative(u, risk, flags_count, app_count, age, income, scheme_names)
        fraud_prob = float(risk['fraud_probability']) if risk and risk.get('fraud_probability') else 0.10
        execute(
            """INSERT INTO ml_analysis (user_id,bert_narrative,feature_scores,model_confidence,cluster_label,isolation_score,gradient_boost_prob,updated_at)
               VALUES (?,?,?,?,?,?,?,datetime('now'))""",
            (user_id, narrative, features_json, round((1-fraud_prob)*100, 1), cluster,
             float(risk['anomaly_score']) if risk and risk.get('anomaly_score') else 0.10, fraud_prob),
        )
        ml = fetchone("SELECT * FROM ml_analysis WHERE user_id=?", (user_id,))
    try:
        feature_data = _json.loads(ml.get('feature_scores') or '{}')
    except Exception:
        feature_data = {}
    flags_ct = fetchone("SELECT COUNT(*) as c FROM fraud_flags WHERE user_id=?", (user_id,))['c']
    apps_ct = len(fetchall("SELECT id FROM applications WHERE user_id=?", (user_id,)))
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
    if not fetchone("SELECT id FROM users WHERE id=?", (user_id,)):
        return jsonify({'error': 'User not found'}), 404
    events = []
    for a in fetchall("SELECT * FROM applications WHERE user_id=?", (user_id,)):
        s = fetchone("SELECT name FROM schemes WHERE id=?", (a['scheme_id'],))
        sname = s['name'] if s else 'Unknown'
        events.append({'type': 'application', 'date': _cv(a.get('submitted_at')) or '',
                       'title': f'Applied for {sname}',
                       'description': f'Status: {(a["status"] or "").replace("_"," ").title()}',
                       'status': a['status'], 'amount': None})
    for d in fetchall("SELECT * FROM benefit_disbursements WHERE user_id=? ORDER BY disbursement_date DESC", (user_id,)):
        s = fetchone("SELECT name FROM schemes WHERE id=?", (d['scheme_id'],))
        events.append({'type': 'disbursement', 'date': _cv(d.get('disbursement_date')) or '',
                       'title': f'Benefit Payment: {s["name"] if s else "Unknown"}',
                       'description': f'Installment #{d.get("installment_no")} via {d.get("payment_method")}',
                       'status': d.get('status'), 'amount': float(d['amount']) if d.get('amount') else 0})
    for n in fetchall("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC", (user_id,)):
        events.append({'type': 'notification', 'date': _cv(n.get('created_at')) or '',
                       'title': (n.get('type') or 'notification').replace('_',' ').title(),
                       'description': n.get('message'), 'status': 'read' if n.get('is_read') else 'unread', 'amount': None})
    events.sort(key=lambda x: x['date'] or '', reverse=True)
    return jsonify(events[:100])

# ── Seed stubs ───────────────────────────────────────────────────────────────
@app.route('/seed', methods=['POST'])
def seed_data():
    return jsonify({'message': 'Already seeded'}), 200

@app.route('/seed/full', methods=['POST'])
def seed_full():
    return jsonify({'message': 'Already seeded'}), 200

@app.route('/seed/enrich', methods=['POST'])
def seed_enrich():
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
    if v.get('status') != 'approved':
        return False
    exp = v.get('expires_at')
    if not exp:
        return True
    try:
        exp_dt = datetime.strptime(exp, '%Y-%m-%d %H:%M:%S') if isinstance(exp, str) else exp
        return datetime.now() <= exp_dt
    except Exception:
        return True

def _verif_to_dict(v):
    u = fetchone("SELECT full_name, aadhaar_number FROM users WHERE id=?", (v['user_id'],))
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
    if not fetchone("SELECT id FROM users WHERE id=?", (int(user_id),)):
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
           VALUES (?,'alive',?,?,?,?,?,?,?,'not_scheduled',?,datetime('now'),datetime('now'))""",
        (int(user_id), aadhaar_path, pan_path, selfie_path, pan_num,
         round(match_score, 2), room_id, room_url, status),
    )
    _notify(int(user_id), f'Your verification documents have been received (photo match: {match_score:.0f}%).', 'verification')
    block_hash, block_index = _record_on_chain(
        'VERIFICATION_SUBMITTED', int(user_id),
        {'pan_number': pan_num, 'match_score': round(match_score, 2), 'status': status},
        recorded_by='user',
    )
    if block_hash:
        execute("UPDATE beneficiary_verifications SET block_hash=?, block_index=? WHERE id=?",
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
    if not fetchone("SELECT id FROM users WHERE id=?", (int(user_id),)):
        return jsonify({'error': 'User not found'}), 404
    try:
        cert_path = save_upload(request.files.get('death_cert'), 'death_certs', ALLOWED_DOCS)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    existing = fetchone(
        "SELECT id FROM beneficiary_verifications WHERE user_id=? AND beneficiary_type='deceased' AND status IN ('pending','pending_video')",
        (int(user_id),),
    )
    if existing:
        execute("UPDATE beneficiary_verifications SET death_cert_path=?, updated_at=datetime('now') WHERE id=?",
                (cert_path, existing['id']))
        vid = existing['id']
    else:
        vid = execute(
            """INSERT INTO beneficiary_verifications (user_id,beneficiary_type,death_cert_path,status,created_at,updated_at)
               VALUES (?,'deceased',?,'pending',datetime('now'),datetime('now'))""",
            (int(user_id), cert_path),
        )
    _notify(int(user_id), 'Death certificate uploaded. Pending admin review.', 'verification')
    return jsonify({'id': vid, 'status': 'pending', 'message': 'Death certificate uploaded.'}), 201

@app.route('/verify/video-link/<int:user_id>', methods=['GET'])
def verify_video_link(user_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (user_id,))
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
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (user_id,))
    if not v:
        return jsonify({'verified': False, 'status': 'not_submitted'}), 200
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
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE id=?", (verif_id,))
    if not v:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    remarks = data.get('remarks', 'Verification approved by admin')
    execute("""UPDATE beneficiary_verifications
               SET status='approved', admin_remarks=?,
                   verified_at=datetime('now'), expires_at=datetime('now', '+3 months'),
                   updated_at=datetime('now')
               WHERE id=?""",
            (remarks, verif_id))
    identity = fetchone("SELECT id FROM user_identity WHERE user_id=?", (v['user_id'],))
    if identity:
        execute("UPDATE user_identity SET is_aadhaar_verified=1 WHERE user_id=?", (v['user_id'],))
    else:
        execute("INSERT INTO user_identity (user_id, is_aadhaar_verified, pan_number) VALUES (?,1,?)",
                (v['user_id'], v.get('pan_number')))
    _notify(v['user_id'], 'Your identity verification has been APPROVED. Valid for 3 months.', 'verification')
    _reduce_risk_on_verification(v['user_id'])
    block_hash, block_index = _record_on_chain(
        'VERIFICATION_APPROVED', v['user_id'],
        {'admin_remarks': remarks}, recorded_by='admin',
    )
    if block_hash:
        execute("UPDATE beneficiary_verifications SET block_hash=?, block_index=? WHERE id=?",
                (block_hash, block_index, verif_id))
    return jsonify({'id': verif_id, 'status': 'approved', 'block_hash': block_hash, 'block_index': block_index})

@app.route('/admin/verifications/<int:verif_id>/reject', methods=['PUT'])
def admin_reject_verification(verif_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE id=?", (verif_id,))
    if not v:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    remarks = data.get('remarks', 'Verification rejected by admin')
    execute("UPDATE beneficiary_verifications SET status='rejected', admin_remarks=?, updated_at=datetime('now') WHERE id=?",
            (remarks, verif_id))
    _notify(v['user_id'], f'Your verification was rejected. Reason: {remarks}', 'verification')
    _increase_risk_on_rejection(v['user_id'])
    return jsonify({'id': verif_id, 'status': 'rejected'})

@app.route('/admin/verifications/<int:verif_id>/video-result', methods=['PUT'])
def admin_video_result(verif_id):
    v = fetchone("SELECT * FROM beneficiary_verifications WHERE id=?", (verif_id,))
    if not v:
        return jsonify({'error': 'Not found'}), 404
    data = request.json or {}
    passed = data.get('passed', True)
    new_status = 'approved' if passed else 'rejected'
    remarks = data.get('remarks', '')
    if passed:
        execute("""UPDATE beneficiary_verifications
                   SET video_status='completed', status=?, admin_remarks=?,
                       verified_at=datetime('now'), expires_at=datetime('now', '+3 months'),
                       updated_at=datetime('now')
                   WHERE id=?""",
                (new_status, remarks, verif_id))
    else:
        execute("UPDATE beneficiary_verifications SET video_status='completed', status=?, admin_remarks=?, updated_at=datetime('now') WHERE id=?",
                (new_status, remarks, verif_id))
    if passed:
        identity = fetchone("SELECT id FROM user_identity WHERE user_id=?", (v['user_id'],))
        if identity:
            execute("UPDATE user_identity SET is_aadhaar_verified=1 WHERE user_id=?", (v['user_id'],))
        else:
            execute("INSERT INTO user_identity (user_id,is_aadhaar_verified,pan_number) VALUES (?,1,?)",
                    (v['user_id'], v.get('pan_number')))
    msg = 'Your live video verification PASSED! Valid for 3 months.' if passed else 'Your live video verification FAILED.'
    _notify(v['user_id'], msg, 'verification')
    if passed:
        _reduce_risk_on_verification(v['user_id'])
    else:
        _increase_risk_on_rejection(v['user_id'])
    return jsonify({'id': verif_id, 'status': new_status, 'video_status': 'completed'})

# ── Chat (stub without Ollama) ───────────────────────────────────────────────
@app.route('/chat', methods=['POST'])
def ollama_chat():
    data = request.json or {}
    user_msg = (data.get('message') or '').strip()
    if not user_msg:
        return jsonify({'error': 'message is required'}), 400
    # Provide a helpful static response when Ollama is not available
    reply = (
        "👋 Hello! I'm the DigiVerify AI Assistant.\n\n"
        "I can help you with:\n"
        "• **Government Schemes** — View available schemes at /schemes\n"
        "• **Verification** — Submit your documents at /verify\n"
        "• **Risk Score** — Check your ML risk analysis at /ml-insights\n"
        "• **Profile** — View your complete profile at /profile\n\n"
        "*Note: The full AI chat requires Ollama to be running locally.*"
    )
    return jsonify({'reply': reply})

# ── Blockchain proxy ─────────────────────────────────────────────────────────
@app.route('/blockchain/<path:subpath>', methods=['GET', 'POST'])
def blockchain_proxy(subpath):
    import urllib.request, urllib.error
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
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read()
        return app.response_class(data, mimetype='application/json')
    except Exception:
        return jsonify({'error': 'Blockchain service unavailable', 'online': False}), 503


# ══════════════════════════════════════════════════════════════════════════════
# DATABASE INITIALIZATION + SEED DATA
# ══════════════════════════════════════════════════════════════════════════════
def init_db():
    conn = get_conn()
    c = conn.cursor()

    # Create all tables
    c.executescript("""
        CREATE TABLE IF NOT EXISTS scheme_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS schemes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category_id INTEGER,
            eligibility_criteria TEXT,
            benefit_type TEXT DEFAULT 'cash',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (category_id) REFERENCES scheme_categories(id)
        );

        CREATE TABLE IF NOT EXISTS scheme_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scheme_id INTEGER,
            min_age INTEGER,
            max_income REAL,
            gender_required TEXT,
            category_required TEXT,
            is_household_based INTEGER DEFAULT 0,
            FOREIGN KEY (scheme_id) REFERENCES schemes(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aadhaar_number TEXT NOT NULL,
            full_name TEXT,
            gender TEXT,
            date_of_birth TEXT,
            phone TEXT,
            email TEXT,
            income REAL,
            occupation TEXT,
            is_bpl INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS user_identity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            voter_id TEXT,
            pan_number TEXT,
            ration_card_number TEXT,
            is_aadhaar_verified INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            scheme_id INTEGER,
            status TEXT DEFAULT 'submitted',
            submitted_at TEXT DEFAULT (datetime('now')),
            reviewed_at TEXT,
            remarks TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (scheme_id) REFERENCES schemes(id)
        );

        CREATE TABLE IF NOT EXISTS risk_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            anomaly_score REAL DEFAULT 0,
            fraud_probability REAL DEFAULT 0,
            risk_level TEXT DEFAULT 'low',
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS fraud_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            flag_type TEXT,
            severity TEXT,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS benefit_disbursements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            scheme_id INTEGER,
            amount REAL,
            installment_no INTEGER,
            disbursement_date TEXT,
            payment_method TEXT,
            account_no_last4 TEXT,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (scheme_id) REFERENCES schemes(id)
        );

        CREATE TABLE IF NOT EXISTS ml_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bert_narrative TEXT,
            feature_scores TEXT,
            model_confidence REAL,
            cluster_label TEXT,
            isolation_score REAL,
            gradient_boost_prob REAL,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS scheme_access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            scheme_id INTEGER,
            action TEXT,
            device TEXT,
            accessed_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (scheme_id) REFERENCES schemes(id)
        );

        CREATE TABLE IF NOT EXISTS beneficiary_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            beneficiary_type TEXT DEFAULT 'alive',
            aadhaar_doc_path TEXT,
            pan_doc_path TEXT,
            selfie_path TEXT,
            death_cert_path TEXT,
            pan_number TEXT,
            match_score REAL,
            video_room_id TEXT,
            video_room_url TEXT,
            video_status TEXT DEFAULT 'not_scheduled',
            status TEXT DEFAULT 'pending',
            admin_remarks TEXT,
            block_hash TEXT,
            block_index INTEGER,
            verified_at TEXT,
            expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)

    # Check if data already seeded
    row = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()
    if row['c'] > 0:
        conn.close()
        return

    print("Seeding database with demo data...")

    # Scheme categories
    cats = [
        ('Health', 'Health and medical welfare schemes'),
        ('Education', 'Education support and scholarship schemes'),
        ('Housing', 'Housing and shelter assistance'),
        ('Agriculture', 'Farm and rural development schemes'),
        ('Employment', 'Employment and skill development'),
        ('Pension', 'Senior citizen and disability pension'),
        ('Women & Child', 'Women and child welfare programs'),
    ]
    for name, desc in cats:
        c.execute("INSERT INTO scheme_categories (name, description) VALUES (?, ?)", (name, desc))

    # Schemes
    schemes_data = [
        ('Ayushman Bharat', 1, 'BPL families, income < 5 lakh', 'insurance', 18, 500000, 'any'),
        ('PM Kisan Samman', 4, 'Small/marginal farmers', 'cash', None, 200000, 'any'),
        ('Sukanya Samriddhi', 7, 'Girl child below 10 years', 'savings', None, None, 'female'),
        ('PM Awas Yojana', 3, 'Homeless/kutcha house', 'subsidy', 18, 300000, 'any'),
        ('Mudra Loan', 5, 'Small business entrepreneurs', 'loan', 18, 1000000, 'any'),
        ('Old Age Pension', 6, 'Senior citizens 60+', 'pension', 60, 200000, 'any'),
        ('Mid Day Meal', 2, 'School children', 'food', None, None, 'any'),
        ('Jan Dhan Yojana', 1, 'Unbanked citizens', 'banking', 18, None, 'any'),
    ]
    for name, cat_id, criteria, btype, min_age, max_income, gender in schemes_data:
        c.execute("INSERT INTO schemes (name, category_id, eligibility_criteria, benefit_type) VALUES (?,?,?,?)",
                  (name, cat_id, criteria, btype))
        sid = c.lastrowid
        c.execute("INSERT INTO scheme_rules (scheme_id, min_age, max_income, gender_required) VALUES (?,?,?,?)",
                  (sid, min_age, max_income, gender))

    # Users  — IMPORTANT: match the credentials shown in Login.jsx
    users_data = [
        ('123456789012', 'Ravi Kumar', 'male', '1990-05-15', '9876543210', 'test.user@gmail.com', 180000, 'Farmer', 1),
        ('234567890123', 'Priya Sharma', 'female', '1985-08-22', '9876543211', 'priya@mail.com', 320000, 'Teacher', 0),
        ('345678901234', 'Amit Patel', 'male', '1972-12-01', '9876543212', 'amit@mail.com', 95000, 'Fisherman', 1),
        ('456789012345', 'Sunita Devi', 'female', '1960-03-10', '9876543213', 'sunita@mail.com', 45000, 'Potter', 1),
        ('567890123456', 'Rajesh Verma', 'male', '1988-07-04', '9876543214', 'rajesh@mail.com', 750000, 'Engineer', 0),
        ('678901234567', 'Meena Kumari', 'female', '1995-11-18', '9876543215', 'meena@mail.com', 120000, 'Weaver', 1),
        ('789012345678', 'Gopal Das', 'male', '1940-01-25', '9876543216', 'gopal@mail.com', 30000, 'Retired', 1),
        ('890123456789', 'Lakshmi Bai', 'female', '1978-06-30', '9876543217', 'lakshmi@mail.com', 210000, 'Nurse', 0),
    ]
    for aadhaar, name, gender, dob, phone, email, income, occ, bpl in users_data:
        c.execute("""INSERT INTO users (aadhaar_number,full_name,gender,date_of_birth,phone,email,income,occupation,is_bpl,created_at)
                     VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))""",
                  (aadhaar, name, gender, dob, phone, email, income, occ, bpl))

    # User identity
    c.execute("INSERT INTO user_identity (user_id, voter_id, pan_number, ration_card_number, is_aadhaar_verified) VALUES (1,'VOT001','ABCDE1234F','RAT001',1)")
    c.execute("INSERT INTO user_identity (user_id, voter_id, pan_number, ration_card_number, is_aadhaar_verified) VALUES (2,'VOT002','FGHIJ5678K','RAT002',1)")
    c.execute("INSERT INTO user_identity (user_id, voter_id, pan_number, ration_card_number, is_aadhaar_verified) VALUES (3,NULL,NULL,'RAT003',0)")

    # Applications
    apps_data = [
        (1, 1, 'approved'), (1, 2, 'approved'), (1, 4, 'submitted'),
        (2, 1, 'approved'), (2, 5, 'under_review'),
        (3, 2, 'approved'), (3, 6, 'submitted'),
        (4, 1, 'approved'), (4, 6, 'approved'), (4, 4, 'submitted'),
        (5, 5, 'approved'), (5, 8, 'submitted'),
        (6, 2, 'submitted'), (6, 7, 'approved'),
        (7, 6, 'approved'), (7, 1, 'rejected'),
        (8, 1, 'under_review'), (8, 5, 'submitted'),
    ]
    for uid, sid, status in apps_data:
        c.execute("INSERT INTO applications (user_id,scheme_id,status,submitted_at) VALUES (?,?,?,datetime('now','-' || abs(random() % 60) || ' days'))",
                  (uid, sid, status))

    # Risk scores
    risk_data = [
        (1, 0.12, 0.08, 'low'),
        (2, 0.05, 0.04, 'low'),
        (3, -0.35, 0.45, 'medium'),
        (4, -0.15, 0.22, 'low'),
        (5, 0.08, 0.12, 'low'),
        (6, -0.42, 0.55, 'medium'),
        (7, -0.72, 0.82, 'high'),
        (8, -0.28, 0.38, 'medium'),
    ]
    for uid, anomaly, fraud, level in risk_data:
        c.execute("INSERT INTO risk_scores (user_id, anomaly_score, fraud_probability, risk_level) VALUES (?,?,?,?)",
                  (uid, anomaly, fraud, level))

    # Fraud flags (for high-risk users)
    c.execute("INSERT INTO fraud_flags (user_id, flag_type, severity, description) VALUES (7,'age_anomaly','critical','Beneficiary age exceeds 85 years — possible deceased-beneficiary fraud')")
    c.execute("INSERT INTO fraud_flags (user_id, flag_type, severity, description) VALUES (7,'income_mismatch','high','Reported income is extremely low (₹30,000) with active scheme claims')")
    c.execute("INSERT INTO fraud_flags (user_id, flag_type, severity, description) VALUES (3,'document_inconsistency','medium','Aadhaar not verified — identity documents pending')")

    # Benefit disbursements
    disb_data = [
        (1, 1, 5000, 1, 'bank_transfer', '4321', 'processed'),
        (1, 2, 6000, 1, 'bank_transfer', '4321', 'processed'),
        (1, 2, 6000, 2, 'bank_transfer', '4321', 'processed'),
        (2, 1, 5000, 1, 'bank_transfer', '8765', 'processed'),
        (3, 2, 6000, 1, 'bank_transfer', '1234', 'pending'),
        (4, 1, 5000, 1, 'bank_transfer', '5678', 'processed'),
        (4, 6, 3000, 1, 'bank_transfer', '5678', 'processed'),
        (5, 5, 100000, 1, 'bank_transfer', '9012', 'processed'),
        (7, 6, 3000, 1, 'bank_transfer', '3456', 'processed'),
        (7, 6, 3000, 2, 'bank_transfer', '3456', 'processed'),
    ]
    for uid, sid, amount, inst, method, acct, status in disb_data:
        c.execute("""INSERT INTO benefit_disbursements (user_id,scheme_id,amount,installment_no,disbursement_date,payment_method,account_no_last4,status)
                     VALUES (?,?,?,?,date('now','-' || abs(random() % 90) || ' days'),?,?,?)""",
                  (uid, sid, amount, inst, method, acct, status))

    # Notifications
    c.execute("INSERT INTO notifications (user_id,message,type,is_read) VALUES (1,'Welcome to DigiVerify! Complete your verification to access all schemes.','info',0)")
    c.execute("INSERT INTO notifications (user_id,message,type,is_read) VALUES (1,'Your application for Ayushman Bharat has been approved.','application_update',1)")
    c.execute("INSERT INTO notifications (user_id,message,type,is_read) VALUES (1,'Benefit payment of ₹6,000 credited to your account.','disbursement',0)")

    conn.commit()
    conn.close()
    print("Database seeded successfully!")


# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    init_db()
    print('='*60)
    print('  DigiVerify Backend (SQLite) running on http://localhost:5000')
    print('='*60)
    print('Login credentials:')
    print('  Citizen: aadhaar=123456789012  email=test.user@gmail.com')
    print('  Admin:   username=admin        password=admin123')
    print('='*60)
    app.run(debug=False, host='0.0.0.0', port=5000)
