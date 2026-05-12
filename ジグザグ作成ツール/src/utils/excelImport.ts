import ExcelJS from 'exceljs';
import type { Cell, PuzzleData } from '../models/types';

export interface ExcelCellData {
  row: number;
  col: number;
  value: any; // 計算結果または生の値
  text: string; // 表示用の文字列
  backgroundColor?: string;
  isAnswerCell: boolean; // 背景色があるか等で推測
}

export interface ExcelImportResult {
  sheetNames: string[];
  workbook: ExcelJS.Workbook;
}

export interface RangeDef {
  sheetName: string;
  startCell: string; // 例: 'B2'
  endCell: string;   // 例: 'K15'
}

export interface ManualImportConfig {
  problemRange?: RangeDef;
  patternType: 1 | 2 | 3;
  answerRange?: RangeDef;
  listRange?: RangeDef;
}

/**
 * セルから値を安全に抽出する
 */
function extractCellValue(cell: ExcelJS.Cell): { value: any; text: string } {
  let value = cell.value;
  let text = '';

  if (value === null || value === undefined) {
    return { value: null, text: '' };
  }

  if (typeof value === 'object') {
    if ('result' in value) {
      // 数式の場合、計算結果を取得
      value = value.result;
    } else if ('richText' in value) {
      // リッチテキストの場合
      value = (value.richText as any[]).map(rt => rt.text).join('');
    } else if ('text' in value) {
        value = value.text;
    } else {
       value = String(value);
    }
  }

  text = String(value).trim();
  return { value, text };
}

/**
 * 背景色があるかどうか
 */
function getCellBackgroundColor(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  if (!fill) return undefined;
  if (fill.type === 'pattern' && fill.pattern !== 'none' && fill.fgColor) {
    return fill.fgColor.argb;
  }
  return undefined;
}

/**
 * Excelファイルを読み込み、シート名のリストを返す
 */
export async function analyzeExcelFile(file: File): Promise<ExcelImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheetNames: string[] = [];
  workbook.eachSheet((worksheet) => {
    sheetNames.push(worksheet.name);
  });

  return { sheetNames, workbook };
}

/**
 * 指定された範囲のセルデータを取得する
 */
function getCellsFromRange(workbook: ExcelJS.Workbook, range: RangeDef): ExcelCellData[][] | null {
  if (!range.sheetName || !range.startCell || !range.endCell) return null;
  const worksheet = workbook.getWorksheet(range.sheetName);
  if (!worksheet) return null;

  // A1形式を解釈
  const parseCellRef = (ref: string) => {
    const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowStr = match[2];
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    const row = parseInt(rowStr, 10);
    return { col, row }; // 1-indexed
  };

  const start = parseCellRef(range.startCell);
  const end = parseCellRef(range.endCell);
  
  if (!start || !end) return null;

  const minR = Math.min(start.row, end.row);
  const maxR = Math.max(start.row, end.row);
  const minC = Math.min(start.col, end.col);
  const maxC = Math.max(start.col, end.col);

  const height = maxR - minR + 1;
  const width = maxC - minC + 1;
  const cells2D: ExcelCellData[][] = Array(height).fill(null).map(() => Array(width).fill(null));

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = worksheet.getCell(r, c);
      const { value, text } = extractCellValue(cell);
      const bgColor = getCellBackgroundColor(cell);
      const isAnswerCell = !!bgColor && bgColor !== '00000000' && bgColor !== 'FFFFFFFF';
      
      cells2D[r - minR][c - minC] = {
        row: r,
        col: c,
        value,
        text,
        backgroundColor: bgColor,
        isAnswerCell
      };
    }
  }

  return cells2D;
}

/**
 * 手動で指定された範囲のセルデータからPuzzleDataを生成する
 */
