import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CameraState,
  Chapter,
  Collectible,
  Echo,
  Inventory,
  JournalEntry,
  MapNode,
  PlayerState,
  SaveBench,
  Tile,
  Waypoint,
  Trinket,
  Mood,
  Animal,
  House,
  HouseDecoration,
} from '@/types/game';
import {
  createCamera,
  createPlayer,
  createParticleSystem,
  updatePlayer,
  setPlayerPosition,
  PLAYER_HEIGHT,
  generateWorld,
  extendWorld,
  shouldExtendWorld,
  applyManualTiles,
  worldToScreen,
  screenToWorld,
  BIOME_PALETTES,
  buildWaypoints,
  buildCollectibles,
  buildSaveBenches,
  checkInteraction,
  collect,
  activateWaypoint,
  findNearestBench,
  createAudioManager,
  LightingSystem,
  ParallaxBackground,
  TileRenderer,
  PostProcessSystem,
  RenderPipeline,
  EntityRenderer,
  PlayerEntity,
  CollectibleEntity,
  WaypointEntity,
  SaveBenchEntity,
  buildTreeEntities,
  buildUndergroundGems,
  buildSkyCollectibles,
  buildRuinCollectibles,
  resolveActiveEffects,
  RECIPES,
  craft,
  canCraft,
  countInventoryByKind,
  hasCrafted,
  LIGHT_MAX,
  LIGHT_RADIUS_MAX,
  LIGHT_RADIUS_MIN,
  LIGHT_RECOVERY_COLLECTIBLE,
  LIGHT_RECOVERY_WAYPOINT,
  LIGHT_DAMAGE_FALL,
  MOOD_FORMS,
  TILE_SIZE,
  WORLD_GROUND_Y,
  DAY_LENGTH_MINUTES,
  HOURS_PER_DAY,
  applyTool,
  canUseTool,
  getToolName,
  getToolDesc,
  regenToolEnergy,
  harvestPlant,
  buildAnimals,
  updateAnimals,
  AnimalEntity,
  drawMemoryScene,
  drawHouseScene,
  buildHouseSceneTiles,
  updateMemorySceneState,
  resizeHouseToScreen,
  findSurfaceYAt,
  type MemorySceneState,
} from '@/lib/game';

import type { LightSource } from '@/lib/game/LightingSystem';
import { MobileControls } from '@/lib/game/MobileControls';
import type { RenderGameState } from '@/lib/game/RenderPipeline';
import type { Entity } from '@/lib/game/Entity';

import { saveGame, loadGame } from '@/lib/storage';
import { SettingsPanel } from '@/components/SettingsPanel';
import { PictureSelector } from '@/components/PictureSelector';
import { BookEditor } from '@/components/BookEditor';
import {
  decorationAt,
  canPlaceDecoration,
  canPlaceWallDecoration,
  canPlaceLadder,
  canMoveDecorationTo,
  canPlacePortal,
  applyHouseEdit,
  findNearestHouseInteraction,
  getLadderAt,
  findHouseCraftingTable,
  getHouseFloorYs,
  type HouseTool,
} from '@/lib/game/houseEditor';
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  particleDensityMultiplier,
} from '@/lib/settings';
import type { GameSettings } from '@/lib/settings';
import { shakeCamera, updateCameraShake } from '@/lib/game/Camera';

interface MapCanvasProps {
  nodes: MapNode[];
  entries: JournalEntry[];
  chapters: Chapter[];
  hiddenChapters: Chapter[];
  talkedEchoIds: string[];
  unlockedHiddenChapterIds: string[];
  activeChapterId?: string | null;
  manualTiles?: Record<string, Tile[]>;
  onSelectEntry: (entry: JournalEntry) => void;
  onEnterChapter?: (chapter: Chapter) => void;
  onSetHiddenChapters: (chapters: Chapter[]) => void;
  onTalkEcho: (echoId: string) => void;
  onUnlockHiddenChapter: (chapterId: string) => void;
  onSetActiveChapter?: (id: string | null) => void;
  selectedId?: string | null;
}

interface Keys {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  down: boolean;
  downPressed: boolean;
  interact: boolean;
  interactPressed: boolean;
  teleport: boolean;
  teleportPressed: boolean;
  tool: boolean;
  toolPressed: boolean;
}

