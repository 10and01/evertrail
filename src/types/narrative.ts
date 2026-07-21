import type { Mood, Tile } from './game';

export type EntryVisibility = 'private' | 'story';
export type NarrativeLens = 'wanderer' | 'collector' | 'chronicler';
export type StoryPalette = 'dawn' | 'forest' | 'midnight' | 'paper';
export type StoryPacing = 'quiet' | 'balanced' | 'cinematic';
export type SceneTransition = 'fade' | 'page' | 'drift' | 'light';
export type SceneLayout = 'landscape' | 'portrait' | 'letter';

export interface NarrativeSignals {
  energy: 1 | 2 | 3 | 4 | 5;
  relationship: string;
  location: string;
  motifs: string[];
  growthIntent: string;
  lifeStage: import('./life').LifeStage;
  people: string[];
  objects: string[];
  values: string[];
}

export interface PrivateEntryFields {
  visibility: EntryVisibility;
  personalMeaning: string;
  signals: NarrativeSignals;
}

export interface ThemeProfile {
  lens: NarrativeLens;
  palette: StoryPalette;
  pacing: StoryPacing;
  avatarStyle: 'traveler' | 'spirit' | 'silhouette';
  preferredMotifs: string[];
  reduceMotion: boolean;
  /** 只允许未来的增强服务接收玩家确认过的脱敏摘要。 */
  aiEnhancementConsent: boolean;
}

export interface StoryScene {
  id: string;
  entryId: string;
  title: string;
  excerpt: string;
  narration: string;
  includeImage: boolean;
  transition: SceneTransition;
  layout: SceneLayout;
  duration: number;
}

export interface StoryProject {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  sceneIds: string[];
  scenes: StoryScene[];
  theme: ThemeProfile;
  coverEntryId?: string;
  endingNote: string;
  createdAt: number;
  updatedAt: number;
}

export interface TileMutation {
  x: number;
  y: number;
  type: Tile['type'];
  solid: boolean;
  decoration?: string;
  destroyed?: boolean;
  destructible?: boolean;
  plant?: Tile['plant'];
}

export interface WorldDelta {
  worldKey: string;
  tiles: TileMutation[];
  updatedAt: number;
}

export interface WorldProgress {
  activeWorldKey: string;
  deltas: Record<string, WorldDelta>;
  discoveredMotifs: string[];
}

export interface PublishedStoryEntry {
  id: string;
  date: string;
  mood: Mood;
  title: string;
  excerpt: string;
  narration: string;
  motifs: string[];
  image?: string;
}

export interface EvertrailStoryPackageV1 {
  format: 'evertrail-story';
  version: 1;
  exportedAt: string;
  project: Omit<StoryProject, 'scenes'> & { scenes: StoryScene[] };
  entries: PublishedStoryEntry[];
}

export const DEFAULT_THEME_PROFILE: ThemeProfile = {
  lens: 'wanderer',
  palette: 'dawn',
  pacing: 'balanced',
  avatarStyle: 'traveler',
  preferredMotifs: ['雨', '植物', '星光'],
  reduceMotion: false,
  aiEnhancementConsent: false,
};

export const DEFAULT_NARRATIVE_SIGNALS: NarrativeSignals = {
  energy: 3,
  relationship: '',
  location: '',
  motifs: [],
  growthIntent: '',
  lifeStage: 'unspecified',
  people: [],
  objects: [],
  values: [],
};