export function convertManualImportToPuzzle(
  currentPuzzle: PuzzleData,
  workbook: ExcelJS.Workbook,
  config: ManualImportConfig
): PuzzleData {
  const newPuzzle = { ...currentPuzzle };

  const problemCells = config.problemRange ? getCellsFromRange(workbook, config.problemRange) : null;
  const listCells = config.listRange ? getCellsFromRange(workbook, config.listRange) : null;
  const answerCells = config.answerRange ? getCellsFromRange(workbook, config.answerRange) : null;

  // 1. リストの反映
  if (listCells) {
    const newWordList: Record<number, string> = {};
    const width = listCells[0].length;
    const height = listCells.length;
    
    // 縦または横の1, 2, 3...の隣のテキストを拾う
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const cell = listCells[r][c];
        if (cell && cell.text !== '') {
          const match = cell.text.trim().match(/^(\d+)[\.\s]*(.*)$/);
          if (match) {
            const num = Number(match[1]);
            const rest = match[2].trim();
            if (rest.length > 0) {
              newWordList[num] = rest;
            } else {
              const rightCell = c + 1 < width ? listCells[r][c+1] : null;
              const downCell = r + 1 < height ? listCells[r+1][c] : null;
              
              if (rightCell && rightCell.text.trim() !== '') {
                 newWordList[num] = rightCell.text.trim();
              } else if (downCell && downCell.text.trim() !== '') {
                 newWordList[num] = downCell.text.trim();
              }
            }
          }
        }
      }
    }
    newPuzzle.wordList = newWordList;
  }

  // 2. 盤面の反映
  if (problemCells) {
    const patternType = config.patternType;
    newPuzzle.patternType = patternType;
    
    const blockWidth = problemCells[0].length;
    const blockHeight = problemCells.length;
    
    let boardWidth = blockWidth;
    let boardHeight = blockHeight;
    
    if (patternType === 2) {
      boardHeight = Math.floor(blockHeight / 2);
    } else if (patternType === 3) {
      boardWidth = Math.floor(blockWidth / 3);
      boardHeight = Math.floor(blockHeight / 3);
    }
    
    newPuzzle.width = boardWidth;
    newPuzzle.height = boardHeight;
    
    const newCells: Cell[][] = Array(boardHeight).fill(null).map((_, y) => 
      Array(boardWidth).fill(null).map((_, x) => ({
        x, y, type: 'normal', char: '', answerChar: '',
        isNumbered: false, number: null, answerKey: null,
        style: {}
      }))
    );
    
    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        const cell = newCells[y][x];
        
        let targetCells: (ExcelCellData | null)[] = [];
        let targetAnswerCells: (ExcelCellData | null)[] = [];
        if (patternType === 1) {
          targetCells.push(problemCells[y][x]);
          if (answerCells && answerCells[y] && answerCells[y][x]) {
             targetAnswerCells.push(answerCells[y][x]);
          }
        } else if (patternType === 2) {
          targetCells.push(problemCells[y*2][x]);
          targetCells.push(problemCells[y*2+1][x]);
          if (answerCells && answerCells[y*2]) {
             targetAnswerCells.push(answerCells[y*2][x]);
             targetAnswerCells.push(answerCells[y*2+1]?.[x] || null);
          }
        } else if (patternType === 3) {
          for(let dy=0; dy<3; dy++){
             for(let dx=0; dx<3; dx++){
                targetCells.push(problemCells[y*3+dy][x*3+dx]);
                if (answerCells && answerCells[y*3+dy]) {
                   targetAnswerCells.push(answerCells[y*3+dy][x*3+dx]);
                }
             }
          }
        }
        
        // 1つでも有効なセルがあれば 'normal' (現在は初期値がnormalなので変更不要だが、念のため)
        const activeCells = targetCells.filter(c => c && c.text !== '');
        if (activeCells.length > 0) {
          activeCells.forEach(c => {
             const t = c!.text.trim();
             if (t === '') return;

             const match = t.match(/^(\d+)[\.\s]*(.*)$/);
             if (match) {
                 cell.isNumbered = true;
                 cell.number = Number(match[1]);
                 const rest = match[2].trim();
                 if (rest) {
                     if (/^[A-ZＡ-Ｚ]$/i.test(rest)) {
                        cell.answerKey = String.fromCharCode(rest.toUpperCase().charCodeAt(0) - (rest >= 'Ａ' ? 0xFEE0 : 0));
                     } else {
                        cell.char = rest.charAt(0);
                     }
                 }
             } else if (/^[A-ZＡ-Ｚ]$/i.test(t) || c!.isAnswerCell) {
                 if (/^[A-ZＡ-Ｚ]$/i.test(t)) {
                    cell.answerKey = String.fromCharCode(t.toUpperCase().charCodeAt(0) - (t >= 'Ａ' ? 0xFEE0 : 0));
                 }
             } else {
                 cell.char = t.charAt(0);
             }
          });
          
          const coloredCell = activeCells.find(c => c!.isAnswerCell);
          if (coloredCell && coloredCell.backgroundColor) {
             cell.style.backgroundColor = '#' + coloredCell.backgroundColor.slice(2);
          }
        }

        if (answerCells) {
           const activeAnswerCells = targetAnswerCells.filter(c => c && c.text.trim() !== '');
           activeAnswerCells.forEach(c => {
               const t = c!.text.trim();
               if (!/^[A-ZＡ-Ｚ]$/i.test(t)) {
                   const charMatch = t.match(/[^\dA-ZＡ-Ｚ\s\.]/i);
                   if (charMatch && !cell.answerChar) {
                       cell.answerChar = charMatch[0];
                   } else if (!cell.answerChar) {
                       cell.answerChar = t.charAt(0);
                   }
               }
           });
        }
      }
    }
    
    newPuzzle.cells = newCells;
  }

  return newPuzzle;
}
