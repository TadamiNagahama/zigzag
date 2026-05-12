import { Plus, Layout as LayoutIcon, Undo2, Redo2, LogIn, HelpCircle, CheckCircle, Save, FolderOpen, Settings, List, Grid3X3, Square } from 'lucide-react';
import { type User } from 'firebase/auth';
import excelIcon from '../../assets/excel.png';

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
  onSettings: () => void;
  activeTab: 'board' | 'list';
  onTabChange: (tab: 'board' | 'list') => void;
  appMode: 'shade' | 'edit' | 'answer';
  onModeChange: (mode: 'shade' | 'edit' | 'answer') => void;
  onImportExcel?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, onExport, onNew, onSave, onLoad, 
  undo, redo, canUndo, canRedo,
  user, onLogin, onLogout, onHelp, onSettings,
  activeTab, onTabChange,
  appMode, onModeChange,
  onImportExcel
}) => {
  return (
    <div className="layout-container">
      <header className="header glass">
        <div className="header-inner">
          <div className="header-title-area">
            <LayoutIcon size={24} className="header-icon" style={{ color: 'var(--primary-color)' }} />
            <h1 className="title">漢字ジグザグ作成ツール</h1>
          </div>

          <nav className="header-menu">
            <div className="menu-group undo-redo">
              <button onClick={undo} disabled={!canUndo} className="btn-secondary menu-btn undo-btn" title="元に戻す">
                <Undo2 size={16} /><span className="btn-text">戻る</span>
              </button>
              <button onClick={redo} disabled={!canRedo} className="btn-secondary menu-btn redo-btn" title="やり直し">
                <Redo2 size={16} /><span className="btn-text">進む</span>
              </button>
            </div>

            <div className="menu-group auth-group">
              {user ? (
                <button onClick={onLogout} className="btn-secondary menu-btn logout-btn" style={{ flexDirection: 'row' }}>
                  {user.photoURL && <img src={user.photoURL} alt="avatar" className="user-avatar" />}
                  <span className="btn-text">ログアウト</span>
                </button>
              ) : (
                <button onClick={onLogin} className="btn-secondary menu-btn login-btn" style={{ flexDirection: 'row' }}>
                  <LogIn size={16} /> <span className="btn-text">ログイン</span>
                </button>
              )}
            </div>

            <div className="menu-group action-group">
              <button onClick={onNew} className="btn-secondary menu-btn new-btn">
                <Plus size={16} /> <span className="btn-text">新規作成</span>
              </button>
              <button onClick={onLoad} className="btn-secondary menu-btn load-btn">
                <FolderOpen size={16} /> <span className="btn-text">読込</span>
              </button>
              <button onClick={onSave} className="btn-secondary menu-btn save-btn">
                <Save size={16} /> <span className="btn-text">保存</span>
              </button>
              {onImportExcel && (
                <button onClick={onImportExcel} className="btn-secondary menu-btn import-btn">
                  <FolderOpen size={16} /> <span className="btn-text"><span className="excel-word-pc">Excel</span>読込</span>
                </button>
              )}
              <button onClick={onExport} className="btn-primary menu-btn excel-btn">
                <img src={excelIcon} alt="Excel" className="excel-icon" />
                <span className="btn-text"><span className="excel-word-pc">Excel</span>出力</span>
              </button>
            </div>

            <div 
              onClick={onHelp} 
              className="help-icon-wrapper" 
              title="ヘルプ"
              style={{ 
                cursor: 'pointer', 
                color: 'var(--text-muted)',
                marginLeft: '8px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <HelpCircle size={20} />
            </div>
          </nav>
        </div>
      </header>

      <main className="content-area">
        {children}
      </main>

      <div className="mobile-nav glass">
        {/* 盤面グループ */}
        <div className="nav-group">
          <div className="nav-group-label">盤面</div>
          <div className="nav-buttons">
            <button 
              onClick={() => { onTabChange('board'); onModeChange('shade'); }}
              className={`mobile-nav-btn mode-btn ${activeTab === 'board' && appMode === 'shade' ? 'active' : ''}`}
            >
              <Square size={16} />
              <span>網掛け</span>
            </button>
            <button 
              onClick={() => { onTabChange('board'); onModeChange('edit'); }}
              className={`mobile-nav-btn mode-btn ${activeTab === 'board' && appMode === 'edit' ? 'active' : ''}`}
            >
              <Grid3X3 size={16} />
              <span>問題面</span>
            </button>
            <button 
              onClick={() => { onTabChange('board'); onModeChange('answer'); }}
              className={`mobile-nav-btn mode-btn ${activeTab === 'board' && appMode === 'answer' ? 'active' : ''}`}
            >
              <CheckCircle size={16} />
              <span>解答面</span>
            </button>
          </div>
        </div>

        {/* リストボタン */}
        <button 
          onClick={() => onTabChange('list')}
          className={`mobile-nav-btn ${activeTab === 'list' ? 'active' : ''}`}
        >
          <List size={20} />
          <span>リスト</span>
        </button>

        {/* 設定ボタン */}
        <button 
          onClick={onSettings}
          className="mobile-nav-btn"
        >
          <Settings size={20} />
          <span>設定</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .layout-container { 
            padding-bottom: 70px; 
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .content-area {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
        }
      `}} />
    </div>
  );
};
