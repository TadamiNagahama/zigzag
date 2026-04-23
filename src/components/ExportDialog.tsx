import React, { useState } from 'react';

export type BoardCellMode = '1x1' | '2x1' | '3x3';
export type AnswerAreaMode = '1x1' | '2x1';
export type ListPlacement = 'bottom' | 'right';
export type AlphabetPos = 'top' | 'bottom';

export interface ExportOptions {
  boardCellMode: BoardCellMode;
  boardNewline: boolean;
  alphabetPos: AlphabetPos;
  answerAreaMode: AnswerAreaMode;
  listPlacement: ListPlacement;
  listColumns: number;
  // 追加項目
  cellWidth: number;
  cellHeight1: number;
  cellHeight2: number;
  fontSizeSmall: number;
  fontSizeLarge: number;
  listFontSize: number;
  // 超モード関連
  exportMode: 'normal' | 'super';
  superLayout: 'separate' | 'single';
}

interface ExportDialogProps {
  initialOptions?: Partial<ExportOptions>;
  hasShadedCells: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ initialOptions, hasShadedCells, onClose, onExport }) => {
  const [options, setOptions] = useState<ExportOptions>({
    boardCellMode: '1x1',
    boardNewline: false,
    alphabetPos: 'top',
    answerAreaMode: '1x1',
    listPlacement: 'bottom',
    listColumns: 4,
    cellWidth: 48,
    cellHeight1: 48,
    cellHeight2: 33,
    fontSizeSmall: 10,
    fontSizeLarge: 14,
    listFontSize: 11,
    exportMode: hasShadedCells ? 'super' : 'normal',
    superLayout: 'separate',
    ...initialOptions
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(options);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Excel出力中にエラーが発生しました。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ width: '500px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Excel出力設定</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 出力タイプの設定（超モード対応） */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【出力モード】</h4>
            <div style={{ display: 'flex', gap: '20px', paddingLeft: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="exportMode" 
                  checked={options.exportMode === 'normal'} 
                  onChange={() => setOptions({ ...options, exportMode: 'normal' })}
                />
                通常
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="exportMode" 
                  checked={options.exportMode === 'super'} 
                  onChange={() => setOptions({ ...options, exportMode: 'super' })}
                />
                「超」問題・Wリスト
              </label>
            </div>
          </section>

          {/* 盤面の設定 */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【1マスのセル数とサイズ】</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="boardMode" 
                  checked={options.boardCellMode === '1x1'} 
                  onChange={() => setOptions({ ...options, boardCellMode: '1x1' })}
                />
                1マス ＝ 1セル
              </label>
              {options.boardCellMode === '1x1' && (
                <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={options.boardNewline} 
                      onChange={(e) => setOptions({ ...options, boardNewline: e.target.checked })}
                    />
                    数字と文字の間に改行を入れる
                  </label>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', alignItems: 'center' }}>
                    幅: <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellWidth} onChange={e => setOptions({...options, cellWidth: parseInt(e.target.value)||0})} />
                          <span>px</span>
                        </div>
                    高さ: <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellHeight1} onChange={e => setOptions({...options, cellHeight1: parseInt(e.target.value)||0})} />
                            <span>px</span>
                          </div>
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="boardMode" 
                  checked={options.boardCellMode === '2x1'} 
                  onChange={() => setOptions({ ...options, boardCellMode: '2x1', cellHeight1: 15, cellHeight2: 33 })}
                />
                1マス ＝ 2セル (縦に並べる)
              </label>
              {options.boardCellMode === '2x1' && (
                <div style={{ marginLeft: '24px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    幅:<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                         <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellWidth} onChange={e => setOptions({...options, cellWidth: parseInt(e.target.value)||0})} />
                         <span>px</span>
                       </div>
                    上の高さ:<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                               <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellHeight1} onChange={e => setOptions({...options, cellHeight1: parseInt(e.target.value)||0})} />
                               <span>px</span>
                             </div>
                    下の高さ:<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                               <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellHeight2} onChange={e => setOptions({...options, cellHeight2: parseInt(e.target.value)||0})} />
                               <span>px</span>
                             </div>
                  </div>
                  <div>
                    <span>アルファベットの配置:</span>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="alphaPos" 
                        checked={options.alphabetPos === 'top'} 
                        onChange={() => setOptions({ ...options, alphabetPos: 'top' })}
                      /> 上のセル
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="alphaPos" 
                        checked={options.alphabetPos === 'bottom'} 
                        onChange={() => setOptions({ ...options, alphabetPos: 'bottom' })}
                      /> 下のセル
                    </label>
                    </div>
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="boardMode" 
                  checked={options.boardCellMode === '3x3'} 
                  onChange={() => setOptions({ ...options, boardCellMode: '3x3', cellWidth: 16, cellHeight1: 16 })}
                />
                1マス ＝ 3×3セル (左上:数字、中央:文字、右下:アルファベット)
              </label>
              {options.boardCellMode === '3x3' && (
                <div style={{ marginLeft: '24px', display: 'flex', gap: '12px', fontSize: '0.85rem', alignItems: 'center' }}>
                  幅:<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                       <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellWidth} onChange={e => setOptions({...options, cellWidth: parseInt(e.target.value)||0})} />
                       <span>px</span>
                     </div>
                  高さ(1セル):<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.cellHeight1} onChange={e => setOptions({...options, cellHeight1: parseInt(e.target.value)||0})} />
                                <span>px</span>
                              </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(3x3合計で {options.cellWidth*3}x{options.cellHeight1*3} px)</span>
                </div>
              )}
            </div>
          </section>

          {/* フォント設定 */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【フォントサイズ】</h4>
            <div style={{ display: 'flex', gap: '20px', paddingLeft: '10px', fontSize: '0.85rem', alignItems: 'center' }}>
              <label>
                数字/英字: <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.fontSizeSmall} onChange={e => setOptions({...options, fontSizeSmall: parseInt(e.target.value)||10})} /> pt
              </label>
              <label>
                漢字: <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.fontSizeLarge} onChange={e => setOptions({...options, fontSizeLarge: parseInt(e.target.value)||14})} /> pt
              </label>
              <label>
                リスト: <input type="number" className="input-field" style={{ width: '50px', padding: '2px' }} value={options.listFontSize} onChange={e => setOptions({...options, listFontSize: parseInt(e.target.value)||11})} /> pt
              </label>
            </div>
          </section>

          {/* 解答欄の設定 */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【解答欄の出力形式】</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="answerMode" 
                  checked={options.answerAreaMode === '1x1'} 
                  onChange={() => setOptions({ ...options, answerAreaMode: '1x1' })}
                />
                1マス ＝ 1セル (アルファベットを左上に配置)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="answerMode" 
                  checked={options.answerAreaMode === '2x1'} 
                  onChange={() => setOptions({ ...options, answerAreaMode: '2x1' })}
                />
                1マス ＝ 2セル (縦に並べる)
              </label>
            </div>
          </section>

          {/* 単語リストの設定 */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【単語リストの設定】</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '10px' }}>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.9rem' }}>
                <span>配置場所:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="listPlace" 
                    checked={options.listPlacement === 'bottom'} 
                    onChange={() => setOptions({ ...options, listPlacement: 'bottom' })}
                  /> 盤面の下
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="listPlace" 
                    checked={options.listPlacement === 'right'} 
                    onChange={() => setOptions({ ...options, listPlacement: 'right' })}
                  /> 盤面の右
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                <label htmlFor="listCols">表示段数:</label>
                <input 
                  id="listCols"
                  type="number" 
                  min="1" 
                  max="10" 
                  className="input-field" 
                  style={{ width: '60px', padding: '4px' }}
                  value={options.listColumns}
                  onChange={(e) => setOptions({ ...options, listColumns: parseInt(e.target.value) || 1 })}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>※通常は4段程度</span>
              </div>
            </div>
          </section>

          {/* 「超」モード専用レイアウト設定 */}
          {options.exportMode === 'super' && (
            <section style={{ borderTop: '2px solid var(--primary-light)', paddingTop: '15px', marginTop: '10px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【「超」問題のレイアウト】</h4>
              <div style={{ display: 'flex', gap: '20px', paddingLeft: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="superLayout" 
                    checked={options.superLayout === 'separate'} 
                    onChange={() => setOptions({ ...options, superLayout: 'separate' })}
                  />
                  別シートに出力
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="superLayout" 
                    checked={options.superLayout === 'single'} 
                    onChange={() => setOptions({ ...options, superLayout: 'single' })}
                  />
                  同一シートに出力
                </label>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', marginLeft: '10px' }}>
                ※同一シートの場合、解答面は問題面（およびリスト）の下に配置されます（解答面には単語リストは含まれません）
              </p>
            </section>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <button className="btn-secondary" onClick={onClose} disabled={isExporting}>キャンセル</button>
          <button className="btn-primary" onClick={handleExport} disabled={isExporting}>
            {isExporting ? '出力中...' : 'Excelファイルを出力'}
          </button>
        </div>
      </div>
    </div>
  );
};
