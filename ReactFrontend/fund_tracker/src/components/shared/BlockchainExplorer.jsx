/**
 * BlockchainExplorer — DigiVerify immutable audit trail
 *
 * Displays the on-chain record of every identity verification event,
 * scheme application, and admin action. Allows hash verification.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../api';

/* ── Event type metadata ───────────────────────────────────────────────────── */
const TYPE_META = {
  GENESIS:                     { label: 'Genesis',           color: '#6366f1', bg: '#eef2ff', icon: 'pi-link' },
  VERIFICATION_SUBMITTED:      { label: 'Docs Submitted',    color: '#f59e0b', bg: '#fffbeb', icon: 'pi-file' },
  VERIFICATION_APPROVED:       { label: 'ID Approved',       color: '#22c55e', bg: '#f0fdf4', icon: 'pi-check-circle' },
  VERIFICATION_REJECTED:       { label: 'ID Rejected',       color: '#ef4444', bg: '#fef2f2', icon: 'pi-times-circle' },
  VIDEO_VERIFICATION_PASSED:   { label: 'Video Passed',      color: '#10b981', bg: '#ecfdf5', icon: 'pi-video' },
  VIDEO_VERIFICATION_FAILED:   { label: 'Video Failed',      color: '#dc2626', bg: '#fef2f2', icon: 'pi-ban' },
  APPLICATION_SUBMITTED:       { label: 'Scheme Applied',    color: '#3b82f6', bg: '#eff6ff', icon: 'pi-file' },
  APPLICATION_APPROVED:        { label: 'Scheme Approved',   color: '#16a34a', bg: '#f0fdf4', icon: 'pi-star' },
  APPLICATION_REJECTED:        { label: 'Scheme Rejected',   color: '#b91c1c', bg: '#fef2f2', icon: 'pi-ban' },
};

const typeMeta = (type) => TYPE_META[type] || { label: type || 'Unknown', color: '#64748b', bg: '#f8fafc', icon: 'pi-question-circle' };

