import React from 'react';
import { ShieldCheck, Mail, Lock, Database } from 'lucide-react';

interface WelcomeDialogProps {
  onAccept: () => void;
}

export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ onAccept }) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content glass card" style={{ maxWidth: '500px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} style={{ color: 'var(--primary-color)' }} />
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>ご利用者様へ</h2>
          </div>
        </div>

        <div className="modal-body" style={{ fontSize: '0.95rem', lineHeight: '1.7', color: 'var(--text-color)' }}>
          <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>
            本アプリを安心してご利用いただくために、プライバシーとセキュリティについて大切なことをお伝えいたします。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
            <section style={{ display: 'flex', gap: '12px' }}>
              <Lock size={20} style={{ color: '#059669', flexShrink: 0, marginTop: '4px' }} />
              <div>
                <strong style={{ display: 'block', color: '#059669', marginBottom: '4px' }}>パスワードについて</strong>
                Googleの認証システムを使用しているため、作成者（キンピラ工房）がログインパスワードを知ることは技術的に不可能です。安心してお使いください。
              </div>
            </section>

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

            <section style={{ display: 'flex', gap: '12px' }}>
              <Mail size={20} style={{ color: '#6366f1', flexShrink: 0, marginTop: '4px' }} />
              <div>
                <strong style={{ display: 'block', color: '#6366f1', marginBottom: '4px' }}>お問い合わせ</strong>
                ご不明な点や不具合がございましたら、下記までご連絡ください。<br />
                <a href="mailto:zigzag@kimpirakobo.com" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>zigzag@kimpirakobo.com</a>
              </div>
            </section>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center', paddingTop: '20px' }}>
          <button
            className="btn-primary"
            onClick={onAccept}
            style={{ padding: '12px 40px', fontSize: '1rem' }}
          >
            承諾して利用を開始する
          </button>
        </div>
      </div>
    </div>
  );
};
