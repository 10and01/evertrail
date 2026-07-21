import { create } from 'zustand';
import type { Chapter, GameState, JournalEntry, Profile } from '@/types/game';
import type { StoryProject, ThemeProfile } from '@/types/narrative';
import { DEFAULT_NARRATIVE_SIGNALS, DEFAULT_THEME_PROFILE } from '@/types/narrative';
import type { JourneySceneState, MemoryKeepsake, ReflectionRecord } from '@/types/life';
import { DEFAULT_JOURNEY_PROGRESS } from '@/types/life';
import { generateId } from '@/lib/id';
import { computeRarity, computeStats } from '@/lib/cardGenerator';
import { buildChapters, mergeManualChapters } from '@/lib/chapterEngine';
import { checkAchievements } from '@/lib/achievementEngine';
import { CURRENT_SCHEMA_VERSION, saveState } from '@/lib/storage';
import { createStoryProject } from '@/lib/narrativeEngine';

const initialState: GameState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
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
  themeProfile: DEFAULT_THEME_PROFILE,
  storyProjects: [],
  journeyProgress: DEFAULT_JOURNEY_PROGRESS,
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
  updateThemeProfile: (profile: ThemeProfile) => void;
  createStory: (title: string, entryIds: string[]) => string;
  updateStory: (project: StoryProject) => void;
  deleteStory: (id: string) => void;
  enterJourneyScene: (sceneId: string, threadIds: string[]) => void;
  leaveJourneyScene: () => void;
  updateJourneySceneState: (sceneId: string, patch: Partial<JourneySceneState>) => void;
  recordJourneyReflection: (record: ReflectionRecord, keepsake: MemoryKeepsake) => void;
}

function createJourneySceneState(): JourneySceneState {
  return {
    discoveredAnchorIds: [],
    puzzleStatus: 'exploring',
    puzzleSelection: [],
    playerProgress: 0,
    updatedAt: Date.now(),
  };
}

