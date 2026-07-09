export type Mood = 'joy' | 'calm' | 'sad' | 'angry' | 'tired' | 'anxious';

export type MoodFormKey = Mood;

export interface MoodForm {
  speedMul: number;
  jumpBonus: number;
  passiveName: string;
  passiveDesc: string;
  auraParticle: Particle['type'];
}

export interface SoulStats {
  vitality: number;
  insight: number;
  connection: number;
  adventure: number;
}

export interface Profile {
  id: string;
  nickname: string;
  avatarSeed: string;
  level: number;
  xp: number;
  streak: number;
  lastCheckIn: string | null;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  text: string;
  mood: Mood;
  tags: string[];
  image?: string;
  stats: SoulStats;
  rarity: number;
  createdAt: number;
  updatedAt: number;
}

export interface MapNode {
  id: string;
  entryId: string;
  index: number;
  x: number;
  y: number;
  biome: string;
  seed: string;
}

export type TileType =
  | 'grass'
  | 'stone'
  | 'dirt'
  | 'wood'
  | 'platform'
  | 'gap'
  | 'raincurtain'
  | 'brittle'
  | 'water'
  | 'lava'
  | 'door'
  | 'window';

export interface Tile {
  x: number;
  y: number;
  type: TileType | 'sand' | 'snow' | 'mud' | 'ash' | 'mycelium';
  biome: Mood;
  solid: boolean;
  neighbors?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  /** 预生成的装饰物类型，避免渲染阶段每帧重新随机。 */
  decoration?: string;
  /** 被愤怒形态破坏的脆岩标记。 */
  destroyed?: boolean;
  /** 是否可被情绪工具破坏并掉落材料。 */
  destructible?: boolean;
  /** 标记为遗迹房间中心平台，用于生成稀有收集物。 */
  ruinCenter?: boolean;
  /** 植物交互状态（摘花、砍树）。 */
  plant?: PlantState;
  /** 是否属于小屋结构且受保护（仅编辑模式下可改）。 */
  houseTile?: boolean;
}

export interface PlantState {
  kind: 'flower' | 'tree' | 'deadTree' | 'cactus' | 'mushroom';
  stage: 'full' | 'stump' | 'seed';
  growthTimer: number;
}

export interface House {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floorPlan: HouseTile[][];
  decorations: HouseDecoration[];
  portal?: HousePortal;
}

export interface HouseTile {
  type: 'wall' | 'floor' | 'empty' | 'door' | 'window';
  playerPlaced?: boolean;
  /** 门窗互动状态。 */
  open?: boolean;
}

export interface HouseDecoration {
  id: string;
  kind: 'chair' | 'table' | 'lamp' | 'rug' | 'plant' | 'picture-frame' | 'crafting-table' | 'bookshelf' | 'ladder';
  gx: number;
  gy: number;
  imageUrl?: string;
  entryId?: string;
  /** 互动状态：窗户/门是否打开、椅子是否有人坐等。 */
  open?: boolean;
  /** 书架里用户导入的书籍内容。 */
  books?: { title: string; content: string }[];
}

export interface HousePortal {
  gx: number;
  gy: number;
  targetX?: number;
  targetY?: number;
}

export interface GameEntity {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerState extends GameEntity {
  vx: number;
  vy: number;
  onGround: boolean;
  facingRight: boolean;
  animFrame: number;
  animTimer: number;
  /** 光芒值 0-100，影响光源半径与危机感。 */
  light: number;
  /** 焦虑形态瞬移冷却（毫秒）。 */
  teleportCooldown?: number;
  /** 疲惫形态站立回血累计时间（毫秒）。 */
  tiredStandTimer?: number;
  /** 工具能量 0-100，使用情绪工具时消耗。 */
  toolEnergy: number;
  /** 当前剩余空中跳跃次数（二段跳等）。 */
  airJumpsLeft?: number;
  /** 最大额外空中跳跃次数。 */
  maxAirJumps?: number;
}

export interface Collectible extends GameEntity {
  id: string;
  kind: 'book' | 'camera' | 'footprint' | 'heart' | 'star' | 'leaf' | 'flame' | 'gem' | 'shard' | 'wood' | 'petal' | 'spore';
  label: string;
  entryId?: string;
  collected: boolean;
  floatOffset: number;
  /** 是否为破坏瓦片后掉落的材料（无需按 E，接触即收集）。 */
  autoCollect?: boolean;
}

export interface Waypoint extends GameEntity {
  nodeId: string;
  entryId: string;
  index: number;
  biome: Mood;
  rarity: number;
  activated: boolean;
  pulse: number;
}

export interface Echo extends GameEntity {
  id: string;
  entryId: string;
  nodeId: string;
  biome: Mood;
  lines: string[];
  unlockedChapterId?: string;
  talked: boolean;
}

export interface SaveBench extends GameEntity {
  id: string;
  nodeId: string;
  entryId: string;
  index: number;
  biome: Mood;
  glow: number;
}

export interface CraftingFurnace extends GameEntity {
  id: string;
  nodeId: string;
  entryId: string;
  biome: Mood;
  pulse: number;
}

export type AnimalKind = 'rabbit' | 'bird' | 'fish' | 'butterfly' | 'firefly';

export interface Animal extends GameEntity {
  id: string;
  kind: AnimalKind;
  biome: Mood;
  vx: number;
  vy: number;
  hopTimer?: number;
  state: 'idle' | 'hop' | 'fly' | 'swim';
}

export interface InventoryItem {
  kind: Collectible['kind'];
  label: string;
  entryId: string;
  collectedAt: number;
}

export interface Trinket {
  id: string;
  name: string;
  effect: 'double-jump' | 'light-boost' | 'mist-immunity' | 'tired-immunity';
}

export interface Inventory {
  items: InventoryItem[];
  crafted: string[];
  /** 已装备的饰品，最多 3 个。 */
  equippedTrinkets: Trinket[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  gravity: number;
  phase: number;
  alpha: number;
  baseAlpha: number;
  active: boolean;
  type:
    | 'firefly'
    | 'debris'
    | 'weapon_trail'
    | 'rain'
    | 'snow'
    | 'ember'
    | 'leaf'
    | 'sparkle'
    | 'dust';
  rotation?: number;
  rotSpeed?: number;
}

export type BiomeKey = Mood;

export interface BiomePalette {
  skyTop: string;
  skyBottom: string;
  groundTop: string;
  groundBody: string;
  groundDeep: string;
  treeTrunk: string;
  treeLeaves: string[];
  accent: string;
  particleType: Particle['type'];
  platform: string;
  water?: string;
  fog?: string;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  free: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  startId: string;
  endId: string;
  entryIds: string[];
  themeColor: string;
  unlockedAt: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (state: GameState) => boolean;
}

export interface GameState {
  profile: Profile | null;
  entries: JournalEntry[];
  nodes: MapNode[];
  chapters: Chapter[];
  /** 用户手动编辑/创建的章节覆盖。 */
  manualChapters: Chapter[];
  hiddenChapters: Chapter[];
  talkedEchoIds: string[];
  unlockedHiddenChapterIds: string[];
  unlockedAchievements: string[];
  /** 当前游戏中手动切换到的章节。 */
  activeChapterId: string | null;
  /** 按章节保存的手动地图编辑瓦片（key 为 chapterId）。 */
  manualTiles: Record<string, Tile[]>;
  loaded: boolean;
}
