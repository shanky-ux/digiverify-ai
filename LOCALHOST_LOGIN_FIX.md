# Localhost Login Fix - Complete Testing Guide

## Summary of Fixes Applied

### **Issue #1: Wrong Frontend API Port (CRITICAL)**
**Problem**: Frontend `.env` was pointing to `http://localhost:5001` but backend runs on port `5000`
**Fix**: Updated `ReactFrontend/fund_tracker/.env` from port 5001 → 5000

### **Issue #2: No Login Debugging**
**Problem**: Backend login route had no logging, making it impossible to diagnose issues
**Fix**: Added comprehensive logging to `/auth/login` endpoint showing:
- Request body received
- Parsed credentials
- Database connection status
- SQL query execution
- Query results
- Authentication success/failure

### **Issue #3: Poor Connection Handling**
**Problem**: Database connections had no timeout, could hang indefinitely
**Fix**: 
- Added connection timeouts: `connect_timeout=10s, read_timeout=30s, write_timeout=30s`
- Improved error handling with proper rollback/cleanup
- Added try-finally blocks to ensure connections close

### **Issue #4: No Health Check**
**Problem**: No way to verify if database is actually connected
**Fix**: Added `/health` endpoint that checks:
- Database connectivity
- Demo user existence
- Display test credentials

---

## Testing Instructions

### Step 1: Verify MySQL is Running

```powershell
# Check if MySQL is running on port 3306
netstat -ano | findstr ":3306"

# Expected output: Shows LISTENING on port 3306
```

If MySQL isn't running, start it:
```powershell
# For MySQL installed via MySQL Installer
net start MySQL80

# Or if using WSL/Docker, start your MySQL service
```

### Step 2: Verify Database Exists and Has Data

```powershell
# Open MySQL CLI
mysql -u root -p

# When prompted, enter password: root
# Then run:
```

```sql
USE welfare_system;
SHOW TABLES;
SELECT * FROM users WHERE aadhaar_number='123456789012';
```

Expected output:
```
| id | aadhaar_number   | full_name  | email          | ... |
|----|------------------|------------|----------------|-----|
| 1  | 123456789012     | Ravi Kumar | ravi@mail.com  | ... |
```

If the user doesn't exist, insert it manually:
```sql
INSERT INTO users (aadhaar_number, full_name, gender, date_of_birth, phone, email, income, occupation, is_bpl, created_at)
VALUES ('123456789012', 'Ravi Kumar', 'Male', '1985-06-15', '9876543210', 'ravi@mail.com', 50000, 'Farmer', 1, NOW());
```

### Step 3: Start Backend on Port 5000

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\backend

# Make sure Python environment is set up
python -m pip install pymysql flask flask-cors

# Run the backend
python app.py
```

Expected output:
```
 * Running on http://0.0.0.0:5000
 * Environment: production
DB init complete
Database ready!
Login credentials: aadhaar=123456789012 email=ravi@mail.com
```

### Step 4: Test Backend Health Check

```powershell
# In another PowerShell window, test the health endpoint
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "users_in_db": 1,
  "demo_user": {
    "exists": true,
    "id": 1,
    "name": "Ravi Kumar",
    "email": "ravi@mail.com"
  },
  "test_credentials": {
    "aadhaar": "123456789012",
    "email": "ravi@mail.com"
  },
  "timestamp": "2026-06-03T..."
}
```

If you see `"database": "disconnected"`, the backend cannot reach MySQL. Check:
- MySQL is running: `net start MySQL80`
- Port 3306 is open: `netstat -ano | findstr ":3306"`
- Credentials are correct (root/root by default)

### Step 5: Test Login via cURL

```powershell
# Test the login endpoint with the demo credentials
$body = @{
    aadhaar_number = "123456789012"
    email = "ravi@mail.com"
} | ConvertTo-Json

curl -X POST http://localhost:5000/auth/login `
     -H "Content-Type: application/json" `
     -d $body
```

