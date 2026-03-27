import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export default function UserDashboard({ user }) {
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const load = async () => {
      const apps = await axios.get(`${API_BASE_URL}/users/${user.user_id}/applications`);
      setApplications(apps.data);
      const notes = await axios.get(`${API_BASE_URL}/notifications/${user.user_id}`);
      setNotifications(notes.data);
    };
    load();
  }, [user]);

  return (
    <div>
      <h2>User Dashboard</h2>
      <div className="card p-3 mb-3">
        <strong>Welcome:</strong> {user.full_name}<br />
        <strong>Aadhaar:</strong> {user.aadhaar_number}
      </div>

      <div className="card p-3 mb-3">
        <h3>Notifications</h3>
        {notifications.length === 0 ? (<p>No notifications</p>) : (
          notifications.map((n) => (<div key={n.id} className="note-item p-2 mb-1">{n.message}</div>))
        )}
      </div>

      <div className="card p-3">
        <h3>Your Applications</h3>
        <table className="p-datatable p-component">
          <thead>
            <tr><th>ID</th><th>Scheme</th><th>Status</th><th>Submitted</th></tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.scheme_id}</td>
                <td>{a.status}</td>
                <td>{a.submitted_at || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
