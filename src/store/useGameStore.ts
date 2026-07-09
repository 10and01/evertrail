import { create } from 'zustand';
import type { Chapter, GameState, JournalEntry, Profile, Tile } from '@/types/game';
import { generateId } from '@/lib/id';
import { computeRarity, computeStats, xpForEntry } from '@/lib/cardGenerator';
import { generateMapNodes } from '@/lib/mapGenerator';
import { buildChapters, mergeManualChapters } from '@/lib/chapterEngine';
import { checkAchievements } from '@/lib/achievementEngine';
import { saveState } from '@/lib/storage';

const initialState: GameState = {
  profile: null,
  entries: [],
  nodes: [],
  chapters: [],
  manualChapters: [],
  hiddenChapters: [],
  talkedEchoIds: [],
  unlockedHiddenChapterIds: [],
  unlockedAchievements: [],
  activeChapterId: null,
  manualTiles: {},
  loaded: false,
};

interface GameStore extends GameState {
  setLoaded: (loaded: boolean) => void;
  loadPersisted: (state: Partial<GameState>) => void;
  initProfile: (nickname: string) => void;
  addEntry: (data: Omit<JournalEntry, 'id' | 'stats' | 'rarity' | 'createdAt' | 'updatedAt'>) => void;
  updateEntry: (entry: JournalEntry) => void;
  deleteEntry: (id: string) => void;
  markStoryteller: () => void;
  setHiddenChapters: (chapters: Chapter[]) => void;
  talkEcho: (echoId: string) => void;
  unlockHiddenChapter: (chapterId: string) => void;
  // 章节编辑
  createChapter: (chapter: Omit<Chapter, 'id' | 'unlockedAt'>) => void;
  updateChapter: (chapter: Chapter) => void;
  deleteChapter: (id: string) => void;
  moveEntry: (payload: { entryId: string; fromChapterId: string; toChapterId: string }) => void;
  reorderChapterEntries: (chapterId: string, entryIds: string[]) => void;
  setActiveChapter: (id: string | null) => void;
  // 地图编辑
  setChapterTiles: (chapterId: string, tiles: Tile[]) => void;
  addChapterTile: (chapterId: string, tile: Tile) => void;
  removeChapterTile: (chapterId: string, x: number, y: number) => void;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function levelFromXp(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

function buildNextState(
  current: GameState,
  nextEntries: JournalEntry[],
  nextProfile?: Profile
): GameState {
  const sorted = [...nextEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const nodes = generateMapNodes(sorted);
  const autoChapters = buildChapters(sorted);
  const chapters = mergeManualChapters(autoChapters, current.manualChapters, sorted);
  const profile = nextProfile || current.profile;
  const base: GameState = {
    ...current,
    profile,
    entries: sorted,
    nodes,
    chapters,
  };
  const newIds = checkAchievements(base);
  return {
    ...base,
    unlockedAchievements: Array.from(new Set([...current.unlockedAchievements, ...newIds])),
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  // 调试用：在开发环境暴露 store 到全局，便于运行时验证。
  ...(typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).__EVERTRAIL_STORE__ = { getState: get, setState: set }) : {}),

  setLoaded: (loaded) => set({ loaded }),

  loadPersisted: (state) => {
    set({
      profile: state.profile || null,
      entries: state.entries || [],
      nodes: state.nodes || [],
      chapters: state.chapters || [],
      manualChapters: state.manualChapters || [],
      hiddenChapters: state.hiddenChapters || [],
      talkedEchoIds: state.talkedEchoIds || [],
      unlockedHiddenChapterIds: state.unlockedHiddenChapterIds || [],
      unlockedAchievements: state.unlockedAchievements || [],
      activeChapterId: state.activeChapterId ?? null,
      manualTiles: state.manualTiles || {},
      loaded: true,
    });
  },

  initProfile: (nickname) => {
    const profile: Profile = {
      id: generateId(),
      nickname,
      avatarSeed: generateId(),
      level: 1,
      xp: 0,
      streak: 0,
      lastCheckIn: null,
      createdAt: new Date().toISOString(),
    };
    set({ profile, loaded: true });
  },

  addEntry: (data) => {
    const now = Date.now();
    const entry: JournalEntry = {
      ...data,
      id: generateId(),
      stats: computeStats(data.text, data.tags, data.mood),
      rarity: computeRarity(data.text, !!data.image, data.tags.length, data.mood),
      createdAt: now,
      updatedAt: now,
    };

    const current = get();
    const profile = current.profile;
    if (!profile) return;

    const nextProfile = { ...profile };
    if (!profile.lastCheckIn) {
      nextProfile.streak = 1;
    } else {
      const diff = daysBetween(profile.lastCheckIn, data.date);
      if (diff === 0) {
        // same day, streak unchanged
      } else if (diff === 1) {
        nextProfile.streak += 1;
      } else {
        nextProfile.streak = 1;
      }
    }
    nextProfile.lastCheckIn = data.date;
    nextProfile.xp += xpForEntry(entry);
    nextProfile.level = levelFromXp(nextProfile.xp);

    const next = buildNextState(current, [...current.entries, entry], nextProfile);
    set(next);
  },

  updateEntry: (entry) => {
    const current = get();
    const nextEntries = current.entries.map((e) =>
      e.id === entry.id
        ? {
            ...entry,
            stats: computeStats(entry.text, entry.tags, entry.mood),
            rarity: computeRarity(entry.text, !!entry.image, entry.tags.length, entry.mood),
            updatedAt: Date.now(),
          }
        : e
    );
    set(buildNextState(current, nextEntries));
  },

  deleteEntry: (id) => {
    const current = get();
    set(buildNextState(current, current.entries.filter((e) => e.id !== id)));
  },

  markStoryteller: () => {
    const current = get();
    if (!current.unlockedAchievements.includes('storyteller')) {
      set({
        unlockedAchievements: [...current.unlockedAchievements, 'storyteller'],
      });
    }
  },

  setHiddenChapters: (chapters) => set({ hiddenChapters: chapters }),

  talkEcho: (echoId) => {
    const current = get();
    if (current.talkedEchoIds.includes(echoId)) return;
    const next = { ...current, talkedEchoIds: [...current.talkedEchoIds, echoId] };
    const newIds = checkAchievements(next);
    set({
      talkedEchoIds: next.talkedEchoIds,
      unlockedAchievements: Array.from(new Set([...current.unlockedAchievements, ...newIds])),
    });
  },

  unlockHiddenChapter: (chapterId) => {
    const current = get();
    if (current.unlockedHiddenChapterIds.includes(chapterId)) return;
    const next = {
      ...current,
      unlockedHiddenChapterIds: [...current.unlockedHiddenChapterIds, chapterId],
    };
    const newIds = checkAchievements(next);
    set({
      unlockedHiddenChapterIds: next.unlockedHiddenChapterIds,
      unlockedAchievements: Array.from(new Set([...current.unlockedAchievements, ...newIds])),
    });
  },

  createChapter: (chapter) => {
    const current = get();
    const newChapter: Chapter = {
      ...chapter,
      id: generateId(),
      unlockedAt: Date.now(),
    };
    const nextManual = [...current.manualChapters, newChapter];
    set({
      manualChapters: nextManual,
      chapters: mergeManualChapters(current.chapters, nextManual, current.entries),
    });
  },

  updateChapter: (chapter) => {
    const current = get();
    const nextManual = current.manualChapters.map((c) => (c.id === chapter.id ? chapter : c));
    set({
      manualChapters: nextManual,
      chapters: mergeManualChapters(current.chapters, nextManual, current.entries),
    });
  },

  deleteChapter: (id) => {
    const current = get();
    const nextManual = current.manualChapters.filter((c) => c.id !== id);
    const nextActive = current.activeChapterId === id ? null : current.activeChapterId;
    set({
      manualChapters: nextManual,
      activeChapterId: nextActive,
      chapters: mergeManualChapters(current.chapters, nextManual, current.entries),
    });
  },

  moveEntry: ({ entryId, fromChapterId, toChapterId }) => {
    const current = get();
    if (fromChapterId === toChapterId) return;
    const nextManual = current.manualChapters.map((c) => {
      if (c.id === fromChapterId) {
        return { ...c, entryIds: c.entryIds.filter((eid) => eid !== entryId) };
      }
      if (c.id === toChapterId && !c.entryIds.includes(entryId)) {
        return { ...c, entryIds: [...c.entryIds, entryId] };
      }
      return c;
    });
    set({
      manualChapters: nextManual,
      chapters: mergeManualChapters(current.chapters, nextManual, current.entries),
    });
  },

  reorderChapterEntries: (chapterId, entryIds) => {
    const current = get();
    const update = (c: Chapter): Chapter =>
      c.id === chapterId ? { ...c, entryIds } : c;
    const nextManual = current.manualChapters.map(update);
    set({
      manualChapters: nextManual,
      chapters: mergeManualChapters(current.chapters, nextManual, current.entries),
    });
  },

  setActiveChapter: (id) => set({ activeChapterId: id }),

  setChapterTiles: (chapterId, tiles) => {
    const current = get();
    set({
      manualTiles: { ...current.manualTiles, [chapterId]: tiles },
    });
  },

  addChapterTile: (chapterId, tile) => {
    const current = get();
    const list = current.manualTiles[chapterId] || [];
    const filtered = list.filter((t) => t.x !== tile.x || t.y !== tile.y);
    set({
      manualTiles: { ...current.manualTiles, [chapterId]: [...filtered, tile] },
    });
  },

  removeChapterTile: (chapterId, x, y) => {
    const current = get();
    const list = current.manualTiles[chapterId] || [];
    set({
      manualTiles: {
        ...current.manualTiles,
        [chapterId]: list.filter((t) => t.x !== x || t.y !== y),
      },
    });
  },
}));

useGameStore.subscribe((state) => {
  if (!state.loaded) return;
  const saveData: GameState = {
    profile: state.profile,
    entries: state.entries,
    nodes: state.nodes,
    chapters: state.chapters,
    manualChapters: state.manualChapters,
    hiddenChapters: state.hiddenChapters,
    talkedEchoIds: state.talkedEchoIds,
    unlockedHiddenChapterIds: state.unlockedHiddenChapterIds,
    unlockedAchievements: state.unlockedAchievements,
    activeChapterId: state.activeChapterId,
    manualTiles: state.manualTiles,
    loaded: state.loaded,
  };
  saveState(saveData).catch(() => null);
});
