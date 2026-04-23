import React from 'react';

interface AlertDialogProps {
  message: string | React.ReactNode;
  onClose: () => void;
  buttonText?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ 
  message, onClose, buttonText = 'OK'
}) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 5000 }}>
      <div className="modal-content glass card" style={{ width: '400px', textAlign: 'center', padding: '32px' }}>
        <h3 style={{ color: 'var(--text-color)', marginBottom: '16px' }}>お知らせ</h3>
        <div style={{ marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={onClose} style={{ minWidth: '100px' }}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
