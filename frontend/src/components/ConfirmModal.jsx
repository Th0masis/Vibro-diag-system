import React from 'react';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete" }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content delete-modal">
        <h3 style={{ color: 'var(--status-fault)', marginTop: 0 }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.5' }}>
          {message}
        </p>
        
        <div className="modal-actions" style={{ marginTop: '25px' }}>
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-confirm-delete" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;