function buildNextState(
  current: GameState,
  nextEntries: JournalEntry[],
  nextProfile?: Profile
): GameState {
  const sorted = [...nextEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const autoChapters = buildChapters(sorted);
  const chapters = mergeManualChapters(autoChapters, current.manualChapters, sorted);
  const profile = nextProfile || current.profile;
  const base: GameState = {
    ...current,
    profile,
    entries: sorted,
    nodes: current.nodes,
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
      schemaVersion: state.schemaVersion ?? CURRENT_SCHEMA_VERSION,
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
      themeProfile: { ...DEFAULT_THEME_PROFILE, ...(state.themeProfile || {}) },
      storyProjects: state.storyProjects || [],
      journeyProgress: {
        ...DEFAULT_JOURNEY_PROGRESS,
        ...(state.journeyProgress || {}),
        visitedSceneIds: state.journeyProgress?.visitedSceneIds || [],
        completedSceneIds: state.journeyProgress?.completedSceneIds || [],
        discoveredThreadIds: state.journeyProgress?.discoveredThreadIds || [],
        reflections: state.journeyProgress?.reflections || {},
        keepsakes: state.journeyProgress?.keepsakes || [],
        sceneStates: state.journeyProgress?.sceneStates || {},
      },
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
      visibility: data.visibility ?? 'private',
      personalMeaning: data.personalMeaning ?? '',
      signals: { ...DEFAULT_NARRATIVE_SIGNALS, ...(data.signals ?? {}) },
    };

    const current = get();
    const profile = current.profile;
    if (!profile) return;

    const nextProfile = { ...profile };
    nextProfile.lastCheckIn = data.date;

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
    const next = buildNextState(current, current.entries.filter((e) => e.id !== id));
    const removedSceneIds = new Set([
      ...Object.values(current.journeyProgress.reflections).filter((record) => record.entryId === id).map((record) => record.sceneId),
      ...current.journeyProgress.keepsakes.filter((item) => item.entryId === id).map((item) => item.sceneId).filter(Boolean) as string[],
    ]);
    const reflections = Object.fromEntries(
      Object.entries(current.journeyProgress.reflections).filter(([, record]) => record.entryId !== id)
    );
    const sceneStates = Object.fromEntries(
      Object.entries(current.journeyProgress.sceneStates).filter(([sceneId]) => !removedSceneIds.has(sceneId))
    );
    set({
      ...next,
      journeyProgress: {
        ...current.journeyProgress,
        activeSceneId: null,
        reflections,
        keepsakes: current.journeyProgress.keepsakes.filter((item) => item.entryId !== id),
        sceneStates,
      },
    });
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

  updateThemeProfile: (profile) => set({ themeProfile: profile }),

  createStory: (title, entryIds) => {
    const current = get();
    const selectedEntries = entryIds
      .map((id) => current.entries.find((entry) => entry.id === id))
      .filter(Boolean) as JournalEntry[];
    const project = createStoryProject(title, selectedEntries, current.themeProfile);
    set({ storyProjects: [...current.storyProjects, project] });
    return project.id;
  },

  updateStory: (project) => {
    const current = get();
    set({
      storyProjects: current.storyProjects.map((item) =>
        item.id === project.id ? { ...project, updatedAt: Date.now() } : item
      ),
    });
  },

  deleteStory: (id) => {
    const current = get();
    set({ storyProjects: current.storyProjects.filter((project) => project.id !== id) });
  },

  enterJourneyScene: (sceneId, threadIds) => {
    const current = get();
    const sceneState = current.journeyProgress.sceneStates[sceneId] ?? createJourneySceneState();
    set({
      journeyProgress: {
        ...current.journeyProgress,
        activeSceneId: sceneId,
        visitedSceneIds: Array.from(new Set([...current.journeyProgress.visitedSceneIds, sceneId])),
        discoveredThreadIds: Array.from(new Set([...current.journeyProgress.discoveredThreadIds, ...threadIds])),
        sceneStates: { ...current.journeyProgress.sceneStates, [sceneId]: sceneState },
      },
    });
  },

  leaveJourneyScene: () => {
    const current = get();
    set({ journeyProgress: { ...current.journeyProgress, activeSceneId: null } });
  },

  updateJourneySceneState: (sceneId, patch) => {
    const current = get();
    const previous = current.journeyProgress.sceneStates[sceneId] ?? createJourneySceneState();
    set({
      journeyProgress: {
        ...current.journeyProgress,
        sceneStates: {
          ...current.journeyProgress.sceneStates,
          [sceneId]: {
            ...previous,
            ...patch,
            discoveredAnchorIds: patch.discoveredAnchorIds ?? previous.discoveredAnchorIds,
            puzzleSelection: patch.puzzleSelection ?? previous.puzzleSelection,
            updatedAt: Date.now(),
          },
        },
      },
    });
  },

  recordJourneyReflection: (record, keepsake) => {
    const current = get();
    const previous = current.journeyProgress.sceneStates[record.sceneId] ?? createJourneySceneState();
    set({
      journeyProgress: {
        ...current.journeyProgress,
        activeSceneId: null,
        completedSceneIds: Array.from(new Set([...current.journeyProgress.completedSceneIds, record.sceneId])),
        reflections: { ...current.journeyProgress.reflections, [record.sceneId]: record },
        keepsakes: [
          ...current.journeyProgress.keepsakes.filter((item) => item.id !== keepsake.id),
          keepsake,
        ],
        sceneStates: {
          ...current.journeyProgress.sceneStates,
          [record.sceneId]: {
            ...previous,
            puzzleStatus: record.puzzleSkipped ? 'skipped' : 'solved',
            puzzleSkipped: record.puzzleSkipped,
            resolutionTone: record.tone,
            puzzleSelection: [],
            updatedAt: Date.now(),
          },
        },
      },
    });
  },
}));

useGameStore.subscribe((state) => {
  if (!state.loaded) return;
  const saveData: GameState = {
    schemaVersion: state.schemaVersion,
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
    themeProfile: state.themeProfile,
    storyProjects: state.storyProjects,
    journeyProgress: state.journeyProgress,
    loaded: state.loaded,
  };
  saveState(saveData).catch(() => null);
});
