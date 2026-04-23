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

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ width: '500px', padding: '24px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '16px' }}>クラウドから読み込み</h3>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          {puzzles.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>保存されたパズルはありません。</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {puzzles.map(p => (
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
                    <div style={{ fontWeight: 'bold' }}>{p.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      最終更新: {new Date(p.updatedAt).toLocaleString()} | サイズ: {p.width}x{p.height}
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
