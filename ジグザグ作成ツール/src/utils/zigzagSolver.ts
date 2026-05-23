import { type Cell, type PuzzleData } from '../models/types';

/**
 * ジグザグパズルの自動解答ロジック
 * VBAマクロのアルゴリズム（論理確定フェーズ + 共有化フェーズ）を移植
 */

interface SolverNode {
  id: string;
  x: number;
  y: number;
  logiNumber: number | null;
  currentChar: string;
  isFixed: boolean;
  neighbors: string[];
  reservedBy: Set<number>;
  reservedChars: Set<string>;
  candidates: Set<string>; // 既存の候補管理

  // 超モード用
  numberCandidates?: Set<number>;
  hiddenCorrectNumber?: number | null;
}

interface SolverWord {
  text: string;
  length: number;
  logiNumber: number;
  isUsed: boolean;
  fixedNodeIDs: (string | null)[]; // 1-indexed
}

export interface SolveResult {
  success: boolean;
  message: string;
  solvedCells: Cell[][];
  isBacktracked?: boolean;
  isAlternativeFound?: boolean;
  isUnique?: boolean;
  remainingWord?: string;
}

export type SolverStepCallback = (cells: Cell[][]) => Promise<void>;
export type SolverLogCallback = (message: string) => void;

/**
 * 配列を指定された分割数 K 個の空でない部分集合に分割するすべての組み合わせを生成するジェネレータ
 */
function* getPartitions<T>(arr: T[], K: number): Generator<T[][]> {
  if (K === 1) {
    yield [arr];
    return;
  }
  if (arr.length === K) {
    yield arr.map(x => [x]);
    return;
  }
  if (arr.length < K) return;

  const first = arr[0];
  const rest = arr.slice(1);

  // Case 1: first が単独で新しいサブグループを形成する
  for (const part of getPartitions(rest, K - 1)) {
    yield [[first], ...part];
  }

  // Case 2: first が既存のサブグループのいずれかに追加される
  for (const part of getPartitions(rest, K)) {
    for (let i = 0; i < part.length; i++) {
      const newPart = part.map(s => [...s]);
      newPart[i].push(first);
      yield newPart;
    }
  }
}

/**
 * ジグザグ解答ロジック (非同期版)
 */
