"""Seed high-risk users with risk scores for demo."""
import sys, random
sys.path.insert(0, 'backend')
from app import app, db, User, RiskScore
from datetime import date

USERS = [
    dict(aadhaar_number='111122223333', full_name='Ramesh Kumar',    email='ramesh.kumar@example.com',  gender='male',   date_of_birth=date(1975,3,12), phone='9001001001', income=18000, occupation='Daily Wage Worker', is_bpl=True),
    dict(aadhaar_number='222233334444', full_name='Sunita Devi',     email='sunita.devi@example.com',   gender='female', date_of_birth=date(1982,7,22), phone='9002002002', income=12000, occupation='Domestic Worker',   is_bpl=True),
    dict(aadhaar_number='333344445555', full_name='Arvind Singh',    email='arvind.singh@example.com',  gender='male',   date_of_birth=date(1968,11,5), phone='9003003003', income=95000, occupation='Business Owner',    is_bpl=False),
    dict(aadhaar_number='444455556666', full_name='Priya Sharma',    email='priya.sharma@example.com',  gender='female', date_of_birth=date(1990,2,14), phone='9004004004', income=35000, occupation='Nurse',            is_bpl=False),
    dict(aadhaar_number='555566667777', full_name='Mohammed Iqbal',  email='m.iqbal@example.com',       gender='male',   date_of_birth=date(1978,9,30), phone='9005005005', income=22000, occupation='Tailor',           is_bpl=True),
    dict(aadhaar_number='666677778888', full_name='Lalita Patel',    email='lalita.patel@example.com',  gender='female', date_of_birth=date(1985,5,18), phone='9006006006', income=60000, occupation='Teacher',          is_bpl=False),
    dict(aadhaar_number='777788889999', full_name='Deepak Mehra',    email='deepak.mehra@example.com',  gender='male',   date_of_birth=date(1972,1,25), phone='9007007007', income=130000,occupation='Contractor',       is_bpl=False),
    dict(aadhaar_number='888899990000', full_name='Anita Rao',       email='anita.rao@example.com',     gender='female', date_of_birth=date(1995,8,8),  phone='9008008008', income=15000, occupation='Farmer',           is_bpl=True),
    dict(aadhaar_number='999900001111', full_name='Vikas Gupta',     email='vikas.gupta@example.com',   gender='male',   date_of_birth=date(1983,4,3),  phone='9009009009', income=45000, occupation='Shop Owner',       is_bpl=False),
    dict(aadhaar_number='101010101010', full_name='Kavita Joshi',    email='kavita.joshi@example.com',  gender='female', date_of_birth=date(1970,12,20),phone='9010010010', income=8000,  occupation='Handicraft Worker', is_bpl=True),
]

# risk_level -> (fraud_probability range, anomaly_score range)
RISK_CONFIG = [
    ('high',   (0.78, 0.97), (0.72, 0.95)),
    ('high',   (0.82, 0.96), (0.80, 0.98)),
    ('high',   (0.75, 0.92), (0.68, 0.90)),
    ('medium', (0.45, 0.65), (0.40, 0.60)),
    ('high',   (0.85, 0.99), (0.88, 0.99)),
    ('low',    (0.05, 0.20), (0.08, 0.25)),
    ('medium', (0.50, 0.70), (0.45, 0.65)),
    ('high',   (0.76, 0.94), (0.70, 0.93)),
    ('low',    (0.10, 0.25), (0.05, 0.20)),
    ('medium', (0.40, 0.60), (0.35, 0.55)),
]

with app.app_context():
    for i, udata in enumerate(USERS):
        existing = User.query.filter_by(aadhaar_number=udata['aadhaar_number']).first()
        if existing:
            u = existing
        else:
            u = User(**udata)
            db.session.add(u)
            db.session.flush()

        # upsert risk score
        rs = RiskScore.query.filter_by(user_id=u.id).first()
        level, fp_range, as_range = RISK_CONFIG[i]
        fp = round(random.uniform(*fp_range), 4)
        ano = round(random.uniform(*as_range), 4)
        if rs:
            rs.risk_level = level
            rs.fraud_probability = fp
            rs.anomaly_score = ano
        else:
            db.session.add(RiskScore(user_id=u.id, risk_level=level,
                                     fraud_probability=fp, anomaly_score=ano))

    db.session.commit()
    print("Seeded. High-risk users:")
    print(f"{'ID':<5} {'Name':<22} {'Email':<35} {'Aadhaar':<14} {'Risk':<8} {'Fraud%'}")
    print('-' * 90)
    rows = (db.session.query(User, RiskScore)
            .join(RiskScore, User.id == RiskScore.user_id)
            .filter(RiskScore.risk_level == 'high')
            .order_by(RiskScore.fraud_probability.desc()).all())
    for u, r in rows:
        print(f"{u.id:<5} {(u.full_name or ''):<22} {(u.email or ''):<35} {u.aadhaar_number:<14} {r.risk_level:<8} {r.fraud_probability:.4f}")
