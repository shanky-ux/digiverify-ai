import { ProgressSpinner } from 'primereact/progressspinner';

export default function Loader({ message = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '4rem 2rem', minHeight: 200,
    }}>
      <ProgressSpinner style={{ width: 56, height: 56 }} strokeWidth="4" animationDuration="0.8s" />
      <span style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>{message}</span>
    </div>
  );
}
