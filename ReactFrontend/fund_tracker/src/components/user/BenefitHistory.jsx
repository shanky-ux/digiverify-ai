import { useEffect, useState } from 'react';
import api from '../../api';
import Loader from '../shared/Loader';
import Badge from '../shared/Badge';
import SectionCard from '../shared/SectionCard';

const catColor = {
  Education: '#3b82f6', Health: '#e74c3c', Agriculture: '#27ae60',
  Housing: '#f59e0b', Employment: '#8b5cf6', 'Women & Child': '#ec4899',
  'Senior Citizen': '#64748b', Disability: '#0891b2', 'Skill Development': '#d97706',
  General: '#94a3b8',
};

const methodIcon = {
  DBT: 'pi-building', RTGS: 'pi-building', NEFT: 'pi-sync', 'Online Transfer': 'pi-desktop', 'In-Kind': 'pi-box',
};

function groupByYear(disbursements) {
  const grouped = {};
  disbursements.forEach(d => {
    const year = d.disbursement_date ? d.disbursement_date.split('-')[0] : 'Unknown';
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(d);
  });
  return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function BenefitHistory({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get(`/users/${user.user_id}/benefit_history`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [user.user_id]);

  if (loading) return <Loader message="Loading benefit history..." />;
  if (!data) return <div style={{ color: '#e74c3c', padding: '2rem' }}>Failed to load benefit history.</div>;

  const filtered = filter === 'all' ? data.disbursements : data.disbursements.filter(d => d.status === filter);
  const grouped = groupByYear(filtered);

  // Summary by scheme
  const byScheme = {};
  data.disbursements.filter(d => d.status === 'processed').forEach(d => {
    if (!byScheme[d.scheme_name]) byScheme[d.scheme_name] = { total: 0, count: 0, category: d.scheme_category };
    byScheme[d.scheme_name].total += d.amount;
    byScheme[d.scheme_name].count += 1;
  });
  const topSchemes = Object.entries(byScheme).sort((a, b) => b[1].total - a[1].total);

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a7f2e, #27ae60)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem',
        color: '#fff', boxShadow: '0 4px 20px rgba(26,127,46,0.25)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Benefit Disbursement History</div>
        <div style={{ opacity: 0.85, fontSize: 14, marginTop: 4 }}>
          All government benefit payments credited to your account
        </div>
        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '1rem' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              ₹{(data.total_received || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total Benefits Received</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{data.count || 0}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total Payments</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{Object.keys(byScheme).length}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Schemes Benefiting</div>
          </div>
        </div>
      </div>

      {/* Amount by Scheme */}
      {topSchemes.length > 0 && (
        <SectionCard title="Benefits by Scheme">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.8rem' }}>
            {topSchemes.map(([name, info]) => (
              <div key={name} style={{
                background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                borderLeft: `4px solid ${catColor[info.category] || '#94a3b8'}`,
              }}>
                <div style={{ fontSize: 11, color: catColor[info.category] || '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>
                  {info.category}
                </div>
                <div style={{ fontWeight: 700, color: '#0d3a66', fontSize: 13, marginBottom: 4 }}>{name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#27ae60' }}>
                    ₹{info.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{info.count} payments</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginTop: '1.2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['all', 'All Payments'], ['processed', 'Processed'], ['pending', 'Pending']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: '6px 18px', borderRadius: 20, border: 'none',
            background: filter === val ? '#0d6efd' : '#e8f4ff',
            color: filter === val ? '#fff' : '#0d6efd',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13, alignSelf: 'center' }}>
          {filtered.length} payments
        </span>
      </div>

      {/* Timeline grouped by year */}
      {grouped.length === 0 ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem', fontSize: 15 }}>
          No disbursements found. Apply for schemes to start receiving benefits.
        </div>
      ) : grouped.map(([year, items]) => (
        <div key={year} style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: '#0d3a66', letterSpacing: 1,
            textTransform: 'uppercase', borderBottom: '2px solid #bde0ff',
            paddingBottom: 6, marginBottom: '1rem',
          }}>
            {year}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map(d => (
              <div key={d.id} style={{
                background: '#fff', borderRadius: 10, padding: '14px 16px',
                border: '1.5px solid #e2e8f0',
                borderLeft: `4px solid ${d.status === 'processed' ? catColor[d.scheme_category] || '#3b82f6' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', gap: '1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: d.status === 'processed' ? '#e6f9ee' : '#fef9c3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  <i className={`pi ${methodIcon[d.payment_method] || 'pi-wallet'}`} style={{ fontSize: 20 }} />
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#0d3a66', fontSize: 14, marginBottom: 2 }}>
                    {d.scheme_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Installment #{d.installment_no} &nbsp;•&nbsp; {d.payment_method} &nbsp;•&nbsp;
                    Acct: ****{d.account_no_last4} &nbsp;•&nbsp;
                    {d.disbursement_date ? d.disbursement_date.split(' ')[0] : '–'}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                      color: catColor[d.scheme_category] || '#3b82f6',
                      background: '#f0f6ff', borderRadius: 4, padding: '1px 7px',
                    }}>
                      {d.scheme_category}
                    </span>
                  </div>
                </div>

                {/* Amount + status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 20, fontWeight: 800,
                    color: d.status === 'processed' ? '#27ae60' : '#f59e0b',
                  }}>
                    +₹{d.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Badge value={d.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
