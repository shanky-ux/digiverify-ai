"""Initialize SQLite database for welfare system."""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'welfare_system.db')

def init_db():
    print(f"[INIT] Creating SQLite database at {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()
    
    # Create tables
    tables = [
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aadhaar_number TEXT UNIQUE NOT NULL,
            full_name TEXT,
            gender TEXT,
            date_of_birth TEXT,
            phone TEXT,
            email TEXT UNIQUE,
            income REAL,
            occupation TEXT,
            is_bpl INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS schemes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            category_id INTEGER,
            eligibility_criteria TEXT,
            benefit_type TEXT,
            created_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS scheme_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            created_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS scheme_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scheme_id INTEGER,
            min_age INTEGER,
            max_income REAL,
            gender_required TEXT,
            category_required TEXT,
            is_household_based INTEGER
        )""",
        """CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            scheme_id INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TEXT,
            updated_at TEXT,
            reviewed_at TEXT,
            remarks TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS risk_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            anomaly_score REAL,
            fraud_probability REAL,
            risk_level TEXT,
            updated_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS fraud_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            flag_type TEXT,
            severity TEXT,
            description TEXT,
            created_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT,
            type TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS beneficiary_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
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
            created_at TEXT,
            updated_at TEXT,
            verified_at TEXT,
            expires_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS user_identity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            voter_id TEXT,
            pan_number TEXT,
            ration_card_number TEXT,
            is_aadhaar_verified INTEGER DEFAULT 0
        )""",
        """CREATE TABLE IF NOT EXISTS ml_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bert_narrative TEXT,
            feature_scores TEXT,
            model_confidence REAL,
            cluster_label TEXT,
            isolation_score REAL,
            gradient_boost_prob REAL,
            updated_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS benefit_disbursements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            scheme_id INTEGER,
            amount REAL,
            installment_no INTEGER,
            disbursement_date TEXT,
            payment_method TEXT,
            account_no_last4 TEXT,
            status TEXT
        )""",
    ]
    
    for sql in tables:
        c.execute(sql)
    
    # Seed demo user
    c.execute("SELECT id FROM users WHERE aadhaar_number='123456789012'")
    if not c.fetchone():
        c.execute("""INSERT INTO users (aadhaar_number, full_name, gender, email, phone, income, occupation, is_bpl, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                  ('123456789012', 'Demo User', 'Male', 'ravi@mail.com', '9876543210', 50000.00, 'Engineer', 0))
        user_id = c.lastrowid
        c.execute("INSERT INTO risk_scores (user_id, anomaly_score, fraud_probability, risk_level) VALUES (?, ?, ?, ?)",
                  (user_id, 0.05, 0.02, 'low'))
        print(f"[INIT] Created demo user (id={user_id}, aadhaar=123456789012)")
    else:
        print("[INIT] Demo user already exists")
    
    # Seed some schemes
    c.execute("SELECT id FROM schemes LIMIT 1")
    if not c.fetchone():
        schemes = [
            ('Mid-Day Meal Scheme', 'Education', 'Children aged 6-14 years', 'in-kind'),
            ('Ayushman Bharat', 'Health', 'BPL families', 'service'),
            ('PM Kisan', 'Poverty', 'Small farmers', 'cash'),
        ]
        for name, cat, crit, benefit in schemes:
            c.execute("INSERT INTO scheme_categories (name, description) VALUES (?, ?)", (cat, ''))
            cat_id = c.lastrowid
            c.execute("INSERT INTO schemes (name, category_id, eligibility_criteria, benefit_type, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                      (name, cat_id, crit, benefit))
        print("[INIT] Seeded schemes")
    else:
        print("[INIT] Schemes already exist")
    
    conn.commit()
    conn.close()
    print("[INIT] Database initialized successfully")

if __name__ == '__main__':
    init_db()