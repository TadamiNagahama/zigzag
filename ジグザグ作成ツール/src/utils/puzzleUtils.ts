import { type PuzzleData } from '../models/types';

export const normalizePuzzle = (p: any): PuzzleData => {
  return {
    ...p,
    wordList: p.wordList || {},
    cells: p.cells || [],
    wordList2: p.wordList2 || [],
    tags: p.tags || [],
    updatedAt: p.updatedAt || Date.now()
  };
};

export const getAlphabetGroups = (puzzle: PuzzleData): string[][] => {
  const usedKeys = new Set<string>();
  puzzle.cells.forEach(row => row.forEach(cell => {
    if (cell.answerKey) usedKeys.add(cell.answerKey);
  }));
  const uniqueSorted = Array.from(usedKeys).sort();
  const groups: string[][] = [];
  if (uniqueSorted.length > 0) {
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
  }
  return groups;
};

export const getAnswerChars = (puzzle: PuzzleData): Record<string, string> => {
  const charMap: Record<string, string> = {};
  puzzle.cells.forEach(row => row.forEach(cell => {
    if (cell.answerKey && cell.answerChar) {
      charMap[cell.answerKey] = cell.answerChar;
    }
  }));
  return charMap;
};
