import React, { useState } from 'react';
import { AlertDialog } from './AlertDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { type PuzzleData } from '../models/types';

interface SaveDialogProps {
  currentTitle: string;
  tags: string[];
  existingPuzzles: PuzzleData[];
  onClose: () => void;
  onSave: (title: string, tags: string[], overwriteId?: string) => Promise<void>;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ currentTitle, tags, existingPuzzles, onClose, onSave }) => {
  const [title, setTitle] = useState(currentTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null);

  const handleSaveClick = async () => {
    if (!title.trim()) {
      setAlertMsg('タイトルを入力してください。');
      return;
    }
    const existing = existingPuzzles.find(p => p.title === title.trim());
    if (existing) {
      setConfirmOverwriteId(existing.firebaseId!);
    } else {
      executeSave(title.trim(), tags, undefined);
    }
  };

  const executeSave = async (sTitle: string, sTags: string[], overwriteId?: string) => {
    setIsSaving(true);
    try {
      await onSave(sTitle, sTags, overwriteId);
      onClose();
    } catch (e) {
      console.error(e);
      setAlertMsg('保存に失敗しました。');
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ width: '400px', padding: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>クラウドに保存</h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>パズルのタイトル</label>
          <input 
            type="text" 
            className="input-field" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', fontSize: '1rem', padding: '8px' }}
            disabled={isSaving}
          />
        </div>

        {tags.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>設定されているタグ</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: '0.75rem', backgroundColor: '#edf2f7', padding: '2px 8px', borderRadius: '4px', color: '#4a5568' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>キャンセル</button>
          <button className="btn-primary" onClick={handleSaveClick} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {alertMsg && (
        <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
      )}

      {confirmOverwriteId && (
        <ConfirmDialog 
          message="同じタイトル名があります。上書きしますか？"
          confirmText="上書きする"
          isDestructive={true}
          onConfirm={() => {
            executeSave(title.trim(), tags, confirmOverwriteId);
            setConfirmOverwriteId(null);
          }}
          onCancel={() => setConfirmOverwriteId(null)}
        />
      )}
    </div>
  );
};
