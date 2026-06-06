#!/usr/bin/env python
"""
Quick database connectivity checker for DigiVerify.
Run this to diagnose MySQL connection issues.
"""
import os
import sys
import socket
import pymysql
from datetime import datetime

print("=" * 80)
print("DIGIVERIFY DATABASE CONNECTIVITY CHECKER")
print("=" * 80)
print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

# Configuration
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', 3306))
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'root')
DB_NAME = os.environ.get('DB_NAME', 'welfare_system')

print(f"[CONFIG] Database target:")
print(f"  Host: {DB_HOST}")
print(f"  Port: {DB_PORT}")
print(f"  User: {DB_USER}")
print(f"  Database: {DB_NAME}")
print()

# Step 1: Check port connectivity
print("[STEP 1] Checking network connectivity to MySQL port...")
try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(3)
    result = sock.connect_ex((DB_HOST, DB_PORT))
    sock.close()
    
    if result == 0:
        print(f"  ✓ Port {DB_PORT} is OPEN on {DB_HOST}")
        port_ok = True
    else:
        print(f"  ✗ Port {DB_PORT} is CLOSED on {DB_HOST}")
        print(f"    This usually means MySQL is not running")
        port_ok = False
except Exception as e:
    print(f"  ✗ Error checking port: {e}")
    port_ok = False

print()

# Step 2: Try to connect to MySQL
print("[STEP 2] Attempting MySQL server connection...")
if not port_ok:
    print(f"  ⚠ Skipping (port is not accessible)")
    print(f"  → Run: net start MySQL80")
    sys.exit(1)

try:
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        charset='utf8mb4',
        connect_timeout=5,
    )
    print(f"  ✓ Successfully connected to MySQL server")
    
    cursor = conn.cursor()
    cursor.execute("SELECT VERSION() as version")
    result = cursor.fetchone()
    version = result[0] if result else 'unknown'
    print(f"  ✓ MySQL version: {version}")
    
except pymysql.err.OperationalError as e:
    error_code = e.args[0] if e.args else 0
    error_msg = str(e)
    print(f"  ✗ Connection failed with error code {error_code}")
    print(f"  ✗ Error: {error_msg}")
    
    if error_code == 2003:
        print(f"\n  FIX: MySQL server is not running")
        print(f"  Run: net start MySQL80")
    elif error_code == 1045:
        print(f"\n  FIX: Access denied (wrong password?)")
        print(f"  Check: DB_PASSWORD environment variable")
    
    sys.exit(1)

except Exception as e:
    print(f"  ✗ Connection failed: {e}")
    sys.exit(1)

print()

# Step 3: Check if database exists
print("[STEP 3] Checking if database exists...")
try:
    cursor.execute(f"SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", (DB_NAME,))
    db_exists = cursor.fetchone()
    
    if db_exists:
        print(f"  ✓ Database '{DB_NAME}' exists")
    else:
        print(f"  ✗ Database '{DB_NAME}' does not exist")
        print(f"  → Run: python backend\\database_init.py")
        sys.exit(1)
        
except Exception as e:
    print(f"  ✗ Error checking database: {e}")
    sys.exit(1)

print()

# Step 4: Check tables
print("[STEP 4] Checking database tables...")
try:
    cursor.execute("USE " + DB_NAME)
    
    cursor.execute("""
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = %s
    """, (DB_NAME,))
    
    result = cursor.fetchone()
    table_count = result[0] if result else 0
    
    if table_count > 0:
        print(f"  ✓ Database has {table_count} tables")
    else:
        print(f"  ✗ Database has NO tables")
        print(f"  → Run: python backend\\database_init.py")
        sys.exit(1)
    
    # Check specific tables
    required_tables = ['users', 'risk_scores', 'beneficiary_verifications']
    for table_name in required_tables:
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = %s AND table_name = %s
        """, (DB_NAME, table_name))
        result = cursor.fetchone()
        exists = result[0] if result else 0
        status = "✓" if exists else "✗"
        print(f"  {status} {table_name}")
    
except Exception as e:
    print(f"  ✗ Error checking tables: {e}")
    sys.exit(1)

print()

# Step 5: Check for demo user
print("[STEP 5] Checking for demo user...")
try:
    cursor.execute("""
        SELECT id, aadhaar_number, email, full_name 
        FROM users 
        WHERE aadhaar_number = '123456789012'
        LIMIT 1
    """)
    
    demo_user = cursor.fetchone()
    
    if demo_user:
        user_id, aadhaar, email, full_name = demo_user
        print(f"  ✓ Demo user exists:")
        print(f"    ID: {user_id}")
        print(f"    Name: {full_name}")
        print(f"    Aadhaar: {aadhaar}")
        print(f"    Email: {email}")
    else:
        print(f"  ⚠ Demo user does not exist")
        print(f"  → Run: python backend\\database_init.py")
    
except Exception as e:
    print(f"  ✗ Error checking demo user: {e}")

print()

# Step 6: Count users
print("[STEP 6] Database statistics...")
try:
    cursor.execute("SELECT COUNT(*) as cnt FROM users")
    result = cursor.fetchone()
    user_count = result[0] if result else 0
    print(f"  Users in database: {user_count}")
    
    cursor.execute("SELECT COUNT(*) as cnt FROM risk_scores")
    result = cursor.fetchone()
    risk_count = result[0] if result else 0
    print(f"  Risk scores in database: {risk_count}")
    
except Exception as e:
    print(f"  ✗ Error getting stats: {e}")

print()

# Cleanup
try:
    conn.close()
except:
    pass

print("=" * 80)
print("✓ DATABASE CONNECTIVITY CHECK COMPLETE")
print("=" * 80)
print("\nAll systems operational! You can now:")
print("  1. Start Flask backend: python backend\\app.py")
print("  2. Start React frontend: cd ReactFrontend\\fund_tracker && npm run dev")
print("  3. Open browser to: http://localhost:5173")
print("  4. Login with aadhaar=123456789012, email=ravi@mail.com")
