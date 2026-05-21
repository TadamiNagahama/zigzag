import { useState, useEffect } from 'react';
import {
  auth,
  dbFirestore,
  googleProvider
} from './firebase';
import {
  signInWithPopup,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import {
  MessageSquare,
  Plus,
  ChevronLeft,
  Send,
  ShieldCheck,
  Clock,
  User as UserIcon,
  LogOut,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  AlertCircle
} from 'lucide-react';

// 型定義
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isApproved: boolean;
  registrationAnswer: string;
  role: 'user' | 'admin';
  createdAt: Timestamp;
  avatarEmoji?: string;
  avatarColor?: string;
}

interface Thread {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount: number;
}

interface Comment {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}

const ADMIN_EMAIL = 'zigzag@kimpirakobo.com';

const AVATAR_EMOJIS = [
  '🐱', '🐶', '🦊', '🦁', '🐼', '🐰', '🐯', '🐻', '🐨', '🐸', '🐧', '🐥', '🐹', '🦉', '🦄', '🐝',
  '🐵', '🐔', '🐙', '🐳', '🐢', '🦖', '🦕', '🐛', '🦋', '🦀', '🐬', '🐑', '🐖', '🐿️', '🦔', '🐈',
  '🌸', '🍀', '☀️', '⭐', '🌈', '🎨', '🚀', '🎈', '☕', '🍙', '🍦', '🍎', '🍓', '🍣', '🍕', '🍰',
  '👾', '🎮', '💎', '🎸', '🛹', '🧩', '💡', '🔔', '🧭', '🎉', '👑', '🧙', '👽', '⛄', '📚', '🎯'
];
const AVATAR_COLORS = ['#3b82f6', '#6bb2f6', '#10b981', '#40f9c1', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#aaaaaa'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'threads' | 'detail' | 'admin' | 'apply' | 'profile'>('threads');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // ユーザーIDからアバター情報などをマッピングするためのステート
  const [usersMap, setUsersMap] = useState<Map<string, UserProfile>>(new Map());

  // アプリ（申請画面）用ステート
  const [applyDisplayName, setApplyDisplayName] = useState('');
  const [applyAvatarEmoji, setApplyAvatarEmoji] = useState('🐱');
  const [applyAvatarColor, setApplyAvatarColor] = useState('#3b82f6');

  // プロフィール編集画面用ステート
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAvatarEmoji, setEditAvatarEmoji] = useState('🐱');
  const [editAvatarColor, setEditAvatarColor] = useState('#3b82f6');

  // 1. 認証状態の監視
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setApplyDisplayName(u.displayName || '名無し');
        await fetchProfile(u);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  // 2. プロフィールの取得
  const fetchProfile = async (u: User) => {
    const userRef = doc(dbFirestore, 'users', u.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      setProfile(data);
      if (!data.isApproved && data.role !== 'admin') {
        setView('apply');
      }
    } else {
      setView('apply');
    }
    setLoading(false);
  };

  // 3. スレッド一覧の監視
  useEffect(() => {
    if (profile?.isApproved || profile?.role === 'admin') {
      const q = query(collection(dbFirestore, 'threads'), orderBy('updatedAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Thread));
        setThreads(data);
      }, (err) => {
        console.error(err);
      });
    }
  }, [profile]);

  // 4. コメントの監視
  useEffect(() => {
    if (selectedThread) {
      const q = query(
        collection(dbFirestore, 'comments'),
        where('threadId', '==', selectedThread.id),
        orderBy('createdAt', 'asc')
      );
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
        setComments(data);
      }, (err: any) => {
        console.error(err);
        if (err.message?.includes('index')) {
          alert("コメントの表示にはインデックスの作成が必要です。ブラウザのコンソールに出力されたURLをクリックして作成してください。");
        }
      });
    }
  }, [selectedThread]);

  // 5. 全ユーザーの監視 (管理および表示マッピング用)
  useEffect(() => {
    if (profile?.isApproved || profile?.role === 'admin') {
      const q = query(collection(dbFirestore, 'users'));
      return onSnapshot(q, (snap) => {
        const map = new Map<string, UserProfile>();
        snap.docs.forEach(d => {
          const u = d.data() as UserProfile;
          map.set(u.uid, u);
        });
        setUsersMap(map);
        if (profile) {
          const myProfile = map.get(profile.uid);
          if (myProfile) {
            setProfile(myProfile);
          }
        }
      });
    }
  }, [profile?.isApproved, profile?.role]);

  // 全ユーザーの監視 (管理用の配列ステート用)
  useEffect(() => {
    if (profile?.role === 'admin') {
      return onSnapshot(query(collection(dbFirestore, 'users'), orderBy('createdAt', 'desc')), (snap) => {
        setAllUsers(snap.docs.map(d => d.data() as UserProfile));
      });
    }
  }, [profile]);

  // ログイン・ログアウト
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); }
  };
  const handleLogout = () => auth.signOut();

  // 利用申請
  const handleApply = async (answer: string) => {
    if (!user) return;
    try {
      const isFirstAdmin = user.email === ADMIN_EMAIL;
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: applyDisplayName.trim() || '名無し',
        isApproved: isFirstAdmin,
        registrationAnswer: answer,
        role: isFirstAdmin ? 'admin' : 'user',
        createdAt: Timestamp.now(),
        avatarEmoji: applyAvatarEmoji,
        avatarColor: applyAvatarColor
      };
      const userRef = doc(dbFirestore, 'users', user.uid);
      await setDoc(userRef, newProfile);
      setProfile(newProfile);

      // 管理者へのメール通知 (Web3Forms APIを利用)
      // Web3Formsのアクセスキーを取得してここに設定してください。
      // キーの取得先: https://web3forms.com/ (無料・即時発行)
      const WEB3FORMS_ACCESS_KEY = "65a53c15-1ea5-458e-91c8-dbbdeded3ff6";
      if (WEB3FORMS_ACCESS_KEY) {
        try {
          await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              access_key: WEB3FORMS_ACCESS_KEY,
              subject: "【ジグザグ掲示板】新しい利用申請が届きました",
              from_name: "漢字ジグザグ掲示板",
              to_email: "reds.tn@gmail.com",
              message: `
新しい利用申請が送信されました。

■ 申請者情報
・希望ハンドルネーム: ${newProfile.displayName} (Google登録名: ${user.displayName || '名無し'})
・メールアドレス: ${newProfile.email}
・アバター設定: ${newProfile.avatarEmoji} (背景色: ${newProfile.avatarColor})
・キーワード回答: ${answer}
・申請日時: ${new Date().toLocaleString()}

■ 承認はこちら（掲示板の管理画面）から行ってください：
https://zigzag-bbs.kimpirakobo.com
              `.trim()
            })
          });
        } catch (mailErr) {
          console.error("メール通知の送信に失敗しました:", mailErr);
        }
      }

      if (isFirstAdmin) setView('threads');
    } catch (e: any) {
      console.error(e);
      alert('エラーが発生しました: ' + e.message);
    }
  };

  // プロフィール編集画面を開く
  const handleOpenProfileEdit = () => {
    if (profile) {
      setEditDisplayName(profile.displayName);
      setEditAvatarEmoji(profile.avatarEmoji || '🐱');
      setEditAvatarColor(profile.avatarColor || '#3b82f6');
      setView('profile');
    }
  };

  // プロフィール保存
  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    try {
      const updatedProfile = {
        ...profile,
        displayName: editDisplayName.trim() || '名無し',
        avatarEmoji: editAvatarEmoji,
        avatarColor: editAvatarColor
      };
      const userRef = doc(dbFirestore, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: updatedProfile.displayName,
        avatarEmoji: updatedProfile.avatarEmoji,
        avatarColor: updatedProfile.avatarColor
      });
      setProfile(updatedProfile);
      setView('threads');
    } catch (e: any) {
      console.error(e);
      alert('保存中にエラーが発生しました: ' + e.message);
    }
  };

  // スレッド操作
  const createThread = async (title: string) => {
    if (!profile) return;
    const res = await addDoc(collection(dbFirestore, 'threads'), {
      title,
      authorId: profile.uid,
      authorName: profile.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      commentCount: 0
    });

    // 作成したスレッドを選択状態にして詳細画面へ移動
    const newThread: Thread = {
      id: res.id,
      title,
      authorId: profile.uid,
      authorName: profile.displayName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      commentCount: 0
    };
    setSelectedThread(newThread);
    setView('detail');

    // 新規スレッドのメール通知
    const WEB3FORMS_ACCESS_KEY = "65a53c15-1ea5-458e-91c8-dbbdeded3ff6";
    if (WEB3FORMS_ACCESS_KEY) {
      try {
        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: "【ジグザグ掲示板】新しいスレッドが作成されました",
            from_name: "漢字ジグザグ掲示板",
            to_email: "reds.tn@gmail.com",
            message: `
掲示板に新しいスレッドが作成されました。

■ スレッド情報
・タイトル: ${title}
・作成者: ${profile.displayName} (${profile.email})
・作成日時: ${new Date().toLocaleString()}

■ 掲示板はこちら：
https://zigzag-bbs.kimpirakobo.com
            `.trim()
          })
        });
      } catch (mailErr) {
        console.error("スレッド作成通知の送信に失敗しました:", mailErr);
      }
    }
  };

  const deleteThread = async (id: string) => {
    if (!window.confirm('このスレッドと全ての返信を削除しますか？')) return;
    await deleteDoc(doc(dbFirestore, 'threads', id));
    const q = query(collection(dbFirestore, 'comments'), where('threadId', '==', id));
    const snap = await getDocs(q);
    for (const d of snap.docs) await deleteDoc(doc(dbFirestore, 'comments', d.id));
    setView('threads');
  };

  // コメント操作
  const postComment = async (content: string) => {
    if (!profile || !selectedThread) return;
    await addDoc(collection(dbFirestore, 'comments'), {
      threadId: selectedThread.id,
      content,
      authorId: profile.uid,
      authorName: profile.displayName,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(dbFirestore, 'threads', selectedThread.id), {
      updatedAt: serverTimestamp(),
      commentCount: (selectedThread.commentCount || 0) + 1
    });

    // 新規返信コメントのメール通知
    const WEB3FORMS_ACCESS_KEY = "65a53c15-1ea5-458e-91c8-dbbdeded3ff6";
    if (WEB3FORMS_ACCESS_KEY) {
      try {
        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: `【ジグザグ掲示板】スレッド「${selectedThread.title}」に返信がありました`,
            from_name: "漢字ジグザグ掲示板",
            to_email: "reds.tn@gmail.com",
            message: `
スレッドに新しい返信コメントが投稿されました。

■ 返信先スレッド
・スレッド名: ${selectedThread.title}

■ 返信内容
・投稿者: ${profile.displayName} (${profile.email})
・投稿日時: ${new Date().toLocaleString()}
・コメント内容:
${content}

■ 掲示板はこちら：
https://zigzag-bbs.kimpirakobo.com
            `.trim()
          })
        });
      } catch (mailErr) {
        console.error("コメント投稿通知の送信に失敗しました:", mailErr);
      }
    }
  };

  const deleteComment = async (id: string, threadId: string) => {
    if (!window.confirm('この返信を削除しますか？')) return;
    await deleteDoc(doc(dbFirestore, 'comments', id));
    const threadRef = doc(dbFirestore, 'threads', threadId);
    const snap = await getDoc(threadRef);
    if (snap.exists()) {
      await updateDoc(threadRef, { commentCount: Math.max(0, (snap.data().commentCount || 1) - 1) });
    }
  };

  // 管理操作
  const toggleApprove = async (uid: string, status: boolean) => {
    await updateDoc(doc(dbFirestore, 'users', uid), { isApproved: status });
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>;

  // ログイン前
  if (!user) {
    return (
      <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="card glass" style={{ width: '400px', padding: '2.5rem', textAlign: 'center' }}>
          <MessageSquare size={48} color="var(--primary-color)" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '1rem' }}>漢字ジグザグ掲示板</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>パズル作家様専用コミュニティです。ログインと承認が必要です。</p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLogin}>Googleアカウントでログイン</button>
        </div>
      </div>
    );
  }

  // 承認待ち
  if (view === 'apply') {
    return (
      <div className="container animate-fade-in">
        <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2.5rem' }}>
          <ShieldCheck size={40} color="var(--warning-color)" style={{ marginBottom: '1rem' }} />
          <h3>利用申請と初期設定</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>掲示板で表示するプロフィールと、ツール使用者確認のための質問に答えて申請してください。</p>

          <form onSubmit={(e) => { e.preventDefault(); handleApply((e.currentTarget.elements.namedItem('answer') as HTMLInputElement).value); }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>希望ハンドルネーム</label>
              <input
                className="input-field"
                value={applyDisplayName}
                onChange={(e) => setApplyDisplayName(e.target.value)}
                placeholder="掲示板で表示される名前を入力..."
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>アイコンアバター</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px', background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  background: applyAvatarColor,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  flexShrink: 0
                }}>
                  {applyAvatarEmoji}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  選択した絵文字と背景色があなたのアイコンになります。
                </div>
              </div>

              {/* 絵文字選択 */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>絵文字を選択:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {AVATAR_EMOJIS.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      style={{
                        fontSize: '1.3rem',
                        padding: '4px',
                        background: applyAvatarEmoji === emo ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                        border: applyAvatarEmoji === emo ? '2px solid var(--primary-color)' : '2px solid transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.1s'
                      }}
                      onClick={() => setApplyAvatarEmoji(emo)}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* 背景色選択 */}
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>背景色を選択:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {AVATAR_COLORS.map(col => (
                    <button
                      key={col}
                      type="button"
                      style={{
                        width: '24px',
                        height: '24px',
                        background: col,
                        border: applyAvatarColor === col ? '2px solid #000000' : '2px solid transparent',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onClick={() => setApplyAvatarColor(col)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <strong>質問:</strong> 漢字ジグザグ作成ツールのヘルプ「セキュリティ」にあるキーワードを入力してください。
            </div>

            <input name="answer" className="input-field" placeholder="キーワードを入力..." required style={{ marginBottom: '1.5rem' }} />

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>申請を送信する</button>
          </form>
          {profile && !profile.isApproved && (
            <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--warning-color)', fontWeight: 'bold' }}>
              <Clock size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />承認をお待ちください。
            </div>
          )}
        </div>
      </div>
    );
  }

  // スレッド一覧
  if (view === 'threads') {
    return (
      <div className="container animate-fade-in">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><MessageSquare /> 漢字ジグザグ掲示板</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {profile?.role === 'admin' && <button className="btn btn-secondary" onClick={() => setView('admin')}><ShieldCheck size={18} /> 管理</button>}
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleOpenProfileEdit}>
              <UserIcon size={18} />
              <span>アカウント管理</span>
            </button>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleLogout}>
              <LogOut size={18} />
              <span>ログアウト</span>
            </button>
          </div>
        </header>

        {/* お知らせ枠 */}
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#92400e', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} /> 【はじめに】ご利用上の注意
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#b45309', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li><strong>個人情報の保護</strong>: 本名、住所、電話番号などの個人情報は書き込まないようお願いいたします。</li>
            <li><strong>機密保持</strong>: 出版社様との未発表案件など、機密性の高い情報の投稿には十分ご注意ください。</li>
            <li><strong>マナー</strong>: 批判や誹謗中傷を避け、建設的な情報交換をお願いいたします。</li>
          </ul>
        </div>

        <div className="card">
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-light)' }}>
            <h3 style={{ fontSize: '1rem' }}>スレッド一覧</h3>
            <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => { const t = prompt('タイトルを入力してください'); if (t) createThread(t); }}>
              <Plus size={18} /> 新規作成
            </button>
          </div>
          <div style={{ minHeight: '400px' }}>
            {threads.map(t => {
              const threadAuthor = usersMap.get(t.authorId);
              return (
                <div key={t.id} className="thread-item" onClick={() => { setSelectedThread(t); setView('detail'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{t.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.updatedAt?.toDate().toLocaleString()}</span>
                      {(profile?.role === 'admin' || profile?.uid === t.authorId) && (
                        <button className="btn" style={{ padding: '4px', color: 'var(--danger-color)' }} onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: threadAuthor?.avatarColor || '#e2e8f0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem'
                      }}>
                        {threadAuthor?.avatarEmoji || '👤'}
                      </span>
                      {threadAuthor?.displayName || t.authorName}
                    </span>
                    <span><MessageSquare size={14} /> {t.commentCount || 0} 返信</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // スレッド詳細
  if (view === 'detail' && selectedThread) {
    return (
      <div className="container animate-fade-in">
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setView('threads')}><ChevronLeft size={18} /> 戻る</button>
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ padding: '1.5rem', background: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>{selectedThread.title}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>作成: {selectedThread.authorName} | {selectedThread.createdAt?.toDate().toLocaleString()}</div>
          </div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {comments.map((c) => {
              const commentAuthor = usersMap.get(c.authorId);
              return (
                <div key={c.id} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--bg-color)', paddingBottom: '1.5rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: commentAuthor?.avatarColor || '#e2e8f0',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flexShrink: 0
                  }}>
                    {commentAuthor?.avatarEmoji || '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{commentAuthor?.displayName || c.authorName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.createdAt?.toDate().toLocaleString()}</span>
                        {(profile?.role === 'admin' || profile?.uid === c.authorId) && (
                          <button className="btn" style={{ padding: '4px', color: 'var(--danger-color)' }} onClick={() => deleteComment(c.id, selectedThread.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{c.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: '#fafafa' }}>
            <form onSubmit={(e) => { e.preventDefault(); const i = e.currentTarget.elements.namedItem('content') as HTMLTextAreaElement; if (i.value.trim()) { postComment(i.value); i.value = ''; } }}>
              <textarea name="content" className="input-field" placeholder="返信を入力..." required rows={3} style={{ marginBottom: '1rem' }}></textarea>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="btn btn-primary"><Send size={18} /> 投稿</button></div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 管理画面
  if (view === 'admin') {
    return (
      <div className="container animate-fade-in">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Users /> ユーザー管理</h2>
          <button className="btn btn-secondary" onClick={() => setView('threads')}>戻る</button>
        </header>
        <div className="card">
          {allUsers.map(u => (
            <div key={u.uid} style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: u.avatarColor || '#e2e8f0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem'
                  }}>
                    {u.avatarEmoji || '👤'}
                  </span>
                  {u.displayName} ({u.email})
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>回答: {u.registrationAnswer}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {u.isApproved ? (
                  <button className="btn btn-secondary" style={{ color: 'var(--danger-color)' }} onClick={() => toggleApprove(u.uid, false)}><XCircle size={18} /> 停止</button>
                ) : (
                  <button className="btn btn-primary" style={{ background: 'var(--success-color)' }} onClick={() => toggleApprove(u.uid, true)}><CheckCircle2 size={18} /> 承認</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // アカウント管理画面
  if (view === 'profile') {
    return (
      <div className="container animate-fade-in">
        <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>アカウント管理</h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>ハンドルネーム</label>
            <input
              className="input-field"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="表示名を入力..."
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>アイコンアバター</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px', background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: editAvatarColor,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                flexShrink: 0
              }}>
                {editAvatarEmoji}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                左のアイコンはプレビューです。絵文字と背景色を選んで変更できます。
              </div>
            </div>

            {/* 絵文字選択 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>絵文字を選択:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {AVATAR_EMOJIS.map(emo => (
                  <button
                    key={emo}
                    type="button"
                    style={{
                      fontSize: '1.5rem',
                      padding: '6px',
                      background: editAvatarEmoji === emo ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                      border: editAvatarEmoji === emo ? '2px solid var(--primary-color)' : '2px solid transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.1s'
                    }}
                    onClick={() => setEditAvatarEmoji(emo)}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>

            {/* 背景色選択 */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>背景色を選択:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(col => (
                  <button
                    key={col}
                    type="button"
                    style={{
                      width: '28px',
                      height: '28px',
                      background: col,
                      border: editAvatarColor === col ? '2px solid #000000' : '2px solid transparent',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onClick={() => setEditAvatarColor(col)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '2rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setView('threads')}>キャンセル</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveProfile}>変更を保存する</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
