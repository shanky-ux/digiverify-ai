# MySQL Setup & Database Initialization Guide for DigiVerify

## PROBLEM: "Can't connect to MySQL server on 'localhost' ([WinError 10061])"

This error means the Flask backend cannot reach MySQL server. This guide will help you fix it.

---

## STEP 1: Check if MySQL is Installed

### On Windows:
```powershell
# Check if MySQL service exists
Get-Service -Name MySQL80 -ErrorAction SilentlyContinue
Get-Service -Name MySQL57 -ErrorAction SilentlyContinue  
Get-Service -Name MySQL56 -ErrorAction SilentlyContinue
```

If you see service details, MySQL is installed. If not, download from: https://dev.mysql.com/downloads/mysql/

---

## STEP 2: Check if MySQL Service is Running

### Method 1: Via Services GUI (Easiest)
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "MySQL80" (or MySQL57, MySQL56)
4. If Status is blank = NOT RUNNING
5. If Status shows "Started" = RUNNING
6. To start: Right-click → "Start"

### Method 2: Via Command Prompt
```powershell
# Check if MySQL service is running
Get-Service MySQL80 -ErrorAction SilentlyContinue | Select-Object Status, Name

# Start MySQL service (requires Admin)
net start MySQL80

# Stop MySQL service (if needed)
net stop MySQL80
```

Replace `MySQL80` with `MySQL57` or `MySQL56` if that's your version.

### Method 3: Check if anything is listening on port 3306
```powershell
netstat -ano | findstr ":3306"
```

If you see output like `LISTENING` → MySQL is running
If empty → MySQL is NOT running

---

## STEP 3: Start MySQL on Windows

Choose ONE of these options:

### Option A: Via Services (Recommended)
```
Win + R → services.msc → Enter
Find MySQL80 → Right-click → Start → Close
```

### Option B: Via Command Prompt (as Administrator)
```powershell
net start MySQL80
```
Output: `The MySQL80 service is starting.`

### Option C: Start MySQL directly
If services don't work, run MySQL directly:
```powershell
# Find MySQL bin directory first
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
mysqld.exe

# Or if in Percona MySQL
cd "C:\Program Files\Percona\Percona Server 8.0\bin"
mysqld.exe
```

---

## STEP 4: Verify MySQL is Running

Test connection:
```powershell
# Test MySQL connection
mysql -h localhost -u root -proot

# If successful, you'll see:
# Welcome to the MySQL monitor.  Commands end with ; or \g.
# Your MySQL connection id is ...

# Exit with: exit
```

Or test from Python:
```powershell
python -c "import pymysql; conn = pymysql.connect(host='localhost', user='root', password='root'); print('MySQL connected!'); conn.close()"
```

---

## STEP 5: Initialize Database Schema

Once MySQL is running, create the database and tables:

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main
python backend\database_init.py
```

Expected output:
```
[DB_INIT] Starting database initialization...
[DB_INIT] Target: root@localhost:3306/welfare_system
[DB_INIT] Connecting to MySQL server...
[DB_INIT] ✓ Connected to MySQL server
[DB_INIT] Creating database 'welfare_system' (if not exists)...
[DB_INIT] ✓ Database 'welfare_system' ready
[DB_INIT] Creating tables...
  ✓ users table
  ✓ risk_scores table
  ✓ beneficiary_verifications table
  ✓ notifications table
  ✓ applications table
  ✓ schemes table
  ✓ scheme_categories table
[DB_INIT] ✓ All tables created successfully
[DB_INIT] Creating demo user (aadhaar=123456789012, email=ravi@mail.com)...
[DB_INIT] ✓ Demo user created with ID 1
[DB_INIT] ✓✓✓ Database initialization complete! ✓✓✓
```

---

## STEP 6: Start Flask Backend

Now start the Flask backend:

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main
python backend/app.py
```

Expected output:
```
================================================================================
DIGIVERIFY BACKEND - STARTUP SEQUENCE
================================================================================
[STARTUP] Backend service initializing...
[STARTUP] Backend will run on: http://localhost:5003
[STARTUP] Also accessible at: http://127.0.0.1:5003
[STARTUP] Backend listening on all interfaces (0.0.0.0:5003)
[STARTUP] CORS enabled for localhost:5173 and localhost:3000
[STARTUP] Database: MySQL on localhost:3306
[STARTUP] Database name: welfare_system
[STARTUP] Database user: root

[STARTUP] Test the API with:
  curl http://localhost:5003/health
  curl http://localhost:5003/test
  curl http://localhost:5003/db/status

[STARTUP] Login credentials (if demo user exists):
  Aadhaar: 123456789012
  Email:   ravi@mail.com

[STARTUP] Frontend should connect to: http://localhost:5003
================================================================================

[STARTUP] Checking database connectivity...
[STARTUP] ✓ Database connection successful
[STARTUP] ✓ Users in database: 1
[STARTUP] ✓ Demo user found: Demo User (ravi@mail.com)

[STARTUP] Starting Flask server on port 5003...
 * Serving Flask app 'app'
 * Debug mode: off
 * Running on http://0.0.0.0:5003
```

