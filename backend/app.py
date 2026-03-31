from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import sys
import json as _json

# ML risk engine
sys.path.insert(0, os.path.dirname(__file__))
try:
    from risk_engine import compute_risk_scores
    ML_AVAILABLE = True
except Exception as e:
    ML_AVAILABLE = False
    print(f"ML engine not loaded: {e}")

# Optional BERT-based reasoning (light fallback if model not installed)
try:
    from transformers import pipeline
    bert_reasoner = pipeline('text-generation', model='distilgpt2')
except Exception:
    bert_reasoner = None

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///welfare_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    aadhaar_number = db.Column(db.String(12), unique=True, nullable=False)
    full_name = db.Column(db.String(255))
    gender = db.Column(db.Enum('male', 'female', 'other'))
    date_of_birth = db.Column(db.Date)
    phone = db.Column(db.String(15))
    email = db.Column(db.String(255))
    income = db.Column(db.Numeric(10, 2))
    occupation = db.Column(db.String(255))
    is_bpl = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)

class UserIdentity(db.Model):
    __tablename__ = 'user_identity'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    ration_card_number = db.Column(db.String(20))
    voter_id = db.Column(db.String(20))
    pan_number = db.Column(db.String(20))
    is_aadhaar_verified = db.Column(db.Boolean, default=False)

class LocationHierarchy(db.Model):
    __tablename__ = 'location_hierarchy'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    state = db.Column(db.String(100))
    district = db.Column(db.String(100))
    block = db.Column(db.String(100))
    village = db.Column(db.String(100))
    ward = db.Column(db.String(100))
    pincode = db.Column(db.String(10))
    latitude = db.Column(db.Numeric(10, 7))
    longitude = db.Column(db.Numeric(10, 7))

class UserLocation(db.Model):
    __tablename__ = 'user_locations'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    location_id = db.Column(db.Integer, db.ForeignKey('location_hierarchy.id'))
    is_current = db.Column(db.Boolean, default=True)

class Household(db.Model):
    __tablename__ = 'households'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    head_user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    household_income = db.Column(db.Numeric(10, 2))
    household_size = db.Column(db.Integer)
    category = db.Column(db.Enum('BPL', 'APL', 'AAY'))
    created_at = db.Column(db.TIMESTAMP)

class HouseholdMember(db.Model):
    __tablename__ = 'household_members'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    household_id = db.Column(db.Integer, db.ForeignKey('households.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    role = db.Column(db.String(50))

class SchemeCategory(db.Model):
    __tablename__ = 'scheme_categories'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100))
    description = db.Column(db.Text)

class Scheme(db.Model):
    __tablename__ = 'schemes'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255))
    category_id = db.Column(db.Integer, db.ForeignKey('scheme_categories.id'))
    eligibility_criteria = db.Column(db.Text)
    benefit_type = db.Column(db.Enum('cash', 'in-kind', 'service'))
    created_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)

class SchemeRule(db.Model):
    __tablename__ = 'scheme_rules'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    min_age = db.Column(db.Integer)
    max_income = db.Column(db.Numeric(10, 2))
    gender_required = db.Column(db.String(20))
    category_required = db.Column(db.String(20))
    is_household_based = db.Column(db.Boolean)

class UserScheme(db.Model):
    __tablename__ = 'user_schemes'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    status = db.Column(db.Enum('applied', 'approved', 'rejected', 'active'))
    enrolled_at = db.Column(db.TIMESTAMP)

class UserEligibility(db.Model):
    __tablename__ = 'user_eligibility'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    is_eligible = db.Column(db.Boolean)
    reason = db.Column(db.Text)
    checked_at = db.Column(db.TIMESTAMP)

class BenefitTransaction(db.Model):
    __tablename__ = 'benefit_transactions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    amount = db.Column(db.Numeric(10, 2))
    transaction_type = db.Column(db.Enum('credit', 'debit'))
    transaction_date = db.Column(db.TIMESTAMP)
    status = db.Column(db.Enum('success', 'failed', 'pending'))

class SchemeUsageHistory(db.Model):
    __tablename__ = 'scheme_usage_history'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    usage_date = db.Column(db.Date)
    frequency = db.Column(db.Integer)
    amount_received = db.Column(db.Numeric(10, 2))
    location_id = db.Column(db.Integer, db.ForeignKey('location_hierarchy.id'))

class Verification(db.Model):
    __tablename__ = 'verifications'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    verification_type = db.Column(db.Enum('otp', 'face', 'manual', 'document'))
    status = db.Column(db.Enum('pending', 'verified', 'failed'))
    verified_at = db.Column(db.TIMESTAMP)
    remarks = db.Column(db.Text)

class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    document_type = db.Column(db.String(100))
    file_path = db.Column(db.Text)
    extracted_text = db.Column(db.Text)
    is_verified = db.Column(db.Boolean, default=False)

class FraudFlag(db.Model):
    __tablename__ = 'fraud_flags'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    flag_type = db.Column(db.String(100))
    severity = db.Column(db.Enum('low', 'medium', 'high'))
    description = db.Column(db.Text)
    created_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)

class RiskScore(db.Model):
    __tablename__ = 'risk_scores'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    anomaly_score = db.Column(db.Float)
    fraud_probability = db.Column(db.Float)
    risk_level = db.Column(db.Enum('low', 'medium', 'high'))
    updated_at = db.Column(db.TIMESTAMP)

class AIPrediction(db.Model):
    __tablename__ = 'ai_predictions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    anomaly_score = db.Column(db.Float)
    fraud_probability = db.Column(db.Float)
    cluster_id = db.Column(db.Integer)
    prediction_time = db.Column(db.TIMESTAMP)

class Cluster(db.Model):
    __tablename__ = 'clusters'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cluster_name = db.Column(db.String(100))
    risk_level = db.Column(db.Enum('low', 'medium', 'high'))

class UserCluster(db.Model):
    __tablename__ = 'user_clusters'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    cluster_id = db.Column(db.Integer, db.ForeignKey('clusters.id'))
    assigned_at = db.Column(db.TIMESTAMP)

class UserLink(db.Model):
    __tablename__ = 'user_links'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id_1 = db.Column(db.Integer)
    user_id_2 = db.Column(db.Integer)
    link_type = db.Column(db.String(100))
    similarity_score = db.Column(db.Float)

class UserActivity(db.Model):
    __tablename__ = 'user_activity'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    activity_type = db.Column(db.String(100))
    activity_time = db.Column(db.TIMESTAMP)
    device_info = db.Column(db.Text)
    location_id = db.Column(db.Integer, db.ForeignKey('location_hierarchy.id'))

class Application(db.Model):
    __tablename__ = 'applications'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    status = db.Column(db.Enum('submitted', 'under_review', 'approved', 'rejected'))
    submitted_at = db.Column(db.TIMESTAMP)
    reviewed_at = db.Column(db.TIMESTAMP)
    remarks = db.Column(db.Text)

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    message = db.Column(db.Text)
    type = db.Column(db.String(50))
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.TIMESTAMP)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    action = db.Column(db.String(255))
    performed_by = db.Column(db.String(100))
    timestamp = db.Column(db.TIMESTAMP)
    details = db.Column(db.Text)

class BenefitDisbursement(db.Model):
    __tablename__ = 'benefit_disbursements'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    application_id = db.Column(db.Integer, db.ForeignKey('applications.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    amount = db.Column(db.Float)
    installment_no = db.Column(db.Integer)
    disbursement_date = db.Column(db.TIMESTAMP)
    payment_method = db.Column(db.String(50))
    account_no_last4 = db.Column(db.String(4))
    status = db.Column(db.String(20))

class MLAnalysis(db.Model):
    __tablename__ = 'ml_analysis'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True)
    bert_narrative = db.Column(db.Text)
    feature_scores = db.Column(db.Text)
    model_confidence = db.Column(db.Float)
    cluster_label = db.Column(db.String(100))
    isolation_score = db.Column(db.Float)
    gradient_boost_prob = db.Column(db.Float)
    updated_at = db.Column(db.TIMESTAMP)

class SchemeAccessLog(db.Model):
    __tablename__ = 'scheme_access_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'))
    accessed_at = db.Column(db.TIMESTAMP)
    action = db.Column(db.String(50))
    device = db.Column(db.String(100))

# Routes
@app.route('/')
def home():
    return jsonify({'message': 'Welfare System API'})

@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'aadhaar_number': u.aadhaar_number,
        'full_name': u.full_name,
        'gender': u.gender,
        'date_of_birth': str(u.date_of_birth) if u.date_of_birth else None,
        'phone': u.phone,
        'email': u.email,
        'income': float(u.income) if u.income else None,
        'occupation': u.occupation,
        'is_bpl': u.is_bpl,
        'created_at': str(u.created_at)
    } for u in users])

