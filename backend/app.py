from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

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
def get_risk_score(user_id):
    risk = RiskScore.query.filter_by(user_id=user_id).first()
    if risk:
        return jsonify({
            'anomaly_score': risk.anomaly_score,
            'fraud_probability': risk.fraud_probability,
            'risk_level': risk.risk_level
        })
    return jsonify({'error': 'Risk score not found'}), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")
    app.run(debug=True)