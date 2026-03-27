import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export default function Login({ onLogin }) {
  const [aadhaar, setAadhaar] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const login = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { aadhaar_number: aadhaar, email });
      onLogin(response.data);
    } catch (err) {
      setError('Invalid Aadhaar or email. Please try again.');
    }
  };

  return (
    <div className="login-card p-4 rounded shadow-2">
      <h2>Login</h2>
      <label>Aadhaar</label>
      <input className="p-inputtext p-component" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
      <label>Email</label>
      <input className="p-inputtext p-component" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="p-button p-button-primary mt-2" onClick={login}>Sign In</button>
      {error && <div className="error-message mt-2">{error}</div>}
    </div>
  );
}
