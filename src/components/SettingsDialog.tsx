import React, { useState } from 'react';
import { X, LayoutGrid, ChevronRight } from 'lucide-react';

interface SettingsDialogProps {
  currentWidth: number;
  currentHeight: number;
  shadingColor: string;
  onClose: () => void;
  onApplySize: (h: number, w: number) => void;
  onSetShadingColor: (color: string) => void;
  version?: string;
}

const PRESETS = [
  { h: 10, w: 10 },
  { h: 13, w: 13 },
  { h: 15, w: 15 },
  { h: 17, w: 17 },
  { h: 20, w: 14 },
  { h: 21, w: 30 },
];

const SHADING_COLORS = [
  { label: 'グレー', value: '#e2e8f0' },
  { label: 'ブルー', value: '#bee3f8' },
  { label: 'オレンジ', value: '#feebc8' },
  { label: 'ピンク', value: '#fed7e2' },
  { label: 'イエロー', value: '#fef3c7' },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ 
  currentWidth, 
  currentHeight, 
  shadingColor,
  onClose, 
  onApplySize,
  onSetShadingColor,
  version = '0.0.1'
}) => {
  const [showSizeSettings, setShowSizeSettings] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<{h: number, w: number} | null>(
    PRESETS.find(p => p.w === currentWidth && p.h === currentHeight) || null
  );
  const [customWidth, setCustomWidth] = useState(currentWidth);
  const [customHeight, setCustomHeight] = useState(currentHeight);
  const [isCustom, setIsCustom] = useState(!PRESETS.some(p => p.w === currentWidth && p.h === currentHeight));

  const handleApplySize = () => {
    if (isCustom) {
      const w = Math.min(100, Math.max(1, Math.floor(customWidth)));
      const h = Math.min(100, Math.max(1, Math.floor(customHeight)));
      onApplySize(h, w);
    } else if (selectedPreset) {
      onApplySize(selectedPreset.h, selectedPreset.w);
    }
    setShowSizeSettings(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      {/* 
        メインの設定画面 
      */}
      {!showSizeSettings ? (
        <div className="modal-content glass card" style={{ width: '400px', padding: '24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>設定</h2>
            <button onClick={onClose} className="btn-secondary" style={{ padding: '6px', border: 'none', borderRadius: '50%', display: 'flex' }}>
              <X size={18} />
            </button>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <button 
              className="btn-secondary" 
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '12px 16px',
                textAlign: 'left'
              }}
              onClick={() => setShowSizeSettings(true)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LayoutGrid size={20} color="var(--primary-color)" />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>盤面サイズの変更</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>現在のサイズ: {currentHeight} x {currentWidth}</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </button>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '12px' }}>網掛けの色</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {SHADING_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => onSetShadingColor(c.value)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border: shadingColor === c.value ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.2s',
                      transform: shadingColor === c.value ? 'scale(1.1)' : 'scale(1)'
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            バージョン: {version}
          </div>
        </div>
      ) : (
        /* 
          盤面サイズ設定画面 (SizeDialog相当の内容) 
        */
        <div className="modal-content glass card" style={{ width: '400px', padding: '24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>盤面サイズの変更</h2>
            <button onClick={() => setShowSizeSettings(false)} className="btn-secondary" style={{ padding: '6px', border: 'none', borderRadius: '50%', display: 'flex' }}>
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
            <button onClick={() => setShowSizeSettings(false)} className="btn-secondary">戻る</button>
            <button onClick={handleApplySize} className="btn-primary">適用する</button>
          </div>
        </div>
      )}
    </div>
  );
};
