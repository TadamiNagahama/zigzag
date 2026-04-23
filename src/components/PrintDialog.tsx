import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { type PrintOptions } from '../models/types';

interface PrintDialogProps {
  onClose: () => void;
  onPrint: (options: PrintOptions) => void;
}

export const PrintDialog: React.FC<PrintDialogProps> = ({ onClose, onPrint }) => {
  const [options, setOptions] = useState<PrintOptions>({
    printProblem: true,
    printAnswer: false,
    layout: 'combined',
    listColumns: 5
  });

  const handlePrint = () => {
    onPrint(options);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ width: '450px', padding: '24px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={20} /> 印刷設定
          </h2>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px', border: 'none', borderRadius: '50%', display: 'flex' }}>
            <X size={18} />
          </button>
        </header>

        <section style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary-color)' }}>印刷する内容</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: options.printProblem ? 'var(--primary-light)' : 'transparent' }}>
              <input 
                type="checkbox" 
                checked={options.printProblem} 
                onChange={(e) => setOptions({ ...options, printProblem: e.target.checked })} 
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>問題面を印刷</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>盤面（網掛け優先）と単語リスト</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: options.printAnswer ? 'var(--primary-light)' : 'transparent' }}>
              <input 
                type="checkbox" 
                checked={options.printAnswer} 
                onChange={(e) => setOptions({ ...options, printAnswer: e.target.checked })} 
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>解答面を印刷</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>完成した正解図</div>
              </div>
            </label>
          </div>
        </section>

        {options.printProblem && (
          <section style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--primary-color)' }}>レイアウト（問題面）</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div 
                onClick={() => setOptions({ ...options, layout: 'combined' })}
                style={{ 
                  cursor: 'pointer', padding: '12px', border: '2px solid', 
                  borderColor: options.layout === 'combined' ? 'var(--primary-color)' : 'var(--border-color)',
                  borderRadius: '8px', textAlign: 'center',
                  backgroundColor: options.layout === 'combined' ? 'var(--primary-light)' : 'white'
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📄</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>1ページに集約</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>盤面＋リスト</div>
              </div>
              <div 
                onClick={() => setOptions({ ...options, layout: 'separate' })}
                style={{ 
                  cursor: 'pointer', padding: '12px', border: '2px solid', 
                  borderColor: options.layout === 'separate' ? 'var(--primary-color)' : 'var(--border-color)',
                  borderRadius: '8px', textAlign: 'center',
                  backgroundColor: options.layout === 'separate' ? 'var(--primary-light)' : 'white'
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📑</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>別々のページ</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>盤面 / リスト 各1枚</div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                単語リストの段数: {options.listColumns}段
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[2, 3, 4, 5, 6, 7, 8].map(cols => (
                  <button
                    key={cols}
                    onClick={() => setOptions({ ...options, listColumns: cols })}
                    style={{
                      padding: '8px',
                      border: '1px solid',
                      borderColor: options.listColumns === cols ? 'var(--primary-color)' : 'var(--border-color)',
                      backgroundColor: options.listColumns === cols ? 'var(--primary-color)' : 'white',
                      color: options.listColumns === cols ? 'white' : 'var(--text-main)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {cols}段
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>キャンセル</button>
          <button 
            disabled={!options.printProblem && !options.printAnswer}
            onClick={handlePrint} 
            className="btn-primary" 
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Printer size={18} /> 印刷する
          </button>
        </div>
      </div>
    </div>
  );
};
