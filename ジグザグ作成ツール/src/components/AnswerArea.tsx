import React from 'react';

interface AnswerAreaProps {
  groups: string[][];
  cellSize?: number;
  charMap?: Record<string, string>;
  isRemainingAnswer?: boolean;
  remainingAnswerWord?: string;
  list2?: string[];
  onSelectRemaining?: (word: string) => void;
  // 追加プロップス
  isEditingSpaces?: boolean;
  answerColumnSpaces?: string[];
  onToggleSpace?: (char: string) => void;
  onToggleEditing?: () => void;
}

export const AnswerArea: React.FC<AnswerAreaProps> = ({ 
  groups, 
  cellSize = 40, 
  charMap = {},
  isRemainingAnswer = false,
  remainingAnswerWord = '',
  list2 = [],
  onSelectRemaining,
  isEditingSpaces = false,
  answerColumnSpaces = [],
  onToggleSpace,
  onToggleEditing
}) => {
  const displayCellSize = typeof window !== 'undefined' && window.innerWidth < 768 ? 32 : cellSize;

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
          flexWrap: 'wrap',
          position: 'relative'
        }}
      >
        {groups.map((group, gIdx) => (
          <React.Fragment key={gIdx}>
            <div 
              style={{ 
                display: 'flex', 
                borderRadius: '6px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-color)',
                position: 'relative'
              }}
            >
              {group.map((char, cIdx) => {
                const isLastInGroup = cIdx === group.length - 1;
                
                return (
                  <div 
                    key={char}
                    style={{ 
                      width: displayCellSize, 
                      height: displayCellSize, 
                      backgroundColor: 'white', 
                      borderRight: isLastInGroup ? 'none' : '1px solid var(--border-color)',
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

                    {/* グループ内の境界線上の○ */}
                    {isEditingSpaces && !isLastInGroup && (
                      <div
                        onClick={() => onToggleSpace?.(char)}
                        style={{
                          position: 'absolute',
                          right: '-8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          border: '2px solid var(--primary-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 10,
                          fontSize: '10px',
                          color: 'var(--primary-color)',
                          fontWeight: 'bold',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        ○
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* グループ間の○ (スペースが空いている場所) */}
            {isEditingSpaces && gIdx < groups.length - 1 && (() => {
              const lastChar = group[group.length - 1];
              const nextGroupFirstChar = groups[gIdx + 1][0];
              if (nextGroupFirstChar.charCodeAt(0) === lastChar.charCodeAt(0) + 1) {
                return (
                  <div
                    onClick={() => onToggleSpace?.(lastChar)}
                    style={{
                      width: '12px', // gapと同じ幅
                      height: displayCellSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      marginLeft: '-12px',
                      marginRight: '-12px',
                      cursor: 'pointer',
                      zIndex: 10
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: '2px solid var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: 'var(--primary-color)',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      ○
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </React.Fragment>
        ))}

        <button
          onClick={onToggleEditing}
          className={isEditingSpaces ? "btn-primary" : "btn-secondary"}
          style={{
            padding: '4px 8px',
            fontSize: '0.4rem',
            borderRadius: '20px',
            marginLeft: '8px',
            height: '24px',
            whiteSpace: 'nowrap'
          }}
        >
          {isEditingSpaces ? "編集終了" : "スペース編集"}
        </button>
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