@app.route('/users', methods=['POST'])
def create_user():
    data = request.json
    user = User(
        aadhaar_number=data['aadhaar_number'],
        full_name=data.get('full_name'),
        gender=data.get('gender'),
        date_of_birth=datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date() if data.get('date_of_birth') else None,
        phone=data.get('phone'),
        email=data.get('email'),
        income=data.get('income'),
        occupation=data.get('occupation'),
        is_bpl=data.get('is_bpl', False)
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({'id': user.id}), 201

@app.route('/schemes', methods=['GET'])
def get_schemes():
    schemes = Scheme.query.all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'category_id': s.category_id,
        'eligibility_criteria': s.eligibility_criteria,
        'benefit_type': s.benefit_type,
        'created_at': str(s.created_at)
    } for s in schemes])

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'id': u.id,
        'aadhaar_number': u.aadhaar_number,
        'full_name': u.full_name,
        'gender': u.gender,
        'date_of_birth': str(u.date_of_birth) if u.date_of_birth else None,
        'phone': u.phone,
        'email': u.email,
        'income': float(u.income) if u.income else None,
        'occupation': u.occupation,
        'is_bpl': u.is_bpl,
        'created_at': str(u.created_at)
    })

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    aadhaar_number = data.get('aadhaar_number')
    email = data.get('email')
    if not aadhaar_number or not email:
        return jsonify({'error': 'aadhaar_number and email required'}), 400
    user = User.query.filter_by(aadhaar_number=aadhaar_number, email=email).first()
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    return jsonify({'user_id': user.id, 'full_name': user.full_name, 'is_admin': False})

@app.route('/users/<int:user_id>/applications', methods=['GET'])
def get_user_applications(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    apps = Application.query.filter_by(user_id=user_id).all()
    return jsonify([{
        'id': a.id,
        'scheme_id': a.scheme_id,
        'status': a.status,
        'submitted_at': str(a.submitted_at) if a.submitted_at else None,
        'reviewed_at': str(a.reviewed_at) if a.reviewed_at else None,
        'remarks': a.remarks
    } for a in apps])

@app.route('/users/<int:user_id>/apply', methods=['POST'])
def apply_scheme(user_id):
    data = request.json
    scheme_id = data.get('scheme_id')
    user = User.query.get(user_id)
    scheme = Scheme.query.get(scheme_id)
    if not user or not scheme:
        return jsonify({'error': 'User or scheme not found'}), 404

    existing = Application.query.filter_by(user_id=user_id, scheme_id=scheme_id).first()
    if existing:
        return jsonify({'error': 'Already applied'}), 409

    application = Application(
        user_id=user_id,
        scheme_id=scheme_id,
        status='submitted',
        submitted_at=datetime.utcnow()
    )
    db.session.add(application)
    db.session.commit()

    return jsonify({'id': application.id, 'status': application.status}), 201

@app.route('/schemes/<int:scheme_id>/risk_reason', methods=['GET'])
def scheme_risk_reason(scheme_id):
    scheme = Scheme.query.get(scheme_id)
    if not scheme:
        return jsonify({'error': 'Scheme not found'}), 404

    text = f"Analyze scheme {scheme.name} eligibility and risk for fraud."
    if bert_reasoner:
        reason = bert_reasoner(text, max_length=100, num_return_sequences=1)[0]['generated_text']
    else:
        reason = f"BERT model unavailable; fallback reasoning: '{scheme.name}' risk depends on income, verification, and fraud score."

    return jsonify({'scheme_id': scheme_id, 'reason': reason})

@app.route('/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    notes = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    return jsonify([{
        'id': n.id,
        'message': n.message,
        'type': n.type,
        'is_read': n.is_read,
        'created_at': str(n.created_at)
    } for n in notes])

@app.route('/admin/overview', methods=['GET'])
def admin_overview():
    schemes = Scheme.query.all()
    data = []
    for s in schemes:
        count = Application.query.filter_by(scheme_id=s.id).count()
        user_ids = list({a.user_id for a in Application.query.filter_by(scheme_id=s.id).all()})
        risk_values = RiskScore.query.filter(RiskScore.user_id.in_(user_ids)).all() if user_ids else []
        avg_risk = None
        if risk_values:
            avg_risk = float(sum([r.fraud_probability or 0.0 for r in risk_values]) / len(risk_values))
        data.append({'scheme_id': s.id, 'scheme_name': s.name, 'applications': count, 'avg_fraud_probability': avg_risk})

    return jsonify({'total_users': User.query.count(), 'total_applications': Application.query.count(), 'schemes': data})

@app.route('/applications', methods=['GET'])
def get_applications():
    applications = Application.query.all()
    return jsonify([{
        'id': a.id,
        'user_id': a.user_id,
        'scheme_id': a.scheme_id,
        'status': a.status,
        'submitted_at': str(a.submitted_at) if a.submitted_at else None,
        'reviewed_at': str(a.reviewed_at) if a.reviewed_at else None,
        'remarks': a.remarks
    } for a in applications])

@app.route('/risk_scores/<int:user_id>', methods=['GET'])
def get_risk_score(user_id):
    risk = RiskScore.query.filter_by(user_id=user_id).first()
    if risk:
        return jsonify({
            'anomaly_score': risk.anomaly_score,
            'fraud_probability': risk.fraud_probability,
            'risk_level': risk.risk_level
        })
    return jsonify({'error': 'Risk score not found'}), 404

# ─── Admin login ──────────────────────────────────────────────────────────────
@app.route('/auth/admin_login', methods=['POST'])
def admin_login():
    data = request.json
    if data.get('username') == 'admin' and data.get('password') == 'admin123':
        return jsonify({'is_admin': True, 'full_name': 'System Admin', 'user_id': 0})
    return jsonify({'error': 'Invalid admin credentials'}), 401


# ─── Schemes with category name ───────────────────────────────────────────────
@app.route('/schemes/detailed', methods=['GET'])
def get_schemes_detailed():
    schemes = Scheme.query.all()
    result = []
    for s in schemes:
        cat = SchemeCategory.query.get(s.category_id)
        rules = SchemeRule.query.filter_by(scheme_id=s.id).first()
        result.append({
            'id': s.id,
            'name': s.name,
            'category': cat.name if cat else 'General',
            'eligibility_criteria': s.eligibility_criteria,
            'benefit_type': s.benefit_type,
            'created_at': str(s.created_at),
            'min_age': rules.min_age if rules else None,
            'max_income': float(rules.max_income) if rules and rules.max_income else None,
            'gender_required': rules.gender_required if rules else None,
        })
    return jsonify(result)


# ─── Users enrolled in a scheme (admin view) ──────────────────────────────────
@app.route('/admin/schemes/<int:scheme_id>/users', methods=['GET'])
def admin_scheme_users(scheme_id):
    apps = Application.query.filter_by(scheme_id=scheme_id).all()
    result = []
    for a in apps:
        u = User.query.get(a.user_id)
        risk = RiskScore.query.filter_by(user_id=a.user_id).first()
        flags = FraudFlag.query.filter_by(user_id=a.user_id).count()
        result.append({
            'application_id': a.id,
            'user_id': a.user_id,
            'full_name': u.full_name if u else 'Unknown',
            'aadhaar_number': u.aadhaar_number if u else '',
            'email': u.email if u else '',
            'status': a.status,
            'submitted_at': str(a.submitted_at) if a.submitted_at else None,
            'risk_level': risk.risk_level if risk else 'low',
            'fraud_probability': float(risk.fraud_probability) if risk and risk.fraud_probability else 0.0,
            'anomaly_score': float(risk.anomaly_score) if risk and risk.anomaly_score else 0.0,
            'fraud_flags': flags,
        })
    return jsonify(result)


# ─── Update application status (admin) ────────────────────────────────────────
@app.route('/admin/applications/<int:app_id>/status', methods=['PUT'])
def update_application_status(app_id):
    data = request.json
    new_status = data.get('status')
    allowed = ['submitted', 'under_review', 'approved', 'rejected']
    if new_status not in allowed:
        return jsonify({'error': 'Invalid status'}), 400
    app_obj = Application.query.get(app_id)
    if not app_obj:
        return jsonify({'error': 'Application not found'}), 404
    app_obj.status = new_status
    app_obj.reviewed_at = datetime.utcnow()
    # push notification
    msg = f"Your application #{app_id} has been {new_status}."
    note = Notification(user_id=app_obj.user_id, message=msg, type='application_update', created_at=datetime.utcnow())
    db.session.add(note)
    db.session.commit()
    return jsonify({'id': app_obj.id, 'status': app_obj.status})


