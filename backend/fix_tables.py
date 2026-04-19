import pymysql

conn = pymysql.connect(host='localhost', port=3306, user='root', password='root', database='welfare_system')
c = conn.cursor()

# Check users.id column type
c.execute("SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema='welfare_system' AND table_name='users' AND column_name='id'")
col_type = c.fetchone()[0]
print(f"users.id type: {col_type}")

c.execute(f"""CREATE TABLE IF NOT EXISTS beneficiary_verifications (
    id {col_type} AUTO_INCREMENT PRIMARY KEY,
    user_id {col_type} NOT NULL,
    beneficiary_type VARCHAR(10) DEFAULT 'alive',
    aadhaar_doc_path TEXT, pan_doc_path TEXT, selfie_path TEXT,
    death_cert_path TEXT, pan_number VARCHAR(20),
    match_score FLOAT, video_room_id VARCHAR(100), video_room_url TEXT,
    video_status VARCHAR(20) DEFAULT 'not_scheduled',
    status VARCHAR(20) DEFAULT 'pending',
    admin_remarks TEXT, block_hash TEXT, block_index INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)""")
conn.commit()
print("beneficiary_verifications table created!")

# Check for other tables
tables = ['user_identity', 'notifications', 'fraud_flags', 'risk_scores',
          'applications', 'schemes', 'scheme_categories', 'scheme_rules',
          'ml_analysis', 'benefit_disbursements', 'scheme_access_logs',
          'audit_logs', 'clusters', 'user_clusters', 'user_links', 'user_activity']
for t in tables:
    c.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='welfare_system' AND table_name=%s", (t,))
    exists = c.fetchone()[0]
    status = "OK" if exists else "MISSING"
    print(f"  {t}: {status}")

# Create other missing tables
c.execute(f"""CREATE TABLE IF NOT EXISTS ml_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNIQUE,
    bert_narrative TEXT, feature_scores TEXT,
    model_confidence FLOAT, cluster_label VARCHAR(100),
    isolation_score FLOAT, gradient_boost_prob FLOAT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)""")

c.execute(f"""CREATE TABLE IF NOT EXISTS benefit_disbursements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT, user_id BIGINT, scheme_id BIGINT,
    amount FLOAT, installment_no INT,
    disbursement_date TIMESTAMP NULL,
    payment_method VARCHAR(50), account_no_last4 VARCHAR(4),
    status VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id)
)""")

c.execute(f"""CREATE TABLE IF NOT EXISTS scheme_access_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT, scheme_id BIGINT,
    accessed_at TIMESTAMP NULL,
    action VARCHAR(50), device VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id)
)""")
conn.commit()
print("All missing tables created!")

conn.close()
