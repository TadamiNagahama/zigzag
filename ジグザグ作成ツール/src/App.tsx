import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Layout } from './components/Layout'
import { Grid } from './components/Grid'
import { AnswerArea } from './components/AnswerArea'
import { usePuzzle } from './hooks/usePuzzle'
import { SettingsDialog } from './components/SettingsDialog'
import { SaveDialog } from './components/SaveDialog'
import { LoadDialog } from './components/LoadDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { AlertDialog } from './components/AlertDialog'
import { ExportDialog, type ExportOptions } from './components/ExportDialog'
import { PrintDialog } from './components/PrintDialog'
import { PrintTemplate } from './components/PrintTemplate'
import { SizeDialog } from './components/SizeDialog'
import { TagDialog } from './components/TagDialog'
import { HelpDialog } from './components/HelpDialog'
import { WelcomeDialog } from './components/WelcomeDialog'
import { exportToExcel } from './utils/excelExport'
import { analyzeExcelFile, type ExcelImportResult, convertManualImportToPuzzle } from './utils/excelImport'
import { ImportPreviewDialog } from './components/ImportPreviewDialog'
import type { ManualImportConfig } from './utils/excelImport'
import { auth, dbFirestore, googleProvider } from './models/firebase'
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { type PuzzleData, type PrintOptions, type Cell, APP_VERSION } from './models/types'
import { Settings, ZoomIn, ZoomOut, Maximize, Plus, Printer, Grid3X3 } from 'lucide-react'
import './App.css'
type AppMode = 'shade' | 'edit' | 'answer';
type EditMode = 'number' | 'wall';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const playBuzzer = () => {
  const context = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(100, context.currentTime); // 低い音
  oscillator.frequency.exponentialRampToValueAtTime(50, context.currentTime + 0.3);

  gain.gain.setValueAtTime(0.1, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
};

function App() {
  const {
    puzzle,
    setPuzzle,
    pushPuzzle,
    resizeBoard,
    toggleCellType,
    toggleNumberFlag,
    setBoardTitle,
    updateWordList,
    toggleWordStar,
    updateWordDirection,
    setIsRemainingAnswer,
    setRemainingAnswerWord,
    updateWordList2,
    addWordList2Entry,
    setShadingColor,
    setBoardFontWeight,
    setBoardFontFamily,
    setPuzzleType,
    setAnswerKey,
    toggleShaded,
    updateCellAnswerChar,
    reorderWordList,
    setWordListOrderMode,
    addTag,
    removeTag,
    mergeCells,
    splitCell,
    updateCellChar,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    createNewBoard,
    togglePublicNumber,
    toggleNumbersHidden,
    toggleIrregularNumbersDisplay,
    toggleAnswerColumnSpace,
    reorderWordList2,
  } = usePuzzle(17, 17);

  const [editMode, setEditMode] = useState<EditMode>('number');
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedWord2Index, setDraggedWord2Index] = useState<number | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, cellX: number, cellY: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  // 変則モード用の共有マス計算ロジック
  const irregularInfo = useMemo(() => {
    if (puzzle.puzzleType !== '変則') return { sharedCells: {} as Record<string, number[]>, errors: [] as string[] };

    const sharedCellsMap: Record<string, number[]> = {};
    const errors: string[] = [];

    // 使用されている番号を抽出
    const usedNumbers = new Set<number>();
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.number !== null) usedNumbers.add(cell.number);
    }));

    // 経路探索（最大2つまで取得）
    const findAllPaths = (word: string, x: number, y: number, visited: Set<string>, currentPath: { x: number, y: number }[]): { x: number, y: number }[][] => {
      if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return [];
      
      const cell = puzzle.cells[y][x];
      const px = cell.mergedParent ? cell.mergedParent.x : x;
      const py = cell.mergedParent ? cell.mergedParent.y : y;
      const parentCell = puzzle.cells[py][px];

      if (parentCell.type !== 'normal') return [];
      const currentChar = parentCell.char || parentCell.answerChar;
      if (currentChar !== word[0]) return [];

      const key = `${px},${py}`;
      if (visited.has(key)) return [];

      const newPath = [...currentPath, { x: px, y: py }];
      if (word.length === 1) return [newPath];

      const newVisited = new Set(visited);
      newVisited.add(key);

      const res: { x: number, y: number }[][] = [];
      
      // 結合範囲の全てのマスをリストアップ
      const groupCells: { x: number, y: number }[] = [];
      if (parentCell.mergedSize) {
        for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
          for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
            groupCells.push({ x: px + dx, y: py + dy });
          }
        }
      } else {
        groupCells.push({ x: px, y: py });
      }

      const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const gc of groupCells) {
        for (const [dx, dy] of neighbors) {
          const nx = gc.x + dx;
          const ny = gc.y + dy;
          if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) continue;
          
          const nCell = puzzle.cells[ny][nx];
          if (nCell.type !== 'normal') continue;
          const npx = nCell.mergedParent ? nCell.mergedParent.x : nx;
          const npy = nCell.mergedParent ? nCell.mergedParent.y : ny;
          if (npx === px && npy === py) continue;

          const sub = findAllPaths(word.slice(1), nx, ny, newVisited, newPath);
          res.push(...sub);
          if (res.length >= 2) break;
        }
        if (res.length >= 2) break;
      }
      return res;
    };

    // どこまで辿れたかを確認（エラーメッセージ用）
    const getMaxDepth = (word: string, x: number, y: number, visited: Set<string>, depth: number): number => {
      if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return depth;
      
      const cell = puzzle.cells[y][x];
      const px = cell.mergedParent ? cell.mergedParent.x : x;
      const py = cell.mergedParent ? cell.mergedParent.y : y;
      const parentCell = puzzle.cells[py][px];

      if (parentCell.type !== 'normal') return depth;
      const currentChar = parentCell.char || parentCell.answerChar;
      if (currentChar !== word[0]) return depth;

      const key = `${px},${py}`;
      if (visited.has(key)) return depth;

      if (word.length === 1) return depth + 1;

      const newVisited = new Set(visited);
      newVisited.add(key);

      let max = depth + 1;
      
      // 結合範囲の全てのマスをリストアップ
      const groupCells: { x: number, y: number }[] = [];
      if (parentCell.mergedSize) {
        for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
          for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
            groupCells.push({ x: px + dx, y: py + dy });
          }
        }
      } else {
        groupCells.push({ x: px, y: py });
      }

      const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const gc of groupCells) {
        for (const [dx, dy] of neighbors) {
          const nx = gc.x + dx;
          const ny = gc.y + dy;
          if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) continue;
          
          const nCell = puzzle.cells[ny][nx];
          if (nCell.type !== 'normal') continue;
          const npx = nCell.mergedParent ? nCell.mergedParent.x : nx;
          const npy = nCell.mergedParent ? nCell.mergedParent.y : ny;
          if (npx === px && npy === py) continue;

          max = Math.max(max, getMaxDepth(word.slice(1), nx, ny, newVisited, depth + 1));
        }
      }
      return max;
    };

    for (const num of Array.from(usedNumbers).sort((a, b) => a - b)) {
      const word = puzzle.wordList[num];
      if (!word || word.trim() === '') continue;

      let startPos: { x: number, y: number } | null = null;
      for (let y = 0; y < puzzle.height; y++) {
        for (let x = 0; x < puzzle.width; x++) {
          if (puzzle.cells[y][x].number === num) {
            startPos = { x, y };
            break;
          }
        }
        if (startPos) break;
      }

      if (!startPos) continue;

      const paths = findAllPaths(word, startPos.x, startPos.y, new Set(), []);
      if (paths.length === 0) {
        const maxD = getMaxDepth(word, startPos.x, startPos.y, new Set(), 0);
        errors.push(`リスト${num}の単語が全部見つかりません（${maxD + 1}文字目）`);
      } else if (paths.length >= 2) {
        errors.push(`リスト${num}の単語は2つ以上のルートが存在します`);
      } else {
        // 一意な経路が見つかった場合のみ、共有情報を記録
        paths[0].forEach(p => {
          const k = `${p.x},${p.y}`;
          if (!sharedCellsMap[k]) sharedCellsMap[k] = [];
          if (!sharedCellsMap[k].includes(num)) sharedCellsMap[k].push(num);
        });
      }
    }

    // 2つ以上の単語が通るマスのみを残す
    const finalSharedCells: Record<string, number[]> = {};
    Object.entries(sharedCellsMap).forEach(([k, nums]) => {
      if (nums.length >= 2) {
        finalSharedCells[k] = nums.sort((a, b) => a - b);
      }
    });

    return { sharedCells: finalSharedCells, errors };
  }, [puzzle]);
  const [pendingResize, setPendingResize] = useState<{ h: number, w: number } | null>(null);
  const editingWordRef = useRef<number | null>(null);

  // モードの状態
  const [appMode, setAppMode] = useState<AppMode>('edit');
  const [focusedCell, setFocusedCell] = useState<{ x: number, y: number } | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composingText, setComposingText] = useState('');
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [cloudPuzzles, setCloudPuzzles] = useState<PuzzleData[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | React.ReactNode | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [isEditingSpaces, setIsEditingSpaces] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'board' | 'list'>('board');
  const [exportSettings, setExportSettings] = useState<Partial<ExportOptions>>({});
  const [confirmAction, setConfirmAction] = useState<{ message: string | React.ReactNode, onConfirm: () => void, isDestructive?: boolean } | null>(null);
  const [showMobileSettingsMenu, setShowMobileSettingsMenu] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCheckMode, setIsCheckMode] = useState(false);
  const [solveMethod, setSolveMethod] = useState<'self' | 'auto'>('self');
  const [checkpointCells, setCheckpointCells] = useState<Cell[][] | null>(null);
  const [currentSolveNumber, setCurrentSolveNumber] = useState<number | null>(null);
  const [solveCandidates, setSolveCandidates] = useState<number[]>([]);
  const [solveCandidateIndex, setSolveCandidateIndex] = useState(0);
  const [savedSelfSolveCells, setSavedSelfSolveCells] = useState<Cell[][] | null>(null);
  const [selfSolveConfirm, setSelfSolveConfirm] = useState<{ message: string, onYes: () => void, onNo: () => void } | null>(null);

  // クラウド自動保存の設定（デフォルトOFF）
  const [cloudAutoSave, setCloudAutoSave] = useState(() => {
    const saved = localStorage.getItem('zigzag_cloud_autosave_setting');
    return saved === 'true';
  });

  const [lastExportFileName, setLastExportFileName] = useState<string | null>(() => {
    return localStorage.getItem('zigzag_last_export_filename');
  });

  // ユーザーが実際に入力した（あるいは初期配置されている）文字を辿って、
  // 特定のマスがどの単語の何文字目に該当するかを判定する関数
  const getDrawnWordCandidates = useCallback((targetX: number, targetY: number) => {
    const targetCell = puzzle.cells[targetY]?.[targetX];
    if (!targetCell || targetCell.type !== 'normal') return [];

    // ターゲットマスの論理座標（親マスの座標）
    const targetPX = targetCell.mergedParent ? targetCell.mergedParent.x : targetX;
    const targetPY = targetCell.mergedParent ? targetCell.mergedParent.y : targetY;

    const matches: { num: number, index: number }[] = [];
    const usedNumbers = new Set<number>();
    puzzle.cells.forEach(row => row.forEach(c => {
      if (c.number !== null) usedNumbers.add(c.number);
    }));

    Array.from(usedNumbers).forEach(num => {
      const word = puzzle.wordList[num];
      if (!word) return;

      let startX = -1, startY = -1;
      for (let y = 0; y < puzzle.height; y++) {
        for (let x = 0; x < puzzle.width; x++) {
          if (puzzle.cells[y][x].number === num) {
            startX = x; startY = y; break;
          }
        }
        if (startX !== -1) break;
      }
      if (startX === -1) return;

      let maxFoundIndex = -1;
      const dfs = (x: number, y: number, charIndex: number, visited: Set<string>) => {
        if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return;
        
        const cell = puzzle.cells[y][x];
        const px = cell.mergedParent ? cell.mergedParent.x : x;
        const py = cell.mergedParent ? cell.mergedParent.y : y;
        const parentCell = puzzle.cells[py][px];

        if (parentCell.type !== 'normal') return;

        const playerChar = (appMode === 'answer' && !isCheckMode) ? (parentCell.answerChar || parentCell.char) : parentCell.char;
        const cellChar = playerChar || (parentCell.number === num ? word[0] : (parentCell.number ? puzzle.wordList[parentCell.number]?.[0] : ''));
        if (cellChar !== word[charIndex]) return;

        const key = `${px},${py}`;
        if (visited.has(key)) return;

        if (px === targetPX && py === targetPY) {
          if (charIndex > maxFoundIndex) maxFoundIndex = charIndex;
        }

        if (charIndex + 1 < word.length) {
          const newVisited = new Set(visited);
          newVisited.add(key);

          // 結合範囲の全てのマスをリストアップ
          const groupCells: { x: number, y: number }[] = [];
          if (parentCell.mergedSize) {
            for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
              for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
                groupCells.push({ x: px + dx, y: py + dy });
              }
            }
          } else {
            groupCells.push({ x: px, y: py });
          }

          const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (const gc of groupCells) {
            for (const [dx, dy] of neighbors) {
              const nx = gc.x + dx;
              const ny = gc.y + dy;
              if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) continue;
              
              const nCell = puzzle.cells[ny][nx];
              if (nCell.type !== 'normal') continue;
              
              const npx = nCell.mergedParent ? nCell.mergedParent.x : nx;
              const npy = nCell.mergedParent ? nCell.mergedParent.y : ny;
              
              if (npx === px && npy === py) continue;
              dfs(nx, ny, charIndex + 1, newVisited);
            }
          }
        }
      };

      dfs(startX, startY, 0, new Set());

      if (maxFoundIndex >= 0) {
        matches.push({ num, index: maxFoundIndex });
      }
    });

    return matches;
  }, [puzzle.cells, puzzle.wordList, puzzle.width, puzzle.height, appMode, isCheckMode]);

  const getDrawnCellsForWord = useCallback((num: number): { x: number, y: number }[] => {
    const word = puzzle.wordList[num];
    if (!word) return [];

    let startX = -1, startY = -1;
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        if (puzzle.cells[y][x].number === num) {
          startX = x; startY = y; break;
        }
      }
      if (startX !== -1) break;
    }
    if (startX === -1) return [];

    let bestPath: { x: number, y: number }[] = [];
    const dfs = (x: number, y: number, charIndex: number, currentPath: { x: number, y: number }[], visited: Set<string>) => {
      if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return;
      
      const cell = puzzle.cells[y][x];
      const px = cell.mergedParent ? cell.mergedParent.x : x;
      const py = cell.mergedParent ? cell.mergedParent.y : y;
      const parentCell = puzzle.cells[py][px];

      if (parentCell.type !== 'normal') return;

      const playerChar = (appMode === 'answer' && !isCheckMode) ? (parentCell.answerChar || parentCell.char) : parentCell.char;
      const cellChar = playerChar || (parentCell.number === num ? word[0] : (parentCell.number ? puzzle.wordList[parentCell.number]?.[0] : ''));
      if (cellChar !== word[charIndex]) return;

      const key = `${px},${py}`;
      if (visited.has(key)) return;

      const newPath = [...currentPath, { x: px, y: py }];
      if (newPath.length > bestPath.length) {
        bestPath = newPath;
      }

      if (charIndex + 1 < word.length) {
        const newVisited = new Set(visited);
        newVisited.add(key);

        // 結合範囲の全てのマスをリストアップ
        const groupCells: { x: number, y: number }[] = [];
        if (parentCell.mergedSize) {
          for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
            for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
              groupCells.push({ x: px + dx, y: py + dy });
            }
          }
        } else {
          groupCells.push({ x: px, y: py });
        }

        const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const gc of groupCells) {
          for (const [dx, dy] of neighbors) {
            const nx = gc.x + dx;
            const ny = gc.y + dy;
            if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) continue;
            
            const nCell = puzzle.cells[ny][nx];
            if (nCell.type !== 'normal') continue;
            
            const npx = nCell.mergedParent ? nCell.mergedParent.x : nx;
            const npy = nCell.mergedParent ? nCell.mergedParent.y : ny;
            
            if (npx === px && npy === py) continue;
            dfs(nx, ny, charIndex + 1, newPath, newVisited);
            if (bestPath.length === word.length) return;
          }
        }
      }
    };

    dfs(startX, startY, 0, [], new Set());
    return bestPath;
  }, [puzzle.cells, puzzle.wordList, puzzle.width, puzzle.height, appMode, isCheckMode]);

  const highlightedDrawnCells = useMemo(() => {
    if (isCheckMode && currentSolveNumber !== null) {
      return getDrawnCellsForWord(currentSolveNumber);
    }
    return [];
  }, [isCheckMode, currentSolveNumber, getDrawnCellsForWord]);

  const completedWords = useMemo(() => {
    const completed = new Set<number>();
    Object.keys(puzzle.wordList).forEach(numStr => {
      const num = parseInt(numStr, 10);
      const word = puzzle.wordList[num];
      if (word && word.length > 0 && getDrawnCellsForWord(num).length === word.length) {
        completed.add(num);
      }
    });
    return completed;
  }, [puzzle.wordList, getDrawnCellsForWord]);

  // セルフモードで全単語が埋まったときのメッセージ
  const prevCompletedCountRef = useRef(0);
  useEffect(() => {
    if (!isCheckMode) {
      prevCompletedCountRef.current = 0;
      return;
    }
    const totalWords = Object.keys(puzzle.wordList).filter(k => (puzzle.wordList[parseInt(k, 10)] || '').trim() !== '').length;
    if (totalWords === 0) return;
    if (completedWords.size === totalWords && prevCompletedCountRef.current < totalWords) {
      setAlertMessage('🎉 すべての単語が埋まりました！');
    }
    prevCompletedCountRef.current = completedWords.size;
  }, [completedWords.size, isCheckMode, puzzle.wordList]);

  // 最新のパズル状態を保持するref（setInterval用）
  const latestPuzzleRef = useRef(puzzle);
  useEffect(() => {
    latestPuzzleRef.current = puzzle;
  }, [puzzle]);

  // ローカルへのバックアップは基本機能として常に実行
  useEffect(() => {
    localStorage.setItem('zigzag_autosave_data', JSON.stringify(puzzle));
  }, [puzzle]);

  // クラウド自動保存のオン/オフ設定を記憶
  useEffect(() => {
    localStorage.setItem('zigzag_cloud_autosave_setting', cloudAutoSave.toString());
  }, [cloudAutoSave]);

  // 解答面に遷移した際、変則数字表示を自動的にオフにする
  useEffect(() => {
    if (appMode === 'answer' && puzzle.isIrregularNumbersDisplay) {
      toggleIrregularNumbersDisplay();
    }
  }, [appMode, puzzle.isIrregularNumbersDisplay, toggleIrregularNumbersDisplay]);

  // クラウドへの1分毎の自動保存処理
  useEffect(() => {
    if (!cloudAutoSave || !user) return;

    const intervalId = setInterval(async () => {
      const currentPuzzle = latestPuzzleRef.current;
      // 1度も保存されていない（firebaseIdがない）場合はスキップ
      if (!currentPuzzle.firebaseId) return;

      try {
        const puzzleToSave: any = {
          ...currentPuzzle,
          ownerId: user.uid,
          updatedAt: Date.now()
        };
        puzzleToSave.cells = currentPuzzle.cells.flat();
        delete puzzleToSave.id;

        // FirebaseのupdateDocを直接呼び出す（importは上部にある前提）
        await updateDoc(doc(dbFirestore, 'puzzles', currentPuzzle.firebaseId), puzzleToSave);
        console.log('クラウドに自動保存しました:', new Date().toLocaleTimeString());
      } catch (e) {
        console.error('クラウド自動保存に失敗しました:', e);
      }
    }, 60000); // 60,000ミリ秒 = 1分

    return () => clearInterval(intervalId);
  }, [cloudAutoSave, user]);

  useEffect(() => {
    // 初回訪問（承諾済みでない）ならダイアログを表示
    const hasAgreed = localStorage.getItem('zigzag_welcome_agreed');
    if (!hasAgreed) {
      setShowWelcomeDialog(true);
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const q = query(collection(dbFirestore, 'userSettings'), where('userId', '==', u.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setExportSettings(snap.docs[0].data().export || {});
          }
        } catch (e) {
          console.error('Settings fetch error:', e);
        }
      } else {
        setExportSettings({});
      }
    });
    return () => unsubscribe();
  }, []);

  const isPuzzleModified = useMemo(() => {
    // 1. 盤面のチェック
    const hasAnyCellEdit = puzzle.cells.some(row => row.some(cell =>
      cell.type !== 'normal' ||
      cell.char !== '' ||
      cell.answerChar !== '' ||
      cell.isNumbered ||
      cell.isShaded ||
      cell.mergedParent ||
      cell.answerKey !== null
    ));
    if (hasAnyCellEdit) return true;

    // 2. 単語リストのチェック
    const hasAnyWord = Object.values(puzzle.wordList).some(w => w && w.trim() !== '');
    if (hasAnyWord) return true;

    const hasAnyWord2 = puzzle.wordList2?.some(w => w && w.trim() !== '');
    if (hasAnyWord2) return true;

    // 3. その他メタデータのチェック
    if (puzzle.title !== '無題のパズル' && puzzle.title !== '') return true;
    if (puzzle.tags && puzzle.tags.length > 0) return true;
    if (puzzle.answerColumnSpaces && puzzle.answerColumnSpaces.length > 0) return true;
    if (puzzle.remainingAnswerWord && puzzle.remainingAnswerWord.trim() !== '') return true;

    return false;
  }, [puzzle]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      setAlertMessage('ログインに失敗しました。');
    }
  };

  const handleLogout = async () => {
    setConfirmAction({
      message: 'ログアウトしますか？',
      onConfirm: async () => {
        await signOut(auth);
        setConfirmAction(null);
      }
    });
  };

  const baseCellSize = 40;

  const handleExport = () => {
    setShowExportDialog(true);
  };

  const handleExportConfirm = async (options: ExportOptions) => {
    try {
      const suggestedName = lastExportFileName || puzzle.title;
      const actualName = await exportToExcel(puzzle, options, suggestedName);
      if (actualName) {
        setLastExportFileName(actualName);
        localStorage.setItem('zigzag_last_export_filename', actualName);
      }
      if (user) {
        const q = query(collection(dbFirestore, 'userSettings'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(dbFirestore, 'userSettings', snap.docs[0].id), { export: options });
        } else {
          await addDoc(collection(dbFirestore, 'userSettings'), { userId: user.uid, export: options });
        }
        setExportSettings(options);
      }
    } catch (e) {
    }
  };

  const handleSave = async () => {
    if (!user) {
      setAlertMessage('保存するにはログインが必要です。\n上部の「ログイン」ボタンからログインしてください。');
      return;
    }
    try {
      const q = query(collection(dbFirestore, 'puzzles'), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const puzzles: PuzzleData[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.cells && data.cells.length > 0 && !Array.isArray(data.cells[0])) {
          const reconstructedCells = [];
          for (let i = 0; i < data.height; i++) {
            reconstructedCells.push(data.cells.slice(i * data.width, (i + 1) * data.width));
          }
          data.cells = reconstructedCells;
        }
        puzzles.push({ ...data, firebaseId: docSnap.id } as PuzzleData);
      });
      setCloudPuzzles(puzzles);
      setShowSaveDialog(true);
    } catch (e) {
      console.error(e);
      setAlertMessage('保存の準備に失敗しました。');
    }
  };

  const handleSaveConfirm = async (title: string, tags: string[], overwriteId?: string) => {
    if (!user) return;
    const puzzleToSave: any = {
      ...puzzle,
      title,
      tags,
      ownerId: user.uid,
      updatedAt: Date.now()
    };
    puzzleToSave.cells = puzzle.cells.flat();
    delete puzzleToSave.id;
    // セルフモードの記憶盤面があれば一緒に保存する
    if (savedSelfSolveCells) {
      puzzleToSave.savedSelfSolveCells = savedSelfSolveCells.flat();
    } else {
      puzzleToSave.savedSelfSolveCells = null;
    }

    if (overwriteId) {
      await updateDoc(doc(dbFirestore, 'puzzles', overwriteId), puzzleToSave);
      setPuzzle(prev => ({ ...prev, firebaseId: overwriteId, title, updatedAt: puzzleToSave.updatedAt }));
    } else {
      const docRef = await addDoc(collection(dbFirestore, 'puzzles'), puzzleToSave);
      setPuzzle(prev => ({ ...prev, firebaseId: docRef.id, title, updatedAt: puzzleToSave.updatedAt }));
    }
    setAlertMessage('保存しました。');
  };

  const handleLoad = async () => {
    if (!user) {
      setAlertMessage('読み込みにはログインが必要です。\n上部の「ログイン」ボタンからログインしてください。');
      return;
    }
    try {
      const q = query(collection(dbFirestore, 'puzzles'), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const puzzles: PuzzleData[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.cells && data.cells.length > 0 && !Array.isArray(data.cells[0])) {
          const reconstructedCells = [];
          for (let i = 0; i < data.height; i++) {
            reconstructedCells.push(data.cells.slice(i * data.width, (i + 1) * data.width));
          }
          data.cells = reconstructedCells;
        }
        puzzles.push({ ...data, firebaseId: docSnap.id } as PuzzleData);
      });
      puzzles.sort((a, b) => b.updatedAt - a.updatedAt);
      setCloudPuzzles(puzzles);
      setShowLoadDialog(true);
    } catch (e) {
      console.error(e);
      setAlertMessage('読み込みに失敗しました。');
    }
  };

  const normalizePuzzle = (p: any): PuzzleData => {
    const cells = p.cells.map((row: any[]) =>
      row.map((cell: any) => ({
        ...cell,
        isShaded: cell.isShaded ?? false,
        answerChar: cell.answerChar ?? '',
        style: cell.style || {}
      }))
    );
    return {
      ...p,
      cells,
      isWList: p.isWList ?? false,
      isWListStar: p.isWListStar ?? false,
      wordList2: p.wordList2 || [''],
      wordDirections: p.wordDirections || {}
    } as PuzzleData;
  };

  const handleLoadConfirm = (p: PuzzleData) => {
    const applyLoad = () => {
      const normalized = normalizePuzzle(p);
      reset(normalized);
      fitToScreen();
      setShowLoadDialog(false);
      setConfirmAction(null);
      // セルフモード関連のステートをリセット（旧パズルの状態が残らないように）
      setIsCheckMode(false);
      setCheckpointCells(null);
      setCurrentSolveNumber(null);
      setSolveCandidates([]);
      setSolveCandidateIndex(0);
      setFocusedCell(null);
      // 保存されていたセルフモード盤面を復元
      const rawSaved = (p as any).savedSelfSolveCells;
      if (rawSaved && Array.isArray(rawSaved) && rawSaved.length > 0) {
        const h = (p as any).height;
        const w = (p as any).width;
        const restoredCells: Cell[][] = [];
        for (let i = 0; i < h; i++) {
          restoredCells.push(rawSaved.slice(i * w, (i + 1) * w));
        }
        setSavedSelfSolveCells(restoredCells);
      } else {
        setSavedSelfSolveCells(null);
      }
    };

    if (isPuzzleModified) {
      setConfirmAction({
        message: `「${p.title}」を読み込みますか？\n現在の編集内容は破棄されます。`,
        isDestructive: true,
        onConfirm: applyLoad
      });
    } else {
      applyLoad();
    }
  };

  const handleDeleteCloudPuzzle = async (firebaseId: string) => {
    try {
      await deleteDoc(doc(dbFirestore, 'puzzles', firebaseId));
      setCloudPuzzles(prev => prev.filter(p => p.firebaseId !== firebaseId));
    } catch (e) {
      console.error(e);
      setAlertMessage('削除に失敗しました。');
    }
  };

  const handleNew = () => {
    setShowSizeDialog(true);
  }

  const handleNewBoard = (h: number, w: number) => {
    const applyNew = () => {
      createNewBoard(h, w);
      setShowSizeDialog(false);
      fitToScreen();
      setConfirmAction(null);
      // セルフモード関連のステートをリセット（旧パズルの状態が残らないように）
      setIsCheckMode(false);
      setCheckpointCells(null);
      setCurrentSolveNumber(null);
      setSolveCandidates([]);
      setSolveCandidateIndex(0);
      setFocusedCell(null);
      setSavedSelfSolveCells(null);
    };

    if (isPuzzleModified) {
      setConfirmAction({
        message: '現在の内容を破棄してよろしいですか？',
        isDestructive: true,
        onConfirm: applyNew
      });
    } else {
      applyNew();
    }
  }

  const handleCellMouseDown = (x: number, y: number) => {
    if (isCheckMode) {
      const drawnCandidates = getDrawnWordCandidates(x, y);
      if (drawnCandidates.length > 0) {
        let nextIndex = 0;
        // 同じマスを（マウスダウンで）押した場合は候補を切り替え
        // 判定には focusedCell ではなく現在選択中の座標を直接使う
        if (focusedCell?.x === x && focusedCell?.y === y && solveCandidates.length > 0) {
          nextIndex = (solveCandidateIndex + 1) % drawnCandidates.length;
        }
        const selectedMatch = drawnCandidates[nextIndex];
        setCurrentSolveNumber(selectedMatch.num);
        setSolveCandidates(drawnCandidates.map(c => c.num));
        setSolveCandidateIndex(nextIndex);
        setFocusedCell({ x, y });

        // リストへスクロール
        setTimeout(() => {
          const el = document.getElementById(`word-item-${selectedMatch.num}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 10);
      } else {
        // 未接続の文字や空白マスをクリックした場合は選択を解除
        setFocusedCell(null);
        setCurrentSolveNumber(null);
      }
      return; // セルフモード時はここで終了
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (isCheckMode) return; // セルフモード時はクリックでの編集を禁止

    if (appMode === 'answer') {
      const cell = puzzle.cells[y][x];

      // 入力済み文字がある場合は消去（数字・ヒント文字付きは除く）
      if (cell.answerChar && !cell.char && !cell.isNumbered) {
        updateCellAnswerChar(x, y, '');
        return;
      }

      // 提示文字があるマスはフォーカスしない
      if (cell.char) return;
      setFocusedCell({ x, y });
      return;
    }

    if (appMode === 'shade') {
      toggleShaded(x, y);
    } else if (appMode === 'edit') {
      if (editMode === 'wall') {
        toggleCellType(x, y);
      } else if (editMode === 'number') {
        if (puzzle.puzzleType === 'ナンバーレス') {
          const cell = puzzle.cells[y][x];
          if (!cell.isNumbered && !cell.char) {
            // なし -> 数字
            toggleNumberFlag(x, y);
          } else if (cell.isNumbered) {
            // 数字 -> 文字入力
            toggleNumberFlag(x, y);
            setFocusedCell({ x, y });
          } else {
            // 文字入力 -> なし (数字を振る)
            toggleNumberFlag(x, y);
            setFocusedCell(null);
          }
        } else if (puzzle.puzzleType === 'ウルトラ') {
          // ウルトラ: 数字をトグルしつつ、常に文字入力可能にする
          toggleNumberFlag(x, y);
          setFocusedCell({ x, y });
        } else {
          toggleNumberFlag(x, y);
        }
      }
    }
    setContextMenu(null);
  }

  const handleCellRightClick = (x: number, y: number, event: React.MouseEvent) => {
    if (isCheckMode) {
      event.preventDefault();
      const cell = puzzle.cells[y][x];
      // 文字があり、かつ数字マスでない場合のみ消去可能
      if (cell.char && cell.number === null) {
        updateCellChar(x, y, '');
      }
      return;
    }
    setContextMenu({ x: event.clientX, y: event.clientY, cellX: x, cellY: y });
  }

  const handleDragSelection = (x1: number, y1: number, x2: number, y2: number) => {
    if (appMode === 'answer' || isCheckMode) return;

    if (appMode === 'shade') {
      const startX = Math.min(x1, x2);
      const endX = Math.max(x1, x2);
      const startY = Math.min(y1, y2);
      const endY = Math.max(y1, y2);
      const targetValue = !puzzle.cells[startY][startX].isShaded;
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          toggleShaded(x, y, targetValue);
        }
      }
    } else if (appMode === 'edit') {
      mergeCells(x1, y1, x2, y2);
    }
  }

  const handleDragPath = (path: { x: number, y: number }[]) => {
    if (path.length < 2) return;

    if (appMode === 'shade') {
      const startCell = puzzle.cells[path[0].y][path[0].x];
      const targetValue = !startCell.isShaded;
      path.forEach(p => toggleShaded(p.x, p.y, targetValue));
      return;
    }

    if (appMode === 'edit' && !isCheckMode) {
      const first = path[0];
      const last = path[path.length - 1];
      mergeCells(first.x, first.y, last.x, last.y);
      return;
    }

    if (appMode === 'answer' || (appMode === 'edit' && isCheckMode)) {
      const startCell = puzzle.cells[path[0].y][path[0].x];

      // セルフモード: 解答面と同じ方式でドラッグ軌跡に沿って文字を書き込む
      if (isCheckMode && currentSolveNumber !== null) {
        const word = puzzle.wordList[currentSolveNumber];
        if (!word) return;

        // ドラッグ開始セルの文字インデックスを特定
        const drawnCandidates = getDrawnWordCandidates(path[0].x, path[0].y);
        const match = drawnCandidates.find(c => c.num === currentSolveNumber);
        const startCharIdx = match ? match.index : 0;

        // 解答面のドラッグ入力と同じロジック
        // ユーザーのドラッグ軌跡(path)に沿って、単語の文字を順に埋める
        pushPuzzle(prev => {
          const newCells = prev.cells.map(row => row.map(c => ({ ...c })));
          let currentCharIndex = startCharIdx;
          let lastLogicalKey = "";

          for (let i = 0; i < path.length; i++) {
            const curr = path[i];
            const cell = prev.cells[curr.y][curr.x];

            const px = cell.mergedParent ? cell.mergedParent.x : curr.x;
            const py = cell.mergedParent ? cell.mergedParent.y : curr.y;
            const logicalKey = `${px},${py}`;

            if (i > 0 && logicalKey !== lastLogicalKey) {
              currentCharIndex++;
            }
            lastLogicalKey = logicalKey;

            if (currentCharIndex < word.length) {
              // 数字マスの1文字目は既に表示されているのでスキップ
              if (i > 0 && newCells[py][px].number !== null && !newCells[py][px].mergedParent) {
                continue;
              }
              newCells[py][px].char = word[currentCharIndex];
            } else {
              break;
            }
          }
          return { ...prev, cells: newCells, updatedAt: Date.now() };
        });
        return;
      }

      // 解答面モード（既存ロジック）
      if (appMode === 'answer') {
        // 消去のトレース
        if (startCell.answerChar && !startCell.char && !startCell.isNumbered) {
          path.forEach(p => {
            const cell = puzzle.cells[p.y][p.x];
            if (!cell.isNumbered && !cell.char) {
              updateCellAnswerChar(p.x, p.y, '');
            }
          });
          return;
        }

        // 自動解答のトレース
        if (startCell.isNumbered && startCell.number !== null) {
          const word = puzzle.wordList[startCell.number];
          if (!word) return;

          let currentCharIndex = 0;
          let lastLogicalKey = "";

          for (let i = 0; i < path.length; i++) {
            const curr = path[i];
            const cell = puzzle.cells[curr.y][curr.x];

            const px = cell.mergedParent ? cell.mergedParent.x : curr.x;
            const py = cell.mergedParent ? cell.mergedParent.y : curr.y;
            const logicalKey = `${px},${py}`;

            if (i > 0 && logicalKey !== lastLogicalKey) {
              currentCharIndex++;
            }
            lastLogicalKey = logicalKey;

            if (currentCharIndex < word.length) {
              const parentCell = puzzle.cells[py][px];
              if (i > 0 && parentCell.number !== null && !parentCell.mergedParent) {
                continue;
              }
              updateCellAnswerChar(px, py, word[currentCharIndex]);
            } else {
              break;
            }
          }
        }
      }
    }
  };

  const handleAdvanceFocus = useCallback(() => {
    if (!focusedCell) return;
    const { x, y } = focusedCell;
    let nx = x;
    let ny = y;

    // 次の入力可能なマス（提示文字がないマス）を探す
    let startX = x;
    let startY = y;
    while (true) {
      nx++;
      if (nx >= puzzle.width) {
        nx = 0;
        ny++;
      }
      if (ny >= puzzle.height) {
        ny = 0;
      }

      // 一周したら終了（無限ループ防止）
      if (nx === startX && ny === startY) break;

      if (!puzzle.cells[ny][nx].char && puzzle.cells[ny][nx].type === 'normal') {
        setFocusedCell({ x: nx, y: ny });
        return;
      }
    }
    setFocusedCell(null);
  }, [focusedCell, puzzle.width, puzzle.height, puzzle.cells]);

  useEffect(() => {
    if ((appMode === 'answer' || appMode === 'edit') && focusedCell && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [appMode, focusedCell]);

  const handleHiddenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // IME入力中は何もしない
    if (isComposing || !focusedCell) return;

    const cell = puzzle.cells[focusedCell.y][focusedCell.x];
    const val = e.target.value;

    if (appMode === 'answer') {
      // 提示文字があるマスには入力させない
      if (cell.char) return;

      if (val) {
        const char = val.slice(-1);
        updateCellAnswerChar(focusedCell.x, focusedCell.y, char);
        handleAdvanceFocus();
        e.target.value = '';
      }
    } else if (appMode === 'edit' && editMode === 'number') {
      // ナンバーレスなどのヒント文字入力
      if (val) {
        const char = val.slice(-1);
        updateCellChar(focusedCell.x, focusedCell.y, char);
        e.target.value = '';
      }
    }
  };

  const handleCompositionUpdate = (e: React.CompositionEvent<HTMLInputElement>) => {
    // e.target.value ではなく e.data を使うことで、IMEの最新の変換候補を即座に反映します
    setComposingText(e.data);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    // compositionEndは確定時に呼ばれる
    setIsComposing(false);
    setComposingText('');

    if (!focusedCell) return;
    const cell = puzzle.cells[focusedCell.y][focusedCell.x];
    const val = e.data || (e.target as HTMLInputElement).value;

    if (appMode === 'answer') {
      if (cell.char) return;
      if (val) {
        updateCellAnswerChar(focusedCell.x, focusedCell.y, val);
        handleAdvanceFocus();
      }
    } else if (appMode === 'edit' && editMode === 'number') {
      if (val) {
        updateCellChar(focusedCell.x, focusedCell.y, val);
      }
    }

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = '';
    }
  };

  const validateManuscript = () => {
    const errors: React.ReactNode[] = [];

    // 1. 盤面充填チェック
    let emptyCellCount = 0;
    const emptyCoords: string[] = [];
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        const cell = puzzle.cells[y][x];
        if (cell.type === 'normal') {
          // 大マス（結合セル）の子セルの場合は、親セル（左上）にデータが入るためスキップ
          const isMergedChild = cell.mergedParent && (cell.mergedParent.x !== x || cell.mergedParent.y !== y);
          if (isMergedChild) continue;

          // 解答モードかつ起点マスの場合は、動的ヒントが表示されるためデータが空でも未入力とはみなさない
          const isHintShown = appMode === 'answer' && cell.number;
          if (!cell.char && !cell.answerChar && !isHintShown) {
            emptyCellCount++;
            if (emptyCoords.length < 5) {
              emptyCoords.push(`左から${x + 1}マス目, 上から${y + 1}マス目`);
            }
          }
        }
      }
    }
    if (emptyCellCount > 0) {
      let errorMsg = `盤面に未入力のマスがあります (${emptyCellCount}箇所)`;
      if (emptyCoords.length > 0) {
        errorMsg += `\n(例: ${emptyCoords.join(' / ')})`;
      }
      errors.push(errorMsg);
    }

    // 変則モードの場合、パス探索エラーを最初に追加
    if (puzzle.puzzleType === '変則') {
      errors.push(...irregularInfo.errors);
    }

    // 2. リスト充填チェック
    const usedNumbers = new Set<number>();
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.number !== null) usedNumbers.add(cell.number);
    }));

    const emptyWordNumbers: number[] = [];
    for (const num of usedNumbers) {
      // Wリスト★モードかつスター項目（★）としてマークされている場合は、未入力で正常なためスキップ
      if (puzzle.isWListStar && puzzle.wordStarList?.[num]) {
        continue;
      }

      if (!puzzle.wordList[num] || puzzle.wordList[num].trim() === '') {
        emptyWordNumbers.push(num);
      }
    }
    if (emptyWordNumbers.length > 0) {
      errors.push(`単語リストに未入力の番号があります: ${emptyWordNumbers.sort((a, b) => a - b).join(', ')}`);
    }

    // 3. パス接続チェック
    if (errors.length === 0) {
      const countPaths = (w: string, x: number, y: number, visited: Set<string>): number => {
        if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return 0;

        const cell = puzzle.cells[y][x];
        // 結合されている場合は親マスの座標を取得
        const px = cell.mergedParent ? cell.mergedParent.x : x;
        const py = cell.mergedParent ? cell.mergedParent.y : y;
        const parentCell = puzzle.cells[py][px];

        const currentChar = parentCell.char || parentCell.answerChar;
        if (parentCell.type !== 'normal' || currentChar !== w[0]) return 0;

        // 訪問済みチェックは結合グループ（親マスの座標）で行う
        const key = `${px},${py}`;
        if (visited.has(key)) return 0;

        const nextW = w.slice(1);
        if (nextW === '') return 1;

        const newVisited = new Set(visited);
        newVisited.add(key);

        // 次の文字を探すために、結合範囲の全てのマスとその隣接マスをリストアップ
        let total = 0;
        const groupCells: { x: number, y: number }[] = [];
        if (parentCell.mergedSize) {
          for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
            for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
              groupCells.push({ x: px + dx, y: py + dy });
            }
          }
        } else {
          groupCells.push({ x: px, y: py });
        }

        const checkedNeighborGroups = new Set<string>();
        const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const gc of groupCells) {
          for (const [dx, dy] of neighbors) {
            const nx = gc.x + dx;
            const ny = gc.y + dy;
            if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) continue;

            const nCell = puzzle.cells[ny][nx];
            if (nCell.type !== 'normal') continue;

            const npx = nCell.mergedParent ? nCell.mergedParent.x : nx;
            const npy = nCell.mergedParent ? nCell.mergedParent.y : ny;

            // 隣接マスが自分と同じ結合グループ内ならスキップ
            if (npx === px && npy === py) continue;

            // すでにチェック済みの隣接グループ（親が同じ）ならスキップ
            const nGroupKey = `${npx},${npy}`;
            if (checkedNeighborGroups.has(nGroupKey)) continue;
            checkedNeighborGroups.add(nGroupKey);

            total += countPaths(nextW, nx, ny, newVisited);
            if (total >= 2) return 2; // 2つ以上あれば十分
          }
        }
        return total;
      };

      for (const num of usedNumbers) {
        // Wリスト★モードかつスター項目（★）の場合は、単語リストが空（未入力）のため経路チェックもスキップ
        if (puzzle.isWListStar && puzzle.wordStarList?.[num]) {
          continue;
        }

        const word = puzzle.wordList[num];
        let startPos: { x: number, y: number } | null = null;
        for (let y = 0; y < puzzle.height; y++) {
          for (let x = 0; x < puzzle.width; x++) {
            if (puzzle.cells[y][x].number === num) {
              startPos = { x, y };
              break;
            }
          }
          if (startPos) break;
        }

        if (!startPos) {
          errors.push(`番号 ${num} が盤面に見つかりません`);
          continue;
        }

        const pathCount = countPaths(word, startPos.x, startPos.y, new Set());
        if (pathCount === 0) {
          errors.push(`番号 ${num} (「${word}」) の経路が正しく繋がっていません`);
        } else if (pathCount >= 2) {
          errors.push(`番号 ${num} (「${word}」) の経路が2通り以上存在します`);
        } else if (puzzle.isArrowMode && word.length >= 2) {
          const arrow = puzzle.wordDirections?.[num] || '?';
          if (arrow !== '?') {
            let dx = 0, dy = 0;
            if (arrow === '↑') dy = -1;
            if (arrow === '→') dx = 1;
            if (arrow === '↓') dy = 1;
            if (arrow === '←') dx = -1;

            const x2 = startPos.x + dx;
            const y2 = startPos.y + dy;

            let isDirCorrect = false;
            if (x2 >= 0 && x2 < puzzle.width && y2 >= 0 && y2 < puzzle.height) {
              const cell2 = puzzle.cells[y2][x2];
              const char2 = cell2.char || cell2.answerChar;
              if (char2 === word[1]) {
                isDirCorrect = true;
              }
            }

            if (!isDirCorrect) {
              errors.push(`番号 ${num} (「${word}」) の2文字目の方向が矢印「${arrow}」と合っていません`);
            }
          }
        }
      }

      // --- Wリスト / Wリスト★ の追加チェック ---
      if (puzzle.isWList || puzzle.isWListStar) {
        const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
        const targetWords = puzzle.isRemainingAnswer
          ? list2Words.filter(w => w !== puzzle.remainingAnswerWord)
          : list2Words;

        if (puzzle.isWList) {
          // Wリスト：網掛け内の単語チェック
          const shadedCells = new Set<string>();
          puzzle.cells.forEach((row, y) => row.forEach((cell, x) => {
            if (cell.isShaded) shadedCells.add(`${x},${y}`);
          }));

          const hasShadedPath = (w: string, x: number, y: number, visited: Set<string>): boolean => {
            if (w === '') return true;
            if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return false;
            
            const cell = puzzle.cells[y][x];
            const px = cell.mergedParent ? cell.mergedParent.x : x;
            const py = cell.mergedParent ? cell.mergedParent.y : y;
            const parentCell = puzzle.cells[py][px];

            if (!parentCell.isShaded) return false;
            const currentChar = parentCell.char || parentCell.answerChar;
            if (currentChar !== w[0]) return false;

            const key = `${px},${py}`;
            if (visited.has(key)) return false;
            const newVisited = new Set(visited);
            newVisited.add(key);
            const nextW = w.slice(1);
            if (nextW === '') return true;

            // 結合範囲の全てのマスをリストアップ
            const groupCells: { x: number, y: number }[] = [];
            if (parentCell.mergedSize) {
              for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
                for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
                  groupCells.push({ x: px + dx, y: py + dy });
                }
              }
            } else {
              groupCells.push({ x: px, y: py });
            }

            const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const gc of groupCells) {
              for (const [dx, dy] of neighbors) {
                const nx = gc.x + dx;
                const ny = gc.y + dy;
                if (nx < 0 || nx >= puzzle.width || ny < 0 || ny >= puzzle.height) continue;
                
                const nCell = puzzle.cells[ny][nx];
                if (nCell.type !== 'normal') continue;
                const npx = nCell.mergedParent ? nCell.mergedParent.x : nx;
                const npy = nCell.mergedParent ? nCell.mergedParent.y : ny;
                if (npx === px && npy === py) continue;

                if (hasShadedPath(nextW, nx, ny, newVisited)) return true;
              }
            }
            return false;
          };

          const missingWords: string[] = [];
          targetWords.forEach(word => {
            let found = false;
            // 全ての網掛けマスを起点に探索
            for (const posStr of shadedCells) {
              const [sx, sy] = posStr.split(',').map(Number);
              if (hasShadedPath(word, sx, sy, new Set())) {
                found = true;
                break;
              }
            }
            if (!found) missingWords.push(word);
          });

          if (missingWords.length > 0) {
            errors.push(`リスト2の単語が網掛け内に見つかりません: ${missingWords.join(', ')}`);
          }

          // 「残るもの」として選択された単語が網掛け内に存在してはいけないチェック
          if (puzzle.isRemainingAnswer && puzzle.remainingAnswerWord) {
            let foundInShaded = false;
            for (const posStr of shadedCells) {
              const [sx, sy] = posStr.split(',').map(Number);
              if (hasShadedPath(puzzle.remainingAnswerWord, sx, sy, new Set())) {
                foundInShaded = true;
                break;
              }
            }
            if (foundInShaded) {
              errors.push(`網掛け内にある言葉が「残るもの」として解答になっています：${puzzle.remainingAnswerWord}`);
            }
          }
        }

        if (puzzle.isWListStar) {
          // Wリスト★：★番号からの単語チェック
          const starNumbers = Array.from(usedNumbers).filter(num => puzzle.wordStarList?.[num]);
          const starFindings: Record<number, string[]> = {};

          starNumbers.forEach(num => {
            // 番号の座標を探す
            let sx = -1, sy = -1;
            puzzle.cells.forEach((row, y) => row.forEach((cell, x) => {
              if (cell.number === num) { sx = x; sy = y; }
            }));

            starFindings[num] = targetWords.filter(word => countPaths(word, sx, sy, new Set()) > 0);
          });

          // 単純なマッチングチェック（1対1対応が必要）
          const assignedWords = new Set<string>();
          const unassignedStars: number[] = [];

          starNumbers.sort().forEach(num => {
            const matches = starFindings[num].filter(w => !assignedWords.has(w));
            if (matches.length > 0) {
              assignedWords.add(matches[0]);
            } else {
              unassignedStars.push(num);
            }
          });

          if (unassignedStars.length > 0) {
            errors.push(`Wリスト★の番号 ${unassignedStars.join(', ')} に適合するリスト2の単語が盤面に見つかりません`);
          }

          const missingWordsInList2 = targetWords.filter(w => !assignedWords.has(w));
          if (missingWordsInList2.length > 0 && unassignedStars.length === 0) {
            errors.push(`リスト2の単語が盤面に見つかりません: ${missingWordsInList2.join(', ')}`);
          }

          // Wリスト★：「残るもの」として選択された単語が★番号の起点に存在してはいけないチェック
          if (puzzle.isRemainingAnswer && puzzle.remainingAnswerWord) {
            let foundAtStar = false;
            for (const num of starNumbers) {
              let sx = -1, sy = -1;
              puzzle.cells.forEach((row, y) => row.forEach((cell, x) => {
                if (cell.number === num) { sx = x; sy = y; }
              }));
              if (countPaths(puzzle.remainingAnswerWord, sx, sy, new Set()) > 0) {
                foundAtStar = true;
                break;
              }
            }
            if (foundAtStar) {
              errors.push(`★番号の起点にある言葉が「残るもの」として解答になっています：${puzzle.remainingAnswerWord}`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      setAlertMessage(
        <div style={{ textAlign: 'left' }}>
          <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '8px' }}>検証エラーが見つかりました：</p>
          <ul style={{ paddingLeft: '20px', fontSize: '0.85rem' }}>
            {errors.map((e, i) => <li key={i} style={{ marginBottom: '4px' }}>{e}</li>)}
          </ul>
        </div>
      );
    } else {
      setAlertMessage('バッチリです！すべての文字が正しく配置され、経路も完全に繋がっています。');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((appMode !== 'answer' && appMode !== 'edit') || !focusedCell) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let { x, y } = focusedCell;
      if (e.key === 'ArrowUp') y = y > 0 ? y - 1 : puzzle.height - 1;
      if (e.key === 'ArrowDown') y = y < puzzle.height - 1 ? y + 1 : 0;
      if (e.key === 'ArrowLeft') x = x > 0 ? x - 1 : puzzle.width - 1;
      if (e.key === 'ArrowRight') x = x < puzzle.width - 1 ? x + 1 : 0;
      setFocusedCell({ x, y });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (appMode === 'answer') handleAdvanceFocus();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (appMode === 'answer') {
        const cell = puzzle.cells[focusedCell.y][focusedCell.x];
        const current = cell.answerChar || '';
        if (e.key === 'Backspace' && current.length > 1) {
          updateCellAnswerChar(focusedCell.x, focusedCell.y, current.slice(0, -1));
        } else {
          updateCellAnswerChar(focusedCell.x, focusedCell.y, '');
        }
      } else if (appMode === 'edit') {
        const cell = puzzle.cells[focusedCell.y][focusedCell.x];
        const current = cell.char || '';
        if (e.key === 'Backspace' && current.length > 1) {
          updateCellChar(focusedCell.x, focusedCell.y, current.slice(0, -1));
        } else {
          updateCellChar(focusedCell.x, focusedCell.y, '');
        }
      }
    }
  };

  const fitToScreen = () => {
    setTimeout(() => {
      const scrollArea = document.getElementById('board-scroll-area');
      const content = document.getElementById('board-content-wrapper');
      if (!scrollArea || !content) return;

      const availW = scrollArea.clientWidth - 40;
      const availH = scrollArea.clientHeight - 40;

      const rect = content.getBoundingClientRect();
      const naturalW = rect.width / zoom;
      const naturalH = rect.height / zoom;

      if (naturalW > 0 && naturalH > 0) {
        const scaleW = availW / naturalW;
        const scaleH = availH / naturalH;
        const targetScale = Math.min(scaleW, scaleH);
        const newZoom = Math.min(2.0, Math.max(0.2, targetScale));
        setZoom(newZoom);
      }
    }, 100);
  };

  // タブ切り替え時や画面サイズ変更時に自動フィット
  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [activeMobileTab]);

  const handleConfirmResize = () => {
    if (pendingResize) {
      resizeBoard(pendingResize.h, pendingResize.w);
      fitToScreen();
      setPendingResize(null);
      setShowSettingsDialog(false);
    }
  };

  const handlePrintRequest = (options: PrintOptions) => {
    setPrintOptions(options);
    // レンダリングを待つ
    setTimeout(() => {
      window.print();
    }, 100);
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const numbers = Array.from(puzzle.cells.reduce((acc, row) => {
    row.forEach(cell => {
      if (cell.number !== null) acc.add(cell.number);
    });
    return acc;
  }, new Set<number>())).sort((a, b) => a - b);

  const usedAnswerKeys = useMemo(() => {
    const keys = new Set<string>();
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.answerKey) keys.add(cell.answerKey);
    }));
    return keys;
  }, [puzzle.cells]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undo, redo]);

  const alphabetGroups = useMemo(() => {
    const usedKeys = new Set<string>();
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.answerKey) usedKeys.add(cell.answerKey);
    }));
    if (usedKeys.size === 0) return [];
    const uniqueSorted = Array.from(usedKeys).sort();
    const groups: string[][] = [];
    if (uniqueSorted.length === 0) return groups;
    let currentGroup = [uniqueSorted[0]];
    for (let i = 1; i < uniqueSorted.length; i++) {
      const prevChar = uniqueSorted[i - 1];
      const currChar = uniqueSorted[i];

      const isConsecutive = currChar.charCodeAt(0) === prevChar.charCodeAt(0) + 1;
      const hasSpace = (puzzle.answerColumnSpaces || []).includes(prevChar);

      if (isConsecutive && !hasSpace) {
        currentGroup.push(currChar);
      } else {
        groups.push(currentGroup);
        currentGroup = [currChar];
      }
    }
    groups.push(currentGroup);
    return groups;
  }, [puzzle.cells, puzzle.answerColumnSpaces]);

  const hasShadedCells = useMemo(() => {
    return puzzle.cells.some(row => row.some(cell => cell.isShaded));
  }, [puzzle.cells]);

  const answerChars = useMemo(() => {
    const map: Record<string, string> = {};
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.answerKey) {
        map[cell.answerKey] = isCheckMode ? (cell.char || '') : (cell.answerChar || '');
      }
    }));
    return map;
  }, [puzzle.cells, isCheckMode]);



  const handleImportExcelClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await analyzeExcelFile(file);
      setImportResult(result);
    } catch (error) {
      console.error('Excelファイルの解析に失敗しました', error);
      alert('Excelファイルの解析に失敗しました。');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  const handleImportConfirm = (config: ManualImportConfig) => {
    if (!importResult) return;
    try {
      const newPuzzle = convertManualImportToPuzzle(puzzle, importResult.workbook, config);
      setPuzzle(newPuzzle);
      setImportResult(null);
    } catch (e: any) {
      alert("インポート中にエラーが発生しました:\n" + e.message + "\n\nスタックトレース:\n" + e.stack);
      console.error(e);
    }
  };

  return (
    <Layout
      onExport={handleExport}
      onNew={handleNew}
      onSave={handleSave}
      onLoad={handleLoad}
      onImportExcel={handleImportExcelClick}
      onHelp={() => setShowHelpDialog(true)}
      onSettings={() => {
        if (window.innerWidth < 768) {
          setShowMobileSettingsMenu(true);
        } else {
          setShowSettingsDialog(true);
        }
      }}
      undo={undo}
      redo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      user={user}
      onLogin={handleLogin}
      onLogout={handleLogout}
      activeTab={activeMobileTab}
      onTabChange={setActiveMobileTab}
      appMode={appMode}
      onModeChange={setAppMode}
    >
      <div className="main-content-wrapper" style={{ 
        display: 'flex', 
        flex: 1, 
        height: window.innerWidth < 768 ? '100%' : 'calc(100vh - 80px)', 
        overflow: 'hidden' 
      }}>
        <input
          ref={hiddenInputRef}
          type="text"
          onChange={handleHiddenInput}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
        />
        <aside className={`sidebar shadow ${window.innerWidth < 768 && activeMobileTab === 'board' ? 'hide-on-mobile' : ''}`}>
          <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
            {/* 固定ヘッダー部分 */}
            <section style={{ padding: '16px 16px 0px 16px', flexShrink: 0 }}>
              <div className="hide-on-mobile" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  className={appMode === 'shade' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    const doSwitch = (saveCells: boolean) => {
                      if (saveCells) {
                        setSavedSelfSolveCells(JSON.parse(JSON.stringify(puzzle.cells)));
                      }
                      if (checkpointCells) {
                        setPuzzle(p => ({ ...p, cells: checkpointCells }));
                        setCheckpointCells(null);
                      }
                      setIsCheckMode(false);
                      setCurrentSolveNumber(null);
                      setAppMode('shade');
                    };
                    if (isCheckMode && checkpointCells) {
                      const hasChanges = puzzle.cells.some((row, y) => row.some((cell, x) => cell.char !== checkpointCells[y][x].char));
                      if (hasChanges) {
                        setSelfSolveConfirm({
                          message: '網掛け画面に移行します。入力した文字を記憶しますか？',
                          onYes: () => { doSwitch(true); setSelfSolveConfirm(null); },
                          onNo: () => { setSavedSelfSolveCells(null); doSwitch(false); setSelfSolveConfirm(null); }
                        });
                        return;
                      }
                    }
                    doSwitch(false);
                  }}
                  style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem' }}
                >
                  網掛け
                </button>
                <button
                  className={appMode === 'edit' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    const doSwitch = (saveCells: boolean) => {
                      if (saveCells) {
                        setSavedSelfSolveCells(JSON.parse(JSON.stringify(puzzle.cells)));
                      }
                      if (checkpointCells) {
                        setPuzzle(p => ({ ...p, cells: checkpointCells }));
                        setCheckpointCells(null);
                      }
                      setIsCheckMode(false);
                      setCurrentSolveNumber(null);
                      setFocusedCell(null);
                      setAppMode('edit');
                    };
                    if (isCheckMode && checkpointCells) {
                      const hasChanges = puzzle.cells.some((row, y) => row.some((cell, x) => cell.char !== checkpointCells[y][x].char));
                      if (hasChanges) {
                        setSelfSolveConfirm({
                          message: '問題面の編集モードへ移行します。入力した文字を記憶しますか？',
                          onYes: () => { doSwitch(true); setSelfSolveConfirm(null); },
                          onNo: () => { setSavedSelfSolveCells(null); doSwitch(false); setSelfSolveConfirm(null); }
                        });
                        return;
                      }
                    }
                    doSwitch(false);
                  }}
                  style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem' }}
                >
                  問題面
                </button>
                <button
                  className={appMode === 'answer' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    const doSwitch = (saveCells: boolean) => {
                      if (saveCells) {
                        setSavedSelfSolveCells(JSON.parse(JSON.stringify(puzzle.cells)));
                      }
                      if (checkpointCells) {
                        setPuzzle(p => ({ ...p, cells: checkpointCells }));
                        setCheckpointCells(null);
                      }
                      setIsCheckMode(false);
                      setCurrentSolveNumber(null);
                      setEditMode('number');
                      setAppMode('answer');
                    };
                    if (isCheckMode && checkpointCells) {
                      const hasChanges = puzzle.cells.some((row, y) => row.some((cell, x) => cell.char !== checkpointCells[y][x].char));
                      if (hasChanges) {
                        setSelfSolveConfirm({
                          message: '解答面に移行します。入力した文字を記憶しますか？',
                          onYes: () => { doSwitch(true); setSelfSolveConfirm(null); },
                          onNo: () => { setSavedSelfSolveCells(null); doSwitch(false); setSelfSolveConfirm(null); }
                        });
                        return;
                      }
                    }
                    doSwitch(false);
                  }}
                  style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem' }}
                >
                  解答面
                </button>
              </div>

              {/* ジャンル選択のドロップダウンと数字非表示ボタン */}
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={puzzle.puzzleType || 'ノーマル'}
                  onChange={(e) => setPuzzleType(e.target.value as any)}
                  style={{ width: '66.6%', padding: '6px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'white', cursor: 'pointer' }}
                >
                  <option value="ノーマル">ノーマル</option>
                  <option value="Wリスト">Wリスト</option>
                  <option value="Wリスト★">Wリスト★</option>
                  <option value="ナンバーレス">ナンバーレス</option>
                  <option value="部分ナンバーレス">部分ナンバーレス</option>

                  <option value="ウルトラ">ウルトラ</option>
                  <option value="変則">変則</option>
                  <option value="矢印">矢印</option>
                </select>

                {puzzle.puzzleType === 'ウルトラ' && (
                  <button
                    className={puzzle.isNumbersHidden ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '6px 4px', height: '34px', whiteSpace: 'nowrap' }}
                    onClick={toggleNumbersHidden}
                  >
                    数字非表示
                  </button>
                )}

                {puzzle.puzzleType === '変則' && (
                  <button
                    className={puzzle.isIrregularNumbersDisplay ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '6px 4px', height: '34px', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (appMode === 'answer') {
                        playBuzzer();
                        return;
                      }
                      toggleIrregularNumbersDisplay();
                    }}
                  >
                    変則数字表示
                  </button>
                )}
              </div>

              {/* 変則モードのエラー表示 */}
              {puzzle.puzzleType === '変則' && puzzle.isIrregularNumbersDisplay && irregularInfo.errors.length > 0 && (
                <div style={{
                  marginBottom: '16px',
                  padding: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#dc2626'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>共有マスの計算エラー:</div>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {irregularInfo.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="hide-on-mobile" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setShowSettingsDialog(true)}
                  title="設定"
                >
                  <Settings size={20} />
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setShowSizeDialog(true)}
                  title="サイズ変更"
                >
                  <Grid3X3 size={20} />
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setShowPrintDialog(true)}
                  title="印刷"
                >
                  <Printer size={20} />
                </button>

                {appMode === 'answer' ? (
                  <button
                    className="btn-orange"
                    style={{ flex: 1, padding: '10px 0', fontSize: '0.9rem', height: '42px' }}
                    onClick={validateManuscript}
                  >
                    完成チェック
                  </button>
                ) : appMode === 'edit' ? (
                  <div style={{ flex: 1, display: 'flex', gap: '8px', minHeight: '42px' }}>
                    {isCheckMode ? (
                      <>
                        <button
                          className="btn-secondary"
                          style={{ flex: '0 0 30%', padding: '4px 0', fontSize: '0.8rem', height: '42px' }}
                          onClick={() => {
                            const doSwitch = (saveCells: boolean) => {
                              if (saveCells) {
                                setSavedSelfSolveCells(JSON.parse(JSON.stringify(puzzle.cells)));
                              }
                              if (checkpointCells) {
                                setPuzzle(p => ({ ...p, cells: checkpointCells }));
                                setCheckpointCells(null);
                              }
                              setIsCheckMode(false);
                              setCurrentSolveNumber(null);
                            };
                            if (checkpointCells) {
                              const hasChanges = puzzle.cells.some((row, y) => row.some((cell, x) => cell.char !== checkpointCells[y][x].char));
                              if (hasChanges) {
                                setSelfSolveConfirm({
                                  message: '問題面の編集モードへ移行します。入力した文字を記憶しますか？',
                                  onYes: () => { doSwitch(true); setSelfSolveConfirm(null); },
                                  onNo: () => { setSavedSelfSolveCells(null); doSwitch(false); setSelfSolveConfirm(null); }
                                });
                                return;
                              }
                            }
                            doSwitch(false);
                          }}
                        >
                          編集へ
                        </button>
                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button
                            className={solveMethod === 'self' ? 'btn-orange' : 'btn-secondary'}
                            style={{
                              flex: 1,
                              padding: '2px 0',
                              fontSize: '0.75rem',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                            onClick={() => setSolveMethod('self')}
                          >
                            セルフ
                          </button>
                          <button
                            className={solveMethod === 'auto' ? 'btn-orange' : 'btn-secondary'}
                            style={{
                              flex: 1,
                              padding: '2px 0',
                              fontSize: '0.75rem',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                            onClick={() => setSolveMethod('auto')}
                          >
                            自動解答
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        className="btn-orange"
                        style={{ flex: 1, padding: '10px 0', fontSize: '0.9rem', height: '42px' }}
                        onClick={() => {
                          setCheckpointCells(JSON.parse(JSON.stringify(puzzle.cells)));
                          setIsCheckMode(true);
                          setSolveMethod('self');
                          setCurrentSolveNumber(null);
                          // 記憶済みの盤面があれば復元する
                          if (savedSelfSolveCells) {
                            setPuzzle(p => ({ ...p, cells: JSON.parse(JSON.stringify(savedSelfSolveCells)) }));
                          }
                        }}
                      >
                        解きチェック
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              <div style={{ padding: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary-color)' }}>単語リスト</h4>
                  {(puzzle.puzzleType === 'ナンバーレス' || puzzle.puzzleType === '部分ナンバーレス') && (
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                      onClick={() => setWordListOrderMode(puzzle.wordListOrderMode === 'alphabetical' ? 'numerical' : 'alphabetical')}
                      title={puzzle.wordListOrderMode === 'alphabetical' ? "数字順に並べ替え" : "あいうえお順に並べ替え"}
                    >
                      {puzzle.wordListOrderMode === 'alphabetical' ? '数字順' : 'あいうえお順'}
                    </button>
                  )}
                </div>

              </div>
            </section>

            <hr style={{ border: 'none', borderTop: '2px solid var(--border-color)', margin: '0', flexShrink: 0 }} />

            {/* スクロール可能な中央部分 */}
            <section style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflowY: 'auto', 
              padding: '12px 16px',
              paddingBottom: window.innerWidth < 768 ? '60px' : '12px'
            }}>
              <div style={{ fontSize: '0.8rem' }}>
                <div className="word-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {(() => {
                    const numbersList = Array.from(numbers);
                    if (puzzle.puzzleType === '部分ナンバーレス' && puzzle.wordListOrderMode === 'alphabetical') {
                      const publicNums = numbersList.filter(n => puzzle.publicNumbers?.[n]).sort((a, b) => a - b);
                      const privateNums = (puzzle.customAlphabeticalOrder || numbersList).filter(n => !puzzle.publicNumbers?.[n]);
                      return [...publicNums, ...privateNums];
                    }
                    return (puzzle.wordListOrderMode === 'alphabetical' ? (puzzle.customAlphabeticalOrder || numbers) : numbers);
                  })().map((num, idx) => (
                    <div
                      key={num}
                      id={`word-item-${num}`}
                      draggable={puzzle.wordListOrderMode === 'alphabetical'}
                      onDragStart={(e) => {
                        if (puzzle.wordListOrderMode !== 'alphabetical') return;
                        setDraggedItemIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedItemIndex !== null && draggedItemIndex !== idx) {
                          reorderWordList(draggedItemIndex, idx);
                        }
                        setDraggedItemIndex(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'grab',
                        padding: '4px',
                        borderRadius: '4px',
                        backgroundColor: currentSolveNumber === num ? '#fff7ed' : (draggedItemIndex === idx ? 'var(--bg-secondary)' : (completedWords.has(num) ? '#e2e8f0' : 'transparent')),
                        border: currentSolveNumber === num ? '2px solid #ea580c' : '1px solid transparent',
                        transition: 'all 0.2s',
                        boxShadow: currentSolveNumber === num ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none'
                      }}
                      onDragEnd={() => setDraggedItemIndex(null)}
                    >
                      <span style={{ minWidth: '24px', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {`${num}.`}
                      </span>
                      {puzzle.puzzleType === '部分ナンバーレス' && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePublicNumber(num);
                          }}
                          style={{
                            cursor: 'pointer',
                            fontSize: '1rem',
                            marginLeft: '2px',
                            marginRight: '6px',
                            color: puzzle.publicNumbers?.[num] ? '#4f46e5' : '#94a3b8',
                            fontWeight: 'bold',
                            transition: 'color 0.2s'
                          }}
                          title="数字を公開/非公開"
                        >
                          {puzzle.publicNumbers?.[num] ? '◎' : '×'}
                        </span>
                      )}
                      {puzzle.isWListStar && (
                        <input
                          type="checkbox"
                          className="star-checkbox"
                          checked={puzzle.wordStarList?.[num] || false}
                          onChange={() => toggleWordStar(num)}
                          title="リスト2から入るスター項目"
                        />
                      )}
                      {puzzle.isArrowMode && (
                        <select
                          value={puzzle.wordDirections?.[num] || '?'}
                          onChange={(e) => updateWordDirection(num, e.target.value)}
                          style={{ padding: '4px', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        >
                          <option value="?">？</option>
                          <option value="↑">↑</option>
                          <option value="→">→</option>
                          <option value="↓">↓</option>
                          <option value="←">←</option>
                        </select>
                      )}
                      <input
                        type="text"
                        value={puzzle.wordList[num] || ''}
                        onChange={(e) => {
                          if (isCheckMode) {
                            setAlertMessage('「編集へ」ボタンを押して、編集モードに戻ってください');
                            return;
                          }
                          const isFirst = editingWordRef.current !== num;
                          updateWordList(num, e.target.value, isFirst);
                          editingWordRef.current = num;
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (puzzle.isWListStar && puzzle.wordStarList?.[num] && val !== '') {
                            setConfirmAction({
                              message: "★のマスですが、入力していいですか?",
                              isDestructive: false,
                              onConfirm: () => setConfirmAction(null),
                              onCancel: () => {
                                updateWordList(num, '', false);
                                setConfirmAction(null);
                              }
                            } as any);
                          }
                          editingWordRef.current = null;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.currentTarget as HTMLInputElement).value.trim();

                            const moveFocus = () => {
                              const inputs = Array.from(document.querySelectorAll('.word-list-grid .input-field')) as HTMLInputElement[];
                              const index = inputs.indexOf(e.currentTarget as HTMLInputElement);
                              if (index !== -1 && index < inputs.length - 1) {
                                inputs[index + 1].focus();
                              }
                            };

                            if (puzzle.isWListStar && puzzle.wordStarList?.[num] && val !== '') {
                              setConfirmAction({
                                message: "★のマスですが、入力していいですか?",
                                isDestructive: false,
                                onConfirm: () => {
                                  setConfirmAction(null);
                                  moveFocus();
                                },
                                onCancel: () => {
                                  updateWordList(num, '', false);
                                  setConfirmAction(null);
                                }
                              } as any);
                            } else {
                              moveFocus();
                            }
                          }
                        }}
                        className="input-field"
                        placeholder="単語を入力..."
                        style={{ padding: '6px 10px', fontSize: '0.9rem', flex: 1 }}
                      />
                    </div>
                  ))}
                  {numbers.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>
                      盤面に番号を振ると<br />ここに入力欄が表示されます
                    </p>
                  )}
                </div>

                {(puzzle.isWList || puzzle.isWListStar) && (
                  <div style={{ marginTop: '20px', borderTop: '2px solid var(--border-color)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary-color)' }}>リスト2</h4>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={puzzle.isRemainingAnswer || false}
                          onChange={(e) => setIsRemainingAnswer(e.target.checked)}
                        />
                        解答余り
                      </label>
                    </div>
                    <div className="word-list2-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(puzzle.wordList2 || ['']).map((word, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => {
                            setDraggedWord2Index(idx);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedWord2Index !== null && draggedWord2Index !== idx) {
                              reorderWordList2(draggedWord2Index, idx);
                            }
                            setDraggedWord2Index(null);
                          }}
                          onDragEnd={() => setDraggedWord2Index(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'grab',
                            padding: '4px',
                            borderRadius: '4px',
                            backgroundColor: draggedWord2Index === idx ? 'var(--bg-secondary)' : 'transparent',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <span style={{ minWidth: '24px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                            {`${idx + 1}.`}
                          </span>
                          <input
                            type="text"
                            value={word}
                            onChange={(e) => updateWordList2(idx, e.target.value)}
                            className="input-field"
                            style={{ padding: '6px 10px', fontSize: '0.9rem', flex: 1 }}
                            placeholder={`${idx + 1}. 単語を入力...`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const inputs = Array.from(document.querySelectorAll('.word-list2-container .input-field')) as HTMLInputElement[];
                                const index = inputs.indexOf(e.currentTarget as HTMLInputElement);
                                if (index !== -1 && index < inputs.length - 1) {
                                  inputs[index + 1].focus();
                                }
                              }
                            }}
                          />
                        </div>
                      ))}
                      <button
                        onClick={addWordList2Entry}
                        style={{
                          border: '1px dashed var(--border-color)',
                          background: 'none',
                          padding: '8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)'
                        }}
                        title="入力欄を追加"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 固定フッター部分 */}
            <section className="hide-on-mobile" style={{ padding: '8px 16px 16px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="縮小">
                    <ZoomOut size={16} />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} title="拡大">
                    <ZoomIn size={16} />
                  </button>
                </div>
              </div>

              <button
                className="btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
                onClick={() => fitToScreen()}
              >
                <Maximize size={18} /> 画面フィット
              </button>
            </section>
          </div>
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div className={`main-board glass ${window.innerWidth < 768 && activeMobileTab === 'list' ? 'hide-on-mobile' : ''}`} style={{
            flex: 1,
            padding: window.innerWidth < 768 ? '0' : '10px 20px 0px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            minHeight: 0,
            position: 'relative',
            borderRadius: '6px'
          }}>
            {/* モード切り替えボタン（モバイル専用・固定表示） */}
            {window.innerWidth < 768 && (
              <div style={{
                width: '100%',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                zIndex: 10,
                flexShrink: 0,
                display: 'flex',
                gap: '8px'
              }}>
                {appMode === 'answer' ? (
                  <button
                    className="btn-orange"
                    style={{ flex: 1, padding: '8px 0', fontSize: '0.9rem', height: '38px' }}
                    onClick={validateManuscript}
                  >
                    完成チェック
                  </button>
                ) : appMode === 'edit' ? (
                  isCheckMode ? (
                    <>
                      <button
                        className="btn-secondary"
                        style={{ flex: '0 0 70px', padding: '0', fontSize: '0.8rem', height: '38px' }}
                        onClick={() => {
                          const doSwitch = (saveCells: boolean) => {
                            if (saveCells) {
                              setSavedSelfSolveCells(JSON.parse(JSON.stringify(puzzle.cells)));
                            }
                            if (checkpointCells) {
                              setPuzzle(p => ({ ...p, cells: checkpointCells }));
                              setCheckpointCells(null);
                            }
                            setIsCheckMode(false);
                            setCurrentSolveNumber(null);
                          };
                          if (checkpointCells) {
                            const hasChanges = puzzle.cells.some((row, y) => row.some((cell, x) => cell.char !== checkpointCells[y][x].char));
                            if (hasChanges) {
                              setSelfSolveConfirm({
                                message: '編集モードへ移行します。入力内容を記憶しますか？',
                                onYes: () => { doSwitch(true); setSelfSolveConfirm(null); },
                                onNo: () => { setSavedSelfSolveCells(null); doSwitch(false); setSelfSolveConfirm(null); }
                              });
                              return;
                            }
                          }
                          doSwitch(false);
                        }}
                      >
                        編集へ
                      </button>
                      <button
                        className={solveMethod === 'self' ? 'btn-orange' : 'btn-secondary'}
                        style={{ flex: 1, fontSize: '0.8rem', height: '38px' }}
                        onClick={() => setSolveMethod('self')}
                      >
                        セルフ
                      </button>
                      <button
                        className={solveMethod === 'auto' ? 'btn-orange' : 'btn-secondary'}
                        style={{ flex: 1, fontSize: '0.8rem', height: '38px' }}
                        onClick={() => setSolveMethod('auto')}
                      >
                        自動
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-orange"
                      style={{ flex: 1, padding: '8px 0', fontSize: '0.9rem', height: '38px' }}
                      onClick={() => {
                        setCheckpointCells(JSON.parse(JSON.stringify(puzzle.cells)));
                        setIsCheckMode(true);
                        setSolveMethod('self');
                        setCurrentSolveNumber(null);
                        if (savedSelfSolveCells) {
                          setPuzzle(p => ({ ...p, cells: JSON.parse(JSON.stringify(savedSelfSolveCells)) }));
                        }
                      }}
                    >
                      解きチェック
                    </button>
                  )
                ) : null}
              </div>
            )}

            <div id="board-scroll-area" style={{
              flex: 1,
              width: '100%',
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px',
              paddingBottom: window.innerWidth < 768 ? '120px' : '20px'
            }}>
              <div id="board-content-wrapper" style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: window.innerWidth < 768 ? '20px' : '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 'fit-content',
                marginTop: '0',
                paddingBottom: '15px'
              }}>
                <input
                  type="text"
                  value={puzzle.boardTitle || ''}
                  onChange={(e) => setBoardTitle(e.target.value)}
                  placeholder="タイトルを入力..."
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: 'none',
                    background: 'transparent',
                    marginBottom: '0.2rem',
                    outline: 'none',
                    color: 'var(--primary-color)'
                  }}
                />
                <AnswerArea
                  groups={alphabetGroups}
                  cellSize={baseCellSize}
                  charMap={(appMode === 'answer' || isCheckMode) ? answerChars : {}}
                  isRemainingAnswer={puzzle.isRemainingAnswer}
                  remainingAnswerWord={(appMode === 'answer' || isCheckMode) ? (puzzle.remainingAnswerWord || '') : ''}
                  list2={puzzle.wordList2 || []}
                  onSelectRemaining={setRemainingAnswerWord}
                  isEditingSpaces={isEditingSpaces}
                  answerColumnSpaces={puzzle.answerColumnSpaces}
                  onToggleSpace={toggleAnswerColumnSpace}
                  onToggleEditing={() => setIsEditingSpaces(!isEditingSpaces)}
                />
                <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Grid
                    cells={puzzle.cells}
                    onCellClick={handleCellClick}
                    onCellMouseDown={handleCellMouseDown}
                    onCellRightClick={handleCellRightClick}
                    onDragSelection={handleDragSelection}
                    onDragPath={handleDragPath}
                    cellSize={baseCellSize}
                    appMode={appMode}
                    isCheckMode={isCheckMode}
                    focusedCell={focusedCell}
                    composingText={composingText}
                    shadingColor={puzzle.shadingColor}
                    wordList={puzzle.wordList}
                    boardFontWeight={puzzle.boardFontWeight || 'normal'}
                    boardFontFamily={puzzle.boardFontFamily || ''}
                    isNumbersHidden={puzzle.isNumbersHidden}
                    isIrregularNumbersDisplay={puzzle.isIrregularNumbersDisplay}
                    sharedCells={irregularInfo.sharedCells}
                    highlightedDrawnCells={highlightedDrawnCells}
                    completedWords={completedWords}
                    currentSolveNumber={currentSolveNumber}
                  />
                </div>
              </div>
            </div>

            {/* モバイル版ではここは空にする（下のタグバー統合部分へ移動） */}
          </div>


          {/* タグバーと画面フィットボタンの統合コンテナ */}
          <div style={{
            width: '100%',
            position: window.innerWidth < 768 ? 'fixed' : 'relative',
            bottom: window.innerWidth < 768 ? '70px' : 'auto',
            left: 0,
            zIndex: 950,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* モバイル用画面フィットボタン（タグバーの上に密着） */}
            {window.innerWidth < 768 && activeMobileTab === 'board' && (
              <div style={{
                width: '100%',
                padding: '4px 12px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                flexShrink: 0
              }}>
                <button 
                  className="btn-secondary" 
                  onClick={fitToScreen} 
                  style={{ 
                    width: '100%',
                    height: '38px',
                    fontSize: '0.9rem', 
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}
                >
                  画面フィット
                </button>
              </div>
            )}
            
            <div style={{
              width: '100%',
              padding: '4px 16px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f1f5f9',
              flexShrink: 0,
              minHeight: '32px'
            }}>
            <button
              onClick={() => setShowTagDialog(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '2px',
                border: '1px solid var(--primary-color)',
                color: 'var(--primary-color)',
                background: 'white',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
                lineHeight: 1
              }}
              title="タグを追加"
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '-1px' }}>+</span>
            </button>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {puzzle.tags && puzzle.tags.length > 0 ? puzzle.tags.map(tag => (
                <div key={tag} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'white',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.65rem',
                  color: '#334155',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
                }}>
                  <span>{tag}</span>
                  <span
                    onClick={() => removeTag(tag)}
                    style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', lineHeight: '1', marginLeft: '2px' }}
                  >×</span>
                </div>
              )) : (
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>タグ未設定</span>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

    {contextMenu && (() => {
        const menuWidth = 240;
        const menuHeight = 310; // 概算
        const x = contextMenu.x + menuWidth > window.innerWidth ? contextMenu.x - menuWidth : contextMenu.x;
        const y = contextMenu.y + menuHeight > window.innerHeight ? contextMenu.y - menuHeight : contextMenu.y;

        return (
          <div
            className="context-menu"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-menu-label">アルファベット選択</div>
            {ALPHABET.map(key => {
              const isUsed = usedAnswerKeys.has(key);
              const isCurrent = puzzle.cells[contextMenu.cellY][contextMenu.cellX].answerKey === key;
              return (
                <div
                  key={key}
                  className={`context-menu-item ${isCurrent ? 'selected' : ''}`}
                  style={{
                    opacity: (isUsed && !isCurrent) ? 0.3 : 1,
                    pointerEvents: (isUsed && !isCurrent) ? 'none' : 'auto',
                    border: isCurrent ? '1px solid var(--primary-color)' : '1px solid transparent',
                    backgroundColor: isCurrent ? 'var(--primary-light)' : 'transparent',
                  }}
                  onClick={() => {
                    setAnswerKey(contextMenu.cellX, contextMenu.cellY, key);
                    setContextMenu(null);
                  }}
                >
                  {key}
                </div>
              );
            })}
            <div
              className="context-menu-action"
              onClick={() => {
                setAnswerKey(contextMenu.cellX, contextMenu.cellY, null);
                splitCell(contextMenu.cellX, contextMenu.cellY);
                setContextMenu(null);
              }}
            >
              大マスの解除 / クリア
            </div>
          </div>
        );
      })()}

      {showSettingsDialog && (
        <SettingsDialog
          shadingColor={puzzle.shadingColor || '#e2e8f0'}
          boardFontWeight={puzzle.boardFontWeight || 'normal'}
          boardFontFamily={puzzle.boardFontFamily || ''}
          cloudAutoSave={cloudAutoSave}
          onClose={() => setShowSettingsDialog(false)}
          onSetShadingColor={setShadingColor}
          onSetFontWeight={setBoardFontWeight}
          onSetFontFamily={setBoardFontFamily}
          onSetCloudAutoSave={setCloudAutoSave}
          version={APP_VERSION}
        />
      )}

      {showPrintDialog && (
        <PrintDialog
          onClose={() => setShowPrintDialog(false)}
          onPrint={handlePrintRequest}
          wordList={puzzle.wordList}
        />
      )}

      {printOptions && (
        <PrintTemplate
          puzzle={puzzle}
          options={printOptions}
          alphabetGroups={alphabetGroups}
          answerChars={answerChars}
          sharedCells={irregularInfo.sharedCells}
        />
      )}

      {/* カスタム確認ダイアログ */}
      {pendingResize && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content glass card" style={{ width: '400px', textAlign: 'center', padding: '32px' }}>
            <h3 style={{ color: '#d97706', marginBottom: '16px' }}>消去の警告</h3>
            <p style={{ marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem' }}>
              数字のマス、アルファベットのマス、または大マスが切り捨てられますがよろしいですか？<br />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>※はみ出す範囲の大マス設定は解除されます。</span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                onClick={() => setPendingResize(null)}
                style={{ minWidth: '100px' }}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmResize}
                style={{ minWidth: '100px', backgroundColor: '#d97706', borderColor: '#d97706' }}
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveDialog && (
        <SaveDialog
          currentTitle={puzzle.title}
          tags={puzzle.tags || []}
          existingPuzzles={cloudPuzzles}
          onClose={() => setShowSaveDialog(false)}
          onSave={handleSaveConfirm}
        />
      )}

      {showLoadDialog && (
        <LoadDialog
          puzzles={cloudPuzzles}
          onClose={() => setShowLoadDialog(false)}
          onSelect={handleLoadConfirm}
          onDelete={handleDeleteCloudPuzzle}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          initialOptions={exportSettings}
          hasShadedCells={hasShadedCells}
          onClose={() => setShowExportDialog(false)}
          onExport={handleExportConfirm}
        />
      )}

      {alertMessage && (
        <AlertDialog
          message={alertMessage}
          onClose={() => setAlertMessage(null)}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={(confirmAction as any).onCancel || (() => setConfirmAction(null))}
          isDestructive={(confirmAction as any).isDestructive}
        />
      )}

      {selfSolveConfirm && (
        <div className="modal-overlay" style={{ zIndex: 4000 }}>
          <div className="modal-content glass card" style={{ width: '400px', textAlign: 'center', padding: '32px' }}>
            <h3 style={{ color: 'var(--text-color)', marginBottom: '16px' }}>確認</h3>
            <div style={{ marginBottom: '24px', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {selfSolveConfirm.message}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={selfSolveConfirm.onYes} style={{ minWidth: '80px' }}>
                はい
              </button>
              <button className="btn-secondary" onClick={selfSolveConfirm.onNo} style={{ minWidth: '80px' }}>
                いいえ
              </button>
              <button className="btn-secondary" onClick={() => setSelfSolveConfirm(null)} style={{ minWidth: '80px' }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {showSizeDialog && (
        <SizeDialog
          currentWidth={puzzle.width}
          currentHeight={puzzle.height}
          onClose={() => setShowSizeDialog(false)}
          onApply={handleNewBoard}
        />
      )}
      {showTagDialog && (
        <TagDialog
          onClose={() => setShowTagDialog(false)}
          onAdd={(tag) => {
            addTag(tag);
            setShowTagDialog(false);
          }}
        />
      )}
      {showHelpDialog && <HelpDialog onClose={() => setShowHelpDialog(false)} />}
      {showWelcomeDialog && (
        <WelcomeDialog
          onAccept={() => {
            localStorage.setItem('zigzag_welcome_agreed', 'true');
            setShowWelcomeDialog(false);
          }}
        />
      )}
      {/* スマホ用設定メニュー */}
      {showMobileSettingsMenu && (
        <div className="modal-overlay" onClick={() => setShowMobileSettingsMenu(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '80%', padding: '20px' }}>
            <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>設定メニュー</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="btn-primary"
                style={{ padding: '16px', fontSize: '1rem' }}
                onClick={() => {
                  setShowMobileSettingsMenu(false);
                  setShowSizeDialog(true);
                }}
              >
                サイズ変更
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '16px', fontSize: '1rem' }}
                onClick={() => {
                  setShowMobileSettingsMenu(false);
                  setShowSettingsDialog(true);
                }}
              >
                詳細設定
              </button>
              <button
                className="btn-secondary"
                style={{ marginTop: '10px', padding: '12px', border: 'none', color: 'var(--text-muted)' }}
                onClick={() => setShowMobileSettingsMenu(false)}
              >
                キャンセル
              </button>
            </div>
            <div style={{ 
              marginTop: '20px', 
              fontSize: '0.8rem', 
              color: 'var(--text-muted)', 
              textAlign: 'center',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px'
            }}>
              Version {APP_VERSION}
            </div>
          </div>
        </div>
      )}

      {importResult && (
        <ImportPreviewDialog
          importResult={importResult}
          currentPuzzle={puzzle}
          onClose={() => setImportResult(null)}
          onImport={handleImportConfirm}
        />
      )}

      <input
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </Layout>
  )
}

export default App
