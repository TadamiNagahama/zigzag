import React, { useState, useEffect } from 'react';
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
  wordStarList?: Record<number, boolean>;
  isWList?: boolean;
  isWListStar?: boolean;
  shadingColor?: string;
}

export const Grid: React.FC<GridProps> = ({ cells, onCellClick, onCellRightClick, onDragSelection, onDragPath, cellSize = 40, appMode = 'edit', focusedCell = null, composingText = '', wordStarList = {}, isWList = false, isWListStar = false, shadingColor = '#e2e8f0' }) => {
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragPath, setDragPath] = useState<{ x: number, y: number }[]>([]);

  const handleMouseDown = (x: number, y: number, event: React.MouseEvent) => {
    if (event.button === 0) { // 左クリックのみ
      setDragStart({ x, y });
      setDragPath([{ x, y }]);
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
      style={{ 
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
        borderTop: '1px solid var(--border-color)',
        borderLeft: '1px solid var(--border-color)',
        boxSizing: 'content-box'
      }}
    >
      {cells.map((row, y) => 
        row.map((cell, x) => {
          // 結合されているマスの実体（親以外）は描画しない
          if (cell.mergedParent) return null;

          const spanW = cell.mergedSize?.width || 1;
          const spanH = cell.mergedSize?.height || 1;

          // ドラッグ選択中のハイライト判定
          const isInDrag = dragPath.some(p => p.x === x && p.y === y);
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
                backgroundColor: cell.type === 'wall' ? 'var(--wall-color)' : ((cell.isShaded && (appMode === 'answer' || isWList || isWListStar)) ? shadingColor : 'white'),
                backgroundImage: (cell.isShaded && (appMode === 'answer' || isWList || isWListStar)) ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' : 'none',
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
                outline: isFocused ? '3px solid var(--accent-color)' : (cell.mergedSize ? '2px solid var(--primary-color)' : 'none'),
                outlineOffset: '-3px',
                boxSizing: 'border-box',
                zIndex: isFocused ? 10 : (cell.mergedSize ? 5 : 1)
              }}
            >
              {/* Layer 3: 数字 */}
              {cell.number && (
                <span className="cell-number" style={{
                  position: 'absolute',
                  top: '2px',
                  left: '4px',
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
                fontWeight: 'bold',
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
                <span className="answer-key" style={{ 
                  fontSize: `${cellSize * 0.25}px`,
                  position: 'absolute',
                  bottom: '2px',
                  right: '4px',
                  color: 'var(--text-muted)',
                  display: (appMode === 'shade' && cell.isShaded) ? 'none' : 'block'
                }}>
                  {cell.answerKey}
                </span>
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
    </div>
  );
};