export async function solveZigzagAsync(
  puzzle: PuzzleData,
  onStep: SolverStepCallback,
  onLog?: SolverLogCallback,
  findAlternative: boolean = false,
  firstSolutionCells?: Cell[][],
  onConfirm?: (msg: string) => Promise<boolean>,
  checkCancelled?: () => boolean,
  onBacktrackStart?: () => void,
  onBacktrackEnd?: () => void,
  onProgress?: (count: number) => void
): Promise<SolveResult> {
  const log = (msg: string) => {
    if (onLog) onLog(msg);
    console.log(`[Solver] ${msg}`);
  };

  let progressCount = 0;
  let lastProgressTime = 0;
  const incrementProgress = () => {
    progressCount++;
    const now = Date.now();
    if (now - lastProgressTime > 50) {
      if (onProgress) {
        onProgress(progressCount);
      }
      lastProgressTime = now;
    }
  };

  let yieldCounter = 0;
  const checkYield = async () => {
    yieldCounter++;
    if (yieldCounter % 200 === 0) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      incrementProgress();
      await new Promise(r => setTimeout(r, 0));
    }
  };

  const { width, height, cells, wordList } = puzzle;
  const nodeMap: Map<string, SolverNode> = new Map();
  const solverWords: SolverWord[] = [];

  const isChoMode = !puzzle.isWList && !puzzle.isWListStar && puzzle.cells.some(row => row.some(c => c.isShaded));
  if (isChoMode) {
    log("超モードを検出しました。網掛けの下の数字を隠蔽して推論を開始します。");
  }

  const isIrregularMode = puzzle.puzzleType === '変則';

  // 変則モード用の共有マス計算ロジック（解法で必要になるため）
  const getIrregularSharedCells = (): Record<string, number[]> => {
    if (!isIrregularMode) return {};
    const sharedCellsMap: Record<string, number[]> = {};
    const usedNumbers = new Set<number>();
    
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.number !== null) usedNumbers.add(cell.number);
    }));

    const findAllPaths = (word: string, x: number, y: number, visited: Set<string>, currentPath: { x: number, y: number }[]): { x: number, y: number }[][] => {
      if (x < 0 || x >= width || y < 0 || y >= height) return [];
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
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
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

    for (const num of Array.from(usedNumbers).sort((a, b) => a - b)) {
      const word = puzzle.wordList[num];
      if (!word || word.trim() === '') continue;
      let startPos: { x: number, y: number } | null = null;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (puzzle.cells[y][x].number === num) {
            startPos = { x, y };
            break;
          }
        }
        if (startPos) break;
      }
      if (!startPos) continue;
      const paths = findAllPaths(word, startPos.x, startPos.y, new Set(), []);
      if (paths.length === 1) {
        paths[0].forEach(pCoord => {
          const k = `${pCoord.x},${pCoord.y}`;
          if (!sharedCellsMap[k]) sharedCellsMap[k] = [];
          if (!sharedCellsMap[k].includes(num)) sharedCellsMap[k].push(num);
        });
      }
    }

    const finalSharedCells: Record<string, number[]> = {};
    Object.entries(sharedCellsMap).forEach(([k, nums]) => {
      if (nums.length >= 2) {
        finalSharedCells[k] = nums.sort((a, b) => a - b);
      }
    });
    return finalSharedCells;
  };

  const sharedCells = getIrregularSharedCells();

  // 現在の状態をコピーして保持
  // 超モード（網掛け）かつ未開示の場合、原稿の数字と文字を消去してカンニングを防止する
  // 変則モードの場合、開始数字（1文字目の数字）は最初はすべて非公開にする
  const currentCells = cells.map(row => row.map(c => {
    if (isChoMode && c.isShaded && !c.isRevealed) {
      return { ...c, number: null, char: '' };
    }
    if (isIrregularMode) {
      return { ...c, number: null, char: '' };
    }
    return { ...c };
  }));

  const syncWordFixedNodes = () => {
    for (const w of solverWords) {
      const startNodeId = w.fixedNodeIDs[1];
      if (startNodeId) {
        const node = nodeMap.get(startNodeId);
        if (node && node.logiNumber === null) {
          node.logiNumber = w.logiNumber;
          log(`[数字確定] ${w.logiNumber}番の開始位置が ${getExcelCoords(node)} に特定されました`);
          // 1文字目は確定文字として扱う
          if (!node.isFixed) {
            node.currentChar = w.text[0];
            node.isFixed = true;
          }
        }
      }
      // 2文字目以降も、もし固定ノードIDがあれば文字を同期
      for (let i = 1; i <= w.length; i++) {
        const nid = w.fixedNodeIDs[i];
        if (nid) {
          const node = nodeMap.get(nid);
          if (node && !node.isFixed) {
            node.currentChar = w.text[i - 1];
            node.isFixed = true;
          }
        }
      }
    }
  };

  const forceSyncWordFixedNodes = () => {
    for (const w of solverWords) {
      const startNodeId = w.fixedNodeIDs[1];
      if (startNodeId) {
        const node = nodeMap.get(startNodeId);
        if (node && node.logiNumber === null) {
          node.logiNumber = w.logiNumber;
          node.currentChar = w.text[0];
          node.isFixed = true;
        }
      }
      for (let i = 1; i <= w.length; i++) {
        const nid = w.fixedNodeIDs[i];
        if (nid) {
          const node = nodeMap.get(nid);
          if (node) {
            node.currentChar = w.text[i - 1];
            node.isFixed = true;
          }
        }
      }
    }
  };

  const getGridChars = (): string[][] => {
    forceSyncWordFixedNodes();
    const grid = cells.map(row => row.map(c => c.char || ''));
    for (const node of nodeMap.values()) {
      if (node.isFixed) {
        grid[node.y][node.x] = node.currentChar;
      }
    }
    return grid;
  };

  const checkIsDifferent = (): { isDifferent: boolean; diffDetails: string[] } => {
    if (!firstSolutionCells) return { isDifferent: false, diffDetails: [] };
    const currGridChars = getGridChars();
    const diffDetails: string[] = [];
    let isDifferent = false;
    for (const node of nodeMap.values()) {
      const firstChar = firstSolutionCells[node.y][node.x].answerChar || firstSolutionCells[node.y][node.x].char || '';
      const currChar = currGridChars[node.y][node.x];
      if (firstChar !== currChar) {
        isDifferent = true;
        diffDetails.push(`(${node.x},${node.y}): first='${firstChar}', curr='${currChar}'`);
      }
    }
    return { isDifferent, diffDetails };
  };

  const reportStep = async () => {
    syncWordFixedNodes();
    if (onStep) {
      // メインのデータを壊さないよう、表示用のコピーを作成して隠蔽処理を行う
      const displayCells = currentCells.map(row => row.map(c => ({ ...c })));

      for (const node of nodeMap.values()) {
        const cell = displayCells[node.y][node.x];

        // 網掛けマスの表示制御
        if (isChoMode && puzzle.cells[node.y][node.x].isShaded) {
          // エンジンが特定したか、あるいは元々表示されていた（途中からモード等）場合は表示する
          if (node.isFixed || node.logiNumber !== null || puzzle.cells[node.y][node.x].isRevealed) {
            cell.isRevealed = true;
          } else {
            cell.isRevealed = false;
          }
        } else {
          cell.isRevealed = true;
        }

        if (node.isFixed) {
          cell.answerChar = node.currentChar;
        }

        // 数字の同期 (表示用)
        if (node.logiNumber !== null) {
          cell.number = node.logiNumber;
        }
      }
      await onStep(displayCells);
      // 超モードの場合は推論過程を見せるため少し長めに待つ
      await new Promise(resolve => setTimeout(resolve, isChoMode ? 150 : 30));
    }
  };

  if (findAlternative) {
    if (firstSolutionCells) {
      let firstCellsCharCount = 0;
      firstSolutionCells.forEach(row => row.forEach(c => {
        if (c.answerChar) firstCellsCharCount++;
      }));
      log(`[Solver] 別解探索モード: firstSolutionCells が渡されました。文字が設定されているマスの数: ${firstCellsCharCount}`);
    } else {
      log(`[Solver] [エラー/警告] 別解探索モードですが、firstSolutionCells が渡されていません！`);
    }
  }

  // 1. ノードの初期化
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = cells[y][x];
      if (cell.type === 'wall') continue;

      // 結合マスの親でない場合はスキップ
      if (cell.mergedParent && (cell.mergedParent.x !== x || cell.mergedParent.y !== y)) {
        continue;
      }

      const id = `${x},${y}`;
      // 超モード（網掛け）の場合の初期化
      const isActuallyShaded = cell.isShaded;

      // 「途中から」の場合、既に入力されている文字は固定として扱う
      const hasInitialChar = cell.answerChar !== '';
      const isInitiallyRevealed = cell.isRevealed;

      let isFixed = false;
      let currentChar = '';
      let logiNumber: number | null = null;

      if (isIrregularMode) {
        const playerChar = cell.answerChar || cell.char;
        if (playerChar !== '') {
          isFixed = true;
          currentChar = playerChar;
        }
        logiNumber = null;
      } else {
        isFixed = isActuallyShaded 
          ? (hasInitialChar || !!isInitiallyRevealed) 
          : (cell.char !== '' || (cell.number !== null && !(puzzle.isWListStar && puzzle.wordStarList?.[cell.number])));
        currentChar = isActuallyShaded ? (hasInitialChar ? cell.answerChar : '') : cell.char;
        logiNumber = isActuallyShaded ? (isInitiallyRevealed ? cell.number : null) : cell.number;
      }

      const node: SolverNode = {
        id,
        x,
        y,
        isFixed,
        currentChar,
        logiNumber,
        neighbors: [],
        reservedBy: new Set(),
        reservedChars: new Set(),
        candidates: new Set(),
        numberCandidates: (isActuallyShaded || isIrregularMode) ? new Set() : undefined,
        hiddenCorrectNumber: (isActuallyShaded || isIrregularMode) ? cell.number : undefined,
      };
      nodeMap.set(id, node);
    }
  }

  // 最初の表示 (超モードなら網掛けの数字が消えた状態)
  await reportStep();

  // 2. 隣接関係の構築
  for (const node of nodeMap.values()) {
    const parentCell = cells[node.y][node.x];
    const groupCells: { x: number, y: number }[] = [];

    // 大マスの場合は全範囲をリストアップ、小マスの場合は自分自身のみ
    if (parentCell.mergedSize) {
      for (let dy = 0; dy < parentCell.mergedSize.height; dy++) {
        for (let dx = 0; dx < parentCell.mergedSize.width; dx++) {
          groupCells.push({ x: node.x + dx, y: node.y + dy });
        }
      }
    } else {
      groupCells.push({ x: node.x, y: node.y });
    }

    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const gc of groupCells) {
      for (const [dx, dy] of directions) {
        const nx = gc.x + dx;
        const ny = gc.y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborCell = cells[ny][nx];
          const targetX = neighborCell.mergedParent ? neighborCell.mergedParent.x : nx;
          const targetY = neighborCell.mergedParent ? neighborCell.mergedParent.y : ny;
          const neighborId = `${targetX},${targetY}`;

          // 自分自身（同じ大マス内）でなく、まだ登録されていないノードなら追加
          if (neighborId !== node.id && nodeMap.has(neighborId)) {
            if (!node.neighbors.includes(neighborId)) {
              node.neighbors.push(neighborId);
            }
          }
        }
      }
    }
  }

  // 2.5 Wリスト用の網掛けブロック抽出
  interface ShadedBlock {
    id: number;
    nodes: SolverNode[];
    nodeIds: Set<string>;
  }

  const shadedBlocks: ShadedBlock[] = [];
  if (puzzle.isWList) {
    const visitedShaded = new Set<string>();
    let blockIdCounter = 0;

    for (const node of nodeMap.values()) {
      const cell = cells[node.y][node.x];
      if (cell.isShaded && !visitedShaded.has(node.id)) {
        const blockNodes: SolverNode[] = [];
        const queue: SolverNode[] = [node];
        visitedShaded.add(node.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          blockNodes.push(curr);
          for (const neighborId of curr.neighbors) {
            const neighborNode = nodeMap.get(neighborId);
            if (neighborNode && cells[neighborNode.y][neighborNode.x].isShaded && !visitedShaded.has(neighborId)) {
              visitedShaded.add(neighborId);
              queue.push(neighborNode);
            }
          }
        }

        const blockNodeIds = new Set(blockNodes.map(n => n.id));
        shadedBlocks.push({
          id: blockIdCounter++,
          nodes: blockNodes,
          nodeIds: blockNodeIds
        });
      }
    }

    log(`[Wリスト] 網掛けブロックを ${shadedBlocks.length} 個検出しました。`);
    shadedBlocks.forEach(b => {
      log(`  ブロック #${b.id}: サイズ=${b.nodes.length}`);
    });
  }

  // 3. 単語リストの初期化
  const allNumbersOnBoard = new Set<number>();
  cells.forEach(row => row.forEach(cell => {
    if (cell.number !== null) {
      allNumbersOnBoard.add(cell.number);
    }
  }));

  for (const num of Array.from(allNumbersOnBoard).sort((a, b) => a - b)) {
    const text = wordList[num] || "";
    const isStar = puzzle.isWListStar && puzzle.wordStarList?.[num];
    const word: SolverWord = {
      text,
      length: text.length,
      logiNumber: num,
      isUsed: false,
      fixedNodeIDs: isStar && text === ""
        ? [null, null]
        : new Array(text.length + 1).fill(null)
    };

    // 開始位置の特定
    const startNode = Array.from(nodeMap.values()).find(n => n.logiNumber === num);
    if (startNode) {
      word.fixedNodeIDs[1] = startNode.id;
      if (!startNode.currentChar && text !== "") {
        startNode.currentChar = text[0];
        startNode.isFixed = true;
      }
    }
    solverWords.push(word);
  }

  // 補助関数: 指定した単語がどこまで確定しているか
  const getFixedLength = (w: SolverWord): number => {
    let len = 0;
    for (let i = 1; i <= w.length; i++) {
      if (w.fixedNodeIDs[i]) len = i;
      else break;
    }
    return len;
  };

  const getUsedNodes = (w: SolverWord, upTo: number): Set<string> => {
    const used = new Set<string>();
    for (let i = 1; i <= upTo; i++) {
      const id = w.fixedNodeIDs[i];
      if (id) used.add(id);
    }
    return used;
  };

  const fixNode = (node: SolverNode, char: string) => {
    if (node.isFixed) return;
    node.currentChar = char;
    node.isFixed = true;
  };

  // 網掛けブロックに複数単語を配置できるか検証する（文字共有対応）
  const canAssignWordsToBlock = (
    blockNodes: SolverNode[],
    words: string[],
    gridChars: Record<string, string>,
    outGrid?: Record<string, string>
  ): boolean => {
    const blockNodeIds = new Set(blockNodes.map(n => n.id));
    const currentGrid = { ...gridChars };
    const coveredNodes = new Set<string>();

    const dfsAssign = (wordIdx: number): boolean => {
      if (wordIdx === words.length) {
        const success = coveredNodes.size === blockNodes.length;
        if (success && outGrid) {
          Object.assign(outGrid, currentGrid);
        }
        return success;
      }
      
      const word = words[wordIdx];
      
      for (const startNode of blockNodes) {
        const startChar = currentGrid[startNode.id];
        if (startChar && startChar !== word[0]) continue;
        
        const path: string[] = [startNode.id];
        const visited = new Set<string>([startNode.id]);
        
        const findPaths = (currId: string, charIdx: number): boolean => {
          if (charIdx === word.length) {
            const addedNodes: string[] = [];
            const prevGridValues: { [id: string]: string | undefined } = {};
            
            for (let i = 0; i < path.length; i++) {
              const nid = path[i];
              const c = word[i];
              if (!coveredNodes.has(nid)) {
                coveredNodes.add(nid);
                addedNodes.push(nid);
              }
              if (currentGrid[nid] === undefined) {
                prevGridValues[nid] = undefined;
                currentGrid[nid] = c;
              } else {
                prevGridValues[nid] = currentGrid[nid];
              }
            }
            
            if (dfsAssign(wordIdx + 1)) {
              return true;
            }
            
            for (const nid of addedNodes) {
              coveredNodes.delete(nid);
            }
            for (const nid in prevGridValues) {
              const val = prevGridValues[nid];
              if (val === undefined) {
                delete currentGrid[nid];
              } else {
                currentGrid[nid] = val;
              }
            }
            return false;
          }
          
          const currNode = nodeMap.get(currId)!;
          const nextChar = word[charIdx];
          
          for (const neighborId of currNode.neighbors) {
            if (blockNodeIds.has(neighborId) && !visited.has(neighborId)) {
              const nGChar = currentGrid[neighborId];
              if (nGChar && nGChar !== nextChar) continue;
              
              visited.add(neighborId);
              path.push(neighborId);
              if (findPaths(neighborId, charIdx + 1)) return true;
              path.pop();
              visited.delete(neighborId);
            }
          }
          return false;
        };
        
        const originalStartChar = currentGrid[startNode.id];
        currentGrid[startNode.id] = word[0];
        const startAdded = !coveredNodes.has(startNode.id);
        if (startAdded) coveredNodes.add(startNode.id);
        
        if (findPaths(startNode.id, 1)) {
          return true;
        }
        
        if (startAdded) coveredNodes.delete(startNode.id);
        if (originalStartChar === undefined) {
          delete currentGrid[startNode.id];
        } else {
          currentGrid[startNode.id] = originalStartChar;
        }
      }
      return false;
    };
    
    const res = dfsAssign(0);
    return res;
  };

  // 指定された単語が、指定された文字位置で網掛けブロックに（他の文字と矛盾なく）収まるかを判定する
  const canWordFitAtShadedNode = (
    blockNodeIds: Set<string>,
    word: string,
    charIdxInWord: number,
    startNode: SolverNode,
    gridChars: Record<string, string>
  ): boolean => {
    const startNodeChar = gridChars[startNode.id];
    if (startNodeChar && startNodeChar !== word[charIdxInWord]) {
      return false;
    }

    const visited = new Set<string>([startNode.id]);

    // 左側（逆方向）のパスを探索
    const leftPaths: string[][] = [];
    const findLeftPaths = (currId: string, idx: number, path: string[]) => {
      if (idx < 0) {
        leftPaths.push([...path]);
        return;
      }
      const currNode = nodeMap.get(currId)!;
      const targetChar = word[idx];
      for (const neighborId of currNode.neighbors) {
        if (blockNodeIds.has(neighborId) && !visited.has(neighborId)) {
          const nGChar = gridChars[neighborId];
          if (nGChar && nGChar !== targetChar) continue;
          
          visited.add(neighborId);
          path.push(neighborId);
          findLeftPaths(neighborId, idx - 1, path);
          path.pop();
          visited.delete(neighborId);
        }
      }
    };

    findLeftPaths(startNode.id, charIdxInWord - 1, []);

    if (leftPaths.length === 0 && charIdxInWord > 0) {
      return false;
    }

    const actualLeftPaths = charIdxInWord === 0 ? [[]] : leftPaths;

    for (const leftPath of actualLeftPaths) {
      const currentVisited = new Set<string>([startNode.id]);
      for (const nid of leftPath) {
        currentVisited.add(nid);
      }

      let rightSuccess = false;
      const findRightPath = (currId: string, idx: number): boolean => {
        if (idx === word.length) {
          rightSuccess = true;
          return true;
        }
        const currNode = nodeMap.get(currId)!;
        const targetChar = word[idx];
        for (const neighborId of currNode.neighbors) {
          if (blockNodeIds.has(neighborId) && !currentVisited.has(neighborId)) {
            const nGChar = gridChars[neighborId];
            if (nGChar && nGChar !== targetChar) continue;

            currentVisited.add(neighborId);
            if (findRightPath(neighborId, idx + 1)) return true;
            currentVisited.delete(neighborId);
          }
        }
        return false;
      };

      if (charIdxInWord === word.length - 1) {
        return true;
      }

      findRightPath(startNode.id, charIdxInWord + 1);
      if (rightSuccess) {
        return true;
      }
    }

    return false;
  };

  const canNodeAcceptChar = (node: SolverNode, char: string): boolean => {
    if (node.isFixed) {
      return node.currentChar === char;
    }

    // Wリスト用の網掛け侵入制限
    if (puzzle.isWList) {
      const cell = cells[node.y][node.x];
      if (cell.isShaded) {
        const block = shadedBlocks.find(b => b.nodeIds.has(node.id));
        if (block) {
          const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
          
          const charInAnyWord = list2Words.some(w => w.includes(char));
          if (!charInAnyWord) {
            return false;
          }

          const gridChars: Record<string, string> = {};
          for (const n of nodeMap.values()) {
            if (n.isFixed && n.currentChar) {
              gridChars[n.id] = n.currentChar;
            }
          }
          gridChars[node.id] = char;

          // 候補となる単語（その文字を含み、かつブロックサイズ以下の長さのもの）
          const candidateWords = list2Words.filter(w => w.includes(char) && w.length <= block.nodes.length);
          let canFit = false;
          const blockNodeIds = block.nodeIds;

          for (const w of candidateWords) {
            let pos = w.indexOf(char);
            while (pos !== -1) {
              if (canWordFitAtShadedNode(blockNodeIds, w, pos, node, gridChars)) {
                canFit = true;
                break;
              }
              pos = w.indexOf(char, pos + 1);
            }
            if (canFit) break;
          }

          if (!canFit) {
            return false;
          }
        }
      }
    }

    if (puzzle.isWListStar && node.logiNumber !== null && puzzle.wordStarList?.[node.logiNumber]) {
      const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
      const assignedWords = new Set(solverWords.map(sw => sw.text).filter(t => t !== ""));
      const unusedList2Words = list2Words.filter(w => !assignedWords.has(w));

      // 他の★のマスで既に確定（isFixed）している開始文字の数を集計
      const fixedStarFirstChars = new Map<string, number>();
      for (const w of solverWords) {
        if (puzzle.wordStarList?.[w.logiNumber] && w.text === "") {
          const startId = w.fixedNodeIDs[1];
          if (startId) {
            const startNode = nodeMap.get(startId);
            if (startNode && startNode.isFixed && startNode.currentChar) {
              const c = startNode.currentChar;
              fixedStarFirstChars.set(c, (fixedStarFirstChars.get(c) || 0) + 1);
            }
          }
        }
      }

      // 未使用のリスト2単語の1文字目の出現回数をカウント
      const unusedList2FirstCharCounts = new Map<string, number>();
      for (const w of unusedList2Words) {
        if (w.length > 0) {
          const c = w[0];
          unusedList2FirstCharCounts.set(c, (unusedList2FirstCharCounts.get(c) || 0) + 1);
        }
      }

      const count = unusedList2FirstCharCounts.get(char) || 0;
      const fixedCount = fixedStarFirstChars.get(char) || 0;

      // すでに確定している他のマスの分で候補単語を使い切っている場合は、このマスには配置不可
      if (fixedCount >= count) {
        return false;
      }
      return count > 0;
    }
    return true;
  };

  function getExcelCoords(node: SolverNode) {
    const col = String.fromCharCode(65 + node.x);
    return `${col}${node.y + 1}`;
  }

  // Wリスト用の解答バリデーションと余り単語特定
  const validateWListAssignment = (): { success: boolean; remainingWord?: string; assignments?: Record<string, string> } => {
    if (!puzzle.isWList) return { success: true };

    const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
    const gridChars: Record<string, string> = {};
    for (const node of nodeMap.values()) {
      if (node.isFixed && node.currentChar) {
        gridChars[node.id] = node.currentChar;
      }
    }

    const blockSizes = shadedBlocks.map(b => b.nodes.length);
    const totalBlockNodes = blockSizes.reduce((sum, s) => sum + s, 0);

    const checkAssignmentForWords = (activeWords: string[]): { success: boolean; assignments?: Record<string, string> } => {
      const totalWordLen = activeWords.reduce((sum, w) => sum + w.length, 0);
      if (totalWordLen < totalBlockNodes) {
        return { success: false };
      }

      const sortedActiveWords = [...activeWords].sort((a, b) => b.length - a.length);
      const blockAssignments: string[][] = shadedBlocks.map(() => []);
      const mergedGrid: Record<string, string> = {};

      const assignWordToBlock = (wordIdx: number): boolean => {
        if (wordIdx === sortedActiveWords.length) {
          for (let i = 0; i < shadedBlocks.length; i++) {
            const assigned = blockAssignments[i];
            const size = blockSizes[i];
            const sumLen = assigned.reduce((sum, w) => sum + w.length, 0);
            if (sumLen < size) {
              return false;
            }
          }

          for (let i = 0; i < shadedBlocks.length; i++) {
            const block = shadedBlocks[i];
            const wordsForBlock = blockAssignments[i];
            const blockGrid: Record<string, string> = {};
            if (!canAssignWordsToBlock(block.nodes, wordsForBlock, gridChars, blockGrid)) {
              return false;
            }
            Object.assign(mergedGrid, blockGrid);
          }
          return true;
        }

        const word = sortedActiveWords[wordIdx];
        for (let i = 0; i < shadedBlocks.length; i++) {
          const block = shadedBlocks[i];
          if (word.length > block.nodes.length) continue;

          blockAssignments[i].push(word);
          if (assignWordToBlock(wordIdx + 1)) return true;
          blockAssignments[i].pop();
        }
        return false;
      };

      if (assignWordToBlock(0)) {
        return { success: true, assignments: mergedGrid };
      }
      return { success: false };
    };

    const resNoRemaining = checkAssignmentForWords(list2Words);
    if (resNoRemaining.success) {
      return { success: true, assignments: resNoRemaining.assignments };
    }

    for (let i = 0; i < list2Words.length; i++) {
      const remaining = list2Words[i];
      const activeWords = list2Words.filter((_, idx) => idx !== i);
      const resWithRemaining = checkAssignmentForWords(activeWords);
      if (resWithRemaining.success) {
        return { success: true, remainingWord: remaining, assignments: resWithRemaining.assignments };
      }
    }

    return { success: false };
  };

  await reportStep();

  // 矢印問題の事前処理
  if (puzzle.puzzleType === '矢印' || puzzle.isArrowMode) {
    log("--- 矢印問題の事前処理 開始 ---");
    for (const w of solverWords) {
      if (w.length < 2) continue;
      const arrow = puzzle.wordDirections?.[w.logiNumber];
      if (!arrow || arrow === '?') {
        return {
          success: false,
          message: `番号 ${w.logiNumber} の矢印が設定されていません。`,
          solvedCells: currentCells
        };
      }

      const startNodeId = w.fixedNodeIDs[1];
      if (!startNodeId) {
        log(`警告: 番号 ${w.logiNumber} の開始マスが盤面に見つかりません。`);
        continue;
      }
      const startNode = nodeMap.get(startNodeId)!;

      let dx = 0, dy = 0;
      if (arrow === '↑') dy = -1;
      else if (arrow === '→') dx = 1;
      else if (arrow === '↓') dy = 1;
      else if (arrow === '←') dx = -1;

      const nx = startNode.x + dx;
      const ny = startNode.y + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return {
          success: false,
          message: `番号 ${w.logiNumber} の矢印が盤面外を指しています。`,
          solvedCells: currentCells
        };
      }

      const nCell = cells[ny][nx];
      const targetX = nCell.mergedParent ? nCell.mergedParent.x : nx;
      const targetY = nCell.mergedParent ? nCell.mergedParent.y : ny;
      const nId = `${targetX},${targetY}`;
      const nNode = nodeMap.get(nId);

      if (!nNode) {
        return {
          success: false,
          message: `番号 ${w.logiNumber} の矢印の先に有効なマスがありません。`,
          solvedCells: currentCells
        };
      }

      const char2 = w.text[1];
      if (nNode.isFixed && nNode.currentChar !== char2) {
        return {
          success: false,
          message: `番号 ${w.logiNumber} の矢印の先（${getExcelCoords(nNode)}）には既に別の文字 '${nNode.currentChar}' があります。`,
          solvedCells: currentCells
        };
      }

      if (!nNode.isFixed) {
        fixNode(nNode, char2);
        log(`番号 ${w.logiNumber} の2文字目 '${char2}' を矢印に従って ${getExcelCoords(nNode)} に配置`);
      }
      w.fixedNodeIDs[2] = nId;
    }
    await reportStep();
  }

  // 共有候補情報の保持用
  let wordCharCandidates: Map<number, Map<number, Set<string>>> = new Map();
  let nodeCharUsage: Map<string, Map<string, Set<number>>> = new Map();

  // 単語の候補セル情報を収集
  const collectWordCandidates = async () => {
    wordCharCandidates = new Map();
    nodeCharUsage = new Map();

    const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
    const assignedWords = new Set(solverWords.map(sw => sw.text).filter(t => t !== ""));
    const unusedList2Words = list2Words.filter(w => !assignedWords.has(w));

    for (const w of solverWords) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      incrementProgress();
      await new Promise(r => setTimeout(r, 0));

      if (w.isUsed) continue;

      // Wリスト★の未確定単語に対する候補収集処理
      const isStar = puzzle.isWListStar && puzzle.wordStarList?.[w.logiNumber] && w.text === "";
      if (isStar) {
        const startId = w.fixedNodeIDs[1];
        if (startId) {
          const startNode = nodeMap.get(startId);
          if (startNode) {
            const candidatesByPos: Map<number, Set<string>> = new Map();
            wordCharCandidates.set(w.logiNumber, candidatesByPos);

            for (const wordText of unusedList2Words) {
              if (startNode.isFixed && startNode.currentChar !== wordText[0]) continue;

              const used = new Set<string>();
              used.add(startId);

              let dfsCalls = 0;
              let overflow = false;

              // 探索中のパスに含まれるノードIDの履歴
              const pathNodes: string[] = [startId];

              const dfsStar = (currId: string, charIdx: number) => {
                if (overflow) return;
                dfsCalls++;
                if (dfsCalls > 500) {
                  overflow = true;
                  return;
                }

                // 単語の最後の文字まで矛盾なく到達できた場合のみ登録
                if (charIdx === wordText.length) {
                  // 有効なパスが確定したので、そのパス上の全マスに対応する文字を一括登録
                  for (let i = 0; i < wordText.length; i++) {
                    const nid = pathNodes[i];
                    const targetChar = wordText[i];

                    if (!candidatesByPos.has(i)) candidatesByPos.set(i, new Set());
                    candidatesByPos.get(i)!.add(nid);

                    if (!nodeCharUsage.has(nid)) nodeCharUsage.set(nid, new Map());
                    const charMap = nodeCharUsage.get(nid)!;
                    if (!charMap.has(targetChar)) charMap.set(targetChar, new Set());
                    charMap.get(targetChar)!.add(w.logiNumber);
                  }
                  return;
                }

                const currNode = nodeMap.get(currId)!;
                const targetChar = wordText[charIdx];

                for (const nid of currNode.neighbors) {
                  if (used.has(nid)) continue;
                  const nb = nodeMap.get(nid)!;
                  if (canNodeAcceptChar(nb, targetChar)) {
                    used.add(nid);
                    pathNodes.push(nid);
                    dfsStar(nid, charIdx + 1);
                    pathNodes.pop();
                    used.delete(nid);
                  }
                }
              };

              dfsStar(startId, 1);
            }
          }
        }
        continue;
      }

      if (isIrregularMode && getFixedLength(w) === 0) {
        const candidatesByPos: Map<number, Set<string>> = new Map();
        wordCharCandidates.set(w.logiNumber, candidatesByPos);

        const allowedStarts = getAllowedStartNodes();
        const startNodes = allowedStarts.get(w.logiNumber) || [];

        const fixedNodesWithChars = Array.from(nodeMap.values()).filter(n => n.isFixed && w.text.includes(n.currentChar));

        const filteredStartNodes = startNodes.filter(startNode => {
          return fixedNodesWithChars.every(fixedNode => {
            const idxs = [];
            let pos = w.text.indexOf(fixedNode.currentChar);
            while (pos !== -1) {
              idxs.push(pos);
              pos = w.text.indexOf(fixedNode.currentChar, pos + 1);
            }
            const dist = Math.abs(startNode.x - fixedNode.x) + Math.abs(startNode.y - fixedNode.y);
            return idxs.some(idx => dist <= idx);
          });
        });

        for (const startNode of filteredStartNodes) {
          if (startNode.isFixed && startNode.currentChar !== w.text[0]) continue;

          const used = new Set<string>();
          used.add(startNode.id);

          const pathNodes: string[] = [startNode.id];
          let dfsCalls = 0;
          let overflow = false;

          const dfsIrregular = (currId: string, charIdx: number) => {
            if (overflow) return;
            dfsCalls++;
            if (dfsCalls > 1000) {
              overflow = true;
              return;
            }

            if (charIdx === w.length) {
              for (let i = 0; i < w.length; i++) {
                const nid = pathNodes[i];
                const targetChar = w.text[i];
                if (!candidatesByPos.has(i)) candidatesByPos.set(i, new Set());
                candidatesByPos.get(i)!.add(nid);

                if (!nodeCharUsage.has(nid)) nodeCharUsage.set(nid, new Map());
                const charMap = nodeCharUsage.get(nid)!;
                if (!charMap.has(targetChar)) charMap.set(targetChar, new Set());
                charMap.get(targetChar)!.add(w.logiNumber);
              }
              return;
            }

            const currNode = nodeMap.get(currId)!;
            const targetChar = w.text[charIdx];

            for (const nid of currNode.neighbors) {
              if (used.has(nid)) continue;
              const nb = nodeMap.get(nid)!;
              if (canNodeAcceptChar(nb, targetChar)) {
                used.add(nid);
                pathNodes.push(nid);
                dfsIrregular(nid, charIdx + 1);
                pathNodes.pop();
                used.delete(nid);
              }
            }
          };

          dfsIrregular(startNode.id, 1);
        }
        continue;
      }

      const fixedLen = getFixedLength(w);
      if (fixedLen === 0 || fixedLen === w.length) continue;
      const startId = w.fixedNodeIDs[fixedLen]!;
      const used = getUsedNodes(w, fixedLen);
      const candidatesByPos: Map<number, Set<string>> = new Map();
      wordCharCandidates.set(w.logiNumber, candidatesByPos);

      let dfsCalls = 0;
      let overflow = false;

      const dfs = (currId: string, charIdx: number) => {
        if (overflow) return;
        dfsCalls++;
        if (dfsCalls > 500) {
          overflow = true;
          return;
        }

        if (charIdx === w.length) return;
        const currNode = nodeMap.get(currId)!;
        const targetChar = w.text[charIdx];
        const nextFixedId = w.fixedNodeIDs[charIdx + 1];

        for (const nid of currNode.neighbors) {
          if (used.has(nid)) continue;
          if (nextFixedId && nid !== nextFixedId) continue;
          const nb = nodeMap.get(nid)!;
          if (canNodeAcceptChar(nb, targetChar)) {
            if (!candidatesByPos.has(charIdx)) candidatesByPos.set(charIdx, new Set());
            candidatesByPos.get(charIdx)!.add(nid);

            if (!nodeCharUsage.has(nid)) nodeCharUsage.set(nid, new Map());
            const charMap = nodeCharUsage.get(nid)!;
            if (!charMap.has(targetChar)) charMap.set(targetChar, new Set());
            charMap.get(targetChar)!.add(w.logiNumber);

            used.add(nid);
            dfs(nid, charIdx + 1);
            used.delete(nid);
          }
        }
      };
      dfs(startId, fixedLen);
    }
  };

  // 共有チャンスの取得 (共通)
  const getSharingOpportunities = (wNum: number, pos: number) => {
    const opportunities = new Map<string, Set<string>>();
    const candW = wordCharCandidates.get(wNum)?.get(pos);
    if (!candW) return opportunities;

    const wordW = solverWords.find(sw => sw.logiNumber === wNum)!;

    // 1. 未使用単語との共有
    for (const [vNum, vCands] of wordCharCandidates.entries()) {
      if (vNum === wNum) continue;
      const wordV = solverWords.find(sw => sw.logiNumber === vNum)!;

      for (const [vPos, candV] of vCands.entries()) {
        if (wordW.text[pos] !== wordV.text[vPos]) continue;
        const intersection = Array.from(candW).filter(id => candV.has(id));
        for (const nid of intersection) {
          if (!opportunities.has(nid)) opportunities.set(nid, new Set());
          opportunities.get(nid)!.add(`${vNum}:${vPos}`);
        }
      }
    }

    // 2. 確定済みセルとの共有 (Type 1的な共有もカウントに含める)
    for (const nid of candW) {
      const node = nodeMap.get(nid)!;
      if (node.isFixed && node.currentChar === wordW.text[pos]) {
        if (!opportunities.has(nid)) opportunities.set(nid, new Set());
        opportunities.get(nid)!.add(`FIXED:0`);
      }
    }

    return opportunities;
  };

  const executeLogicalLoop = async (): Promise<boolean> => {
    let overallChanged = false;
    let loopChanged = true;

    while (loopChanged) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      incrementProgress();
      await new Promise(r => setTimeout(r, 0));
      loopChanged = false;

      for (const w of solverWords) {
        if (checkCancelled && checkCancelled()) {
          throw new Error("cancelled");
        }
        incrementProgress();
        await new Promise(r => setTimeout(r, 0));

        const fixedLen = getFixedLength(w);
        if (fixedLen === 0 || fixedLen === w.length) continue;

        if (w.fixedNodeIDs[fixedLen + 1]) {
          const targetId = w.fixedNodeIDs[fixedLen + 1]!;
          const targetNode = nodeMap.get(targetId)!;
          const targetChar = w.text[fixedLen];
          if (!targetNode.isFixed) {
            fixNode(targetNode, targetChar);
            await reportStep();
            loopChanged = true;
            overallChanged = true;
          }
          continue;
        }

        const currentId = w.fixedNodeIDs[fixedLen]!;
        const currentNode = nodeMap.get(currentId)!;
        const targetChar = w.text[fixedLen];
        const used = getUsedNodes(w, fixedLen);

        const possibleNeighbors = currentNode.neighbors.filter(nid => {
          if (used.has(nid)) return false;
          const nb = nodeMap.get(nid)!;
          return canNodeAcceptChar(nb, targetChar);
        });

        if (possibleNeighbors.length === 1) {
          const targetId = possibleNeighbors[0];
          const targetNode = nodeMap.get(targetId)!;
          if (!targetNode.isFixed || !w.fixedNodeIDs[fixedLen + 1]) {
            fixNode(targetNode, targetChar);
            w.fixedNodeIDs[fixedLen + 1] = targetId;
            await reportStep();
            loopChanged = true;
            overallChanged = true;
          }
        }
      }

      if (await updateCommonNodes()) {
        loopChanged = true;
        overallChanged = true;
      }
    }

    return overallChanged;
  };

  const updateCommonNodes = async (): Promise<boolean> => {
    let changed = false;
    for (const node of nodeMap.values()) {
      node.candidates.clear();
    }

    for (const w of solverWords) {
      if (w.isUsed) continue;
      const fixedLen = getFixedLength(w);
      if (fixedLen === 0) continue;
      if (fixedLen === w.length) {
        w.isUsed = true;
        continue;
      }

      const startId = w.fixedNodeIDs[fixedLen]!;
      const used = getUsedNodes(w, fixedLen);
      const paths: { nid: string, char: string }[][] = [];
      const currentPath: { nid: string, char: string }[] = [];

      let dfsCalls = 0;
      let overflow = false;

      const dfs = (currId: string, charIdx: number) => {
        if (overflow) return;
        dfsCalls++;
        if (dfsCalls > 500) {
          overflow = true;
          return;
        }

        if (charIdx === w.length) {
          paths.push([...currentPath]);
          return;
        }
        const currNode = nodeMap.get(currId)!;
        const targetChar = w.text[charIdx];
        const nextFixedId = w.fixedNodeIDs[charIdx + 1];

        for (const nid of currNode.neighbors) {
          if (used.has(nid)) continue;
          if (nextFixedId && nid !== nextFixedId) continue;
          const nb = nodeMap.get(nid)!;
          if (canNodeAcceptChar(nb, targetChar)) {
            used.add(nid);
            currentPath.push({ nid, char: targetChar });
            dfs(nid, charIdx + 1);
            currentPath.pop();
            used.delete(nid);
          }
        }
      };

      dfs(startId, fixedLen);
      if (paths.length === 0) continue;

      const nodeHits = new Map<string, number>();
      const nodeChars = new Map<string, Set<string>>();

      for (const path of paths) {
        for (const step of path) {
          nodeHits.set(step.nid, (nodeHits.get(step.nid) || 0) + 1);
          if (!nodeChars.has(step.nid)) nodeChars.set(step.nid, new Set());
          nodeChars.get(step.nid)!.add(step.char);
          nodeMap.get(step.nid)!.candidates.add(step.char);
        }
      }

      for (const [nid, hits] of nodeHits.entries()) {
        if (hits === paths.length) {
          const node = nodeMap.get(nid)!;
          const chars = nodeChars.get(nid)!;
          if (chars.size === 1) {
            const char = Array.from(chars)[0];
            if (!node.isFixed) {
              fixNode(node, char);
              await reportStep();
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  };

  /**
   * 共有化フェーズ (Type 2: 未確定文字同士の共有)
   */
  const solveDynamicSharing = async (): Promise<boolean> => {
    let changed = false;

    // 2. 共有セル確定 (相互独占・相思相愛・単語内競合チェック)
    for (const w of solverWords) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      incrementProgress();
      await new Promise(r => setTimeout(r, 0));

      if (w.isUsed) continue;
      const wCands = wordCharCandidates.get(w.logiNumber);
      if (!wCands) continue;

      // この単語における共有候補箇所のリストを収集
      const sharingPositionsW: { pos: number, opps: Map<string, Set<string>> }[] = [];
      for (let j = 1; j < w.text.length; j++) {
        if (w.fixedNodeIDs[j + 1]) continue;
        const opps = getSharingOpportunities(w.logiNumber, j);
        if (opps.size > 0) {
          sharingPositionsW.push({ pos: j, opps });
        }
      }

      // 1つの単語内に複数の共有候補箇所がある場合は保留
      if (sharingPositionsW.length > 1) {
        continue;
      }
      if (sharingPositionsW.length === 0) continue;

      const { pos: i, opps: oppsW } = sharingPositionsW[0];

      // この位置の共有候補セルが1つだけの場合
      if (oppsW.size === 1) {
        const [nid, partnerSet] = Array.from(oppsW.entries())[0];

        // 単語内競合チェック
        let hasSelfConflict = false;
        for (let k = 1; k < w.text.length; k++) {
          if (k === i) continue;
          if (w.text[k] === w.text[i]) {
            const otherPosCands = wCands.get(k);
            if (otherPosCands && otherPosCands.has(nid)) {
              hasSelfConflict = true;
              break;
            }
          }
        }
        if (hasSelfConflict) continue;

        // パートナーの単語番号を抽出
        const partnerNums = new Set<number>();
        let hasFixedPartner = false;
        for (const p of partnerSet) {
          if (p === 'FIXED:0') {
            hasFixedPartner = true;
          } else {
            partnerNums.add(parseInt(p.split(':')[0], 10));
          }
        }

        // パートナー側チェック
        let allPartnersDecisive = true;

        // 確定済みセルとの共有の場合は、そのセル自体が既に確定しているので
        // 「パートナー側が迷っている」という概念はないが、
        // もし partnerSet に FIXED 以外も混ざっているなら、それらも decisive である必要がある。

        for (const pNum of partnerNums) {
          const pWord = solverWords.find(sw => sw.logiNumber === pNum)!;
          const pCands = wordCharCandidates.get(pNum);

          // パートナー単語における共有候補箇所のリスト
          const sharingPositionsP: { pos: number, opps: Map<string, Set<string>> }[] = [];
          for (let j = 1; j < pWord.text.length; j++) {
            if (pWord.fixedNodeIDs[j + 1]) continue;
            const opps = getSharingOpportunities(pNum, j);
            if (opps.size > 0) {
              sharingPositionsP.push({ pos: j, opps });
            }
          }

          // パートナー側も共有候補箇所が複数ある場合は保留
          if (sharingPositionsP.length > 1) {
            allPartnersDecisive = false;
            break;
          }

          let partnerHasOtherOption = false;
          let partnerHasSelfConflict = false;

          for (const { pos: j, opps: oppsP } of sharingPositionsP) {
            if (pWord.text[j] === w.text[i]) {
              if (oppsP.size > 1) {
                partnerHasOtherOption = true;
                break;
              }
              for (let k = 1; k < pWord.text.length; k++) {
                if (k === j) continue;
                if (pWord.text[k] === pWord.text[j]) {
                  const otherPosCands = pCands?.get(k);
                  if (otherPosCands && otherPosCands.has(nid)) {
                    partnerHasSelfConflict = true;
                    break;
                  }
                }
              }
              if (partnerHasSelfConflict) break;
            }
          }
          if (partnerHasOtherOption || partnerHasSelfConflict) {
            allPartnersDecisive = false;
            break;
          }
        }

        if (allPartnersDecisive) {
          const node = nodeMap.get(nid)!;
          const partnerDesc = hasFixedPartner ? '確定済みセル' : '相手単語群';
          log(`単語 [${w.logiNumber}] と ${partnerDesc} が文字 '${w.text[i]}' を共有できる唯一の場所 ${getExcelCoords(node)} を相互確定 (単語内競合なし)`);
          fixNode(node, w.text[i]);
          // アンカーを打つ
          w.fixedNodeIDs[i + 1] = nid;
          for (const pStr of partnerSet) {
            if (pStr === 'FIXED:0') continue;
            const [pNumStr, pPosStr] = pStr.split(':');
            const pNum = parseInt(pNumStr, 10);
            const pPos = parseInt(pPosStr, 10);
            const pWord = solverWords.find(sw => sw.logiNumber === pNum)!;
            pWord.fixedNodeIDs[pPos + 1] = nid;
          }
          await reportStep();
          changed = true;
        }
      }
    }

    // 3. セル視点での一意性チェック (全候補が一致)
    // 超モードの場合、すべての単語の開始位置（数字）が確定するまでは、この「裸のシングル」判定を行わない
    let shouldSkipSingleCheck = false;
    if (isChoMode) {
      if (solverWords.some(w => w.fixedNodeIDs[1] === null)) {
        shouldSkipSingleCheck = true;
      }
    }

    if (!shouldSkipSingleCheck) {
      for (const [nid, charMap] of nodeCharUsage.entries()) {
        const node = nodeMap.get(nid)!;
        if (node.isFixed) continue;
        if (charMap.size === 1) {
          const [char, words] = Array.from(charMap.entries())[0];
          log(`セル ${getExcelCoords(node)} は文字 '${char}' のみが配置可能 (全候補が一致: リスト ${Array.from(words).sort((a, b) => a - b).join(', ')})`);
          fixNode(node, char);
          await reportStep();
          changed = true;
        }
      }
    }
    return changed;
  };

  const canWordFitAtNode = (W: string, startNode: SolverNode): boolean => {
    if (W === "") return false;
    if (!canNodeAcceptChar(startNode, W[0])) return false;

    const visited = new Set<string>();
    visited.add(startNode.id);

    let found = false;

    const dfs = (currNode: SolverNode, charIdx: number) => {
      if (found) return;
      if (charIdx === W.length) {
        found = true;
        return;
      }

      const targetChar = W[charIdx];
      for (const neighborId of currNode.neighbors) {
        if (visited.has(neighborId)) continue;
        const neighborNode = nodeMap.get(neighborId)!;
        if (canNodeAcceptChar(neighborNode, targetChar)) {
          visited.add(neighborId);
          dfs(neighborNode, charIdx + 1);
          visited.delete(neighborId);
        }
      }
    };

    dfs(startNode, 1);
    return found;
  };

  const solveWListStarAssignment = async (): Promise<boolean> => {
    if (!puzzle.isWListStar) return false;

    const unassignedStars = solverWords.filter(w => puzzle.wordStarList?.[w.logiNumber] && w.text === "");
    if (unassignedStars.length === 0) return false;

    const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
    const assignedWords = new Set(solverWords.map(sw => sw.text).filter(t => t !== ""));
    const unusedList2Words = list2Words.filter(w => !assignedWords.has(w));
    if (unusedList2Words.length === 0) return false;

    for (const w of unassignedStars) {
      const startNodeId = w.fixedNodeIDs[1];
      if (!startNodeId) continue;
      const startNode = nodeMap.get(startNodeId);
      if (!startNode) continue;

      const candidates = unusedList2Words.filter(word => canWordFitAtNode(word, startNode));

      if (candidates.length === 1) {
        const matchedWord = candidates[0];
        w.text = matchedWord;
        w.length = matchedWord.length;
        w.fixedNodeIDs = new Array(matchedWord.length + 1).fill(null);
        w.fixedNodeIDs[1] = startNode.id;

        fixNode(startNode, matchedWord[0]);
        log(`[Wリスト★割り当て] ★番号 ${w.logiNumber} に適合する単語が「${matchedWord}」のみであるため、これを割り当てました。`);
        await reportStep();
        return true;
      }
    }
    return false;
  };

  const solveFixedSharing = async (): Promise<boolean> => {
    let changed = false;
    for (let d = 1; d <= 15; d++) {
      let dChanged = false;
      for (const w of solverWords) {
        if (checkCancelled && checkCancelled()) {
          throw new Error("cancelled");
        }
        incrementProgress();
        await new Promise(r => setTimeout(r, 0));

        if (w.isUsed) continue;
        const fixedLen = getFixedLength(w);
        if (fixedLen === 0 || fixedLen + d > w.length) continue;
        const targetChar = w.text[fixedLen + d - 1];
        const startId = w.fixedNodeIDs[fixedLen]!;
        const candidates = findNodesAtDistance(startId, d, w);
        const matchingFixedNodes = candidates.filter(nid => {
          const node = nodeMap.get(nid)!;
          return node.isFixed && node.currentChar === targetChar;
        });

        if (matchingFixedNodes.length === 1) {
          const targetId = matchingFixedNodes[0];

          // ガード追加：この位置 (fixedLen + d - 1) において、他にも共有の可能性があるセルがないかチェック
          const oppsAll = getSharingOpportunities(w.logiNumber, fixedLen + d - 1);
          if (oppsAll.size > 1) {
            // 他にも共有可能なセル（未使用単語との共有など）がある場合は保留
            continue;
          }

          // ガード追加：この targetId が、w の他の未確定位置（同じ文字）にも到達可能かどうかをチェック
          let hasSelfConflict = false;
          for (let k = fixedLen + 1; k <= w.length; k++) {
            if (k === fixedLen + d) continue; // 自分自身はスキップ
            if (w.text[k - 1] === targetChar) {
              // 距離 k - fixedLen で targetId に到達可能か？
              const otherDist = k - fixedLen;
              const otherCandidates = findNodesAtDistance(startId, otherDist, w);
              if (otherCandidates.includes(targetId)) {
                hasSelfConflict = true;
                break;
              }
            }
          }

          if (hasSelfConflict) {
            log(`単語 [${w.logiNumber}] の確定文字 '${targetChar}' (${getExcelCoords(nodeMap.get(targetId)!)}) への接続は、複数の位置で可能なため保留します。`);
            continue; // 保留
          }

          if (w.fixedNodeIDs[fixedLen + d] !== targetId) {
            w.fixedNodeIDs[fixedLen + d] = targetId;
            log(`単語 [${w.logiNumber}] の ${fixedLen + d} 文字目 '${targetChar}' を確定済みセル ${getExcelCoords(nodeMap.get(targetId)!)} に接続`);
            dChanged = true;
            changed = true;
          }
        }
      }
      if (dChanged) return true;
    }
    return changed;
  };

  const findNodesAtDistance = (startId: string, dist: number, w: SolverWord): string[] => {
    const results = new Set<string>();
    const used = getUsedNodes(w, getFixedLength(w));
    let dfsCalls = 0;
    let overflow = false;

    const dfs = (currId: string, currentDist: number) => {
      if (overflow) return;
      dfsCalls++;
      if (dfsCalls > 500) {
        overflow = true;
        return;
      }

      if (currentDist === dist) {
        results.add(currId);
        return;
      }
      const currNode = nodeMap.get(currId)!;
      const targetChar = w.text[getFixedLength(w) + currentDist];
      for (const nid of currNode.neighbors) {
        if (used.has(nid)) continue;
        const nb = nodeMap.get(nid)!;
        if (canNodeAcceptChar(nb, targetChar)) {
          used.add(nid);
          dfs(nid, currentDist + 1);
          used.delete(nid);
        }
      }
    };
    dfs(startId, 0);
    return Array.from(results);
  };

  const solveBottleneckSharing = async (): Promise<boolean> => {
    log("--- Phase: ボトルネック共有判定 ---");
    let changed = false;

    // nodeID -> { wordNumber -> Set<candidateChars> }
    const nodeToMandatoryWords: Map<string, Map<number, Set<string>>> = new Map();

    for (const w of solverWords) {
      if (w.isUsed) continue;
      const fixedLen = getFixedLength(w);
      if (fixedLen === 0 || fixedLen === w.length) continue;

      const startNodeId = w.fixedNodeIDs[fixedLen]!;
      const remainingText = w.text.slice(fixedLen);
      const usedInWord = getUsedNodes(w, fixedLen);

      const paths: string[][] = [];
      const MAX_PATHS = 500;
      let overflow = false;

      const findPaths = (currId: string, charIdx: number, currentPath: string[]) => {
        if (overflow) return;
        if (charIdx === remainingText.length) {
          paths.push([...currentPath]);
          if (paths.length >= MAX_PATHS) overflow = true;
          return;
        }

        const node = nodeMap.get(currId)!;
        for (const neighborId of node.neighbors) {
          if (usedInWord.has(neighborId)) continue;
          const neighborNode = nodeMap.get(neighborId)!;
          const targetChar = remainingText[charIdx];

          if (!canNodeAcceptChar(neighborNode, targetChar)) continue;

          usedInWord.add(neighborId);
          currentPath.push(neighborId);
          findPaths(neighborId, charIdx + 1, currentPath);
          currentPath.pop();
          usedInWord.delete(neighborId);
        }
      };

      findPaths(startNodeId, 0, []);

      if (paths.length === 0) continue;
      if (overflow) {
        log(`単語 [${w.logiNumber}] の可能経路が多すぎるためボトルネック解析をスキップします`);
        continue;
      }

      const bottleneckNodes = new Set(paths[0]);
      for (let i = 1; i < paths.length; i++) {
        const pathSet = new Set(paths[i]);
        for (const nid of bottleneckNodes) {
          if (!pathSet.has(nid)) bottleneckNodes.delete(nid);
        }
      }

      for (const nid of bottleneckNodes) {
        const charSet = new Set<string>();
        for (const path of paths) {
          const idx = path.indexOf(nid);
          charSet.add(remainingText[idx]);
        }

        if (!nodeToMandatoryWords.has(nid)) {
          nodeToMandatoryWords.set(nid, new Map());
        }
        nodeToMandatoryWords.get(nid)!.set(w.logiNumber, charSet);
      }
    }

    for (const [nodeId, wordMaps] of nodeToMandatoryWords.entries()) {
      const node = nodeMap.get(nodeId)!;
      if (node.isFixed) continue;

      const sets = Array.from(wordMaps.values());
      if (sets.length === 0) continue;

      const intersection = new Set(sets[0]);
      for (let i = 1; i < sets.length; i++) {
        for (const c of Array.from(intersection)) {
          if (!sets[i].has(c)) intersection.delete(c);
        }
      }

      if (intersection.size === 1) {
        const fixedChar = Array.from(intersection)[0];
        log(`ノード ${getExcelCoords(node)} は複数の単語の必須通過点であり、共通文字 '${fixedChar}' で確定しました`);
        fixNode(node, fixedChar);
        await reportStep();
        changed = true;
      }
    }
    return changed;
  };

  /**
   * 超モード用の地理的数字確定ロジック
   * 番号の読書順（左上から右下）ルールに基づき、網掛けの下の数字を特定する
   */
  const solveChoNumberPlacement = async (): Promise<boolean> => {
    if (!isChoMode) return false;
    log("--- Phase: 超問題・地理的数字特定 ---");
    let changed = false;

    // 1. 全マスのうち、数字が入る可能性があるマスをスキャン順にリストアップ
    const candidateNodes: SolverNode[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const id = `${x},${y}`;
        const node = nodeMap.get(id);
        if (!node) continue;

        const cell = cells[y][x];
        if ((cell.number !== null && !cell.isShaded) || cell.isShaded) {
          candidateNodes.push(node);
        }
      }
    }

    // 2. 確定している数字の「隙間」を解析
    const allWordNumbers = Object.keys(wordList).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    if (allWordNumbers.length === 0) return false;

    const posToNumber = new Array(candidateNodes.length).fill(null);
    candidateNodes.forEach((node, idx) => {
      if (node.logiNumber !== null) {
        posToNumber[idx] = node.logiNumber;
      }
    });

    let lastFoundIdx = -1;
    let lastFoundNum = 0;

    for (let i = 0; i <= candidateNodes.length; i++) {
      const isEnd = i === candidateNodes.length;
      const currentNum = isEnd ? allWordNumbers[allWordNumbers.length - 1] + 1 : posToNumber[i];

      if (currentNum !== null) {
        const gapSize = i - lastFoundIdx - 1;
        const missingNumsCount = currentNum - lastFoundNum - 1;

        if (gapSize > 0 && missingNumsCount > 0) {
          if (gapSize === missingNumsCount) {
            for (let k = 1; k <= gapSize; k++) {
              const targetNode = candidateNodes[lastFoundIdx + k];
              const targetNum = lastFoundNum + k;
              if (targetNode.logiNumber === null) {
                log(`[番号位置推論] ${targetNum}番は ${getExcelCoords(targetNode)} に入ると推論しました（連続番号の隙間の数とマスの数が一致）`);
                targetNode.logiNumber = targetNum;
                const word = solverWords.find(sw => sw.logiNumber === targetNum);
                if (word) {
                  word.fixedNodeIDs[1] = targetNode.id;
                  if (!targetNode.currentChar) {
                    targetNode.currentChar = word.text[0];
                    targetNode.isFixed = true;
                  }
                }
                changed = true;
              }
            }
          }
        }
        lastFoundIdx = i;
        lastFoundNum = currentNum;
      }
    }

    if (changed) await reportStep();
    return changed;
  };

  const getAllowedStartNodes = (): Map<number, SolverNode[]> => {
    const allowedStartNodesForWord = new Map<number, SolverNode[]>();
    if (!isChoMode && !isIrregularMode) return allowedStartNodesForWord;

    const scanNodes: SolverNode[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        const isScanTarget = isChoMode 
          ? ((cell.number !== null && !cell.isShaded) || cell.isShaded)
          : (cell.type === 'normal');
        
        if (isScanTarget) {
          const node = nodeMap.get(`${x},${y}`);
          if (node) scanNodes.push(node);
        }
      }
    }

    const allWordNumbers = Object.keys(wordList).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    if (allWordNumbers.length === 0) return allowedStartNodesForWord;

    interface Anchor { scanIdx: number; num: number; }
    const anchors: Anchor[] = [];
    anchors.push({ scanIdx: -1, num: allWordNumbers[0] - 1 });

    for (let i = 0; i < scanNodes.length; i++) {
      if (scanNodes[i].logiNumber !== null) {
        anchors.push({ scanIdx: i, num: scanNodes[i].logiNumber! });
      }
    }
    anchors.push({ scanIdx: scanNodes.length, num: allWordNumbers[allWordNumbers.length - 1] + 1 });

    for (const w of solverWords) {
      if (w.fixedNodeIDs[1] === null) {
        allowedStartNodesForWord.set(w.logiNumber, []);
      }
    }

    for (let i = 0; i < anchors.length - 1; i++) {
      const a1 = anchors[i];
      const a2 = anchors[i+1];

      const M = a2.scanIdx - a1.scanIdx - 1;
      const N = a2.num - a1.num - 1;

      if (N <= 0 || M < N) continue;

      const S = M - N;

      for (let k = 1; k <= N; k++) {
        const targetNum = a1.num + k;
        if (allowedStartNodesForWord.has(targetNum)) {
          const allowedNodes = allowedStartNodesForWord.get(targetNum)!;
          for (let offset = 0; offset <= S; offset++) {
            const nodeIdx = a1.scanIdx + 1 + (k - 1) + offset;
            if (nodeIdx >= 0 && nodeIdx < scanNodes.length) {
              const node = scanNodes[nodeIdx];
              if (node.logiNumber === null) {
                allowedNodes.push(node);
              }
            }
          }
        }
      }
    }
    return allowedStartNodesForWord;
  };

  /**
   * 超モード用：共有化シミュレーションによる網掛け開始位置の特定
   */
  const solveChoNumberBySharing = async (): Promise<boolean> => {
    if (!isChoMode) return false;
    let changed = false;

    // 1. 未確定の単語
    const targetWords = solverWords.filter(w => w.fixedNodeIDs[1] === null);
    if (targetWords.length === 0) return false;

    const allowedStartNodesForWord = getAllowedStartNodes();

    for (const w of targetWords) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      const validStartNodes: { startId: string, sharedPosMap: Map<number, Set<string>> }[] = [];
      const allowedCandidates = allowedStartNodesForWord.get(w.logiNumber) || [];
      if (allowedCandidates.length === 0) continue;

      for (const startNode of allowedCandidates) {
        if (checkCancelled && checkCancelled()) {
          throw new Error("cancelled");
        }
        let hasValidPath = false;
        const sharedPosMap = new Map<number, Set<string>>();
        const currentPath: { nid: string, char: string, isShared: boolean, charIdx: number }[] = [];
        const used = new Set<string>();

        let dfsCalls = 0;
        let dfsOverflow = false;

        const dfs = (currId: string, charIdx: number) => {
          if (dfsOverflow) return;
          dfsCalls++;
          if (dfsCalls > 500) {
            dfsOverflow = true;
            return;
          }

          if (charIdx === w.length) {
            const sharedPoints = currentPath.filter(p => p.isShared);
            if (sharedPoints.length > 0) {
              hasValidPath = true;
              for (const p of sharedPoints) {
                if (!sharedPosMap.has(p.charIdx)) sharedPosMap.set(p.charIdx, new Set());
                sharedPosMap.get(p.charIdx)!.add(p.nid);
              }
            }
            return;
          }

          const currNode = nodeMap.get(currId)!;
          const targetChar = w.text[charIdx];

          for (const nid of currNode.neighbors) {
            if (used.has(nid)) continue;
            const nb = nodeMap.get(nid)!;

            if (!canNodeAcceptChar(nb, targetChar)) continue;

            let isShared = false;
            if (nb.isFixed && nb.currentChar === targetChar) {
              isShared = true;
            } else if (!nb.isFixed) {
              const charMap = nodeCharUsage.get(nid);
              if (charMap && charMap.has(targetChar)) {
                const otherWords = Array.from(charMap.get(targetChar)!).filter(num => num !== w.logiNumber);
                const hasFixedStartWord = otherWords.some(num => {
                  const otherW = solverWords.find(sw => sw.logiNumber === num);
                  return otherW && otherW.fixedNodeIDs[1] !== null;
                });
                if (hasFixedStartWord) isShared = true;
              }
            }

            used.add(nid);
            currentPath.push({ nid, char: targetChar, isShared, charIdx });
            dfs(nid, charIdx + 1);
            currentPath.pop();
            used.delete(nid);
          }
        };

        let isStartShared = false;
        if (startNode.isFixed && startNode.currentChar === w.text[0]) {
          isStartShared = true;
        } else if (!startNode.isFixed) {
          const charMap = nodeCharUsage.get(startNode.id);
          if (charMap && charMap.has(w.text[0])) {
            const otherWords = Array.from(charMap.get(w.text[0])!).filter(num => num !== w.logiNumber);
            const hasFixedStartWord = otherWords.some(num => {
              const otherW = solverWords.find(sw => sw.logiNumber === num);
              return otherW && otherW.fixedNodeIDs[1] !== null;
            });
            if (hasFixedStartWord) isStartShared = true;
          }
        }

        used.add(startNode.id);
        currentPath.push({ nid: startNode.id, char: w.text[0], isShared: isStartShared, charIdx: 0 });
        dfs(startNode.id, 1);
        used.delete(startNode.id);

        if (hasValidPath) {
          validStartNodes.push({ startId: startNode.id, sharedPosMap });
        }
        
        // UIスレッドを解放してキャンセルイベント等を受け取れるようにする
        incrementProgress();
        await new Promise(r => setTimeout(r, 0));
      }

      // 条件A: 共有化が成立する候補マスが1つだけ
      if (validStartNodes.length === 1) {
        const { startId, sharedPosMap } = validStartNodes[0];

        // 条件B: 共有文字の入るマスが1つに限定されているか
        let uniqueSharedTargetId: string | null = null;
        let uniqueSharedCharIdx: number = -1;

        for (const [charIdx, targetIds] of sharedPosMap.entries()) {
          if (targetIds.size === 1) {
            uniqueSharedTargetId = Array.from(targetIds)[0];
            uniqueSharedCharIdx = charIdx;
            break;
          }
        }

        if (uniqueSharedTargetId !== null) {
          const startNode = nodeMap.get(startId)!;
          const sharedNode = nodeMap.get(uniqueSharedTargetId)!;
          
          log(`[共有化開始位置推論] 単語 [${w.logiNumber}] の開始位置を ${getExcelCoords(startNode)} と特定 (共有文字 '${w.text[uniqueSharedCharIdx]}' @ ${getExcelCoords(sharedNode)})`);
          
          startNode.logiNumber = w.logiNumber;
          w.fixedNodeIDs[1] = startId;
          if (!startNode.currentChar) {
            fixNode(startNode, w.text[0]);
          }

          if (!sharedNode.isFixed) {
            fixNode(sharedNode, w.text[uniqueSharedCharIdx]);
          }
          
          changed = true;
          break; // 他の単語に影響を与えるため一度ブレイクして再計算
        }
      }
    }

    if (changed) await reportStep();
    return changed;
  };

  /**
   * 変則モード用推論 1: 共有マスから一意な文字を確定させる
   */
  const solveIrregularSharedChars = async (): Promise<boolean> => {
    if (!isIrregularMode) return false;
    let changed = false;

    for (const [nid, wordNums] of Object.entries(sharedCells)) {
      const node = nodeMap.get(nid);
      if (!node || node.isFixed) continue;

      let commonChars: Set<string> | null = null;
      for (const num of wordNums) {
        const word = solverWords.find(sw => sw.logiNumber === num);
        if (!word || word.text === "") continue;

        const chars = new Set(word.text.split(""));
        if (commonChars === null) {
          commonChars = chars;
        } else {
          for (const c of Array.from(commonChars)) {
            if (!chars.has(c)) {
              commonChars.delete(c);
            }
          }
        }
      }

      if (commonChars && commonChars.size === 1) {
        const char = Array.from(commonChars)[0];
        log(`[変則文字確定] 変則数字マス ${getExcelCoords(node)} (${wordNums.join('・')}) は共通文字 '${char}' で確定しました`);
        fixNode(node, char);
        await reportStep();
        changed = true;
      }
    }

    return changed;
  };

  /**
   * 変則モード用推論 2: 候補位置から開始位置（1文字目）を特定する
   */
  const solveIrregularStartsByDistance = async (): Promise<boolean> => {
    if (!isIrregularMode) return false;
    let changed = false;

    const targetWords = solverWords.filter(w => !w.isUsed && w.fixedNodeIDs[1] === null);
    if (targetWords.length === 0) return false;

    for (const w of targetWords) {
      const cands = wordCharCandidates.get(w.logiNumber);
      if (!cands) continue;

      const startCands = cands.get(0);
      if (startCands && startCands.size === 1) {
        const startId = Array.from(startCands)[0];
        const startNode = nodeMap.get(startId)!;
        
        log(`[変則開始位置特定] 単語 [${w.logiNumber}] "${w.text}" の開始位置を唯一の候補 ${getExcelCoords(startNode)} と特定しました`);
        
        startNode.logiNumber = w.logiNumber;
        w.fixedNodeIDs[1] = startId;
        if (!startNode.currentChar && w.text !== "") {
          fixNode(startNode, w.text[0]);
        }
        
        await reportStep();
        changed = true;
        break;
      }
    }

    return changed;
  };

  /**
   * 変則モード用推論 3: 確定している開始マスの「隙間」から番号を地理的特定する
   */
  const solveIrregularNumberPlacement = async (): Promise<boolean> => {
    if (!isIrregularMode) return false;
    let changed = false;

    const candidateNodes: SolverNode[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const node = nodeMap.get(`${x},${y}`);
        if (node) candidateNodes.push(node);
      }
    }

    const allWordNumbers = Object.keys(wordList).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    if (allWordNumbers.length === 0) return false;

    const posToNumber = new Array(candidateNodes.length).fill(null);
    candidateNodes.forEach((node, idx) => {
      if (node.logiNumber !== null) {
        posToNumber[idx] = node.logiNumber;
      }
    });

    let lastFoundIdx = -1;
    let lastFoundNum = 0;

    for (let i = 0; i <= candidateNodes.length; i++) {
      const isEnd = i === candidateNodes.length;
      const currentNum = isEnd ? allWordNumbers[allWordNumbers.length - 1] + 1 : posToNumber[i];

      if (currentNum !== null) {
        const gapSize = i - lastFoundIdx - 1;
        const missingNumsCount = currentNum - lastFoundNum - 1;

        if (gapSize > 0 && missingNumsCount > 0) {
          if (gapSize === missingNumsCount) {
            for (let k = 1; k <= gapSize; k++) {
              const targetNode = candidateNodes[lastFoundIdx + k];
              const targetNum = lastFoundNum + k;
              if (targetNode.logiNumber === null) {
                log(`[変則番号位置推論] ${targetNum}番は ${getExcelCoords(targetNode)} に入ると推論しました（連続番号の隙間の数とマスの数が一致）`);
                targetNode.logiNumber = targetNum;
                const word = solverWords.find(sw => sw.logiNumber === targetNum);
                if (word) {
                  word.fixedNodeIDs[1] = targetNode.id;
                  if (!targetNode.currentChar) {
                    fixNode(targetNode, word.text[0]);
                  }
                }
                changed = true;
              }
            }
          }
        }
        lastFoundIdx = i;
        lastFoundNum = currentNum;
      }
    }

    if (changed) await reportStep();
    return changed;
  };

  // --- バックトラッキング用 状態管理と探索 ---
  interface Snapshot {
    nodes: {
      id: string;
      logiNumber: number | null;
      currentChar: string;
      isFixed: boolean;
      reservedBy: number[];
      reservedChars: string[];
      candidates: string[];
    }[];
    words: {
      logiNumber: number;
      isUsed: boolean;
      fixedNodeIDs: (string | null)[];
    }[];
  }

  const createSnapshot = (): Snapshot => {
    return {
      nodes: Array.from(nodeMap.values()).map(n => ({
        id: n.id,
        logiNumber: n.logiNumber,
        currentChar: n.currentChar,
        isFixed: n.isFixed,
        reservedBy: Array.from(n.reservedBy),
        reservedChars: Array.from(n.reservedChars),
        candidates: Array.from(n.candidates)
      })),
      words: solverWords.map(w => ({
        logiNumber: w.logiNumber,
        isUsed: w.isUsed,
        fixedNodeIDs: [...w.fixedNodeIDs]
      }))
    };
  };

  const restoreSnapshot = (snap: Snapshot) => {
    for (const sn of snap.nodes) {
      const node = nodeMap.get(sn.id)!;
      node.logiNumber = sn.logiNumber;
      node.currentChar = sn.currentChar;
      node.isFixed = sn.isFixed;
      node.reservedBy = new Set(sn.reservedBy);
      node.reservedChars = new Set(sn.reservedChars);
      node.candidates = new Set(sn.candidates);
    }
    for (const sw of snap.words) {
      const word = solverWords.find(w => w.logiNumber === sw.logiNumber)!;
      word.isUsed = sw.isUsed;
      word.fixedNodeIDs = [...sw.fixedNodeIDs];
    }
  };

  const getAllValidPathsForBacktrack = (w: SolverWord, startNodesOverride?: SolverNode[]): {nid: string, char: string}[][] => {
    const fixedLen = getFixedLength(w);
    const paths: { nid: string, char: string }[][] = [];

    if (fixedLen > 0) {
      const startId = w.fixedNodeIDs[fixedLen]!;
      const used = getUsedNodes(w, fixedLen);
      const currentPath: { nid: string, char: string }[] = [];

      let dfsCalls = 0;
      let overflow = false;

      const dfs = (currId: string, charIdx: number) => {
        if (overflow) return;
        dfsCalls++;
        if (dfsCalls > 5000) {
          overflow = true;
          return;
        }

        if (charIdx === w.length) {
          paths.push([...currentPath]);
          return;
        }
        const currNode = nodeMap.get(currId)!;
        const targetChar = w.text[charIdx];
        const nextFixedId = w.fixedNodeIDs[charIdx + 1];

        for (const nid of currNode.neighbors) {
          if (used.has(nid)) continue;
          if (nextFixedId && nid !== nextFixedId) continue;
          const nb = nodeMap.get(nid)!;
          if (canNodeAcceptChar(nb, targetChar)) {
            used.add(nid);
            currentPath.push({ nid, char: targetChar });
            dfs(nid, charIdx + 1);
            currentPath.pop();
            used.delete(nid);
          }
        }
      };
      dfs(startId, fixedLen);
    } else {
      if (!startNodesOverride) return [];
      for (const startNode of startNodesOverride) {
        if (startNode.isFixed && startNode.currentChar !== w.text[0]) continue;
        
        const used = new Set<string>();
        const currentPath: { nid: string, char: string }[] = [];
        
        let dfsCalls = 0;
        let overflow = false;

        const dfs = (currId: string, charIdx: number) => {
          if (overflow) return;
          dfsCalls++;
          if (dfsCalls > 5000) {
            overflow = true;
            return;
          }

          if (charIdx === w.length) {
            paths.push([...currentPath]);
            return;
          }
          const currNode = nodeMap.get(currId)!;
          const targetChar = w.text[charIdx];
          const nextFixedId = w.fixedNodeIDs[charIdx + 1];
          
          for (const nid of currNode.neighbors) {
            if (used.has(nid)) continue;
            if (nextFixedId && nid !== nextFixedId) continue;
            const nb = nodeMap.get(nid)!;
            if (canNodeAcceptChar(nb, targetChar)) {
              used.add(nid);
              currentPath.push({ nid, char: targetChar });
              dfs(nid, charIdx + 1);
              currentPath.pop();
              used.delete(nid);
            }
          }
        };
        
        used.add(startNode.id);
        currentPath.push({ nid: startNode.id, char: w.text[0] });
        dfs(startNode.id, 1);
      }
    }
    return paths;
  };

  const calculateSharingScore = (wNum: number, paths: {nid: string, char: string}[][]): number => {
    let score = paths.length * 1000;
    let bestPathSharingBonus = 0;
    for (const path of paths) {
      let pathBonus = 0;
      for (const step of path) {
        const charMap = nodeCharUsage.get(step.nid);
        if (charMap && charMap.has(step.char)) {
          const otherWords = Array.from(charMap.get(step.char)!).filter(num => num !== wNum);
          if (otherWords.length > 0) {
            pathBonus += 100 / otherWords.length;
          }
        }
      }
      if (pathBonus > bestPathSharingBonus) bestPathSharingBonus = pathBonus;
    }
    return score - bestPathSharingBonus;
  };

  interface GroupPattern {
    assignments: Map<number, { nid: string, char: string }[]>; // wordLogiNumber -> path
  }

  const findGroupPatterns = async (
    groupWordNums: number[],
    wordPaths: Map<number, {nid: string, char: string}[][]>,
    starContext?: {
      unassignedStarLogiNums: Set<number>;
      unusedList2Words: string[];
    },
    checkCancelled?: () => boolean
  ): Promise<GroupPattern[]> => {
    const patterns: GroupPattern[] = [];
    const nWords = groupWordNums.length;

    let iterations = 0;
    const maxLocalIterations = 1000000;

    const backtrackGroup = async (wIdx: number, currentAssignments: Map<number, number>) => {
      iterations++;
      if (iterations > maxLocalIterations) {
        throw new Error("local_limit_exceeded");
      }

      if (iterations % 100 === 0) {
        if (checkCancelled && checkCancelled()) {
          throw new Error("cancelled");
        }
        incrementProgress();
        await new Promise(r => setTimeout(r, 0));
      }

      if (wIdx === nWords) {
        const finalAssignments = new Map<number, { nid: string, char: string }[]>();
        for (const [wn, pi] of currentAssignments.entries()) {
          finalAssignments.set(wn, wordPaths.get(wn)![pi]);
        }
        patterns.push({
          assignments: finalAssignments
        });
        if (patterns.length > 20000) {
          throw new Error("too_many_patterns");
        }
        return;
      }

      const wNum = groupWordNums[wIdx];
      const paths = wordPaths.get(wNum)!;

      for (let pIdx = 0; pIdx < paths.length; pIdx++) {
        await checkYield();
        const path = paths[pIdx];

        // 重複単語使用チェック
        const isStar = starContext && starContext.unassignedStarLogiNums.has(wNum);
        if (isStar) {
          const wordText = path.map(step => step.char).join("");
          let isDuplicate = false;
          for (const [otherWNum, otherPIdx] of currentAssignments.entries()) {
            if (starContext && starContext.unassignedStarLogiNums.has(otherWNum)) {
              const otherPath = wordPaths.get(otherWNum)![otherPIdx];
              const otherWordText = otherPath.map(step => step.char).join("");
              if (otherWordText === wordText) {
                isDuplicate = true;
                break;
              }
            }
          }
          if (isDuplicate) continue;
        }

        let canPlace = true;

        for (const step of path) {
          const node = nodeMap.get(step.nid)!;
          if (node.isFixed && node.currentChar !== step.char) {
            canPlace = false;
            break;
          }
        }

        if (!canPlace) continue;

        const snap = createSnapshot();
        const word = solverWords.find(sw => sw.logiNumber === wNum)!;
        const fixedLen = isStar ? 0 : getFixedLength(word);

        for (let i = 0; i < path.length; i++) {
          const step = path[i];
          const node = nodeMap.get(step.nid)!;
          fixNode(node, step.char);
          word.fixedNodeIDs[fixedLen + i + 1] = step.nid;
          if (fixedLen === 0 && i === 0) {
            node.logiNumber = wNum;
          }
        }
        word.isUsed = true;
        currentAssignments.set(wNum, pIdx);

        await backtrackGroup(wIdx + 1, currentAssignments);

        currentAssignments.delete(wNum);
        restoreSnapshot(snap);
      }
    };

    const initialSnap = createSnapshot();
    await backtrackGroup(0, new Map());
    restoreSnapshot(initialSnap);
    return patterns;
  };

  const solveWithGroups = async (
    starContext?: {
      unassignedStarLogiNums: Set<number>;
      unusedList2Words: string[];
    }
  ): Promise<boolean> => {
    let groupPatternsList: GroupPattern[][] = [];

    while (true) {
      const remainingWords = solverWords.filter(w => !w.isUsed);
      if (remainingWords.length === 0) {
        if (findAlternative && firstSolutionCells) {
          const { isDifferent } = checkIsDifferent();
          return isDifferent;
        }
        return true;
      }

      log(`[GroupSolve] グループ総当たりを開始します... (対象単語数: ${remainingWords.length})`);
    
    const allowedStarts = getAllowedStartNodes();
    const wordPaths = new Map<number, {nid: string, char: string}[][]>();
    for (const w of remainingWords) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      incrementProgress();
      await new Promise(r => setTimeout(r, 0));
      
      const isStar = starContext && starContext.unassignedStarLogiNums.has(w.logiNumber);
      let paths: {nid: string, char: string}[][] = [];
      if (isStar) {
        const origText = w.text;
        const origLength = w.length;
        const origFixedNodeIDs = [...w.fixedNodeIDs];
        
        for (const wordText of starContext.unusedList2Words) {
          w.text = wordText;
          w.length = wordText.length;
          w.fixedNodeIDs = new Array(wordText.length + 1).fill(null);
          
          let subPaths: {nid: string, char: string}[][] = [];
          const startNodeId = origFixedNodeIDs[1];
          const overrideNodes: SolverNode[] = [];
          if (startNodeId) {
            const sn = nodeMap.get(startNodeId);
            if (sn) {
              overrideNodes.push(sn);
            }
          }
          subPaths = getAllValidPathsForBacktrack(w, overrideNodes);
          paths.push(...subPaths);
        }
        
        // 復元
        w.text = origText;
        w.length = origLength;
        w.fixedNodeIDs = origFixedNodeIDs;
      } else {
        const fixedLen = getFixedLength(w);
        if (fixedLen === 0) {
          const overrideNodes = allowedStarts.get(w.logiNumber) || [];
          paths = getAllValidPathsForBacktrack(w, overrideNodes);
        } else {
          paths = getAllValidPathsForBacktrack(w);
        }
      }

      if (paths.length === 0) {
        log(`[GroupSolve] 単語 [${w.logiNumber}] の可能経路がありません。矛盾です。`);
        return false;
      }
      wordPaths.set(w.logiNumber, paths);
    }

    // グラフ接続関係の構築：同じマスかつ同じ文字（共有文字）で繋ぐ
    const adj: Map<number, Set<number>> = new Map();
    for (const w of remainingWords) {
      adj.set(w.logiNumber, new Set());
    }

    const nodeCharToWords: Map<string, number[]> = new Map();
    for (const w of remainingWords) {
      const paths = wordPaths.get(w.logiNumber)!;
      const keyUsed = new Set<string>();
      
      // 候補パスが通るマスと文字を追加
      for (const path of paths) {
        await checkYield();
        for (const step of path) {
          const key = `${step.nid}:${step.char}`;
          keyUsed.add(key);
        }
      }

      // 確定済みの接頭辞マスと文字も追加（確定文字との共有も考慮するため）
      const fixedLen = getFixedLength(w);
      for (let i = 1; i <= fixedLen; i++) {
        const nid = w.fixedNodeIDs[i];
        if (nid) {
          const char = w.text[i - 1];
          const key = `${nid}:${char}`;
          keyUsed.add(key);
        }
      }

      for (const key of keyUsed) {
        if (!nodeCharToWords.has(key)) {
          nodeCharToWords.set(key, []);
        }
        nodeCharToWords.get(key)!.push(w.logiNumber);
      }
    }

    for (const words of nodeCharToWords.values()) {
      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
          adj.get(words[i])!.add(words[j]);
          adj.get(words[j])!.add(words[i]);
        }
      }
    }

    const visitedWords = new Set<number>();
    const groups: number[][] = [];
    for (const w of remainingWords) {
      if (visitedWords.has(w.logiNumber)) continue;
      const group: number[] = [];
      const queue: number[] = [w.logiNumber];
      visitedWords.add(w.logiNumber);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        group.push(curr);
        for (const neighbor of adj.get(curr)!) {
          if (!visitedWords.has(neighbor)) {
            visitedWords.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      groups.push(group);
    }

    log(`[GroupSolve] グループ抽出完了。グループ数: ${groups.length}`);
    groups.forEach((g, idx) => {
      log(`[GroupSolve] グループ #${idx + 1}: 単語リスト [${g.join(", ")}]`);
    });

    groupPatternsList = [];

    const resolveGroupContradiction = async (group: number[]): Promise<GroupPattern[]> => {
      const N = group.length;
      if (N <= 1 || N > 12) return []; // 単語数12以下のグループのみ分割救済を試みる

      log(`[GroupSolve] グループの矛盾を検知しました。グループ分割による救済探索を開始します... (単語数: ${N})`);

      const subsetMemo = new Map<string, GroupPattern[]>();

      const getPats = async (subset: number[]): Promise<GroupPattern[]> => {
        const key = subset.slice().sort((a, b) => a - b).join(",");
        if (subsetMemo.has(key)) return subsetMemo.get(key)!;
        
        const pats = await findGroupPatterns(subset, wordPaths, starContext, checkCancelled);
        subsetMemo.set(key, pats);
        return pats;
      };

      for (let K = 2; K <= N; K++) {
        log(`[GroupSolve]  分割数 ${K} で検証中...`);
        let anyValidPartition = false;
        const allMergedPatterns: GroupPattern[] = [];
        const uniqueKeys = new Set<string>();
        
        for (const partition of getPartitions(group, K)) {
          await checkYield();
          let partitionValid = true;
          const partitionPatsList: GroupPattern[][] = [];

          for (const subset of partition) {
            const pats = await getPats(subset);
            if (pats.length === 0) {
              partitionValid = false;
              break;
            }
            partitionPatsList.push(pats);
          }

          if (partitionValid) {
            const combineSubsets = (idx: number, currentAssignments: Map<number, {nid: string, char: string}[]>, usedNidChars: Map<string, string>) => {
              if (idx === K) {
                const entries = Array.from(currentAssignments.entries()).sort((a, b) => a[0] - b[0]);
                let key = "";
                for (const [wNum, path] of entries) {
                  key += `${wNum}:`;
                  for (const step of path) key += `${step.nid},`;
                  key += "|";
                }
                if (!uniqueKeys.has(key)) {
                  uniqueKeys.add(key);
                  allMergedPatterns.push({ assignments: new Map(currentAssignments) });
                  anyValidPartition = true;
                }
                return;
              }

              const subsetPats = partitionPatsList[idx];
              for (const pat of subsetPats) {
                let overlap = false;
                const newlyUsed = new Map<string, string>();
                for (const path of pat.assignments.values()) {
                  for (const step of path) {
                    if (usedNidChars.has(step.nid)) {
                      if (usedNidChars.get(step.nid) !== step.char) {
                        overlap = true;
                        break;
                      }
                    }
                    newlyUsed.set(step.nid, step.char);
                  }
                  if (overlap) break;
                }
                
                if (!overlap) {
                  for (const [nid, char] of newlyUsed.entries()) usedNidChars.set(nid, char);
                  for (const [wNum, path] of pat.assignments.entries()) {
                    currentAssignments.set(wNum, path);
                  }
                  
                  combineSubsets(idx + 1, currentAssignments, usedNidChars);
                  
                  for (const nid of newlyUsed.keys()) usedNidChars.delete(nid);
                  for (const wNum of pat.assignments.keys()) {
                    currentAssignments.delete(wNum);
                  }
                }
              }
            };
            
            combineSubsets(0, new Map(), new Map());
          }
        }

        if (anyValidPartition && allMergedPatterns.length > 0) {
          log(`[GroupSolve]  分割数 ${K} で有効な配置パターンを発見しました！（救済成功、パターン数: ${allMergedPatterns.length}）`);
          return allMergedPatterns;
        }
      }

      return [];
    };

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const group = groups[gIdx];
      
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }

      log(`[GroupSolve] グループ #${gIdx + 1} のローカル総当たり中...`);
      group.forEach(wNum => {
        const paths = wordPaths.get(wNum) || [];
        log(`[GroupSolve]   単語 [${wNum}] の候補パス数: ${paths.length}`);
      });

      let pats = await findGroupPatterns(group, wordPaths, starContext, checkCancelled);
      if (pats.length === 0) {
        pats = await resolveGroupContradiction(group);
        if (pats.length === 0) {
          log(`[GroupSolve] グループ #${gIdx + 1} に有効な配置パターンがありません。分割救済でも解決できませんでした。矛盾です。`);
          return false;
        }
      }
      log(`[GroupSolve] グループ #${gIdx + 1} パターン数: ${pats.length}`);
      groupPatternsList.push(pats);
    }

    // --- パターン数1 of グループ確定処理 ---
    const singlePatternGroups: { gIdx: number, pat: GroupPattern }[] = [];
    for (let i = 0; i < groupPatternsList.length; i++) {
      if (groupPatternsList[i].length === 1) {
        singlePatternGroups.push({ gIdx: i, pat: groupPatternsList[i][0] });
      }
    }

    if (singlePatternGroups.length > 0) {
      const groupsToApply: { pat: GroupPattern, starAss: Map<number, string> }[] = [];

      for (const { pat } of singlePatternGroups) {
        let groupValid = true;
        const starAss = new Map<number, string>();

        for (const [wNum, path] of pat.assignments.entries()) {
          const isStar = starContext && starContext.unassignedStarLogiNums.has(wNum);
          if (isStar) {
            const wordText = path.map(step => step.char).join("");
            starAss.set(wNum, wordText);
          }
        }

        if (groupValid) {
          groupsToApply.push({ pat, starAss });
        }
      }

      if (groupsToApply.length > 0) {
        let hasConflict = false;
        const tempUsedCells = new Map<string, string>();
        
        for (const { pat } of groupsToApply) {
          for (const path of pat.assignments.values()) {
            for (let i = 0; i < path.length; i++) {
              const step = path[i];
              const char = step.char;
              if (tempUsedCells.has(step.nid) && tempUsedCells.get(step.nid) !== char) {
                hasConflict = true;
                break;
              }
              const node = nodeMap.get(step.nid)!;
              if (node.isFixed && node.currentChar !== char) {
                hasConflict = true;
                break;
              }
              tempUsedCells.set(step.nid, char);
            }
            if (hasConflict) break;
          }
          if (hasConflict) break;
        }

        if (hasConflict) {
          log(`[GroupSolve] パターン数1のグループ同士、または既定 of 文字と衝突が発生しました。`);
          return false; // 矛盾
        }

        let appliedAny = false;
        for (const { pat, starAss } of groupsToApply) {
          for (const [wNum, path] of pat.assignments.entries()) {
            const word = solverWords.find(sw => sw.logiNumber === wNum)!;
            
            let isStarApplied = false;
            if (starAss.has(wNum)) {
              const matchedWord = starAss.get(wNum)!;
              word.text = matchedWord;
              word.length = matchedWord.length;
              word.fixedNodeIDs = new Array(matchedWord.length + 1).fill(null);
              
              if (starContext) {
                starContext.unusedList2Words = starContext.unusedList2Words.filter(w => w !== matchedWord);
                starContext.unassignedStarLogiNums.delete(wNum);
              }
              log(`[GroupSolve] ★単語 [${wNum}] の割り当てを「${matchedWord}」に確定しました。`);
              isStarApplied = true;
            }

            const fixedLen = isStarApplied ? 0 : getFixedLength(word);
            for (let i = 0; i < path.length; i++) {
              const step = path[i];
              const node = nodeMap.get(step.nid)!;
              const correctChar = word.text[fixedLen + i];
              fixNode(node, correctChar);
              word.fixedNodeIDs[fixedLen + i + 1] = step.nid;
              if (fixedLen === 0 && i === 0) {
                node.logiNumber = wNum;
              }
            }
            word.isUsed = true;
            appliedAny = true;
            log(`[GroupSolve] グループの唯一のパターンを確定適用しました: 単語 [${wNum}] ("${word.text}")`);
          }
        }

        if (appliedAny) {
          await reportStep();
          log(`[GroupSolve] パターン数1のグループ確定を適用したため、再度グループ洗い出しをやり直します。`);
          continue; // while(true) の先頭へ戻ってやり直す
        }
      }
    }

    break; // while(true) ループを抜けて制約伝播へ
  }

    // --- 制約伝播 (Constraint Propagation) ---
    let propagationChanged = true;
    let propIterations = 0;
    // nid -> { char, gIdx }
    const invariantFixedNodes = new Map<string, { char: string, gIdx: number }>();

    log(`[GroupSolve] パターンの制約伝播（不変文字の抽出と固定化）を開始します...`);

    while (propagationChanged) {
      propagationChanged = false;
      propIterations++;
      await checkYield();

      // 1. 各グループから不変ノードを抽出
      for (let gIdx = 0; gIdx < groupPatternsList.length; gIdx++) {
        const pats = groupPatternsList[gIdx];
        if (pats.length === 0) continue;

        const basePat = pats[0];
        const candInvariants = new Map<string, string>();
        
        for (const path of basePat.assignments.values()) {
          for (const step of path) {
            candInvariants.set(step.nid, step.char);
          }
        }

        for (let i = 1; i < pats.length; i++) {
          if (candInvariants.size === 0) break;
          const p = pats[i];
          const usedNids = new Set<string>();
          
          for (const path of p.assignments.values()) {
            for (const step of path) {
              if (candInvariants.has(step.nid)) {
                usedNids.add(step.nid);
                if (candInvariants.get(step.nid) !== step.char) {
                  candInvariants.delete(step.nid);
                }
              }
            }
          }
          
          for (const nid of Array.from(candInvariants.keys())) {
            if (!usedNids.has(nid)) {
              candInvariants.delete(nid);
            }
          }
        }

        for (const [nid, char] of candInvariants.entries()) {
          if (!invariantFixedNodes.has(nid)) {
            invariantFixedNodes.set(nid, { char, gIdx });
            propagationChanged = true;

            // --- ユーザーの要望により、制約伝播で確定した不変文字を盤面にリアルタイム描画する ---
            const node = nodeMap.get(nid);
            if (node && !node.isFixed) {
              cells[node.y][node.x].answerChar = char;
            }
          } else {
            const existing = invariantFixedNodes.get(nid)!;
            if (existing.char !== char) {
              log(`[GroupSolve] 不変ノードのマス衝突を検出しました（ノード ${nid}）。矛盾です。`);
              return false;
            }
          }
        }
      }

      // 2. 新しい不変ノードを使って全グループのパターンをフィルタリング
      if (propagationChanged) {
        for (let gIdx = 0; gIdx < groupPatternsList.length; gIdx++) {
          const pats = groupPatternsList[gIdx];
          const validPats: GroupPattern[] = [];

          for (const pat of pats) {
            let isValid = true;
            for (const path of pat.assignments.values()) {
              for (const step of path) {
                if (invariantFixedNodes.has(step.nid)) {
                  const inv = invariantFixedNodes.get(step.nid)!;
                  if (inv.char !== step.char) {
                    isValid = false; 
                    break;
                  }
                }
              }
              if (!isValid) break;
            }
            if (isValid) {
              validPats.push(pat);
            }
          }

          if (validPats.length === 0) {
            log(`[GroupSolve] 制約伝播の結果、グループ #${gIdx + 1} の有効パターンが 0 になりました。矛盾です。`);
            return false;
          }
          if (validPats.length < pats.length) {
            groupPatternsList[gIdx] = validPats;
            propagationChanged = true;
          }
        }
      }
    }

    log(`[GroupSolve] 制約伝播が完了しました（ループ回数: ${propIterations}回）。不変ノード確定数: ${invariantFixedNodes.size}`);

    let totalSolutions = 1;
    for (let gIdx = 0; gIdx < groupPatternsList.length; gIdx++) {
      const pats = groupPatternsList[gIdx];
      totalSolutions *= pats.length;
      log(`[GroupSolve]   グループ #${gIdx + 1} 伝播後パターン数: ${pats.length}`);
    }

    log(`[GroupSolve] グローバル統合完了。最大組み合わせ数: ${totalSolutions}`);

    if (totalSolutions === 0) {
      return false;
    }

    let foundSolution = false;
    let foundAlt = false;
    const currentComb: GroupPattern[] = [];

    const searchComb = async (gIdx: number): Promise<boolean> => {
      if (gIdx === groupPatternsList.length) {
        const snap = createSnapshot();
        const ok = applyCombination(currentComb, starContext);
        if (!ok) {
          restoreSnapshot(snap);
          return false;
        }

        if (puzzle.isWList) {
          const wlistRes = validateWListAssignment();
          if (!wlistRes.success) {
            restoreSnapshot(snap);
            return false;
          }
        }
        
        if (findAlternative && firstSolutionCells) {
          const { isDifferent, diffDetails } = checkIsDifferent();

          if (isDifferent) {
            log(`[GroupSolve] 最初の解と異なる組み合わせを検出しました。不一致マス: ${diffDetails.slice(0, 5).join(', ')}${diffDetails.length > 5 ? ` など計${diffDetails.length}箇所` : ''}`);
            foundAlt = true;
            return true;
          }
          restoreSnapshot(snap);
          return false;
        } else {
          foundSolution = true;
          return true;
        }
      }

      const pats = groupPatternsList[gIdx];
      for (const pat of pats) {
        await checkYield();
        currentComb.push(pat);
        if (await searchComb(gIdx + 1)) return true;
        currentComb.pop();
      }
      return false;
    };

    await searchComb(0);

    if (findAlternative && firstSolutionCells) {
      if (foundAlt) {
        log("[GroupSolve] 別解を検出しました。");
        return true;
      } else {
        log("[GroupSolve] 別解は見つかりませんでした（唯一解です）。");
        return false;
      }
    } else {
      if (foundSolution) {
        log("[GroupSolve] 解答の適用に成功しました。");
        return true;
      } else {
        log("[GroupSolve] 有効なパターンの組み合わせが見つかりませんでした。");
        return false;
      }
    }
  };

  const applyCombination = (
    comb: GroupPattern[],
    starContext?: {
      unassignedStarLogiNums: Set<number>;
      unusedList2Words: string[];
    }
  ): boolean => {
    // グループ間でのマスの重複衝突を事前チェック
    const globalUsedCells = new Map<string, {char: string, gIdx: number}>();
    
    // グループ間でのリスト2単語の重複使用チェック
    const usedStarWords = new Set<string>();
    
    for (let gIdx = 0; gIdx < comb.length; gIdx++) {
      const pat = comb[gIdx];
      for (const [wNum, path] of pat.assignments.entries()) {
        const isStar = starContext && starContext.unassignedStarLogiNums.has(wNum);
        if (isStar) {
          const wordText = path.map(step => step.char).join("");
          if (usedStarWords.has(wordText)) return false;
          usedStarWords.add(wordText);
        }

        for (const step of path) {
          if (globalUsedCells.has(step.nid)) {
            const existing = globalUsedCells.get(step.nid)!;
            // 異なるグループであっても、同じ文字を置く場合は許容する
            if (existing.char !== step.char) return false;
          } else {
            globalUsedCells.set(step.nid, { char: step.char, gIdx });
          }
          
          const node = nodeMap.get(step.nid)!;
          if (node.isFixed && node.currentChar !== step.char) {
            return false; // すでに固定されている文字との不一致
          }
        }
      }
    }

    // 衝突がなければ実際に適用
    for (const pat of comb) {
      for (const [wNum, path] of pat.assignments.entries()) {
        const word = solverWords.find(sw => sw.logiNumber === wNum)!;
        
        const isStar = starContext && starContext.unassignedStarLogiNums.has(wNum);
        if (isStar) {
          const wordText = path.map(step => step.char).join("");
          word.text = wordText;
          word.length = wordText.length;
          word.fixedNodeIDs = new Array(wordText.length + 1).fill(null);
          
          for (let i = 0; i < path.length; i++) {
            const step = path[i];
            const node = nodeMap.get(step.nid)!;
            fixNode(node, step.char);
            word.fixedNodeIDs[i + 1] = step.nid;
          }
          
          const startNode = nodeMap.get(path[0].nid)!;
          startNode.logiNumber = wNum;
        } else {
          const fixedLen = getFixedLength(word);
          for (let i = 0; i < path.length; i++) {
            const step = path[i];
            const node = nodeMap.get(step.nid)!;
            fixNode(node, step.char);
            word.fixedNodeIDs[fixedLen + i + 1] = step.nid;
            if (fixedLen === 0 && i === 0) {
              node.logiNumber = wNum;
            }
          }
        }
        word.isUsed = true;
      }
    }
    return true;
  };

  const solveByBacktracking = async (): Promise<boolean> => {
    const remainingWords = solverWords.filter(w => !w.isUsed);
    if (remainingWords.length === 0) {
      if (findAlternative && firstSolutionCells) {
        const { isDifferent } = checkIsDifferent();
        return isDifferent;
      }
      return true;
    }

    await collectWordCandidates();

    const allowedStarts = getAllowedStartNodes();
    const wordPaths = new Map<number, {nid: string, char: string}[][]>();
    const wordScores = new Map<number, number>();

    for (const w of remainingWords) {
      if (checkCancelled && checkCancelled()) {
        throw new Error("cancelled");
      }
      incrementProgress();
      await new Promise(r => setTimeout(r, 0));

      const fixedLen = getFixedLength(w);
      let paths: {nid: string, char: string}[][] = [];

      if (fixedLen === 0) {
        const overrideNodes = allowedStarts.get(w.logiNumber) || [];
        if (overrideNodes.length === 0) {
          log(`[Backtrack] 単語 [${w.logiNumber}] の開始候補マスが見つからないため断念します。`);
          return false;
        }
        paths = getAllValidPathsForBacktrack(w, overrideNodes);
      } else {
        paths = getAllValidPathsForBacktrack(w);
      }
      
      if (paths.length === 0) {
        log(`[Backtrack] 単語 [${w.logiNumber}] の配置可能なパスが見つかりません。矛盾です。`);
        return false;
      }
      wordPaths.set(w.logiNumber, paths);
      wordScores.set(w.logiNumber, calculateSharingScore(w.logiNumber, paths));
    }

    const sortedWords = remainingWords.sort((a, b) => {
      return wordScores.get(a.logiNumber)! - wordScores.get(b.logiNumber)!;
    });

    log(`[Backtrack] 仮置き総当たり（バックトラッキング）を開始します... (対象単語数: ${sortedWords.length})`);
    
    log(`[Backtrack] --- バックトラック探索順データ一覧（スコア順） ---`);
    sortedWords.forEach((w, idx) => {
      const paths = wordPaths.get(w.logiNumber) || [];
      const score = wordScores.get(w.logiNumber) || 0;
      log(`[Backtrack] ${idx + 1}. 単語 [${w.logiNumber}] "${w.text}" (${w.length}文字) - 候補パス数: ${paths.length}, スコア: ${score}`);
    });
    log(`[Backtrack] ---------------------------------------------`);
    
    let iterations = 0;
    const maxIterations = 5000000;
    let shownLimitWarning = false;

    if (onBacktrackEnd) onBacktrackEnd();

    let isConfirmed = false;
    if (onConfirm) {
      isConfirmed = await onConfirm("総当たりをやります。時間がかかりますが、イイですか？");
    } else {
      isConfirmed = window.confirm("総当たりをやります。時間がかかりますが、イイですか？");
    }

    if (!isConfirmed) {
      log(`[Backtrack] キャンセルされました。`);
      return false;
    }

    if (onBacktrackStart) onBacktrackStart();

    const backtrack = async (wordIdx: number): Promise<boolean> => {
      iterations++;
      
      if (iterations > maxIterations) {
        log(`[Backtrack] [警告] 試行回数が上限（${maxIterations}回）に達したため、バックトラッキングを終了します。`);
        return false;
      }

      if (iterations % 100 === 0) {
        if (iterations % 5000 === 0) {
          log(`[Backtrack] 探索中... 現在 ${iterations} 回目の試行を行っています（現在の探索深度: ${wordIdx}/${sortedWords.length}）`);
        }
        if (checkCancelled && checkCancelled()) {
          log(`[Backtrack] キャンセルされました。`);
          throw new Error("cancelled");
        }
        incrementProgress();
        await new Promise(r => setTimeout(r, 0));
      }

      if (wordIdx === sortedWords.length) {
        if (puzzle.isWList) {
          const wlistRes = validateWListAssignment();
          if (!wlistRes.success) return false;
        }
        if (findAlternative && firstSolutionCells) {
          const { isDifferent, diffDetails } = checkIsDifferent();
          if (!isDifferent) {
            return false;
          } else {
            log(`[Backtrack] 最初の解と異なる組み合わせを検出しました。不一致マス: ${diffDetails.slice(0, 5).join(', ')}${diffDetails.length > 5 ? ` など計${diffDetails.length}箇所` : ''}`);
            return true;
          }
        }
        return true;
      }

      const w = sortedWords[wordIdx];
      const paths = wordPaths.get(w.logiNumber)!;

      for (let pIdx = 0; pIdx < paths.length; pIdx++) {
        await checkYield();
        const path = paths[pIdx];
        let canPlace = true;
        const fixedLen = getFixedLength(w);
        const usedThisTime = new Set<string>();

        for (let i = 0; i < path.length; i++) {
          const step = path[i];
          const node = nodeMap.get(step.nid)!;
          if (node.isFixed && node.currentChar !== step.char) {
            canPlace = false;
            break;
          }
          if (usedThisTime.has(step.nid)) {
            canPlace = false;
            break;
          }
          usedThisTime.add(step.nid);
        }
        if (!canPlace) continue;

        if (iterations <= 500) {
          const pathCoords = path.map(step => {
            const node = nodeMap.get(step.nid)!;
            return `${step.char}(${getExcelCoords(node)})`;
          }).join("->");
          log(`[Backtrack] [試行 ${iterations}/深度 ${wordIdx}] 単語 [${w.logiNumber}] "${w.text}" をパス #${pIdx + 1} に仮置き: ${pathCoords}`);
        } else if (!shownLimitWarning) {
          shownLimitWarning = true;
          log(`[Backtrack] ※ 試行回数が 500 回を超えたため、フリーズ防止のためにこれ以降の詳細な仮置き・バックトラックログは省略します。`);
        }

        const snap = createSnapshot();

        for (let i = 0; i < path.length; i++) {
          const step = path[i];
          const node = nodeMap.get(step.nid)!;
          fixNode(node, step.char);
          w.fixedNodeIDs[fixedLen + i + 1] = step.nid;
          
          if (fixedLen === 0 && i === 0) {
            node.logiNumber = w.logiNumber;
          }
        }
        w.isUsed = true;

        if (await backtrack(wordIdx + 1)) return true;

        if (iterations <= 500) {
          log(`[Backtrack] [試行 ${iterations}/深度 ${wordIdx}] 単語 [${w.logiNumber}] "${w.text}" の仮置きを解除（戻る）`);
        }

        restoreSnapshot(snap);
      }

      return false;
    };

    const initialSnap = createSnapshot();
    const success = await backtrack(0);

    if (success) {
      if (findAlternative) {
        log(`[Backtrack] 別解を見つけました！ (試行回数: ${iterations})`);
      } else {
        log(`[Backtrack] バックトラッキングによる解答に成功しました！ (試行回数: ${iterations})`);
      }
      return true;
    } else {
      if (findAlternative) {
        log(`[Backtrack] 他に解は見つかりませんでした。(試行回数: ${iterations}) 唯一解です。元の状態に戻します。`);
      } else {
        log(`[Backtrack] 解答が見つかりませんでした。(試行回数: ${iterations}) 元の状態に戻します。`);
      }
      restoreSnapshot(initialSnap);
      return false;
    }
  };

  // メインループ: 論理確定と共有判定を繰り返す
  let totalChanged = true;
  while (totalChanged) {
    if (checkCancelled && checkCancelled()) {
      throw new Error("cancelled");
    }
    incrementProgress();
    await new Promise(r => setTimeout(r, 0));
    totalChanged = false;

    // 超モードの場合、数字の特定を試みる
    if (isChoMode) {
      if (await solveChoNumberPlacement()) {
        totalChanged = true;
        await collectWordCandidates();
        continue;
      }
      if (await solveChoNumberBySharing()) {
        totalChanged = true;
        await collectWordCandidates();
        continue;
      }
    }

    // 変則モードの場合、数字や共有文字の特定を試みる
    if (isIrregularMode) {
      if (await solveIrregularSharedChars()) {
        totalChanged = true;
        await collectWordCandidates();
        continue;
      }
      if (await solveIrregularStartsByDistance()) {
        totalChanged = true;
        await collectWordCandidates();
        continue;
      }
      if (await solveIrregularNumberPlacement()) {
        totalChanged = true;
        await collectWordCandidates();
        continue;
      }
    }

    // 候補情報の更新
    await collectWordCandidates();

    log("--- 論理推論フェーズ 開始 ---");
    let stable = false;
    while (!stable) {
      stable = true;
      if (await executeLogicalLoop()) {
        stable = false;
        await collectWordCandidates();
      }
    }

    log("--- 確定文字との共有化 (Type 1) 開始 ---");
    if (await solveFixedSharing()) {
      totalChanged = true;
      continue;
    }

    log("--- ボトルネック共有化 (Phase 3) 開始 ---");
    if (await solveBottleneckSharing()) {
      totalChanged = true;
      continue;
    }

    log("--- 未確定文字同士の共有化 (Type 2) 開始 ---");
    if (await solveDynamicSharing()) {
      totalChanged = true;
      continue;
    }

    log("--- Wリスト★単語割り当て 開始 ---");
    if (await solveWListStarAssignment()) {
      totalChanged = true;
      continue;
    }
  }

  let isBacktracked = false;
  let isAlternativeFound = false;
  let isUnique = false;

  // Wリスト★用の総当り割り当て探索ジェネレータ


  const runBacktrackWithPermutations = async (): Promise<boolean> => {
    const unassignedStars = solverWords.filter(w => puzzle.wordStarList?.[w.logiNumber] && w.text === "");
    const list2Words = (puzzle.wordList2 || []).filter(w => w.trim() !== '');
    const assignedWords = new Set(solverWords.map(sw => sw.text).filter(t => t !== ""));
    const unusedList2Words = list2Words.filter(w => !assignedWords.has(w));

    const starContext = {
      unassignedStarLogiNums: new Set(unassignedStars.map(sw => sw.logiNumber)),
      unusedList2Words: [...unusedList2Words]
    };

    log(`[Backtrack] 未割り当ての★番号が ${unassignedStars.length} 個あります。グループ総当たり（KGL）による同時論理確定を試みます。`);

    // 事前矛盾検知: テキスト確定済みの単語の可能経路が最初から0のものがあれば、探索を即座に中止する
    if (puzzle.isWListStar) {
      const allowedStarts = getAllowedStartNodes();
      for (const w of solverWords) {
        if (w.isUsed) continue;
        if (puzzle.wordStarList?.[w.logiNumber] && w.text === "") continue;

        const fixedLen = getFixedLength(w);
        let paths: {nid: string, char: string}[][] = [];
        if (fixedLen === 0) {
          const overrideNodes = allowedStarts.get(w.logiNumber) || [];
          paths = getAllValidPathsForBacktrack(w, overrideNodes);
        } else {
          paths = getAllValidPathsForBacktrack(w);
        }

        if (paths.length === 0) {
          log(`[Backtrack] [事前矛盾検知] 単語 [${w.logiNumber}] ("${w.text}") の配置可能なパスがありません。矛盾しているため探索を中止します。`);
          return false;
        }
      }
    }

    try {
      return await solveWithGroups(starContext);
    } catch (e: any) {
      if (e.message === "cancelled") throw e;
      let reason = e.message;
      if (e.message === "too_many_patterns") {
        reason = "グループ内の配置パターン数が上限（2万通り）を超過したため";
      } else if (e.message === "local_limit_exceeded") {
        reason = "グループ内の探索ステップ数が上限（100万回）に達したため";
      }
      log(`[Solver] 共有グループ探索（KGL）が中断されました（理由: ${reason}）。`);
      log(`[Solver] フォールバックとして従来のフル総当たりを実行します。`);
      return await solveByBacktracking();
    }
  };

  // 論理推論ループが終了し、まだ未確定単語が残っているならバックトラッキングを発動
  const remainingCount = solverWords.filter(w => !w.isUsed).length;
  if (remainingCount > 0 || findAlternative) {
    isBacktracked = true;
    if (onBacktrackStart) onBacktrackStart();
    
    let backtrackSuccess = false;
    try {
      backtrackSuccess = await runBacktrackWithPermutations();
    } catch (e: any) {
      if (e.message === "cancelled") {
        log("[Solver] ユーザーによって解答が中止されました。");
      } else {
        log(`[Solver] バックトラック実行中にエラーが発生しました: ${e.message}`);
      }
      backtrackSuccess = false;
    }
    
    if (onBacktrackEnd) onBacktrackEnd();
    
    if (findAlternative) {
      if (backtrackSuccess) {
        isAlternativeFound = true;
      } else {
        isUnique = true;
      }
    }
    
    // バックトラッキングの結果に関わらず reportStep を1回だけ呼んで最新状態を反映
    await reportStep();
  }

  // 元のパズルのセル（cells）をベースにして、元の数字（number）等の情報を破壊せずに復元する
  const finalCells = currentCells.map((row, y) => row.map((_, x) => ({ ...cells[y][x] })));
  const currGridChars = getGridChars();
  
  // Wリスト用の検証と確定文字マッピング取得
  const wlistRes = puzzle.isWList ? validateWListAssignment() : null;
  const wlistAssignments = wlistRes?.success ? wlistRes.assignments : null;

  let allCellsFilled = true;
  for (const node of nodeMap.values()) {
    const cell = finalCells[node.y][node.x];

    // 網掛けマスの表示制御：文字確定(isFixed)での解除は「余計なこと」なのでコメントアウト
    if (isChoMode && cell.isShaded) {
      // if (node.isFixed || node.logiNumber !== null || cells[node.y][node.x].isRevealed) {
      if (node.logiNumber !== null || cells[node.y][node.x].isRevealed) {
        cell.isRevealed = true;
      } else {
        cell.isRevealed = false;
      }
    } else {
      cell.isRevealed = true;
    }

    if (wlistAssignments && wlistAssignments[node.id]) {
      cell.answerChar = wlistAssignments[node.id];
    }

    if (node.isFixed) {
      cell.answerChar = node.currentChar;
    } else if (!(wlistAssignments && wlistAssignments[node.id])) {
      allCellsFilled = false;
    }

    if (node.logiNumber !== null) {
      cell.number = node.logiNumber;
    }

    // 共通のcurrGridCharsを用いて別解差異チェック
    if (isAlternativeFound && firstSolutionCells) {
      const firstChar = firstSolutionCells[node.y][node.x].answerChar || firstSolutionCells[node.y][node.x].char || '';
      const currChar = currGridChars[node.y][node.x];
      if ((firstChar || currChar) && firstChar !== currChar) {
        cell.isDifferent = true;
        log(`[Solver] 最終組み立て不一致検出: (${node.x},${node.y}) first='${firstChar}', curr='${currChar}'`);
      }
    }
  }

  let finalDiffCount = 0;
  if (isAlternativeFound) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (finalCells[y][x].isDifferent) finalDiffCount++;
      }
    }
    log(`[Solver] 最終的なisDifferentセルの総数: ${finalDiffCount}`);
  }

  // 別解がなく唯一解だった場合は、盤面を最初の状態に戻して返す
  if (isUnique && firstSolutionCells) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        finalCells[y][x].answerChar = firstSolutionCells[y][x].answerChar;
        finalCells[y][x].number = firstSolutionCells[y][x].number;
      }
    }
  }

  // 最終的な解答の判定
  const finalWlistRes = wlistRes || validateWListAssignment();
  if (puzzle.isWList && !finalWlistRes.success) {
    return {
      success: false,
      message: 'Wリストの単語割り当てが矛盾しています。',
      solvedCells: finalCells
    };
  }

  // 盤面が全て埋まっていれば、内部的なパスの繋がりが不完全でも「解答完了」とみなす
  const isComplete = allCellsFilled || isUnique;

  return {
    success: isComplete,
    solvedCells: finalCells,
    message: isComplete ? '解答が完了しました！' : '論理的には解けません。総当たりしか手段がありません。',
    isBacktracked,
    isAlternativeFound,
    isUnique,
    remainingWord: finalWlistRes.remainingWord
  };
}
