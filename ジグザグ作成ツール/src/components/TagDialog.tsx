import React, { useState } from 'react';

interface TagDialogProps {
  onClose: () => void;
  onAdd: (tag: string) => void;
}

export const TagDialog: React.FC<TagDialogProps> = ({ onClose, onAdd }) => {
  const [tagName, setTagName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagName.trim()) {
      onAdd(tagName.trim());
      onClose();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 4000 }}>
      <div className="modal-content glass card" style={{ width: '300px', padding: '20px' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>タグを追加</h3>
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            autoFocus
            className="input-field"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="タグ名を入力..."
            style={{ width: '100%', marginBottom: '16px', padding: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '4px 12px' }}>キャンセル</button>
            <button type="submit" className="btn-primary" style={{ padding: '4px 12px' }}>追加</button>
          </div>
        </form>
      </div>
    </div>
  );
};
