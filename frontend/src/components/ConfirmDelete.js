import React from 'react';

const ConfirmDelete = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h3 style={{ color: '#DC2626', marginBottom: '8px', marginTop: 0 }}>
          Confirm Delete
        </h3>
        <p style={{ color: '#374151', marginBottom: '20px' }}>
          {message || 'Are you sure you want to delete this record? This action cannot be undone.'}
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'white',
              border: '1px solid #D1D5DB',
              borderRadius: '7px',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: '#DC2626',
              color: 'white',
              border: 'none',
              borderRadius: '7px',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDelete;
