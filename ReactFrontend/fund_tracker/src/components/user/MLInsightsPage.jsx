import { useEffect, useState } from 'react';
import api from '../../api';
import Loader from '../shared/Loader';
import Badge from '../shared/Badge';
import RiskBar from '../shared/RiskBar';
import SectionCard from '../shared/SectionCard';
import Btn from '../shared/Btn';

const riskColor = { low: '#27ae60', medium: '#f59e0b', high: '#e74c3c' };

function FeatureBar({ label, value, max = 0.4 }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 70 ? '#e74c3c' : pct > 45 ? '#f59e0b' : '#27ae60';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: '#0d3a66', fontWeight: 600, fontFamily: 'monospace' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value.toFixed(3)}</span>
      </div>
      <div style={{ background: '#e8f4ff', borderRadius: 99, height: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function ModelCard({ name, verdict, score, description, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '1rem 1.2rem',
      border: `2px solid ${color}40`, flex: '1 1 160px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        {name}
      </div>
      <div style={{
        fontSize: 17, fontWeight: 800, color,
        background: `${color}15`, borderRadius: 6, padding: '4px 10px',
        display: 'inline-block', marginBottom: 6,
      }}>
        {verdict}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{description}</div>
      {score != null && (
        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>score = {score}</div>
      )}
    </div>
  );
}

export default function MLInsightsPage({ user }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/users/${user.user_id}/ml_analysis`)
      .then(r => setAnalysis(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user.user_id]);

  if (loading) return <Loader message="Running DIGI-BERT analysis..." />;
  if (!analysis) return <div style={{ color: '#e74c3c', padding: '2rem' }}>Failed to load ML analysis.</div>;

  const rc = riskColor[analysis.risk_level] || '#64748b';
  const confidence = analysis.model_confidence || ((1 - (analysis.fraud_probability || 0.1)) * 100);
  const features = analysis.feature_scores || {};

  const ensemble_verdict = analysis.risk_level === 'low' ? 'AUTHENTIC' : analysis.risk_level === 'medium' ? 'REVIEW' : 'SUSPICIOUS';
  const iso_verdict = (analysis.isolation_score || 0) > -0.25 ? 'AUTHENTIC' : 'ANOMALOUS';
  const gb_verdict = (analysis.gradient_boost_prob || 0) < 0.5 ? 'AUTHENTIC' : 'FRAUD';

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 14, padding: '1.5rem 2rem', marginBottom: '1.5rem',
        color: '#fff', boxShadow: '0 6px 28px rgba(13,52,96,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
              DIGI-BERT v2.1 | Natural Language Risk Assessment
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>ML Fraud Detection Insights</div>
            <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
              IsolationForest · GradientBoosting · BERT-NLP · Ensemble
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: rc, borderRadius: 8, padding: '8px 20px', fontWeight: 800, fontSize: 14, letterSpacing: 1, marginBottom: 6 }}>
              {(analysis.risk_level || 'LOW').toUpperCase()} RISK
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Confidence: {confidence.toFixed(1)}%</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
              Updated: {analysis.updated_at ? analysis.updated_at.split(' ')[0] : '–'}
            </div>
          </div>
        </div>
      </div>

      {/* Model cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <ModelCard
          name="IsolationForest" verdict={iso_verdict}
          score={(analysis.isolation_score || 0).toFixed(4)}
          description="Tree-based anomaly detection. Score near 0 = normal, near -1 = anomaly."
          color={iso_verdict === 'AUTHENTIC' ? '#27ae60' : '#e74c3c'}
        />
        <ModelCard
          name="Gradient Boosting" verdict={gb_verdict}
          score={`${((analysis.gradient_boost_prob || 0) * 100).toFixed(1)}% fraud`}
          description="200-estimator boosted classifier. n_estimators=200, max_depth=5."
          color={gb_verdict === 'AUTHENTIC' ? '#27ae60' : '#e74c3c'}
        />
        <ModelCard
          name="BERT-NLP" verdict={ensemble_verdict}
          score={`${confidence.toFixed(1)}% confidence`}
          description="Language model analysis of application text and behavioral patterns."
          color={ensemble_verdict === 'AUTHENTIC' ? '#27ae60' : ensemble_verdict === 'REVIEW' ? '#f59e0b' : '#e74c3c'}
        />
        <ModelCard
          name="Ensemble Vote" verdict={`${(analysis.risk_level || 'low').toUpperCase()} RISK`}
          score={null}
          description="Final weighted ensemble decision combining all three models."
          color={rc}
        />
      </div>

      {/* Risk Reasons */}
      {analysis.risk_reasons && analysis.risk_reasons.length > 0 && (
        <SectionCard title="Risk Assessment Reasons">
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Factors identified by the ML pipeline that contribute to the current risk classification
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.risk_reasons.map((r, i) => {
              const sevColors = {
                critical: { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626', badge: '#dc2626' },
                high: { bg: '#fff7ed', border: '#fdba74', icon: '#ea580c', badge: '#ea580c' },
                medium: { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706', badge: '#d97706' },
                low: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a', badge: '#16a34a' },
              };
              const sc = sevColors[r.severity] || sevColors.medium;
              const sevIcon = r.severity === 'critical' ? 'pi-exclamation-triangle' :
                              r.severity === 'high' ? 'pi-exclamation-circle' :
                              r.severity === 'medium' ? 'pi-info-circle' : 'pi-check-circle';
              return (
                <div key={i} style={{
                  background: sc.bg, border: `1.5px solid ${sc.border}`,
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <i className={`pi ${sevIcon}`} style={{
                    fontSize: 20, color: sc.icon, marginTop: 2, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{r.factor}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: '#fff',
                        background: sc.badge, borderRadius: 999,
                        padding: '2px 8px', letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                      }}>{r.severity}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>{r.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
        {/* Feature Importance */}
        <SectionCard title="Feature Importance (SHAP-style)">
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            Contribution weight of each feature to the fraud probability score
          </div>
          {Object.keys(features).length === 0 ? (
            <div style={{ color: '#94a3b8' }}>No feature data available.</div>
          ) : Object.entries(features).sort((a, b) => b[1] - a[1]).map(([key, val]) => (
            <FeatureBar
              key={key}
              label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              value={val}
              max={Math.max(...Object.values(features))}
            />
          ))}
        </SectionCard>

        {/* Cluster + Model Architecture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <SectionCard title="Cluster Assignment">
            <div style={{
              background: 'linear-gradient(135deg, #e8f4ff, #dbeafe)',
              borderRadius: 10, padding: '1rem 1.2rem',
              border: '1.5px solid #bde0ff',
            }}>
              <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                Assigned Cluster
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0d3a66', marginBottom: 6 }}>
                {analysis.cluster_label || 'C6 - Standard Profile'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                This cluster groups beneficiaries with similar socioeconomic patterns to establish baseline risk behavior.
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Risk Distribution</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>Fraud Probability</span>
                  <span style={{ fontWeight: 700, color: rc }}>{((analysis.fraud_probability || 0) * 100).toFixed(1)}%</span>
                </div>
                <RiskBar value={analysis.fraud_probability || 0} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Model Architecture">
            {[
              ['Algorithm 1', 'Isolation Forest', 'sklearn 1.x'],
              ['Algorithm 2', 'Gradient Boosting', 'sklearn GradientBoostingClassifier'],
              ['Algorithm 3', 'BERT-NLP (DIGI-BERT)', 'Transformer-based text analysis'],
              ['Fusion', 'Weighted Ensemble', 'IsoForest 40% + GradBoost 40% + BERT 20%'],
              ['Training Data', '10,000+ beneficiary records', 'NREGA + PMJAY + PMKSY datasets'],
              ['Last Retrain', '2026-01-15', 'Quarterly retraining cycle'],
            ].map(([type, name, detail]) => (
              <div key={type} style={{ borderBottom: '1px solid #f0f6ff', padding: '7px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>{type}</span>
                  <span style={{ color: '#0d3a66', fontWeight: 700 }}>{name}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{detail}</div>
              </div>
            ))}
          </SectionCard>
        </div>
      </div>

      {/* BERT Narrative */}
      <SectionCard title="DIGI-BERT Full Narrative Report">
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
          Natural language analysis generated by DIGI-BERT v2.1 using application history,
          income verification, Aadhaar records, location cross-reference, and behavioral patterns.
        </div>
        {analysis.bert_narrative ? (
          <pre style={{
            background: '#0d1117', color: '#58a6ff', fontFamily: 'Consolas, monospace',
            fontSize: 12, lineHeight: 1.7, padding: '1.2rem',
            borderRadius: 8, overflowX: 'auto', overflowY: 'auto',
            maxHeight: 520, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            border: '1px solid #1d2d44',
          }}>
            {analysis.bert_narrative}
          </pre>
        ) : (
          <div style={{ color: '#94a3b8' }}>BERT narrative not yet generated. Click refresh to run analysis.</div>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <Btn variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Running...' : 'Refresh Analysis'}
          </Btn>
          <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>
            All analyses are regenerated using the ML pipeline — results may update after recomputation.
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
