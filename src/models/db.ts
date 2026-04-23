import Dexie, { type Table } from 'dexie';
import { type PuzzleData } from './types';

export class ZigzagDatabase extends Dexie {
  puzzles!: Table<PuzzleData>;

  constructor() {
    super('KanjiZigzagDB');
    this.version(1).stores({
      puzzles: '++id, title, updatedAt' // idは自動増分、titleとupdatedAtでインデックスを作成
    });
  }
}

export const db = new ZigzagDatabase();