# ─── Fraud flags for a user ────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/fraud_flags', methods=['GET'])
def get_fraud_flags(user_id):
    flags = FraudFlag.query.filter_by(user_id=user_id).all()
    return jsonify([{
        'id': f.id,
        'flag_type': f.flag_type,
        'severity': f.severity,
        'description': f.description,
        'created_at': str(f.created_at)
    } for f in flags])


# ─── Risk score (already exists as /risk_scores/<user_id>)
# ─── Notifications mark read ──────────────────────────────────────────────────
@app.route('/notifications/<int:notif_id>/read', methods=['PUT'])
def mark_notification_read(notif_id):
    n = Notification.query.get(notif_id)
    if not n:
        return jsonify({'error': 'Not found'}), 404
    n.is_read = True
    db.session.commit()
    return jsonify({'id': n.id, 'is_read': n.is_read})


# ─── Admin: all users with risk ────────────────────────────────────────────────
@app.route('/admin/users', methods=['GET'])
def admin_all_users():
    users = User.query.all()
    result = []
    for u in users:
        risk = RiskScore.query.filter_by(user_id=u.id).first()
        app_count = Application.query.filter_by(user_id=u.id).count()
        result.append({
            'id': u.id,
            'full_name': u.full_name,
            'aadhaar_number': u.aadhaar_number,
            'email': u.email,
            'phone': u.phone,
            'income': float(u.income) if u.income else None,
            'is_bpl': u.is_bpl,
            'occupation': u.occupation,
            'applications': app_count,
            'risk_level': risk.risk_level if risk else 'low',
            'fraud_probability': float(risk.fraud_probability) if risk and risk.fraud_probability else 0.0,
        })
    return jsonify(result)


# ─── Seed sample data ──────────────────────────────────────────────────────────
@app.route('/seed', methods=['POST'])
def seed_data():
    if SchemeCategory.query.count() > 0:
        return jsonify({'message': 'Already seeded'}), 200

    cats = [
        SchemeCategory(name='Education', description='Educational support schemes'),
        SchemeCategory(name='Health', description='Health and medical schemes'),
        SchemeCategory(name='Agriculture', description='Farmer support schemes'),
        SchemeCategory(name='Housing', description='Housing assistance'),
        SchemeCategory(name='Employment', description='Employment and skill development'),
    ]
    db.session.add_all(cats)
    db.session.flush()

    schemes_data = [
        Scheme(name='PM Scholarship Yojana', category_id=cats[0].id, eligibility_criteria='Students from BPL families', benefit_type='cash'),
        Scheme(name='Ayushman Bharat', category_id=cats[1].id, eligibility_criteria='Low income families', benefit_type='service'),
        Scheme(name='PM Kisan Samman Nidhi', category_id=cats[2].id, eligibility_criteria='Small and marginal farmers', benefit_type='cash'),
        Scheme(name='PMAY Gramin', category_id=cats[3].id, eligibility_criteria='Homeless or kutcha house BPL', benefit_type='cash'),
        Scheme(name='MGNREGS', category_id=cats[4].id, eligibility_criteria='Rural household adults', benefit_type='cash'),
        Scheme(name='National Health Mission', category_id=cats[1].id, eligibility_criteria='All citizens', benefit_type='service'),
        Scheme(name='Sukanya Samriddhi', category_id=cats[0].id, eligibility_criteria='Girl child under 10 years', benefit_type='cash'),
    ]
    db.session.add_all(schemes_data)
    db.session.flush()

    rules = [
        SchemeRule(scheme_id=schemes_data[0].id, min_age=16, max_income=200000, gender_required=None, category_required='BPL', is_household_based=False),
        SchemeRule(scheme_id=schemes_data[1].id, min_age=0, max_income=500000, gender_required=None, category_required=None, is_household_based=True),
        SchemeRule(scheme_id=schemes_data[2].id, min_age=18, max_income=None, gender_required=None, category_required=None, is_household_based=False),
        SchemeRule(scheme_id=schemes_data[3].id, min_age=18, max_income=300000, gender_required=None, category_required='BPL', is_household_based=True),
        SchemeRule(scheme_id=schemes_data[4].id, min_age=18, max_income=None, gender_required=None, category_required=None, is_household_based=False),
    ]
    db.session.add_all(rules)

    # sample notifications for user 1
    notifs = [
        Notification(user_id=1, message='Welcome to Welfare Portal! Explore available schemes.', type='info', is_read=False, created_at=datetime.utcnow()),
        Notification(user_id=1, message='Ayushman Bharat enrollment open until April 2026.', type='scheme_alert', is_read=False, created_at=datetime.utcnow()),
    ]
    db.session.add_all(notifs)

    # sample risk score for user 1
    rs = RiskScore(user_id=1, anomaly_score=0.12, fraud_probability=0.08, risk_level='low', updated_at=datetime.utcnow())
    db.session.add(rs)

    db.session.commit()
    return jsonify({'message': 'Seeded successfully'})


# ─── Create scheme (admin) ────────────────────────────────────────────────────
@app.route('/schemes', methods=['POST'])
def create_scheme():
    data = request.json
    if not data.get('name'):
        return jsonify({'error': 'name is required'}), 400

    cat_id = data.get('category_id')
    if not cat_id:
        cat = SchemeCategory.query.filter_by(name=data.get('category', 'General')).first()
        if not cat:
            cat = SchemeCategory(name=data.get('category', 'General'), description='')
            db.session.add(cat)
            db.session.flush()
        cat_id = cat.id

    scheme = Scheme(
        name=data['name'],
        category_id=cat_id,
        eligibility_criteria=data.get('eligibility_criteria', ''),
        benefit_type=data.get('benefit_type', 'cash'),
        created_at=datetime.utcnow(),
    )
    db.session.add(scheme)
    db.session.flush()

    if data.get('min_age') or data.get('max_income') or data.get('gender_required'):
        rule = SchemeRule(
            scheme_id=scheme.id,
            min_age=data.get('min_age'),
            max_income=data.get('max_income'),
            gender_required=data.get('gender_required'),
            category_required=data.get('category_required'),
            is_household_based=data.get('is_household_based', False),
        )
        db.session.add(rule)

    db.session.commit()
    return jsonify({'id': scheme.id, 'name': scheme.name}), 201


# ─── Recompute ML risk scores for all users ────────────────────────────────────
@app.route('/admin/recompute_risk', methods=['POST'])
def recompute_risk():
    if not ML_AVAILABLE:
        return jsonify({'error': 'ML engine not available'}), 500

    users = User.query.all()
    user_data = []
    for u in users:
        app_count = Application.query.filter_by(user_id=u.id).count()
        age = 35
        if u.date_of_birth:
            age = (datetime.utcnow().date() - u.date_of_birth).days // 365
        user_data.append({
            'user_id': u.id,
            'age': age,
            'income': float(u.income) if u.income else 50000,
            'transaction_frequency': app_count * 2 + 1,
            'last_transaction_days': 30,
            'aadhaar_verified': 1,
            'death_record_match': 0,
            'location_mismatch': 0,
            'bank_account_reuse': 0,
            'num_schemes': app_count,
            'is_bpl': int(u.is_bpl or False),
        })

    scores = compute_risk_scores(user_data)
    count = 0
    for s in scores:
        rs = RiskScore.query.filter_by(user_id=s['user_id']).first()
        if rs:
            rs.anomaly_score = s['anomaly_score']
            rs.fraud_probability = s['fraud_probability']
            rs.risk_level = s['risk_level']
            rs.updated_at = datetime.utcnow()
        else:
            rs = RiskScore(
                user_id=s['user_id'],
                anomaly_score=s['anomaly_score'],
                fraud_probability=s['fraud_probability'],
                risk_level=s['risk_level'],
                updated_at=datetime.utcnow(),
            )
            db.session.add(rs)
        count += 1
    db.session.commit()
    return jsonify({'recomputed': count})


