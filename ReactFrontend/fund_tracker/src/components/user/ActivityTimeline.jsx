import { useEffect, useState } from 'react';
import api from '../../api';
import Loader from '../shared/Loader';
import Badge from '../shared/Badge';

const typeConfig = {
  application: { icon: 'pi-file', color: '#0d6efd', bg: '#e8f4ff', label: 'Application' },
  review:       { icon: 'pi-check-circle', color: '#27ae60', bg: '#e6f9ee', label: 'Review' },
  disbursement: { icon: 'pi-wallet', color: '#27ae60', bg: '#e6f9ee', label: 'Payment' },
  notification: { icon: 'pi-bell', color: '#f59e0b', bg: '#fefce8', label: 'Notification' },
  access:       { icon: 'pi-eye', color: '#8b5cf6', bg: '#ede9fe', label: 'Access' },
};

const statusMap = {
  approved: 'approved', rejected: 'rejected', submitted: 'submitted',
  under_review: 'under_review', processed: 'approved', pending: 'submitted',
  read: 'approved', unread: 'submitted', completed: 'approved',
};

export default function ActivityTimeline({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    api.get(`/users/${user.user_id}/timeline`)
      .then(r => setEvents(r.data))
      .finally(() => setLoading(false));
  }, [user.user_id]);

  if (loading) return <Loader message="Loading activity timeline..." />;

  const filtered = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter);
  const counts = {};
  events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d3a66, #1565c0)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem', color: '#fff',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Activity Timeline</div>
        <div style={{ opacity: 0.8, fontSize: 14, marginTop: 4 }}>
          Complete history of your scheme interactions, payments, and notifications
        </div>
        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(typeConfig).map(([key, cfg]) => (
            <div key={key} style={{ fontSize: 13 }}>
              <span style={{ opacity: 0.7 }}><i className={`pi ${cfg.icon}`} style={{ marginRight: 4, fontSize: 12 }} />{cfg.label}: </span>
              <strong>{counts[key] || 0}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['all', 'All Events', events.length], ...Object.entries(typeConfig).map(([k, v]) => [k, v.label, counts[k] || 0])].map(([val, label, count]) => (
          <button key={val} onClick={() => setTypeFilter(val)} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: typeFilter === val ? '#0d6efd' : '#e8f4ff',
            color: typeFilter === val ? '#fff' : '#0d6efd',
            fontWeight: 600, fontSize: 12,
          }}>
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem' }}>No events found.</div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 21, top: 0, bottom: 0,
            width: 2, background: '#bde0ff', zIndex: 0,
          }} />

          {filtered.map((event, i) => {
            const cfg = typeConfig[event.type] || typeConfig.notification;
            return (
              <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', position: 'relative' }}>
                {/* Icon circle */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: cfg.bg, border: `2px solid ${cfg.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0, zIndex: 1,
                  boxShadow: '0 0 0 4px #f0f6ff',
                }}>
                  <i className={`pi ${cfg.icon}`} style={{ fontSize: 18 }} />
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, background: '#fff', borderRadius: 10, padding: '12px 16px',
                  border: '1.5px solid #e2e8f0',
                  borderLeft: `4px solid ${cfg.color}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, color: '#0d3a66', fontSize: 14 }}>{event.title}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {event.status && <Badge value={statusMap[event.status] || event.status} />}
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {event.date ? event.date.split(' ')[0] : '–'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{event.description}</div>
                  {event.amount != null && event.amount > 0 && (
                    <div style={{ marginTop: 6, fontWeight: 800, fontSize: 16, color: '#27ae60' }}>
                      +₹{event.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  )}
                  <div style={{
                    display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700,
                    color: cfg.color, background: cfg.bg, borderRadius: 4, padding: '1px 7px',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {cfg.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
