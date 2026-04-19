import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import UserVerification from './pages/UserVerification';
import AdminPanel from './pages/AdminPanel';
import BeneficiaryDetail from './pages/BeneficiaryDetail';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <ToastContainer position="top-right" autoClose={4000} />
        <Routes>
          <Route path="/" element={<UserVerification />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/beneficiary/:aadhaarId" element={<BeneficiaryDetail />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
