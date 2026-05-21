import React from 'react';

interface ConfirmDialogProps {
  message: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ 
  message, onConfirm, onCancel, 
  confirmText = 'はい', cancelText = 'キャンセル', isDestructive = false 
}) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 5000 }}>
      <div className="modal-content glass card" style={{ width: '400px', textAlign: 'center', padding: '32px' }}>
        <h3 style={{ color: isDestructive ? '#ef4444' : 'var(--text-color)', marginBottom: '16px' }}>確認</h3>
        <div style={{ marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={onCancel} style={{ minWidth: '100px' }}>
            {cancelText}
          </button>
          <button 
            className="btn-primary" 
            onClick={onConfirm}
            style={{ 
              minWidth: '100px', 
              backgroundColor: isDestructive ? '#ef4444' : undefined,
              borderColor: isDestructive ? '#ef4444' : undefined
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
