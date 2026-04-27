import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type Cell } from '../models/types';

interface GridProps {
  cells: Cell[][];
  onCellClick: (x: number, y: number) => void;
  onCellRightClick: (x: number, y: number, event: React.MouseEvent) => void;
  onDragSelection: (x1: number, y1: number, x2: number, y2: number) => void;
  onDragPath?: (path: { x: number, y: number }[]) => void;
  cellSize?: number;
  isSuperMode?: boolean; // Deprecated
  appMode?: 'shade' | 'edit' | 'answer';
  focusedCell?: { x: number, y: number } | null;
  composingText?: string;
  isWList?: boolean;
  isWListStar?: boolean;
  shadingColor?: string;
  wordList?: Record<number, string>;
  boardFontWeight?: 'normal' | 'bold';
  boardFontFamily?: string;
}

export const Grid: React.FC<GridProps> = ({ cells, onCellClick, onCellRightClick, onDragSelection, onDragPath, cellSize = 40, appMode = 'edit', focusedCell = null, composingText = '', isWList = false, isWListStar = false, shadingColor = '#e2e8f0', wordList = {}, boardFontWeight = 'normal', boardFontFamily = '' }) => {
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragPath, setDragPath] = useState<{ x: number, y: number }[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragStartMousePos, setDragStartMousePos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (x: number, y: number, event: React.MouseEvent) => {
    if (event.button === 0) { // 左クリックのみ
      setDragStart({ x, y });
      setDragPath([{ x, y }]);
      setDragStartMousePos({ x: event.clientX, y: event.clientY });
      setMousePos({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseEnter = (x: number, y: number) => {
    if (dragStart) {
      setDragPath(prev => {
        // 重複を避ける
        if (prev.length > 0 && prev[prev.length - 1].x === x && prev[prev.length - 1].y === y) return prev;
        return [...prev, { x, y }];
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragPath.length > 0) {
      if (dragPath.length === 1) {
        onCellClick(dragStart.x, dragStart.y);
      } else {
        if (onDragPath) {
          onDragPath(dragPath);
        } else {
          // 下位互換性のため
          const last = dragPath[dragPath.length - 1];
          onDragSelection(dragStart.x, dragStart.y, last.x, last.y);
        }
      }
    }
    setDragStart(null);
    setDragPath([]);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDragStart(null);
      setDragPath([]);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const width = cells[0]?.length || 0;
  const height = cells.length;

  return (
    <div 
      className="grid-container" 
      onMouseLeave={() => { setDragStart(null); setDragPath([]); }}
      onMouseMove={handleMouseMove}
      style={{ 
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
        borderStyle: 'solid',
        borderColor: 'var(--border-color)',
        borderWidth: '2.5px 1.5px 1.5px 2.5px', // 上・右・下・左 (右下はマスの1pxと合算)
        boxSizing: 'content-box',
        position: 'relative'
      }}
    >
      {cells.map((row, y) => 
        row.map((cell, x) => {
          // 結合されているマスの実体（親以外）は描画しない
          if (cell.mergedParent) return null;

          const spanW = cell.mergedSize?.width || 1;
          const spanH = cell.mergedSize?.height || 1;

          // ドラッグ選択中のハイライト判定
          const lastPoint = dragPath[dragPath.length - 1];
          const isInDrag = (appMode === 'edit' && dragStart && lastPoint)
            ? (x >= Math.min(dragStart.x, lastPoint.x) && x <= Math.max(dragStart.x, lastPoint.x) &&
               y >= Math.min(dragStart.y, lastPoint.y) && y <= Math.max(dragStart.y, lastPoint.y))
            : dragPath.some(p => p.x === x && p.y === y);
          const isFocused = focusedCell && focusedCell.x === x && focusedCell.y === y;

          return (
            <div
              key={`${x}-${y}`}
              className={`grid-cell ${cell.type} ${isInDrag ? 'drag-selected' : ''}`}
              onMouseDown={(e) => handleMouseDown(x, y, e)}
              onMouseEnter={() => handleMouseEnter(x, y)}
              onMouseUp={handleMouseUp}
              onContextMenu={(e) => {
                e.preventDefault();
                onCellRightClick(x, y, e);
              }}
              style={{
                gridColumn: `span ${spanW}`,
                gridRow: `span ${spanH}`,
                // 枠線を考慮したサイズ計算
                width: cellSize * spanW,
                height: cellSize * spanH,
                backgroundColor: cell.type === 'wall' ? 'var(--wall-color)' : (cell.answerKey ? '#e2e8f0' : (cell.isShaded && (appMode === 'answer' || isWList || isWListStar)) ? shadingColor : 'white'),
                backgroundImage: (cell.isShaded && (appMode === 'answer' || isWList || isWListStar) && !cell.answerKey) ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                fontSize: `${cellSize * 0.5}px`,
                fontWeight: 500,
                // 下と右に枠線を引くことで重なりを防ぎ、等幅を実現
                borderBottom: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                outline: isFocused ? '3px solid var(--accent-color)' : 'none',
                outlineOffset: '-3px',
                boxSizing: 'border-box',
                zIndex: isFocused ? 10 : (cell.mergedSize ? 5 : 1)
              }}
            >
              {/* Layer 3: 数字 */}
              {cell.number && (
                <span className="cell-number" style={{
                  position: 'absolute',
                  top: '1px',
                  left: '1px',
                  fontSize: `${cellSize * 0.3}px`,
                  lineHeight: '1',
                  color: 'var(--text-main)',
                  fontWeight: 'bold',
                  zIndex: 3
                }}>
                  {cell.number}
                </span>
              )}

              {/* Layer 3 & 1: 文字データ (提示文字 or 解答文字) */}
              <span className="cell-char" style={{ 
                color: 'var(--text-main)',
                fontWeight: boardFontWeight,
                fontFamily: boardFontFamily || 'inherit',
                fontSize: `${cellSize * 0.55}px`,
                textDecoration: (isFocused && composingText) ? 'underline wavy var(--accent-color)' : 'none',
                opacity: (isFocused && composingText) ? 0.7 : 1,
                zIndex: 2,
                position: 'relative',
                display: (appMode === 'shade' && cell.isShaded) ? 'none' : 'block'
              }}>
                {(isFocused && composingText) ? composingText : (appMode === 'answer' ? (cell.answerChar || cell.char) : cell.char)}
              </span>

              {cell.answerKey && (
                <>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '94%',
                    height: '94%',
                    border: '1px solid #d1d5db',
                    pointerEvents: 'none',
                    zIndex: 1
                  }} />
                  <span className="answer-key" style={{ 
                    fontSize: `${cellSize * 0.3}px`,
                    position: 'absolute',
                    bottom: '1px',
                    right: '1px',
                    color: '#dc2626',
                    fontWeight: 'bold',
                    display: (appMode === 'shade' && cell.isShaded) ? 'none' : 'block',
                    zIndex: 2
                  }}>
                    {cell.answerKey}
                  </span>
                </>
              )}

              {/* Layer 2: 前面網掛け (文字を覆う) - 網掛けモード or Wリストモード時 */}
              {((appMode === 'shade' && cell.isShaded) || ((isWList || isWListStar) && cell.isShaded && appMode === 'edit')) && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: (isWList || isWListStar) ? 'transparent' : shadingColor,
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
                  zIndex: 4,
                  pointerEvents: 'none' // 下のマスをクリックできるようにする
                }} />
              )}
            </div>
          );
        })
      )}

      {/* トレース・ヘルプパネル (ドラッグ中のみ表示) */}
      {dragStart && appMode === 'answer' && (() => {
        const startCell = cells[dragStart.y][dragStart.x];
        const word = startCell.number ? wordList[startCell.number] : null;
        if (!word) return null;

        // 起点の初期位置を基準にする（ずっとカーソルを追従させない）
        const panelHeight = 55;
        let left = dragStartMousePos.x + 30;
        let top = dragStartMousePos.y - 75;
        
        // パネル幅の概算 (nowrapによる長尺化に対応)
        const panelEstimatedWidth = Math.min(600, word.length * 20 + 30);
        
        // パネルが右端にはみ出る場合は左側にフリップ
        if (left + panelEstimatedWidth > window.innerWidth - 10) {
          left = dragStartMousePos.x - panelEstimatedWidth - 30;
        }

        // それでも左端にはみ出る（非常に長い単語）場合は画面内に収める
        if (left < 10) left = 10;
        if (left + panelEstimatedWidth > window.innerWidth - 10) {
          left = window.innerWidth - panelEstimatedWidth - 10;
        }
        
        // カーソルがパネルに近づいた（重なりそうになった）ら、上下をフリップして逃げる
        const isOverlapX = mousePos.x >= left - 15 && mousePos.x <= left + panelEstimatedWidth + 15;
        const isOverlapY = mousePos.y >= top - 15 && mousePos.y <= top + panelHeight + 15;
        
        if (isOverlapX && isOverlapY) {
           if (top < dragStartMousePos.y) {
             top = dragStartMousePos.y + 45; // 下へ逃げる
           } else {
             top = dragStartMousePos.y - 75; // 上へ逃げる
           }
        }

        // 画面の上下端からはみ出さないようにクランプする（画面外消え防止）
        if (top + panelHeight > window.innerHeight - 10) {
           top = window.innerHeight - panelHeight - 10;
        }
        if (top < 10) {
           top = 10;
        }

        return createPortal(
          <div style={{
            position: 'fixed',
            left,
            top,
            backgroundColor: 'rgba(99, 102, 241, 0.50)', // メインカラーの50%透過
            color: 'black',
            padding: '6px 12px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.3)',
            whiteSpace: 'nowrap' // 縦書きになるのを防ぐ
          }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '2px' }}>{startCell.number}番の単語</div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 'bold', 
              letterSpacing: '0.2rem',
              textShadow: '0 1px 2px rgba(255,255,255,0.7)',
              whiteSpace: 'nowrap'
            }}>
              {word}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
