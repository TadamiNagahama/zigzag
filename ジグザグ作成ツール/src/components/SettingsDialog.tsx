import React from 'react';
import { X, Type } from 'lucide-react';
import { APP_VERSION } from '../models/types';

interface SettingsDialogProps {
  shadingColor: string;
  boardFontWeight: 'normal' | 'bold';
  boardFontFamily: string;
  cloudAutoSave: boolean;
  onClose: () => void;
  onSetShadingColor: (color: string) => void;
  onSetFontWeight: (weight: 'normal' | 'bold') => void;
  onSetFontFamily: (family: string) => void;
  onSetCloudAutoSave: (cloudAutoSave: boolean) => void;
  version?: string;
}

const SHADING_COLORS = [
  { label: 'ブルー', value: '#dbeafe' },
  { label: 'グリーン', value: '#f0fdf4' },
  { label: 'オレンジ', value: '#feebc8' },
  { label: 'ピンク', value: '#fed7e2' },
  { label: 'イエロー', value: '#fef3c7' },
];

const FONT_FAMILIES = [
  { label: '標準 (ゴシック)', value: '' },
  { label: '明朝体', value: '"Yu Mincho", "YuMincho", "MS Mincho", serif' },
  { label: '游ゴシック', value: '"Yu Gothic", "YuGothic", sans-serif' },
  { label: 'メイリオ', value: '"Meiryo", sans-serif' },
  { label: '丸ゴシック', value: '"HG丸ｺﾞｼｯｸM-PRO", "Rounded Mplus 1c", sans-serif' },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  shadingColor,
  boardFontWeight,
  boardFontFamily,
  cloudAutoSave,
  onClose,
  onSetShadingColor,
  onSetFontWeight,
  onSetFontFamily,
  onSetCloudAutoSave,
  version = APP_VERSION
}) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ width: '400px', padding: '24px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>設定</h2>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px', border: 'none', borderRadius: '50%', display: 'flex' }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* フォントの種類設定 */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Type size={18} color="var(--primary-color)" />
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>フォントの種類</div>
            </div>
            <select
              value={boardFontFamily}
              onChange={(e) => onSetFontFamily(e.target.value)}
              className="input-field"
              style={{ width: '100%', padding: '10px' }}
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* フォントの太さ設定 */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Type size={18} color="var(--primary-color)" />
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>フォントの太さ</div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className={`btn-secondary ${boardFontWeight === 'normal' ? 'active' : ''}`}
                onClick={() => onSetFontWeight('normal')}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: boardFontWeight === 'normal' ? 'var(--primary-color)' : '',
                  color: boardFontWeight === 'normal' ? 'white' : '',
                  borderColor: boardFontWeight === 'normal' ? 'var(--primary-color)' : ''
                }}
              >
                普通
              </button>
              <button
                className={`btn-secondary ${boardFontWeight === 'bold' ? 'active' : ''}`}
                onClick={() => onSetFontWeight('bold')}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 'bold',
                  backgroundColor: boardFontWeight === 'bold' ? 'var(--primary-color)' : '',
                  color: boardFontWeight === 'bold' ? 'white' : '',
                  borderColor: boardFontWeight === 'bold' ? 'var(--primary-color)' : ''
                }}
              >
                太字
              </button>
            </div>
          </div>

          {/* 網掛けの色 */}
          <div>
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

          {/* クラウド自動保存設定 */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>オートセーブ</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ※ログインかつ一度保存することが必須です。1分ごとにサーバーに保存されます。
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                <input
                  type="checkbox"
                  checked={cloudAutoSave}
                  onChange={(e) => onSetCloudAutoSave(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: cloudAutoSave ? 'var(--primary-color)' : '#cbd5e1',
                  transition: '.4s', borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute', content: '""', height: '20px', width: '20px',
                    left: cloudAutoSave ? '24px' : '3px', bottom: '3px',
                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                  }}></span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          バージョン: {version}
        </div>
      </div>
    </div>
  );
};
