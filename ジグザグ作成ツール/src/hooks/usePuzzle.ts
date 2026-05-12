import { useCallback, useEffect } from 'react';
import { type PuzzleData, type Cell, type PuzzleType } from '../models/types';
import { db } from '../models/db';
import { useUndoRedo } from './useUndoRedo';

const createEmptyPuzzle = (w: number, h: number): PuzzleData => {
  const cells: Cell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < w; x++) {
      row.push({
        x, y, type: 'normal', char: '', answerChar: '', isNumbered: false, number: null, answerKey: null, isShaded: false, style: {}
      });
    }
    cells.push(row);
  }
  return {
    title: '無題のパズル',
    width: w,
    height: h,
    patternType: 1,
    puzzleType: 'ノーマル',
    cells,
    wordList: {},
    isWList: false,
    isWListStar: false,
    wordList2: [''],
    shadingColor: '#e2e8f0', // デフォルトは薄いグレー (slate-200相当)
    boardFontWeight: 'normal',
    boardFontFamily: '',
    updatedAt: Date.now()
  };
};

/**
 * 盤面の左上から右下へ走査し、番号を再割り当てする
 */
const recomputeNumbers = (
  cells: Cell[][],
  currentWordList: Record<number, string>,
  currentWordDirections?: Record<number, string>,
  currentWordStarList?: Record<number, boolean>,
  puzzleType?: PuzzleType,
  publicNumbers?: Record<number, boolean>
) => {
  // 1. 座標ごとの単語マップを作成 (現在の番号 -> 座標 -> 単語)
  const coordsToWord: Record<string, string> = {};
  const coordsToDirection: Record<string, string> = {};
  const coordsToStar: Record<string, boolean> = {};

  cells.forEach(row => row.forEach(cell => {
    if (cell.number !== null) {
      if (currentWordList[cell.number]) {
        coordsToWord[`${cell.x},${cell.y}`] = currentWordList[cell.number];
      }
      if (currentWordDirections && currentWordDirections[cell.number]) {
        coordsToDirection[`${cell.x},${cell.y}`] = currentWordDirections[cell.number];
      }
      if (currentWordStarList && currentWordStarList[cell.number]) {
        coordsToStar[`${cell.x},${cell.y}`] = true;
      }
    }
  }));

  let count = 1;
  const newWordList: Record<number, string> = {};
  const newWordDirections: Record<number, string> = {};
  const newWordStarList: Record<number, boolean> = {};

  const newCells = cells.map(row => row.map(cell => {
    const newCell: Cell = { ...cell, number: null };
    // 番号を振る条件: 通常マスかつ、番号フラグが立っており、かつ結合されている場合は親マスであること
    if (newCell.type === 'normal' && newCell.isNumbered && !newCell.mergedParent) {
      const num = count++;
      newCell.number = num;

      // 2. 元の座標に単語があれば新しい番号に引き継ぐ
      const word = coordsToWord[`${cell.x},${cell.y}`];
      if (word) {
        newWordList[num] = word;
        if (puzzleType === 'ナンバーレス') {
          // ナンバーレスモードに切り替えた際、自動表示されていた頭文字を消去する
          if (newCell.char === word.charAt(0)) {
            newCell.char = '';
          }
        } else if (puzzleType === '部分ナンバーレス') {
          // 部分ナンバーレス: 公開（◎）の場合のみ1文字目を表示
          if (publicNumbers?.[num]) {
            newCell.char = word.charAt(0);
          } else {
            // 非公開時は頭文字を自動で入れない（手動入力されたヒント文字は維持する）
            if (newCell.char === word.charAt(0)) {
              newCell.char = '';
            }
          }
        } else {
          // ナンバーレス以外では頭文字を自動で表示
          newCell.char = word.charAt(0);
        }
      }
      const dir = coordsToDirection[`${cell.x},${cell.y}`];
      if (dir) {
        newWordDirections[num] = dir;
      }
      const isStar = coordsToStar[`${cell.x},${cell.y}`];
      if (isStar) {
        newWordStarList[num] = true;
        newCell.char = ''; // スター項目は盤面文字を消去
      }
    }
    return newCell;
  }));

  const numbers = Array.from({ length: count - 1 }, (_, i) => i + 1);
  return { cells: newCells, wordList: newWordList, wordDirections: newWordDirections, wordStarList: newWordStarList, numbers };
};



