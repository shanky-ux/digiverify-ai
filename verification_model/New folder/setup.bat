@echo off
REM Quick setup script for Windows
REM Beneficiary Verification System

echo.
echo Beneficiary Verification System - Setup
echo =======================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed. Please install from nodejs.org
    pause
    exit /b 1
)

echo + Node.js found
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo + Node version: %NODE_VERSION%
echo.

REM Backend setup
echo Checking Backend setup...
cd backend

if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo + .env created. Please edit with your MySQL credentials.
)

echo Installing backend dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo X Backend setup failed
    pause
    exit /b 1
)

echo + Backend setup complete
echo.

REM Frontend setup
echo Checking Frontend setup...
cd ..\frontend

echo Installing frontend dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo X Frontend setup failed
    pause
    exit /b 1
)

echo + Frontend setup complete
echo.
echo Setup Complete!
echo.
echo Next Steps:
echo 1. Edit backend\.env with your MySQL credentials
echo 2. Import database: mysql -u root -p ^< database.sql
echo 3. Start backend: cd backend ^&^& npm run dev
echo 4. Start frontend: cd frontend ^&^& npm start
echo.
echo Access:
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
echo.
pause
