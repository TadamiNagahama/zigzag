import React from 'react';
import { type PuzzleData, type PrintOptions } from '../models/types';

interface PrintTemplateProps {
  puzzle: PuzzleData;
  options: PrintOptions;
  alphabetGroups: string[][];
  answerChars: Record<string, string>;
}

export const PrintTemplate: React.FC<PrintTemplateProps> = ({ puzzle, options, alphabetGroups, answerChars }) => {
  const shadingColor = puzzle.shadingColor || '#e2e8f0';

  const renderAnswerArea = (isAnswer: boolean) => {
    const cellSize = 30; // 印刷用に少し小さく
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '20px', 
        justifyContent: 'center', 
        width: '100%',
        marginBottom: '15px'
      }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {alphabetGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', border: '1pt solid black' }}>
              {group.map((char, cIdx) => (
                <div key={char} style={{ 
                  width: cellSize, height: cellSize, 
                  borderRight: cIdx === group.length - 1 ? 'none' : '0.5pt solid black',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  backgroundColor: '#e2e8f0'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '94%',
                    height: '94%',
                    border: '0.5pt solid #d1d5db',
                    zIndex: 1
                  }} />
                  <span style={{ position: 'absolute', top: '1px', left: '2px', fontSize: '8pt', fontWeight: 'bold', color: '#dc2626', zIndex: 2 }}>{char}</span>
                  {isAnswer && answerChars[char] && (
                    <span style={{ fontSize: '14pt', fontWeight: 'bold', zIndex: 3 }}>{answerChars[char]}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {puzzle.isRemainingAnswer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '10pt' }}>残るもの</span>
            <div style={{ 
              width: '100px', height: '30px', border: '1.5pt solid black', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '12pt'
            }}>
              {isAnswer ? puzzle.remainingAnswerWord : ''}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGrid = (isAnswer: boolean) => {
    const width = puzzle.width;
    const height = puzzle.height;
    const containerWidth = 720;
    const cellSize = Math.floor(containerWidth / width);

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
        borderTop: '2.5pt solid black',
        borderLeft: '2.5pt solid black',
        margin: '10px auto',
        width: `${width * cellSize}px`,
        pageBreakInside: 'avoid'
      }}>
        {puzzle.cells.map((row, y) => 
          row.map((cell, x) => {
            if (cell.mergedParent) return null;
            const spanW = cell.mergedSize?.width || 1;
            const spanH = cell.mergedSize?.height || 1;

            const isShadedAndProblem = !isAnswer && cell.isShaded;
            const showNumber = !isShadedAndProblem && cell.number;
            const showChar = !isShadedAndProblem && (isAnswer ? (cell.answerChar || cell.char) : cell.char);
            const showArrow = !isShadedAndProblem && puzzle.isArrowMode && puzzle.wordDirections?.[cell.number || 0] && puzzle.wordDirections[cell.number || 0] !== '?';
            const showKey = !isShadedAndProblem && cell.answerKey;

            return (
              <div 
                key={`${x}-${y}`}
                style={{
                  gridColumn: `span ${spanW}`,
                  gridRow: `span ${spanH}`,
                  width: `${cellSize * spanW}px`,
                  height: `${cellSize * spanH}px`,
                  borderBottom: '1pt solid black',
                  borderRight: '1pt solid black',
                  backgroundColor: cell.type === 'wall' ? '#333' : (cell.answerKey ? '#e2e8f0' : (cell.isShaded ? shadingColor : 'white')),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxSizing: 'border-box'
                }}
              >
                {showNumber && (
                  <span style={{
                    position: 'absolute',
                    top: '0px',
                    left: '1px',
                    fontSize: `${cellSize * 0.3}px`,
                    fontWeight: 'bold',
                    lineHeight: 1,
                    zIndex: 3
                  }}>{cell.number}</span>
                )}
                {showChar && (
                  <span style={{
                    fontSize: `${cellSize * 0.55}px`,
                    fontWeight: 'bold',
                    zIndex: 2
                  }}>{showChar}</span>
                )}
                {showArrow && (
                  <span style={{
                    position: 'absolute',
                    top: '1px',
                    right: '2px',
                    fontSize: `${cellSize * 0.3}px`,
                    fontWeight: 'bold',
                    zIndex: 3
                  }}>{puzzle.wordDirections?.[cell.number || 0]}</span>
                )}
                {showKey && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '94%',
                      height: '94%',
                      border: '0.5pt solid #d1d5db',
                      zIndex: 1
                    }} />
                    <span style={{
                      position: 'absolute',
                      bottom: '0px',
                      right: '1px',
                      fontSize: `${cellSize * 0.3}px`,
                      fontWeight: 'bold',
                      color: '#dc2626',
                      zIndex: 2
                    }}>{cell.answerKey}</span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };
  const renderLists = () => {
    const numbers = Array.from(puzzle.cells.reduce((acc, row) => {
      row.forEach(cell => {
        if (cell.number !== null) acc.add(cell.number);
      });
      return acc;
    }, new Set<number>())).sort((a, b) => a - b);

    const colsCount = options.listColumns || 2;
    const itemsPerCol = Math.ceil(numbers.length / colsCount);
    
    // 最長単語に基づいたフォントサイズ計算
    const allWords = Object.values(puzzle.wordList || {}).filter(w => w && typeof w === 'string' && w.trim() !== '');
    const longestWordChars = allWords.length > 0 ? Math.max(...allWords.map(w => w.length), 3) : 3;
    const colWidthPt = 540 / (colsCount || 1);
    const estimatedChars = longestWordChars + 5;
    const autoFontSize = Math.max(6, Math.min(11, Math.floor(colWidthPt / (estimatedChars * 0.75))));

    const columns = [];
    for (let i = 0; i < colsCount; i++) {
      columns.push(numbers.slice(i * itemsPerCol, (i + 1) * itemsPerCol));
    }

    const renderColumn = (nums: number[]) => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {nums.map(num => (
          <div key={num} style={{ 
            display: 'flex', gap: '4px', borderBottom: '0.3pt solid #ccc', paddingBottom: '1px', 
            fontSize: `${autoFontSize}pt` 
          }}>
            <span style={{ fontWeight: 'bold', minWidth: '1.2rem' }}>{num}.</span>
            {puzzle.isArrowMode && (
              <span style={{ minWidth: '0.8rem' }}>{puzzle.wordDirections?.[num] !== '?' ? puzzle.wordDirections?.[num] : ''}</span>
            )}
            {puzzle.isWListStar && puzzle.wordStarList?.[num] && (
              <span style={{ color: shadingColor, fontWeight: 'bold' }}>★</span>
            )}
            <span style={{ flex: 1 }}>{puzzle.wordList[num] || '　　　　'}</span>
          </div>
        ))}
      </div>
    );

    return (
      <div style={{ marginTop: '15px' }}>
        <h3 style={{ borderBottom: '1.5pt solid black', paddingBottom: '2px', fontSize: '1rem', margin: '0 0 5px 0' }}>単語リスト</h3>
        <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
          {columns.map((col, idx) => (
            <React.Fragment key={idx}>
              {renderColumn(col)}
            </React.Fragment>
          ))}
        </div>
        
        {(puzzle.isWList || puzzle.isWListStar) && puzzle.wordList2 && (
          <div style={{ marginTop: '15px' }}>
            <h3 style={{ borderBottom: '1.5pt solid black', paddingBottom: '2px', fontSize: '1rem', margin: '0 0 5px 0' }}>リスト2</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${colsCount <= 3 ? 4 : (colsCount <= 5 ? 6 : 8)}, 1fr)`, 
              gap: '5px', 
              marginTop: '5px' 
            }}>
              {puzzle.wordList2.filter(w => w.trim() !== '').map((word, idx) => (
                <div key={idx} style={{ fontSize: colsCount > 5 ? '7pt' : '8pt', borderBottom: '0.3pt solid #eee' }}>・ {word}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="print-template" style={{ display: 'none' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-template, #print-template * { visibility: visible; }
          #print-template {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
          }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            padding: 10mm;
            box-sizing: border-box;
            page-break-after: always;
            overflow: hidden;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
          h2 { font-size: 16pt; margin-top: 0; }
          h3 { font-size: 11pt; }
        }
      `}</style>

      {/* 問題面ページ */}
      {options.printProblem && (
        <>
          {options.layout === 'combined' ? (
            <div className="print-page">
              <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>{puzzle.boardTitle || '漢字ジグザグパズル'}（問題）</h2>
              {renderAnswerArea(false)}
              {renderGrid(false)}
              {renderLists()}
            </div>
          ) : (
            <>
              <div className="print-page">
                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{puzzle.boardTitle || '漢字ジグザグパズル'}（問題）</h2>
                {renderAnswerArea(false)}
                <div style={{ height: '10mm' }} />
                {renderGrid(false)}
              </div>
              <div className="print-page">
                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{puzzle.boardTitle || '漢字ジグザグパズル'}（単語リスト）</h2>
                {renderLists()}
              </div>
            </>
          )}
        </>
      )}

      {/* 解答面ページ */}
      {options.printAnswer && (
        <div className="print-page">
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{puzzle.boardTitle || '漢字ジグザグパズル'}（解答）</h2>
          {renderAnswerArea(true)}
          <div style={{ height: '10mm' }} />
          {renderGrid(true)}
        </div>
      )}
    </div>
  );
};
