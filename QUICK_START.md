# QUICK START - Localhost Login Testing

## 3-Step Startup

### Step 1: Start MySQL (PowerShell)
```powershell
net start MySQL80
```

### Step 2: Start Backend (New PowerShell)
```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\backend
python app.py
```
✅ You should see: `[STARTUP] Backend will run on: http://localhost:5000`

### Step 3: Start Frontend (New PowerShell)
```powershell
cd c:\Users\ravi shanky\Downloads\digiverify-ai-main\ReactFrontend\fund_tracker
npm run dev
```
✅ You should see: `Local: http://localhost:5173/`

---

## Test in Browser

1. **Open**: http://localhost:5173
2. **Wait 2-3 seconds** for the page to load
3. **Check**: Login card should show **✓ Connected** (green status)
4. **Enter credentials**:
   - Aadhaar: `123456789012`
   - Email: `ravi@mail.com`
5. **Click**: "Sign In as Citizen"
6. **Expected**: Dashboard with "Ravi Kumar" shown

---

## Verify in Browser Console (F12)

Look for these lines (means backend is reachable):
```
[LOGIN] Checking backend connectivity...
[API REQUEST] GET http://localhost:5000/test
[API RESPONSE] 200 from /test
[LOGIN] Backend /test endpoint: OK
```

---

## If Login Status Shows "✗ Disconnected"

1. **Check backend is running** (PowerShell):
   ```powershell
   curl http://localhost:5000/test
   ```
   Should return: `{"message":"Backend API is reachable!","status":"ok",...}`

2. **Check database is connected** (PowerShell):
   ```powershell
   curl http://localhost:5000/health
   ```
   Should show: `"database":"connected"`

3. **Restart backend**:
   - Press Ctrl+C in backend PowerShell
   - Run: `python app.py`

---

## Credentials Reference

| Type | Value |
|------|-------|
| Citizen Aadhaar | 123456789012 |
| Citizen Email | ravi@mail.com |
| Admin Username | admin |
| Admin Password | admin123 |

---

## Ports Reference

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Database: localhost:3306

---

## Expected Success Indicators

✅ Backend console shows `[STARTUP] Backend will run on: http://localhost:5000`
✅ Frontend loads on http://localhost:5173
✅ Login card shows **✓ Connected** status
✅ Browser console shows `[API RESPONSE] 200 from /test`
✅ Login succeeds and redirects to dashboard

---

## For Detailed Testing Instructions
See: [LOCALHOST_CONNECTIVITY_FIX.md](LOCALHOST_CONNECTIVITY_FIX.md)

## For Fix Verification Details
See: [FIX_VERIFICATION.md](FIX_VERIFICATION.md)
