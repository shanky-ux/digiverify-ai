import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import Login from './components/Login';
import Navbar from './components/shared/Navbar';
import UserDashboard from './components/UserDashboard';
import SchemeList from './components/SchemeList';
import MyApplications from './components/user/MyApplications';
import NotificationsPage from './components/user/NotificationsPage';
import UserProfile from './components/user/UserProfile';
import BenefitHistory from './components/user/BenefitHistory';
import MLInsightsPage from './components/user/MLInsightsPage';
import ActivityTimeline from './components/user/ActivityTimeline';
import AdminDashboard from './components/AdminDashboard';
import AdminSchemesPage from './components/admin/AdminSchemesPage';
import AdminUsersPage from './components/admin/AdminUsersPage';
import SchemeUsersPage from './components/admin/SchemeUsersPage';
import AdminVerificationPanel from './components/admin/AdminVerificationPanel';
import VerificationPage from './components/user/VerificationPage';
import BlockchainExplorer from './components/shared/BlockchainExplorer';
import AIAssistant from './components/shared/AIAssistant';

function Layout({ user, onLogout, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f6ff 0%, #e8f4ff 50%, #f0fff4 100%)' }}>
      <Navbar user={user} onLogout={onLogout} />
      <main style={{ width: '100%', padding: '2rem 2.5rem' }}>
        {children}
      </main>
      <AIAssistant user={user} />
    </div>
  );
}

function UserRoutes({ user, onLogout }) {
  return (
    <Layout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/dashboard" element={<UserDashboard user={user} />} />
        <Route path="/schemes" element={<SchemeList user={user} />} />
        <Route path="/my-applications" element={<MyApplications user={user} />} />
        <Route path="/benefit-history" element={<BenefitHistory user={user} />} />
        <Route path="/timeline" element={<ActivityTimeline user={user} />} />
        <Route path="/ml-insights" element={<MLInsightsPage user={user} />} />
        <Route path="/profile" element={<UserProfile user={user} />} />
        <Route path="/notifications" element={<NotificationsPage user={user} />} />
        <Route path="/verify" element={<VerificationPage user={user} />} />
        <Route path="/blockchain" element={<BlockchainExplorer user={user} />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Layout>
  );
}

function AdminRoutes({ user, onLogout }) {
  return (
    <Layout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/schemes" element={<AdminSchemesPage />} />
        <Route path="/admin/schemes/:schemeId" element={<SchemeUsersPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/verifications" element={<AdminVerificationPanel />} />
        <Route path="/blockchain" element={<BlockchainExplorer user={user} />} />
        <Route path="*" element={<Navigate to="/admin" />} />
      </Routes>
    </Layout>
  );
}

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => setUser(userData);
  const handleLogout = () => setUser(null);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      {user.is_admin
        ? <AdminRoutes user={user} onLogout={handleLogout} />
        : <UserRoutes user={user} onLogout={handleLogout} />
      }
    </Router>
  );
}

export default App;

