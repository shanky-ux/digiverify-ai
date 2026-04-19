import { useEffect, useState } from 'react';
import api from '../api';
import SchemeCard from './SchemeCard';
import Loader from './shared/Loader';

const CATEGORIES = ['All', 'Education', 'Health', 'Agriculture', 'Housing', 'Employment'];

export default function SchemeList({ user }) {
  const [schemes, setSchemes] = useState([]);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [sc, apps] = await Promise.all([
          api.get('/schemes/detailed'),
          api.get(`/users/${user.user_id}/applications`),
        ]);
        setSchemes(sc.data);
        setAppliedIds(new Set(apps.data.map((a) => a.scheme_id)));
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (loading) return <Loader message="Loading schemes..." />;

  const filtered = schemes.filter((s) =>
    (filter === 'All' || s.category === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.eligibility_criteria?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#0d3a66' }}>Browse Schemes</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0' }}>{filtered.length} scheme{filtered.length !== 1 ? 's' : ''} available</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <input
          placeholder="Search by name or eligibility..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 7, border: '1.5px solid #93c5fd',
            fontSize: 14, minWidth: 240, outline: 'none', background: '#f0f8ff',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: '1.5px solid',
              borderColor: filter === cat ? '#0d6efd' : '#e2e8f0',
              background: filter === cat ? '#0d6efd' : '#fff',
              color: filter === cat ? '#fff' : '#64748b',
              cursor: 'pointer',
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>No schemes match your search.</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.2rem',
        }}>
          {filtered.map((s) => (
            <SchemeCard
              key={s.id}
              scheme={s}
              user={user}
              alreadyApplied={appliedIds.has(s.id)}
              onApplied={(id) => setAppliedIds((prev) => new Set([...prev, id]))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