function isPlayerInsideHouse(player: PlayerState, house?: import('@/types/game').House): boolean {
  if (!house) return false;
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  return (
    px >= house.x &&
    px <= house.x + house.width * TILE_SIZE &&
    py >= house.y &&
    py <= house.y + house.height * TILE_SIZE
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split('');
  const lines: string[] = [];
  let current = '';
  for (const ch of words) {
    const test = current + ch;
    const w = ctx.measureText(test).width;
    if (w > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current.length > 0) lines.push(current);
  if (lines.length === 0) lines.push(text);
  return lines;
}

interface ChapterPortal {
  x: number;
  y: number;
  width: number;
  height: number;
  targetWaypointId: string;
}

function drawWorldPortal(
  ctx: CanvasRenderingContext2D,
  portal: ChapterPortal,
  camera: CameraState,
  time: number
): void {
  const screen = worldToScreen(camera, portal.x, portal.y);
  const cx = screen.x + portal.width / 2;
  const cy = screen.y + portal.height / 2;
  const pulse = 1 + Math.sin(time / 200) * 0.12;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
  gradient.addColorStop(0, 'rgba(120,200,255,0.8)');
  gradient.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(20,40,80,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,220,255,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(200,240,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 5 + Math.sin(time / 150) * 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function findNearestGapTile(player: PlayerState, tiles: Tile[]): Tile | null {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  let best: Tile | null = null;
  let bestDist = Infinity;
  for (const tile of tiles) {
    if (tile.type !== 'gap') continue;
    const cx = tile.x + TILE_SIZE / 2;
    const cy = tile.y + TILE_SIZE / 2;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist <= 80 && dist < bestDist) {
      best = tile;
      bestDist = dist;
    }
  }
  return best;
}

function spawnBridge(gapTile: Tile, tiles: Tile[], bridgeTiles: Tile[]): void {
  // 将心桥覆盖缺口及其左右相邻的缺口列（直接修改缺口瓦片）。
  const startX = gapTile.x - TILE_SIZE;
  const endX = gapTile.x + TILE_SIZE;
  for (let wx = startX; wx <= endX; wx += TILE_SIZE) {
    const existing = tiles.find((t) => t.x === wx && t.y === gapTile.y);
    if (existing && existing.type === 'gap') {
      existing.type = 'platform';
      existing.solid = true;
      bridgeTiles.push(existing);
    }
  }
}

function computeBiomeBlend(
  nodes: MapNode[],
  x: number
): { biome: Mood; blendBiome?: Mood; blendT: number } {
  if (nodes.length === 0) return { biome: 'calm', blendT: 0 };
  if (nodes.length === 1 || x <= nodes[0].x) return { biome: nodes[0].biome as Mood, blendT: 0 };
  if (x >= nodes[nodes.length - 1].x) return { biome: nodes[nodes.length - 1].biome as Mood, blendT: 0 };

  for (let i = 0; i < nodes.length - 1; i++) {
    if (x >= nodes[i].x && x < nodes[i + 1].x) {
      const left = nodes[i];
      const right = nodes[i + 1];
      const distance = right.x - left.x;
      const t = distance > 0 ? (x - left.x) / distance : 0;
      return {
        biome: left.biome as Mood,
        blendBiome: right.biome as Mood,
        blendT: Math.max(0, Math.min(1, t)),
      };
    }
  }

  return { biome: nodes[nodes.length - 1].biome as Mood, blendT: 0 };
}

function readGamepadInput(): Pick<Keys, 'left' | 'right' | 'jump' | 'jumpPressed' | 'down' | 'downPressed' | 'interact' | 'interactPressed' | 'tool' | 'toolPressed'> | null {
  const gamepads = navigator.getGamepads?.() || [];
  for (const gp of gamepads) {
    if (!gp) continue;
    const lx = gp.axes[0] ?? 0;
    const deadzone = 0.15;
    const left = lx < -deadzone;
    const right = lx > deadzone;

    // A button (button 0) / X button (button 2) for jump.
    const jump = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);

    // D-pad down / left stick down for down.
    const dpadDown = !!gp.buttons[13]?.pressed;
    const stickDown = (gp.axes[1] ?? 0) > deadzone;
    const down = dpadDown || stickDown;

    // X button (button 2) for interact, B (button 1) as alternative.
    const interact = !!(gp.buttons[2]?.pressed || gp.buttons[1]?.pressed);

    // Right shoulder (button 5) for tool.
    const tool = !!gp.buttons[5]?.pressed;

    return { left, right, jump, jumpPressed: jump, down, downPressed: down, interact, interactPressed: interact, tool, toolPressed: tool };
  }
  return null;
}

function findNearestUncollectedCollectible(player: PlayerState, collectibles: Collectible[]): Collectible | null {
  let best: Collectible | null = null;
  let bestDist = Infinity;
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  for (const c of collectibles) {
    if (c.collected) continue;
    const cx = c.x + c.width / 2;
    const cy = c.y + c.height / 2;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

export function MapCanvas({
  nodes,
  entries,
  chapters,
  hiddenChapters,
  talkedEchoIds,
  unlockedHiddenChapterIds,
  activeChapterId,
  manualTiles,
  onSelectEntry,
  onEnterChapter,
  onSetHiddenChapters,
  onTalkEcho,
  onUnlockHiddenChapter,
  onSetActiveChapter,
  selectedId,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });

  // 高频变化的游戏状态使用 ref，避免 React 重渲染。
  const playerRef = useRef<PlayerState | null>(null);
  const cameraRef = useRef<CameraState>(createCamera(0, 0));
  const keysRef = useRef<Keys>({
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    down: false,
    downPressed: false,
    interact: false,
    interactPressed: false,
    teleport: false,
    teleportPressed: false,
    tool: false,
    toolPressed: false,
  });
  const gamepadKeysRef = useRef<Keys>({
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    down: false,
    downPressed: false,
    interact: false,
    interactPressed: false,
    teleport: false,
    teleportPressed: false,
    tool: false,
    toolPressed: false,
  });
  const tilesRef = useRef<Tile[]>([]);
  const waypointsRef = useRef<Waypoint[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const saveBenchesRef = useRef<SaveBench[]>([]);
  const entitiesRef = useRef<Entity[]>([]);
  const animalsRef = useRef<Animal[]>([]);
  const inventoryRef = useRef<Inventory>({ items: [], crafted: [], equippedTrinkets: [] });
  const craftedEffectsRef = useRef<Record<string, number>>({});
  const floatingTextsRef = useRef<{ text: string; x: number; y: number; timer: number; maxLife: number }[]>([]);
  const bridgeTilesRef = useRef<Tile[]>([]);
  const temporaryPlatformsRef = useRef<{ tile: Tile; expiresAt: number }[]>([]);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [chapterSelectorOpen, setChapterSelectorOpen] = useState(false);
  const chapterSelectorOpenRef = useRef(false);
  const [houseEditMode, setHouseEditMode] = useState(false);
  const houseEditModeRef = useRef(false);
  const [pictureSelectorOpen, setPictureSelectorOpen] = useState(false);
  const pictureSelectorOpenRef = useRef(false);
  const [pictureViewerOpen, setPictureViewerOpen] = useState(false);
  const pictureViewerOpenRef = useRef(false);
  const [pictureViewerUrl, setPictureViewerUrl] = useState<string | undefined>(undefined);
  const [portalSelectorOpen, setPortalSelectorOpen] = useState(false);
  const portalSelectorOpenRef = useRef(false);
  const [bookEditorTarget, setBookEditorTarget] = useState<{ gx: number; gy: number } | null>(null);
  const bookEditorTargetRef = useRef<{ gx: number; gy: number } | null>(null);
  const selectedHouseToolRef = useRef<HouseTool>('wall');
  const pendingFramePosRef = useRef<{ gx: number; gy: number } | null>(null);
  const hoverHouseGridRef = useRef<{ gx: number; gy: number } | null>(null);
  const draggingDecoRef = useRef<HouseDecoration | null>(null);
  const dragStartCellRef = useRef<{ gx: number; gy: number } | null>(null);
  const isDraggingFurnitureRef = useRef(false);
  const pendingHouseInteractRef = useRef(false);
  const onLadderRef = useRef(false);
  const currentSceneRef = useRef<'world' | 'memory' | 'house'>('world');
  const sceneTransitionRef = useRef<{
    active: boolean;
    alpha: number;
    direction: 'in' | 'out';
    nextScene?: 'world' | 'memory' | 'house';
    payload?: unknown;
  }>({ active: false, alpha: 0, direction: 'out' });
  const memorySceneRef = useRef<MemorySceneState | null>(null);
  const houseReturnPosRef = useRef<{ x: number; y: number } | null>(null);
  const houseSceneTilesRef = useRef<Tile[]>([]);
  const chapterPortalRef = useRef<ChapterPortal | null>(null);
  const lastInteractedWaypointIdRef = useRef<string | null>(null);
  const mapOpenRef = useRef(false);
  mapOpenRef.current = mapOpen;
  chapterSelectorOpenRef.current = chapterSelectorOpen;
  houseEditModeRef.current = houseEditMode;
  pictureSelectorOpenRef.current = pictureSelectorOpen;
  pictureViewerOpenRef.current = pictureViewerOpen;
  bookEditorTargetRef.current = bookEditorTarget;
  portalSelectorOpenRef.current = portalSelectorOpen;
  const worldRef = useRef<import('@/lib/game/World').WorldData | null>(null);
  const houseRef = useRef<import('@/types/game').House | undefined>(undefined);
  const particlesRef = useRef(createParticleSystem());
  const audioRef = useRef(createAudioManager());

  const lightRef = useRef(LIGHT_MAX);
  const sittingRef = useRef(false);
  const sittingBenchRef = useRef<SaveBench | null>(null);
  const nearFurnaceRef = useRef(false);
  const sittingTimerRef = useRef(0);
  const saveMessageRef = useRef<{ text: string; timer: number } | null>(null);
  const lastSaveAtRef = useRef(0);
  const currentMoodFormRef = useRef<Mood>('calm');
  const lastMoodFormRef = useRef<Mood | null>(null);
  const moodHintRef = useRef<{ text: string; timer: number } | null>(null);
  const renderBiomeRef = useRef<Mood>('calm');
  const blendBiomeRef = useRef<Mood | undefined>(undefined);
  const blendTRef = useRef<number>(0);
  const lastToolUseTimeRef = useRef(0);
  const gameHourRef = useRef(8);

  // 渲染子系统实例（不触发重渲染）。

  const lightingRef = useRef(new LightingSystem());
  const parallaxRef = useRef(new ParallaxBackground());
  const tileRendererRef = useRef(new TileRenderer());
  const postProcessorRef = useRef(new PostProcessSystem());
  const entityRendererRef = useRef(new EntityRenderer());
  const renderPipelineRef = useRef<RenderPipeline | null>(null);

  if (!renderPipelineRef.current) {
    renderPipelineRef.current = new RenderPipeline(
      parallaxRef.current,
      tileRendererRef.current,
      entityRendererRef.current,
      particlesRef.current,
      lightingRef.current,
      postProcessorRef.current
    );
  }

  const lastTimeRef = useRef(0);
  const requestRef = useRef<number>();
  const hintRef = useRef<{ text: string; timer: number } | null>(null);
  const interactCooldownRef = useRef(0);
  const selectedIdRef = useRef(selectedId);
  const callbacksRef = useRef({
    onSelectEntry,
    onEnterChapter,
    onTalkEcho,
    onUnlockHiddenChapter,
    hiddenChapters,
    unlockedHiddenChapterIds,
  });
  const mutedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const firstTimeHintRef = useRef<{ text: string; timer: number } | null>(null);

  settingsRef.current = settings;

  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__EVERTRAIL_DEBUG__ = {
      playerRef,
      cameraRef,
      keysRef,
      interactCooldownRef,
    };
  }

  selectedIdRef.current = selectedId;
  callbacksRef.current = {
    onSelectEntry,
    onEnterChapter,
    onTalkEcho,
    onUnlockHiddenChapter,
    hiddenChapters,
    unlockedHiddenChapterIds,
  };

  // 监听容器尺寸。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // 加载设置并同步音频。
  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      settingsRef.current = loaded;
      audioRef.current.applySettings(loaded);
      audioRef.current.setAudioPack(loaded.audioPack || 'synth');
      mutedRef.current = loaded.masterVolume <= 0;
      audioRef.current.setMuted(mutedRef.current);

      // 首次进入提示：若之前没有保存过设置，视为首次。
      const isDefault =
        loaded.masterVolume === DEFAULT_SETTINGS.masterVolume &&
        loaded.sfxVolume === DEFAULT_SETTINGS.sfxVolume &&
        loaded.musicVolume === DEFAULT_SETTINGS.musicVolume &&
        loaded.particleDensity === DEFAULT_SETTINGS.particleDensity &&
        loaded.lightingQuality === DEFAULT_SETTINGS.lightingQuality &&
        loaded.cameraSmoothSpeed === DEFAULT_SETTINGS.cameraSmoothSpeed &&
        loaded.screenShake === DEFAULT_SETTINGS.screenShake &&
        loaded.reduceMotion === DEFAULT_SETTINGS.reduceMotion;
      if (isDefault) {
        firstTimeHintRef.current = {
          text: 'A/D 移动 · Space/W 跳跃 · E/Enter 交互 · 拖拽镜头 · Esc 设置',
          timer: 5000,
        };
      }
    });
  }, []);

  // 数据变化时重建世界、实体与渲染列表。
  useEffect(() => {
    const activeChapter = activeChapterId ? chapters.find((c) => c.id === activeChapterId) : undefined;
    const activeEntries = activeChapter
      ? entries.filter((e) => activeChapter.entryIds.includes(e.id))
      : entries;
    const activeNodeSet = new Set(activeEntries.map((e) => e.id));
    const activeNodes = activeChapter
      ? nodes.filter((n) => activeNodeSet.has(n.entryId))
      : nodes;

    const world = generateWorld(activeEntries, activeNodes);
    const chapterTiles = activeChapter ? manualTiles?.[activeChapter.id] : undefined;
    if (chapterTiles && chapterTiles.length > 0) {
      applyManualTiles(world, chapterTiles);
    }
    worldRef.current = world;
    tilesRef.current = world.tiles;
    houseRef.current = world.house;
    chapterPortalRef.current = null;
    lastInteractedWaypointIdRef.current = null;
    animalsRef.current = buildAnimals(activeNodes, world.tiles);
    waypointsRef.current = buildWaypoints(activeNodes, activeEntries, world.tiles);
    const baseCollectibles = buildCollectibles(activeEntries, activeNodes);
    const undergroundGems = buildUndergroundGems(world.tiles, 24);
    const skyCollectibles = buildSkyCollectibles(nodes, world.tiles);
    const ruinCollectibles = buildRuinCollectibles(world.tiles);
    collectiblesRef.current = [...baseCollectibles, ...undergroundGems, ...skyCollectibles, ...ruinCollectibles];
    saveBenchesRef.current = buildSaveBenches(nodes, entries);

    const latestNode = nodes.length > 0 ? nodes[nodes.length - 1] : { x: 200, y: 200 };
    const fallbackX = latestNode.x;
    const surfaceY = findSurfaceYAt(world.tiles, fallbackX);
    const fallbackY = surfaceY ? surfaceY - PLAYER_HEIGHT : latestNode.y - PLAYER_HEIGHT;

    // 异步读取存档并恢复游戏进度。
    loadGame().then((save) => {
      const player = playerRef.current;
      if (!player) return;

      let spawnX = fallbackX;
      let spawnY = fallbackY;

      if (save) {
        const bench = saveBenchesRef.current.find((b) => b.nodeId === save.nodeId);
        const nodeExists = nodes.some((n) => n.id === save.nodeId);
        const anchorNodeExists = save.anchor && nodes.some((n) => n.id === save.anchor!.nodeId);

        if (save.anchor && anchorNodeExists) {
          spawnX = save.anchor.x - player.width / 2;
          spawnY = save.anchor.y;
        } else if (bench && nodeExists) {
          spawnX = bench.x + bench.width / 2 - player.width / 2;
          spawnY = bench.y - player.height;
        }

        lightRef.current = Math.max(0, Math.min(LIGHT_MAX, save.light));
        inventoryRef.current = {
          items: [],
          crafted: [],
          equippedTrinkets: [],
          ...(save.inventory || {}),
        };

        if (save.activeChapterId != null && onSetActiveChapter) {
          onSetActiveChapter(save.activeChapterId);
        }
        if (typeof save.gameHour === 'number') {
          gameHourRef.current = save.gameHour;
        }

        for (const nodeId of save.activatedWaypoints || []) {
          const wp = waypointsRef.current.find((w) => w.nodeId === nodeId);
          if (wp) wp.activated = true;
        }

        for (const id of save.collectedCollectibles || []) {
          const c = collectiblesRef.current.find((item) => item.id === id);
          if (c) c.collected = true;
        }

        if (save.house && houseRef.current && save.house.id === houseRef.current.id) {
          houseRef.current.floorPlan = save.house.floorPlan;
          houseRef.current.decorations = save.house.decorations;
          houseRef.current.portal = save.house.portal;
        }
      }

      // 确保出生点落在空地上的实心表面。
      const groundY = findSurfaceYAt(tilesRef.current, spawnX);
      if (groundY != null) {
        spawnY = groundY - player.height;
      }

      setPlayerPosition(player, spawnX, spawnY);

      const cam = cameraRef.current;
      cam.free = false;
      cam.targetX = spawnX - size.width / 2;
      cam.targetY = spawnY - size.height * 0.65;
      cam.x = cam.targetX;
      cam.y = cam.targetY;
    });

    if (!playerRef.current) {
      playerRef.current = createPlayer(fallbackX, fallbackY);
    } else {
      setPlayerPosition(playerRef.current, fallbackX, fallbackY);
      lightRef.current = LIGHT_MAX;
      inventoryRef.current = { items: [], crafted: [], equippedTrinkets: [] };
      craftedEffectsRef.current = {};
      bridgeTilesRef.current = [];
      floatingTextsRef.current = [];
    }

    rebuildEntities();

    const cam = cameraRef.current;
    cam.free = false;
    cam.targetX = fallbackX - size.width / 2;
    cam.targetY = fallbackY - size.height * 0.65;
    cam.x = cam.targetX;
    cam.y = cam.targetY;
  }, [entries, nodes, chapters, size.width, size.height]);

  // 退出小屋编辑模式时保存。
  useEffect(() => {
    if (!houseEditMode && houseRef.current) {
      saveGame({
        nodeId: '',
        x: 0,
        y: 0,
        light: lightRef.current,
        inventory: inventoryRef.current,
        activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
        collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
        savedAt: Date.now(),
        gameHour: gameHourRef.current,
        house: houseRef.current,
      }).catch(() => null);
    }
  }, [houseEditMode]);

  function rebuildEntities() {
    const player = playerRef.current;
    if (!player) return;

    const playerEntity = new PlayerEntity(player, () => currentMoodFormRef.current);
    const collectibleEntities = collectiblesRef.current.map((c) => new CollectibleEntity(c));
    const treeEntities = buildTreeEntities(tilesRef.current);
    const waypointEntities = waypointsRef.current.map(
      (w) => new WaypointEntity(w, () => selectedIdRef.current === w.entryId)
    );
    const benchEntities = saveBenchesRef.current.map(
      (b) => new SaveBenchEntity(b, () => sittingBenchRef.current?.id === b.id)
    );
    const animalEntities = animalsRef.current.map((a) => new AnimalEntity(a));

    // 渲染顺序：远景树 -> 路径点 -> 存档长椅 -> 动物 -> 收集物 -> 玩家。
    entitiesRef.current = [
      ...treeEntities,
      ...waypointEntities,
      ...benchEntities,
      ...animalEntities,
      ...collectibleEntities,
      playerEntity,
    ];
  }

  // 键盘输入（useCallback 保持引用稳定）。
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (currentSceneRef.current === 'memory' && memorySceneRef.current) {
        exitMemoryScene();
        return;
      }
      if (currentSceneRef.current === 'house') {
        exitHouseScene();
        return;
      }
      if (chapterSelectorOpenRef.current) {
        setChapterSelectorOpen(false);
        return;
      }
      if (portalSelectorOpenRef.current) {
        setPortalSelectorOpen(false);
        return;
      }
      if (pictureSelectorOpenRef.current) {
        setPictureSelectorOpen(false);
        pendingFramePosRef.current = null;
        return;
      }
      if (pictureViewerOpenRef.current) {
        setPictureViewerOpen(false);
        return;
      }
      if (bookEditorTargetRef.current) {
        setBookEditorTarget(null);
        return;
      }
      if (houseEditModeRef.current) {
        setHouseEditMode(false);
        return;
      }
      setSettingsOpen((prev) => !prev);
      return;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (currentSceneRef.current === 'house') {
        setHouseEditMode((prev) => !prev);
      }
      return;
    }
    if (houseEditModeRef.current) {
      // 编辑模式下数字键快速选择工具。
      const toolMap: Record<string, HouseTool> = {
        Digit1: 'wall',
        Digit2: 'floor',
        Digit3: 'door',
        Digit4: 'window',
        Digit5: 'empty',
        Digit6: 'chair',
        Digit7: 'table',
        Digit8: 'lamp',
        Digit9: 'rug',
        Digit0: 'plant',
        KeyP: 'picture-frame',
        KeyO: 'portal',
        KeyB: 'bookshelf',
        KeyL: 'ladder',
        KeyM: 'move',
        KeyX: 'delete',
      };
      const mapped = toolMap[e.code];
      if (mapped) {
        e.preventDefault();
        selectedHouseToolRef.current = mapped;
        setInventoryVersion((v) => v + 1);
      }
      return;
    }
    // 记忆场景：仅响应 E/Enter 跳过文本或退出。
    if (currentSceneRef.current === 'memory') {
      if (e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        const state = memorySceneRef.current;
        if (state && state.charIndex < state.entry.text.length) {
          state.charIndex = state.entry.text.length;
        } else {
          exitMemoryScene();
        }
      }
      return;
    }

    // 小屋场景：允许移动与交互。
    if (currentSceneRef.current === 'house') {
      const k = keysRef.current;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = true;
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        if (!k.jump) k.jumpPressed = true;
        k.jump = true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (!k.down) k.downPressed = true;
        k.down = true;
      }
      if (e.code === 'KeyE' || e.code === 'Enter') {
        if (!k.interact) k.interactPressed = true;
        k.interact = true;
      }
      return;
    }

    if (pictureSelectorOpenRef.current || portalSelectorOpenRef.current || chapterSelectorOpenRef.current) return;
    if (e.code === 'KeyI') {
      e.preventDefault();
      setInventoryOpen((prev) => !prev);
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      setMapOpen((prev) => {
        mapOpenRef.current = !prev;
        return !prev;
      });
      return;
    }
    if (e.code === 'KeyC') {
      e.preventDefault();
      setChapterSelectorOpen((prev) => !prev);
      return;
    }
    if (e.code === 'KeyH') {
      e.preventDefault();
      if (currentSceneRef.current === 'world') {
        enterHouseScene();
      }
      return;
    }
    const k = keysRef.current;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = true;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
      if (!k.jump) k.jumpPressed = true;
      k.jump = true;
    }
    if (e.code === 'KeyE' || e.code === 'Enter') {
      if (!k.interact) k.interactPressed = true;
      k.interact = true;
    }
    if (e.code === 'KeyQ') {
      if (!k.teleport) k.teleportPressed = true;
      k.teleport = true;
    }
    if (e.code === 'KeyT') {
      if (!k.tool) k.toolPressed = true;
      k.tool = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const k = keysRef.current;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = false;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') k.jump = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') k.down = false;
    if (e.code === 'KeyE' || e.code === 'Enter') k.interact = false;
    if (e.code === 'KeyQ') k.teleport = false;
    if (e.code === 'KeyT') k.tool = false;
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // 鼠标拖拽移动镜头。
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cameraDragStart = useRef({ x: 0, y: 0 });
  const mouseWorldRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    cameraDragStart.current = { x: cameraRef.current.x, y: cameraRef.current.y };

    // 小屋编辑模式下，移工具优先尝试拖拽家具。
    if (houseEditModeRef.current && houseRef.current && selectedHouseToolRef.current === 'move') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const worldPos = screenToWorld(cameraRef.current, e.clientX - rect.left, e.clientY - rect.top);
        const house = houseRef.current;
        const gx = Math.floor((worldPos.x - house.x) / TILE_SIZE);
        const gy = Math.floor((worldPos.y - house.y) / TILE_SIZE);
        const deco = decorationAt(house, gx, gy);
        if (deco) {
          draggingDecoRef.current = deco;
          dragStartCellRef.current = { gx: deco.gx, gy: deco.gy };
          isDraggingFurnitureRef.current = true;
          return;
        }
      }
    }

    cameraRef.current.free = true;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseWorldRef.current = screenToWorld(cameraRef.current, e.clientX - rect.left, e.clientY - rect.top);
    }
    if (houseEditModeRef.current && houseRef.current && mouseWorldRef.current) {
      const house = houseRef.current;
      const wx = mouseWorldRef.current.x;
      const wy = mouseWorldRef.current.y;
      const gx = Math.floor((wx - house.x) / TILE_SIZE);
      const gy = Math.floor((wy - house.y) / TILE_SIZE);
      if (gx >= 0 && gx < house.width && gy >= 0 && gy < house.height) {
        hoverHouseGridRef.current = { gx, gy };
      } else {
        hoverHouseGridRef.current = null;
      }
    } else {
      hoverHouseGridRef.current = null;
    }

    // 编辑模式下拖拽家具时实时更新位置。
    if (isDraggingFurnitureRef.current && draggingDecoRef.current && houseRef.current && hoverHouseGridRef.current) {
      const house = houseRef.current;
      const deco = draggingDecoRef.current;
      const { gx, gy } = hoverHouseGridRef.current;
      if (canMoveDecorationTo(house, deco, gx, gy)) {
        deco.gx = gx;
        deco.gy = gy;
      }
      return;
    }

    if (!isDragging.current) return;
    const dx = dragStart.current.x - e.clientX;
    const dy = dragStart.current.y - e.clientY;
    cameraRef.current.targetX = cameraDragStart.current.x + dx;
    cameraRef.current.targetY = cameraDragStart.current.y + dy;
  }, []);

  const handlePictureSelect = useCallback((imageUrl: string) => {
    const pos = pendingFramePosRef.current;
    const house = houseRef.current;
    if (pos && house) {
      house.decorations.push({
        id: `house-picture-${Date.now()}`,
        kind: 'picture-frame',
        gx: pos.gx,
        gy: pos.gy,
        imageUrl,
      });
      pendingFramePosRef.current = null;
      setPictureSelectorOpen(false);
      saveGame({
        nodeId: '',
        x: 0,
        y: 0,
        light: lightRef.current,
        inventory: inventoryRef.current,
        activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
        collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
        savedAt: Date.now(),
        gameHour: gameHourRef.current,
        house,
      }).catch(() => null);
    }
  }, []);

  const enterMemoryScene = useCallback((entry: JournalEntry) => {
    if (sceneTransitionRef.current.active) return;
    callbacksRef.current.onSelectEntry(entry);
    sceneTransitionRef.current = {
      active: true,
      alpha: 0,
      direction: 'in',
      nextScene: 'memory',
      payload: entry,
    };
  }, []);

  const exitMemoryScene = useCallback(() => {
    if (sceneTransitionRef.current.active) return;

    const lastId = lastInteractedWaypointIdRef.current;
    if (lastId) {
      const sorted = [...waypointsRef.current].sort((a, b) => a.index - b.index);
      const currentIndex = sorted.findIndex((w) => w.nodeId === lastId);
      const next = currentIndex >= 0 ? sorted[currentIndex + 1] : undefined;
      const current = currentIndex >= 0 ? sorted[currentIndex] : undefined;
      if (next && current) {
        const portalW = 28;
        const portalH = 48;
        chapterPortalRef.current = {
          x: current.x + current.width / 2 + TILE_SIZE * 1.5 - portalW / 2,
          y: current.y + current.height - portalH,
          width: portalW,
          height: portalH,
          targetWaypointId: next.nodeId,
        };
        audioRef.current.playUnlock();
      }
    }
    lastInteractedWaypointIdRef.current = null;

    sceneTransitionRef.current = {
      active: true,
      alpha: 0,
      direction: 'in',
      nextScene: 'world',
    };
  }, []);

  const enterHouseScene = useCallback(() => {
    const house = houseRef.current;
    const player = playerRef.current;
    if (!house || !player || sceneTransitionRef.current.active) return;

    // 记录进入前的世界位置，退出时返回此处。
    houseReturnPosRef.current = { x: player.x, y: player.y };

    // 调整房屋大小以覆盖整个屏幕，并保留已有编辑。
    const resizedHouse = resizeHouseToScreen(house, size.width, size.height, entries);
    houseRef.current = resizedHouse;

    // 把玩家放到门内正中央、地板上方一格，落下后自然站在地板上。
    const doorGx = Math.floor(resizedHouse.width / 2);
    const doorGy = resizedHouse.height - 1;
    const spawnGx = doorGx;
    setPlayerPosition(
      player,
      resizedHouse.x + spawnGx * TILE_SIZE + (TILE_SIZE - player.width) / 2,
      resizedHouse.y + (doorGy - 1) * TILE_SIZE
    );
    player.vx = 0;
    player.vy = 0;

    // 构建室内碰撞瓦片。
    houseSceneTilesRef.current = buildHouseSceneTiles(resizedHouse);

    sceneTransitionRef.current = {
      active: true,
      alpha: 0,
      direction: 'in',
      nextScene: 'house',
    };
  }, [size.width, size.height]);

  const exitHouseScene = useCallback(() => {
    const player = playerRef.current;
    const pos = houseReturnPosRef.current;
    if (player && pos) {
      setPlayerPosition(player, pos.x, pos.y);
      player.vx = 0;
      player.vy = 0;
    }
    houseSceneTilesRef.current = [];
    if (sceneTransitionRef.current.active) return;
    sceneTransitionRef.current = {
      active: true,
      alpha: 0,
      direction: 'in',
      nextScene: 'world',
    };
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (currentSceneRef.current === 'memory' && memorySceneRef.current) {
        if (memorySceneRef.current.charIndex < memorySceneRef.current.entry.text.length) {
          memorySceneRef.current.charIndex = memorySceneRef.current.entry.text.length;
        } else {
          exitMemoryScene();
        }
        return;
      }
      if (!isDragging.current) return;
      isDragging.current = false;

      // 家具拖拽结束：保存位置并重置状态。
      if (isDraggingFurnitureRef.current) {
        isDraggingFurnitureRef.current = false;
        const house = houseRef.current;
        const deco = draggingDecoRef.current;
        if (house && deco) {
          if (!canMoveDecorationTo(house, deco, deco.gx, deco.gy)) {
            const start = dragStartCellRef.current;
            if (start) {
              deco.gx = start.gx;
              deco.gy = start.gy;
            }
          }
          saveGame({
            nodeId: '',
            x: 0,
            y: 0,
            light: lightRef.current,
            inventory: inventoryRef.current,
            activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
            collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
            savedAt: Date.now(),
            gameHour: gameHourRef.current,
            house,
          }).catch(() => null);
        }
        draggingDecoRef.current = null;
        dragStartCellRef.current = null;
        return;
      }

      const dx = Math.abs(dragStart.current.x - e.clientX);
      const dy = Math.abs(dragStart.current.y - e.clientY);
      if (dx > 6 || dy > 6) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldPos = screenToWorld(cameraRef.current, e.clientX - rect.left, e.clientY - rect.top);

      // 小屋编辑模式下点击网格修改结构或装饰。
      if (houseEditModeRef.current && houseRef.current) {
        const house = houseRef.current;
        const gx = Math.floor((worldPos.x - house.x) / TILE_SIZE);
        const gy = Math.floor((worldPos.y - house.y) / TILE_SIZE);
        if (gx >= 0 && gx < house.width && gy >= 0 && gy < house.height) {
          const changed = applyHouseEdit(house, gx, gy, selectedHouseToolRef.current, (pos) => {
            pendingFramePosRef.current = pos;
            setPictureSelectorOpen(true);
          });
          if (changed && !pictureSelectorOpenRef.current) {
            if (currentSceneRef.current === 'house') {
              houseSceneTilesRef.current = buildHouseSceneTiles(house);
            }
            saveGame({
              nodeId: '',
              x: 0,
              y: 0,
              light: lightRef.current,
              inventory: inventoryRef.current,
              activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
              collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
              savedAt: Date.now(),
        gameHour: gameHourRef.current,
              house,
            }).catch(() => null);
          }
        }
        return;
      }

      // 小屋内点击可交互物品直接触发交互（非编辑模式、非拖拽）。
      if (currentSceneRef.current === 'house' && !houseEditModeRef.current && houseRef.current && playerRef.current) {
        const interaction = findNearestHouseInteraction(houseRef.current, playerRef.current);
        if (interaction) {
          pendingHouseInteractRef.current = true;
          return;
        }
      }

      // 点击路径点打开回忆。
      const hit = waypointsRef.current.find((w) => {
        const cx = w.x + w.width / 2;
        const cy = w.y + w.height / 2;
        return Math.hypot(cx - worldPos.x, cy - worldPos.y) < 40;
      });
      if (hit) {
        const entry = entries.find((en) => en.id === hit.entryId);
        if (entry) {
          lastInteractedWaypointIdRef.current = hit.nodeId;
          enterMemoryScene(entry);
        }
        audioRef.current.playOpenMemory();
      }
    },
    [entries, enterMemoryScene]
  );

  // 游戏循环。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time - 16;
      const delta = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;

      // 推进游戏内时间：24 小时对应现实 DAY_LENGTH_MINUTES 分钟。
      const msPerGameHour = (DAY_LENGTH_MINUTES * 60 * 1000) / HOURS_PER_DAY;
      gameHourRef.current = (gameHourRef.current + delta / msPerGameHour) % HOURS_PER_DAY;

      const player = playerRef.current;
      const camera = cameraRef.current;
      const keys = keysRef.current;
      const gamepadKeys = gamepadKeysRef.current;
      const particles = particlesRef.current;
      const audio = audioRef.current;
      const world = worldRef.current;
      const currentSettings = settingsRef.current;

      const gamepad = readGamepadInput();
      if (gamepad) {
        gamepadKeys.left = gamepad.left;
        gamepadKeys.right = gamepad.right;
        if (gamepad.jump && !gamepadKeys.jump) gamepadKeys.jumpPressed = true;
        gamepadKeys.jump = gamepad.jump;
        if (gamepad.interact && !gamepadKeys.interact) gamepadKeys.interactPressed = true;
        gamepadKeys.interact = gamepad.interact;
        if (gamepad.tool && !gamepadKeys.tool) gamepadKeys.toolPressed = true;
        gamepadKeys.tool = gamepad.tool;
      } else {
        gamepadKeys.left = false;
        gamepadKeys.right = false;
        gamepadKeys.jump = false;
        gamepadKeys.jumpPressed = false;
        gamepadKeys.down = false;
        gamepadKeys.downPressed = false;
        gamepadKeys.interact = false;
        gamepadKeys.interactPressed = false;
        gamepadKeys.tool = false;
        gamepadKeys.toolPressed = false;
      }

      const effectiveKeys: Keys = {
        left: keys.left || gamepadKeys.left,
        right: keys.right || gamepadKeys.right,
        jump: keys.jump || gamepadKeys.jump,
        jumpPressed: keys.jumpPressed || gamepadKeys.jumpPressed,
        down: keys.down || gamepadKeys.down,
        downPressed: keys.downPressed || gamepadKeys.downPressed,
        interact: keys.interact || gamepadKeys.interact,
        interactPressed: keys.interactPressed || gamepadKeys.interactPressed,
        teleport: keys.teleport,
        teleportPressed: keys.teleportPressed,
        tool: keys.tool || gamepadKeys.tool,
        toolPressed: keys.toolPressed || gamepadKeys.toolPressed,
      };

      // 当前生态由玩家位置或镜头中心最近的地图节点决定（用于玩法逻辑）。
      const centerWorldX = player ? player.x + player.width / 2 : camera.x + size.width / 2;
      const nearestNode = nodes.length
        ? nodes.reduce((prev, curr) =>
            Math.abs(curr.x - centerWorldX) < Math.abs(prev.x - centerWorldX) ? curr : prev
          )
        : null;
      const currentMoodForm: Mood = (nearestNode?.biome as Mood) || 'calm';
      currentMoodFormRef.current = currentMoodForm;

      // 生态过渡：在两个相邻节点之间按距离做线性插值，用于渲染。
      const blend = computeBiomeBlend(nodes, centerWorldX);
      renderBiomeRef.current = blend.biome;
      blendBiomeRef.current = blend.blendBiome;
      blendTRef.current = blend.blendT;

      // 形态切换提示与氛围音。
      if (currentMoodForm !== lastMoodFormRef.current) {
        const form = MOOD_FORMS[currentMoodForm];
        moodHintRef.current = { text: `你感受到了${form.passiveName}：${form.passiveDesc}`, timer: 120 };
        lastMoodFormRef.current = currentMoodForm;
        audio.setBiome(currentMoodForm);
      }

      const gamePaused =
        houseEditModeRef.current ||
        pictureSelectorOpenRef.current ||
        pictureViewerOpenRef.current ||
        !!bookEditorTargetRef.current ||
        portalSelectorOpenRef.current ||
        chapterSelectorOpenRef.current ||
        currentSceneRef.current !== 'world' ||
        sceneTransitionRef.current.active;

      if (player && world && !sittingRef.current && !gamePaused) {
        // 形态速度倍率；避风叶可抵消 tired 形态的减速。
        const leafShelterActive = hasCrafted(inventoryRef.current, 'leaf-shelter');
        const tiredMultiplier = leafShelterActive && currentMoodForm === 'tired' ? 1 / MOOD_FORMS.tired.speedMul : 1;
        const speedMultiplier = tiredMultiplier;
        const hasDoubleJump = inventoryRef.current.equippedTrinkets.some((t) => t.effect === 'double-jump');
        updatePlayer(player, effectiveKeys, tilesRef.current, delta, speedMultiplier, {
          currentMoodForm,
          particles,
          onLightRegen: (amount) => {
            lightRef.current = Math.min(LIGHT_MAX, lightRef.current + amount);
          },
          extraAirJumps: hasDoubleJump ? 1 : 0,
        });

        // 限制玩家在世界范围内。
        player.x = Math.max(world.minX + 20, Math.min(player.x, world.maxX - 20));

        // 掉落世界底部：根据实际地形最低点判定，扣除光芒并送回最近存档点。
        const lowestTileY = world.tiles.length > 0 ? Math.max(...world.tiles.map((t) => t.y)) : 1200;
        if (player.y > lowestTileY + 600) {
          lightRef.current = Math.max(0, lightRef.current - LIGHT_DAMAGE_FALL);
          const bench = findNearestBench(player, saveBenchesRef.current) ?? saveBenchesRef.current[saveBenchesRef.current.length - 1];
          const latestNode = nodes.length > 0 ? nodes[nodes.length - 1] : { x: 200, y: 200 };
          const spawnX = bench ? bench.x + bench.width / 2 - player.width / 2 : latestNode.x;
          const spawnY = bench ? bench.y - player.height : latestNode.y + 12;
          setPlayerPosition(player, spawnX, spawnY);
          saveMessageRef.current = { text: '光芒跌落，记忆将你拉回存档之处。', timer: 180 };
          shakeCamera(6, 350);
        }

        // 手动拖拽后，玩家开始移动则恢复自动跟随。
        if (camera.free && (effectiveKeys.left || effectiveKeys.right)) {
          camera.free = false;
        }

        if (!camera.free) {
          camera.targetX = player.x - size.width / 2;
          camera.targetY = player.y - size.height * 0.65;
        }

        // 脚步声。
        if (player.onGround && Math.abs(player.vx) > 0.5) {
          if (Math.floor(time / 220) % 2 === 0 && Math.random() < 0.1) {
            audio.playStep();
          }
        }

        // 形态氛围粒子：玩家脚底少量 aura。
        if (!currentSettings.reduceMotion && currentSettings.particleDensity !== 'off' && Math.random() < 0.35) {
          const form = MOOD_FORMS[currentMoodForm];
          particles.emit(form.auraParticle, player.x + player.width / 2, player.y + player.height, 1);
        }

        // 情绪工具：鼠标/触摸瞄准，未瞄准时按玩家面向。
        if (effectiveKeys.toolPressed && !sittingRef.current) {
          const aim = mouseWorldRef.current;
          const result = applyTool(player, currentMoodForm, {
            tiles: tilesRef.current,
            particles,
            deltaTime: delta,
            onDropCollectible: (c) => collectiblesRef.current.push(c),
            aimWorldX: aim?.x,
            aimWorldY: aim?.y,
          }, lastToolUseTimeRef.current, time);
          if (result.consumed) {
            lastToolUseTimeRef.current = time;
            audio.playTool();
            if (result.spawnedCollectible) {
              setInventoryVersion((v) => v + 1);
            }
            if (result.message) {
              saveMessageRef.current = { text: result.message, timer: 160 };
            }
            if (currentMoodForm === 'tired' && result.destroyedTile) {
              temporaryPlatformsRef.current.push({ tile: result.destroyedTile, expiresAt: time + 10000 });
            }
          } else if (result.message) {
            // 情绪禁用等提示也需要显示给玩家。
            saveMessageRef.current = { text: result.message, timer: 140 };
          }
        }

        // 工具能量恢复。
        regenToolEnergy(player, delta);
      } else if (player && sittingRef.current) {
        // 坐下时镜头仍然跟随玩家。
        if (!camera.free) {
          camera.targetX = player.x - size.width / 2;
          camera.targetY = player.y - size.height * 0.65;
        }
      }

      // 无限世界：镜头接近边界时动态扩展地形。
      if (world && !gamePaused) {
        const extendDir = shouldExtendWorld(world, camera.x, size.width, 350);
        if (extendDir) {
          extendWorld(world, extendDir);
          // 同步引用并补充分新的地下宝石与天空收集物。
          tilesRef.current = world.tiles;
          const newGems = buildUndergroundGems(world.tiles, 8);
          const newSky = buildSkyCollectibles(nodes, world.tiles);
          collectiblesRef.current.push(...newGems, ...newSky);
        }
      }

      // 独立场景：记忆场景更新。
      if (currentSceneRef.current === 'memory') {
        if (memorySceneRef.current) {
          updateMemorySceneState(memorySceneRef.current, delta);
        }
      }

      // 独立场景：小屋内部更新。
      if (currentSceneRef.current === 'house' && player && houseRef.current) {
        let house = houseRef.current;

        // 窗口尺寸变化时重新铺满屏幕。
        const resized = resizeHouseToScreen(house, size.width, size.height, entries);
        if (resized !== house) {
          houseRef.current = resized;
          houseSceneTilesRef.current = buildHouseSceneTiles(resized);
          house = resized;
        }

        // 小屋内自由 2D 移动：W/S 或 上下方向键控制垂直，A/D 或左右方向键控制水平。
        const dt = delta / (1000 / 60);
        const moveSpeed = 4;
        player.vx = 0;
        player.vy = 0;
        if (effectiveKeys.left) {
          player.vx -= moveSpeed * dt;
          player.facingRight = false;
        }
        if (effectiveKeys.right) {
          player.vx += moveSpeed * dt;
          player.facingRight = true;
        }

        const ladder = getLadderAt(house, player);
        if (ladder) {
          if (effectiveKeys.jump) player.vy -= moveSpeed * dt;
          if (effectiveKeys.down) player.vy += moveSpeed * dt;
          // 攀爬时吸附到梯子中央，避免半身悬空。
          const cx = house.x + ladder.gx * TILE_SIZE + TILE_SIZE / 2;
          player.x = cx - player.width / 2;
          onLadderRef.current = true;
          hintRef.current = { text: 'W/↑ 上 · S/↓ 下 · 左右离开梯子', timer: 120 };
        } else {
          // 不在梯子上时，仍然允许自由上下移动（小屋为 2D 平面行走）。
          if (effectiveKeys.jump) player.vy -= moveSpeed * dt;
          if (effectiveKeys.down) player.vy += moveSpeed * dt;
          onLadderRef.current = false;
        }

        player.x += player.vx;
        player.y += player.vy;
        player.onGround = true;

        // 墙壁作为背景不再阻挡，仅把玩家限制在小屋范围内，避免走出场景。
        const minX = house.x + 4;
        const maxX = house.x + house.width * TILE_SIZE - player.width - 4;
        const minY = house.y + 4;
        const maxY = house.y + house.height * TILE_SIZE - player.height - 4;
        player.x = Math.max(minX, Math.min(maxX, player.x));
        player.y = Math.max(minY, Math.min(maxY, player.y));

        // 镜头固定在小屋左上角，让室内精确铺满屏幕。
        camera.free = false;
        camera.targetX = house.x;
        camera.targetY = house.y;

        // 传送门交互。
        const portal = house.portal;
        if (portal) {
          const px = player.x + player.width / 2;
          const py = player.y + player.height / 2;
          const pgx = house.x + portal.gx * TILE_SIZE + TILE_SIZE / 2;
          const pgy = house.y + portal.gy * TILE_SIZE + TILE_SIZE;
          if (Math.hypot(px - pgx, py - pgy) < TILE_SIZE * 1.2) {
            hintRef.current = { text: '按 E 打开传送门', timer: 120 };
            if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
              setPortalSelectorOpen(true);
              interactCooldownRef.current = 400;
            }
          }
        }

        // 房门：走到门口或按 E 即可离开，靠近时门自动打开。
        const doorGx = Math.floor(house.width / 2);
        const doorGy = house.height - 1;
        const px = player.x + player.width / 2;
        const py = player.y + player.height;
        const dx = house.x + doorGx * TILE_SIZE + TILE_SIZE / 2;
        const dy = house.y + doorGy * TILE_SIZE + TILE_SIZE / 2;
        const distToDoor = Math.hypot(px - dx, py - dy);
        const doorCell = house.floorPlan[doorGy]?.[doorGx];
        if (doorCell && doorCell.type === 'door') {
          doorCell.open = distToDoor < TILE_SIZE * 2.5;
        }
        if (distToDoor < TILE_SIZE * 1.2) {
          hintRef.current = { text: '按 E 走出房门', timer: 120 };
          if (
            (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) ||
            py > dy + TILE_SIZE / 2
          ) {
            exitHouseScene();
            if (effectiveKeys.interactPressed) interactCooldownRef.current = 400;
          }
        }

        // 小屋物品互动（门窗、椅子、书架、梯子、壁画、灯）。
        const mouseTriggeredInteract = pendingHouseInteractRef.current;
        if (!houseEditModeRef.current && interactCooldownRef.current <= 0) {
          const interaction = findNearestHouseInteraction(house, player);
          if (interaction) {
            let hint = '';
            if (interaction.type === 'window') {
              const cell = house.floorPlan[interaction.gy]?.[interaction.gx];
              hint = cell?.open ? '按 E/点击 关上窗户' : '按 E/点击 打开窗户';
            } else if (interaction.type === 'decoration' && interaction.deco) {
              const kind = interaction.deco.kind;
              if (kind === 'chair') hint = interaction.deco.open ? '按 E/点击 起身' : '按 E/点击 坐下休息';
              else if (kind === 'bookshelf') hint = '按 E/点击 编辑书架';
              else if (kind === 'ladder') hint = 'W/↑ 上 · S/↓ 下 · E/点击 切换楼层';
              else if (kind === 'picture-frame') hint = interaction.deco.imageUrl ? '按 E/点击 查看壁画' : '空相框';
              else if (kind === 'lamp') hint = interaction.deco.open ? '按 E/点击 关灯' : '按 E/点击 开灯';
            }
            if (hint) hintRef.current = { text: hint, timer: 120 };

            if (effectiveKeys.interactPressed || mouseTriggeredInteract) {
              if (interaction.type === 'window') {
                const cell = house.floorPlan[interaction.gy]?.[interaction.gx];
                if (cell) {
                  cell.open = !cell.open;
                  interactCooldownRef.current = 300;
                }
              } else if (interaction.type === 'decoration' && interaction.deco) {
                const deco = interaction.deco;
                if (deco.kind === 'chair') {
                  deco.open = !deco.open;
                  interactCooldownRef.current = 300;
                } else if (deco.kind === 'bookshelf') {
                  setBookEditorTarget({ gx: deco.gx, gy: deco.gy });
                  interactCooldownRef.current = 300;
                } else if (deco.kind === 'ladder') {
                  // 梯子：在已有的楼层之间切换。
                  const floorYs = getHouseFloorYs(house);
                  if (floorYs.length >= 2) {
                    const py = player.y + player.height / 2;
                    const midY = house.y + ((floorYs[0] + floorYs[floorYs.length - 1]) / 2) * TILE_SIZE;
                    const targetGy = py > midY ? floorYs[0] : floorYs[floorYs.length - 1];
                    setPlayerPosition(
                      player,
                      house.x + deco.gx * TILE_SIZE + (TILE_SIZE - player.width) / 2,
                      house.y + targetGy * TILE_SIZE - player.height - 2
                    );
                  }
                  player.vx = 0;
                  player.vy = 0;
                  interactCooldownRef.current = 400;
                } else if (deco.kind === 'lamp') {
                  deco.open = !deco.open;
                  interactCooldownRef.current = 300;
                } else if (deco.kind === 'picture-frame' && deco.imageUrl) {
                  setPictureViewerUrl(deco.imageUrl);
                  setPictureViewerOpen(true);
                  interactCooldownRef.current = 300;
                }
              }
            }
          }
        }
        pendingHouseInteractRef.current = false;
      }

      // 场景过渡更新。
      const transition = sceneTransitionRef.current;
      if (transition.active) {
        const speed = delta * 0.0025;
        if (transition.direction === 'in') {
          transition.alpha += speed;
          if (transition.alpha >= 1) {
            transition.alpha = 1;
            currentSceneRef.current = transition.nextScene ?? 'world';
            if (currentSceneRef.current === 'memory' && transition.payload) {
              const entry = transition.payload as JournalEntry;
              memorySceneRef.current = { entry, charIndex: 0, timer: 0 };
            }
            if (currentSceneRef.current === 'world') {
              memorySceneRef.current = null;
            }
            transition.direction = 'out';
          }
        } else {
          transition.alpha -= speed;
          if (transition.alpha <= 0) {
            transition.alpha = 0;
            transition.active = false;
            transition.nextScene = undefined;
            transition.payload = undefined;
          }
        }
      }

      // 防御非有限值。
      if (!Number.isFinite(camera.targetX)) camera.targetX = camera.x;
      if (!Number.isFinite(camera.targetY)) camera.targetY = camera.y;
      if (!Number.isFinite(camera.x)) camera.x = 0;
      if (!Number.isFinite(camera.y)) camera.y = 0;

      // 取消相机垂直限制，支持无界上下探索。
      // camera.targetY = Math.max(CAMERA_SKY_MIN_Y, Math.min(camera.targetY, CAMERA_UNDERGROUND_MAX_Y));

      // 平滑镜头。
      const smooth = currentSettings.reduceMotion ? 1 : currentSettings.cameraSmoothSpeed;
      camera.x += (camera.targetX - camera.x) * smooth;
      camera.y += (camera.targetY - camera.y) * smooth;

      // 相机抖动。
      const shake = updateCameraShake(delta, currentSettings.screenShake && !currentSettings.reduceMotion);
      camera.x += shake.x;
      camera.y += shake.y;

      // 粒子更新。
      if (!currentSettings.reduceMotion && currentSettings.particleDensity !== 'off') {
        const densityMul = particleDensityMultiplier(currentSettings.particleDensity);
        particles.emitAmbient(currentMoodForm, camera, size.width, size.height, densityMul);
      }
      particles.update(delta);

      // 动物更新。
      if (currentSceneRef.current === 'world') {
        updateAnimals(animalsRef.current, player, tilesRef.current, delta);
      }

      // 交互逻辑。
      if (player && !gamePaused) {
        if (interactCooldownRef.current > 0) interactCooldownRef.current -= delta;

        const near = checkInteraction(player, waypointsRef.current, collectiblesRef.current);
        const bench = findNearestBench(player, saveBenchesRef.current);
        const house = houseRef.current;
        const craftingTable = findHouseCraftingTable(house, player);
        nearFurnaceRef.current = !!craftingTable;

        // 传送门：玩家在小屋内且靠近 portal 网格。
        const portal = house?.portal;
        let nearPortal = false;
        if (portal && isPlayerInsideHouse(player, house)) {
          const px = player.x + player.width / 2;
          const py = player.y + player.height / 2;
          const pgx = house.x + portal.gx * TILE_SIZE + TILE_SIZE / 2;
          const pgy = house.y + portal.gy * TILE_SIZE + TILE_SIZE;
          nearPortal = Math.hypot(px - pgx, py - pgy) < TILE_SIZE * 1.2;
        }

        // 章节传送门：完成一段记忆后出现在下一个记忆之门附近。
        const chapterPortal = chapterPortalRef.current;
        let nearChapterPortal = false;
        if (chapterPortal && currentSceneRef.current === 'world') {
          const px = player.x + player.width / 2;
          const py = player.y + player.height / 2;
          const cpx = chapterPortal.x + chapterPortal.width / 2;
          const cpy = chapterPortal.y + chapterPortal.height / 2;
          nearChapterPortal = Math.hypot(px - cpx, py - cpy) < TILE_SIZE * 1.5;
        }

        // 小屋入口提示。
        let nearHouseMarker = false;
        if (house && currentSceneRef.current === 'world') {
          const hx = house.x + (house.width * TILE_SIZE) / 2;
          const hy = house.y + (house.height * TILE_SIZE) / 2;
          const px = player.x + player.width / 2;
          const py = player.y + player.height / 2;
          nearHouseMarker = Math.hypot(px - hx, py - hy) < TILE_SIZE * 4;
        }

        // 工具提示：显示当前形态工具名称与作用；若当前情绪禁用工具则给出提示。
        if (!near.collectible && !near.waypoint && !nearChapterPortal && !nearHouseMarker) {
          const usability = canUseTool(currentMoodForm);
          if (!usability.ok) {
            hintRef.current = { text: usability.reason ?? '当前情绪无法使用工具', timer: 120 };
          } else if (player.toolEnergy >= 8) {
            hintRef.current = {
              text: `按 T 使用 ${getToolName(currentMoodForm)} · ${getToolDesc(currentMoodForm)}`,
              timer: 120,
            };
          }
        }

        if (nearHouseMarker) {
          hintRef.current = { text: '按 H 进入小屋 · 点「小屋」按钮编辑', timer: 120 };
        }

        if (sittingRef.current && sittingBenchRef.current) {
          sittingTimerRef.current += delta;
          if (sittingTimerRef.current >= 1000) {
            sittingRef.current = false;
            const saved = saveBenchesRef.current.find((b) => b.id === sittingBenchRef.current!.id);
            if (saved) {
              const anchor = hasCrafted(inventoryRef.current, 'memory-anchor')
                ? {
                    nodeId: saved.nodeId,
                    x: player.x + player.width / 2,
                    y: player.y,
                  }
                : undefined;
              saveGame({
                nodeId: saved.nodeId,
                x: saved.x + saved.width / 2,
                y: saved.y,
                light: lightRef.current,
                inventory: inventoryRef.current,
                activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
                collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
                savedAt: Date.now(),
        gameHour: gameHourRef.current,
                house: houseRef.current,
                anchor,
              }).catch(() => null);
              saveMessageRef.current = { text: '你在此刻停下，与这段记忆共处片刻。', timer: 240 };
              lastSaveAtRef.current = time;
              lightRef.current = Math.min(LIGHT_MAX, lightRef.current + 10);
            }
            sittingBenchRef.current = null;
          }
        } else if (nearPortal) {
          hintRef.current = { text: '按 E 打开传送门', timer: 120 };
          if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
            setPortalSelectorOpen(true);
            interactCooldownRef.current = 400;
          }
        } else if (bench && !near.collectible && !near.waypoint) {
          hintRef.current = { text: '按 E 在此存档长椅休息', timer: 120 };
          if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
            sittingRef.current = true;
            sittingBenchRef.current = bench;
            sittingTimerRef.current = 0;
            setPlayerPosition(player, bench.x + bench.width / 2 - player.width / 2, bench.y - player.height);
            interactCooldownRef.current = 500;
          }
        } else {
          // 摘花 / 砍树：找到附近带有可收获植物的瓦片。
          const px = player.x + player.width / 2;
          const py = player.y + player.height / 2;
          let harvestTile: Tile | undefined;
          let harvestDist = Infinity;
          for (const tile of tilesRef.current) {
            if (!tile.plant || tile.plant.stage !== 'full') continue;
            const cx = tile.x + TILE_SIZE / 2;
            const cy = tile.y + TILE_SIZE / 2;
            const d = Math.hypot(px - cx, py - cy);
            if (d < TILE_SIZE * 1.5 && d < harvestDist) {
              harvestTile = tile;
              harvestDist = d;
            }
          }

          if (harvestTile) {
            const isTree = ['tree', 'deadTree', 'cactus'].includes(harvestTile.plant!.kind);
            hintRef.current = { text: `按 E ${isTree ? '砍树' : '摘花'}`, timer: 120 };
            if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
              const dropped = harvestPlant(harvestTile, currentMoodForm);
              if (dropped) {
                collectiblesRef.current.push(dropped);
                inventoryRef.current.items.push({
                  kind: dropped.kind,
                  label: dropped.label,
                  entryId: '',
                  collectedAt: Date.now(),
                });
                floatingTextsRef.current.push({
                  text: `+1 ${dropped.label}`,
                  x: dropped.x + dropped.width / 2,
                  y: dropped.y,
                  timer: 1200,
                  maxLife: 1200,
                });
                particles.emit('leaf', harvestTile.x + TILE_SIZE / 2, harvestTile.y + TILE_SIZE / 2, 6);
                particles.emit('sparkle', harvestTile.x + TILE_SIZE / 2, harvestTile.y + TILE_SIZE / 2, 4);
                setInventoryVersion((v) => v + 1);
                // 砍树后树实体需要从渲染列表移除。
                rebuildEntities();
              }
              interactCooldownRef.current = 300;
            }
          } else {
            const nearGap = findNearestGapTile(player, tilesRef.current);
            if (nearGap && hasCrafted(inventoryRef.current, 'heart-bridge') && (craftedEffectsRef.current['heart-bridge'] ?? 0) <= 0) {
              hintRef.current = { text: '按 E 以心桥跨越缺口', timer: 120 };
              if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
                spawnBridge(nearGap, tilesRef.current, bridgeTilesRef.current);
                craftedEffectsRef.current['heart-bridge'] = RECIPES['heart-bridge'].duration;
                particles.emit('sparkle', nearGap.x + TILE_SIZE / 2, nearGap.y + TILE_SIZE / 2, 16);
                audio.playUnlock();
                interactCooldownRef.current = 500;
              }
            }
          }
        }

        if (nearChapterPortal && chapterPortal) {
          hintRef.current = { text: '按 E 进入下一章记忆之门', timer: 120 };
          if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
            const target = waypointsRef.current.find((w) => w.nodeId === chapterPortal.targetWaypointId);
            if (target && player) {
              const tx = target.x + target.width / 2 - player.width / 2;
              const ty = target.y + target.height - player.height;
              setPlayerPosition(player, tx, ty);
              player.vx = 0;
              player.vy = 0;
              camera.targetX = tx - size.width / 2;
              camera.targetY = ty - size.height * 0.65;
              activateWaypoint(target);
              particles.emit('sparkle', target.x + target.width / 2, target.y + target.height / 2, 20);
              audio.playUnlock();
            }
            chapterPortalRef.current = null;
            interactCooldownRef.current = 500;
          }
        } else if (near.collectible) {
          hintRef.current = { text: `收集：${near.collectible.label}`, timer: 120 };
          if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
            collect(near.collectible);
            lightRef.current = Math.min(LIGHT_MAX, lightRef.current + LIGHT_RECOVERY_COLLECTIBLE);
            inventoryRef.current.items.push({
              kind: near.collectible.kind,
              label: near.collectible.label,
              entryId: near.collectible.entryId ?? '',
              collectedAt: Date.now(),
            });
            floatingTextsRef.current.push({
              text: `+1 ${near.collectible.label} 回忆碎片`,
              x: near.collectible.x + near.collectible.width / 2,
              y: near.collectible.y,
              timer: 1200,
              maxLife: 1200,
            });
            particles.emit('sparkle', near.collectible.x + 8, near.collectible.y + 8, 12);
            audio.playCollect();
            interactCooldownRef.current = 300;
            setInventoryVersion((v) => v + 1);
          }
        } else if (near.waypoint) {
          hintRef.current = { text: '按 E / 点击 查看回忆', timer: 120 };
          if (effectiveKeys.interactPressed && interactCooldownRef.current <= 0) {
            const entry = entries.find((en) => en.id === near.waypoint!.entryId);
            if (entry) {
              if (!near.waypoint!.activated) {
                activateWaypoint(near.waypoint);
                lightRef.current = Math.min(LIGHT_MAX, lightRef.current + LIGHT_RECOVERY_WAYPOINT);
                setInventoryVersion((v) => v + 1);
              }
              lastInteractedWaypointIdRef.current = near.waypoint!.nodeId;
              enterMemoryScene(entry);
              audio.playOpenMemory();
            }
            interactCooldownRef.current = 400;
          }
        } else {
          if (hintRef.current) {
            hintRef.current.timer -= delta / 16;
            if (hintRef.current.timer <= 0) hintRef.current = null;
          }
        }
      }

      // 自动收集掉落的情绪碎片（接触即收集）。
      if (player) {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        for (const c of collectiblesRef.current) {
          if (c.collected || !c.autoCollect) continue;
          const cx = c.x + c.width / 2;
          const cy = c.y + c.height / 2;
          if (Math.hypot(px - cx, py - cy) <= 28) {
            collect(c);
            lightRef.current = Math.min(LIGHT_MAX, lightRef.current + LIGHT_RECOVERY_COLLECTIBLE);
            inventoryRef.current.items.push({
              kind: c.kind,
              label: c.label,
              entryId: '',
              collectedAt: Date.now(),
            });
            floatingTextsRef.current.push({
              text: `+1 ${c.label}`,
              x: c.x + c.width / 2,
              y: c.y,
              timer: 1200,
              maxLife: 1200,
            });
            particles.emit('sparkle', c.x + 8, c.y + 8, 8);
            setInventoryVersion((v) => v + 1);
          }
        }
      }

      // 叙事提示消息计时。
      if (saveMessageRef.current) {
        saveMessageRef.current.timer -= delta / 16;
        if (saveMessageRef.current.timer <= 0) saveMessageRef.current = null;
      }

      // 形态切换提示计时。
      if (moodHintRef.current) {
        moodHintRef.current.timer -= delta / 16;
        if (moodHintRef.current.timer <= 0) moodHintRef.current = null;
      }

      keys.jumpPressed = false;
      keys.interactPressed = false;
      keys.teleportPressed = false;
      keys.toolPressed = false;
      gamepadKeys.jumpPressed = false;
      gamepadKeys.interactPressed = false;
      gamepadKeys.toolPressed = false;

      // 更新合成产物效果的剩余时间。
      for (const id of Object.keys(craftedEffectsRef.current)) {
        craftedEffectsRef.current[id] -= delta;
        if (craftedEffectsRef.current[id] <= 0) {
          delete craftedEffectsRef.current[id];
        }
      }

      // 心桥到期后移除临时光桥。
      if (!craftedEffectsRef.current['heart-bridge'] && bridgeTilesRef.current.length > 0) {
        for (const bridge of bridgeTilesRef.current) {
          bridge.type = 'gap';
          bridge.solid = false;
        }
        bridgeTilesRef.current = [];
      }

      // 扎根杖临时平台到期后移除。
      const remainingPlatforms: { tile: Tile; expiresAt: number }[] = [];
      for (const entry of temporaryPlatformsRef.current) {
        if (time >= entry.expiresAt) {
          entry.tile.type = 'gap';
          entry.tile.solid = false;
          entry.tile.destroyed = true;
        } else {
          remainingPlatforms.push(entry);
        }
      }
      temporaryPlatformsRef.current = remainingPlatforms;

      // 更新浮动文字。
      for (const ft of floatingTextsRef.current) {
        ft.timer -= delta;
        ft.y -= delta * 0.02;
      }
      floatingTextsRef.current = floatingTextsRef.current.filter((ft) => ft.timer > 0);

      // 收集光源。
      const lights: LightSource[] = [];
      const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
      const moonX = ((size.width * 0.78 - safeCameraX * 0.02) % (size.width + 160)) - 40;
      const moonY = size.height * 0.14;
      lights.push({
        x: moonX,
        y: moonY,
        radius: Math.max(size.width, size.height) * 0.85,
        color: '160,190,255',
        intensity: 0.22,
      });

      if (player) {
        const pScreen = worldToScreen(camera, player.x, player.y);
        const lightRatio = lightRef.current / LIGHT_MAX;
        const starActive = (craftedEffectsRef.current['star-lantern'] ?? 0) > 0;
        const moodLanternActive = (craftedEffectsRef.current['mood-lantern'] ?? 0) > 0;
        const lightCoreActive = inventoryRef.current.equippedTrinkets.some((t) => t.effect === 'light-boost');
        let playerRadius = moodLanternActive
          ? 220
          : starActive
            ? 180
            : LIGHT_RADIUS_MIN + (LIGHT_RADIUS_MAX - LIGHT_RADIUS_MIN) * lightRatio;
        if (lightCoreActive) playerRadius *= 1.25;
        lights.push({
          x: pScreen.x + player.width / 2,
          y: pScreen.y + player.height / 2,
          radius: playerRadius,
          color: starActive ? '255,210,120' : '255,180,90',
          intensity: 0.35 + lightRatio * 0.3 + (starActive ? 0.15 : 0),
        });
      }

      for (const c of collectiblesRef.current) {
        if (c.collected) continue;
        const cScreen = worldToScreen(camera, c.x, c.y);
        if (cScreen.x + c.width > -50 && cScreen.x < size.width + 50) {
          lights.push({
            x: cScreen.x + c.width / 2,
            y: cScreen.y + c.height / 2,
            radius: 55,
            color: c.kind === 'gem' ? '100,220,255' : '255,230,150',
            intensity: 0.38,
          });
        }
      }

      for (const waypoint of waypointsRef.current) {
        if (!waypoint.activated) continue;
        const wScreen = worldToScreen(camera, waypoint.x, waypoint.y);
        if (wScreen.x + waypoint.width > -50 && wScreen.x < size.width + 50) {
          lights.push({
            x: wScreen.x + waypoint.width / 2,
            y: wScreen.y + waypoint.height / 2,
            radius: 70,
            color: '255,160,70',
            intensity: 0.42,
          });
        }
      }

      // 根据玩家深度/生态切换后期处理效果。
      const activeEffects = resolveActiveEffects({
        playerY: player?.y ?? camera.y + size.height / 2,
        cameraBottom: camera.y + size.height,
        groundY: world?.groundY ?? 416,
        biome: currentMoodForm,
        light: lightRef.current,
      });

      const palette = BIOME_PALETTES[currentMoodForm];

      const drawUI = (uiCtx: CanvasRenderingContext2D, width: number, height: number) => {
        const drawPixelPanel = (
          x: number,
          y: number,
          w: number,
          h: number,
          radius = 6
        ) => {
          uiCtx.save();
          uiCtx.fillStyle = 'rgba(20,16,12,0.72)';
          uiCtx.beginPath();
          uiCtx.roundRect(x, y, w, h, radius);
          uiCtx.fill();
          uiCtx.strokeStyle = 'rgba(212,175,55,0.35)';
          uiCtx.lineWidth = 1;
          uiCtx.stroke();
          // 内高光，模拟毛玻璃边缘
          uiCtx.strokeStyle = 'rgba(255,255,255,0.06)';
          uiCtx.beginPath();
          uiCtx.roundRect(x + 1, y + 1, w - 2, h - 2, Math.max(1, radius - 1));
          uiCtx.stroke();
          uiCtx.restore();
        };

        // 收集浮动文字。
        for (const ft of floatingTextsRef.current) {
          const s = worldToScreen(camera, ft.x, ft.y);
          const alpha = Math.max(0, ft.timer / ft.maxLife);
          uiCtx.save();
          uiCtx.globalAlpha = alpha;
          uiCtx.fillStyle = '#ffe082';
          uiCtx.font = 'bold 12px monospace';
          uiCtx.textAlign = 'center';
          uiCtx.textBaseline = 'bottom';
          uiCtx.shadowColor = 'rgba(0,0,0,0.8)';
          uiCtx.shadowBlur = 3;
          uiCtx.fillText(ft.text, s.x, s.y);
          uiCtx.restore();
        }

        // 小屋编辑模式：高亮悬停网格与当前工具预览。
        if (houseEditModeRef.current && houseRef.current && hoverHouseGridRef.current) {
          const house = houseRef.current;
          const { gx, gy } = hoverHouseGridRef.current;
          const sx = house.x - camera.x + gx * TILE_SIZE;
          const sy = house.y - camera.y + gy * TILE_SIZE;
          uiCtx.save();
          uiCtx.strokeStyle = 'rgba(255,215,0,0.8)';
          uiCtx.lineWidth = 2;
          uiCtx.setLineDash([4, 4]);
          uiCtx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
          uiCtx.setLineDash([]);
          uiCtx.fillStyle = 'rgba(255,215,0,0.15)';
          uiCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          uiCtx.restore();
        }

        // 快照：指向最近未收集物的箭头。
        if (player && (craftedEffectsRef.current['camera-sight'] ?? 0) > 0) {
          const target = findNearestUncollectedCollectible(player, collectiblesRef.current);
          if (target) {
            const pScreen = worldToScreen(camera, player.x + player.width / 2, player.y + player.height / 2);
            const tScreen = worldToScreen(camera, target.x + target.width / 2, target.y + target.height / 2);
            const dx = tScreen.x - pScreen.x;
            const dy = tScreen.y - pScreen.y;
            const dist = Math.hypot(dx, dy) || 1;
            const arrowLen = Math.min(60, dist);
            const ax = pScreen.x + (dx / dist) * arrowLen;
            const ay = pScreen.y + (dy / dist) * arrowLen;
            uiCtx.save();
            uiCtx.strokeStyle = '#40e0d0';
            uiCtx.fillStyle = '#40e0d0';
            uiCtx.lineWidth = 3;
            uiCtx.globalAlpha = 0.85;
            uiCtx.beginPath();
            uiCtx.moveTo(pScreen.x, pScreen.y);
            uiCtx.lineTo(ax, ay);
            uiCtx.stroke();
            uiCtx.beginPath();
            uiCtx.moveTo(ax, ay);
            uiCtx.lineTo(ax - (dx / dist) * 10 - (dy / dist) * 6, ay - (dy / dist) * 10 + (dx / dist) * 6);
            uiCtx.lineTo(ax - (dx / dist) * 10 + (dy / dist) * 6, ay - (dy / dist) * 10 - (dx / dist) * 6);
            uiCtx.closePath();
            uiCtx.fill();
            uiCtx.restore();
          }
        }

        // 光芒条。
        const light = lightRef.current;
        const barW = 120;
        const barH = 10;
        const barX = 16;
        const barY = 16;
        const fillW = (light / LIGHT_MAX) * barW;
        let barColor = '#ffd700';
        if (light < 20) barColor = '#8b0000';
        else if (light < 50) barColor = '#ff8c00';

        uiCtx.save();
        drawPixelPanel(barX - 2, barY - 2, barW + 4, barH + 4, 6);
        uiCtx.fillStyle = barColor;
        uiCtx.beginPath();
        uiCtx.roundRect(barX, barY, fillW, barH, 4);
        uiCtx.fill();
        uiCtx.fillStyle = 'rgba(255,255,255,0.9)';
        uiCtx.font = '10px monospace';
        uiCtx.textAlign = 'left';
        uiCtx.textBaseline = 'top';
        uiCtx.fillText(`光芒 ${Math.round(light)}`, barX, barY + barH + 6);
        uiCtx.restore();

        // 工具能量条。
        if (player) {
          const energy = player.toolEnergy;
          const eBarW = 80;
          const eBarH = 6;
          const eBarX = barX;
          const eBarY = barY + barH + 22;
          const eFillW = (energy / 100) * eBarW;
          uiCtx.save();
          drawPixelPanel(eBarX - 2, eBarY - 2, eBarW + 4, eBarH + 4, 4);
          uiCtx.fillStyle = energy < 15 ? '#8b0000' : '#40e0d0';
          uiCtx.beginPath();
          uiCtx.roundRect(eBarX, eBarY, eFillW, eBarH, 2);
          uiCtx.fill();
          uiCtx.restore();
        }

        // 当前章节。
        if (chapters.length > 0) {
          const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? chapters[0];
          uiCtx.save();
          drawPixelPanel(barX - 2, barY + barH + 36, 140, 22, 4);
          uiCtx.fillStyle = activeChapter.themeColor;
          uiCtx.font = '11px monospace';
          uiCtx.textAlign = 'left';
          uiCtx.textBaseline = 'middle';
          const label = activeChapter.title.length > 8 ? `${activeChapter.title.slice(0, 8)}…` : activeChapter.title;
          uiCtx.fillText(`章节: ${label}`, barX + 4, barY + barH + 47);
          uiCtx.restore();
        }

        // 游戏内时间。
        const gh = gameHourRef.current;
        const hourStr = Math.floor(gh).toString().padStart(2, '0');
        const minuteStr = Math.floor((gh % 1) * 60)
          .toString()
          .padStart(2, '0');
        const timeLabel = `${hourStr}:${minuteStr}`;
        uiCtx.save();
        drawPixelPanel(width - 80, barY - 2, 66, 22, 4);
        uiCtx.fillStyle = '#f0e6d2';
        uiCtx.font = '11px monospace';
        uiCtx.textAlign = 'center';
        uiCtx.textBaseline = 'middle';
        uiCtx.fillText(timeLabel, width - 47, barY + 9);
        uiCtx.restore();

        // 首次进入游戏操作提示。
        if (firstTimeHintRef.current) {
          firstTimeHintRef.current.timer -= delta;
          if (firstTimeHintRef.current.timer <= 0) {
            firstTimeHintRef.current = null;
          }

          uiCtx.save();
          const msg = firstTimeHintRef.current?.text ?? '';
          uiCtx.font = '12px monospace';
          uiCtx.textAlign = 'center';
          uiCtx.textBaseline = 'bottom';
          uiCtx.fillStyle = '#f0e6d2';
          uiCtx.shadowColor = 'rgba(0,0,0,0.9)';
          uiCtx.shadowBlur = 4;
          const maxTextW = width - 64;
          const lines = wrapText(uiCtx, msg, maxTextW);
          const lineH = 16;
          const startY = height - 32;
          lines.forEach((line, i) => {
            uiCtx.fillText(line, width / 2, startY - (lines.length - 1 - i) * lineH);
          });
          uiCtx.restore();
        }

        // 叙事提示消息（无字框）。
        if (saveMessageRef.current) {
          uiCtx.save();
          const msg = saveMessageRef.current.text;
          uiCtx.font = '13px monospace';
          uiCtx.textAlign = 'center';
          uiCtx.textBaseline = 'middle';
          uiCtx.fillStyle = '#f0e6d2';
          uiCtx.shadowColor = 'rgba(0,0,0,0.9)';
          uiCtx.shadowBlur = 4;
          const maxTextW = width - 64;
          const lines = wrapText(uiCtx, msg, maxTextW);
          const lineH = 18;
          const startY = height / 2 - 30 - (lines.length - 1) * (lineH / 2);
          lines.forEach((line, i) => uiCtx.fillText(line, width / 2, startY + i * lineH));
          uiCtx.restore();
        }

        // 形态切换提示（无字框）。
        if (moodHintRef.current) {
          uiCtx.save();
          const msg = moodHintRef.current.text;
          uiCtx.font = '13px monospace';
          uiCtx.textAlign = 'center';
          uiCtx.textBaseline = 'middle';
          uiCtx.fillStyle = '#f0e6d2';
          uiCtx.shadowColor = 'rgba(0,0,0,0.9)';
          uiCtx.shadowBlur = 4;
          const maxTextW = width - 64;
          const lines = wrapText(uiCtx, msg, maxTextW);
          const lineH = 18;
          const startY = height / 2 - 70 - (lines.length - 1) * (lineH / 2);
          lines.forEach((line, i) => uiCtx.fillText(line, width / 2, startY + i * lineH));
          uiCtx.restore();
        }

        // 交互提示（无字框）。
        if (hintRef.current) {
          uiCtx.save();
          uiCtx.font = '12px monospace';
          uiCtx.textAlign = 'center';
          uiCtx.textBaseline = 'bottom';
          uiCtx.fillStyle = '#f0e6d2';
          uiCtx.shadowColor = 'rgba(0,0,0,0.9)';
          uiCtx.shadowBlur = 4;
          uiCtx.fillText(hintRef.current.text, width / 2, height - 28);
          uiCtx.restore();
        }

        // 小地图：显示世界全貌与关键地点。
        if (mapOpenRef.current && world) {
          uiCtx.save();
          const mapW = 220;
          const mapH = 130;
          const mapX = 16;
          const mapY = 80;
          const tileYs = world.tiles.map((t) => t.y);
          const bounds = {
            minX: world.minX,
            maxX: world.maxX,
            minY: tileYs.length > 0 ? Math.min(...tileYs) - TILE_SIZE * 4 : -400,
            maxY: tileYs.length > 0 ? Math.max(...tileYs) + TILE_SIZE * 4 : 1200,
          };
          const bw = bounds.maxX - bounds.minX || 1;
          const bh = bounds.maxY - bounds.minY || 1;
          const sx = mapW / bw;
          const sy = mapH / bh;

          const toMapX = (wx: number) => mapX + (wx - bounds.minX) * sx;
          const toMapY = (wy: number) => mapY + (wy - bounds.minY) * sy;

          uiCtx.fillStyle = 'rgba(0,0,0,0.55)';
          uiCtx.strokeStyle = 'rgba(255,255,255,0.25)';
          uiCtx.lineWidth = 1;
          uiCtx.fillRect(mapX, mapY, mapW, mapH);
          uiCtx.strokeRect(mapX, mapY, mapW, mapH);

          // 深层区域与天空岛屿轮廓。
          for (const tile of world.tiles) {
            if (tile.y > 800 || (tile.y < WORLD_GROUND_Y - 200 && tile.solid)) {
              const tx = toMapX(tile.x + TILE_SIZE / 2);
              const ty = toMapY(tile.y + TILE_SIZE / 2);
              uiCtx.fillStyle = tile.y > 800 ? 'rgba(160, 60, 30, 0.45)' : 'rgba(90, 170, 90, 0.45)';
              uiCtx.fillRect(tx - 0.5, ty - 0.5, 1, 1);
            }
          }

          for (const w of waypointsRef.current) {
            const cx = toMapX(w.x + w.width / 2);
            const cy = toMapY(w.y + w.height / 2);
            uiCtx.fillStyle = w.activated ? '#ffd700' : '#888888';
            uiCtx.beginPath();
            uiCtx.arc(cx, cy, w.activated ? 3 : 2, 0, Math.PI * 2);
            uiCtx.fill();
          }

          uiCtx.fillStyle = '#40e0d0';
          for (const c of collectiblesRef.current) {
            if (c.collected) continue;
            uiCtx.fillRect(toMapX(c.x + c.width / 2) - 1, toMapY(c.y + c.height / 2) - 1, 2, 2);
          }

          uiCtx.fillStyle = '#87ceeb';
          for (const b of saveBenchesRef.current) {
            uiCtx.fillRect(toMapX(b.x + b.width / 2) - 1.5, toMapY(b.y + b.height / 2) - 1.5, 3, 3);
          }

          if (player) {
            const px = toMapX(player.x + player.width / 2);
            const py = toMapY(player.y + player.height / 2);
            uiCtx.fillStyle = '#ffffff';
            uiCtx.beginPath();
            uiCtx.arc(px, py, 3, 0, Math.PI * 2);
            uiCtx.fill();
          }

          uiCtx.fillStyle = 'rgba(255,255,255,0.8)';
          uiCtx.font = '10px monospace';
          uiCtx.textAlign = 'left';
          uiCtx.textBaseline = 'top';
          uiCtx.fillText('世界地图 (M)', mapX, mapY + mapH + 6);
          uiCtx.restore();
        }
      };

      // 根据当前场景选择渲染管线。
      const scene = currentSceneRef.current;

      const renderState: RenderGameState = {
        player,
        world: world ?? { tiles: tilesRef.current, platforms: [], minX: 0, maxX: 800, groundY: 416 },
        camera,
        time,
        biome: renderBiomeRef.current,
        blendBiome: blendBiomeRef.current,
        biomeBlend: blendTRef.current,
        entities: entitiesRef.current,
        lights,
        activeEffects,
        reduceMotion: currentSettings.reduceMotion,
        lightingQuality: currentSettings.lightingQuality,
        house: scene === 'house' ? houseRef.current : undefined,
        houseEditMode: houseEditModeRef.current,
        hour: gameHourRef.current,
      };
      if (scene === 'world') {
        const chapterPortal = chapterPortalRef.current;
        renderPipelineRef.current?.render(
          ctx,
          renderState,
          size.width,
          size.height,
          drawUI,
          chapterPortal ? (portalCtx) => drawWorldPortal(portalCtx, chapterPortal, camera, time) : undefined
        );
      } else if (scene === 'memory' && memorySceneRef.current) {
        drawMemoryScene(ctx, ctx, memorySceneRef.current, { width: size.width, height: size.height }, palette, time);
      } else if (scene === 'house' && houseRef.current && player) {
        drawHouseScene(
          ctx,
          ctx,
          houseRef.current,
          player,
          camera,
          { width: size.width, height: size.height },
          palette,
          time,
          lightingRef.current
        );
      }

      // 场景过渡淡入淡出。
      const renderTransition = sceneTransitionRef.current;
      if (renderTransition.active && renderTransition.alpha > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${renderTransition.alpha.toFixed(3)})`;
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    entries,
    nodes,
    chapters,
    hiddenChapters,
    unlockedHiddenChapterIds,
    size.width,
    size.height,
    onSelectEntry,
    onEnterChapter,
    onSetHiddenChapters,
    onTalkEcho,
    onUnlockHiddenChapter,
    enterMemoryScene,
    enterHouseScene,
    exitMemoryScene,
    exitHouseScene,
  ]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    audioRef.current.setMuted(mutedRef.current);
    const next = { ...settingsRef.current, masterVolume: mutedRef.current ? 0 : settingsRef.current.masterVolume || 0.8 };
    setSettings(next);
    settingsRef.current = next;
    audioRef.current.applySettings(next);
    saveSettings(next).catch(() => null);
  }, []);

  const handleSettingsChange = useCallback((next: GameSettings) => {
    setSettings(next);
    settingsRef.current = next;
    audioRef.current.applySettings(next);
    audioRef.current.setAudioPack(next.audioPack || 'synth');
    mutedRef.current = next.masterVolume <= 0;
    audioRef.current.setMuted(mutedRef.current);
    saveSettings(next).catch(() => null);
  }, []);

  const handleCraft = useCallback((recipeId: string) => {
    const recipe = RECIPES[recipeId];
    if (!recipe) return;
    const furnaceNearby = nearFurnaceRef.current;
    if (!canCraft(recipe, inventoryRef.current, furnaceNearby)) return;
    if (inventoryRef.current.crafted.includes(recipeId)) return;

    const player = playerRef.current;
    const ok = craft(recipe, inventoryRef.current, furnaceNearby);
    if (!ok) return;

    if (recipe.duration > 0) {
      craftedEffectsRef.current[recipeId] = recipe.duration;
    }

    if (recipeId === 'calm-charm' && player) {
      particlesRef.current.emit('firefly', player.x + player.width / 2, player.y + player.height / 2, 16);
      saveMessageRef.current = { text: '一股安抚的光芒在周身流转。', timer: 200 };
    }

    if (recipeId === 'memory-anchor' && player) {
      saveMessageRef.current = { text: '记忆锚已固定在此刻的位置。', timer: 200 };
    }

    const trinketMap: Record<string, { name: string; effect: Trinket['effect'] }> = {
      'wind-feather': { name: '风之羽', effect: 'double-jump' },
      'light-core': { name: '光之核', effect: 'light-boost' },
      'rain-cloak': { name: '雨披', effect: 'mist-immunity' },
      'leaf-shelter': { name: '避风叶', effect: 'tired-immunity' },
    };
    const trinketInfo = trinketMap[recipeId];
    if (trinketInfo && inventoryRef.current.equippedTrinkets.length < 3) {
      inventoryRef.current.equippedTrinkets.push({ id: recipeId, name: trinketInfo.name, effect: trinketInfo.effect });
    }

    if (player) {
      particlesRef.current.emit('sparkle', player.x + player.width / 2, player.y + player.height / 2, 18);
    }
    audioRef.current.playCraft();
    setInventoryVersion((v) => v + 1);
  }, []);

  const handleFastTravel = useCallback((waypoint: Waypoint) => {
    const player = playerRef.current;
    if (!player) return;
    setPlayerPosition(player, waypoint.x + waypoint.width / 2 - player.width / 2, waypoint.y - player.height);
    cameraRef.current.free = false;
    cameraRef.current.targetX = player.x - size.width / 2;
    cameraRef.current.targetY = player.y - size.height * 0.65;
    particlesRef.current.emit('sparkle', player.x + player.width / 2, player.y + player.height / 2, 20);
    audioRef.current.playUnlock();
    setInventoryOpen(false);
  }, [size.width, size.height]);

  const inventoryCounts = countInventoryByKind(inventoryRef.current);
  const kindOrder: Collectible['kind'][] = ['heart', 'book', 'star', 'flame', 'camera', 'gem', 'leaf', 'footprint', 'shard', 'wood', 'petal', 'spore'];
  const kindLabels: Record<Collectible['kind'], string> = {
    heart: '心',
    book: '书',
    star: '星',
    flame: '焰',
    camera: '镜',
    gem: '晶',
    leaf: '叶',
    footprint: '迹',
    shard: '碎',
    wood: '木',
    petal: '瓣',
    spore: '孢',
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDragging.current = false;
          if (isDraggingFurnitureRef.current) {
            isDraggingFurnitureRef.current = false;
            const deco = draggingDecoRef.current;
            const start = dragStartCellRef.current;
            if (deco && start) {
              deco.gx = start.gx;
              deco.gy = start.gy;
            }
            draggingDecoRef.current = null;
            dragStartCellRef.current = null;
          }
        }}
      />
      <button
        type="button"
        onClick={() =>
          setMapOpen((prev) => {
            mapOpenRef.current = !prev;
            return !prev;
          })
        }
        className="absolute top-[52px] left-4 w-8 h-8 bg-et-panel/70 border border-et-border text-et-gold text-xs flex items-center justify-center hover:bg-et-panel rounded-md z-30"
        aria-label="开关地图"
      >
        M
      </button>
      <button
        type="button"
        onClick={toggleMute}
        className="absolute top-2 right-2 w-8 h-8 bg-et-panel/80 border border-et-border text-et-gold text-xs items-center justify-center hover:bg-et-panel rounded-md hidden md:flex"
        aria-label="切换静音"
      >
        {mutedRef.current ? '🔇' : '🔊'}
      </button>
      <button
        type="button"
        onClick={() => setInventoryOpen((prev) => !prev)}
        className="absolute top-2 right-12 w-8 h-8 bg-et-panel/80 border border-et-border text-et-gold text-xs items-center justify-center hover:bg-et-panel rounded-md hidden md:flex"
        aria-label="打开背包"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="absolute top-2 right-[5.5rem] w-8 h-8 bg-et-panel/80 border border-et-border text-et-gold text-xs items-center justify-center hover:bg-et-panel rounded-md hidden md:flex"
        aria-label="打开设置"
      >
        ⚙
      </button>
      <button
        type="button"
        onClick={() => setChapterSelectorOpen(true)}
        className="absolute top-2 right-[9.5rem] w-16 h-8 bg-et-panel/80 border border-et-border text-et-gold text-xs items-center justify-center hover:bg-et-panel rounded-md hidden md:flex"
        aria-label="切换章节"
      >
        章节
      </button>
      <button
        type="button"
        onClick={() => {
          if (currentSceneRef.current === 'house') {
            setHouseEditMode((prev) => !prev);
          } else {
            enterHouseScene();
            setHouseEditMode(true);
          }
        }}
        className="absolute top-2 right-[14.5rem] w-16 h-8 bg-et-panel/80 border border-et-border text-et-gold text-xs items-center justify-center hover:bg-et-panel rounded-md hidden md:flex"
        aria-label="编辑小屋"
      >
        {houseEditMode ? '完成' : '小屋'}
      </button>

      {settingsOpen && (
        <SettingsPanel settings={settings} onChange={handleSettingsChange} onClose={() => setSettingsOpen(false)} />
      )}

      {inventoryOpen && (
        <div className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4 pb-24 md:pb-4">
          <div key={inventoryVersion} className="w-full max-w-2xl bg-et-panel/95 border border-et-border rounded-lg shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-et-border">
              <h2 className="text-et-gold font-bold">回忆背包</h2>
              <button
                type="button"
                onClick={() => setInventoryOpen(false)}
                className="text-et-gold hover:text-white"
                aria-label="关闭背包"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4 p-4 overflow-auto">
              <div className="flex-1">
                <h3 className="text-sm text-et-gold mb-2">回忆碎片</h3>
                <div className="grid grid-cols-4 gap-2">
                  {kindOrder.map((kind) => {
                    const count = inventoryCounts[kind];
                    return (
                      <div
                        key={kind}
                        className={`flex flex-col items-center justify-center p-2 rounded border ${
                          count > 0 ? 'border-et-gold bg-et-panel' : 'border-et-border/50 opacity-50'
                        }`}
                      >
                        <span className="text-lg">{kindLabels[kind]}</span>
                        <span className="text-xs text-et-gold">x{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm text-et-gold mb-2">快速旅行</h3>
                {(() => {
                  const activated = waypointsRef.current
                    .filter((w) => w.activated)
                    .sort((a, b) => a.index - b.index);
                  if (activated.length === 0) {
                    return <p className="text-xs text-white/60">激活路标后即可在此传送。</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {activated.map((w) => {
                        const entry = entries.find((e) => e.id === w.entryId);
                        const preview = entry?.text ?? '';
                        const label = preview.length > 18 ? `${preview.slice(0, 18)}…` : preview || `路标 ${w.index + 1}`;
                        return (
                          <button
                            key={w.nodeId}
                            type="button"
                            onClick={() => handleFastTravel(w)}
                            className="w-full flex items-center gap-2 p-2 rounded border border-et-border/50 hover:border-et-gold hover:bg-et-gold/10 transition-colors text-left"
                          >
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: BIOME_PALETTES[w.biome].accent }}
                            />
                            <span className="text-sm">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1">
                <h3 className="text-sm text-et-gold mb-2">
                  可合成配方
                  <span className="ml-2 text-xs text-white/50">
                    {nearFurnaceRef.current ? '（记忆熔炉已激活）' : '（靠近记忆熔炉解锁高级配方）'}
                  </span>
                </h3>
                <div className="space-y-2">
                  {Object.values(RECIPES).map((recipe) => {
                    const furnaceNearby = nearFurnaceRef.current;
                    const trinketFull =
                      ['wind-feather', 'light-core', 'rain-cloak', 'leaf-shelter'].includes(recipe.id) &&
                      inventoryRef.current.equippedTrinkets.length >= 3;
                    const craftable = canCraft(recipe, inventoryRef.current, furnaceNearby) && !inventoryRef.current.crafted.includes(recipe.id) && !trinketFull;
                    const alreadyCrafted = inventoryRef.current.crafted.includes(recipe.id);
                    const needsFurnace = recipe.requireFurnace && !furnaceNearby;
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => handleCraft(recipe.id)}
                        disabled={!craftable}
                        className={`w-full text-left p-3 rounded border transition-colors ${
                          craftable
                            ? 'border-et-gold bg-et-gold/10 hover:bg-et-gold/20'
                            : alreadyCrafted
                              ? 'border-et-border/50 opacity-60'
                              : 'border-et-border/50 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">{recipe.name}</span>
                          {alreadyCrafted && <span className="text-xs text-et-gold">已合成</span>}
                          {needsFurnace && <span className="text-xs text-et-muted">需熔炉</span>}
                        </div>
                        <p className="text-xs text-white/70 mt-1">{recipe.description}</p>
                        <p className="text-xs text-et-gold mt-1">{recipe.effect}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {houseEditMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-et-panel/90 border border-et-border rounded-lg shadow-lg">
            {(
              [
                { key: 'wall', label: '墙', k: '1' },
                { key: 'floor', label: '地', k: '2' },
                { key: 'door', label: '门', k: '3' },
                { key: 'window', label: '窗', k: '4' },
                { key: 'empty', label: '空', k: '5' },
                { key: 'chair', label: '椅', k: '6' },
                { key: 'table', label: '桌', k: '7' },
                { key: 'lamp', label: '灯', k: '8' },
                { key: 'rug', label: '毯', k: '9' },
                { key: 'plant', label: '植', k: '0' },
                { key: 'picture-frame', label: '框', k: 'P' },
                { key: 'portal', label: '门', k: 'O' },
                { key: 'bookshelf', label: '书', k: 'B' },
                { key: 'ladder', label: '梯', k: 'L' },
                { key: 'move', label: '移', k: 'M' },
                { key: 'delete', label: '删', k: 'X' },
              ] as { key: HouseTool; label: string; k: string }[]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  selectedHouseToolRef.current = t.key;
                  setInventoryVersion((v) => v + 1);
                }}
                className={`flex flex-col items-center justify-center w-9 h-10 rounded border text-[10px] leading-tight ${
                  selectedHouseToolRef.current === t.key
                    ? 'border-et-gold bg-et-gold/20 text-et-gold'
                    : 'border-et-border/50 text-white/80 hover:border-et-gold/60'
                }`}
                title={`${t.label} (${t.k})`}
              >
                <span>{t.label}</span>
                <span className="text-[9px] opacity-60">{t.k}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/70 drop-shadow-md">
            点击网格放置 · 删工具一键移除 · 移工具拖拽家具 · 快捷键切换 · Esc 退出
          </p>
        </div>
      )}

      {pictureSelectorOpen && (
        <PictureSelector
          entries={entries}
          onSelect={handlePictureSelect}
          onClose={() => {
            setPictureSelectorOpen(false);
            pendingFramePosRef.current = null;
          }}
        />
      )}

      {portalSelectorOpen && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-et-panel/95 border border-et-border rounded-lg shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-et-border">
              <h2 className="text-et-gold font-bold">传送门目标</h2>
              <button
                type="button"
                onClick={() => setPortalSelectorOpen(false)}
                className="text-et-gold hover:text-white"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto space-y-2">
              {nodes.length === 0 ? (
                <p className="text-xs text-white/60">世界尚未展开。</p>
              ) : (
                nodes.map((n) => {
                  const entry = entries.find((e) => e.id === n.entryId);
                  const label = entry?.text?.slice(0, 18) || `节点 ${n.index + 1}`;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        const player = playerRef.current;
                        const house = houseRef.current;
                        if (!player || !house?.portal) return;
                        const targetX = n.x - player.width / 2;
                        const targetY = n.y - player.height;
                        setPlayerPosition(player, targetX, targetY);
                        cameraRef.current.free = false;
                        cameraRef.current.targetX = targetX - size.width / 2;
                        cameraRef.current.targetY = targetY - size.height * 0.65;
                        house.portal = { ...house.portal, targetX: n.x, targetY: n.y };
                        particlesRef.current.emit('sparkle', player.x + player.width / 2, player.y + player.height / 2, 20);
                        audioRef.current.playUnlock();
                        setPortalSelectorOpen(false);
                        saveGame({
                          nodeId: n.id,
                          x: n.x,
                          y: n.y,
                          light: lightRef.current,
                          inventory: inventoryRef.current,
                          activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
                          collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
                          savedAt: Date.now(),
        gameHour: gameHourRef.current,
                          house,
                        }).catch(() => null);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded border border-et-border/50 hover:border-et-gold hover:bg-et-gold/10 transition-colors text-left"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: BIOME_PALETTES[(n.biome as Mood) || 'calm'].accent }}
                      />
                      <span className="text-sm">{label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {chapterSelectorOpen && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-et-panel/95 border border-et-border rounded-lg shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-et-border">
              <h2 className="text-et-gold font-bold">切换章节 (C)</h2>
              <button
                type="button"
                onClick={() => setChapterSelectorOpen(false)}
                className="text-et-gold hover:text-white"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto space-y-2">
              {chapters.length === 0 ? (
                <p className="text-xs text-white/60">还没有章节。</p>
              ) : (
                chapters.map((chapter) => {
                  const isActive = chapter.id === activeChapterId || (activeChapterId == null && chapter.id === chapters[0]?.id);
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => {
                        onSetActiveChapter?.(chapter.id);
                        setChapterSelectorOpen(false);
                        saveGame({
                          nodeId: '',
                          x: 0,
                          y: 0,
                          light: lightRef.current,
                          inventory: inventoryRef.current,
                          activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
                          collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
                          savedAt: Date.now(),
        gameHour: gameHourRef.current,
                          house: houseRef.current,
                          activeChapterId: chapter.id,
                        }).catch(() => null);
                      }}
                      className={`w-full flex items-center gap-2 p-2 rounded border transition-colors text-left ${
                        isActive
                          ? 'border-et-gold bg-et-gold/10'
                          : 'border-et-border/50 hover:border-et-gold hover:bg-et-gold/10'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: chapter.themeColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: chapter.themeColor }}>
                          {chapter.title}
                        </div>
                        <div className="text-xs text-et-muted truncate">{chapter.subtitle}</div>
                      </div>
                      {isActive && <span className="text-xs text-et-gold">当前</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {pictureViewerOpen && pictureViewerUrl && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPictureViewerOpen(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={pictureViewerUrl}
              alt="壁画"
              className="max-w-full max-h-[80vh] rounded border-2 border-et-gold shadow-2xl"
            />
            <p className="text-center text-xs text-white/70 mt-2">点击任意处关闭</p>
          </div>
        </div>
      )}

      {bookEditorTarget && (
        <BookEditor
          house={houseRef.current}
          target={bookEditorTarget}
          onClose={() => setBookEditorTarget(null)}
          onSave={(books) => {
            const house = houseRef.current;
            if (!house) return;
            const deco = house.decorations.find(
              (d) => d.gx === bookEditorTarget.gx && d.gy === bookEditorTarget.gy && d.kind === 'bookshelf'
            );
            if (deco) {
              deco.books = books;
              saveGame({
                nodeId: '',
                x: 0,
                y: 0,
                light: lightRef.current,
                inventory: inventoryRef.current,
                activatedWaypoints: waypointsRef.current.filter((w) => w.activated).map((w) => w.nodeId),
                collectedCollectibles: collectiblesRef.current.filter((c) => c.collected).map((c) => c.id),
                savedAt: Date.now(),
                gameHour: gameHourRef.current,
                house,
              }).catch(() => null);
            }
            setBookEditorTarget(null);
          }}
        />
      )}

      <MobileControls
        onLeft={(active) => {
          keysRef.current.left = active;
        }}
        onRight={(active) => {
          keysRef.current.right = active;
        }}
        onJump={(active) => {
          const k = keysRef.current;
          if (active && !k.jump) k.jumpPressed = true;
          k.jump = active;
        }}
        onInteract={() => {
          keysRef.current.interactPressed = true;
        }}
        onTool={() => {
          keysRef.current.toolPressed = true;
        }}
        onInventory={() => setInventoryOpen((prev) => !prev)}
        onSettings={() => setSettingsOpen((prev) => !prev)}
      />
    </div>
  );
}
