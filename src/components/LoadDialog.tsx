import React from 'react';
import { type PuzzleData } from '../models/types';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface LoadDialogProps {
  puzzles: PuzzleData[];
  onClose: () => void;
  onSelect: (puzzle: PuzzleData) => void;
  onDelete: (puzzleId: string) => void;
}

export const LoadDialog: React.FC<LoadDialogProps> = ({ puzzles, onClose, onSelect, onDelete }) => {
  const [deleteTarget, setDeleteTarget] = React.useState<PuzzleData | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);

  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    puzzles.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          const trimmed = t.trim();
          if (trimmed) tags.add(trimmed);
        });
      }
    });
    return Array.from(tags).sort();
  }, [puzzles]);

  const filteredPuzzles = React.useMemo(() => {
    return puzzles.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTag = !selectedTag || (p.tags && Array.isArray(p.tags) && p.tags.includes(selectedTag));
      return matchSearch && matchTag;
    });
  }, [puzzles, searchTerm, selectedTag]);

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ width: '600px', padding: '24px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '16px' }}>クラウドから読み込み</h3>

        {/* 検索・フィルタ部分 */}
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="タイトルで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '0.9rem',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              backgroundColor: 'white'
            }}
          />

          {allTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: selectedTag === null ? 'var(--primary-color)' : 'var(--border-color)',
                  backgroundColor: selectedTag === null ? 'var(--primary-light)' : 'white',
                  color: selectedTag === null ? 'var(--primary-color)' : 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                すべて
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: tag === selectedTag ? 'var(--primary-color)' : 'var(--border-color)',
                    backgroundColor: tag === selectedTag ? 'var(--primary-light)' : 'white',
                    color: tag === selectedTag ? 'var(--primary-color)' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          {filteredPuzzles.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {puzzles.length === 0 ? '保存されたパズルはありません。' : '条件に一致するパズルはありません。'}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredPuzzles.map(p => (
                <li
                  key={p.firebaseId}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => onSelect(p)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>{p.title}</span>
                      {p.tags && Array.isArray(p.tags) && p.tags.map(t => (
                        <span key={t} style={{ fontSize: '0.7rem', backgroundColor: '#edf2f7', padding: '1px 6px', borderRadius: '4px', color: '#4a5568' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {p.puzzleType || 'ノーマル'} | {new Date(p.updatedAt).toLocaleString()} | {p.width}x{p.height}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px', color: '#ef4444', border: 'none', background: 'transparent' }}
                    title="削除"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>閉じる</button>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message={`「${deleteTarget.title}」を削除してもよろしいですか？\nこの操作は取り消せません。`}
          isDestructive={true}
          confirmText="削除する"
          onConfirm={() => {
            onDelete(deleteTarget.firebaseId!);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
