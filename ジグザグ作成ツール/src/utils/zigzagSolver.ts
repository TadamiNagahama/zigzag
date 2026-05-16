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

  const isChoMode = puzzle.cells.some(row => row.some(c => c.isShaded));
  if (isChoMode) {
    log("超モードを検出しました。網掛けの下の数字を隠蔽して推論を開始します。");
  }

  const syncWordFixedNodes = () => {
    for (const w of solverWords) {
      const startNodeId = w.fixedNodeIDs[1];
      if (startNodeId) {
        const node = nodeMap.get(startNodeId);
        if (node && node.logiNumber === null) {
          node.logiNumber = w.logiNumber;
          log(`[1文字目確定] ${w.logiNumber}番の開始位置を ${getExcelCoords(node)} と特定しました（単語の1文字目が配置されたため）`);
          // 1文字目は確定文字として扱う
          if (!node.isFixed) {
            node.currentChar = w.text[0];
            node.isFixed = true;
          }
          changed = true;
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

  const reportStep = async () => {
    syncWordFixedNodes();
    if (onStep) {
      // メインのデータを壊さないよう、表示用のコピーを作成して隠蔽処理を行う
      const displayCells = currentCells.map(row => row.map(c => ({ ...c })));
      
      for (const node of nodeMap.values()) {
        const cell = displayCells[node.y][node.x];
        
        // 網掛けマスの場合は、一旦原稿の文字（char/answerChar）を非表示にする
        if (isChoMode && puzzle.cells[node.y][node.x].isShaded) {
          cell.char = '';
          cell.answerChar = '';
        }

        if (node.isFixed) {
          cell.answerChar = node.currentChar;
        }

        // 数字の同期 (表示用)
        // 解答エンジンが「このマスはN番である」と特定（logiNumberをセット）した場合のみ数字を表示する
        if (node.logiNumber !== null) {
          cell.number = node.logiNumber;
        } else if (isChoMode && puzzle.cells[node.y][node.x].isShaded) {
          cell.number = null; // 未確定の網掛けは表示上隠す
        }
      }
      await onStep(displayCells);
      // 超モードの場合は推論過程を見せるため少し長めに待つ
      await new Promise(resolve => setTimeout(resolve, isChoMode ? 150 : 30));
    }
  };

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
      // 超モード（網掛け）の場合は、原稿に数字や文字があっても解答開始時は隠蔽する
      const isActuallyShaded = cell.isShaded;
      const node: SolverNode = {
        id,
        x,
        y,
        isFixed: isActuallyShaded ? false : (cell.char !== '' || (cell.number !== null)),
        currentChar: isActuallyShaded ? '' : cell.char,
        logiNumber: isActuallyShaded ? null : cell.number,
        neighbors: [],
        reservedBy: new Set(),
        reservedChars: new Set(),
        candidates: new Set(),
        numberCandidates: isActuallyShaded ? new Set() : undefined,
        hiddenCorrectNumber: isActuallyShaded ? cell.number : undefined,
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

  const getExcelCoords = (node: SolverNode) => {
    const col = String.fromCharCode(65 + node.x);
    return `${col}${node.y + 1}`;
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
  const collectWordCandidates = () => {
    wordCharCandidates = new Map();
    nodeCharUsage = new Map();

    for (const w of solverWords) {
      if (w.isUsed) continue;
      const fixedLen = getFixedLength(w);
      if (fixedLen === 0 || fixedLen === w.length) continue;
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
      loopChanged = false;

      for (const w of solverWords) {
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
      if (fixedLen === 0) continue;
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

    // 2. 共有セル確定 (相互独占・相思相愛・単語内競合チェック)
    for (const w of solverWords) {
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
    return changed;
  };

  const solveFixedSharing = async (): Promise<boolean> => {
    let changed = false;
    for (let d = 1; d <= 15; d++) {
      let dChanged = false;
      for (const w of solverWords) {
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

          if (neighborNode.isFixed && neighborNode.currentChar !== targetChar) continue;

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

  // メインループ: 論理確定と共有判定を繰り返す
  let totalChanged = true;
  while (totalChanged) {
    totalChanged = false;

    // 超モードの場合、数字の特定を試みる
    if (isChoMode) {
      if (await solveChoNumberPlacement()) {
        totalChanged = true;
        collectWordCandidates();
        continue;
      }
    }

    // 候補情報の更新
    collectWordCandidates();

    log("--- 論理推論フェーズ 開始 ---");
    let stable = false;
    while (!stable) {
      stable = true;
      if (await executeLogicalLoop()) { 
        stable = false; 
        collectWordCandidates(); 
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
  }

  const finalCells = currentCells.map(row => row.map(c => ({ ...c })));
  let allCellsFilled = true;
  for (const node of nodeMap.values()) {
    const cell = finalCells[node.y][node.x];
    
    // 網掛けマスの隠蔽（特定できていないものは隠す）
    if (isChoMode && cell.isShaded) {
      cell.char = '';
      cell.answerChar = '';
      if (node.logiNumber === null) {
        cell.number = null;
      }
    }

    if (node.isFixed) {
      cell.answerChar = node.currentChar;
    } else {
      allCellsFilled = false;
    }

    if (node.logiNumber !== null) {
      cell.number = node.logiNumber;
    }
  }

  // 盤面が全て埋まっていれば、内部的なパスの繋がりが不完全でも「解答完了」とみなす
  const isComplete = allCellsFilled;

  return {
    success: isComplete,
    solvedCells: finalCells,
    message: isComplete ? '解答が完了しました！' : '論理的には解けません。総当たりしか手段がありません。'
  };
}