const getInitialPuzzle = (w: number, h: number): PuzzleData => {
  const savedData = localStorage.getItem('zigzag_autosave_data');
  if (savedData) {
    try {
      return JSON.parse(savedData);
    } catch (e) {
      console.error('Failed to parse autosave data:', e);
    }
  }
  return createEmptyPuzzle(w, h);
};

export const usePuzzle = (initialHeight = 17, initialWidth = 17) => {
  const {
    state: puzzle,
    setState: setPuzzle,
    push,
    reset: resetInternal,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoRedo<PuzzleData>(getInitialPuzzle(initialWidth, initialHeight));
  
  const syncOrder = useCallback((oldOrder: number[] | undefined, newNumbers: number[]): number[] => {
    const newSet = new Set(newNumbers);
    const order = (oldOrder || []).filter(n => newSet.has(n));
    const orderSet = new Set(order);
    newNumbers.forEach(n => {
      if (!orderSet.has(n)) order.push(n);
    });
    return order;
  }, []);

  const setWordListOrderMode = useCallback((mode: 'numerical' | 'alphabetical') => {
    push(prev => {
      let customAlphabeticalOrder = prev.customAlphabeticalOrder;
      if (mode === 'alphabetical' && !customAlphabeticalOrder) {
        // 初期化
        const boardNumbers = new Set<number>();
        prev.cells.forEach(row => row.forEach(cell => {
          if (cell.number) boardNumbers.add(cell.number);
        }));
        const numbers = Array.from(boardNumbers);
        
        if (prev.puzzleType === '部分ナンバーレス') {
          // 部分ナンバーレス: 公開(数字順) + 非公開(あいうえお順)
          const publicNums = numbers.filter(n => prev.publicNumbers?.[n]).sort((a, b) => a - b);
          const privateNums = numbers.filter(n => !prev.publicNumbers?.[n]).sort((a, b) => {
            const wordA = prev.wordList[a] || '';
            const wordB = prev.wordList[b] || '';
            return wordA.localeCompare(wordB, 'ja');
          });
          customAlphabeticalOrder = [...publicNums, ...privateNums];
        } else {
          // 通常: 漢字コード順(あいうえお順)
          customAlphabeticalOrder = numbers.sort((a, b) => {
            const wordA = prev.wordList[a] || '';
            const wordB = prev.wordList[b] || '';
            return wordA.localeCompare(wordB, 'ja');
          });
        }
      }
      return { ...prev, wordListOrderMode: mode, customAlphabeticalOrder, updatedAt: Date.now() };
    });
  }, [push]);

  // 数字の表示/非表示トグル（ウルトラモード用）
  const toggleNumbersHidden = useCallback(() => {
    push(prev => ({
      ...prev,
      isNumbersHidden: !prev.isNumbersHidden,
      updatedAt: Date.now()
    }));
  }, [push]);

  // 変則数字表示トグル（変則モード用）
  const toggleIrregularNumbersDisplay = useCallback(() => {
    push(prev => ({
      ...prev,
      isIrregularNumbersDisplay: !prev.isIrregularNumbersDisplay,
      updatedAt: Date.now()
    }));
  }, [push]);

  // 盤面サイズの変更
  const resizeBoard = useCallback((h: number, w: number) => {
    push(prev => {
      const newCells: Cell[][] = [];
      for (let y = 0; y < h; y++) {
        const row: Cell[] = [];
        for (let x = 0; x < w; x++) {
          if (prev.cells[y] && prev.cells[y][x]) {
            const cell = prev.cells[y][x];
            let shouldResetMerged = false;

            // 大マス（結合）の状態を維持できるか判定
            if (cell.mergedSize) {
              const { width: mw, height: mh } = cell.mergedSize;
              if (x + mw > w || y + mh > h) {
                shouldResetMerged = true;
              }
            } else if (cell.mergedParent) {
              const { x: px, y: py } = cell.mergedParent;
              if (px >= w || py >= h) {
                shouldResetMerged = true;
              } else {
                const parentCell = prev.cells[py][px];
                if (parentCell.mergedSize) {
                  const { width: mw, height: mh } = parentCell.mergedSize;
                  if (px + mw > w || py + mh > h) {
                    shouldResetMerged = true;
                  }
                } else {
                  shouldResetMerged = true;
                }
              }
            }

            row.push({
              ...cell,
              x, y,
              mergedParent: shouldResetMerged ? undefined : cell.mergedParent,
              mergedSize: shouldResetMerged ? undefined : cell.mergedSize,
              isShaded: cell.isShaded ?? false,
              answerChar: cell.answerChar ?? ''
            });
          } else {
            row.push({
              x, y, type: 'normal', char: '', answerChar: '', isNumbered: false, number: null, answerKey: null, isShaded: false, style: {}
            });
          }
        }
        newCells.push(row);
      }
      const result = recomputeNumbers(newCells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, prev.publicNumbers);
      return {
        ...prev,
        width: w,
        height: h,
        ...result,
        customAlphabeticalOrder: syncOrder(prev.customAlphabeticalOrder, result.numbers),
        updatedAt: Date.now()
      };
    });
  }, [push]);

  const toggleCellType = useCallback((x: number, y: number) => {
    push(prev => {
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));
      const cell = newCells[y][x];
      cell.type = cell.type === 'normal' ? 'wall' : 'normal';
      if (cell.type === 'wall') {
        cell.isNumbered = false;
        cell.char = '';
        cell.answerChar = '';
        cell.answerKey = null;
      }
      const result = recomputeNumbers(newCells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, prev.publicNumbers);
      return { 
        ...prev, 
        ...result, 
        customAlphabeticalOrder: syncOrder(prev.customAlphabeticalOrder, result.numbers),
        updatedAt: Date.now() 
      };
    });
  }, [push]);

  const toggleNumberFlag = useCallback((x: number, y: number) => {
    push(prev => {
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));
      const cell = newCells[y][x];
      if (cell.type === 'wall' || cell.mergedParent) return prev;

      cell.isNumbered = !cell.isNumbered;
      if (!cell.isNumbered) {
        cell.char = '';
      }
      const result = recomputeNumbers(newCells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, prev.publicNumbers);
      return { 
        ...prev, 
        ...result, 
        customAlphabeticalOrder: syncOrder(prev.customAlphabeticalOrder, result.numbers),
        updatedAt: Date.now() 
      };
    });
  }, [push]);

  const takeCheckpoint = useCallback(() => {
    // 現在の状態を履歴として確定させる
    push(prev => ({ ...prev, updatedAt: Date.now() }));
  }, [push]);

  const setBoardTitle = useCallback((boardTitle: string) => {
    setPuzzle(prev => ({ ...prev, boardTitle, updatedAt: Date.now() }));
  }, [setPuzzle]);

  const updateWordList = useCallback((number: number, word: string, shouldCheckpoint: boolean = false) => {
    if (shouldCheckpoint) {
      takeCheckpoint();
    }
    // 単語入力は1文字単位で履歴を残さないよう setPuzzle (setState) を使用
    setPuzzle(prev => {
      const newWordList = { ...prev.wordList, [number]: word };
      const isStar = prev.wordStarList?.[number];
      const newCells = prev.cells.map(row => row.map(cell => {
        if (cell.number === number) {
          // 公開設定に応じた頭文字の自動表示判定
          let char = '';
          if (prev.puzzleType === '部分ナンバーレス') {
            if (prev.publicNumbers?.[number]) char = word.charAt(0);
          } else if (prev.puzzleType !== 'ナンバーレス' && !isStar) {
            char = word.charAt(0);
          }
          return { ...cell, char };
        }
        return { ...cell };
      }));
      return { ...prev, wordList: newWordList, cells: newCells, updatedAt: Date.now() };
    });
  }, [setPuzzle, takeCheckpoint]);

  const togglePublicNumber = useCallback((number: number) => {
    push(prev => {
      const newPublicNumbers = { ...prev.publicNumbers };
      newPublicNumbers[number] = !newPublicNumbers[number];

      // 盤面の文字を更新
      const result = recomputeNumbers(prev.cells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, newPublicNumbers);
      return { ...prev, ...result, publicNumbers: newPublicNumbers, updatedAt: Date.now() };
    });
  }, [push]);

  const toggleWordStar = useCallback((number: number) => {
    push(prev => {
      const newWordStarList = { ...prev.wordStarList };
      const newVal = !newWordStarList[number];
      newWordStarList[number] = newVal;

      const newWordList = { ...prev.wordList };
      if (newVal) {
        delete newWordList[number];
      }

      const newCells = prev.cells.map(row => row.map(cell => {
        if (cell.number === number) {
          return { ...cell, char: '' };
        }
        return { ...cell };
      }));

      return { ...prev, wordStarList: newWordStarList, wordList: newWordList, cells: newCells, updatedAt: Date.now() };
    });
  }, [push]);

  const updateWordDirection = useCallback((number: number, direction: string) => {
    setPuzzle(prev => {
      const newWordDirections = { ...prev.wordDirections, [number]: direction };
      return { ...prev, wordDirections: newWordDirections, updatedAt: Date.now() };
    });
  }, [setPuzzle]);

  const setIsArrowMode = useCallback((isArrowMode: boolean) => {
    push(prev => ({ ...prev, isArrowMode, updatedAt: Date.now() }));
  }, [push]);

  const setPuzzleType = useCallback((puzzleType: PuzzleType) => {
    push(prev => {
      const result = recomputeNumbers(prev.cells, prev.wordList, prev.wordDirections, prev.wordStarList, puzzleType, prev.publicNumbers);
      const isWListRelated = puzzleType === 'Wリスト' || puzzleType === 'Wリスト★';
      
      return {
        ...prev,
        ...result,
        puzzleType,
        isWList: puzzleType === 'Wリスト',
        isWListStar: puzzleType === 'Wリスト★',
        isArrowMode: puzzleType === '矢印',
        isRemainingAnswer: isWListRelated ? prev.isRemainingAnswer : false,
        remainingAnswerWord: isWListRelated ? prev.remainingAnswerWord : '',
        customAlphabeticalOrder: syncOrder(prev.customAlphabeticalOrder, result.numbers),
        updatedAt: Date.now()
      };
    });
  }, [push]);

  const setIsWList = useCallback((isWList: boolean) => {
    push(prev => ({ ...prev, isWList, updatedAt: Date.now() }));
  }, [push]);

  const setIsWListStar = useCallback((isWListStar: boolean) => {
    push(prev => ({ ...prev, isWListStar, updatedAt: Date.now() }));
  }, [push]);

  const setIsRemainingAnswer = useCallback((isRemainingAnswer: boolean) => {
    push(prev => ({ ...prev, isRemainingAnswer, updatedAt: Date.now() }));
  }, [push]);

  const setRemainingAnswerWord = useCallback((remainingAnswerWord: string) => {
    setPuzzle(prev => ({ ...prev, remainingAnswerWord, updatedAt: Date.now() }));
  }, [setPuzzle]);

  const updateWordList2 = useCallback((index: number, word: string) => {
    // 履歴に残さず更新
    setPuzzle(prev => {
      const newWordList2 = [...(prev.wordList2 || [''])];
      newWordList2[index] = word;
      return { ...prev, wordList2: newWordList2, updatedAt: Date.now() };
    });
  }, [setPuzzle]);

  const addWordList2Entry = useCallback(() => {
    push(prev => {
      const newWordList2 = [...(prev.wordList2 || ['']), ''];
      return { ...prev, wordList2: newWordList2, updatedAt: Date.now() };
    });
  }, [push]);

  const createNewBoard = useCallback((h?: number, w?: number) => {
    push(() => createEmptyPuzzle(w || initialWidth, h || initialHeight));
  }, [push, initialWidth, initialHeight]);

  const setAnswerKey = useCallback((x: number, y: number, key: string | null) => {
    push(prev => {
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));
      newCells[y][x].answerKey = key;
      return { ...prev, cells: newCells, updatedAt: Date.now() };
    });
  }, [push]);

  const toggleShaded = useCallback((x: number, y: number, forcedValue?: boolean) => {
    push(prev => {
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));
      const cell = newCells[y][x];
      cell.isShaded = forcedValue !== undefined ? forcedValue : !cell.isShaded;
      return { ...prev, cells: newCells, updatedAt: Date.now() };
    });
  }, [push]);

  const updateCellChar = useCallback((x: number, y: number, char: string) => {
    push(prev => {
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));
      newCells[y][x].char = char;
      return { ...prev, ...recomputeNumbers(newCells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, prev.publicNumbers), updatedAt: Date.now() };
    });
  }, [push]);

  const updateCellAnswerChar = useCallback((x: number, y: number, char: string) => {
    push(prev => {
      const cell = prev.cells[y][x];
      // 結合されている場合は親マスの座標に書き込む
      const targetX = cell.mergedParent ? cell.mergedParent.x : x;
      const targetY = cell.mergedParent ? cell.mergedParent.y : y;

      const newCells = prev.cells.map(row => row.map(c => ({ ...c })));
      newCells[targetY][targetX].answerChar = char;
      return { ...prev, cells: newCells, updatedAt: Date.now() };
    });
  }, [push]);

  const toggleAnswerColumnSpace = useCallback((char: string) => {
    push(prev => {
      const currentSpaces = prev.answerColumnSpaces || [];
      const newSpaces = currentSpaces.includes(char)
        ? currentSpaces.filter(c => c !== char)
        : [...currentSpaces, char];
      return { ...prev, answerColumnSpaces: newSpaces, updatedAt: Date.now() };
    });
  }, [push]);

  const setShadingColor = useCallback((shadingColor: string) => {
    push(prev => ({ ...prev, shadingColor, updatedAt: Date.now() }));
  }, [push]);

  const setBoardFontWeight = useCallback((boardFontWeight: 'normal' | 'bold') => {
    push(prev => ({ ...prev, boardFontWeight, updatedAt: Date.now() }));
  }, [push]);

  const setBoardFontFamily = useCallback((boardFontFamily: string) => {
    push(prev => ({ ...prev, boardFontFamily, updatedAt: Date.now() }));
  }, [push]);

  const addTag = useCallback((tag: string) => {
    setPuzzle(prev => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(tag)) return prev;
      return { ...prev, tags: [...currentTags, tag], updatedAt: Date.now() };
    });
  }, [setPuzzle]);

  const removeTag = useCallback((tag: string) => {
    setPuzzle(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(t => t !== tag),
      updatedAt: Date.now()
    }));
  }, [setPuzzle]);

  const mergeCells = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    push(prev => {
      const startX = Math.min(x1, x2);
      const endX = Math.max(x1, x2);
      const startY = Math.min(y1, y2);
      const endY = Math.max(y1, y2);

      const width = endX - startX + 1;
      const height = endY - startY + 1;

      if (width === 1 && height === 1) return prev;

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const cell = prev.cells[y][x];
          if (cell.mergedParent || cell.mergedSize) {
            console.log('Merge rejected: overlapping with existing large cell');
            return prev;
          }
        }
      }

      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (x === startX && y === startY) {
            newCells[y][x].mergedSize = { width, height };
            newCells[y][x].mergedParent = undefined;
          } else {
            newCells[y][x].mergedParent = { x: startX, y: startY };
            newCells[y][x].mergedSize = undefined;
            newCells[y][x].isNumbered = false;
            newCells[y][x].char = '';
            newCells[y][x].answerChar = '';
            newCells[y][x].answerKey = null;
          }
        }
      }

      const result = recomputeNumbers(newCells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, prev.publicNumbers);
      return { 
        ...prev, 
        ...result, 
        customAlphabeticalOrder: syncOrder(prev.customAlphabeticalOrder, result.numbers),
        updatedAt: Date.now() 
      };
    });
  }, [push]);

  const splitCell = useCallback((x: number, y: number) => {
    push(prev => {
      const cell = prev.cells[y][x];
      const parentX = cell.mergedParent ? cell.mergedParent.x : x;
      const parentY = cell.mergedParent ? cell.mergedParent.y : y;
      const parentCell = prev.cells[parentY][parentX];

      if (!parentCell.mergedSize) return prev;

      const { width, height } = parentCell.mergedSize;
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));

      for (let j = parentY; j < parentY + height; j++) {
        for (let i = parentX; i < parentX + width; i++) {
          newCells[j][i].mergedParent = undefined;
          newCells[j][i].mergedSize = undefined;
        }
      }

      const result = recomputeNumbers(newCells, prev.wordList, prev.wordDirections, prev.wordStarList, prev.puzzleType, prev.publicNumbers);
      return { 
        ...prev, 
        ...result, 
        customAlphabeticalOrder: syncOrder(prev.customAlphabeticalOrder, result.numbers),
        updatedAt: Date.now() 
      };
    });
  }, [push]);

  // 自動保存
  useEffect(() => {
    const saveToDB = async () => {
      try {
        await db.puzzles.put(puzzle);
      } catch (e) {
        console.error('Failed to save puzzle:', e);
      }
    };
    const timer = setTimeout(saveToDB, 1000);
    return () => clearTimeout(timer);
  }, [puzzle]);

  const reorderWordList = useCallback((startIndex: number, endIndex: number) => {
    push(prev => {
      const boardNumbers = new Set<number>();
      prev.cells.forEach(row => row.forEach(cell => {
        if (cell.number) boardNumbers.add(cell.number);
      }));
      const numbers = Array.from(boardNumbers).sort((a, b) => a - b);
      
      // 現在の表示順序を再現
      let currentRenderedOrder: number[];
      if (prev.puzzleType === '部分ナンバーレス' && prev.wordListOrderMode === 'alphabetical') {
        const publicNums = numbers.filter(n => prev.publicNumbers?.[n]).sort((a, b) => a - b);
        const privateNums = (prev.customAlphabeticalOrder || numbers).filter(n => !prev.publicNumbers?.[n]);
        currentRenderedOrder = [...publicNums, ...privateNums];
      } else {
        currentRenderedOrder = prev.customAlphabeticalOrder || numbers;
      }

      const newOrder = Array.from(currentRenderedOrder);
      const [removed] = newOrder.splice(startIndex, 1);
      newOrder.splice(endIndex, 0, removed);
      
      return { ...prev, customAlphabeticalOrder: newOrder, updatedAt: Date.now() };
    });
  }, [push]);

  const reorderWordList2 = useCallback((startIndex: number, endIndex: number) => {
    push(prev => {
      const newList2 = Array.from(prev.wordList2 || []);
      const [removed] = newList2.splice(startIndex, 1);
      newList2.splice(endIndex, 0, removed);
      return { ...prev, wordList2: newList2, updatedAt: Date.now() };
    });
  }, [push]);

  return {
    puzzle,
    setPuzzle,
    resizeBoard,
    toggleCellType,
    toggleNumberFlag,
    setBoardTitle,
    updateWordList,
    toggleWordStar,
    updateWordDirection,
    setIsArrowMode,
    setPuzzleType,
    setIsWList,
    setIsWListStar,
    setIsRemainingAnswer,
    setRemainingAnswerWord,
    updateWordList2,
    addWordList2Entry,
    setAnswerKey,
    toggleShaded,
    updateCellChar,
    updateCellAnswerChar,
    setShadingColor,
    setBoardFontWeight,
    setBoardFontFamily,
    addTag,
    removeTag,
    mergeCells,
    splitCell,
    reorderWordList,
    reorderWordList2,
    setWordListOrderMode,
    takeCheckpoint,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetInternal,
    createNewBoard,
    togglePublicNumber,
    toggleNumbersHidden,
    toggleIrregularNumbersDisplay,
    toggleAnswerColumnSpace,
  };
};
