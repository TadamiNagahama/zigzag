import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SizeDialogProps {
  currentWidth: number;
  currentHeight: number;
  onClose: () => void;
  onApply: (h: number, w: number) => void;
}

const PRESETS = [
  { h: 10, w: 10 },
  { h: 13, w: 13 },
  { h: 15, w: 15 },
  { h: 17, w: 17 },
  { h: 20, w: 14 },
  { h: 21, w: 30 }, // 21 (タテ) x 30 (ヨコ) の横長
];

export const SizeDialog: React.FC<SizeDialogProps> = ({ currentWidth, currentHeight, onClose, onApply }) => {
  const [selectedPreset, setSelectedPreset] = useState<{h: number, w: number} | null>(
    PRESETS.find(p => p.w === currentWidth && p.h === currentHeight) || null
  );
  const [customWidth, setCustomWidth] = useState(currentWidth);
  const [customHeight, setCustomHeight] = useState(currentHeight);
  const [isCustom, setIsCustom] = useState(!PRESETS.some(p => p.w === currentWidth && p.h === currentHeight));

  const handleApply = () => {
    if (isCustom) {
      const w = Math.min(100, Math.max(1, Math.floor(customWidth)));
      const h = Math.min(100, Math.max(1, Math.floor(customHeight)));
      onApply(h, w);
    } else if (selectedPreset) {
      onApply(selectedPreset.h, selectedPreset.w);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass card" style={{ width: '400px', padding: '24px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>盤面サイズの変更</h2>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px', border: 'none', borderRadius: '50%', display: 'flex' }}>
            <X size={18} />
          </button>
        </header>

        <div className="radio-group" style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {PRESETS.map(p => (
            <div 
              key={`${p.h}x${p.w}`}
              className={`radio-option ${!isCustom && selectedPreset?.w === p.w && selectedPreset?.h === p.h ? 'selected' : ''}`}
              onClick={() => {
                setSelectedPreset(p);
                setIsCustom(false);
              }}
              style={{ padding: '10px 12px' }}
            >
              <input 
                type="radio" 
                checked={!isCustom && selectedPreset?.w === p.w && selectedPreset?.h === p.h} 
                onChange={() => {}} 
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem' }}>{p.h} x {p.w}</span>
            </div>
          ))}
        </div>

        <div 
          className={`radio-option ${isCustom ? 'selected' : ''}`}
          onClick={() => setIsCustom(true)}
          style={{ width: '100%', marginBottom: '16px', padding: '10px 12px' }}
        >
          <input type="radio" checked={isCustom} onChange={() => {}} style={{ cursor: 'pointer' }} />
          <span style={{ fontSize: '0.9rem' }}>自由サイズ (1〜100)</span>
        </div>

        {isCustom && (
          <div className="custom-size-inputs" style={{ display: 'flex', gap: '12px', marginTop: '0' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>タテ</label>
              <input 
                type="number" 
                value={customHeight} 
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1)}
                className="input-field"
                min="1"
                max="100"
                style={{ marginTop: '4px', width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ヨコ</label>
              <input 
                type="number" 
                value={customWidth} 
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1)}
                className="input-field"
                min="1"
                max="100"
                style={{ marginTop: '4px', width: '100%' }}
              />
            </div>
          </div>
        )}

        <div className="dialog-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          <button onClick={handleApply} className="btn-primary">適用する</button>
        </div>
      </div>
    </div>
  );
};
