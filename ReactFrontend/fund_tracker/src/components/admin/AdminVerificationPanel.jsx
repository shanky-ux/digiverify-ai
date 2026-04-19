import { useState, useEffect, useCallback } from 'react';
import api from '../../api';

const STATUS_LABEL = {
  pending:       { label: 'Pending Review', color: '#f59e0b', bg: '#fffbeb' },
  pending_video: { label: 'Awaiting Video', color: '#3b82f6', bg: '#eff6ff' },
  approved:      { label: 'Approved',       color: '#22c55e', bg: '#f0fdf4' },
  rejected:      { label: 'Rejected',       color: '#ef4444', bg: '#fef2f2' },
};

const TABS = ['All Verifications', 'Pending Video Calls', 'Completed'];
const TAB_ICONS = ['pi-list', 'pi-video', 'pi-check-circle'];

export default function AdminVerificationPanel() {
  const [tab,       setTab]      = useState(0);
  const [verifs,    setVerifs]   = useState([]);
  const [pendVid,   setPendVid]  = useState([]);
  const [done,      setDone]     = useState([]);
  const [loading,   setLoading]  = useState(false);
  const [selected,  setSelected] = useState(null);  // full detail view
  const [remarks,   setRemarks]  = useState('');
  const [acting,    setActing]   = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [allR, vidR] = await Promise.all([
        api.get('/admin/verifications'),
        api.get('/admin/verifications/pending-video'),
      ]);
      const all = allR.data || [];
      setVerifs(all);
      setPendVid(vidR.data || []);
      setDone(all.filter(v => v.status === 'approved' || v.status === 'rejected'));
    } catch (e) {
      console.error('Failed to load verifications', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Poll every 10 s for live updates
    const t = setInterval(fetchAll, 10000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const act = async (endpoint, payload = {}) => {
    if (!selected) return;
    setActing(true);
    try {
      await api.put(`/admin/verifications/${selected.id}/${endpoint}`, payload);
      await fetchAll();
      setSelected(null);
      setRemarks('');
    } catch (e) {
      alert(e.response?.data?.error || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const currentList = tab === 0 ? verifs : tab === 1 ? pendVid : done;
  const BASE_URL = 'http://localhost:5000';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.8rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          <i className="pi pi-shield" style={{ marginRight: 8 }} />Verification Management
        </h1>
        <p style={{ color: '#64748b', marginTop: 6 }}>
          Review beneficiary documents, conduct video calls, and approve or reject identities.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total',         value: verifs.length,                                icon: 'pi-folder', color: '#6366f1' },
          { label: 'Pending Review',value: verifs.filter(v=>v.status==='pending').length, icon: 'pi-clock', color: '#f59e0b' },
          { label: 'Video Queue',   value: pendVid.length,                               icon: 'pi-video', color: '#3b82f6' },
          { label: 'Approved',      value: done.filter(v=>v.status==='approved').length,  icon: 'pi-check-circle', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: 14, padding: '1.2rem 1.4rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
          }}>
            <div><i className={`pi ${s.icon}`} style={{ fontSize: 24, color: s.color }} /></div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === i ? '#fff' : 'transparent',
            color: tab === i ? '#0f172a' : '#64748b',
            fontWeight: tab === i ? 700 : 500, fontSize: 13,
            boxShadow: tab === i ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}><i className={`pi ${TAB_ICONS[i]}`} style={{ marginRight: 6, fontSize: 13 }} />{t}</button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading verifications…</div>
      ) : currentList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc',
          borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          No records in this category.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Beneficiary', 'Aadhaar', 'Type', 'Status', 'Match', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12,
                    fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentList.map((v, idx) => {
                const st = STATUS_LABEL[v.status] || { label: v.status, color: '#6b7280', bg: '#f9fafb' };
                return (
                  <tr key={v.id} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: selected?.id === v.id ? '#eff6ff' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    <td style={td}>{idx + 1}</td>
                    <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{v.user_name}</td>
                    <td style={{ ...td, fontSize: 12, fontFamily: 'monospace' }}>
                      XXXX-XXXX-{(v.aadhaar_number || '????').slice(-4)}
                    </td>
                    <td style={td}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        background: v.beneficiary_type === 'alive' ? '#dcfce7' : '#f1f5f9',
                        color: v.beneficiary_type === 'alive' ? '#166534' : '#475569',
                      }}>
                        <><i className={`pi ${v.beneficiary_type === 'alive' ? 'pi-user' : 'pi-file'}`} style={{ marginRight: 4, fontSize: 12 }} />{v.beneficiary_type === 'alive' ? 'Alive' : 'Deceased'}</>
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                        background: st.bg, color: st.color,
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700,
                      color: v.match_score >= 70 ? '#22c55e' : v.match_score >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {v.match_score != null ? `${v.match_score}%` : '—'}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#94a3b8' }}>
                      {v.created_at ? v.created_at.slice(0, 10) : '—'}
                    </td>
                    <td style={td}>
                      <button onClick={() => { setSelected(v); setRemarks(''); }} style={actionBtn('#3b82f6')}>
                        <i className="pi pi-search" style={{ marginRight: 4, fontSize: 11 }} />Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail / action drawer */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '92%', maxWidth: 680,
            maxHeight: '90vh', overflowY: 'auto', padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontWeight: 800, color: '#0f172a', margin: 0, fontSize: '1.25rem' }}>
                  Reviewing: {selected.user_name}
                </h2>
                <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>
                  Aadhaar: XXXX-XXXX-{(selected.aadhaar_number||'????').slice(-4)} &nbsp;|&nbsp;
                  Type: {selected.beneficiary_type}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px',
                cursor: 'pointer', fontSize: 16,
              }}><i className="pi pi-times" style={{ fontSize: 14 }} /></button>
            </div>

            {/* Documents */}
            <h3 style={sectionHead}><i className="pi pi-folder-open" style={{ marginRight: 6 }} />Uploaded Documents</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {selected.beneficiary_type === 'alive' && (
                <>
                  <DocThumb label="Aadhaar Card"  path={selected.aadhaar_doc_path} base={BASE_URL} />
                  <DocThumb label="PAN Card"      path={selected.pan_doc_path}     base={BASE_URL} />
                  <DocThumb label="Selfie"         path={selected.selfie_path}      base={BASE_URL} isImage />
                </>
              )}
              {selected.beneficiary_type === 'deceased' && (
                <DocThumb label="Death Certificate" path={selected.death_cert_path} base={BASE_URL} />
              )}
            </div>

            {/* Details row */}
            {selected.pan_number && (
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
                <strong>PAN Number:</strong> <span style={{ fontFamily: 'monospace' }}>{selected.pan_number}</span>
              </p>
            )}
            {selected.match_score != null && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Photo match score</span>
                  <strong style={{
                    color: selected.match_score >= 70 ? '#22c55e' : selected.match_score >= 40 ? '#f59e0b' : '#ef4444',
                  }}>{selected.match_score}%</strong>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: 99, height: 10 }}>
                  <div style={{
                    height: 10, borderRadius: 99, width: `${selected.match_score}%`,
                    background: selected.match_score >= 70 ? '#22c55e' : selected.match_score >= 40 ? '#f59e0b' : '#ef4444',
                  }} />
                </div>
              </div>
            )}

            {/* Video call */}
            {selected.video_room_url && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: '#eff6ff',
                borderRadius: 10, border: '1px solid #bfdbfe' }}>
                <h4 style={{ margin: '0 0 8px', color: '#1d4ed8', fontSize: 14 }}><i className="pi pi-video" style={{ marginRight: 6 }} />Video Call Room</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  Status: <strong>{selected.video_status}</strong>
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <a href={selected.video_room_url} target="_blank" rel="noreferrer" style={{
                    padding: '8px 18px', borderRadius: 8, background: '#1d4ed8', color: '#fff',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    <i className="pi pi-video" style={{ marginRight: 4 }} />Join Video Call
                  </a>
                  <button onClick={() => act('video-result', { passed: true, remarks })}
                    disabled={acting} style={actionBtn('#22c55e')}>
                    <i className="pi pi-check" style={{ marginRight: 4 }} />Mark Video Passed
                  </button>
                  <button onClick={() => act('video-result', { passed: false, remarks })}
                    disabled={acting} style={actionBtn('#ef4444')}>
                    <i className="pi pi-times" style={{ marginRight: 4 }} />Mark Video Failed
                  </button>
                </div>
              </div>
            )}

            {/* Admin remarks */}
            <h3 style={sectionHead}><i className="pi pi-pencil" style={{ marginRight: 6 }} />Admin Remarks</h3>
            <textarea
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional remarks for the beneficiary…"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                border: '1.5px solid #cbd5e1', outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', marginBottom: 16,
              }}
            />

            {/* Action buttons */}
            {(selected.status === 'pending' || selected.status === 'pending_video') && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => act('approve', { remarks })} disabled={acting}
                  style={{ ...bigBtn, background: '#22c55e' }}>
                  {acting ? <i className="pi pi-spin pi-spinner" /> : <><i className="pi pi-check-circle" style={{ marginRight: 4 }} />Approve Verification</>}
                </button>
                <button onClick={() => act('reject', { remarks })} disabled={acting}
                  style={{ ...bigBtn, background: '#ef4444' }}>
                  {acting ? <i className="pi pi-spin pi-spinner" /> : <><i className="pi pi-times-circle" style={{ marginRight: 4 }} />Reject Verification</>}
                </button>
              </div>
            )}

            {selected.admin_remarks && (selected.status === 'approved' || selected.status === 'rejected') && (
              <div style={{ textAlign: 'center', padding: '12px 0',
                color: selected.status === 'approved' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {selected.status === 'approved' ? <><i className="pi pi-check-circle" style={{ marginRight: 6 }} />This verification is already APPROVED.</> : <><i className="pi pi-times-circle" style={{ marginRight: 6 }} />This verification was REJECTED.</>}
                {selected.admin_remarks && <p style={{ fontSize: 13, fontWeight: 400, color: '#64748b' }}>{selected.admin_remarks}</p>}
              </div>
            )}

            {/* Blockchain certificate */}
            {selected.block_hash && (
              <div style={{
                marginTop: 4, padding: '12px 14px',
                background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                border: '1.5px solid #22c55e', borderRadius: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <i className="pi pi-link" style={{ fontSize: 18, color: '#166534' }} />
                  <span style={{ fontWeight: 800, color: '#166534', fontSize: 13 }}>Blockchain Certificate</span>
                  <span style={{
                    padding: '2px 8px', background: '#22c55e', color: '#fff',
                    borderRadius: 99, fontSize: 10, fontWeight: 700,
                  }}>Block #{selected.block_index}</span>
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 11, color: '#166534',
                  wordBreak: 'break-all', background: 'rgba(255,255,255,0.5)',
                  padding: '6px 10px', borderRadius: 8,
                }}>{selected.block_hash}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function DocThumb({ label, path, base, isImage }) {
  if (!path) return (
    <div style={{ border: '2px dashed #e2e8f0', borderRadius: 10, padding: 16,
      textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
      <div><i className="pi pi-inbox" style={{ fontSize: 24, color: '#94a3b8' }} /></div>
      {label}: Not uploaded
    </div>
  );
  const url = path.startsWith('http') ? path : `${base}/${path}`;
  const isPdf = path.endsWith('.pdf');
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: '#f8fafc', padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>
        {label}
      </div>
      {isPdf
        ? (
          <a href={url} target="_blank" rel="noreferrer" style={{
            display: 'block', padding: 16, textAlign: 'center', fontSize: 12, color: '#3b82f6',
          }}>
            <i className="pi pi-file-pdf" style={{ marginRight: 4 }} />View PDF
          </a>
        )
        : (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={label} style={{ width: '100%', maxHeight: 110, objectFit: 'cover', display: 'block' }} />
          </a>
        )
      }
    </div>
  );
}

const td          = { padding: '12px 14px', fontSize: 13, color: '#374151', verticalAlign: 'middle' };
const sectionHead = { fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 };
const bigBtn      = {
  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', color: '#fff',
  fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'opacity 0.15s',
};
const actionBtn = (bg) => ({
  padding: '6px 14px', borderRadius: 8, border: 'none', background: bg,
  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
});
