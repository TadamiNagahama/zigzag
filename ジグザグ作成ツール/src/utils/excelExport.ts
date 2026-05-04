import ExcelJS from 'exceljs';
import type { PuzzleData } from '../models/types';
import type { ExportOptions } from '../components/ExportDialog';

// 単位変換関数 (px -> Excel単位)
const pxToPoints = (px: number) => px * 0.75;
const pxToChars = (px: number) => Math.max(0, (px - 5) / 8); // ピクセル数からExcelの列幅（文字数）への変換精度を修正。



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
  const defaultFontName = options.fontName || 'MS Pゴシック';
  const isBold = puzzle.boardFontWeight === 'bold';
  const defaultFont = { name: defaultFontName, size: 11, bold: isBold };

  // 使用されているアルファベットを抽出してグループ化
  const usedKeys = new Set<string>();
  const keyToChar: Record<string, string> = {};
  puzzle.cells.forEach(row => row.forEach(cell => {
    if (cell.answerKey) {
      usedKeys.add(cell.answerKey);
      if (cell.answerChar) keyToChar[cell.answerKey] = cell.answerChar;
    }
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
    worksheet.mergeCells(titleRow, 1, titleRow, boardWidth);
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
  // 「解答欄」ラベル
  if (alphabetGroups.length > 0) {
    const answerLabelCell = worksheet.getCell(labelRow, 2);
    answerLabelCell.value = '解答欄';
    answerLabelCell.font = { ...defaultFont, bold: true };
  }
  alphabetGroups.forEach((group) => {
    group.forEach((alphabet) => {
      const col = 2 + answerColOffset;
      answerColOffset++;

      if (options.answerAreaMode === '1x1') {
        const cell = worksheet.getCell(boxesRow, col);
        const ans = isQuestion ? '' : (keyToChar[alphabet] || '');
        if (!ans) {
          cell.value = alphabet;
          cell.font = { name: defaultFontName, size: options.fontSizeSmall };
        } else {
          cell.value = {
            richText: [
              { font: { name: defaultFontName, size: options.fontSizeSmall }, text: alphabet + '\n' },
              { font: { name: defaultFontName, size: 14 }, text: ' ' + ans }
            ]
          };
        }
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { 
          vertical: 'top', horizontal: 'left', wrapText: true
        };
      } else {
        worksheet.getRow(boxesRow).height = pxToPoints(options.cellHeight1);
        worksheet.getRow(boxesRow + 1).height = pxToPoints(options.cellHeight2);
        const topCell = worksheet.getCell(boxesRow, col);
        const bottomCell = worksheet.getCell(boxesRow + 1, col);
        topCell.value = alphabet;
        const ans = isQuestion ? '' : (keyToChar[alphabet] || '');
        bottomCell.value = ans ? (' ' + ans) : '';
        topCell.font = { name: defaultFontName, size: options.fontSizeSmall };
        bottomCell.font = { name: defaultFontName, size: 14 };
        topCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        bottomCell.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        
        topCell.alignment = { vertical: 'middle', horizontal: 'left', shrinkToFit: true };
        bottomCell.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true };
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
    remainingBox.value = isQuestion ? '' : (puzzle.remainingAnswerWord || '');
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
    fgColor: { argb: 'FFD9D9D9' } // 15%グレー
  };

  // 解答マス（アルファベット）用のドットパターン (灰色12.5%)
  const alphabetPatternFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'gray125',
    fgColor: { argb: 'FF888888' } // ドットの色
  };

  // 網掛けと解答マスが重なった場合
  const shadedAlphabetFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'gray125',
    fgColor: { argb: 'FF000000' }, // 重なり時は少し濃いめのドット
    bgColor: { argb: 'FFD9D9D9' }  // 背景は網掛けのグレー
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

      // 盤面の列幅を明示的に設定（他設定との干渉による幅の誤加算を防止）
      for (let c = 0; c < excelW; c++) {
        worksheet.getColumn(ex + c).width = pxToChars(options.cellWidth);
      }

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
          
          if (cell.isShaded && cell.answerKey) {
            cCell.fill = shadedAlphabetFill;
          } else if (cell.isShaded) {
            cCell.fill = shadingFill;
          } else if (cell.answerKey) {
            cCell.fill = alphabetPatternFill;
          }
        }
      }

      // 内容の描画
      const hideContent = isQuestion && cell.isShaded;
      const num = (!hideContent && cell.isNumbered) ? cell.number : null;
      const hintChar = (!hideContent && cell.char) ? cell.char : '';
      const answerChar = (!hideContent && !isQuestion && cell.answerChar) ? cell.answerChar : '';
      const alpha = cell.answerKey || ''; // アルファベット（解答キー）は常に表示

      if (options.boardCellMode === '1x1') {
        worksheet.getRow(ey).height = pxToPoints(options.cellHeight1);
        let val = '';
        if (num) val += num;
        const displayChar = answerChar || hintChar;
        if (displayChar) {
          if (val && options.boardNewline) val += '\n';
          else if (val) val += ' ';
          val += displayChar;
        }
        if (alpha) {
          if (val) val += ' ';
          val += alpha;
        }
        const targetCell = worksheet.getCell(ey, ex);
        targetCell.value = val;
        targetCell.font = { 
          name: defaultFontName, 
          size: (hintChar || answerChar) ? options.fontSizeLarge : options.fontSizeSmall,
          bold: isBold
        };
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
          bottomCell.value = answerChar || hintChar;
          bottomCell.font = { name: defaultFontName, size: options.fontSizeLarge, bold: isBold };
        }
        if (alpha) {
          const alphaCell = options.alphabetPos === 'top' ? topCell : bottomCell;
          alphaCell.value = (alphaCell.value ? alphaCell.value + ' ' : '') + alpha;
          alphaCell.font = { name: defaultFontName, size: options.fontSizeSmall };
        }
        topCell.alignment = { vertical: 'middle', horizontal: 'left', shrinkToFit: true };
        bottomCell.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true };
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
          cCell.value = answerChar || hintChar;
          cCell.font = { name: defaultFontName, size: options.fontSizeLarge, bold: isBold };
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
  const shouldRenderListInSheet = includeWordList && options.listPlacement !== 'separate';
  if (shouldRenderListInSheet) {
    nextRow = renderWordList(worksheet, nextRow, 1, puzzle, options, defaultFontName, boardStartRow, boardEndRow, colStep);
  }

  const maxCol = Math.max(puzzle.width * colStep + 10, 50);
  for (let i = 1; i <= maxCol; i++) {
    if (!worksheet.getColumn(i).width) worksheet.getColumn(i).width = pxToChars(options.cellWidth);
  }

  return nextRow + 2;
};

/**
 * 単語リストの描画ロジックを共通化
 */
const renderWordList = (
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  puzzle: PuzzleData,
  options: ExportOptions,
  defaultFontName: string,
  boardStartRow: number,
  boardEndRow: number,
  colStep: number,
  forceNumbers?: boolean
) => {
    const boardNumbers = new Set<number>();
    puzzle.cells.forEach(row => row.forEach(cell => {
      if (cell.number) boardNumbers.add(cell.number);
    }));
    const numbers = Array.from(boardNumbers).sort((a, b) => a - b);
    let order = numbers;
    if (puzzle.puzzleType === 'ナンバーレス' || puzzle.puzzleType === '部分ナンバーレス') {
      if (puzzle.wordListOrderMode === 'alphabetical') {
        order = puzzle.customAlphabeticalOrder || numbers;
      }
    }
    const wordEntries = order.map(id => ({
      id,
      word: puzzle.wordList[id] || ''
    }));
      const numCols = options.listColumns;
      const totalItems = wordEntries.length;
      const itemsPerCol = Math.ceil(totalItems / numCols);
      const isRight = options.listPlacement === 'right';
      const isSeparate = options.listPlacement === 'separate';
      let nextRow = startRow;

      const cellsPerEntry = isSeparate ? 3 : ((options.boardCellMode === '3x3' && !isRight) ? 9 : 3);
      const wordColOffset = 1; // 数字のすぐ右に単語を配置

      wordEntries.forEach((entry, index) => {
        let r, c, colIndex, rowIndex;
        colIndex = Math.floor(index / itemsPerCol);
        rowIndex = index % itemsPerCol;

        if (isRight) {
          r = boardStartRow + rowIndex;
          c = (puzzle.width + 1) * colStep + 1 + colIndex * cellsPerEntry;
        } else {
          r = startRow + rowIndex;
          c = startCol + colIndex * cellsPerEntry;
        }
        
        const isArrow = puzzle.isArrowMode;
        const isNumberless = puzzle.puzzleType === 'ナンバーレス' && !forceNumbers;
        const nCell = worksheet.getCell(r, c);
        const aCell = isArrow ? worksheet.getCell(r, c + 1) : null;
        const wCell = worksheet.getCell(r, c + (isArrow ? 2 : wordColOffset));
        
        const isStar = puzzle.wordStarList?.[entry.id];
        
        if (isNumberless) {
          nCell.value = '（　）';
          wCell.value = isStar ? '★' : (entry.word || '');
        } else {
          nCell.value = entry.id;
          wCell.value = isStar ? '★' : (entry.word || '');
        }

        if (isArrow && aCell) {
          aCell.value = puzzle.wordDirections?.[entry.id] || '?';
          aCell.font = { name: defaultFontName, size: options.listFontSize };
          aCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        
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
          const numColWidth = (puzzle.puzzleType === 'ナンバーレス' && !forceNumbers) ? 5.0 : pxToChars(20);
          worksheet.getColumn(baseC).width = numColWidth;
          if (cellsPerEntry === 9) {
            worksheet.getColumn(baseC + 1).width = pxToChars(100);
          } else {
            worksheet.getColumn(baseC + 1).width = pxToChars(15);
            worksheet.getColumn(baseC + 2).width = pxToChars(100);
            worksheet.getColumn(baseC + 3).width = pxToChars(15);
          }
        }
      }

      // 5. リスト2 (Wリスト / Wリスト★)
      if ((puzzle.isWList || puzzle.isWListStar) && puzzle.wordList2 && puzzle.wordList2.length > 0) {
        const list2Words = puzzle.wordList2.filter(w => w.trim() !== '');
        if (list2Words.length > 0) {
          const itemsPerCol2 = Math.ceil(list2Words.length / numCols);
          const list2HeaderRow = (isRight ? boardStartRow + (itemsPerCol || 0) + 1 : nextRow + 1);
          const list2StartCol = (isRight ? (puzzle.width + 1) * colStep + 1 : startCol);
          
          // リスト2の見出しを追加
          const hCell = worksheet.getCell(list2HeaderRow, list2StartCol + (puzzle.isArrowMode ? 2 : wordColOffset));
          hCell.value = '＜リスト2＞';
          hCell.font = { name: defaultFontName, size: options.listFontSize, bold: true };
          if (!isRight) nextRow = list2HeaderRow;

          const list2StartRow = list2HeaderRow + 1;
          
          list2Words.forEach((word, index) => {
            const colIndex = Math.floor(index / itemsPerCol2);
            const rowIndex = index % itemsPerCol2;
            const r = list2StartRow + rowIndex;
            const c = list2StartCol + colIndex * cellsPerEntry;
            
            const wCell = worksheet.getCell(r, c + (puzzle.isArrowMode ? 2 : wordColOffset));
            wCell.value = word;
            wCell.font = { name: defaultFontName, size: options.listFontSize };
            wCell.alignment = { horizontal: 'left', vertical: 'middle' };
            
            if (!isRight) nextRow = Math.max(nextRow, r + 1);
          });
        }
      }
      return nextRow;
};

/**
 * 単語リスト単独シートの描画
 */
const renderWordListSheet = (
  worksheet: ExcelJS.Worksheet,
  puzzle: PuzzleData,
  options: ExportOptions,
  forceNumbers?: boolean
) => {
  const defaultFontName = options.fontName || 'MS Pゴシック';
  const isBold = puzzle.boardFontWeight === 'bold';
  const defaultFont = { name: defaultFontName, size: 11, bold: isBold };

  // 1. タイトル
  const displayTitle = (puzzle.boardTitle || puzzle.title || '無題のパズル') + '（単語リスト）';
  const numCols = options.listColumns;
  const mergeToCol = Math.max(1, numCols * 3 - 1); // (段数*3-1)
  worksheet.mergeCells(1, 1, 1, mergeToCol);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = displayTitle;
  titleCell.font = { ...defaultFont, size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

  // リストの描画 (startRow=3 から開始)
  renderWordList(worksheet, 3, 1, puzzle, options, defaultFontName, 1, 1, 1, forceNumbers);
  
  // 列幅の調整
  for (let i = 0; i < numCols; i++) {
    const baseC = 1 + i * 3;
    const numColWidth = (puzzle.puzzleType === 'ナンバーレス' && !forceNumbers) ? 5.0 : 2.5;
    worksheet.getColumn(baseC).width = numColWidth; // 数字の列
    if (puzzle.isArrowMode) {
      worksheet.getColumn(baseC + 1).width = 2.5; // 矢印の列: 2.50
      worksheet.getColumn(baseC + 2).width = 15; // リストの列: 15.00
    } else {
      worksheet.getColumn(baseC + 1).width = 15; // リストの列: 15.00
      worksheet.getColumn(baseC + 2).width = 2.5;  // 空きセル: 2.50
    }
  }
}

export const exportToExcel = async (puzzle: PuzzleData, options: ExportOptions, suggestedFileName?: string) => {
  const workbook = new ExcelJS.Workbook();
  // Excelの「個人情報が含まされています」警告を防ぐため、メタデータを完全に削除する
  workbook.creator = undefined as any;
  workbook.lastModifiedBy = undefined as any;
  workbook.created = undefined as any;
  workbook.modified = undefined as any;
  workbook.lastPrinted = undefined as any;
  if (workbook.properties) {
    workbook.properties = {} as any;
  }

  // 出力モード（網掛けの有無）に関わらず、常に問題と解答の両方を出力する
  const isSeparateList = options.listPlacement === 'separate';

  if (options.superLayout === 'separate') {
    const ws1 = workbook.addWorksheet('問題');
    ws1.views = [{ showGridLines: true }];
    renderPuzzleSection(ws1, 1, puzzle, options, true, !isSeparateList);
    
    if (isSeparateList) {
      const wsList = workbook.addWorksheet('単語リスト');
      wsList.views = [{ showGridLines: true }];
      renderWordListSheet(wsList, puzzle, options);
    }

    const ws2 = workbook.addWorksheet('解答');
    ws2.views = [{ showGridLines: true }];
    renderPuzzleSection(ws2, 1, puzzle, options, false, false);
  } else {
    const ws = workbook.addWorksheet('漢字ジグザグ');
    ws.views = [{ showGridLines: true }];
    const nextRow = renderPuzzleSection(ws, 1, puzzle, options, true, !isSeparateList);
    
    if (isSeparateList) {
      const wsList = workbook.addWorksheet('単語リスト');
      wsList.views = [{ showGridLines: true }];
      renderWordListSheet(wsList, puzzle, options);
    }

    renderPuzzleSection(ws, nextRow + 2, puzzle, options, false, false);
    
    // ナンバーレスパズルの場合、最後に数字入りの単語リストを追加
    if (puzzle.puzzleType === 'ナンバーレス') {
      const wsAnswerList = workbook.addWorksheet('単語リスト（解答用）');
      wsAnswerList.views = [{ showGridLines: true }];
      renderWordListSheet(wsAnswerList, puzzle, options, true);
    }
  }

  // 「問題」と「解答」が別シートの場合でも最後に追加
  if (options.superLayout === 'separate' && puzzle.puzzleType === 'ナンバーレス') {
    const wsAnswerList = workbook.addWorksheet('単語リスト（解答用）');
    wsAnswerList.views = [{ showGridLines: true }];
    renderWordListSheet(wsAnswerList, puzzle, options, true);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  // デフォルトファイル名はタイトルのみ（日付を除去）。2回目以降は前回名が優先される。
  let fileName = suggestedFileName || `${puzzle.title || 'puzzle'}.xlsx`;
  if (!fileName.toLocaleLowerCase().endsWith('.xlsx')) fileName += '.xlsx';
  
  let finalFileName = fileName;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Excel Workbook', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']}}]});
      finalFileName = handle.name;
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
  return finalFileName;
};
