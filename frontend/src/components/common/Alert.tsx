import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  type?: 'success' | 'danger' | 'warning' | 'info';
  title?: string;
  message: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className = '',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} className="shrink-0 text-emerald-600" />;
      case 'danger':
        return <XCircle size={20} className="shrink-0 text-red-600" />;
      case 'warning':
        return <AlertTriangle size={20} className="shrink-0 text-amber-500" />;
      default:
        return <Info size={20} className="shrink-0 text-blue-600" />;
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-900 border-emerald-200';
      case 'danger':
        return 'bg-red-50 text-red-900 border-red-200';
      case 'warning':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-900 border-blue-200';
    }
  };

  return (
    <div
      className={`flex gap-3 items-start p-4 rounded-lg border text-sm ${getTypeStyles()} ${className}`}
      role="alert"
    >
      {getIcon()}
      <div className="flex-1">
        {title && <p className="font-bold mb-1">{title}</p>}
        <div className="leading-relaxed">{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="hover:opacity-100 opacity-60 text-current text-lg leading-none cursor-pointer focus:outline-none"
          aria-label="Close alert"
        >
          &times;
        </button>
      )}
    </div>
  );
};
