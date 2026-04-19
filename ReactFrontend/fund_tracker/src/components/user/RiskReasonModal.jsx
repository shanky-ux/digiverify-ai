import { useState } from 'react';
import api from '../../api';
import Badge from '../shared/Badge';
import Loader from '../shared/Loader';
import Btn from '../shared/Btn';

export default function RiskReasonModal({ scheme, onClose }) {
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/schemes/${scheme.id}/risk_reason`);
      setReason(res.data.reason);
    } catch {
      setReason('Unable to fetch risk reasoning at this time.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13,58,102,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 520, maxWidth: '95vw',
        boxShadow: '0 8px 40px rgba(13,58,102,0.25)', padding: '2rem',
        border: '2px solid #bde0ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#0d3a66' }}>BERT Risk Reasoning</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8',
          }}>x</button>
        </div>
        <div style={{
          background: '#f0f8ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          border: '1px solid #bde0ff',
        }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Scheme</div>
          <div style={{ fontWeight: 700, color: '#0d3a66', fontSize: 16 }}>{scheme.name}</div>
          <div style={{ marginTop: 4 }}><Badge value={scheme.benefit_type} /></div>
        </div>

        {!reason && !loading && (
          <Btn onClick={fetch} variant="primary" style={{ width: '100%' }}>
            Run BERT Risk Analysis
          </Btn>
        )}

        {loading && <Loader message="Running BERT model analysis..." />}

        {reason && (
          <div style={{
            background: '#f0fff4', border: '1px solid #6ee7b7', borderRadius: 8,
            padding: '14px 16px', fontSize: 14, color: '#1e293b', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: '#1a7f2e', marginBottom: 8, fontSize: 13 }}>AI Risk Analysis:</div>
            {reason}
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Btn onClick={onClose} variant="outline">Close</Btn>
        </div>
      </div>
    </div>
  );
}
