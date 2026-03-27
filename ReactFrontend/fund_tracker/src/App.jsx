import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';

import Login from './components/Login';
import UserDashboard from './components/UserDashboard';
import SchemeList from './components/SchemeList';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <div className="App bg-white text-black">
        <header className="header p-3 bg-blue-600 text-white">
          <div className="container flex justify-content-between align-items-center">
            <h2>Welfare Access Portal</h2>
            <div className="nav-links">
              <Link className="link" to="/">Dashboard</Link>
              <Link className="link" to="/schemes">Schemes</Link>
              <Link className="link" to="/admin">Admin</Link>
              <button className="p-button p-button-danger" onClick={() => setUser(null)}>Logout</button>
            </div>
          </div>
        </header>

        <main className="container mt-4">
          <Routes>
            <Route path="/" element={<UserDashboard user={user} />} />
            <Route path="/schemes" element={<SchemeList user={user} />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