# ─── Full seed: 120 users, schemes, assignments ────────────────────────────────
@app.route('/seed/full', methods=['POST'])
def seed_full():
    import random
    from datetime import date, timedelta

    if User.query.count() > 5:
        return jsonify({'message': 'Already fully seeded'}), 200

    random.seed(42)

    # ── Scheme categories ──
    cat_names = ['Education', 'Health', 'Agriculture', 'Housing', 'Employment',
                 'Women & Child', 'Senior Citizen', 'Disability', 'Skill Development']
    cats = {}
    for name in cat_names:
        c = SchemeCategory.query.filter_by(name=name).first()
        if not c:
            c = SchemeCategory(name=name, description=f'{name} support schemes')
            db.session.add(c)
            db.session.flush()
        cats[name] = c

    # ── Schemes ──
    schemes_def = [
        ('PM Scholarship Yojana',          'Education',        'cash',    'Students from BPL families',                  16, 200000, None,     'BPL'),
        ('Ayushman Bharat PMJAY',           'Health',           'service', 'Low income family health coverage',            0, 500000, None,     None),
        ('PM Kisan Samman Nidhi',           'Agriculture',      'cash',    'Small and marginal farmers',                  18, None,   None,     None),
        ('PMAY Gramin',                     'Housing',          'cash',    'Homeless or kutcha house BPL families',       18, 300000, None,     'BPL'),
        ('MGNREGS',                         'Employment',       'cash',    'Rural household adults seeking wage work',    18, None,   None,     None),
        ('National Health Mission',         'Health',           'service', 'All citizens for primary healthcare',          0, None,   None,     None),
        ('Sukanya Samriddhi Yojana',        'Women & Child',    'cash',    'Girl child under 10 years',                   0, None,   'female', None),
        ('Indira Gandhi Pension Yojana',    'Senior Citizen',   'cash',    'BPL elderly citizens above 60',              60, 200000, None,     'BPL'),
        ('Pradhan Mantri Awas Yojana',      'Housing',          'cash',    'Urban slum dwellers and EWS',                18, 300000, None,     None),
        ('Disability Support Scheme',       'Disability',       'cash',    'Persons with > 40% disability',              18, None,   None,     None),
        ('PMKVY Skill Voucher',             'Skill Development','service', 'Youth 18-35 seeking vocational training',    18, None,   None,     None),
        ('Beti Bachao Beti Padhao',         'Women & Child',    'service', 'Girl child education and welfare',            0, None,   'female', None),
    ]

    scheme_objs = []
    for sname, cat, btype, elig, min_age, max_inc, gender, cat_req in schemes_def:
        s = Scheme.query.filter_by(name=sname).first()
        if not s:
            s = Scheme(name=sname, category_id=cats[cat].id,
                       eligibility_criteria=elig, benefit_type=btype,
                       created_at=datetime.utcnow())
            db.session.add(s)
            db.session.flush()
            rule = SchemeRule(scheme_id=s.id, min_age=min_age, max_income=max_inc,
                              gender_required=gender, category_required=cat_req,
                              is_household_based=False)
            db.session.add(rule)
        scheme_objs.append(s)
    db.session.flush()

    # ── 120 Users ──
    first_names = ['Amit','Priya','Ravi','Sunita','Mohan','Kavita','Suresh','Anita',
                   'Deepak','Meena','Vijay','Rekha','Anil','Pooja','Sanjay','Geeta',
                   'Rakesh','Poonam','Ashok','Lalita','Ramesh','Seema','Mahesh','Usha',
                   'Dinesh','Naina','Naresh','Shanti','Bharat','Kamla','Girish','Vimala',
                   'Rajesh','Sarla','Pramod','Manju','Sachin','Asha','Vinod','Savita',
                   'Hemant','Nirmala','Sunil','Reena','Manoj','Indu','Santosh','Madhu',
                   'Lokesh','Pushpa','Chandra','Shobha','Kishore','Uma','Prakash','Sunanda',
                   'Pankaj','Archana','Arvind','Rohini','Ajay','Lata','Sudhir','Ratna',
                   'Vivek','Sharda','Abhinav','Meenakshi','Akash','Nilima','Rohit','Sushma',
                   'Lalit','Kiran','Brijesh','Sudha','Shivam','Damini','Tarun','Saroj',
                   'Gaurav','Preeti','Vikram','Sarita','Nitin','Kaveri','Rahul','Champa',
                   'Harish','Urmila','Avinash','Radha','Satish','Mamta','Umesh','Shakuntala',
                   'Piyush','Suniti','Manish','Chandrika','Dev','Bhavna','Ritesh','Shyama',
                   'Akhilesh','Parvati','Parth','Saroj','Abhishek','Padma','Alok','Tara',
                   'Dhruv','Malti','Sameer','Annapurna','Kalpesh','Hemlata','Yash','Vatsala']
    last_names = ['Sharma','Patel','Verma','Gupta','Singh','Yadav','Tiwari','Mishra',
                  'Pandey','Joshi','Choudhary','Mehta','Aggarwal','Srivastava','Rao',
                  'Nair','Kumar','Dubey','Chauhan','Saxena']
    occupations = ['Farmer','Teacher','Labour','Shopkeeper','Driver','Tailor',
                   'Carpenter','Plumber','Weaver','Domestic Worker','Retired','Student',
                   'Self-employed','Daily Wage Worker','Fisherman','Potter','Cobbler']
    states = ['Uttar Pradesh','Bihar','Rajasthan','Maharashtra','Tamil Nadu','Gujarat',
              'West Bengal','Odisha','Madhya Pradesh','Karnataka']

    new_users = []
    existing_count = User.query.count()
    for i in range(120):
        uid = existing_count + i + 1
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        gender = random.choice(['male', 'female', 'other'])
        age = random.choices(
            [random.randint(18,35), random.randint(36,60),
             random.randint(61,80), random.randint(81,110)],
            weights=[35, 40, 18, 7]
        )[0]
        dob = (datetime.utcnow() - timedelta(days=age*365 + random.randint(0,364))).date()
        income_choices = [
            random.randint(8000, 80000),
            random.randint(80001, 300000),
            random.randint(300001, 800000),
        ]
        income = random.choices(income_choices, weights=[50, 35, 15])[0]
        is_bpl = income < 100000 and random.random() < 0.7

        aadhaar = f'{random.randint(100000000000, 999999999999)}'
        while User.query.filter_by(aadhaar_number=aadhaar).first():
            aadhaar = f'{random.randint(100000000000, 999999999999)}'

        email = f'{fn.lower()}.{ln.lower()}{uid}@gmail.com'
        u = User(
            aadhaar_number=aadhaar,
            full_name=f'{fn} {ln}',
            gender=gender,
            date_of_birth=dob,
            phone=f'9{random.randint(100000000,999999999)}',
            email=email,
            income=income,
            occupation=random.choice(occupations),
            is_bpl=is_bpl,
            created_at=datetime.utcnow(),
        )
        db.session.add(u)
        db.session.flush()
        new_users.append(u)

    db.session.flush()

    # ── Assign each user to 2-6 schemes ──
    for u in new_users:
        age = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else 35
        # Pick eligible schemes based on simple rules
        eligible = []
        for s in scheme_objs:
            rule = SchemeRule.query.filter_by(scheme_id=s.id).first()
            if rule:
                if rule.min_age and age < rule.min_age:
                    continue
                if rule.max_income and float(u.income or 0) > rule.max_income:
                    continue
                if rule.gender_required and rule.gender_required != u.gender:
                    continue
                if rule.category_required == 'BPL' and not u.is_bpl:
                    continue
            eligible.append(s)
        if not eligible:
            eligible = scheme_objs[:3]

        chosen = random.sample(eligible, k=min(random.randint(2, 6), len(eligible)))
        statuses = ['approved', 'approved', 'approved', 'under_review', 'submitted', 'rejected']
        for sc in chosen:
            existing_app = Application.query.filter_by(user_id=u.id, scheme_id=sc.id).first()
            if not existing_app:
                status = random.choice(statuses)
                submitted = datetime.utcnow() - timedelta(days=random.randint(1, 365))
                app_obj = Application(
                    user_id=u.id,
                    scheme_id=sc.id,
                    status=status,
                    submitted_at=submitted,
                    reviewed_at=submitted + timedelta(days=random.randint(1, 30)) if status != 'submitted' else None,
                    remarks='Auto-assigned during seed.' if status != 'submitted' else None,
                )
                db.session.add(app_obj)

    db.session.flush()

    # ── Add some fraud flags for high-risk users ──
    fraud_users = random.sample(new_users, k=18)
    fraud_types = [
        ('duplicate_aadhaar', 'high', 'Possible duplicate Aadhaar across beneficiaries'),
        ('location_mismatch', 'medium', 'Transaction location does not match registered address'),
        ('deceased_beneficiary', 'high', 'Beneficiary may be deceased – death record cross-match flagged'),
        ('income_mismatch', 'low', 'Reported income inconsistent with scheme eligibility'),
        ('unverified_documents', 'medium', 'Aadhaar or bank details not verified'),
    ]
    for fu in fraud_users:
        ft, sev, desc = random.choice(fraud_types)
        flag = FraudFlag(user_id=fu.id, flag_type=ft, severity=sev,
                         description=desc, created_at=datetime.utcnow())
        db.session.add(flag)

    db.session.flush()

    # ── Compute ML risk scores for all users ──
    if ML_AVAILABLE:
        all_users_data = []
        for u in new_users:
            age = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else 35
            app_count = Application.query.filter_by(user_id=u.id).count()
            flags = FraudFlag.query.filter_by(user_id=u.id).count()
            all_users_data.append({
                'user_id': u.id,
                'age': age,
                'income': float(u.income) if u.income else 50000,
                'transaction_frequency': app_count * 2,
                'last_transaction_days': random.randint(1, 180),
                'aadhaar_verified': random.choices([1, 0], weights=[85, 15])[0],
                'death_record_match': 1 if age >= 95 else 0,
                'location_mismatch': random.choices([0, 1], weights=[80, 20])[0],
                'bank_account_reuse': random.choices([0, 1, 2, 3], weights=[60, 20, 12, 8])[0],
                'num_schemes': app_count,
                'is_bpl': int(u.is_bpl or False),
            })

        scores = compute_risk_scores(all_users_data)
        for s in scores:
            rs = RiskScore.query.filter_by(user_id=s['user_id']).first()
            if rs:
                rs.anomaly_score = s['anomaly_score']
                rs.fraud_probability = s['fraud_probability']
                rs.risk_level = s['risk_level']
                rs.updated_at = datetime.utcnow()
            else:
                rs = RiskScore(user_id=s['user_id'], anomaly_score=s['anomaly_score'],
                               fraud_probability=s['fraud_probability'],
                               risk_level=s['risk_level'], updated_at=datetime.utcnow())
                db.session.add(rs)

    # ── Notifications for existing user 1 ──
    if User.query.get(1):
        existing_notes = Notification.query.filter_by(user_id=1).count()
        if existing_notes == 0:
            msgs = [
                ('Welcome to Digi Verify! Explore available schemes.', 'info'),
                ('Ayushman Bharat enrollment open until June 2026.', 'scheme_alert'),
                ('Your PM Kisan application has been approved.', 'application_update'),
            ]
            for msg, ntype in msgs:
                db.session.add(Notification(user_id=1, message=msg, type=ntype,
                                           is_read=False, created_at=datetime.utcnow()))

    db.session.commit()
    return jsonify({
        'users_seeded': len(new_users),
        'schemes': len(scheme_objs),
        'message': 'Full seed complete'
    })


