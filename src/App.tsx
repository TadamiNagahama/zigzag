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
import { auth, dbFirestore, googleProvider } from './models/firebase'
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { type PuzzleData, type PrintOptions } from './models/types'
import { Settings, ZoomIn, ZoomOut, Maximize, Plus, Printer, Grid3X3 } from 'lucide-react'
import './App.css'
type AppMode = 'shade' | 'edit' | 'answer';
type EditMode = 'number' | 'wall';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function App() {
  const {
    puzzle,
    setPuzzle,
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
    addTag,
    removeTag,
    mergeCells,
    splitCell,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    createNewBoard
  } = usePuzzle(17, 17);

  const [editMode, setEditMode] = useState<EditMode>('number');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, cellX: number, cellY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
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
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [exportSettings, setExportSettings] = useState<Partial<ExportOptions>>({});
  const [confirmAction, setConfirmAction] = useState<{ message: string | React.ReactNode, onConfirm: () => void, isDestructive?: boolean } | null>(null);

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
      await exportToExcel(puzzle, options);
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
    setConfirmAction({
      message: `「${p.title}」を読み込みますか？\n現在の編集内容は破棄されます。`,
      isDestructive: true,
      onConfirm: () => {
        const normalized = normalizePuzzle(p);
        reset(normalized);
        fitToScreen();
        setShowLoadDialog(false);
        setConfirmAction(null);
      }
    });
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
    setConfirmAction({
      message: '現在の内容を破棄して新規作成しますか？',
      isDestructive: true,
      onConfirm: () => {
        setConfirmAction(null);
        setShowSizeDialog(true);
      }
    });
  }

  const handleNewBoard = (h: number, w: number) => {
    // usePuzzleにcreateNewBoardを追加したはずだが、もしなければresizeBoardで代用
    // ただしrevertedApp.tsxではcreateNewBoardがdestructuredに含まれていない可能性がある
    // 前のターンのusePuzzle.tsにはcreateNewBoardがあることを確認済み
    // なので App() の destructure に追加する必要がある
    createNewBoard(h, w);
    setShowSizeDialog(false);
    fitToScreen();
  }

  const handleCellClick = (x: number, y: number) => {
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
        toggleNumberFlag(x, y);
      }
    }
    setContextMenu(null);
  }

  const handleCellRightClick = (x: number, y: number, event: React.MouseEvent) => {
    setContextMenu({ x: event.clientX, y: event.clientY, cellX: x, cellY: y });
  }

  const handleDragSelection = (x1: number, y1: number, x2: number, y2: number) => {
    if (appMode === 'answer') return;

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

    if (appMode === 'edit') {
      const first = path[0];
      const last = path[path.length - 1];
      mergeCells(first.x, first.y, last.x, last.y);
      return;
    }

    if (appMode === 'answer') {
      const startCell = puzzle.cells[path[0].y][path[0].x];

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

        for (let i = 0; i < path.length; i++) {
          const curr = path[i];
          if (i > 0) {
            const prev = path[i - 1];
            const dist = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
            currentCharIndex += dist;
          }

          if (currentCharIndex < word.length) {
            const cell = puzzle.cells[curr.y][curr.x];
            // 起点以外の数字マス（他の単語の1文字目）は上書きしない
            if (i > 0 && cell.number !== null) {
              continue;
            }
            updateCellAnswerChar(curr.x, curr.y, word[currentCharIndex]);
          } else {
            break;
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
    while (true) {
      nx++;
      if (nx >= puzzle.width) {
        nx = 0;
        ny++;
      }
      if (ny >= puzzle.height) break;
      if (!puzzle.cells[ny][nx].char && puzzle.cells[ny][nx].type === 'normal') {
        setFocusedCell({ x: nx, y: ny });
        return;
      }
    }
    setFocusedCell(null);
  }, [focusedCell, puzzle.width, puzzle.height, puzzle.cells]);

  useEffect(() => {
    if (appMode === 'answer' && focusedCell && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [appMode, focusedCell]);

  const handleHiddenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // IME入力中は何もしない
    if (appMode !== 'answer' || !focusedCell || isComposing) return;

    // 提示文字があるマスには入力させない
    if (puzzle.cells[focusedCell.y][focusedCell.x].char) return;

    const val = e.target.value;
    if (val) {
      // 解答文字（answerChar）を更新
      const char = val.slice(-1);
      updateCellAnswerChar(focusedCell.x, focusedCell.y, char);
      handleAdvanceFocus();
      // 入力値をクリア
      e.target.value = '';
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

    if (appMode !== 'answer' || !focusedCell) return;

    // 提示文字があるマスには入力させない
    if (puzzle.cells[focusedCell.y][focusedCell.x].char) return;

    // 確定された文字列を取得
    // e.data が確実だが、ブラウザ互換性のために input.value も考慮
    const val = e.data || (e.target as HTMLInputElement).value;

    if (val) {
      updateCellAnswerChar(focusedCell.x, focusedCell.y, val);
      handleAdvanceFocus();
    }

    // 次の入力（直後のonChangeなど）で二重処理されないよう、確実にバッファを空にする
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = '';
    }
  };

  const validateManuscript = () => {
    const errors: React.ReactNode[] = [];

    // 1. 盤面充填チェック
    let emptyCellCount = 0;
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        const cell = puzzle.cells[y][x];
        if (cell.type === 'normal' && !cell.char && !cell.answerChar) {
          emptyCellCount++;
        }
      }
    }
    if (emptyCellCount > 0) {
      errors.push(`盤面に未入力のマスがあります (${emptyCellCount}箇所)`);
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
      const hasPath = (w: string, x: number, y: number, visited: Set<string>): boolean => {
        if (w === '') return true;
        if (x < 0 || x >= puzzle.width || y < 0 || y >= puzzle.height) return false;

        const cell = puzzle.cells[y][x];
        const currentChar = cell.char || cell.answerChar;
        if (cell.type !== 'normal' || currentChar !== w[0]) return false;

        const key = `${x},${y}`;
        if (visited.has(key)) return false;

        const newVisited = new Set(visited);
        newVisited.add(key);
        const nextW = w.slice(1);
        if (nextW === '') return true;

        const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of neighbors) {
          if (hasPath(nextW, x + dx, y + dy, newVisited)) return true;
        }
        return false;
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

        if (!hasPath(word, startPos.x, startPos.y, new Set())) {
          errors.push(`番号 ${num} (「${word}」) の経路が正しく繋がっていません`);
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
            if (!shadedCells.has(`${x},${y}`)) return false;
            const cell = puzzle.cells[y][x];
            const currentChar = cell.char || cell.answerChar;
            if (currentChar !== w[0]) return false;

            const key = `${x},${y}`;
            if (visited.has(key)) return false;
            const newVisited = new Set(visited);
            newVisited.add(key);
            const nextW = w.slice(1);
            if (nextW === '') return true;

            const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of neighbors) {
              if (hasShadedPath(nextW, x + dx, y + dy, newVisited)) return true;
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

            starFindings[num] = targetWords.filter(word => hasPath(word, sx, sy, new Set()));
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
              if (hasPath(puzzle.remainingAnswerWord, sx, sy, new Set())) {
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
    if (appMode !== 'answer' || !focusedCell) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let { x, y } = focusedCell;
      if (e.key === 'ArrowUp' && y > 0) y--;
      if (e.key === 'ArrowDown' && y < puzzle.height - 1) y++;
      if (e.key === 'ArrowLeft' && x > 0) x--;
      if (e.key === 'ArrowRight' && x < puzzle.width - 1) x++;
      setFocusedCell({ x, y });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleAdvanceFocus();
    } else if (e.key === 'Backspace') {
      const cell = puzzle.cells[focusedCell.y][focusedCell.x];
      const current = cell.answerChar || '';
      if (current.length > 1) {
        updateCellAnswerChar(focusedCell.x, focusedCell.y, current.slice(0, -1));
      } else {
        updateCellAnswerChar(focusedCell.x, focusedCell.y, '');
      }
    } else if (e.key === 'Delete') {
      updateCellAnswerChar(focusedCell.x, focusedCell.y, '');
    }
  };

  const fitToScreen = () => {
    setTimeout(() => {
      const scrollArea = document.getElementById('board-scroll-area');
      const content = document.getElementById('board-content-wrapper');
      if (!scrollArea || !content) return;

      // 10x10, 13x13, 15x15 のサイズは現状で「ぴったり」のため、計算ロジックの極端な変更に注意
      // すでにmain-boardのpadding(20px/10px)で余白が確保されているため、ここでは引き算しない
      const availW = scrollArea.clientWidth;
      const availH = scrollArea.clientHeight;

      // contentのscrollWidth/Heightはズームに依存しない「自然な」サイズを返す
      const naturalW = content.scrollWidth;
      const naturalH = content.scrollHeight;

      if (naturalW > 0 && naturalH > 0) {
        const scaleW = availW / naturalW;
        const scaleH = availH / naturalH;
        const targetScale = Math.min(scaleW, scaleH);
        const newZoom = Math.min(3.0, Math.max(0.4, targetScale));
        setZoom(newZoom);
      }
    }, 300);
  };

  const handleResizeRequest = (newH: number, newW: number) => {
    let hasLoss = false;
    for (let y = 0; y < puzzle.height; y++) {
      for (let x = 0; x < puzzle.width; x++) {
        const cell = puzzle.cells[y][x];
        if (x >= newW || y >= newH) {
          if (cell.isNumbered || cell.answerKey || cell.mergedSize || cell.mergedParent) {
            hasLoss = true;
            break;
          }
        } else if (cell.mergedSize) {
          const { width: mw, height: mh } = cell.mergedSize;
          if (x + mw > newW || y + mh > newH) {
            hasLoss = true;
            break;
          }
        }
      }
      if (hasLoss) break;
    }

    if (hasLoss) {
      setPendingResize({ h: newH, w: newW });
    } else {
      resizeBoard(newH, newW);
      fitToScreen();
      setShowSettingsDialog(false);
    }
  };

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
      if (currChar.charCodeAt(0) === prevChar.charCodeAt(0) + 1) {
        currentGroup.push(currChar);
      } else {
        groups.push(currentGroup);
        currentGroup = [currChar];
      }
    }
    groups.push(currentGroup);
    return groups;
  }, [puzzle.cells]);

  const hasShadedCells = useMemo(() => {
    return puzzle.cells.some(row => row.some(cell => cell.isShaded));
  }, [puzzle.cells]);

  const answerChars = useMemo(() => {
    const map: Record<string, string> = {};
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.answerKey) {
        map[cell.answerKey] = cell.answerChar || '';
      }
    }));
    return map;
  }, [puzzle.cells]);



  return (
    <Layout
      onExport={handleExport}
      onNew={handleNew}
      onSave={handleSave}
      onLoad={handleLoad}
      onHelp={() => setShowHelpDialog(true)}
      undo={undo}
      redo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      user={user}
      onLogin={handleLogin}
      onLogout={handleLogout}
    >
      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
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
        <aside className="sidebar shadow">
          <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
            {/* 固定ヘッダー部分 */}
            <section style={{ padding: '16px 16px 0px 16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  className={appMode === 'shade' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setAppMode('shade')}
                  style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem' }}
                >
                  網掛け
                </button>
                <button
                  className={appMode === 'edit' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setAppMode('edit');
                    setFocusedCell(null);
                  }}
                  style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem' }}
                >
                  問題面
                </button>
                <button
                  className={appMode === 'answer' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setAppMode('answer');
                    setEditMode('number');
                  }}
                  style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem' }}
                >
                  解答面
                </button>
              </div>

              {/* ジャンル選択のドロップダウンのみ（ラベルなし） */}
              <div style={{ marginBottom: '16px' }}>
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
                  <option value="変則">変則</option>
                  <option value="矢印">矢印</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
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
                  <>
                    <button className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '6px 2px', lineHeight: '1.2' }}>自動<br />解答</button>
                    <button className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '6px 2px', lineHeight: '1.2' }} onClick={validateManuscript}>完成<br />チェック</button>
                  </>
                ) : (
                  <div style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '8px' }}>
                    {appMode === 'shade' ? '網掛けマスを選択してください' : '番号の起点を選択してください'}
                  </div>
                )}
              </div>

              <div style={{ padding: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary-color)' }}>単語リスト</h4>
                </div>

              </div>
            </section>

            <hr style={{ border: 'none', borderTop: '2px solid var(--border-color)', margin: '0', flexShrink: 0 }} />

            {/* スクロール可能な中央部分 */}
            <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.8rem' }}>
                <div className="word-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {numbers.map(num => (
                    <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ minWidth: '24px', fontWeight: 'bold', fontSize: '0.9rem' }}>{num}.</span>
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
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ minWidth: '24px' }}></span> {/* 幅合わせ用の空スペース */}
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
            <section style={{ padding: '8px 16px 16px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
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
          <section className="main-board glass" style={{
            flex: 1,
            padding: '10px 20px 0px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            minHeight: 0,
            position: 'relative',
            borderRadius: '6px'
          }}>
            <div id="board-scroll-area" style={{
              flex: 1,
              width: '100%',
              height: 0,
              minHeight: '100%',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div id="board-content-wrapper" style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
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
                  charMap={answerChars}
                  isRemainingAnswer={puzzle.isRemainingAnswer}
                  remainingAnswerWord={puzzle.remainingAnswerWord}
                  list2={puzzle.wordList2 || []}
                  onSelectRemaining={setRemainingAnswerWord}
                />
                <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Grid
                    cells={puzzle.cells}
                    onCellClick={handleCellClick}
                    onCellRightClick={handleCellRightClick}
                    onDragSelection={handleDragSelection}
                    onDragPath={handleDragPath}
                    cellSize={baseCellSize}
                    appMode={appMode}
                    focusedCell={focusedCell}
                    composingText={composingText}
                    isWList={puzzle.isWList}
                    isWListStar={puzzle.isWListStar}
                    shadingColor={puzzle.shadingColor}
                    wordList={puzzle.wordList}
                    boardFontWeight={puzzle.boardFontWeight || 'normal'}
                    boardFontFamily={puzzle.boardFontFamily || ''}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* タグバーの追加 */}
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
          onClose={() => setShowSettingsDialog(false)}
          onSetShadingColor={setShadingColor}
          onSetFontWeight={setBoardFontWeight}
          onSetFontFamily={setBoardFontFamily}
          version="0.0.1"
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
    </Layout>
  )
}

export default App