Expected response (success):
```json
{
  "user_id": 1,
  "full_name": "Ravi Kumar",
  "is_admin": false
}
```

### Step 6: Start Frontend on Port 5173

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\ReactFrontend\fund_tracker

# Install dependencies if needed
npm install

# Start development server
npm run dev
```

Expected output:
```
  VITE v... dev server running at:

  ➜  Local:   http://localhost:5173/
```

### Step 7: Test Login in Browser

1. Open `http://localhost:5173` in your browser
2. You should see the DigiVerify login page
3. Enter credentials:
   - **Aadhaar**: 123456789012
   - **Email**: ravi@mail.com
4. Click "Sign In as Citizen"
5. Should see user dashboard with "Ravi Kumar"

---

## Debug Output in Backend Console

When you attempt login, you should see output like:

```
================================================================================
LOGIN REQUEST RECEIVED: 2026-06-03T12:34:56.789123
================================================================================
[1] Request body received: {'aadhaar_number': '123456789012', 'email': 'ravi@mail.com'}
[2] Parsed credentials: aadhaar='123456789012', email='ravi@mail.com'
[3] Testing database connection...
[3] Database connection: OK
[4] Querying database for user with aadhaar='123456789012' and email='ravi@mail.com'
[4] SQL: SELECT id, full_name FROM users WHERE aadhaar_number=%s AND email=%s
[4] Params: ('123456789012', 'ravi@mail.com')
[4] Query result: {'id': 1, 'full_name': 'Ravi Kumar'}
[5] AUTHENTICATION SUCCESS: {'user_id': 1, 'full_name': 'Ravi Kumar', 'is_admin': False}
================================================================================
```

---

## Troubleshooting

### Problem: "Cannot reach backend API"
**Solution**:
```powershell
# Verify port 5000 is listening
netstat -ano | findstr ":5000"

# Check backend console for errors
# Restart backend: Stop previous process, run `python app.py` again
```

### Problem: "Invalid Aadhaar or email"
**Solution**:
```sql
-- Check if demo user exists in database
SELECT * FROM users WHERE aadhaar_number='123456789012';

-- If not found, insert manually:
INSERT INTO users (aadhaar_number, full_name, gender, date_of_birth, phone, email, income, occupation, is_bpl)
VALUES ('123456789012', 'Ravi Kumar', 'Male', '1985-06-15', '9876543210', 'ravi@mail.com', 50000, 'Farmer', 1);
```

### Problem: "Database connection failed"
**Solution**:
```powershell
# Check MySQL is running
netstat -ano | findstr ":3306"

# Restart MySQL
net stop MySQL80
net start MySQL80

# Verify connection:
mysql -u root -p -e "SELECT 1"
```

### Problem: Frontend still points to wrong port
**Solution**:
1. Verify `.env` file location: `ReactFrontend/fund_tracker/.env`
2. Content should be: `VITE_API_BASE_URL=http://localhost:5000`
3. If changed, you may need to restart dev server: Stop `npm run dev` and rerun it
4. Clear browser cache (Ctrl+Shift+Delete in Chrome)

---

## Files Modified

1. **ReactFrontend/fund_tracker/.env**
   - Changed: `http://localhost:5001` → `http://localhost:5000`

2. **backend/app.py**
   - Enhanced `get_conn()` with connection timeouts
   - Enhanced `fetchall()`, `fetchone()`, `execute()` with better error handling
   - Rewrote `/auth/login` with comprehensive debugging
   - Added `/health` endpoint for database verification

---

## Expected Final Result

Once all fixes are applied:
- ✅ Frontend loads on http://localhost:5173
- ✅ Backend runs on http://localhost:5000
- ✅ `/health` endpoint returns database status
- ✅ Login with credentials `123456789012` / `ravi@mail.com` succeeds
- ✅ User sees dashboard with name "Ravi Kumar"
- ✅ Backend console shows detailed debug output during login
