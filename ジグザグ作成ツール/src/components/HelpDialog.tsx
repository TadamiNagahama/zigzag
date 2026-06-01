import React, { useState } from 'react';
import { X, BookOpen, Monitor, Edit3, CheckCircle, Layers, FileDown, Lock, Database, Mail, Shield, MessageSquare } from 'lucide-react';

interface HelpDialogProps {
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'intro' | 'main' | 'edit' | 'answer' | 'genres' | 'export' | 'security' | 'contact'>('intro');

  const tabs = [
    { id: 'intro', label: 'はじめに', icon: <BookOpen size={18} /> },
    { id: 'main', label: 'メイン画面', icon: <Monitor size={18} /> },
    { id: 'edit', label: '問題作成', icon: <Edit3 size={18} /> },
    { id: 'answer', label: '解答作成', icon: <CheckCircle size={18} /> },
    { id: 'genres', label: '特殊ジャンル', icon: <Layers size={18} /> },
    { id: 'export', label: 'Excel読込・出力', icon: <FileDown size={18} /> },
    { id: 'security', label: 'セキュリティ', icon: <Shield size={18} /> },
    { id: 'contact', label: 'お問い合わせ等', icon: <Mail size={18} /> },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'intro':
        return (
          <div className="help-content animate-fade-in">
            <h3>漢字ジグザグ作成ツールへようこそ</h3>
            <p>このツールは、漢字ジグザグパズルの原稿を効率的に作成し、Excelファイルとして出力するためのジグザグ専用ツールです。</p>

            <div className="help-section">
              <h4>基本の流れ</h4>
              <ol>
                <li><strong>網掛けの編集</strong>: 網掛けがある場合、網掛けマスを入力します。</li>
                <li><strong>盤面の数字入力</strong>: 数字を配置します。ヒント文字や大マスがある場合文字の入力や大マスの設置をします。</li>
                <li><strong>リストの入力</strong>: リストの言葉を入力します。特別なリスト（Wリスト★や矢印等）の設定をします。</li>
                <li><strong>解答の作成</strong>: 盤面上でドラッグして、文字をトレースするように埋めていきます。</li>
                <li><strong>Excel出力</strong>: 完成した原稿をExcelファイルとして出力します。</li>
              </ol>
            </div>

          </div>
        );
      case 'main':
        return (
          <div className="help-content animate-fade-in">
            <h3>メイン画面</h3>
            <p>メニューエリア・リストエリア・盤面エリアの3つのエリアに分かれます</p>
            <div className="help-image-container">
              <img src="/help/main.png" alt="メイン画面" style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            </div>

            <div className="help-section">
              <h4>＜メニューエリア＞</h4>
              <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                <li><strong>・ログイン</strong>　Google認証を使っています。ログインをしなくても使用はできますが、データの保存ができません。</li>
                <li><strong>・保存</strong>　いくらでもできますが、増えてくると管理が難しくなります。タグの機能をお使いください。</li>
              </ul>
            </div>

            <div className="help-section">
              <h4>＜リストエリア＞</h4>
              <p style={{ marginBottom: '16px' }}>
                上部に画面選択、ジャンル選択、小メニューエリア、<br />
                中部に単語リストエリア、<br />
                下部にズーム<br />
                があります。
              </p>
              <p style={{ marginBottom: '12px' }}><strong>画面選択</strong>では網掛け・問題面・解答面の3つの画面を切り替えてデータの入力を行います。</p>
              <p style={{ marginBottom: '12px' }}>
                <strong>ジャンル選択</strong>ではノーマル・Ｗリスト・Ｗリスト★・ナンバーレス・部分ナンバーレス・ウルトラ・変則・矢印があります。<br />
                網掛け画面を使うことで、「超」タイプを組み合わせることができます。
              </p>
              <p style={{ marginBottom: '12px' }}><strong>小メニューエリア</strong>には「設定」「サイズ変更」「印刷」のボタンがあります</p>
              <p>
                <strong>単語リストエリア</strong>ではリストの編集が行えます。<br />
                ナンバーレス、部分ナンバーレス選択時はリストをドラッグすることで、リストの移動が可能です。<br />
                Ｗリスト・Ｗリスト★選択時はリスト2の編集が行えます
              </p>
            </div>

            <div className="help-section">
              <h4>＜盤面エリア＞</h4>
              <p style={{ marginBottom: '12px' }}>上からタイトル・解答欄・盤面・タグの4つのエリアがあります</p>
              <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                <li style={{ marginBottom: '8px' }}><strong>タイトル</strong>　タイトルを直接入力できます。</li>
                <li style={{ marginBottom: '8px' }}><strong>解答欄</strong>　盤面にアルファベットを入力することで自動的に解答マスが出現します。「スペース編集」ボタンは解答を分離するために使います。</li>
                <li style={{ marginBottom: '8px' }}><strong>盤面</strong>　網掛け・問題面・解答面の盤面選択によって表示が変わり、編集できる内容も変わります。「問題作成」「解答作成」をご覧ください。</li>
                <li><strong>タグ</strong>　問題ごとに、タグの設定ができます。読み込み時に役に立ちます。</li>
              </ul>
            </div>
          </div>
        );
      case 'edit':
        return (
          <div className="help-content animate-fade-in">
            <h3>問題作成</h3>

            <div className="help-section">
              <h4>【新規作成】</h4>
              <p>メニューエリアの「＋新規作成」ボタンを押して、サイズを入力します。</p>
            </div>

            <div className="help-section">
              <h4>【ジャンル選択】</h4>
              <p>リストエリア上部のドロップダウンリストよりジャンルを選択します。<br />通常の問題なら「ノーマル」のままです。</p>
            </div>

            <div className="help-section">
              <h4>【タイトル設定】</h4>
              <p>盤面エリア最上部にタイトルを入力してください。<br />適宜、タグの設定もするといいでしょう。</p>
            </div>

            <div className="help-section">
              <h4>【盤面編集】</h4>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜数字マス入力＞</strong>
                <p>盤面で数字のマスをクリックします。左上から自動的に数字が入力されます。</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜解答マス入力＞</strong>
                <p>該当のマスで右クリックするとアルファベット入力チップが出現します。<br />解答マスの設定をすると、盤面の上に解答欄が出現します。</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜ヒント文字入力＞</strong>
                <p>
                  ウルトラなど、一部の問題では盤面に数字のない文字（ヒント文字）が必要なものがあります。<br />
                  盤面を一度クリックすると数字マスになりますが、もう一度クリックすると文字が入力できるマスになります。キーボードから入力するか、ペーストして文字を入力します。<br />
                  2文字以上入力できますが、そのときはバックスペースで後ろから1文字ずつ削除できます。
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜網掛け編集＞</strong>
                <p>
                  超・Ｗリスト問題など網掛けの入力が必要な問題では、「単語リストエリア」の最上部の「網掛け」ボタンを押します。<br />
                  網掛け画面にしたら、盤面をクリックすることで網掛けの入力・削除ができます。ドラッグすることで、連続入力もできます。
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜大マス入力＞</strong>
                <p>
                  「単語リストエリア」最上部の「問題面」ボタンを押し、画面選択した後、盤面をドラッグすることで大マスの入力ができます。<br />
                  大マスの解消は、大マスの上で右クリックすると出現するアルファベット入力チップの「大マスの解除」で解除できます。
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜単語リスト編集＞</strong>
                <p>
                  盤面に数字マスを入力していくと、「単語リストエリア」に単語リスト入力枠が増えていきます。<br />
                  この枠に、単語を入力すると、1文字目が自動的に盤面に表示されます。
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>＜各問題の編集＞</strong>
                <p>「特殊ジャンル」をご覧ください。</p>
              </div>
            </div>
          </div>
        );
      case 'answer':
        return (
          <div className="help-content animate-fade-in">
            <h3>解答作成</h3>

            <div className="help-section">
              <p>リストエリア最上部のモード切替で「解答面」を選択します。</p>
              <ul>
                <li><strong>ドラッグで入力</strong>: 数字のマスから始めて、文字が入る順にマウスをドラッグしてください。文字が自動的にトレースして入力されます。<br />文字の途中からドラッグすることもできます。</li>
                <li><strong>1文字目の保護</strong>: 既に文字が入っている数字マスの上を通過しても、そのマスの文字は上書きされません。</li>
                <li><strong>解答欄作成</strong>: ドラッグ中、解答マスに文字が入ると、自動的に解答欄に文字が入力されます。</li>
                <li><strong>残るもの</strong>: Ｗリスト / Ｗリスト★でリスト2が余る解答出しがある場合は、解答欄のリストを選択します。</li>
                <li><strong>自動解答</strong>: コンピューターに問題を解かせます。時間がかかる場合があります。</li>
                <li><strong>完成チェック</strong>: 自分で文字を入力し盤面を完成させたら、解答として成立しているかミスがないかを自動チェックできます。</li>
              </ul>
            </div>
          </div>
        );
      case 'genres':
        return (
          <div className="help-content animate-fade-in">
            <h3>様々なパズルジャンルへの対応</h3>
            <p>各種のジャンル問題の作成方法は以下の通りです。</p>

            <div className="help-grid">
              <div className="help-card">
                <h5>”超”問題</h5>
                <p>
                  <strong>＜手順＞</strong><br />
                  網掛け設定→盤面数字設定→リスト入力→解答面入力
                </p>
              </div>
              <div className="help-card">
                <h5>Wリスト / Wリスト★</h5>
                <p style={{ marginBottom: '8px' }}>
                  Wリスト、もしくはWリスト★を選択するとリスト2の入力欄が現れます。<br />
                  リスト余りの解答出し設定が可能です。<br />
                  Wリストでは網掛け画面で網掛けの設定をします。<br />
                  Wリスト★ではリストで★スイッチをオンにすることで、★のリストを選択できます。
                </p>
                <p>
                  <strong>＜手順＞</strong><br />
                  （網掛け設定）→盤面数字設定→リスト入力（★設定）→リスト2入力→解答面入力
                </p>
              </div>
              <div className="help-card">
                <h5>ナンバーレス / 部分ナンバーレス</h5>
                <p style={{ marginBottom: '8px' }}>部分ナンバーレスの場合は、数字付きのリストは×をクリックすると◎に変わり、そのリストは数字付き（ナンバーレスではないリスト）になります。<br />また、「50音順並替」ボタンで並び替えができます。ただし文字コード順なので、正確ではありません。<br />単語リストは単語の枠をドラッグすることで入れ替えが可能です。</p>
                <p>
                  <strong>＜手順＞</strong><br />
                  盤面数字設定→リスト入力（◎設定）→リストを五十音順並び替え→解答面入力
                </p>
              </div>
              <div className="help-card">
                <h5>ウルトラ</h5>
                <p style={{ marginBottom: '8px' }}>通常の問題作成とほぼ同じ手順です。</p>
                <p>
                  <strong>＜手順＞</strong><br />
                  盤面数字設定・ヒント文字入力→リスト入力→解答面入力→数字非表示で問題面確認
                </p>
              </div>
              <div className="help-card">
                <h5>変則</h5>
                <p style={{ marginBottom: '8px' }}>通常の問題作成とまったく同じ手順で行います。</p>
                <p>
                  <strong>＜手順＞</strong><br />
                  盤面数字設定→リスト入力→解答面入力→変則数字表示で問題面確認
                </p>
              </div>
              <div className="help-card">
                <h5>矢印</h5>
                <p>
                  <strong>＜手順＞</strong><br />
                  盤面数字設定→リスト入力（矢印入力）→解答面入力
                </p>
              </div>
            </div>
          </div>
        );
      case 'export':
        return (
          <div className="help-content animate-fade-in">
            <h3>Excel出力の設定</h3>
            <p>完成したパズルは、原稿としてそのまま納品できる品質でExcel出力されます。</p>

            <div className="help-section">
              <h4>主な設定項目</h4>
              <ul>
                <li><strong>マス設定</strong>: 1マスをExcelの何セル分（1x1, 2x1, 3x3）で描画するか選べます。</li>
                <li><strong>フォント設定</strong>: フォントの選択やサイズ指定ができます。</li>
                <li><strong>リスト設定</strong>: リストの位置または単独シートを設定できます。</li>
              </ul>
            </div>

            <h3>Excel読込の設定</h3>
            <p>原稿として作成した過去のExcelファイルを読み込むことができます。</p>

            <div className="help-section">
              <h4>主な設定項目</h4>
              <ul>
                <li><strong>問題面</strong>: 問題面のあるシートを選択し、左上のセルを指定します。1マスがExcelの何セル分（1x1, 2x1, 3x3）で作成されているか間違いなく選んでください。</li>
                <li><strong>解答面</strong>: 解答面のあるシートを選択し、左上のセルを指定します。問題面同様、1マスが何セルか忘れずに選択してください。</li>
                <li><strong>単語リスト</strong>: リストのあるシートを選択し、リストを数字を含む形で左上と右下の範囲指定をします。</li>
              </ul>
            </div>

          </div>
        );
      case 'security':
        return (
          <div className="help-content animate-fade-in">
            <h3>セキュリティとプライバシー</h3>
            <div className="help-section">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                <section style={{ display: 'flex', gap: '12px' }}>
                  <Lock size={20} style={{ color: '#059669', flexShrink: 0, marginTop: '4px' }} />
                  <div>
                    <strong style={{ display: 'block', color: '#059669', marginBottom: '4px' }}>パスワードについて</strong>
                    Googleの認証システムを使用しているため、作成者（キンピラ工房）がログインパスワードを知ることは技術的に不可能です。安心してお使いください。
                  </div>
                </section>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                <section style={{ display: 'flex', gap: '12px' }}>
                  <Database size={20} style={{ color: '#0284c7', flexShrink: 0, marginTop: '4px' }} />
                  <div>
                    <strong style={{ display: 'block', color: '#0284c7', marginBottom: '4px' }}>データの秘匿性について</strong>
                    保存されたパズルデータは皆様個人のものであり、作成者（キンピラ工房）が無断で内容を閲覧・分析することはありません。
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', background: '#f8fafc', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1' }}>
                      ※ただし、アプリの不具合修正のためにデータを分析する必要が生じた場合は、必ず事前に該当するデータの権利者様へ個別に許可をいただいた上で対応いたします。
                    </div>
                  </div>
                </section>
              </div>
              <div style={{ marginTop: '20px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 'bold', marginBottom: '4px' }}>掲示板利用キーワード</div>
                <div style={{ fontSize: '1rem', color: '#b45309', textAlign: 'center', letterSpacing: '4px' }}>稲妻</div>
              </div>
            </div>
          </div>
        );
      case 'contact':
        return (
          <div className="help-content animate-fade-in">
            <div className="help-section">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Mail size={20} style={{ color: '#6366f1', flexShrink: 0, marginTop: '4px' }} />
                <div>
                  <strong style={{ display: 'block', color: '#6366f1', marginBottom: '4px' }}>公式掲示板</strong>
                  <p style={{ margin: '0 0 8px 0' }}>作家様同士の交流やバグ報告のための掲示板を開設しました。</p>
                  <a
                    href="https://zigzag-bbs.kimpirakobo.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--primary-color)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 'bold',
                      marginBottom: '16px'
                    }}
                  >
                    <MessageSquare size={18} /> 掲示板を開く
                  </a>

                  <strong style={{ display: 'block', color: '#6366f1', marginBottom: '4px' }}>個別のお問い合わせ</strong>
                  <p style={{ margin: '0 0 8px 0' }}>ご不明な点や不具合がございましたら、下記までご連絡ください。</p>
                  <div style={{ background: 'var(--primary-light)', padding: '10px', borderRadius: '8px', display: 'inline-block' }}>
                    キンピラ工房（長浜忠実）<br />
                    <a href="mailto:zigzag@kimpirakobo.com" style={{ color: 'var(--primary-color)', fontWeight: 'bold', textDecoration: 'none' }}>
                      zigzag@kimpirakobo.com
                    </a>
                  </div>
                </div>
              </div>
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
          background-color: #dbeafe;
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
