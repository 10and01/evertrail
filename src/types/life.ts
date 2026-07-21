import type { Mood } from './game';

export type LifeEntityType = 'person' | 'place' | 'value' | 'object' | 'motif';
export type LifeStage =
  | 'unspecified'
  | 'childhood'
  | 'school'
  | 'university'
  | 'work'
  | 'relationship'
  | 'transition'
  | 'recovery';

export type SceneArchetype =
  | 'encounter'
  | 'ritual'
  | 'transition'
  | 'conflict'
  | 'celebration'
  | 'farewell';

export type AnchorKind = 'place' | 'person' | 'object' | 'feeling' | 'meaning';
export type MemoryPuzzleTemplate = 'route' | 'thread' | 'keepsake';
export type MemoryPuzzleStatus = 'exploring' | 'ready' | 'solved' | 'skipped';
export type ReflectionTone = 'hold' | 'release' | 'continue';
export type LocationGrammar = 'transit' | 'home' | 'water' | 'grove';

export interface LifeEntity {
  id: string;
  type: LifeEntityType;
  label: string;
  entryIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface LifeThread {
  id: string;
  title: string;
  entityIds: string[];
  entryIds: string[];
  resonance: number;
  lastTouchedAt: string;
}

export interface LifeSeason {
  id: string;
  title: string;
  stage: LifeStage;
  startDate: string;
  endDate: string;
  entryIds: string[];
  dominantMood: Mood;
  entityIds: string[];
}

export interface LifeGraph {
  entities: LifeEntity[];
  threads: LifeThread[];
  seasons: LifeSeason[];
}

export interface MemoryAnchor {
  id: string;
  kind: AnchorKind;
  x: number;
  label: string;
  detail: string;
  entityIds: string[];
  clue: string;
  order: number;
  optional?: boolean;
}

export interface ReflectionChoice {
  id: string;
  label: string;
  echo: string;
  tone: ReflectionTone;
}

export interface MemoryPuzzleBlueprint {
  id: string;
  template: MemoryPuzzleTemplate;
  title: string;
  prompt: string;
  instructions: string;
  anchorIds: string[];
  solution: string[];
  hint: string;
  completion: string;
}

export interface SceneVisualDirectives {
  locationGrammar: LocationGrammar;
  photoTreatment: 'frame' | 'window' | 'reflection' | 'fragments';
  paperTexture: 'fiber' | 'grain' | 'wash';
  silhouetteSpacing: 'near' | 'apart' | 'passing';
  motifProp: string;
  ambientTone: 'warm' | 'open' | 'hushed' | 'restless';
}

export interface SceneTransformation {
  tone: ReflectionTone;
  weather: MemorySceneBlueprint['weather'];
  palette: [string, string, string, string, string];
  pathState: 'lit' | 'open' | 'unfinished';
  peopleState: 'near' | 'distant' | 'echoing';
  soundscape: 'chimes' | 'wind' | 'pulse';
  ending: string;
}

export interface PersonalizationSource {
  field: 'location' | 'people' | 'objects' | 'motifs' | 'mood' | 'energy' | 'lifeStage' | 'lens';
  label: string;
  value: string;
}

export interface SceneLayerBlueprint {
  id: string;
  depth: number;
  motif: string;
  opacity: number;
}

export interface MemorySceneBlueprint {
  id: string;
  entryId: string;
  seasonId: string;
  threadIds: string[];
  archetype: SceneArchetype;
  date: string;
  location: string;
  people: string[];
  objects: string[];
  motifs: string[];
  mood: Mood;
  energy: number;
  palette: [string, string, string, string, string];
  weather: 'clear' | 'rain' | 'mist' | 'wind' | 'embers' | 'snow';
  objective: string;
  unresolvedState: string;
  layers: SceneLayerBlueprint[];
  anchors: MemoryAnchor[];
  puzzle: MemoryPuzzleBlueprint;
  visual: SceneVisualDirectives;
  transformations: Record<ReflectionTone, SceneTransformation>;
  personalization: PersonalizationSource[];
  reflectionPrompt: string;
  reflectionChoices: ReflectionChoice[];
  keepsake: MemoryKeepsake;
}

export interface MemoryKeepsake {
  id: string;
  entryId: string;
  sceneId?: string;
  label: string;
  motif: string;
  resolutionTone?: ReflectionTone;
  storyPrompt?: string;
  acquiredAt: number;
}

export interface ReflectionRecord {
  sceneId: string;
  entryId: string;
  choiceId: string;
  tone?: ReflectionTone;
  puzzleSkipped?: boolean;
  customText: string;
  reflectedAt: number;
}

export interface JourneySceneState {
  discoveredAnchorIds: string[];
  puzzleStatus: MemoryPuzzleStatus;
  puzzleSelection: string[];
  playerProgress: number;
  resolutionTone?: ReflectionTone;
  puzzleSkipped?: boolean;
  updatedAt: number;
}

export interface JourneyProgress {
  activeSceneId: string | null;
  visitedSceneIds: string[];
  completedSceneIds: string[];
  discoveredThreadIds: string[];
  reflections: Record<string, ReflectionRecord>;
  keepsakes: MemoryKeepsake[];
  sceneStates: Record<string, JourneySceneState>;
}

export const DEFAULT_JOURNEY_PROGRESS: JourneyProgress = {
  activeSceneId: null,
  visitedSceneIds: [],
  completedSceneIds: [],
  discoveredThreadIds: [],
  reflections: {},
  keepsakes: [],
  sceneStates: {},
};

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  unspecified: '未命名的阶段',
  childhood: '童年',
  school: '求学时光',
  university: '大学与远行',
  work: '工作与创造',
  relationship: '关系与陪伴',
  transition: '改变发生时',
  recovery: '恢复与重建',
};
