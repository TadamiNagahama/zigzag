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
  endCell?: string;   // リストなどでは使われる。問題面・解答面では自動計算のため不要
}

export interface ManualImportConfig {
  boardWidth: number;
  boardHeight: number;
  problemRange?: RangeDef;
  problemPatternType: 1 | 2 | 3;
  answerRange?: RangeDef;
  answerPatternType: 1 | 2 | 3;
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
      value = value.result;
    } else if ('richText' in value) {
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

function getCellBackgroundColor(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  if (!fill) return undefined;
  if (fill.type === 'pattern' && fill.pattern !== 'none' && fill.fgColor) {
    return fill.fgColor.argb;
  }
  return undefined;
}

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

/**
 * 左上と右下のセルを指定して取得する (主にリスト用)
 */
function getCellsFromRange(workbook: ExcelJS.Workbook, range: RangeDef): ExcelCellData[][] | null {
  if (!range.sheetName || !range.startCell || !range.endCell) return null;
  const worksheet = workbook.getWorksheet(range.sheetName);
  if (!worksheet) return null;

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
        row: r, col: c, value, text, backgroundColor: bgColor, isAnswerCell
      };
    }
  }

  return cells2D;
}

/**
 * 左上セルと幅・高さを指定して取得する (問題面・解答面用)
 */
function getCellsFromStartAndSize(workbook: ExcelJS.Workbook, sheetName: string, startCell: string, width: number, height: number): ExcelCellData[][] | null {
  if (!sheetName || !startCell) return null;
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) return null;

  const start = parseCellRef(startCell);
  if (!start) return null;

  const minR = start.row;
  const maxR = start.row + height - 1;
  const minC = start.col;
  const maxC = start.col + width - 1;

  const cells2D: ExcelCellData[][] = Array(height).fill(null).map(() => Array(width).fill(null));

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = worksheet.getCell(r, c);
      const { value, text } = extractCellValue(cell);
      const bgColor = getCellBackgroundColor(cell);
      const isAnswerCell = !!bgColor && bgColor !== '00000000' && bgColor !== 'FFFFFFFF';
      
      cells2D[r - minR][c - minC] = {
        row: r, col: c, value, text, backgroundColor: bgColor, isAnswerCell
      };
    }
  }

  return cells2D;
}

export function convertManualImportToPuzzle(
  currentPuzzle: PuzzleData,
  workbook: ExcelJS.Workbook,
  config: ManualImportConfig
): PuzzleData {
  const newPuzzle = { ...currentPuzzle };

  const boardWidth = config.boardWidth;
  const boardHeight = config.boardHeight;
  const pType = config.problemPatternType;
  const aType = config.answerPatternType;

  let problemCells: ExcelCellData[][] | null = null;
  if (config.problemRange) {
     const pW = pType === 3 ? boardWidth * 3 : boardWidth;
     const pH = pType === 2 ? boardHeight * 2 : (pType === 3 ? boardHeight * 3 : boardHeight);
     problemCells = getCellsFromStartAndSize(workbook, config.problemRange.sheetName, config.problemRange.startCell, pW, pH);
  }

  let answerCells: ExcelCellData[][] | null = null;
  if (config.answerRange) {
     const aW = aType === 3 ? boardWidth * 3 : boardWidth;
     const aH = aType === 2 ? boardHeight * 2 : (aType === 3 ? boardHeight * 3 : boardHeight);
     answerCells = getCellsFromStartAndSize(workbook, config.answerRange.sheetName, config.answerRange.startCell, aW, aH);
  }

  const listCells = config.listRange ? getCellsFromRange(workbook, config.listRange) : null;

  // 1. リストの反映
  if (listCells) {
    const newWordList: Record<number, string> = {};
    const width = listCells[0].length;
    const height = listCells.length;
    
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
              const rightCell1 = c + 1 < width ? listCells[r][c+1] : null;
              const rightCell2 = c + 2 < width ? listCells[r][c+2] : null;
              const downCell1 = r + 1 < height ? listCells[r+1][c] : null;
              const downCell2 = r + 2 < height ? listCells[r+2][c] : null;
              
              if (rightCell1 && rightCell1.text.trim() !== '') {
                 newWordList[num] = rightCell1.text.trim();
              } else if (rightCell2 && rightCell2.text.trim() !== '') {
                 newWordList[num] = rightCell2.text.trim();
              } else if (downCell1 && downCell1.text.trim() !== '') {
                 newWordList[num] = downCell1.text.trim();
              } else if (downCell2 && downCell2.text.trim() !== '') {
                 newWordList[num] = downCell2.text.trim();
              }
            }
          }
        }
      }
    }
    newPuzzle.wordList = newWordList;
  }

  // 2. 盤面の反映
  newPuzzle.width = boardWidth;
  newPuzzle.height = boardHeight;
  newPuzzle.patternType = pType;

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
      
      if (problemCells) {
        if (pType === 1) {
          targetCells.push(problemCells[y][x]);
        } else if (pType === 2) {
          targetCells.push(problemCells[y*2][x]);
          targetCells.push(problemCells[y*2+1][x]);
        } else if (pType === 3) {
          for(let dy=0; dy<3; dy++){
             for(let dx=0; dx<3; dx++){
                targetCells.push(problemCells[y*3+dy][x*3+dx]);
             }
          }
        }
      }

      if (answerCells) {
        if (aType === 1) {
          targetAnswerCells.push(answerCells[y][x]);
        } else if (aType === 2) {
          targetAnswerCells.push(answerCells[y*2][x]);
          targetAnswerCells.push(answerCells[y*2+1]?.[x] || null);
        } else if (aType === 3) {
          for(let dy=0; dy<3; dy++){
             for(let dx=0; dx<3; dx++){
                targetAnswerCells.push(answerCells[y*3+dy][x*3+dx]);
             }
          }
        }
      }
      
      // 問題面の文字・数字解析
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

      // 解答面の文字解析
      if (answerCells) {
         const activeAnswerCells = targetAnswerCells.filter(c => c && c.text.trim() !== '');
         activeAnswerCells.forEach(c => {
             const t = c!.text.trim();
             if (t === '') return;

             // 数字と同居しているケース（例: "15 漢"）を考慮して数字を分離
             const numMatch = t.match(/^(\d+)[\.\s]*(.*)$/);
             let actualCharPart = t;
             if (numMatch) {
                 actualCharPart = numMatch[2].trim();
             }

             // アルファベット1文字だけのセルはラベル（A, B, C...）の可能性が高いので無視
             if (!/^[A-ZＡ-Ｚ]$/i.test(actualCharPart) && actualCharPart.length > 0) {
                 // 記号や数字、アルファベット以外の「文字（漢字・かな等）」を優先的に探す
                 const charOnlyMatch = actualCharPart.match(/[^\dA-ZＡ-Ｚ\s\.\-]/i);
                 if (charOnlyMatch && !cell.answerChar) {
                     cell.answerChar = charOnlyMatch[0];
                 } else if (!cell.answerChar) {
                     // 候補が見つからない場合は1文字目（ただしラベルでないもの）を採用
                     cell.answerChar = actualCharPart.charAt(0);
                 }
             }
         });
      }
    }
  }

  newPuzzle.cells = newCells;
  return newPuzzle;
}
