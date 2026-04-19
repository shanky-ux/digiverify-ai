from app import db, User, Scheme, SchemeCategory, app
from datetime import datetime

with app.app_context():
    # Create sample categories
    cat1 = SchemeCategory(name="Education", description="Education related schemes")
    cat2 = SchemeCategory(name="Health", description="Health related schemes")
    cat3 = SchemeCategory(name="Poverty", description="Poverty alleviation schemes")

    db.session.add_all([cat1, cat2, cat3])
    db.session.commit()

    # Create sample schemes
    scheme1 = Scheme(
        name="Mid-Day Meal Scheme",
        category_id=1,
        eligibility_criteria="Children aged 6-14 years",
        benefit_type="in-kind"
    )
    scheme2 = Scheme(
        name="Ayushman Bharat",
        category_id=2,
        eligibility_criteria="BPL families",
        benefit_type="service"
    )
    scheme3 = Scheme(
        name="PM Kisan",
        category_id=3,
        eligibility_criteria="Small farmers",
        benefit_type="cash"
    )

    db.session.add_all([scheme1, scheme2, scheme3])
    db.session.commit()

    # Create sample users
    user1 = User(
        aadhaar_number="123456789012",
        full_name="John Doe",
        gender="male",
        date_of_birth=datetime(1990, 1, 1).date(),
        phone="9876543210",
        email="john@example.com",
        income=50000.00,
        occupation="Farmer",
        is_bpl=True
    )
    user2 = User(
        aadhaar_number="123456789013",
        full_name="Jane Smith",
        gender="female",
        date_of_birth=datetime(1985, 5, 15).date(),
        phone="9876543211",
        email="jane@example.com",
        income=75000.00,
        occupation="Teacher",
        is_bpl=False
    )

    db.session.add_all([user1, user2])
    db.session.commit()

    # Example risk scores and notifications
    from app import RiskScore, Notification

    risk1 = RiskScore(user_id=user1.id, anomaly_score=0.12, fraud_probability=0.05, risk_level='low', updated_at=datetime.utcnow())
    risk2 = RiskScore(user_id=user2.id, anomaly_score=0.35, fraud_probability=0.18, risk_level='medium', updated_at=datetime.utcnow())

    note1 = Notification(user_id=user1.id, message='Your PM Kisan application has been approved.', type='success', is_read=False, created_at=datetime.utcnow())
    note2 = Notification(user_id=user2.id, message='New risk alert: this scheme requires extra verification checks.', type='warning', is_read=False, created_at=datetime.utcnow())

    db.session.add_all([risk1, risk2, note1, note2])
    db.session.commit()

    print("Sample data added successfully!")