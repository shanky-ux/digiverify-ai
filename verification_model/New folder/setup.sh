#!/bin/bash
# Quick setup script for Beneficiary Verification System

echo "🚀 Beneficiary Verification System - Setup"
echo "==========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install from nodejs.org"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"
echo ""

# Backend setup
echo "📦 Setting up Backend..."
cd backend

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file. Edit with your MySQL credentials."
fi

echo "Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✓ Backend setup complete"
else
    echo "❌ Backend setup failed"
    exit 1
fi

echo ""

# Frontend setup
echo "📦 Setting up Frontend..."
cd ../frontend

echo "Installing frontend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✓ Frontend setup complete"
else
    echo "❌ Frontend setup failed"
    exit 1
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Edit backend/.env with your MySQL credentials"
echo "2. Import database: mysql -u root -p < database.sql"
echo "3. Start backend: cd backend && npm run dev"
echo "4. Start frontend: cd frontend && npm start"
echo ""
echo "🌐 Access:"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:5000"
echo ""
