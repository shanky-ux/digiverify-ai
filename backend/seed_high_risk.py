"""Seed 30 high-risk users into welfare_system database."""
import pymysql
import random
from datetime import date, timedelta

conn = pymysql.connect(host='localhost', port=3306, user='root', password='root',
                       database='welfare_system', cursorclass=pymysql.cursors.DictCursor,
                       autocommit=True)
cur = conn.cursor()

FIRST_NAMES_M = ['Vikram','Rajesh','Suresh','Amit','Rohit','Deepak','Sanjay','Manoj','Anil','Ramesh',
                 'Karan','Nikhil','Pankaj','Gaurav','Harsh','Vivek','Ajay','Naveen','Tarun','Bharat']
FIRST_NAMES_F = ['Sunita','Pooja','Kavita','Rekha','Anita','Neha','Priya','Suman','Geeta','Lata',
                 'Asha','Radha','Savita','Usha','Nirmala','Kamla','Shanti','Durga','Saroj','Parvati']
LAST_NAMES = ['Yadav','Sharma','Verma','Gupta','Singh','Kumar','Patel','Joshi','Mishra','Chauhan',
              'Reddy','Nair','Das','Bose','Pandey','Tiwari','Saxena','Mehta','Shah','Pillai',
              'Rao','Iyer','Menon','Hegde','Patil','Kulkarni','Deshmukh','Naik','Shetty','Kaur']
OCCUPATIONS = ['Daily Labourer','Street Vendor','Auto Driver','Construction Worker','Domestic Help',
               'Fisherman','Rickshaw Puller','Handloom Weaver','Scrap Dealer','Migrant Worker',
               'Farm Labourer','Brick Kiln Worker','Tea Garden Worker','Mine Worker','Waste Collector']

inserted = 0
for i in range(30):
    is_female = random.random() < 0.4
    gender = 'female' if is_female else 'male'
    first = random.choice(FIRST_NAMES_F if is_female else FIRST_NAMES_M)
    last = random.choice(LAST_NAMES)
    full_name = f"{first} {last}"

    # Generate unique aadhaar (starting from 200000000001)
    aadhaar = f"{200000000001 + i}"

    # Age 22-65
    age = random.randint(22, 65)
    dob = date.today() - timedelta(days=age * 365 + random.randint(0, 364))

    phone = f"9{random.randint(100000000, 999999999)}"
    email = f"{first.lower()}.{last.lower()}{random.randint(1,99)}@mail.com"

    # Low income → more suspicious for high risk
    income = round(random.uniform(3000, 18000), 2)
    occupation = random.choice(OCCUPATIONS)
    is_bpl = 1 if income < 12000 else random.choice([0, 1])

    # Insert user
    cur.execute(
        """INSERT INTO users (aadhaar_number, full_name, gender, date_of_birth, phone, email, income, occupation, is_bpl, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
        (aadhaar, full_name, gender, dob, phone, email, income, occupation, is_bpl)
    )
    user_id = cur.lastrowid

    # HIGH risk score: fraud_probability 0.60-0.95, anomaly_score -0.5 to -0.9
    fraud_prob = round(random.uniform(0.60, 0.95), 4)
    anomaly_score = round(random.uniform(-0.9, -0.5), 4)

    cur.execute(
        """INSERT INTO risk_scores (user_id, anomaly_score, fraud_probability, risk_level, updated_at)
           VALUES (%s, %s, %s, 'high', NOW())""",
        (user_id, anomaly_score, fraud_prob)
    )

    # Give some of them applications to schemes (makes data more realistic)
    if random.random() < 0.7:
        scheme_id = random.randint(1, 10)
        status = random.choice(['pending', 'approved', 'approved', 'rejected'])
        try:
            cur.execute(
                """INSERT INTO applications (user_id, scheme_id, status, created_at, reviewed_at)
                   VALUES (%s, %s, %s, NOW(), NOW())""",
                (user_id, scheme_id, status)
            )
        except Exception:
            pass  # skip if duplicate

    inserted += 1
    print(f"  [{inserted:2d}] {full_name:<22s} aadhaar={aadhaar} fraud={fraud_prob:.2f} risk=HIGH")

conn.close()
print(f"\nDone! Seeded {inserted} high-risk users (IDs {11}-{10+inserted}).")
