export const APP_VERSION = '1.4.3';
export type CellType = 'normal' | 'wall';

export interface CellStyle {
  backgroundColor?: string;
  isDoubleBorder?: boolean;
}

export interface Cell {
  x: number;
  y: number;
  type: CellType;
  char: string; // 提示文字 (問題データ)
  answerChar: string; // 解答文字 (解答データ)
  isNumbered: boolean; // 番号を振る対象かどうか
  number: number | null; // 自動計算される番号 (1, 2, 3...)
  answerKey: string | null; // A, B, C... (解答キー。右下に表示)
  isShaded?: boolean; // 「超」問題用の網掛け
  isRevealed?: boolean; // 超問題用：網掛けの下のデータが表示されているかどうか
  style: CellStyle;
  mergedParent?: { x: number, y: number }; // 結合されている場合の親マスの座標
  mergedSize?: { width: number, height: number }; // 結合サイズ (親マスのみが保持する)
  isDifferent?: boolean; // 別解探索時に、最初の解と異なる文字が入っているマス
}

export type PuzzleType = 'ノーマル' | '通常' | 'Wリスト' | 'Wリスト★' | 'ナンバーレス' | '部分ナンバーレス' | 'ウルトラ' | '変則' | '矢印';

export interface PuzzleData {
  id?: number; // Dexie用のプライマリキー
  firebaseId?: string; // FirestoreのドキュメントID
  ownerId?: string; // Firebase AuthのUID
  title: string;
  width: number; // ヨコ
  height: number; // タテ
  patternType: 1 | 2 | 3; // Type 1: 基本, Type 2: 2段, Type 3: 3x3
  puzzleType?: PuzzleType; // パズルの種類
  cells: Cell[][];
  wordList: Record<number, string>; // 番号 -> 単語
  isArrowMode?: boolean; // リストに矢印を付けるモード
  wordDirections?: Record<number, string>; // 番号 -> 矢印 (↑, →, ↓, ←, ?)
  isWList?: boolean; // Wリスト
  isWListStar?: boolean; // Wリスト★
  wordStarList?: Record<number, boolean>; // Wリスト★用の「★マス」フラグ
  wordList2?: string[]; // リスト2
  isRemainingAnswer?: boolean; // 解答余りの表示フラグ
  remainingAnswerWord?: string; // 解答余りで選択された単語
  boardTitle?: string; // 盤面表示用タイトル
  shadingColor?: string; // 網掛けの色
  boardFontWeight?: 'normal' | 'bold'; // 盤面のフォントの太さ
  boardFontFamily?: string; // 盤面のフォント名
  tags?: string[]; // タグ一覧
  customAlphabeticalOrder?: number[]; // あいうえお順の表示順序（番号の配列）
  wordListOrderMode?: 'numerical' | 'alphabetical'; // 現在の表示モード
  publicNumbers?: Record<number, boolean>; // 番号 -> 公開フラグ（部分ナンバーレス用）
  isNumbersHidden?: boolean; // 数字非表示（ウルトラモード用）
  isIrregularNumbersDisplay?: boolean; // 変則数字表示（変則モード用）
  answerColumnSpaces?: string[]; // 解答欄のスペース位置（この文字の後にスペースを入れる）

  updatedAt: number;
}

export type PrintOptions = {
  printProblem: boolean;
  printAnswer: boolean;
  layout: 'separate' | 'combined'; // 盤面とリストを分けるか、1ページに収めるか
  listColumns: number; // 単語リストの段数 (2, 3, 4, 5など)
};
