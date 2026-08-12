import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Helper to format currency in Indian format
export const fmt = (n) => {
  const num = parseFloat(n || 0);
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Custom Toast function
export const showToast = (message, type = 'success') => {
  toast.custom((t) => (
    <div
      style={{
        position: 'relative',
        width: '320px',
        backgroundColor: type === 'success' ? '#D1FAE5' : '#FEE2E2',
        color: type === 'success' ? '#065F46' : '#991B1B',
        borderLeft: `4px solid ${type === 'success' ? '#059669' : '#DC2626'}`,
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13px',
        fontFamily: 'sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 99999,
        transition: 'all 0.2s ease-in-out',
        opacity: t.visible ? 1 : 0
      }}
    >
      <span style={{ fontWeight: '500', color: '#111827' }}>{message}</span>
      <button 
        onClick={() => toast.dismiss(t.id)} 
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: '#111827', 
          fontWeight: 'bold', 
          cursor: 'pointer', 
          marginLeft: '10px',
          fontSize: '14px'
        }}
      >
        ✕
      </button>
    </div>
  ), { duration: 4000 });
};

// 1. Card Component
export const Card = ({ children, style = {}, onClick }) => {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// 2. Button Component
export const Btn = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  style = {}
}) => {
  const [hovered, setHovered] = useState(false);

  const getStyles = () => {
    if (disabled) {
      return {
        background: '#E5E7EB',
        color: '#9CA3AF',
        border: 'none',
        cursor: 'not-allowed'
      };
    }

    switch (variant) {
      case 'primary':
        return {
          background: hovered ? '#2D2D44' : '#1A1A2E',
          color: '#FFFFFF',
          border: 'none'
        };
      case 'secondary':
      case 'outline':
        return {
          background: hovered ? '#F9FAFB' : '#FFFFFF',
          color: '#374151',
          border: '1px solid #D1D5DB'
        };
      case 'danger':
        return {
          background: hovered ? '#B91C1C' : '#DC2626',
          color: '#FFFFFF',
          border: 'none'
        };
      case 'success':
        return {
          background: hovered ? '#15803D' : '#16A34A',
          color: '#FFFFFF',
          border: 'none'
        };
      default:
        return {
          background: '#1A1A2E',
          color: '#FFFFFF',
          border: 'none'
        };
    }
  };

  const btnStyle = {
    borderRadius: '7px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 120ms ease',
    ...getStyles(),
    ...style
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={btnStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
};

// 3. Form Input Component
export const Input = ({ label, error, required, style = {}, ...props }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
          {label}
          {required && <span style={{ color: '#DC2626', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <input
        {...props}
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          color: '#111827',
          border: error ? '1.5px solid #DC2626' : focused ? '1.5px solid #3B5BDB' : '1.5px solid #D1D5DB',
          borderRadius: '8px',
          padding: '11px 14px',
          fontSize: '14px',
          outline: 'none',
          boxShadow: focused ? '0 0 0 3px rgba(59,91,219,0.12)' : 'none',
          transition: 'all 120ms',
          ...style
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#DC2626', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
};

// 4. Form Select Component
export const Select = ({ label, error, required, children, style = {}, ...props }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
          {label}
          {required && <span style={{ color: '#DC2626', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <select
        {...props}
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          color: '#111827',
          border: error ? '1.5px solid #DC2626' : focused ? '1.5px solid #3B5BDB' : '1.5px solid #D1D5DB',
          borderRadius: '8px',
          padding: '11px 14px',
          fontSize: '14px',
          outline: 'none',
          boxShadow: focused ? '0 0 0 3px rgba(59,91,219,0.12)' : 'none',
          transition: 'all 120ms',
          cursor: 'pointer',
          ...style
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {children}
      </select>
      {error && (
        <span style={{ fontSize: '12px', color: '#DC2626', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
};

// 5. Form Textarea Component
export const Textarea = ({ label, error, required, style = {}, ...props }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
          {label}
          {required && <span style={{ color: '#DC2626', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <textarea
        {...props}
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          color: '#111827',
          border: error ? '1.5px solid #DC2626' : focused ? '1.5px solid #3B5BDB' : '1.5px solid #D1D5DB',
          borderRadius: '8px',
          padding: '11px 14px',
          fontSize: '14px',
          outline: 'none',
          boxShadow: focused ? '0 0 0 3px rgba(59,91,219,0.12)' : 'none',
          transition: 'all 120ms',
          minHeight: '80px',
          resize: 'vertical',
          ...style
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#DC2626', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
};

// 6. Status Badge Component
export const StatusBadge = ({ status }) => {
  const cleanStatus = String(status || '').toLowerCase().trim();
  
  return (
    <span className={`badge-status status-${cleanStatus}`}>
      {status}
    </span>
  );
};

// 7. Skeleton Table Row Component
export const TableSkeleton = ({ cols = 5, rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} style={{ borderBottom: '1px solid #E5E7EB' }}>
          {Array.from({ length: cols }).map((_, cIdx) => {
            const widths = ['60%', '80%', '40%', '70%', '50%'];
            const w = widths[cIdx % widths.length];
            return (
              <td key={cIdx} style={{ padding: '12px 16px' }}>
                <div 
                  className="skeleton-shimmer skeleton-cell" 
                  style={{ width: w }} 
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
};

// 8. Custom Modal Component
export const Modal = ({ open, onClose, title, children, width = 600 }) => {
  if (!open) return null;

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: `${width}px`,
          margin: 'auto',
          flexShrink: 0,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Sticky header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #F2F4F7',
          borderRadius: '12px 12px 0 0',
          background: '#FFFFFF',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#101828' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#98A2B3', padding: '4px 8px',
              borderRadius: '6px', lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// 9. Page Header Component
export const PageHeader = ({ title, actions }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{title}</h1>
      {actions && <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>{actions}</div>}
    </div>
  );
};

// 10. Grid Component
export const Grid = ({ children, cols = 3, gap = 16, style = {} }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${gap}px`, ...style }}>
      {children}
    </div>
  );
};

// 11. Spinner Component
export const Spinner = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #E5E7EB', borderTop: '3px solid #1A1A2E', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// 12. Badge Component
export const Badge = ({ children, color = 'gray' }) => {
  const bgColors = {
    green: '#D1FAE5',
    red: '#FEE2E2',
    yellow: '#FEF3C7',
    blue: '#DBEAFE',
    purple: '#F3E8FF',
    gray: '#F3F4F6'
  };
  const textColors = {
    green: '#065F46',
    red: '#991B1B',
    yellow: '#92400E',
    blue: '#1E40AF',
    purple: '#6B21A8',
    gray: '#374151'
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: bgColors[color] || bgColors.gray,
      color: textColors[color] || textColors.gray
    }}>
      {children}
    </span>
  );
};

// 13. Table Component
export const Table = ({ cols = [], rows = [], emptyMsg = 'No records found' }) => {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
            {cols.map((col, idx) => (
              <th key={idx} style={{ padding: '12px 16px', color: '#6B7280', textAlign: col.align || 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((row, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                {cols.map((col, cIdx) => (
                  <td key={cIdx} style={{ padding: '12px 16px', textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

