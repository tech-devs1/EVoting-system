import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  type?: 'success' | 'danger' | 'warning' | 'info';
  title?: string;
  message: React.ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className = '',
  style
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} style={{ flexShrink: 0, color: 'var(--color-success, #22c55e)' }} />;
      case 'danger':
        return <XCircle size={20} style={{ flexShrink: 0, color: 'var(--color-danger, #ef4444)' }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ flexShrink: 0, color: 'var(--color-warning, #f59e0b)' }} />;
      default:
        return <Info size={20} style={{ flexShrink: 0, color: 'var(--color-primary, #2563eb)' }} />;
    }
  };

  return (
    <div
      className={`alert alert-${type} ${className}`}
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'flex-start',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-4)',
        fontSize: 'var(--text-sm)',
        ...style
      }}
    >
      {getIcon()}
      <div style={{ flex: 1 }}>
        {title && <p style={{ fontWeight: 'bold', margin: '0 0 2px 0' }}>{title}</p>}
        <div style={{ margin: 0 }}>{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.7,
            padding: 0,
            color: 'inherit'
          }}
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  );
};
