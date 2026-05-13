import React, { useState } from 'react';
import type { ExcelImportResult, ManualImportConfig } from '../utils/excelImport';
import type { PuzzleData } from '../models/types';
import { Settings } from 'lucide-react';

interface ImportPreviewDialogProps {
  importResult: ExcelImportResult;
  currentPuzzle: PuzzleData;
  onClose: () => void;
  onImport: (config: ManualImportConfig) => void;
}

export const ImportPreviewDialog: React.FC<ImportPreviewDialogProps> = ({ importResult, currentPuzzle, onClose, onImport }) => {
  const defaultSheet = importResult.sheetNames.length > 0 ? importResult.sheetNames[0] : '';

  const [boardWidth, setBoardWidth] = useState<number>(currentPuzzle.width);
  const [boardHeight, setBoardHeight] = useState<number>(currentPuzzle.height);

  const [problemSheet, setProblemSheet] = useState(defaultSheet);
  const [problemStart, setProblemStart] = useState('');
  const [problemPatternType, setProblemPatternType] = useState<1 | 2 | 3>(currentPuzzle.patternType || 1);

  const [answerSheet, setAnswerSheet] = useState(defaultSheet);
  const [answerStart, setAnswerStart] = useState('');
  const [answerPatternType, setAnswerPatternType] = useState<1 | 2 | 3>(currentPuzzle.patternType || 1);

  const [listSheet, setListSheet] = useState(defaultSheet);
  const [listStart, setListStart] = useState('');
  const [listEnd, setListEnd] = useState('');

  const [error, setError] = useState<string | null>(null);

  const validateCellFormat = (cell: string) => {
    if (!cell) return true; // 空欄は無視（設定しない）
    return /^[A-Za-z]+[0-9]+$/.test(cell);
  };

  const handleImport = () => {
    setError(null);

    // バリデーション
    const cellsToValidate = [problemStart, answerStart, listStart, listEnd];
    if (cellsToValidate.some(c => !validateCellFormat(c))) {
      setError('セル番号は A1 や B15 のような形式で入力してください。');
      return;
    }

    if (boardWidth < 1 || boardHeight < 1 || isNaN(boardWidth) || isNaN(boardHeight)) {
      setError('盤面のサイズは1以上の数値を入力してください。');
      return;
    }

    const config: ManualImportConfig = {
      boardWidth,
      boardHeight,
      problemPatternType,
      answerPatternType
    };

    if (problemStart) {
      config.problemRange = { sheetName: problemSheet, startCell: problemStart };
    }
    if (answerStart) {
      config.answerRange = { sheetName: answerSheet, startCell: answerStart };
    }
    if (listStart && listEnd) {
      config.listRange = { sheetName: listSheet, startCell: listStart, endCell: listEnd };
    }

    onImport(config);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 4000 }}>
      <div className="modal-content glass card" style={{ width: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={24} className="text-primary" />
          Excelインポート設定
        </h2>

        <p style={{ marginBottom: '24px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          読み込みたい部分のシートとセルを指定してください。空欄の部分はインポートされません。
        </p>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
          
          {/* 盤面サイズの設定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '8px', border: '1px solid rgba(var(--primary-rgb), 0.2)' }}>
            <label style={{ fontWeight: 'bold' }}>盤面サイズ（全体設定）</label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>タテ(行):</span>
                <input type="number" min="1" className="input-glass" style={{ width: '80px' }} value={boardHeight} onChange={e => setBoardHeight(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>ヨコ(列):</span>
                <input type="number" min="1" className="input-glass" style={{ width: '80px' }} value={boardWidth} onChange={e => setBoardWidth(Number(e.target.value))} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              ※このサイズと下記の「マス目のパターン」を基に、Excelから読み取る範囲を自動計算します。
            </p>
          </div>

          {/* 問題面の設定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
            <label style={{ fontWeight: 'bold' }}>問題面</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select className="select-glass" style={{ flex: 1 }} value={problemSheet} onChange={e => setProblemSheet(e.target.value)}>
                {importResult.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" className="input-glass" style={{ width: '120px' }} placeholder="左上セル(例:B2)" value={problemStart} onChange={e => setProblemStart(e.target.value)} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>マス目のパターン</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                  <input type="radio" name="p_pattern" checked={problemPatternType === 1} onChange={() => setProblemPatternType(1)} />
                  1セル1マス
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                  <input type="radio" name="p_pattern" checked={problemPatternType === 2} onChange={() => setProblemPatternType(2)} />
                  上下2段で1マス
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                  <input type="radio" name="p_pattern" checked={problemPatternType === 3} onChange={() => setProblemPatternType(3)} />
                  3x3で1マス
                </label>
              </div>
            </div>
          </div>

          {/* 解答面の設定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
            <label style={{ fontWeight: 'bold' }}>解答面</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select className="select-glass" style={{ flex: 1 }} value={answerSheet} onChange={e => setAnswerSheet(e.target.value)}>
                {importResult.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" className="input-glass" style={{ width: '120px' }} placeholder="左上セル(例:B2)" value={answerStart} onChange={e => setAnswerStart(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>マス目のパターン</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                  <input type="radio" name="a_pattern" checked={answerPatternType === 1} onChange={() => setAnswerPatternType(1)} />
                  1セル1マス
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                  <input type="radio" name="a_pattern" checked={answerPatternType === 2} onChange={() => setAnswerPatternType(2)} />
                  上下2段で1マス
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                  <input type="radio" name="a_pattern" checked={answerPatternType === 3} onChange={() => setAnswerPatternType(3)} />
                  3x3で1マス
                </label>
              </div>
            </div>
          </div>

          {/* 単語リストの設定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
            <label style={{ fontWeight: 'bold' }}>単語リスト</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select className="select-glass" style={{ flex: 1 }} value={listSheet} onChange={e => setListSheet(e.target.value)}>
                {importResult.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" className="input-glass" style={{ width: '80px' }} placeholder="左上(B2)" value={listStart} onChange={e => setListStart(e.target.value)} />
              <span>〜</span>
              <input type="text" className="input-glass" style={{ width: '80px' }} placeholder="右下(C15)" value={listEnd} onChange={e => setListEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" onClick={handleImport}>
            この内容で取り込む
          </button>
        </div>
      </div>
    </div>
  );
};
