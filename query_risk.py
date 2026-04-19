import sys
sys.path.insert(0, 'backend')
from app import app, db, User, RiskScore

with app.app_context():
    results = (db.session.query(User, RiskScore)
               .join(RiskScore, User.id == RiskScore.user_id)
               .filter(RiskScore.risk_level == 'high')
               .order_by(RiskScore.fraud_probability.desc())
               .limit(10).all())
    if not results:
        print('No "high" risk level found, showing top by fraud_probability:')
        results = (db.session.query(User, RiskScore)
                   .join(RiskScore, User.id == RiskScore.user_id)
                   .order_by(RiskScore.fraud_probability.desc())
                   .limit(10).all())
    header = f"{'ID':<5} {'Name':<25} {'Email':<35} {'Aadhaar':<14} {'Risk':<8} {'Fraud%'}"
    print(header)
    print('-' * len(header))
    for u, r in results:
        print(f"{u.id:<5} {(u.full_name or ''):<25} {(u.email or ''):<35} {u.aadhaar_number:<14} {r.risk_level:<8} {r.fraud_probability:.2f}")
