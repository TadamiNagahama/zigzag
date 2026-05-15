import React from 'react';

interface SolveChoiceDialogProps {
  onStartFromScratch: () => void;
  onStartFromCurrent: () => void;
  onCancel: () => void;
}

export const SolveChoiceDialog: React.FC<SolveChoiceDialogProps> = ({ 
  onStartFromScratch, onStartFromCurrent, onCancel 
}) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 4000 }}>
      <div className="modal-content glass card" style={{ width: '450px', textAlign: 'center', padding: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>自動解答の開始</h3>
        <div style={{ marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem' }}>
          盤面にすでに入力されている文字があります。<br />
          どのように開始しますか？
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn-primary" 
            onClick={onStartFromScratch}
            style={{ width: '100%', padding: '12px' }}
          >
            最初から行う（盤面をリセット）
          </button>
          <button 
            className="btn-secondary" 
            onClick={onStartFromCurrent}
            style={{ width: '100%', padding: '12px' }}
          >
            この盤面から行う（入力済みを維持）
          </button>
          <button 
            className="btn-ghost" 
            onClick={onCancel}
            style={{ width: '100%', marginTop: '8px' }}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
