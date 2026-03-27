# Welfare System

A comprehensive welfare management system with Flask API backend and React frontend.

## Features

- User management with Aadhaar verification
- Scheme management with eligibility criteria
- Application processing
- Risk scoring and fraud detection
- Dashboard with statistics

## Database Schema

The system uses SQLite with the following main tables:
- users: Beneficiary information
- schemes: Government welfare schemes
- applications: Scheme applications
- risk_scores: Fraud risk assessment
- And many more...

## Setup

### Backend (Flask API)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r ../requirements.txt
   ```

3. Run the Flask server:
   ```bash
   python app.py
   ```

The API will be available at http://localhost:5000

### Frontend (React)

1. Navigate to the React app directory:
   ```bash
   cd ReactFrontend/fund_tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at http://localhost:5173

## API Endpoints

- `GET /` - API health check
- `GET /users` - Get all users
- `POST /users` - Create a new user
- `GET /schemes` - Get all schemes
- `GET /applications` - Get all applications
- `POST /applications` - Create a new application
- `GET /risk_scores/<user_id>` - Get risk score for a user

## Usage

1. Start both the Flask API and React frontend servers
2. Open http://localhost:5173 in your browser
3. Use the dashboard to view statistics
4. Navigate to Users to add new beneficiaries
5. Navigate to Applications to submit scheme applications
6. View available schemes in the Schemes section

## Sample Data

The system comes with sample data including:
- 2 sample users (John Doe and Jane Smith)
- 3 sample schemes (Mid-Day Meal, Ayushman Bharat, PM Kisan)
- Scheme categories (Education, Health, Poverty)

## Technologies Used

- Backend: Flask, SQLAlchemy, SQLite
- Frontend: React, PrimeReact, Axios
- UI Framework: PrimeFlex for responsive design