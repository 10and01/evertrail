import localforage from 'localforage';
import type { GameState, House, Inventory } from '@/types/game';

const db = localforage.createInstance({
  name: 'Evertrail',
  storeName: 'state',
  description: 'Evertrail local game state',
});

export async function loadState(): Promise<GameState | null> {
  return db.getItem<GameState>('gameState');
}

export async function saveState(state: GameState): Promise<void> {
  await db.setItem('gameState', state);
}

const SAVE_KEY = 'evertrail-save';

export interface GameSave {
  nodeId: string;
  x: number;
  y: number;
  light: number;
  inventory: Inventory;
  activatedWaypoints: string[];
  collectedCollectibles: string[];
  savedAt: number;
  /** 玩家小屋数据。 */
  house?: House;
  /** 记忆锚设置的临时重生点。 */
  anchor?: {
    nodeId: string;
    x: number;
    y: number;
  };
  /** 当前激活的章节。 */
  activeChapterId?: string | null;
  /** 游戏内小时 [0,24)，用于昼夜循环。 */
  gameHour?: number;
}

export async function saveGame(save: GameSave): Promise<void> {
  await db.setItem(SAVE_KEY, save);
}

export async function loadGame(): Promise<GameSave | null> {
  return db.getItem<GameSave>(SAVE_KEY);
}
