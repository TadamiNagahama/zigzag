import React, { useState } from 'react';
import { X, BookOpen, Edit3, CheckCircle, Layers, FileDown } from 'lucide-react';

interface HelpDialogProps {
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'intro' | 'edit' | 'answer' | 'genres' | 'export'>('intro');

  const tabs = [
    { id: 'intro', label: 'はじめに', icon: <BookOpen size={18} /> },
    { id: 'edit', label: '問題作成', icon: <Edit3 size={18} /> },
    { id: 'answer', label: '解答作成', icon: <CheckCircle size={18} /> },
    { id: 'genres', label: '特殊ジャンル', icon: <Layers size={18} /> },
    { id: 'export', label: 'Excel出力', icon: <FileDown size={18} /> },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'intro':
        return (
          <div className="help-content animate-fade-in">
            <h3>漢字ジグザグ作成ツールへようこそ</h3>
            <p>このツールは、漢字ジグザグパズルの原稿を効率的に作成し、Excelファイルとして出力するための専門エディタです。</p>

            <div className="help-section">
              <h4>基本の流れ</h4>
              <ol>
                <li><strong>盤面の編集</strong>: 番号を配置してパズルの骨組みを作ります。</li>
                <li><strong>単語の入力</strong>: リストにパズルで使用する熟語を入力します。</li>
                <li><strong>解答の作成</strong>: 盤面上でドラッグして、文字をトレースするように埋めていきます。</li>
                <li><strong>Excel出力</strong>: 完成した原稿をプロ仕様のレイアウトで出力します。</li>
              </ol>
            </div>

            <div className="help-info-box">
              <p>まずは「問題作成」タブから、パズルの土台作りについて学びましょう。</p>
            </div>
          </div>
        );
      case 'edit':
        return (
          <div className="help-content animate-fade-in">
            <h3>問題作成（盤面の編集）</h3>

            <div className="help-section">
              <h4>問題面での操作</h4>
              <ul>
                <li><strong>番号の配置</strong>: マスをクリックすると、左上から自動的に1, 2, 3...と番号が振られます。</li>
                <li><strong>大マスの入力</strong>: マスをドラッグすると、大マスを作ることができます。大マスを解除するときは、右クリックで開いたメニューの「大マスの解除」から行えます。</li>
                <li><strong>解答マスの入力</strong>: 解答にしたいマスで右クリックすると、アルファベットが入力できます。一度入力したアルファベットを削除するときも、右クリックから行います。</li>
                <li><strong>単語リスト</strong>: 番号入力後は、左側エリアにリストの入力欄が現れます。ここでリストの言葉を入力します。リストを入力すると、盤面に自動的に1文字目が入力されます。</li>
              </ul>
            </div>

            <div className="help-section">
              <h4>便利なショートカット</h4>
              <p>盤面上でマスを<strong>ドラッグ</strong>すると、連続して壁を配置したり、範囲選択を行ったりできます。</p>
            </div>
          </div>
        );
      case 'answer':
        return (
          <div className="help-content animate-fade-in">
            <h3>解答作成（トレース入力）</h3>
            <div className="help-image-container">
              <img src="/help/answer_mode.png" alt="解答入力" style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            </div>

            <div className="help-section">
              <h4>解答モードへの切り替え</h4>
              <p>画面左上のモード切替で「解答入力」を選択します。</p>
              <ul>
                <li><strong>ドラッグで入力</strong>: 数字のマスから、単語の通りにマウスをドラッグしてください。文字が自動的に流し込まれます。</li>
                <li><strong>浮遊パネル</strong>: ドラッグ中、カーソルのそばに現在入力中の単語が表示されます。これにより、次にどの文字を置くべきか一目でわかります。</li>
                <li><strong>1文字目の保護</strong>: 既に文字が入っている数字マスの上を通過しても、そのマスの文字は上書きされません。</li>
              </ul>
            </div>
          </div>
        );
      case 'genres':
        return (
          <div className="help-content animate-fade-in">
            <h3>様々なパズルジャンルへの対応</h3>
            <p>設定ダイアログから、パズルの種類を変更することで、特殊なルールにも対応できます。</p>

            <div className="help-grid">
              <div className="help-card">
                <h5>Wリスト / Wリスト★</h5>
                <p>2つの単語リストを持つ形式です。★モードでは、特定の番号にリスト2から単語が入る設定が可能です。</p>
              </div>
              <div className="help-card">
                <h5>ナンバーレス</h5>
                <p>盤面に番号を表示しない難易度の高い形式です。内部的には番号で管理されますが、出力時に番号を消すことができます。</p>
              </div>
              <div className="help-card">
                <h5>矢印モード</h5>
                <p>リストに「2文字目への方向」を示す矢印を表示するモードです。入力時に方向を検証できます。</p>
              </div>
              <div className="help-card">
                <h5>「超」問題</h5>
                <p>盤面に網掛け（グレーのマス）を配置し、そこに入る文字を特定させる形式です。「網掛け」設定から出力可能です。</p>
              </div>
            </div>
          </div>
        );
      case 'export':
        return (
          <div className="help-content animate-fade-in">
            <h3>Excel出力の設定</h3>
            <p>完成したパズルは、出版原稿としてそのまま使える品質でExcel出力されます。</p>

            <div className="help-image-container">
              <img src="/help/excel_settings.png" alt="Excel設定" style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            </div>

            <div className="help-section">
              <h4>主な設定項目</h4>
              <ul>
                <li><strong>出力モード</strong>: 「網掛け」のあり・なしを選択できます。</li>
                <li><strong>マス設定</strong>: 1マスをExcelの何セル分（1x1, 2x1, 3x3）で描画するか選べます。</li>
                <li><strong>解答欄の有無</strong>: アルファベットキー（A, B, C...）に対応した解答欄を出力します。</li>
              </ul>
            </div>

            <div className="help-tip">
              <p><strong>ヒント</strong>: 解答面では、自動的にアルファベットのマスが15%グレーで着色され、解答文字が14ptの大きさで見やすく配置されます。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '90vw', height: '600px', display: 'flex', flexDirection: 'column', backgroundColor: '#FFF9E1', border: '2px solid var(--primary-color)', position: 'relative' }}>
        <button
          className="close-button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 100,
            background: '#334155', // 濃い色の背景
            color: 'white',        // 白い×印
            borderRadius: '50%',
            padding: '6px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <X size={20} strokeWidth={3} />
        </button>

        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={20} />
            <h2 style={{ margin: 0 }}>ヘルプ・使い方ガイド</h2>
          </div>
        </div>