---

## STEP 7: Test Backend Endpoints

In a new PowerShell window, test the backend:

```powershell
# Test 1: Simple connectivity (no DB required)
curl http://localhost:5003/test
# Expected: {"message":"Backend API is reachable!","status":"ok","timestamp":"..."}

# Test 2: Health check (tests DB connection)
curl http://localhost:5003/health
# Expected: {"status":"connected","message":"Backend is running and database is connected","database":"connected","users_in_db":1,"demo_user":{"exists":true,"id":1,"name":"Demo User","email":"ravi@mail.com"},...}

# Test 3: Detailed database status
curl http://localhost:5003/db/status
# Expected: {"timestamp":"...","backend":{"status":"running",...},"database":{"host":"localhost","port":3306,...},"connectivity":{"status":"connected","message":"Database connection successful"},...}

# Test 4: Login with demo credentials
$data = @{
    aadhaar_number = "123456789012"
    email = "ravi@mail.com"
} | ConvertTo-Json

curl -Method POST `
     -Uri "http://localhost:5003/auth/login" `
     -ContentType "application/json" `
     -Body $data

# Expected: {"user_id":1,"full_name":"Demo User","is_admin":false}
```

---

## STEP 8: Start Frontend

In a new PowerShell window:

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\ReactFrontend\fund_tracker
npm install
npm run dev
```

Frontend will start on http://localhost:5173

---

## STEP 9: Test Full Login

1. Open http://localhost:5173 in browser
2. Login page should show green "Backend Connected" indicator
3. Enter credentials:
   - Aadhaar: `123456789012`
   - Email: `ravi@mail.com`
4. Click Login
5. Should succeed and show user dashboard

---

## TROUBLESHOOTING

### Problem: "WinError 10061 - No connection could be made"
**Solution**: MySQL is not running. Run:
```powershell
net start MySQL80
python backend\database_init.py
python backend\app.py
```

### Problem: "Access denied for user 'root'@'localhost'"
**Solution**: Wrong password. Check credentials in `backend/app.py`:
```python
DB_CFG = dict(
    host='localhost',
    port=3306,
    user='root',
    password='root',    # Change this if needed
    database='welfare_system',
)
```

Or set environment variables:
```powershell
$env:DB_HOST = 'localhost'
$env:DB_PORT = 3306
$env:DB_USER = 'root'
$env:DB_PASSWORD = 'root'
$env:DB_NAME = 'welfare_system'
python backend\app.py
```

### Problem: "Unknown database 'welfare_system'"
**Solution**: Initialize database schema:
```powershell
python backend\database_init.py
```

### Problem: "Table 'welfare_system.users' doesn't exist"
**Solution**: Same as above:
```powershell
python backend\database_init.py
```

### Problem: Demo user doesn't exist in database
**Solution**: Create it:
```powershell
# Check what users exist
mysql -h localhost -u root -proot -e "SELECT * FROM welfare_system.users;"

# Recreate demo user
python backend\database_init.py
```

### Problem: MySQL port 3306 is in use by another process
**Check what's using it**:
```powershell
netstat -ano | findstr ":3306"
# Output: TCP  127.0.0.1:3306  0.0.0.0:0  LISTENING  12345

# Find process:
tasklist /FI "PID eq 12345"

# Stop it or use different port:
$env:DB_PORT = 3307
python backend\database_init.py
python backend\app.py
```

---

## QUICK START (Full Sequence)

Run these commands in order:

```powershell
# 1. Start MySQL service
net start MySQL80

# 2. Navigate to project
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main

# 3. Initialize database (one time)
python backend\database_init.py

# 4. Start backend (in first PowerShell window)
python backend\app.py

# 5. In second PowerShell window, start frontend:
cd ReactFrontend\fund_tracker
npm run dev

# 6. Open browser to http://localhost:5173
# 7. Login with: aadhaar=123456789012, email=ravi@mail.com
```

---

## MYSQL 8.0 Default Credentials

If MySQL was installed with default settings:
- Username: `root`
- Password: `root` (sometimes blank)
- Host: `localhost`
- Port: `3306`

If these don't work, check MySQL installation documentation or reset root password.

---

## Port Reference

- Backend API: `5003` (Flask)
- Frontend: `5173` (Vite development server)
- MySQL: `3306` (default)
- ~~`5000`~~: Previously PostgreSQL (conflicts fixed)

---

## Next Steps

After successful login:
1. Navigate to dashboard
2. View welfare schemes
3. Apply for schemes
4. Track application status
5. View risk assessments

---

## Questions?

Backend logs are printed to console. Check terminal for detailed error messages:
```
[REQUEST] POST /auth/login from 127.0.0.1
[DB] Attempting to connect to localhost:3306
[DB] Connection successful
[4] Query result: {'id': 1, 'full_name': 'Demo User'}
[5] AUTHENTICATION SUCCESS: {'user_id': 1, 'full_name': 'Demo User', 'is_admin': False}
```

All errors are logged with `[DB]`, `[ERROR]`, `[STARTUP]`, `[REQUEST]` prefixes for easy debugging.