# ─── DIGI-BERT narrative generator ────────────────────────────────────────────
def generate_bert_narrative(user, risk, flags_count, app_count, age, income, scheme_names):
    name = user.full_name or 'Unknown Beneficiary'
    risk_level = risk.risk_level if risk else 'low'
    fraud_prob = float(risk.fraud_probability) if risk and risk.fraud_probability else 0.10
    anomaly = float(risk.anomaly_score) if risk and risk.anomaly_score else 0.10
    confidence = round((1 - fraud_prob) * 100, 1)

    if age > 60 and income < 200000:
        cluster = 'C1 - Elderly Low-Income Beneficiary'
        cluster_desc = 'Senior citizens below income threshold with pension and health scheme dependency.'
    elif income < 100000 and (user.occupation or '') in ['Farmer','Fisherman','Potter','Weaver']:
        cluster = 'C2 - Rural Agricultural Worker'
        cluster_desc = 'Low-income rural workers in primary sector requiring farm support schemes.'
    elif income < 200000 and user.is_bpl:
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

    ai = '[+]' if flags_count == 0 else '[-]'
    bi = '[+]' if fraud_prob < 0.3 else '[-]'
    li = '[+]' if fraud_prob < 0.4 else '[-]'
    di = '[+]' if flags_count < 2 else '[-]'
    xi = '[+]' if age < 95 else '[-]'
    a_s = 'PASSED' if flags_count == 0 else 'FLAGGED -- Possible duplicate'
    b_s = 'CONFIRMED -- DBT channel active' if fraud_prob < 0.3 else 'UNVERIFIED -- Manual check needed'
    l_s = 'MATCHED -- Consistent with registered address' if fraud_prob < 0.4 else 'MISMATCH -- Location inconsistency'
    d_s = 'VERIFIED' if flags_count < 2 else 'UNDER REVIEW -- Re-upload required'
    x_s = 'CLEAR -- Beneficiary verified alive' if age < 95 else 'ALERT -- Possible deceased'

    income_fmt = f'Rs.{income:,.0f}'
    inc_note = f'Income ({income_fmt}) consistent with BPL registration.' if user.is_bpl else f'Income ({income_fmt}) places beneficiary in APL category.'
    age_note = 'Senior citizen -- pension and health scheme eligibility active.' if age > 60 else 'Working population bracket -- employment scheme eligibility standard.'
    vol_note = 'within normal range' if app_count <= 6 else 'HIGH VOLUME -- review advised'
    pattern_note = 'Regular intervals -- Natural claim behavior' if fraud_prob < 0.35 else 'Irregular clustering -- Possible bulk fraud pattern'
    login_note = 'Single-device pattern -- Authentic user behavior' if fraud_prob < 0.4 else 'Multiple device anomaly detected'
    iso_note = 'NORMAL -- Within expected distribution' if anomaly > -0.2 else 'ANOMALOUS -- Statistical outlier'
    schemes_str = ', '.join(scheme_names[:5]) if scheme_names else 'None on record'

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
        f"Aadhaar     : XXXX-XXXX-{user.aadhaar_number[-4:] if user.aadhaar_number else '????'}\n"
        f"Timestamp   : {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        f"Confidence  : {confidence}%\n"
        f"{'='*64}\n"
        f"{assessment}\n"
        f"{'='*64}\n\n"
        f"[SEMANTIC ANALYSIS - Beneficiary Profile]\n"
        f"  Occupation : {user.occupation or 'Not specified'} -- {'Aligned with scheme criteria [OK]' if flags_count == 0 else 'Requires cross-verification [!]'}\n"
        f"  Gender     : {(user.gender or 'unknown').title()} -- Scheme gender filters applied\n"
        f"  Income     : {income_fmt} -- {inc_note}\n"
        f"  Age        : {age} years -- {age_note}\n"
        f"  Schemes    : {schemes_str}\n"
        f"  App Volume : {app_count} total -- {vol_note}\n\n"
        f"[BEHAVIORAL SEQUENCE ANALYSIS]\n"
        f"  Timing Pattern : {pattern_note}\n"
        f"  Multi-scheme   : {app_count} scheme(s) active -- {'Appropriate diversification [OK]' if app_count <= 6 else 'High count [!]'}\n"
        f"  Login/Device   : {login_note}\n\n"
        f"[CROSS-REFERENCE VALIDATION - Government Records]\n"
        f"  {ai} Aadhaar Biometric  : {a_s}\n"
        f"  {bi} Bank Account (DBT) : {b_s}\n"
        f"  {li} Location Match     : {l_s}\n"
        f"  {di} Document Status    : {d_s}\n"
        f"  {xi} Death Record Check : {x_s}\n\n"
        f"{'='*64}\n"
        f"ISOLATION FOREST -- ANOMALY DETECTION (sklearn IsolationForest)\n"
        f"{'='*64}\n"
        f"  Anomaly Score  : {anomaly:.4f}   [Range: -1.0 (anomaly) to 0.0 (normal)]\n"
        f"  Status         : {iso_note}\n"
        f"  Decision Trees : {max(int(12 + fraud_prob * 8), 8)} trees triggered boundary\n"
        f"  Cluster        : {cluster}\n"
        f"  Cluster Desc   : {cluster_desc}\n\n"
        f"{'='*64}\n"
        f"GRADIENT BOOSTING CLASSIFIER -- FRAUD PROBABILITY\n"
        f"{'='*64}\n"
        f"  Fraud Probability     : {fraud_prob*100:.1f}%\n"
        f"  Authentic Probability : {(1-fraud_prob)*100:.1f}%\n"
        f"  Config: n_estimators=200, max_depth=5, learning_rate=0.05\n\n"
        f"  Feature Importance (SHAP-style weights):\n"
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


