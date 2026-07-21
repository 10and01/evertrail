import localforage from 'localforage';
import type { GameState, House, Inventory } from '@/types/game';
import type { WorldDelta } from '@/types/narrative';
import { DEFAULT_NARRATIVE_SIGNALS, DEFAULT_THEME_PROFILE } from '@/types/narrative';
import { DEFAULT_JOURNEY_PROGRESS } from '@/types/life';

export const CURRENT_SCHEMA_VERSION = 4;

const db = localforage.createInstance({
  name: 'Evertrail',
  storeName: 'state',
  description: 'Evertrail local game state',
});

export async function loadState(): Promise<GameState | null> {
  const stored = await db.getItem<Partial<GameState>>('gameState');
  if ((stored?.schemaVersion ?? 0) < 3) {
    await db.removeItem('evertrail-save');
  }
  return stored ? migrateGameState(stored) : null;
}

let pendingState: GameState | null = null;
let stateFlush: Promise<void> | null = null;

export async function saveState(state: GameState): Promise<void> {
  pendingState = structuredClone({ ...state, schemaVersion: CURRENT_SCHEMA_VERSION });
  if (!stateFlush) {
    stateFlush = (async () => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 80));
      while (pendingState) {
        const next = pendingState;
        pendingState = null;
        await db.setItem('gameState', next);
      }
    })().finally(() => {
      stateFlush = null;
    });
  }
  await stateFlush;
}

export function migrateGameState(state: Partial<GameState>): GameState {
  const journey = state.journeyProgress;
  const sceneStates = Object.fromEntries(
    Object.entries(journey?.sceneStates ?? {}).map(([sceneId, sceneState]) => [sceneId, {
      discoveredAnchorIds: sceneState.discoveredAnchorIds ?? [],
      puzzleStatus: sceneState.puzzleStatus ?? 'exploring',
      puzzleSelection: sceneState.puzzleSelection ?? [],
      playerProgress: Math.max(0, Math.min(1, sceneState.playerProgress ?? 0)),
      resolutionTone: sceneState.resolutionTone,
      puzzleSkipped: sceneState.puzzleSkipped ?? false,
      updatedAt: sceneState.updatedAt ?? 0,
    }])
  );
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: state.profile ?? null,
    entries: (state.entries ?? []).map((entry) => ({
      ...entry,
      visibility: entry.visibility ?? 'private',
      personalMeaning: entry.personalMeaning ?? '',
      signals: {
        ...DEFAULT_NARRATIVE_SIGNALS,
        ...(entry.signals ?? {}),
        motifs: entry.signals?.motifs ?? [],
        people: entry.signals?.people ?? [],
        objects: entry.signals?.objects ?? [],
        values: entry.signals?.values ?? [],
        lifeStage: entry.signals?.lifeStage ?? 'unspecified',
      },
    })),
    nodes: state.nodes ?? [],
    chapters: state.chapters ?? [],
    manualChapters: state.manualChapters ?? [],
    hiddenChapters: state.hiddenChapters ?? [],
    talkedEchoIds: state.talkedEchoIds ?? [],
    unlockedHiddenChapterIds: state.unlockedHiddenChapterIds ?? [],
    unlockedAchievements: state.unlockedAchievements ?? [],
    activeChapterId: state.activeChapterId ?? null,
    themeProfile: { ...DEFAULT_THEME_PROFILE, ...(state.themeProfile ?? {}) },
    storyProjects: state.storyProjects ?? [],
    journeyProgress: {
      ...DEFAULT_JOURNEY_PROGRESS,
      ...(journey ?? {}),
      activeSceneId: journey?.activeSceneId ?? null,
      visitedSceneIds: journey?.visitedSceneIds ?? [],
      completedSceneIds: journey?.completedSceneIds ?? [],
      discoveredThreadIds: journey?.discoveredThreadIds ?? [],
      reflections: journey?.reflections ?? {},
      keepsakes: (journey?.keepsakes ?? []).map((item) => ({ ...item })),
      sceneStates,
    },
    loaded: true,
  };
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
  /** 按全局或章节世界保存不可重算的地形变化。 */
  worldDeltas?: Record<string, WorldDelta>;
}

let gameWriteQueue: Promise<void> = Promise.resolve();

export async function saveGame(save: GameSave): Promise<void> {
  const snapshot = structuredClone(save);
  gameWriteQueue = gameWriteQueue.then(async () => {
    await db.setItem(SAVE_KEY, snapshot);
  });
  await gameWriteQueue;
}

export async function loadGame(): Promise<GameSave | null> {
  return db.getItem<GameSave>(SAVE_KEY);
}
