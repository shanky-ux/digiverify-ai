import { Tag } from 'primereact/tag';

const SEVERITY_MAP = {
  low:          { severity: 'success', icon: 'pi-check-circle' },
  medium:       { severity: 'warning', icon: 'pi-exclamation-triangle' },
  high:         { severity: 'danger', icon: 'pi-times-circle' },
  submitted:    { severity: 'info', icon: 'pi-send' },
  under_review: { severity: 'warning', icon: 'pi-eye' },
  approved:     { severity: 'success', icon: 'pi-check' },
  rejected:     { severity: 'danger', icon: 'pi-times' },
  active:       { severity: 'info', icon: 'pi-check-circle' },
  cash:         { severity: 'success', icon: 'pi-wallet' },
  service:      { severity: 'info', icon: 'pi-cog' },
  'in-kind':    { severity: 'warning', icon: 'pi-gift' },
  info:         { severity: 'info', icon: 'pi-info-circle' },
  scheme_alert: { severity: 'warning', icon: 'pi-bell' },
  application_update: { severity: 'success', icon: 'pi-refresh' },
};

export default function Badge({ value }) {
  const key = (value || '').toString().toLowerCase();
  const config = SEVERITY_MAP[key] || { severity: null, icon: 'pi-tag' };
  return (
    <Tag
      value={value || '-'}
      severity={config.severity}
      icon={`pi ${config.icon}`}
      style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px' }}
    />
  );
}
