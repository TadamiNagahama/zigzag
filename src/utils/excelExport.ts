import ExcelJS from 'exceljs';
import type { PuzzleData } from '../models/types';
import type { ExportOptions } from '../components/ExportDialog';

// 単位変換関数 (px -> Excel単位)
const pxToPoints = (px: number) => px * 0.75;
const pxToChars = (px: number) => Math.max(0, (px - 5) / 5.5);

/**
 * 指定されたワークシートにパズルの一式を描画する内部関数
 */
const renderPuzzleSection = (
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  puzzle: PuzzleData,
  options: ExportOptions,
  isQuestion: boolean,
  includeWordList: boolean
) => {
  const defaultFontName = 'MS Pゴシック';
  const defaultFont = { name: defaultFontName, size: 11 };

  // 使用されているアルファベットを抽出してグループ化
  const usedKeys = new Set<string>();
  puzzle.cells.forEach(row => row.forEach(cell => {
    if (cell.answerKey) usedKeys.add(cell.answerKey);
  }));
  const uniqueSorted = Array.from(usedKeys).sort();
  const alphabetGroups: string[][] = [];
  if (uniqueSorted.length > 0) {
    let currentGroup = [uniqueSorted[0]];
    for (let i = 1; i < uniqueSorted.length; i++) {
      const prevChar = uniqueSorted[i - 1];
      const currChar = uniqueSorted[i];
      if (currChar.charCodeAt(0) === prevChar.charCodeAt(0) + 1) {
        currentGroup.push(currChar);
      } else {
        alphabetGroups.push(currentGroup);
        currentGroup = [currChar];
      }
    }
    alphabetGroups.push(currentGroup);
  }

  const rowStep = options.boardCellMode === '3x3' ? 3 : (options.boardCellMode === '2x1' ? 2 : 1);
  const colStep = options.boardCellMode === '3x3' ? 3 : 1;

  // 1. タイトル
  const displayTitle = (puzzle.boardTitle || puzzle.title || '無題のパズル') + (isQuestion ? '' : '（解答）');
  const titleRow = startRow;
  const boardWidth = Math.max(alphabetGroups.reduce((acc, g) => acc + g.length, 0), puzzle.width * colStep);
  
  if (boardWidth > 1) {
    worksheet.mergeCells(titleRow, 1, titleRow, boardWidth + 1);
  }
  const titleCell = worksheet.getCell(titleRow, 1);
  titleCell.value = displayTitle;
  titleCell.font = { ...defaultFont, size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. 解答欄の描画
  const labelRow = startRow + 2;
  const boxesRow = startRow + 3; 

  const boardRowH = options.boardCellMode === '2x1' ? (options.cellHeight1 + options.cellHeight2) : (options.boardCellMode === '3x3' ? options.cellHeight1 * 3 : options.cellHeight1);
  worksheet.getRow(boxesRow).height = pxToPoints(boardRowH);

  let answerColOffset = 0;
  alphabetGroups.forEach((group) => {
    group.forEach((alphabet) => {
      const col = 2 + answerColOffset;
      answerColOffset++;

      if (options.answerAreaMode === '1x1') {
        const cell = worksheet.getCell(boxesRow, col);
        cell.value = alphabet;
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.font = { name: defaultFontName, size: options.fontSizeSmall };
        cell.alignment = { 
          vertical: 'top', horizontal: 'left',
          shrinkToFit: options.boardNewline ? false : true 
        };
      } else {
        worksheet.getRow(boxesRow).height = pxToPoints(options.cellHeight1);
        worksheet.getRow(boxesRow + 1).height = pxToPoints(options.cellHeight2);
        const topCell = worksheet.getCell(boxesRow, col);
        const bottomCell = worksheet.getCell(boxesRow + 1, col);
        topCell.value = alphabet;
        topCell.font = { name: defaultFontName, size: options.fontSizeSmall };
        topCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        bottomCell.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        [topCell, bottomCell].forEach(c => {
          c.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true };
        });
      }
      worksheet.getColumn(col).width = pxToChars(options.cellWidth);
    });
  });

  // 解答余り（残るもの）
  if (puzzle.isRemainingAnswer) {
    const labelCol = 2 + answerColOffset + 1;
    worksheet.getCell(labelRow, labelCol).value = '残るもの';
    worksheet.getCell(labelRow, labelCol).font = { ...defaultFont, bold: true };
    
    // 5マス分の枠を結合
    const boxStartCol = labelCol;
    const boxEndCol = boxStartCol + 4;
    worksheet.mergeCells(boxesRow, boxStartCol, (options.answerAreaMode === '2x1' ? boxesRow + 1 : boxesRow), boxEndCol);
    const remainingBox = worksheet.getCell(boxesRow, boxStartCol);
    remainingBox.value = puzzle.remainingAnswerWord || '';
    remainingBox.border = {
      top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    remainingBox.font = { ...defaultFont, size: 14 };
    remainingBox.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // 3. 盤面の描画
  const boardStartRow = startRow + 5;

  const shadingFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  for (let py = 0; py < puzzle.height; py++) {
    for (let px = 0; px < puzzle.width; px++) {
      const cell = puzzle.cells[py][px];
      if (cell.type === 'wall') continue;
      if (cell.mergedParent && (cell.mergedParent.x !== px || cell.mergedParent.y !== py)) continue;

      const ex = px * colStep + 1;
      const ey = boardStartRow + py * rowStep;
      const mw = (cell.mergedSize?.width || 1);
      const mh = (cell.mergedSize?.height || 1);
      const excelW = mw * colStep;
      const excelH = mh * rowStep;

      if (mw > 1 || mh > 1) {
        worksheet.mergeCells(ey, ex, ey + excelH - 1, ex + excelW - 1);
      }

      // 枠線と網掛け
      for (let r = 0; r < excelH; r++) {
        for (let c = 0; c < excelW; c++) {
          const cCell = worksheet.getCell(ey + r, ex + c);
          let border: any = {};
          if (r === 0) border.top = { style: 'thin' };
          if (r === excelH - 1) border.bottom = { style: 'thin' };
          if (c === 0) border.left = { style: 'thin' };
          if (c === excelW - 1) border.right = { style: 'thin' };
          cCell.border = border;
          
          if (cell.isShaded) {
            cCell.fill = shadingFill;
          }
        }
      }

      // 内容の描画
      const hideContent = isQuestion && cell.isShaded;
      const num = (!hideContent && cell.isNumbered) ? cell.number : null;
      const hintChar = (!hideContent && cell.char) ? cell.char : '';
      const answerChar = (!hideContent && !isQuestion && cell.answerChar) ? cell.answerChar : '';
      const alpha = (!hideContent) ? (cell.answerKey || '') : '';

      if (options.boardCellMode === '1x1') {
        let val = '';
        if (num) val += num;
        if (hintChar) {
          if (val && options.boardNewline) val += '\n';
          else if (val) val += ' ';
          val += hintChar;
        }
        if (answerChar) {
          if (val && options.boardNewline && !hintChar) val += '\n';
          else if (val) val += ' ';
          val += answerChar;
        }
        if (alpha) {
          if (val) val += ' ';
          val += alpha;
        }
        const targetCell = worksheet.getCell(ey, ex);
        targetCell.value = val;
        targetCell.font = { name: defaultFontName, size: (hintChar || answerChar) ? options.fontSizeLarge : options.fontSizeSmall };
        targetCell.alignment = { 
          wrapText: options.boardNewline, vertical: 'top', horizontal: 'left',
          shrinkToFit: options.boardNewline ? false : true
        };
      } else if (options.boardCellMode === '2x1') {
        worksheet.getRow(ey).height = pxToPoints(options.cellHeight1);
        worksheet.getRow(ey + 1).height = pxToPoints(options.cellHeight2);
        const topCell = worksheet.getCell(ey, ex);
        const bottomCell = worksheet.getCell(ey + 1, ex);
        if (num) {
          topCell.value = num;
          topCell.font = { name: defaultFontName, size: options.fontSizeSmall };
        }
        if (hintChar || answerChar) {
          bottomCell.value = hintChar + (answerChar ? (hintChar ? ' ' : '') + answerChar : '');
          bottomCell.font = { name: defaultFontName, size: options.fontSizeLarge };
        }
        if (alpha) {
          const alphaCell = options.alphabetPos === 'top' ? topCell : bottomCell;
          alphaCell.value = (alphaCell.value ? alphaCell.value + ' ' : '') + alpha;
          alphaCell.font = { name: defaultFontName, size: options.fontSizeSmall };
        }
        [topCell, bottomCell].forEach(c => {
          c.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true };
        });
      } else {
        for (let r = 0; r < 3; r++) worksheet.getRow(ey + r).height = pxToPoints(options.cellHeight1);
        if (num) {
          const nCell = worksheet.getCell(ey, ex);
          nCell.value = num;
          nCell.font = { name: defaultFontName, size: options.fontSizeSmall };
          nCell.alignment = { vertical: 'top', horizontal: 'left', shrinkToFit: true };
        }
        if (hintChar || answerChar) {
          const cCell = worksheet.getCell(ey + 1, ex + 1);
          cCell.value = hintChar + (answerChar ? (hintChar ? ' ' : '') + answerChar : '');
          cCell.font = { name: defaultFontName, size: options.fontSizeLarge };
          cCell.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true };
        }
        if (alpha) {
          const aCell = worksheet.getCell(ey + 2, ex + 2);
          aCell.value = alpha;
          aCell.font = { name: defaultFontName, size: options.fontSizeSmall };
          aCell.alignment = { vertical: 'bottom', horizontal: 'right', shrinkToFit: true };
        }
      }
    }
  }

  // 大外枠
  const boardEndRow = boardStartRow + puzzle.height * rowStep - 1;
  const boardEndCol = puzzle.width * colStep;
  for (let r = boardStartRow; r <= boardEndRow; r++) {
    const leftCell = worksheet.getCell(r, 1);
    const rightCell = worksheet.getCell(r, boardEndCol);
    leftCell.border = { ...leftCell.border, left: { style: 'medium' } };
    rightCell.border = { ...rightCell.border, right: { style: 'medium' } };
  }
  for (let c = 1; c <= boardEndCol; c++) {
    const topCell = worksheet.getCell(boardStartRow, c);
    const bottomCell = worksheet.getCell(boardEndRow, c);
    topCell.border = { ...topCell.border, top: { style: 'medium' } };
    bottomCell.border = { ...bottomCell.border, bottom: { style: 'medium' } };
  }

  // 4. 単語リスト
  let nextRow = boardEndRow + 2;
  if (includeWordList) {
    const wordEntries = Object.entries(puzzle.wordList).map(([id, word]) => ({ id: parseInt(id), word })).sort((a,b) => a.id - b.id);
      const numCols = options.listColumns;
      const totalItems = wordEntries.length;
      const itemsPerCol = Math.ceil(totalItems / numCols);
      const isRight = options.listPlacement === 'right';

      const cellsPerEntry = (options.boardCellMode === '3x3' && !isRight) ? 9 : 4;
      const wordColOffset = (options.boardCellMode === '3x3' && !isRight) ? 1 : 2;

      wordEntries.forEach((entry, index) => {
        let r, c, colIndex, rowIndex;
        colIndex = Math.floor(index / itemsPerCol);
        rowIndex = index % itemsPerCol;

        if (isRight) {
          r = boardStartRow + rowIndex;
          c = (puzzle.width + 1) * colStep + 1 + colIndex * cellsPerEntry;
        } else {
          r = boardEndRow + 2 + rowIndex;
          c = 1 + colIndex * cellsPerEntry;
        }
        
        const isArrow = puzzle.isArrowMode;
        const nCell = worksheet.getCell(r, c);
        const aCell = isArrow ? worksheet.getCell(r, c + 1) : null;
        const wCell = worksheet.getCell(r, c + (isArrow ? 2 : wordColOffset));
        
        nCell.value = entry.id;
        if (isArrow && aCell) {
          aCell.value = puzzle.wordDirections?.[entry.id] || '?';
          aCell.font = { name: defaultFontName, size: options.listFontSize };
          aCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        
        const isStar = puzzle.wordStarList?.[entry.id];
        wCell.value = isStar ? '★' : (entry.word || '');
        
        nCell.font = { name: defaultFontName, size: options.listFontSize };
        wCell.font = { name: defaultFontName, size: options.listFontSize };
        
        nCell.alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true };
        wCell.alignment = { horizontal: 'left', vertical: 'middle' };
        if (!isRight) nextRow = Math.max(nextRow, r + 1);
      });
      
      if (isRight) {
        const numColsGenerated = Math.ceil(wordEntries.length / itemsPerCol);
        for (let i = 0; i < numColsGenerated; i++) {
          const baseC = (puzzle.width + 1) * colStep + 1 + i * cellsPerEntry;
          worksheet.getColumn(baseC).width = pxToChars(20);
          if (cellsPerEntry === 9) {
            worksheet.getColumn(baseC + 1).width = pxToChars(100);
          } else {
            worksheet.getColumn(baseC + 1).width = pxToChars(15);
            worksheet.getColumn(baseC + 2).width = pxToChars(100);
            worksheet.getColumn(baseC + 3).width = pxToChars(15);
          }
        }
      }
  }

  const maxCol = Math.max(puzzle.width * colStep + 10, 50);
  for (let i = 1; i <= maxCol; i++) {
    if (!worksheet.getColumn(i).width) worksheet.getColumn(i).width = pxToChars(options.cellWidth);
  }

  return nextRow + 2;
};