export default function BlockchainExplorer({ user }) {
  const [stats,      setStats]      = useState(null);
  const [chain,      setChain]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [online,     setOnline]     = useState(true);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying,  setVerifying]  = useState(false);
  const [expanded,   setExpanded]   = useState(null);    // block index
  const [filter,     setFilter]     = useState('ALL');
  const [userFilter, setUserFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const [statsR, blocksR] = await Promise.all([
        api.get('/blockchain/stats'),
        api.get('/blockchain/blocks'),
      ]);
      setStats(statsR.data);
      setChain((blocksR.data.chain || []).slice().reverse()); // newest first
      setOnline(true);
    } catch (e) {
      if (e.response?.data?.online === false || e.response?.status === 503) {
        setOnline(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const handleVerify = async () => {
    if (!verifyHash.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await api.get(`/blockchain/verify/${verifyHash.trim()}`);
      setVerifyResult(r.data);
    } catch {
      setVerifyResult({ valid: false, message: 'Verification request failed' });
    } finally {
      setVerifying(false);
    }
  };

  // Filtered chain
  const filteredChain = chain.filter(b => {
    const type = b.record?.type || 'GENESIS';
    const uid  = b.record?.userId;
    if (filter !== 'ALL' && type !== filter) return false;
    if (userFilter && uid && !String(uid).includes(userFilter)) return false;
    return true;
  });

  if (!online) return <OfflinePanel />;
  if (loading)  return (
    <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
      <i className="pi pi-link" style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
      <p>Loading blockchain…</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '2rem 1rem' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <i className="pi pi-link" style={{ fontSize: 38 }} />
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              DigiVerify Blockchain
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
              Immutable audit trail — every verification event is mined with Proof-of-Work (SHA256)
              and signed with secp256k1 ECDSA.
            </p>
          </div>
          {stats?.isValid !== undefined && (
            <div style={{
              marginLeft: 'auto', padding: '8px 18px', borderRadius: 99,
              background: stats.isValid ? '#f0fdf4' : '#fef2f2',
              border: `2px solid ${stats.isValid ? '#22c55e' : '#ef4444'}`,
              color: stats.isValid ? '#166534' : '#dc2626',
              fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap',
            }}>
              {stats.isValid ? <><i className="pi pi-check" style={{ marginRight: 4 }} /> Chain Valid</> : <><i className="pi pi-exclamation-triangle" style={{ marginRight: 4 }} /> TAMPERED</>}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Blocks',    value: stats.chainLength,                              icon: 'pi-box', color: '#6366f1' },
            { label: 'Verifications',   value: (stats.byType?.VERIFICATION_APPROVED || 0) + (stats.byType?.VIDEO_VERIFICATION_PASSED || 0), icon: 'pi-check-circle', color: '#22c55e' },
            { label: 'Doc Submissions', value: stats.byType?.VERIFICATION_SUBMITTED || 0,      icon: 'pi-file', color: '#f59e0b' },
            { label: 'Rejections',      value: (stats.byType?.VERIFICATION_REJECTED || 0) + (stats.byType?.VIDEO_VERIFICATION_FAILED || 0), icon: 'pi-times-circle', color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 14, padding: '1.1rem 1.3rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0',
            }}>
              <i className={`pi ${s.icon}`} style={{ fontSize: 28, color: s.color }} />
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Hash verifier ───────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '1.4rem 1.6rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', marginBottom: 24,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
          <i className="pi pi-search" style={{ marginRight: 6 }} /> Verify a Certificate Hash
        </h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Paste a block hash to verify it exists on the blockchain…"
            value={verifyHash}
            onChange={e => setVerifyHash(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 13,
              fontFamily: 'monospace', border: '1.5px solid #cbd5e1', outline: 'none',
            }}
          />
          <button onClick={handleVerify} disabled={!verifyHash.trim() || verifying} style={{
            padding: '11px 22px', borderRadius: 10, background: verifyHash.trim() ? '#3b82f6' : '#e2e8f0',
            color: verifyHash.trim() ? '#fff' : '#94a3b8', border: 'none',
            fontWeight: 700, fontSize: 14, cursor: verifyHash.trim() ? 'pointer' : 'not-allowed',
          }}>
            {verifying ? <i className="pi pi-spin pi-spinner" /> : 'Verify →'}
          </button>
        </div>
        {verifyResult && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 10,
            background: verifyResult.valid ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${verifyResult.valid ? '#bbf7d0' : '#fecaca'}`,
            color: verifyResult.valid ? '#166534' : '#dc2626', fontSize: 13,
          }}>
            {verifyResult.valid ? (
              <>
                <strong><i className="pi pi-check" style={{ marginRight: 4 }} /> VALID</strong> — Block #{verifyResult.blockIndex}, mined {new Date(verifyResult.timestamp).toLocaleString('en-IN')}<br />
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  Event type: <strong>{verifyResult.record?.type}</strong> &nbsp;|&nbsp;
                  User ID: <strong>{verifyResult.record?.userId}</strong>
                </span>
              </>
            ) : (
              <><strong><i className="pi pi-times" style={{ marginRight: 4 }} /> INVALID</strong> — {verifyResult.message}</>
            )}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['ALL', ...Object.keys(TYPE_META)].map(t => {
            const m = typeMeta(t === 'ALL' ? 'ALL' : t);
            const active = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)} style={{
                padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: 'none',
                background: active ? (t === 'ALL' ? '#0f172a' : m.bg) : '#f1f5f9',
                color: active ? (t === 'ALL' ? '#fff' : m.color) : '#64748b',
                fontWeight: active ? 700 : 500,
              }}>
                {t === 'ALL' ? 'All Events' : <><i className={`pi ${m.icon}`} style={{ marginRight: 4, fontSize: 11 }} />{m.label}</>}
              </button>
            );
          })}
        </div>
        <input
          type="text" placeholder="Filter by User ID"
          value={userFilter} onChange={e => setUserFilter(e.target.value)}
          style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12,
            border: '1.5px solid #e2e8f0', outline: 'none', width: 130 }}
        />
        <button onClick={load} style={{
          marginLeft: 'auto', padding: '5px 14px', borderRadius: 99, fontSize: 12,
          background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#475569', fontWeight: 600,
        }}><i className="pi pi-refresh" style={{ marginRight: 4 }} /> Refresh</button>
      </div>

      {/* ── Block list ──────────────────────────────────────────────────── */}
      {filteredChain.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8',
          background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          <i className="pi pi-inbox" style={{ fontSize: 40, marginBottom: 10, display: 'block' }} />
          No blocks match the current filter. Blocks appear here as verification events occur.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredChain.map(b => {
            const isGenesis = b.record?.type === 'GENESIS' || b.index === 0;
            const m = typeMeta(b.record?.type);
            const open = expanded === b.index;

            return (
              <div key={b.index} style={{
                background: '#fff', borderRadius: 14, border: `1px solid ${open ? m.color + '60' : '#e2e8f0'}`,
                boxShadow: open ? `0 4px 20px ${m.color}20` : '0 2px 8px rgba(0,0,0,0.05)',
                overflow: 'hidden', transition: 'all 0.2s',
              }}>
                {/* Block header */}
                <div
                  onClick={() => setExpanded(open ? null : b.index)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                    cursor: 'pointer',
                  }}
                >
                  {/* Block number badge */}
                  <div style={{
                    minWidth: 44, height: 44, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                    background: isGenesis ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : m.bg,
                    color: isGenesis ? '#fff' : m.color, flexShrink: 0,
                  }}>
                    {isGenesis ? <i className="pi pi-link" /> : `#${b.index}`}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: m.bg, color: m.color,
                      }}><i className={`pi ${m.icon}`} style={{ marginRight: 4, fontSize: 10 }} />{m.label}</span>
                      {b.record?.userId && (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>User #{b.record.userId}</span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 12, color: '#475569',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.hash}
                    </div>
                  </div>

                  {/* Timestamp + nonce */}
                  <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12, color: '#94a3b8' }}>
                    <div>{b.timestamp === 'Genesis time' ? 'Genesis' : new Date(b.timestamp).toLocaleDateString('en-IN')}</div>
                    <div style={{ marginTop: 2 }}>nonce: {b.nonce ?? '—'}</div>
                  </div>

                  <div style={{ fontSize: 16, color: '#94a3b8', marginLeft: 4 }}>{open ? '▲' : '▼'}</div>
                </div>

                {/* Expanded detail */}
                {open && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
                      <HashField label="Block Hash"      value={b.hash} />
                      <HashField label="Previous Hash"   value={b.lastHash} />
                      {b.record?.dataHash && <HashField label="Data Hash" value={b.record.dataHash} />}
                      {b.record?.issuerPublicKey && <HashField label="Signed By (Public Key)" value={b.record.issuerPublicKey} />}
                    </div>

                    {/* Event data */}
                    {b.record?.data && Object.keys(b.record.data).length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Event Data</div>
                        <div style={{
                          background: '#f8fafc', borderRadius: 10, padding: '10px 14px',
                          fontFamily: 'monospace', fontSize: 12, color: '#374151',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                          {JSON.stringify(b.record.data, null, 2)}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <InfoChip label="Difficulty" value={b.difficulty ?? 'N/A'} />
                      <InfoChip label="Nonce"      value={b.nonce ?? 'N/A'} />
                      {b.record?.issuedAt && <InfoChip label="Issued" value={new Date(b.record.issuedAt).toLocaleString('en-IN')} />}
                      <button onClick={() => navigator.clipboard.writeText(b.hash)} style={copyBtnSt}>
                        <i className="pi pi-copy" style={{ marginRight: 4 }} /> Copy Hash
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {stats && (
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Chain auto-refreshes every 15 s &nbsp;·&nbsp; Last block: {stats.lastBlockHash?.substring(0, 20)}…
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */
function HashField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{
        fontFamily: 'monospace', fontSize: 11, color: '#374151',
        background: '#f8fafc', padding: '6px 10px', borderRadius: 8,
        wordBreak: 'break-all', lineHeight: 1.6,
      }}>{value || '—'}</div>
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={{
      padding: '4px 12px', background: '#f1f5f9', borderRadius: 99, fontSize: 12,
      color: '#475569', display: 'flex', gap: 6,
    }}>
      <span style={{ color: '#94a3b8' }}>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function OfflinePanel() {
  return (
    <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
      <i className="pi pi-link" style={{ fontSize: 64, marginBottom: 16, display: 'block' }} />
      <h2 style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>Blockchain Service Offline</h2>
      <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.7 }}>
        The DigiVerify blockchain microservice is not running.<br />
        Start it with the command below, then refresh this page.
      </p>
      <div style={{
        background: '#0f172a', color: '#34d399', padding: '16px 20px', borderRadius: 12,
        fontFamily: 'monospace', fontSize: 14, textAlign: 'left', marginBottom: 20,
      }}>
        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}># In a new terminal:</div>
        <div>cd js-crypto-model1</div>
        <div>npm run chain</div>
      </div>
      <button onClick={() => window.location.reload()} style={{
        padding: '10px 28px', borderRadius: 10, background: '#3b82f6',
        color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
      }}><i className="pi pi-refresh" style={{ marginRight: 4 }} /> Try Again</button>
    </div>
  );
}

const copyBtnSt = {
  padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
  background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
  fontWeight: 600,
};
