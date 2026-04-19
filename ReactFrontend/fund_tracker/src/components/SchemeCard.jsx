import { useState } from 'react';
import api from '../api';
import Badge from './shared/Badge';
import Btn from './shared/Btn';
import RiskReasonModal from './user/RiskReasonModal';

export default function SchemeCard({ scheme, user, onApplied, alreadyApplied }) {
  const [msg, setMsg] = useState('');
  const [applying, setApplying] = useState(false);
  const [showRisk, setShowRisk] = useState(false);

  const apply = async () => {
    setApplying(true);
    try {
      await api.post(`/users/${user.user_id}/apply`, { scheme_id: scheme.id });
      setMsg('success');
      if (onApplied) onApplied(scheme.id);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to apply');
    } finally { setApplying(false); }
  };

  return (
    <>
      <div style={{
        background: '#fff', border: '1.5px solid #bde0ff', borderRadius: 10,
        padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 1px 6px rgba(13,110,253,0.07)', height: '100%',
      }}>
        {/* Category tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 }}>
            {scheme.category}
          </span>
          <Badge value={scheme.benefit_type} />
        </div>

        <div style={{ fontWeight: 700, fontSize: 16, color: '#0d3a66' }}>{scheme.name}</div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, flex: 1 }}>{scheme.eligibility_criteria}</div>

        {/* Rules */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {scheme.min_age && (
            <span style={{ background: '#e8f4ff', color: '#0d6efd', borderRadius: 5, padding: '2px 8px', fontSize: 12 }}>
              Min age: {scheme.min_age}
            </span>
          )}
          {scheme.max_income && (
            <span style={{ background: '#e6f9ee', color: '#1a7f2e', borderRadius: 5, padding: '2px 8px', fontSize: 12 }}>
              Max Income: {scheme.max_income.toLocaleString()}
            </span>
          )}
          {scheme.gender_required && (
            <span style={{ background: '#fff7e6', color: '#b45309', borderRadius: 5, padding: '2px 8px', fontSize: 12 }}>
              {scheme.gender_required}
            </span>
          )}
        </div>

        {/* Feedback */}
        {msg === 'success' && (
          <div style={{ background: '#e6f9ee', color: '#1a7f2e', border: '1px solid #6ee7b7', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
            Application submitted successfully!
          </div>
        )}
        {msg && msg !== 'success' && (
          <div style={{ background: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
            {msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Btn
            variant={alreadyApplied ? 'ghost' : 'success'}
            disabled={alreadyApplied || applying || msg === 'success'}
            onClick={apply}
          >
            {alreadyApplied ? 'Applied' : applying ? 'Applying...' : 'Apply'}
          </Btn>
          <Btn variant="outline" onClick={() => setShowRisk(true)}>
            Risk Analysis
          </Btn>
        </div>
      </div>

      {showRisk && <RiskReasonModal scheme={scheme} onClose={() => setShowRisk(false)} />}
    </>
  );
}
