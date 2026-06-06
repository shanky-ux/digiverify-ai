# Localhost Connectivity Fix - Complete Guide

## Issues Fixed

### 1. **CORS Configuration Enhanced** ✅
- Enabled `flask-cors` with explicit localhost origins
- Added manual CORS headers fallback
- Added preflight OPTIONS request handling

### 2. **Backend Startup Logging Improved** ✅
- Prints startup sequence showing exact port
- Shows CORS configuration
- Database credentials display
- Test command instructions

### 3. **Health Check & Test Endpoints Added** ✅
- `/health` - Checks database connectivity
- `/test` - Simple endpoint (no database required)
- Both endpoints return useful debugging info

### 4. **Frontend API Debugging Enhanced** ✅
- Logs all requests/responses to console
- Shows network errors with details
- Displays API base URL configuration
- Backend connectivity check on page load

### 5. **Login UI Improvements** ✅
- Shows real-time backend connection status (✓ Connected / ✗ Disconnected)
- Prevents login if backend is unreachable
- Better error messages for connection failures
- Console logging for all login attempts

---

## Startup Order (IMPORTANT - Must Follow This)

### Step 1: Ensure MySQL is Running (Port 3306)

```powershell
# Check if MySQL is running
netstat -ano | findstr ":3306"

# Should output something like:
#   TCP    127.0.0.1:3306    LISTENING    1234
```

If not running, start it:
```powershell
# For MySQL Installer/Services
net start MySQL80

# Or check running services
tasklist | findstr mysql
```

### Step 2: Start Backend Flask Server (Port 5000)

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\backend

# FIRST TIME ONLY: Install dependencies
pip install flask flask-cors pymysql

# Start the backend
python app.py
```

**Expected Console Output:**
```
================================================================================
DIGIVERIFY BACKEND - STARTUP SEQUENCE
================================================================================
[STARTUP] Backend service initializing...
[STARTUP] Backend will run on: http://localhost:5000
[STARTUP] Also accessible at: http://127.0.0.1:5000
[STARTUP] Backend listening on all interfaces (0.0.0.0:5000)
[STARTUP] CORS enabled for: localhost:5173, 127.0.0.1:5173, localhost:3000, 127.0.0.1:3000, *
[STARTUP] Database: MySQL on localhost:3306
[STARTUP] Database credentials: root@welfare_system

[STARTUP] Test the API with:
  curl http://localhost:5000/health
  curl http://localhost:5000/test

[STARTUP] Login credentials (if demo user exists):
  Aadhaar: 123456789012
  Email:   ravi@mail.com

[STARTUP] Frontend should connect to: http://localhost:5000
================================================================================
```

### Step 3: Test Backend Connectivity (In New PowerShell)

**Test simple endpoint (no database required):**
```powershell
curl http://localhost:5000/test
```

Expected response:
```json
{
  "message": "Backend API is reachable!",
  "status": "ok",
  "timestamp": "2026-06-03T...",
  "headers": {...}
}
```

**Test health endpoint (tests database):**
```powershell
curl http://localhost:5000/health
```

Expected response (if database is connected):
```json
{
  "status": "ok",
  "message": "Backend is running and database is connected",
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
  "timestamp": "2026-06-03T...",
  "backend_url": "http://localhost:5000"
}
```

If database is disconnected:
```json
{
  "status": "error",
  "message": "Backend is running but database is not connected",
  "database": "disconnected",
  "error": "...",
  "hint": "Ensure MySQL is running on localhost:3306 with credentials root/root",
  "timestamp": "2026-06-03T..."
}
```

### Step 4: Start Frontend React App (Port 5173)

In a new PowerShell window:

```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\ReactFrontend\fund_tracker

# FIRST TIME ONLY: Install dependencies
npm install

# Start development server
npm run dev
```

**Expected Console Output:**
```
  VITE v... dev server running at:

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

### Step 5: Open Browser and Test Frontend

1. Open: `http://localhost:5173`
2. **Wait 2-3 seconds** for the login page to load and check backend connectivity
3. You should see: **Backend Status: ✓ Connected** (in green)
4. If you see **✗ Disconnected**, check:
   - Backend is running on port 5000
   - No CORS errors in browser console (F12 → Console tab)
   - No firewall blocking port 5000

### Step 6: Test Login

1. Enter credentials:
   - **Aadhaar**: `123456789012`
   - **Email**: `ravi@mail.com`
2. Click "Sign In as Citizen"
3. Should login successfully and show dashboard

---

## Troubleshooting

### Issue: "Cannot reach the backend API"

**Possible causes:**

1. **Backend not running on port 5000**
   ```powershell
   # Check if port 5000 is listening
   netstat -ano | findstr ":5000"
   
   # If nothing shown, backend is not running
   # Start it: python app.py from backend/ directory
   ```

