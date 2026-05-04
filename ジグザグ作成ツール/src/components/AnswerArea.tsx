import React from 'react';

interface AnswerAreaProps {
  groups: string[][];
  cellSize?: number;
  charMap?: Record<string, string>;
  isRemainingAnswer?: boolean;
  remainingAnswerWord?: string;
  list2?: string[];
  onSelectRemaining?: (word: string) => void;
}

export const AnswerArea: React.FC<AnswerAreaProps> = ({ 
  groups, 
  cellSize = 40, 
  charMap = {},
  isRemainingAnswer = false,
  remainingAnswerWord = '',
  list2 = [],
  onSelectRemaining
}) => {
  return (
    <div 
      className="answer-area-wrapper"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        justifyContent: 'center',
        width: '100%',
        flexWrap: 'wrap',
        padding: '8px'
      }}
    >
      <div 
        className="answer-area" 
        style={{ 
          display: 'flex', 
          gap: '12px', 
          padding: '8px 0',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}
      >
        {groups.map((group, gIdx) => (
          <div 
            key={gIdx} 
            style={{ 
              display: 'flex', 
              borderRadius: '6px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border-color)'
            }}
          >
            {group.map((char, cIdx) => {
              // スマホではサイズを少し小さくする (40px -> 32px 程度)
              const displayCellSize = typeof window !== 'undefined' && window.innerWidth < 768 ? 32 : cellSize;
              return (
                <div 
                  key={char}
                  style={{ 
                    width: displayCellSize, 
                    height: displayCellSize, 
                    backgroundColor: 'white', 
                    borderRight: cIdx === group.length - 1 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <span style={{ 
                    position: 'absolute', 
                    top: '1px', 
                    left: '1px', 
                    fontSize: `${displayCellSize * 0.25}px`, 
                    color: 'var(--text-muted)',
                    fontWeight: 'bold',
                    lineHeight: 1
                  }}>
                    {char}
                  </span>
                  {charMap[char] && (
                    <div style={{
                      fontSize: `${displayCellSize * 0.6}px`,
                      color: 'var(--primary-color)',
                      fontWeight: 'bold',
                    }}>
                      {charMap[char]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isRemainingAnswer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '0.8rem' }}>残るもの</span>
          <div style={{ position: 'relative' }}>
            <select
              value={remainingAnswerWord}
              onChange={(e) => onSelectRemaining?.(e.target.value)}
              style={{
                minWidth: '120px',
                height: '36px',
                padding: '0 24px 0 8px',
                fontSize: '0.9rem',
                border: '2px solid var(--primary-color)',
                borderRadius: '6px',
                appearance: 'none',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                color: 'var(--text-main)'
              }}
            >
              <option value="">選択してください</option>
              {list2.filter(w => w.trim() !== '').map((word, idx) => (
                <option key={idx} value={word}>{word}</option>
              ))}
            </select>
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--primary-color)',
              fontSize: '0.7rem'
            }}>
              ▼
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .answer-area-wrapper { gap: 8px !important; }
          .answer-area { gap: 8px !important; }
        }
      `}} />
    </div>
  );
};
