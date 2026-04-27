import React from 'react';
import { FileDown, Plus, Layout as LayoutIcon, Undo2, Redo2, LogIn, LogOut, HelpCircle } from 'lucide-react';
import { type User } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  onExport: () => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onHelp: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, onExport, onNew, onSave, onLoad, 
  undo, redo, canUndo, canRedo,
  user, onLogin, onLogout, onHelp
}) => {
  return (
    <div className="layout-container">
      <header className="header glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutIcon size={24} style={{ color: 'var(--primary-color)' }} />
          <h1 className="title" style={{ marginRight: '16px' }}>漢字ジグザグ作成ツール</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={undo} 
              disabled={!canUndo} 
              className="btn-secondary" 
              style={{ padding: '6px', minWidth: '36px' }}
              title="元に戻す (Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button 
              onClick={redo} 
              disabled={!canRedo} 
              className="btn-secondary" 
              style={{ padding: '6px', minWidth: '36px' }}
              title="やり直し (Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
          </div>
        </div>
        <div className="button-group" style={{ alignItems: 'center' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px', fontSize: '0.9rem' }}>
              {user.photoURL && <img src={user.photoURL} alt="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />}
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</span>
              <button onClick={onLogout} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                <LogOut size={14} /> ログアウト
              </button>
            </div>
          ) : (
            <button onClick={onLogin} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '16px' }}>
              <LogIn size={18} /> ログイン
            </button>
          )}

          <button onClick={onNew} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={18} /> 新規作成
          </button>
          <button onClick={onLoad} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            読込
          </button>
          <button onClick={onSave} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            保存
          </button>
          <button onClick={onExport} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileDown size={18} /> Excel出力
          </button>
          <button 
            onClick={onHelp} 
            className="btn-secondary" 
            style={{ 
              padding: '8px', 
              borderRadius: '50%', 
              width: '36px', 
              height: '36px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginLeft: '4px'
            }}
            title="ヘルプ"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </header>
      <main className="content-area">
        {children}
      </main>
    </div>
  );
};
