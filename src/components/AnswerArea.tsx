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
        gap: '32px',
        justifyContent: 'center',
        width: '100%'
      }}
    >
      <div 
        className="answer-area" 
        style={{ 
          display: 'flex', 
          gap: '24px', 
          padding: '12px 0',
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
            {group.map((char, cIdx) => (
              <div 
                key={char}
                style={{ 
                  width: cellSize, 
                  height: cellSize, 
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
                  top: '2px', 
                  left: '2px', 
                  fontSize: `${cellSize * 0.25}px`, 
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  lineHeight: 1
                }}>
                  {char}
                </span>
                {charMap[char] && (
                  <div style={{
                    fontSize: `${cellSize * 0.5}px`,
                    color: 'var(--primary-color)',
                    fontWeight: 'bold',
                  }}>
                    {charMap[char]}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {isRemainingAnswer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '0.9rem' }}>残るもの</span>
          <div style={{ position: 'relative' }}>
            <select
              value={remainingAnswerWord}
              onChange={(e) => onSelectRemaining?.(e.target.value)}
              style={{
                width: cellSize * 5,
                height: cellSize,
                padding: '0 12px',
                fontSize: '1rem',
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
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--primary-color)'
            }}>
              ▼
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
