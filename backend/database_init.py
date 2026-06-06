"""
Initialize MySQL database schema for welfare system.
Run this once before starting the backend.
"""
import pymysql
import sys
import os

DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', 3306))
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'root')
DB_NAME = os.environ.get('DB_NAME', 'welfare_system')

print("[DB_INIT] Starting database initialization...")
print(f"[DB_INIT] Target: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

try:
    # Connect to MySQL without specifying database (to create it)
    print("\n[DB_INIT] Connecting to MySQL server...")
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        charset='utf8mb4',
        connect_timeout=10,
    )
    print("[DB_INIT] ✓ Connected to MySQL server")
    
    cursor = conn.cursor()
    
    # Create database
    print(f"\n[DB_INIT] Creating database '{DB_NAME}' (if not exists)...")
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print(f"[DB_INIT] ✓ Database '{DB_NAME}' ready")
    
    # Switch to the database
    cursor.execute(f"USE `{DB_NAME}`")
    
    # Create tables
    print("\n[DB_INIT] Creating tables...")
    
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            aadhaar_number VARCHAR(20) UNIQUE NOT NULL,
            full_name VARCHAR(100),
            gender VARCHAR(20),
            date_of_birth DATE,
            phone VARCHAR(20),
            email VARCHAR(100) UNIQUE,
            income DECIMAL(12,2),
            occupation VARCHAR(100),
            is_bpl TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_aadhaar (aadhaar_number),
            INDEX idx_email (email)
        )
    """)
    print("  ✓ users table")
    
    # Risk scores table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS risk_scores (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNIQUE NOT NULL,
            anomaly_score FLOAT,
            fraud_probability FLOAT,
            risk_level VARCHAR(20),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    print("  ✓ risk_scores table")
    
    # Beneficiary verifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS beneficiary_verifications (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            beneficiary_type VARCHAR(10) DEFAULT 'alive',
            aadhaar_doc_path TEXT,
            pan_doc_path TEXT,
            selfie_path TEXT,
            death_cert_path TEXT,
            pan_number VARCHAR(20),
            match_score FLOAT,
            video_room_id VARCHAR(100),
            video_room_url TEXT,
            video_status VARCHAR(20) DEFAULT 'not_scheduled',
            status VARCHAR(20) DEFAULT 'pending',
            admin_remarks TEXT,
            block_hash TEXT,
            block_index INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    print("  ✓ beneficiary_verifications table")
    
    # Notifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT,
            message TEXT,
            type VARCHAR(20),
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    print("  ✓ notifications table")
    
    # Applications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT,
            scheme_id BIGINT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    print("  ✓ applications table")
    
    # Schemes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schemes (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(200),
            category_id BIGINT,
            eligibility_criteria TEXT,
            benefit_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  ✓ schemes table")
    
    # Scheme categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scheme_categories (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  ✓ scheme_categories table")
    
    conn.commit()
    print("\n[DB_INIT] ✓ All tables created successfully")
    
    # Check for demo user
    cursor.execute("SELECT id FROM users WHERE aadhaar_number='123456789012' AND email='ravi@mail.com'")
    demo_user = cursor.fetchone()
    
    if not demo_user:
        print("\n[DB_INIT] Creating demo user (aadhaar=123456789012, email=ravi@mail.com)...")
        cursor.execute("""
            INSERT INTO users (aadhaar_number, full_name, gender, email, phone, income, occupation, is_bpl, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            '123456789012',          # aadhaar_number
            'Demo User',              # full_name
            'Male',                   # gender
            'ravi@mail.com',          # email
            '9876543210',             # phone
            50000.00,                 # income
            'Engineer',               # occupation
            0                         # is_bpl
        ))
        
        # Get the inserted user ID
        demo_user_id = cursor.lastrowid
        
        # Create risk score for demo user
        cursor.execute("""
            INSERT INTO risk_scores (user_id, anomaly_score, fraud_probability, risk_level)
            VALUES (%s, %s, %s, %s)
        """, (demo_user_id, 0.05, 0.02, 'low'))
        
        conn.commit()
        print(f"[DB_INIT] ✓ Demo user created with ID {demo_user_id}")
    else:
        print("\n[DB_INIT] Demo user already exists")
    
    cursor.close()
    conn.close()
    
    print("\n[DB_INIT] ✓✓✓ Database initialization complete! ✓✓✓")
    print("[DB_INIT] Ready to connect from Flask backend")
    sys.exit(0)
    
except pymysql.MySQLError as e:
    print(f"\n[DB_INIT] ✗ MySQL Error: {e}")
    print(f"[DB_INIT] Error code: {e.args[0] if e.args else 'unknown'}")
    if e.args[0] == 2003:
        print("\n[DB_INIT] ERROR: Cannot connect to MySQL server")
        print("[DB_INIT] Possible causes:")
        print("  1. MySQL is not running (most likely)")
        print("  2. Wrong host/port (check DB_HOST, DB_PORT environment variables)")
        print("  3. MySQL not installed")
        print("\n[DB_INIT] Windows: To start MySQL:")
        print("  Option 1: services.msc → find MySQL → right-click → Start")
        print("  Option 2: Net start MySQL80 (or MySQL57, MySQL56, etc.)")
        print("  Option 3: Run 'mysqld.exe' directly if installed")
    sys.exit(1)
    
except Exception as e:
    print(f"\n[DB_INIT] ✗ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
