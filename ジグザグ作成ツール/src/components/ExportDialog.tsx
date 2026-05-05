import React, { useState } from 'react';

export type BoardCellMode = '1x1' | '2x1' | '3x3';
export type AnswerAreaMode = '1x1' | '2x1';
export type ListPlacement = 'bottom' | 'right' | 'separate';
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
  fontName: string;
  fontSizeSmall: number;
  fontSizeLarge: number;
  listFontSize: number;
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
    fontName: 'MS Pゴシック',
    fontSizeSmall: 10,
    fontSizeLarge: 14,
    listFontSize: 11,
    superLayout: 'separate',
    ...initialOptions
  });
  const [isExporting, setIsExporting] = useState(false);
  const [localFonts, setLocalFonts] = useState<string[]>([]);
  const [availablePresets, setAvailablePresets] = useState<string[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(false);

  // フォントが利用可能かチェックする関数
  const isFontAvailable = (fontName: string) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return false;
    
    // 幅の差が出やすい文字列（英数字 + 日本語）
    const text = 'mmmmmmmiiiiii111111漢字';
    const fontSize = 72;
    
    const checkWithFallback = (fallback: string) => {
      // 指定フォント + 候補
      context.font = `${fontSize}px "${fontName}", ${fallback}`;
      const widthWithFont = context.measureText(text).width;
      
      // 候補のみ
      context.font = `${fontSize}px ${fallback}`;
      const widthWithFallback = context.measureText(text).width;
      
      // 幅が異なれば、指定フォントが適用されている（存在している）と判断
      return widthWithFont !== widthWithFallback;
    };

    // セリフ、サンセリフ、等幅のいずれかと比較して差があれば存在するとみなす
    // (MSゴシックのような等幅フォントはmonospaceと同じ幅になる可能性があるため、serifとも比較する)
    return checkWithFallback('serif') || checkWithFallback('sans-serif') || checkWithFallback('monospace');
  };

  // 初期化時にプリセットをチェック
  React.useEffect(() => {
    const fontGroups = [
      { id: 'MS Pゴシック', names: ['MS Pゴシック', 'ＭＳ Ｐゴシック', 'MS PGothic'] },
      { id: 'MS ゴシック', names: ['MS ゴシック', 'ＭＳ ゴシック', 'MS Gothic'] },
      { id: 'MS P明朝', names: ['MS P明朝', 'ＭＳ Ｐ明朝', 'MS PMincho'] },
      { id: 'MS 明朝', names: ['MS 明朝', 'ＭＳ 明朝', 'MS Mincho'] },
      { id: '游ゴシック', names: ['游ゴシック', 'Yu Gothic'] },
      { id: '游明朝', names: ['游明朝', 'Yu Mincho'] },
      { id: 'メイリオ', names: ['メイリオ', 'Meiryo'] },
      { id: 'HG丸ｺﾞｼｯｸM-PRO', names: ['HG丸ｺﾞｼｯｸM-PRO', 'HGMaruGothicMPRO'] },
      { id: 'ヒラギノ角ゴ ProN', names: ['ヒラギノ角ゴ ProN', 'Hiragino Kaku Gothic ProN'] },
      { id: 'ヒラギノ明朝 ProN', names: ['ヒラギノ明朝 ProN', 'Hiragino Mincho ProN'] }
    ];

    const available: string[] = [];
    for (const group of fontGroups) {
      // グループ内のいずれかの名前で検知できればOK
      const isAvailable = group.names.some(name => isFontAvailable(name));
      if (isAvailable) {
        available.push(group.id);
      }
    }

    setAvailablePresets(available);
    
    // 初期値が利用不可な場合のフォールバック
    if (available.length > 0 && !available.includes(options.fontName)) {
      setOptions(prev => ({ ...prev, fontName: available[0] }));
    }
  }, []);

  const handleGetFonts = async () => {
    if ('queryLocalFonts' in window) {
      setIsLoadingFonts(true);
      try {
        const fonts = await (window as any).queryLocalFonts();
        // 重複を除去して名前のリストを作成
        const names = Array.from(new Set(fonts.map((f: any) => f.fullName || f.family))) as string[];
        names.sort();
        setLocalFonts(names);
      } catch (e) {
        console.error('Font access denied or error:', e);
        alert('フォントへのアクセスが拒否されたか、エラーが発生しました。');
      } finally {
        setIsLoadingFonts(false);
      }
    } else {
      alert('お使いのブラウザはフォント一覧の取得に対応していません。最新のChromeまたはEdgeをご使用ください。');
    }
  };

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
      <div className="modal-content glass card" style={{ width: '550px', maxWidth: '95vw', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Excel出力設定</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 盤面の設定 */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【1マスのセル数とサイズ】</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '10px' }}>
              {/* モード選択 */}
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="radio" name="boardMode" checked={options.boardCellMode === '1x1'} onChange={() => setOptions({ ...options, boardCellMode: '1x1', cellWidth: 48, cellHeight1: 48 })} />
                  1マス＝1セル
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="radio" name="boardMode" checked={options.boardCellMode === '2x1'} onChange={() => setOptions({ ...options, boardCellMode: '2x1', cellWidth: 48, cellHeight1: 15, cellHeight2: 33 })} />
                  1マス＝2セル
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="radio" name="boardMode" checked={options.boardCellMode === '3x3'} onChange={() => setOptions({ ...options, boardCellMode: '3x3', cellWidth: 16, cellHeight1: 16 })} />
                  1マス＝3×3
                </label>
              </div>

              {/* サイズプリセット (横並び) */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>標準設定:</span>
                {options.boardCellMode === '3x3' ? (
                  <>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setOptions({ ...options, cellWidth: 16, cellHeight1: 16 })}>標準 (16px)</button>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setOptions({ ...options, cellWidth: 18, cellHeight1: 18 })}>少し大 (18px)</button>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setOptions({ ...options, cellWidth: 21, cellHeight1: 21 })}>大きめ (21px)</button>
                  </>
                ) : (
                  <>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setOptions({ ...options, cellWidth: 48, cellHeight1: (options.boardCellMode === '1x1' ? 48 : 15), cellHeight2: (options.boardCellMode === '2x1' ? 33 : options.cellHeight2) })}>標準 (48px)</button>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setOptions({ ...options, cellWidth: 60, cellHeight1: (options.boardCellMode === '1x1' ? 60 : 18), cellHeight2: (options.boardCellMode === '2x1' ? 42 : options.cellHeight2) })}>大きめ (60px)</button>
                  </>
                )}
              </div>

              {/* サイズ指定 & プレビュー */}
              <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '12px', marginTop: '5px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {/* 数値入力エリア */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '60px', textAlign: 'right' }}>幅:</span>
                      <input type="number" step="1" className="input-field" style={{ width: '55px', textAlign: 'center' }} value={options.cellWidth} onChange={e => setOptions({ ...options, cellWidth: parseFloat(e.target.value) || 0 })} />
                      <span style={{ fontSize: '0.85rem', width: '20px' }}>px</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', minWidth: '80px' }}>Excel: {((options.cellWidth - 5) / 8).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '60px', textAlign: 'right' }}>{options.boardCellMode === '2x1' ? '高さ(上):' : '高さ:'}</span>
                      <input type="number" step="1" className="input-field" style={{ width: '55px', textAlign: 'center' }} value={options.cellHeight1} onChange={e => setOptions({ ...options, cellHeight1: parseFloat(e.target.value) || 0 })} />
                      <span style={{ fontSize: '0.85rem', width: '20px' }}>px</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', minWidth: '80px' }}>Excel: {(options.cellHeight1 * 0.75).toFixed(1)}pt</span>
                    </div>
                    {options.boardCellMode === '2x1' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '60px', textAlign: 'right' }}>高さ(下):</span>
                        <input type="number" step="1" className="input-field" style={{ width: '55px', textAlign: 'center' }} value={options.cellHeight2} onChange={e => setOptions({ ...options, cellHeight2: parseFloat(e.target.value) || 0 })} />
                        <span style={{ fontSize: '0.85rem', width: '20px' }}>px</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', minWidth: '80px' }}>Excel: {(options.cellHeight2 * 0.75).toFixed(1)}pt</span>
                      </div>
                    )}
                  </div>

                  {/* プレビュー表示エリア */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>プレビュー</div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px',
                      border: '1px dashed var(--border-color)',
                      background: 'white',
                      minWidth: '100px',
                      minHeight: '100px',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {options.boardCellMode === '3x3' ? (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '0',
                          border: '2px solid var(--primary-color)',
                          background: 'white',
                          boxSizing: 'content-box'
                        }}>
                          {[...Array(9)].map((_, i) => (
                            <div key={i} style={{
                              width: `${Math.min(20, options.cellWidth)}px`,
                              height: `${Math.min(20, options.cellHeight1)}px`,
                              border: '0.2px solid var(--primary-color)',
                              boxSizing: 'border-box',
                              background: 'var(--primary-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.6rem',
                              fontWeight: 'bold',
                              color: 'var(--primary-color)'
                            }}>
                              {i === 0 ? '1' : (i === 4 ? '字' : '')}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ border: '2px solid var(--primary-color)' }}>
                          <div style={{
                            width: `${Math.min(60, options.cellWidth)}px`,
                            height: `${Math.min(60, options.cellHeight1)}px`,
                            background: 'var(--primary-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: 'var(--primary-color)',
                            lineHeight: '1.1',
                            textAlign: 'center',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {options.boardCellMode === '2x1' ? '1' : (options.boardNewline ? '1\n字' : '1字')}
                          </div>
                          {options.boardCellMode === '2x1' && (
                            <div style={{
                              width: `${Math.min(60, options.cellWidth)}px`,
                              height: `${Math.min(60, options.cellHeight2)}px`,
                              borderTop: '1px solid var(--primary-color)',
                              background: 'var(--primary-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: 'var(--primary-color)'
                            }}>
                              字
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {options.boardCellMode === '1x1' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={options.boardNewline} onChange={(e) => setOptions({ ...options, boardNewline: e.target.checked })} />
                  数字と文字の間に改行を入れる
                </label>
              )}

              {options.boardCellMode === '2x1' && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span>アルファベットの配置:</span>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" name="alphaPos" checked={options.alphabetPos === 'top'} onChange={() => setOptions({ ...options, alphabetPos: 'top' })} /> 上のセル
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" name="alphaPos" checked={options.alphabetPos === 'bottom'} onChange={() => setOptions({ ...options, alphabetPos: 'bottom' })} /> 下のセル
                    </label>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* フォント設定 */}
          <section>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '10px' }}>【フォント】</h4>
            <div style={{ paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>フォント名:</span>
                  <select
                    className="input-field"
                    style={{ flex: '1 1 200px', padding: '4px', minWidth: '0' }}
                    value={options.fontName}
                    onChange={e => setOptions({ ...options, fontName: e.target.value })}
                  >
                    <optgroup label="PCにインストール済みのフォント">
                      {availablePresets.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </optgroup>
                    {localFonts.length > 0 && (
                      <optgroup label="すべてのフォント">
                        {localFonts.filter(f => !availablePresets.includes(f)).map(font => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {localFonts.length === 0 && (
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '4px 8px', whiteSpace: 'nowrap', flex: '0 0 auto' }}
                      onClick={handleGetFonts}
                      disabled={isLoadingFonts}
                    >
                      {isLoadingFonts ? '読込中...' : 'PCのフォントを読込'}
                    </button>
                  )}
                </div>
                
                {localFonts.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>※直接入力可:</span>
                    <input
                      type="text"
                      className="input-field"
                      style={{ flex: '1 1 150px', padding: '2px 8px', fontSize: '0.8rem', minWidth: '0' }}
                      value={options.fontName}
                      onChange={e => setOptions({ ...options, fontName: e.target.value })}
                      placeholder="フォント名を正確に入力"
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ whiteSpace: 'nowrap' }}>
                  数字/英字: <input type="number" className="input-field" style={{ width: '45px', padding: '2px' }} value={options.fontSizeSmall} onChange={e => setOptions({ ...options, fontSizeSmall: parseInt(e.target.value) || 10 })} /> pt
                </label>
                <label style={{ whiteSpace: 'nowrap' }}>
                  漢字: <input type="number" className="input-field" style={{ width: '45px', padding: '2px' }} value={options.fontSizeLarge} onChange={e => setOptions({ ...options, fontSizeLarge: parseInt(e.target.value) || 14 })} /> pt
                </label>
                <label style={{ whiteSpace: 'nowrap' }}>
                  リスト: <input type="number" className="input-field" style={{ width: '45px', padding: '2px' }} value={options.listFontSize} onChange={e => setOptions({ ...options, listFontSize: parseInt(e.target.value) || 11 })} /> pt
                </label>
              </div>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="listPlace"
                    checked={options.listPlacement === 'separate'}
                    onChange={() => setOptions({ ...options, listPlacement: 'separate' })}
                  /> シート単独
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>※ノーマルは4段程度</span>
              </div>
            </div>
          </section>

          {/* 「超」モード専用レイアウト設定 */}
          {hasShadedCells && (
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