2. **Firewall blocking port 5000**
   ```powershell
   # Allow port 5000 through Windows Firewall
   netsh advfirewall firewall add rule name="Allow Port 5000" dir=in action=allow protocol=tcp localport=5000
   ```

3. **Frontend .env has wrong URL**
   ```
   # File: ReactFrontend/fund_tracker/.env
   # Must have:
   VITE_API_BASE_URL=http://localhost:5000
   
   # NOT:
   VITE_API_BASE_URL=http://localhost:5001
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. **CORS issues**
   - Check browser console (F12 → Console tab)
   - Look for "CORS error" or "No 'Access-Control-Allow-Origin'" message
   - Restart backend: `python app.py`

### Issue: "Invalid Aadhaar or email"

**Causes:**

1. **Demo user not in database**
   ```powershell
   mysql -u root -p
   # Password: root
   ```
   
   ```sql
   USE welfare_system;
   SELECT * FROM users WHERE aadhaar_number='123456789012';
   
   -- If not found, insert:
   INSERT INTO users (aadhaar_number, full_name, gender, date_of_birth, phone, email, income, occupation, is_bpl)
   VALUES ('123456789012', 'Ravi Kumar', 'Male', '1985-06-15', '9876543210', 'ravi@mail.com', 50000, 'Farmer', 1);
   ```

2. **Database not initialized**
   ```powershell
   # Stop backend (Ctrl+C)
   # Delete database:
   mysql -u root -p -e "DROP DATABASE welfare_system"
   # Start backend again - it will recreate the database
   python app.py
   ```

### Issue: "Login request timed out"

**Causes:**

1. **Database is too slow or not responding**
   ```powershell
   # Check MySQL is responsive
   mysql -u root -p -e "SELECT 1"
   
   # If it hangs, restart MySQL
   net stop MySQL80
   net start MySQL80
   ```

2. **Backend having issues**
   - Check backend console for errors
   - Restart backend: Stop with Ctrl+C, then `python app.py`

### Issue: Backend Status shows "✗ Disconnected"

**Check browser console (F12):**
- Look for network errors
- Check if backend is really running on 5000
- Look for CORS errors

**From PowerShell:**
```powershell
# Test if backend responds to test endpoint
curl http://localhost:5000/test

# If this fails, backend is down or port is wrong
```

---

## Console Debugging

### Frontend Console (Browser F12)

When you open the login page, you should see:
```
[API] Configuration:
[API]   VITE_API_BASE_URL: http://localhost:5000
[API]   Normalized URL: http://localhost:5000
[API]   API_BASE: http://localhost:5000

[LOGIN] Checking backend connectivity...
[API REQUEST] GET http://localhost:5000/test
[API RESPONSE] 200 from /test
[API REQUEST] GET http://localhost:5000/health
[API RESPONSE] 200 from /health
[LOGIN] Backend /health endpoint: OK {...}
```

### Backend Console

When frontend tries to login:
```
[STARTUP] Backend service initializing...
[STARTUP] Backend will run on: http://localhost:5000
...

[TEST] Request from 127.0.0.1
[HEALTH] Request from 127.0.0.1
[LOGIN REQUEST RECEIVED: 2026-06-03T...]
[1] Request body received: {'aadhaar_number': '123456789012', ...}
...
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/app.py` | Enhanced CORS, improved startup logging, added /test and /health endpoints |
| `ReactFrontend/fund_tracker/src/api.js` | Added request/response logging, improved error handling |
| `ReactFrontend/fund_tracker/src/components/Login.jsx` | Added backend connectivity check, status display, better error messages |

---

## Port Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | `http://localhost:5173` |
| Backend (Flask) | 5000 | `http://localhost:5000` |
| MySQL Database | 3306 | `localhost:3306` |

**Frontend connects to Backend at**: `http://localhost:5000`

---

## Quick Test Commands

```powershell
# Test backend is running
curl http://localhost:5000/test

# Test database connection
curl http://localhost:5000/health

# Test login endpoint directly
$body = @{
    aadhaar_number = "123456789012"
    email = "ravi@mail.com"
} | ConvertTo-Json

curl -X POST http://localhost:5000/auth/login `
     -H "Content-Type: application/json" `
     -d $body

# Check ports are in use
netstat -ano | findstr ":5173"  # Frontend
netstat -ano | findstr ":5000"  # Backend
netstat -ano | findstr ":3306"  # MySQL
```

---

## Summary

✅ **Backend runs on port 5000**
✅ **Frontend runs on port 5173**  
✅ **CORS properly configured**
✅ **Health check endpoint available**
✅ **Frontend checks connectivity on load**
✅ **Detailed logging in both frontend and backend**
✅ **Better error messages**

**Next steps:**
1. Start MySQL
2. Start backend: `python app.py` from backend/
3. Start frontend: `npm run dev` from ReactFrontend/fund_tracker/
4. Open http://localhost:5173
5. Login with Aadhaar: 123456789012, Email: ravi@mail.com
