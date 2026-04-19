import { Button } from 'primereact/button';

const VARIANT_MAP = {
  primary:  { severity: null },
  success:  { severity: 'success' },
  warning:  { severity: 'warning' },
  danger:   { severity: 'danger' },
  outline:  { severity: null, outlined: true },
  ghost:    { severity: null, text: true },
};

export default function Btn({ children, onClick, variant = 'primary', disabled, size = 'md', style: extraStyle, icon }) {
  const config = VARIANT_MAP[variant] || VARIANT_MAP.primary;
  return (
    <Button
      label={typeof children === 'string' ? children : undefined}
      icon={icon}
      severity={config.severity}
      outlined={config.outlined}
      text={config.text}
      disabled={disabled}
      onClick={onClick}
      size={size === 'sm' ? 'small' : size === 'lg' ? 'large' : undefined}
      style={{
        borderRadius: 8, fontWeight: 600, fontSize: size === 'sm' ? 12 : 14,
        padding: size === 'sm' ? '5px 12px' : '8px 18px',
        ...extraStyle,
      }}
    >
      {typeof children !== 'string' && children}
    </Button>
  );
}
