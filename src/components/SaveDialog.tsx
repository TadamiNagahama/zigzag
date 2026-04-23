import React, { useState } from 'react';
import { AlertDialog } from './AlertDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { type PuzzleData } from '../models/types';

interface SaveDialogProps {
  currentTitle: string;
  existingPuzzles: PuzzleData[];
  onClose: () => void;
  onSave: (title: string, overwriteId?: string) => Promise<void>;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ currentTitle, existingPuzzles, onClose, onSave }) => {
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
      executeSave(title.trim(), undefined);
    }
  };

  const executeSave = async (sTitle: string, overwriteId?: string) => {
    setIsSaving(true);
    try {
      await onSave(sTitle, overwriteId);
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
        <div style={{ marginBottom: '20px' }}>
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
            executeSave(title.trim(), confirmOverwriteId);
            setConfirmOverwriteId(null);
          }}
          onCancel={() => setConfirmOverwriteId(null)}
        />
      )}
    </div>
  );
};