export const exportToExcel = async (puzzle: PuzzleData, options: ExportOptions) => {
  const workbook = new ExcelJS.Workbook();
  const companyName = 'キンピラ工房';
  workbook.creator = companyName;
  (workbook.properties as any).company = companyName;
  (workbook.properties as any).application = '漢字ジグザグ作成ツール';

  if (options.exportMode === 'super') {
    if (options.superLayout === 'separate') {
      const ws1 = workbook.addWorksheet('問題');
      ws1.views = [{ showGridLines: true }];
      renderPuzzleSection(ws1, 1, puzzle, options, true, true);
      
      const ws2 = workbook.addWorksheet('解答');
      ws2.views = [{ showGridLines: true }];
      renderPuzzleSection(ws2, 1, puzzle, options, false, false);
    } else {
      const ws = workbook.addWorksheet('漢字ジグザグ');
      ws.views = [{ showGridLines: true }];
      const nextRow = renderPuzzleSection(ws, 1, puzzle, options, true, true);
      renderPuzzleSection(ws, nextRow + 2, puzzle, options, false, false);
    }
  } else {
    const ws = workbook.addWorksheet('漢字ジグザグ');
    ws.views = [{ showGridLines: true }];
    renderPuzzleSection(ws, 1, puzzle, options, false, true);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${puzzle.title || 'puzzle'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Excel Workbook', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']}}]});
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
    } catch (err: any) { if (err.name !== 'AbortError') throw err; }
  } else {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    window.URL.revokeObjectURL(url);
  }
};
