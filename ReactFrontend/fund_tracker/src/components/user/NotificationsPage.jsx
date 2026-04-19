import { useEffect, useState } from 'react';
import api from '../../api';
import Badge from '../shared/Badge';
import SectionCard from '../shared/SectionCard';
import Loader from '../shared/Loader';

export default function NotificationsPage({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/notifications/${user.user_id}`)
      .then((r) => setNotifications(r.data))
      .finally(() => setLoading(false));
  }, [user]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAll = async () => {
    await Promise.all(notifications.filter((n) => !n.is_read).map((n) => api.put(`/notifications/${n.id}/read`)));
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) return <Loader message="Loading notifications..." />;

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0d3a66' }}>Notifications</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>{unread} unread notification{unread !== 1 ? 's' : ''}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} style={{
            background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 6,
            padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>Mark All Read</button>
        )}
      </div>

      <SectionCard>
        {notifications.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '1rem 0', textAlign: 'center' }}>
            No notifications at this time.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((n) => (
              <div key={n.id} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '14px 16px',
                background: n.is_read ? '#f8fafc' : '#fff7e6',
                border: `1.5px solid ${n.is_read ? '#e2e8f0' : '#fde68a'}`,
                borderRadius: 9,
              }}>
                {/* Dot indicator */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                  background: n.is_read ? '#cbd5e1' : '#f59e0b',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 600, color: '#1e293b' }}>
                    {n.message}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge value={n.type} />
                    {n.created_at && (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} style={{
                    background: '#fff', color: '#0d6efd', border: '1.5px solid #0d6efd',
                    borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>Mark Read</button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