        <div className="help-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* サイドバー */}
          <div className="help-sidebar" style={{ width: '180px', borderRight: '1px solid rgba(0,0,0,0.1)', padding: '10px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`help-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  border: 'none',
                  background: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                  marginBottom: '4px',
                  color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-main)',
                  backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  boxShadow: activeTab === tab.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* メインコンテンツ */}
          <div className="help-main" style={{ flex: 1, padding: '30px !important', overflowY: 'auto', backgroundColor: '#FFF9E1' }}>
            <div style={{ padding: '30px' }}>
              {renderContent()}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
        </div>
      </div>

      <style>{`
        .help-modal {
          overflow: hidden !important;
        }
        .help-content h3 {
          margin-top: 0;
          color: var(--primary-color);
          border-bottom: 2px solid var(--primary-light);
          padding-bottom: 8px;
          margin-bottom: 20px;
        }
        .help-section {
          margin-bottom: 24px;
        }
        .help-section h4 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 1rem;
          color: #334155;
        }
        .help-section ul, .help-section ol {
          padding-left: 20px;
          margin-bottom: 0;
        }
        .help-section li {
          margin-bottom: 8px;
          line-height: 1.6;
        }
        .help-image-container {
          margin-bottom: 20px;
        }
        .help-info-box {
          background-color: #eff6ff;
          border-left: 4px solid #3b82f6;
          padding: 12px 16px;
          border-radius: 0 4px 4px 0;
          font-size: 0.9rem;
          color: #1e40af;
        }
        .help-tip {
          background-color: #f0fdf4;
          border-left: 4px solid #22c55e;
          padding: 12px 16px;
          border-radius: 0 4px 4px 0;
          font-size: 0.9rem;
          color: #166534;
        }
        .help-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .help-card {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
          background-color: #fff;
        }
        .help-card h5 {
          margin: 0 0 8px 0;
          color: var(--primary-color);
        }
        .help-card p {
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.5;
          color: #64748b;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
