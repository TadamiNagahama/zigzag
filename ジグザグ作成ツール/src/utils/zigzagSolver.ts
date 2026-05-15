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
  candidates: Set<string>;
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
}

export type SolverStepCallback = (cells: Cell[][]) => Promise<void>;
export type SolverLogCallback = (message: string) => void;

/**
 * ジグザグ解答ロジック (非同期版)
 */
export async function solveZigzagAsync(
  puzzle: PuzzleData, 
  onStep: SolverStepCallback,
  onLog?: SolverLogCallback
): Promise<SolveResult> {
  const log = (msg: string) => {
    if (onLog) onLog(msg);
    console.log(`[Solver] ${msg}`);
  };

  const { width, height, cells, wordList } = puzzle;
  const nodeMap: Map<string, SolverNode> = new Map();
  const solverWords: SolverWord[] = [];

  // 現在の状態をコピーして保持
  const currentCells = cells.map(row => row.map(c => ({ ...c })));

  const reportStep = async () => {
    if (onStep) {
      for (const node of nodeMap.values()) {
        const cell = currentCells[node.y][node.x];
        if (node.isFixed) {
          cell.answerChar = node.currentChar;
        }
      }
      await onStep(currentCells);
      // アニメーションのために少し待機
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };

  // 1. ノードの初期化
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = cells[y][x];
      if (cell.mergedParent && (cell.mergedParent.x !== x || cell.mergedParent.y !== y)) {
        continue;
      }
      
      const id = `${x},${y}`;
      const node: SolverNode = {
        id,
        x,
        y,
        logiNumber: cell.number,
        currentChar: cell.char || cell.answerChar || '',
        isFixed: !!(cell.char || cell.answerChar),
        neighbors: [],
        reservedBy: new Set(),
        reservedChars: new Set(),
        candidates: new Set()
      };
      nodeMap.set(id, node);
    }
  }

  // 2. 隣接関係の構築
  for (const node of nodeMap.values()) {
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of directions) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborCell = cells[ny][nx];
        const targetX = neighborCell.mergedParent ? neighborCell.mergedParent.x : nx;
        const targetY = neighborCell.mergedParent ? neighborCell.mergedParent.y : ny;
        const neighborId = `${targetX},${targetY}`;
        if (nodeMap.has(neighborId) && neighborId !== node.id) {
          if (!node.neighbors.includes(neighborId)) {
            node.neighbors.push(neighborId);
          }
        }
      }
    }
  }

  // 3. 単語リストの初期化
  for (const [numStr, text] of Object.entries(wordList)) {
    const logiNumber = parseInt(numStr, 10);
    const word: SolverWord = {
      text,
      length: text.length,
      logiNumber,
      isUsed: false,
      fixedNodeIDs: new Array(text.length + 1).fill(null)
    };

    // 開始位置の特定
    const startNode = Array.from(nodeMap.values()).find(n => n.logiNumber === logiNumber);
    if (startNode) {
      word.fixedNodeIDs[1] = startNode.id;
      if (!startNode.currentChar) {
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

  const executeLogicalLoop = async (): Promise<boolean> => {
    let overallChanged = false;
    let loopChanged = true;

    while (loopChanged) {
      loopChanged = false;

      for (const w of solverWords) {
        const fixedLen = getFixedLength(w);
        if (fixedLen === w.length) continue;

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
          return !nb.isFixed || nb.currentChar === targetChar;
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
      if (fixedLen === w.length) {
        w.isUsed = true;
        continue;
      }

      const startId = w.fixedNodeIDs[fixedLen]!;
      const used = getUsedNodes(w, fixedLen);
      const paths: { nid: string, char: string }[][] = [];
      const currentPath: { nid: string, char: string }[] = [];
      
      const dfs = (currId: string, charIdx: number) => {
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
          if (!nb.isFixed || nb.currentChar === targetChar) {
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
    const nodeCharUsage = new Map<string, Map<string, Set<number>>>();

    const getExcelCoords = (node: SolverNode) => {
      const col = String.fromCharCode(65 + node.x);
      return `${col}${node.y + 1}`;
    };

    // 1. 各単語の各位置における候補セルを収集 (DFS)
    const wordCharCandidates: Map<number, Map<number, Set<string>>> = new Map();
    for (const w of solverWords) {
      if (w.isUsed) continue;
      const fixedLen = getFixedLength(w);
      if (fixedLen === w.length) continue;
      const startId = w.fixedNodeIDs[fixedLen]!;
      const used = getUsedNodes(w, fixedLen);
      const candidatesByPos: Map<number, Set<string>> = new Map();
      wordCharCandidates.set(w.logiNumber, candidatesByPos);

      const dfs = (currId: string, charIdx: number) => {
        if (charIdx === w.length) return; 
        const currNode = nodeMap.get(currId)!;
        const targetChar = w.text[charIdx];
        const nextFixedId = w.fixedNodeIDs[charIdx + 1];

        for (const nid of currNode.neighbors) {
          if (used.has(nid)) continue;
          if (nextFixedId && nid !== nextFixedId) continue;
          const nb = nodeMap.get(nid)!;
          if (!nb.isFixed || nb.currentChar === targetChar) {
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

    // メソッドA: 共有チャンスの取得
    const getSharingOpportunities = (wNum: number, pos: number) => {
      const opportunities = new Map<string, Set<number>>();
      const candW = wordCharCandidates.get(wNum)?.get(pos);
      if (!candW) return opportunities;

      const wordW = solverWords.find(sw => sw.logiNumber === wNum)!;

      for (const [vNum, vCands] of wordCharCandidates.entries()) {
        if (vNum === wNum) continue;
        const wordV = solverWords.find(sw => sw.logiNumber === vNum)!;
        
        for (const [vPos, candV] of vCands.entries()) {
          if (wordW.text[pos] !== wordV.text[vPos]) continue;
          // 両方の単語がそのマスに到達可能かチェック
          const intersection = Array.from(candW).filter(id => candV.has(id));
          for (const nid of intersection) {
            if (!opportunities.has(nid)) opportunities.set(nid, new Set());
            opportunities.get(nid)!.add(vNum);
          }
        }
      }
      return opportunities;
    };

    // 2. 共有セル確定 (相互独占・相思相愛チェック)
    for (const w of solverWords) {
      if (w.isUsed) continue;
      for (let i = 1; i < w.text.length; i++) {
        if (w.fixedNodeIDs[i + 1]) continue;

        const oppsW = getSharingOpportunities(w.logiNumber, i);
        // この単語にとって、共有できるマスが1箇所しかない場合
        if (oppsW.size === 1) {
          const [nid, partners] = Array.from(oppsW.entries())[0];
          
          // パートナー側にとっても、このマス以外に共有の選択肢がないか（浮気していないか）チェック
          let allPartnersDecisive = true;
          for (const pNum of partners) {
            const pWord = solverWords.find(sw => sw.logiNumber === pNum)!;
            let partnerHasOtherOption = false;
            for (let j = 1; j < pWord.text.length; j++) {
              if (pWord.text[j] === w.text[i]) {
                const oppsP = getSharingOpportunities(pNum, j);
                if (oppsP.size > 1) {
                  partnerHasOtherOption = true;
                  break;
                }
              }
            }
            if (partnerHasOtherOption) {
              allPartnersDecisive = false;
              break;
            }
          }

          if (allPartnersDecisive) {
            const node = nodeMap.get(nid)!;
            log(`単語 [${w.logiNumber}] と相手単語群が文字 '${w.text[i]}' を共有できる唯一の場所 ${getExcelCoords(node)} を相互確定`);
            fixNode(node, w.text[i]);
            // アンカー（ワープ予約）を打つ
            w.fixedNodeIDs[i + 1] = nid;
            for (const pNum of partners) {
               const pWord = solverWords.find(sw => sw.logiNumber === pNum)!;
               for (let j = 1; j < pWord.text.length; j++) {
                 if (pWord.text[j] === w.text[i]) {
                   pWord.fixedNodeIDs[j + 1] = nid;
                 }
               }
            }
            await reportStep();
            changed = true;
          }
        }
      }
    }

    // 3. セル視点での一意性チェック (全候補が一致)
    for (const [nid, charMap] of nodeCharUsage.entries()) {
      const node = nodeMap.get(nid)!;
      if (node.isFixed) continue;
      if (charMap.size === 1) {
        const [char, words] = Array.from(charMap.entries())[0];
        log(`セル ${getExcelCoords(node)} は文字 '${char}' のみが配置可能 (全候補が一致)`);
        fixNode(node, char);
        await reportStep();
        changed = true;
      }
    }
    return changed;
  };

  const solveFixedSharing = async (): Promise<boolean> => {
    let changed = false;
    for (let d = 1; d <= 15; d++) {
      let dChanged = false;
      for (const w of solverWords) {
        if (w.isUsed) continue;
        const fixedLen = getFixedLength(w);
        if (fixedLen + d > w.length) continue;
        const targetChar = w.text[fixedLen + d - 1];
        const startId = w.fixedNodeIDs[fixedLen]!;
        const candidates = findNodesAtDistance(startId, d, w);
        const matchingFixedNodes = candidates.filter(nid => {
          const node = nodeMap.get(nid)!;
          return node.isFixed && node.currentChar === targetChar;
        });
        if (matchingFixedNodes.length === 1) {
          const targetId = matchingFixedNodes[0];
          if (w.fixedNodeIDs[fixedLen + d] !== targetId) {
            w.fixedNodeIDs[fixedLen + d] = targetId;
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
    const dfs = (currId: string, currentDist: number) => {
      if (currentDist === dist) {
        results.add(currId);
        return;
      }
      const currNode = nodeMap.get(currId)!;
      const targetChar = w.text[getFixedLength(w) + currentDist];
      for (const nid of currNode.neighbors) {
        if (used.has(nid)) continue;
        const nb = nodeMap.get(nid)!;
        if (!nb.isFixed || nb.currentChar === targetChar) {
          used.add(nid);
          dfs(nid, currentDist + 1);
          used.delete(nid);
        }
      }
    };
    dfs(startId, 0);
    return Array.from(results);
  };

  let totalChanged = true;
  while (totalChanged) {
    totalChanged = false;
    log("--- 論理推論フェーズ 開始 ---");
    let stable = false;
    while (!stable) {
      stable = true;
      if (await executeLogicalLoop()) { stable = false; }
    }
    
    log("--- 確定文字との共有化 (Type 1) 開始 ---");
    if (await solveFixedSharing()) { 
      totalChanged = true;
      continue; 
    }

    log("--- 未確定文字同士の共有化 (Type 2) 開始 ---");
    if (await solveDynamicSharing()) {
      totalChanged = true;
      continue;
    }
  }

  const finalCells = currentCells.map(row => row.map(c => ({ ...c })));
  let complete = true;
  for (const node of nodeMap.values()) {
    const cell = finalCells[node.y][node.x];
    if (node.isFixed) cell.answerChar = node.currentChar;
    else complete = false;
  }
  for (const w of solverWords) {
    if (getFixedLength(w) !== w.length) { complete = false; break; }
  }

  return {
    success: complete,
    solvedCells: finalCells,
    message: complete ? '解答が完了しました！' : '論理的には解けません。総当たりしか手段がありません。'
  };
}
