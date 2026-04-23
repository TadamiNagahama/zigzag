import { useCallback, useEffect } from 'react';
import { type PuzzleData, type Cell } from '../models/types';
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
    cells,
    wordList: {},
    isWList: false,
    isWListStar: false,
    wordList2: [''],
    shadingColor: '#e2e8f0', // デフォルトは薄いグレー (slate-200相当)
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
  currentWordStarList?: Record<number, boolean>
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
        newCell.char = word.charAt(0); // 頭文字も維持
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
      // 単語がない場合でも既存の文字 (newCell.char) は消さない
    }
    return newCell;
  }));

  return { cells: newCells, wordList: newWordList, wordDirections: newWordDirections, wordStarList: newWordStarList };
};

const recomputeNumbersWithDirections = (cells: Cell[][], currentWordList: Record<number, string>, currentWordDirections?: Record<number, string>, currentWordStarList?: Record<number, boolean>) => {
  return recomputeNumbers(cells, currentWordList, currentWordDirections, currentWordStarList);
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
  } = useUndoRedo<PuzzleData>(createEmptyPuzzle(initialWidth, initialHeight));

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
      const { cells: finalCells, wordList: finalWordList, wordDirections: finalWordDirections, wordStarList: finalWordStarList } = recomputeNumbersWithDirections(newCells, prev.wordList, prev.wordDirections, prev.wordStarList);
      return { 
        ...prev, 
        width: w, 
        height: h, 
        cells: finalCells, 
        wordList: finalWordList,
        wordDirections: finalWordDirections,
        wordStarList: finalWordStarList,
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
      return { ...prev, ...recomputeNumbersWithDirections(newCells, prev.wordList, prev.wordDirections, prev.wordStarList), updatedAt: Date.now() };
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
      return { ...prev, ...recomputeNumbersWithDirections(newCells, prev.wordList, prev.wordDirections, prev.wordStarList), updatedAt: Date.now() };
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
          return { ...cell, char: isStar ? '' : word.charAt(0) }; 
        }
        return { ...cell };
      }));
      return { ...prev, wordList: newWordList, cells: newCells, updatedAt: Date.now() };
    });
  }, [setPuzzle, takeCheckpoint]);

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

  const createNewBoard = useCallback(() => {
    push(() => createEmptyPuzzle(initialWidth, initialHeight));
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
      return { ...prev, cells: newCells, updatedAt: Date.now() };
    });
  }, [push]);

  const updateCellAnswerChar = useCallback((x: number, y: number, char: string) => {
    push(prev => {
      const newCells = prev.cells.map(row => row.map(cell => ({ ...cell })));
      newCells[y][x].answerChar = char;
      return { ...prev, cells: newCells, updatedAt: Date.now() };
    });
  }, [push]);

  const setShadingColor = useCallback((shadingColor: string) => {
    push(prev => ({ ...prev, shadingColor, updatedAt: Date.now() }));
  }, [push]);

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
      
      return { ...prev, ...recomputeNumbersWithDirections(newCells, prev.wordList, prev.wordDirections, prev.wordStarList), updatedAt: Date.now() };
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
      
      return { ...prev, ...recomputeNumbersWithDirections(newCells, prev.wordList, prev.wordDirections, prev.wordStarList), updatedAt: Date.now() };
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
    mergeCells,
    splitCell,
    takeCheckpoint,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetInternal,
    createNewBoard
  };
};