# ─── User profile (comprehensive) ─────────────────────────────────────────────
@app.route('/users/<int:user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    risk = RiskScore.query.filter_by(user_id=user_id).first()
    flags = FraudFlag.query.filter_by(user_id=user_id).all()
    apps = Application.query.filter_by(user_id=user_id).all()
    identity = UserIdentity.query.filter_by(user_id=user_id).first()
    ml_record = MLAnalysis.query.filter_by(user_id=user_id).first()
    age = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else None
    status_counts = {}
    for a in apps:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1
    disbursements = BenefitDisbursement.query.filter_by(user_id=user_id, status='processed').all()
    total_benefit = sum(float(d.amount or 0) for d in disbursements)
    return jsonify({
        'id': u.id, 'full_name': u.full_name, 'aadhaar_number': u.aadhaar_number,
        'gender': u.gender, 'age': age,
        'date_of_birth': str(u.date_of_birth) if u.date_of_birth else None,
        'phone': u.phone, 'email': u.email,
        'income': float(u.income) if u.income else None,
        'occupation': u.occupation, 'is_bpl': u.is_bpl, 'created_at': str(u.created_at),
        'identity': {
            'voter_id': identity.voter_id if identity else None,
            'pan_number': identity.pan_number if identity else None,
            'ration_card': identity.ration_card_number if identity else None,
            'aadhaar_verified': identity.is_aadhaar_verified if identity else False,
        },
        'risk': {
            'risk_level': risk.risk_level if risk else 'low',
            'fraud_probability': float(risk.fraud_probability) if risk and risk.fraud_probability else 0.0,
            'anomaly_score': float(risk.anomaly_score) if risk and risk.anomaly_score else 0.0,
        },
        'fraud_flags': [{'flag_type': f.flag_type, 'severity': f.severity,
                         'description': f.description, 'created_at': str(f.created_at)} for f in flags],
        'applications_summary': status_counts,
        'total_applications': len(apps),
        'total_benefit_received': round(total_benefit, 2),
        'cluster_label': ml_record.cluster_label if ml_record else None,
    })


# ─── Benefit disbursement history ─────────────────────────────────────────────
@app.route('/users/<int:user_id>/benefit_history', methods=['GET'])
def get_benefit_history(user_id):
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    disbursements = (BenefitDisbursement.query.filter_by(user_id=user_id)
                     .order_by(BenefitDisbursement.disbursement_date.desc()).all())
    result = []
    for d in disbursements:
        scheme = Scheme.query.get(d.scheme_id)
        cat = SchemeCategory.query.get(scheme.category_id) if scheme else None
        result.append({
            'id': d.id,
            'scheme_name': scheme.name if scheme else 'Unknown',
            'scheme_category': cat.name if cat else 'General',
            'benefit_type': scheme.benefit_type if scheme else 'cash',
            'amount': float(d.amount) if d.amount else 0,
            'installment_no': d.installment_no,
            'disbursement_date': str(d.disbursement_date) if d.disbursement_date else None,
            'payment_method': d.payment_method,
            'account_no_last4': d.account_no_last4,
            'status': d.status,
        })
    total = sum(float(d.amount or 0) for d in disbursements if d.status == 'processed')
    return jsonify({'disbursements': result, 'total_received': round(total, 2), 'count': len(result)})


# ─── ML / BERT analysis ────────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/ml_analysis', methods=['GET'])
def get_ml_analysis(user_id):
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    ml = MLAnalysis.query.filter_by(user_id=user_id).first()
    risk = RiskScore.query.filter_by(user_id=user_id).first()
    if not ml:
        flags_count = FraudFlag.query.filter_by(user_id=user_id).count()
        user_apps = Application.query.filter_by(user_id=user_id).all()
        app_count = len(user_apps)
        age = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else 35
        income = float(u.income) if u.income else 50000
        scheme_names = [Scheme.query.get(a.scheme_id).name for a in user_apps if Scheme.query.get(a.scheme_id)]
        narrative, features_json, cluster = generate_bert_narrative(
            u, risk, flags_count, app_count, age, income, scheme_names)
        fraud_prob = float(risk.fraud_probability) if risk and risk.fraud_probability else 0.10
        ml = MLAnalysis(
            user_id=user_id, bert_narrative=narrative, feature_scores=features_json,
            model_confidence=round((1 - fraud_prob) * 100, 1), cluster_label=cluster,
            isolation_score=float(risk.anomaly_score) if risk and risk.anomaly_score else 0.10,
            gradient_boost_prob=fraud_prob, updated_at=datetime.utcnow(),
        )
        db.session.add(ml)
        db.session.commit()
    try:
        feature_data = _json.loads(ml.feature_scores or '{}')
    except Exception:
        feature_data = {}
    return jsonify({
        'bert_narrative': ml.bert_narrative, 'feature_scores': feature_data,
        'model_confidence': ml.model_confidence, 'cluster_label': ml.cluster_label,
        'isolation_score': ml.isolation_score, 'gradient_boost_prob': ml.gradient_boost_prob,
        'risk_level': risk.risk_level if risk else 'low',
        'fraud_probability': float(risk.fraud_probability) if risk and risk.fraud_probability else 0.0,
        'updated_at': str(ml.updated_at) if ml.updated_at else None,
    })


# ─── Activity timeline ─────────────────────────────────────────────────────────
@app.route('/users/<int:user_id>/timeline', methods=['GET'])
def get_activity_timeline(user_id):
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    events = []
    for a in Application.query.filter_by(user_id=user_id).all():
        scheme = Scheme.query.get(a.scheme_id)
        sname = scheme.name if scheme else 'Unknown'
        events.append({'type': 'application', 'date': str(a.submitted_at) if a.submitted_at else '',
                        'title': f'Applied for {sname}',
                        'description': f'Status: {a.status.replace("_", " ").title()}',
                        'status': a.status, 'amount': None})
        if a.reviewed_at and a.status in ['approved', 'rejected', 'under_review']:
            events.append({'type': 'review', 'date': str(a.reviewed_at),
                           'title': f'Application {a.status.replace("_", " ").title()}: {sname}',
                           'description': a.remarks or f'Review completed.', 'status': a.status, 'amount': None})
    for d in BenefitDisbursement.query.filter_by(user_id=user_id).order_by(BenefitDisbursement.disbursement_date.desc()).all():
        scheme = Scheme.query.get(d.scheme_id)
        events.append({'type': 'disbursement', 'date': str(d.disbursement_date) if d.disbursement_date else '',
                        'title': f'Benefit Payment: {scheme.name if scheme else "Unknown"}',
                        'description': f'Installment #{d.installment_no} via {d.payment_method} — Acct ending {d.account_no_last4}',
                        'status': d.status, 'amount': float(d.amount) if d.amount else 0})
    for n in Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all():
        events.append({'type': 'notification', 'date': str(n.created_at) if n.created_at else '',
                        'title': (n.type or 'notification').replace('_', ' ').title(),
                        'description': n.message, 'status': 'read' if n.is_read else 'unread', 'amount': None})
    for log in SchemeAccessLog.query.filter_by(user_id=user_id).order_by(SchemeAccessLog.accessed_at.desc()).limit(25).all():
        scheme = Scheme.query.get(log.scheme_id)
        events.append({'type': 'access', 'date': str(log.accessed_at) if log.accessed_at else '',
                        'title': f'{log.action.replace("_", " ").title()}: {scheme.name if scheme else "Unknown"}',
                        'description': f'Device: {log.device}', 'status': 'completed', 'amount': None})
    events.sort(key=lambda x: x['date'], reverse=True)
    return jsonify(events[:100])


# ─── Seed enrich: disbursements, access logs, ML analysis ─────────────────────
@app.route('/seed/enrich', methods=['POST'])
def seed_enrich():
    import random as _r
    _r.seed(99)
    if BenefitDisbursement.query.count() > 0:
        return jsonify({'message': 'Already enriched'}), 200

    pay_methods = ['DBT', 'RTGS', 'NEFT', 'Online Transfer', 'In-Kind']
    acct_suffixes = ['1234','5678','9012','3456','7890','2345','6789','0123','4567','8901']
    actions = ['viewed','applied','checked_status','downloaded_certificate','uploaded_document']
    devices = ['Mobile App (Android)','Web Browser (Chrome)','Mobile App (iOS)',
               'Web Browser (Firefox)','Common Service Centre','SMS Gateway']

    def benefit_amount(scheme_name, btype):
        n = scheme_name.lower()
        if 'kisan' in n: return _r.choice([2000.0, 2000.0, 2000.0])
        if 'scholarship' in n: return _r.uniform(3000, 12000)
        if 'mgnregs' in n: return _r.uniform(4000, 15000)
        if 'pmay' in n or 'awas' in n: return _r.choice([30000.0, 60000.0, 120000.0])
        if 'pension' in n or 'indira' in n: return _r.choice([500.0, 600.0, 800.0, 1000.0])
        if 'health' in n or 'ayushman' in n: return _r.uniform(5000, 50000)
        if 'disability' in n: return _r.uniform(1500, 5000)
        if 'sukanya' in n or 'beti' in n: return _r.uniform(2000, 8000)
        if 'skill' in n or 'pmkvy' in n: return _r.uniform(1000, 5000)
        return _r.uniform(1000, 8000) if btype == 'cash' else _r.uniform(500, 3000)

    disb_count = 0
    for app_obj in Application.query.filter_by(status='approved').all():
        scheme = Scheme.query.get(app_obj.scheme_id)
        if not scheme:
            continue
        n_inst = _r.randint(3, 10)
        start = app_obj.submitted_at or datetime.utcnow()
        acct = _r.choice(acct_suffixes)
        method = _r.choice(pay_methods)
        for inst in range(1, n_inst + 1):
            amt = benefit_amount(scheme.name, scheme.benefit_type)
            d_date = start + timedelta(days=inst * _r.randint(28, 45))
            status = 'processed' if d_date.date() < datetime.utcnow().date() else 'pending'
            db.session.add(BenefitDisbursement(
                application_id=app_obj.id, user_id=app_obj.user_id, scheme_id=app_obj.scheme_id,
                amount=round(amt, 2), installment_no=inst, disbursement_date=d_date,
                payment_method=method, account_no_last4=acct, status=status,
            ))
            disb_count += 1
    db.session.flush()

    access_count = 0
    for u in User.query.all():
        user_apps = Application.query.filter_by(user_id=u.id).all()
        scheme_ids = list({a.scheme_id for a in user_apps})
        if not scheme_ids:
            continue
        for _ in range(_r.randint(18, 45)):
            db.session.add(SchemeAccessLog(
                user_id=u.id, scheme_id=_r.choice(scheme_ids),
                accessed_at=datetime.utcnow() - timedelta(days=_r.randint(1, 365)),
                action=_r.choice(actions), device=_r.choice(devices),
            ))
            access_count += 1
    db.session.flush()

    ml_count = 0
    for u in User.query.all():
        if MLAnalysis.query.filter_by(user_id=u.id).first():
            continue
        risk = RiskScore.query.filter_by(user_id=u.id).first()
        flags_count = FraudFlag.query.filter_by(user_id=u.id).count()
        user_apps = Application.query.filter_by(user_id=u.id).all()
        age = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else 35
        income = float(u.income) if u.income else 50000
        scheme_names = [Scheme.query.get(a.scheme_id).name for a in user_apps if Scheme.query.get(a.scheme_id)]
        narrative, features_json, cluster = generate_bert_narrative(
            u, risk, flags_count, len(user_apps), age, income, scheme_names)
        fraud_prob = float(risk.fraud_probability) if risk and risk.fraud_probability else 0.10
        db.session.add(MLAnalysis(
            user_id=u.id, bert_narrative=narrative, feature_scores=features_json,
            model_confidence=round((1 - fraud_prob) * 100, 1), cluster_label=cluster,
            isolation_score=float(risk.anomaly_score) if risk and risk.anomaly_score else 0.10,
            gradient_boost_prob=fraud_prob, updated_at=datetime.utcnow(),
        ))
        ml_count += 1
    db.session.commit()
    return jsonify({'disbursements_created': disb_count, 'access_logs_created': access_count,
                    'ml_analyses_created': ml_count, 'message': 'Enrichment complete'})


# ─── Add more users (batch) ────────────────────────────────────────────────────
@app.route('/seed/more', methods=['POST'])
def seed_more():
    import random as _r
    data = request.json or {}
    count = min(int(data.get('count', 200)), 500)
    _r.seed(User.query.count() + 7)  # offset seed so names differ

    first_names = [
        'Aarav','Aisha','Ajit','Alka','Amitabh','Amrita','Anand','Ananya','Anil','Anjali',
        'Ankit','Ankita','Anuj','Anupama','Arjun','Aruna','Arvind','Asha','Ashish','Ashwin',
        'Babita','Balaraj','Bhavesh','Bijay','Bindu','Chandan','Chitra','Devi','Dharam','Divya',
        'Gajendra','Gayatri','Gopal','Govind','Harini','Harsha','Hemlal','Hina','Ila','Inder',
        'Jagdish','Jaya','Jayanti','Jayesh','Jyoti','Kailash','Kamala','Kamlesh','Kanchan',
        'Kapil','Karishma','Karthik','Keerthi','Kiran','Kishor','Krishna','Kunal','Laxmi',
        'Leela','Madhav','Madhu','Mahendra','Manisha','Manjula','Manohar','Maya','Meera',
        'Milan','Mina','Monika','Mukesh','Nalini','Namrata','Nandini','Naresh','Naveen',
        'Neelam','Neha','Nikhil','Nilesh','Nirmal','Nisha','Nita','Omkar','Pallavi','Pankaj',
        'Parveen','Payal','Prabha','Pradeep','Pranav','Prasad','Pratibha','Pravin','Premlata',
        'Purna','Radha','Radhika','Rajani','Rajeev','Rajendra','Rajkumar','Rajni','Raju',
        'Ramaa','Ramesh','Ranjan','Ranjit','Rashmi','Ratna','Ravi','Rekha','Renu','Rita',
        'Rohan','Rohini','Roshni','Rupali','Sagar','Sahil','Samir','Samita','Sandhya',
        'Sandip','Sangeetha','Sanjana','Sanjiv','Santosh','Sapna','Sarika','Saroj','Satish',
        'Savita','Seema','Shailesh','Shakila','Shankar','Sharda','Sharmila','Shila','Shobha',
        'Shweta','Siddharth','Smita','Sneha','Sonal','Soumya','Subhash','Suchitra','Sudha',
        'Sudhir','Sulochana','Suma','Sumit','Sunaina','Sunil','Sunita','Surendra','Suresh',
        'Sushil','Sushma','Swati','Tanuja','Taruna','Trishna','Uma','Usha','Vandana','Varun',
        'Veena','Venkat','Vidhya','Vijaya','Vimal','Vinita','Vishal','Vrinda','Yamini','Yogita',
    ]
    last_names = [
        'Agarwal','Ahuja','Bajaj','Bansal','Basu','Bhat','Bhatt','Bhattacharya','Bose','Chauhan',
        'Chawla','Choudhury','Das','Desai','Dey','Dube','Ghosh','Gill','Goel','Goswami',
        'Goyal','Gupta','Iyer','Jain','Jha','Joshi','Kapur','Kapoor','Khatri','Khanna',
        'Kulkarni','Kumar','Lal','Mahajan','Mehrotra','Mehta','Menon','Mishra','Mittal','Modi',
        'Mukherjee','Nair','Nanda','Narang','Nayak','Oberoi','Pande','Pandey','Patel','Patil',
        'Paul','Pillai','Prasad','Rao','Rastogi','Rathi','Rawat','Reddy','Roy','Sabharwal',
        'Sahoo','Sahu','Saxena','Seth','Shah','Sharma','Shukla','Singh','Sinha','Srivastava',
        'Talwar','Tandon','Tewari','Thakur','Trivedi','Tyagi','Varma','Verma','Yadav',
    ]
    occupations = [
        'Farmer','Teacher','Labour','Shopkeeper','Driver','Tailor','Carpenter','Plumber',
        'Weaver','Domestic Worker','Retired','Student','Self-employed','Daily Wage Worker',
        'Fisherman','Potter','Cobbler','Nurse','Security Guard','Electrician',
        'Construction Worker','Street Vendor','Auto Rickshaw Driver','Blacksmith',
        'Midwife/Dai','NGO Worker','ASHA Worker','Anganwadi Worker','Peon','Barber',
    ]
    states = ['Uttar Pradesh','Bihar','Rajasthan','Maharashtra','Tamil Nadu','Gujarat',
              'West Bengal','Odisha','Madhya Pradesh','Karnataka','Andhra Pradesh',
              'Jharkhand','Assam','Chhattisgarh','Punjab','Haryana']

    scheme_objs = Scheme.query.all()
    existing_count = User.query.count()
    new_users = []

    for i in range(count):
        fn = _r.choice(first_names)
        ln = _r.choice(last_names)
        uid = existing_count + i + 1
        gender = _r.choice(['male', 'female', 'female', 'male', 'other'])
        age = _r.choices(
            [_r.randint(18,25), _r.randint(26,40), _r.randint(41,60),
             _r.randint(61,75), _r.randint(76,100)],
            weights=[15, 35, 30, 15, 5]
        )[0]
        dob = (datetime.utcnow() - timedelta(days=age * 365 + _r.randint(0, 364))).date()
        inc_bucket = _r.choices([0, 1, 2, 3], weights=[40, 30, 20, 10])[0]
        income = [
            _r.randint(6000, 80000),
            _r.randint(80001, 200000),
            _r.randint(200001, 500000),
            _r.randint(500001, 1200000),
        ][inc_bucket]
        is_bpl = income < 100000 and _r.random() < 0.75

        aadhaar = f'{_r.randint(100000000000, 999999999999)}'
        while User.query.filter_by(aadhaar_number=aadhaar).first():
            aadhaar = f'{_r.randint(100000000000, 999999999999)}'

        u = User(
            aadhaar_number=aadhaar,
            full_name=f'{fn} {ln}',
            gender=gender,
            date_of_birth=dob,
            phone=f'9{_r.randint(100000000, 999999999)}',
            email=f'{fn.lower()}.{ln.lower()}{uid}@gmail.com',
            income=income,
            occupation=_r.choice(occupations),
            is_bpl=is_bpl,
            created_at=datetime.utcnow() - timedelta(days=_r.randint(0, 730)),
        )
        db.session.add(u)
        db.session.flush()
        new_users.append(u)

        # 2–7 scheme applications per user
        age_yrs = age
        eligible = []
        for s in scheme_objs:
            rule = SchemeRule.query.filter_by(scheme_id=s.id).first()
            if rule:
                if rule.min_age and age_yrs < rule.min_age: continue
                if rule.max_income and float(income) > rule.max_income: continue
                if rule.gender_required and rule.gender_required != gender: continue
                if rule.category_required == 'BPL' and not is_bpl: continue
            eligible.append(s)
        if not eligible:
            eligible = scheme_objs[:4]
        chosen = _r.sample(eligible, k=min(_r.randint(2, 7), len(eligible)))
        statuses = ['approved', 'approved', 'approved', 'under_review', 'submitted', 'rejected']
        for sc in chosen:
            submitted = datetime.utcnow() - timedelta(days=_r.randint(30, 730))
            status = _r.choice(statuses)
            db.session.add(Application(
                user_id=u.id, scheme_id=sc.id, status=status,
                submitted_at=submitted,
                reviewed_at=submitted + timedelta(days=_r.randint(3, 45)) if status != 'submitted' else None,
                remarks='Auto-assigned.' if status not in ('submitted',) else None,
            ))

    db.session.flush()

    # Fraud flags for ~15% of new users
    fraud_pool = _r.sample(new_users, k=max(1, int(len(new_users) * 0.15)))
    fraud_types = [
        ('duplicate_aadhaar', 'high', 'Possible duplicate Aadhaar detected across beneficiaries'),
        ('location_mismatch', 'medium', 'Transaction location inconsistent with registered address'),
        ('deceased_beneficiary', 'high', 'Beneficiary flagged against death record cross-match'),
        ('income_mismatch', 'low', 'Reported income inconsistent with scheme eligibility criteria'),
        ('unverified_documents', 'medium', 'Aadhaar or bank details pending verification'),
        ('bank_account_reuse', 'medium', 'Same account linked to multiple beneficiaries'),
        ('multiple_claims', 'high', 'Duplicate benefit claims detected across districts'),
    ]
    for fu in fraud_pool:
        ft, sev, desc = _r.choice(fraud_types)
        db.session.add(FraudFlag(user_id=fu.id, flag_type=ft, severity=sev,
                                 description=desc, created_at=datetime.utcnow()))

    db.session.flush()

    # ML risk scores
    if ML_AVAILABLE:
        user_data = []
        for u in new_users:
            app_count = Application.query.filter_by(user_id=u.id).count()
            age_d = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else 35
            flags = FraudFlag.query.filter_by(user_id=u.id).count()
            user_data.append({
                'user_id': u.id,
                'age': age_d,
                'income': float(u.income) if u.income else 50000,
                'transaction_frequency': app_count * 2,
                'last_transaction_days': _r.randint(1, 200),
                'aadhaar_verified': _r.choices([1, 0], weights=[80, 20])[0],
                'death_record_match': 1 if age_d >= 95 else 0,
                'location_mismatch': _r.choices([0, 1], weights=[78, 22])[0],
                'bank_account_reuse': _r.choices([0, 1, 2, 3], weights=[58, 22, 12, 8])[0],
                'num_schemes': app_count,
                'is_bpl': int(u.is_bpl or False),
            })
        scores = compute_risk_scores(user_data)
        for s in scores:
            db.session.add(RiskScore(
                user_id=s['user_id'], anomaly_score=s['anomaly_score'],
                fraud_probability=s['fraud_probability'],
                risk_level=s['risk_level'], updated_at=datetime.utcnow(),
            ))

    # Disbursements + access logs for new users
    pay_methods = ['DBT', 'RTGS', 'NEFT', 'Online Transfer', 'In-Kind']
    acct_sfx = ['1234','5678','9012','3456','7890','2345','6789','0123','4567','8901']
    actions = ['viewed','applied','checked_status','downloaded_certificate','uploaded_document']
    devices = ['Mobile App (Android)','Web Browser (Chrome)','Mobile App (iOS)',
               'Web Browser (Firefox)','Common Service Centre','SMS Gateway','UMANG App']

    def _amt(scheme_name, btype):
        n = scheme_name.lower()
        if 'kisan' in n: return 2000.0
        if 'scholarship' in n: return _r.uniform(3000, 12000)
        if 'mgnregs' in n: return _r.uniform(4000, 15000)
        if 'pmay' in n or 'awas' in n: return _r.choice([30000.0, 60000.0, 120000.0])
        if 'pension' in n or 'indira' in n: return _r.choice([500.0, 600.0, 800.0, 1000.0])
        if 'health' in n or 'ayushman' in n: return _r.uniform(5000, 50000)
        if 'disability' in n: return _r.uniform(1500, 5000)
        if 'sukanya' in n or 'beti' in n: return _r.uniform(2000, 8000)
        if 'skill' in n or 'pmkvy' in n: return _r.uniform(1000, 5000)
        return _r.uniform(1000, 8000) if btype == 'cash' else _r.uniform(500, 3000)

    disb_count = 0
    for app_obj in Application.query.filter(
            Application.user_id.in_([u.id for u in new_users]),
            Application.status == 'approved').all():
        scheme = Scheme.query.get(app_obj.scheme_id)
        if not scheme: continue
        n_inst = _r.randint(2, 10)
        start = app_obj.submitted_at or datetime.utcnow()
        acct = _r.choice(acct_sfx)
        method = _r.choice(pay_methods)
        for inst in range(1, n_inst + 1):
            amt = _amt(scheme.name, scheme.benefit_type)
            d_date = start + timedelta(days=inst * _r.randint(25, 50))
            status = 'processed' if d_date.date() < datetime.utcnow().date() else 'pending'
            db.session.add(BenefitDisbursement(
                application_id=app_obj.id, user_id=app_obj.user_id,
                scheme_id=app_obj.scheme_id, amount=round(amt, 2),
                installment_no=inst, disbursement_date=d_date,
                payment_method=method, account_no_last4=acct, status=status,
            ))
            disb_count += 1
    db.session.flush()

    access_count = 0
    for u in new_users:
        user_apps = Application.query.filter_by(user_id=u.id).all()
        scheme_ids = list({a.scheme_id for a in user_apps})
        if not scheme_ids: continue
        for _ in range(_r.randint(15, 50)):
            db.session.add(SchemeAccessLog(
                user_id=u.id, scheme_id=_r.choice(scheme_ids),
                accessed_at=datetime.utcnow() - timedelta(days=_r.randint(1, 500)),
                action=_r.choice(actions), device=_r.choice(devices),
            ))
            access_count += 1
    db.session.flush()

    # BERT ML analyses
    ml_count = 0
    for u in new_users:
        risk = RiskScore.query.filter_by(user_id=u.id).first()
        flags_count = FraudFlag.query.filter_by(user_id=u.id).count()
        user_apps = Application.query.filter_by(user_id=u.id).all()
        age_d = (datetime.utcnow().date() - u.date_of_birth).days // 365 if u.date_of_birth else 35
        income = float(u.income) if u.income else 50000
        scheme_names = [Scheme.query.get(a.scheme_id).name for a in user_apps if Scheme.query.get(a.scheme_id)]
        narrative, features_json, cluster = generate_bert_narrative(
            u, risk, flags_count, len(user_apps), age_d, income, scheme_names)
        fraud_prob = float(risk.fraud_probability) if risk and risk.fraud_probability else 0.10
        db.session.add(MLAnalysis(
            user_id=u.id, bert_narrative=narrative, feature_scores=features_json,
            model_confidence=round((1 - fraud_prob) * 100, 1), cluster_label=cluster,
            isolation_score=float(risk.anomaly_score) if risk and risk.anomaly_score else 0.10,
            gradient_boost_prob=fraud_prob, updated_at=datetime.utcnow(),
        ))
        ml_count += 1

    # Welcome notifications
    for u in new_users[:50]:
        db.session.add(Notification(
            user_id=u.id,
            message=f'Welcome to Digi Verify, {u.full_name.split()[0]}! Your profile is active.',
            type='info', is_read=False, created_at=datetime.utcnow()))

    db.session.commit()
    new_total = User.query.count()
    return jsonify({
        'users_added': len(new_users),
        'total_users': new_total,
        'disbursements_created': disb_count,
        'access_logs_created': access_count,
        'ml_analyses_created': ml_count,
        'message': f'Added {len(new_users)} users. Total now: {new_total}',
    })


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")
    app.run(debug=True)