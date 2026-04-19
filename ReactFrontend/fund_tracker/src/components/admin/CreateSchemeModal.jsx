import { useState } from 'react';
import api from '../../api';
import Btn from '../shared/Btn';

const inp = {
  width: '100%', padding: '8px 12px', border: '1.5px solid #93c5fd',
  borderRadius: 6, fontSize: 14, outline: 'none', background: '#f0f8ff',
  boxSizing: 'border-box', marginTop: 4, marginBottom: 12,
};
const lbl = { fontSize: 13, fontWeight: 600, color: '#0d3a66', display: 'block' };

const CATEGORIES = ['Education', 'Health', 'Agriculture', 'Housing', 'Employment',
                    'Women & Child', 'Senior Citizen', 'Disability', 'Skill Development'];

export default function CreateSchemeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', category: 'Education', eligibility_criteria: '',
    benefit_type: 'cash', min_age: '', max_income: '', gender_required: '',
    category_required: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { setError('Scheme name is required.'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        ...form,
        min_age: form.min_age ? parseInt(form.min_age) : null,
        max_income: form.max_income ? parseFloat(form.max_income) : null,
        gender_required: form.gender_required || null,
        category_required: form.category_required || null,
      };
      const res = await api.post('/schemes', payload);
      onCreated(res.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create scheme.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13,58,102,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 560, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(13,58,102,0.25)', padding: '2rem',
        border: '2px solid #bde0ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#0d3a66', fontSize: 18 }}>Create New Scheme</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>x</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Scheme Name *</label>
            <input style={inp} placeholder="e.g. PM Ujjwala Yojana" value={form.name} onChange={set('name')} />
          </div>

          <div>
            <label style={lbl}>Category</label>
            <select style={{ ...inp }} value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Benefit Type</label>
            <select style={{ ...inp }} value={form.benefit_type} onChange={set('benefit_type')}>
              <option value="cash">Cash</option>
              <option value="service">Service</option>
              <option value="in-kind">In-Kind</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Eligibility Criteria</label>
            <textarea
              style={{ ...inp, height: 72, resize: 'vertical' }}
              placeholder="Describe eligibility requirements..."
              value={form.eligibility_criteria}
              onChange={set('eligibility_criteria')}
            />
          </div>

          <div>
            <label style={lbl}>Minimum Age</label>
            <input style={inp} type="number" placeholder="e.g. 18" value={form.min_age} onChange={set('min_age')} />
          </div>

          <div>
            <label style={lbl}>Max Annual Income (₹)</label>
            <input style={inp} type="number" placeholder="e.g. 200000" value={form.max_income} onChange={set('max_income')} />
          </div>

          <div>
            <label style={lbl}>Gender Required</label>
            <select style={{ ...inp }} value={form.gender_required} onChange={set('gender_required')}>
              <option value="">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label style={lbl}>Category Required</label>
            <select style={{ ...inp }} value={form.category_required} onChange={set('category_required')}>
              <option value="">Any</option>
              <option value="BPL">BPL</option>
              <option value="APL">APL</option>
              <option value="AAY">AAY</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Scheme'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
