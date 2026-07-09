import type { Collectible, House, HouseDecoration, HousePortal, HouseTile, JournalEntry, MapNode, Mood, Tile } from '@/types/game';
import { createNoise2D } from 'simplex-noise';
import { TILE_SIZE, WORLD_GROUND_Y, RENDER_MARGIN, CHUNK_WIDTH_TILES, BIOME_KEYS } from './constants';

export interface WorldData {
  tiles: Tile[];
  platforms: Tile[];
  /** 基于 TILE_SIZE 网格的空间索引，key 为 `${tx},${ty}`。 */
  tileMap: Map<string, Tile>;
  minX: number;
  maxX: number;
  groundY: number;
  house?: House;
}

const SEED = 0.42;
const CAVE_SEED = 0.73;
const noise2D = createNoise2D(() => SEED);
const caveNoise2D = createNoise2D(() => CAVE_SEED);

const MAX_BODY_DEPTH = 28;
const CAVE_MIN_DEPTH = 3;
const CAVE_MAX_DEPTH = 5;
const CAVE_THRESHOLD = 0.22;

/** 以 Tile[] 引用为 key 的弱引用空间索引缓存，保持 tileAt/isSolidAt/getTilesInRange 签名不变。 */
const tileIndex = new WeakMap<Tile[], Map<string, Tile>>();

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function registerTileIndex(tiles: Tile[], map: Map<string, Tile>): void {
  tileIndex.set(tiles, map);
}

function tileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function generateWorld(entries: JournalEntry[], nodes: MapNode[]): WorldData {
  const platforms: Tile[] = [];

  if (nodes.length === 0) {
    return { tiles: [], platforms, tileMap: new Map(), minX: 0, maxX: 800, groundY: WORLD_GROUND_Y };
  }

  const minX = nodes[0].x - 200;
  const maxX = nodes[nodes.length - 1].x + 600;
  const latestNode = nodes[nodes.length - 1];
  const spawnTxMin = Math.floor((latestNode.x - 3 * TILE_SIZE) / TILE_SIZE);
  const spawnTxMax = Math.floor((latestNode.x + 3 * TILE_SIZE) / TILE_SIZE);

  // Identify gap columns; avoid placing gaps directly under nodes or near the spawn area.
  const nodeXs = new Set(nodes.map((n) => Math.floor(n.x / TILE_SIZE) * TILE_SIZE));
  const gapColumns = new Set<number>();
  for (let wx = Math.floor(minX / TILE_SIZE) * TILE_SIZE; wx <= maxX; wx += TILE_SIZE) {
    const tx = Math.floor(wx / TILE_SIZE);
    if (tx >= spawnTxMin && tx <= spawnTxMax) continue;
    if (nodeXs.has(wx)) continue;
    const seed = hashString(`gap-${wx}`);
    if (seed < 0.05) {
      gapColumns.add(wx);
      if (seed < 0.015) gapColumns.add(wx + TILE_SIZE);
    }
  }

  const surfaceYs = new Map<number, number>();
  const biomeForColumn = new Map<number, Mood>();
  const tileMap = new Map<string, Tile>();
  const initialTiles: Tile[] = [];

  // Generate continuous ground across the entire world width, deep enough for vertical exploration.
  for (let wx = Math.floor(minX / TILE_SIZE) * TILE_SIZE; wx <= maxX; wx += TILE_SIZE) {
    const noise = noise2D(wx * 0.005, 0);
    const surfaceY = WORLD_GROUND_Y + Math.round((noise * 60) / TILE_SIZE) * TILE_SIZE;
    surfaceYs.set(wx, surfaceY);

    const nearestNode = nodes.reduce((prev, curr) =>
      Math.abs(curr.x - wx) < Math.abs(prev.x - wx) ? curr : prev
    );
    const biome = ((nearestNode.biome as Mood) || 'calm') as Mood;
    biomeForColumn.set(wx, biome);

    if (gapColumns.has(wx)) {
      initialTiles.push({ x: wx, y: surfaceY, type: 'gap', biome, solid: false });
      for (let d = 1; d <= MAX_BODY_DEPTH; d++) {
        initialTiles.push({ x: wx, y: surfaceY + d * TILE_SIZE, type: bodyTileTypeForMood(biome, d), biome, solid: false });
      }
      continue;
    }

    // Surface tile.
    initialTiles.push({
      x: wx,
      y: surfaceY,
      type: topTileTypeForMood(biome),
      biome,
      solid: true,
      destructible: true,
    });

    // Body tiles going down.
    for (let d = 1; d <= MAX_BODY_DEPTH; d++) {
      const bodyType = bodyTileTypeForMood(biome, d);
      // 浅层土石可被破坏，允许有限度的垂直探索；
      // 深层保留为地形骨架，避免完全挖穿世界。
      const destructible = d <= 8;
      initialTiles.push({
        x: wx,
        y: surfaceY + d * TILE_SIZE,
        type: bodyType,
        biome,
        solid: true,
        destructible,
      });
    }

    // Optional: small marker pedestal at ground level under waypoints.
    const nodeHere = nodes.find((n) => Math.abs(n.x - wx) < TILE_SIZE / 2);
    if (nodeHere) {
      const pedestalY = Math.floor((nodeHere.y + 32) / TILE_SIZE) * TILE_SIZE;
      const pedestal: Tile = { x: wx, y: pedestalY, type: 'stone', biome, solid: false };
      initialTiles.push(pedestal);
      platforms.push(pedestal);
    }
  }

  // Build spatial index for mutation passes.
  for (const t of initialTiles) {
    tileMap.set(tileKey(Math.floor(t.x / TILE_SIZE), Math.floor(t.y / TILE_SIZE)), t);
  }

  // Carve connected cave cavities in underground layers 3-5, protecting the spawn area.
  for (let wx = Math.floor(minX / TILE_SIZE) * TILE_SIZE; wx <= maxX; wx += TILE_SIZE) {
    const tx = Math.floor(wx / TILE_SIZE);
    if (tx >= spawnTxMin && tx <= spawnTxMax) continue;
    const surfaceY = surfaceYs.get(wx) ?? WORLD_GROUND_Y;
    for (let d = CAVE_MIN_DEPTH; d <= CAVE_MAX_DEPTH; d++) {
      const caveVal = caveNoise2D(wx * 0.015, d * 0.25);
      if (caveVal > CAVE_THRESHOLD) {
        const tile = tileMap.get(tileKey(tx, Math.floor((surfaceY + d * TILE_SIZE) / TILE_SIZE)));
        if (tile && tile.type !== 'gap' && tile.type !== 'water') {
          tile.solid = false;
          tile.type = 'dirt';
        }
      }
    }
  }

  // Generate small platforms between cave floors and the surface.
  for (let wx = Math.floor(minX / TILE_SIZE) * TILE_SIZE; wx <= maxX; wx += TILE_SIZE) {
    const tx = Math.floor(wx / TILE_SIZE);
    if (tx >= spawnTxMin && tx <= spawnTxMax) continue;
    const surfaceY = surfaceYs.get(wx) ?? WORLD_GROUND_Y;
    const rand = seededRandom(hashString(`plat-${wx}`));
    if (rand() >= 0.05) continue;
    const depth = 2 + Math.floor(rand() * 2);
    const length = 2 + Math.floor(rand() * 2);
    const biome = biomeForColumn.get(wx) ?? 'calm';
    for (let i = 0; i < length; i++) {
      const px = wx + i * TILE_SIZE;
      const py = surfaceY + depth * TILE_SIZE;
      const key = tileKey(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
      const existing = tileMap.get(key);
      if (existing && existing.solid) continue;
      const platform: Tile = { x: px, y: py, type: 'platform', biome, solid: true };
      tileMap.set(key, platform);
      platforms.push(platform);
    }
  }

  // Fill low-lying hollow bottoms and surface depressions with water.
  for (let wx = Math.floor(minX / TILE_SIZE) * TILE_SIZE; wx <= maxX; wx += TILE_SIZE) {
    const tx = Math.floor(wx / TILE_SIZE);
    const surfaceY = surfaceYs.get(wx) ?? WORLD_GROUND_Y;
    const surfaceTile = tileMap.get(tileKey(tx, Math.floor(surfaceY / TILE_SIZE)));
    const biome = surfaceTile?.biome ?? 'calm';

    // Surface depressions.
    const leftY = surfaceYs.get(wx - TILE_SIZE) ?? surfaceY;
    const rightY = surfaceYs.get(wx + TILE_SIZE) ?? surfaceY;
    if (surfaceY > leftY && surfaceY > rightY) {
      const key = tileKey(tx, Math.floor((surfaceY - TILE_SIZE) / TILE_SIZE));
      if (!tileMap.has(key)) {
        tileMap.set(key, { x: wx, y: surfaceY - TILE_SIZE, type: 'water', biome, solid: false });
      }
    }

    // Hollow / cave bottoms.
    for (let d = 1; d < MAX_BODY_DEPTH; d++) {
      const y = surfaceY + d * TILE_SIZE;
      const key = tileKey(tx, Math.floor(y / TILE_SIZE));
      const tile = tileMap.get(key);
      if (!tile || tile.solid || tile.type === 'water') continue;
      const belowKey = tileKey(tx, Math.floor((y + TILE_SIZE) / TILE_SIZE));
      const below = tileMap.get(belowKey);
      if (below && below.solid) {
        const waterRand = seededRandom(hashString(`water-${wx}-${d}`));
        if (waterRand() < 0.16) {
          tile.type = 'water';
          tile.solid = false;
        }
      }
    }
  }

  // Generate floating sky islands above the surface.
  generateSkyIslands(tileMap, platforms, minX, maxX);

  // Fill the deepest underground with a lava lake.
  generateLavaLayer(tileMap, surfaceYs);

  // Carve ruin rooms in the deep underground.
  generateRuinRooms(tileMap, surfaceYs, spawnTxMin, spawnTxMax);

  // Rebuild the tile array after mutation passes.
  const tiles = Array.from(tileMap.values());

  // 为特定情绪生态生成特殊瓦片：忧伤雨幕、愤怒脆岩。
  addSpecialTiles(tiles, nodes);

  // 预生成装饰物，按生态与随机种子决定植被群落与密度。
  for (const t of tiles) {
    t.decoration = chooseDecoration(t);
    // 为可交互植物绑定生长状态，供摘花、砍树使用。
    if (
      t.decoration === 'tree' ||
      t.decoration === 'flower' ||
      t.decoration === 'mushroom' ||
      t.decoration === 'deadTree' ||
      t.decoration === 'cactus'
    ) {
      t.plant = { kind: t.decoration, stage: 'full', growthTimer: 0 };
    }
  }

  const finalTileMap = new Map<string, Tile>();
  for (const t of tiles) {
    finalTileMap.set(tileKey(Math.floor(t.x / TILE_SIZE), Math.floor(t.y / TILE_SIZE)), t);
  }
  registerTileIndex(tiles, finalTileMap);

  const house = generateHouse(tileMap, tiles, nodes, entries);

  return { tiles, platforms, tileMap: finalTileMap, minX, maxX, groundY: WORLD_GROUND_Y, house };
}

interface HouseLayout {
  floorPlan: HouseTile[][];
  decorations: HouseDecoration[];
  portal: HousePortal;
}

function buildHouseLayout(w: number, h: number, entries: JournalEntry[]): HouseLayout {
  const floorPlan: HouseTile[][] = [];
  const groundFloorY = h - 2;
  const upperFloorY = Math.max(3, Math.floor(h * 0.45));
  const doorX = Math.floor(w / 2);
  const ladderX = w - 3;
  const portalX = w - 2;

  for (let gy = 0; gy < h; gy++) {
    const row: HouseTile[] = [];
    for (let gx = 0; gx < w; gx++) {
      const isOuterWall = gy === 0 || gy === h - 1 || gx === 0 || gx === w - 1;
      const isGroundFloor = gy === groundFloorY;
      const isUpperFloor = gy === upperFloorY;
      const isLadderOpening = gx === ladderX && gy === upperFloorY;
      const isDoor = gx === doorX && gy === h - 1;
      const isWindow = (gx === 3 || gx === w - 4) && gy === 1;

      if (isDoor) {
        row.push({ type: 'door' });
      } else if (isWindow) {
        row.push({ type: 'window' });
      } else if (isOuterWall) {
        row.push({ type: 'wall' });
      } else if (isGroundFloor || (isUpperFloor && !isLadderOpening)) {
        row.push({ type: 'floor' });
      } else {
        row.push({ type: 'empty' });
      }
    }
    floorPlan.push(row);
  }

  const decorations: HouseDecoration[] = [];
  // 地面层家具：沿地板美观整齐摆放，门（doorX）与梯子（ladderX）处不放物品。
  const placeOnGround = (gx: number, kind: HouseDecoration['kind']) => {
    if (gx === doorX || gx === ladderX) return;
    decorations.push({ id: `house-${kind}-${gx}-${groundFloorY}`, kind, gx, gy: groundFloorY });
  };
  placeOnGround(4, 'bookshelf');
  placeOnGround(5, 'chair');
  placeOnGround(7, 'table');
  placeOnGround(w - 5, 'crafting-table');
  // 梯子从地面层通向上层开口，占满整段竖直空间。
  for (let gy = upperFloorY; gy <= groundFloorY; gy++) {
    decorations.push({ id: `house-ladder-${gy}`, kind: 'ladder', gx: ladderX, gy });
  }

  // 上层家具：围绕中央地毯摆放，梯子开口处不放物品。
  const placeOnUpper = (gx: number, kind: HouseDecoration['kind']) => {
    if (gx === ladderX) return;
    decorations.push({ id: `house-${kind}-${gx}-${upperFloorY}`, kind, gx, gy: upperFloorY });
  };
  placeOnUpper(1, 'lamp');
  placeOnUpper(3, 'plant');
  placeOnUpper(doorX, 'rug');
  placeOnUpper(w - 5, 'chair');

  // 墙壁装饰：灯挂在右上角，相框挂在正上方墙壁。
  decorations.push({ id: 'house-lamp-wall', kind: 'lamp', gx: w - 2, gy: 1 });
  const latestImageEntry = [...entries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find((e) => e.image);
  decorations.push({
    id: 'house-picture-1',
    kind: 'picture-frame',
    gx: doorX,
    gy: 1,
    imageUrl: latestImageEntry?.image,
  });

  // 传送门放在屋内地面右下角，避免与梯子重叠。
  const portal: HousePortal = { gx: portalX, gy: h - 1 };

  return { floorPlan, decorations, portal };
}

function generateHouse(
  _tileMap: Map<string, Tile>,
  _tiles: Tile[],
  nodes: MapNode[],
  entries: JournalEntry[]
): House | undefined {
  if (nodes.length === 0) return undefined;

  const houseW = 20;
  const houseH = 16;

  // 将小屋逻辑位置放在出生点左侧不远处，但不在地图上放置实体瓦片。
  const latestNode = nodes[nodes.length - 1];
  const anchorX = Math.max(
    nodes[0].x - 160,
    latestNode.x - houseW * TILE_SIZE - 120
  );

  // 找到 anchorX 处的地表高度，并向下取整到网格。
  let groundY = WORLD_GROUND_Y;
  const anchorTx = Math.floor(anchorX / TILE_SIZE);
  const surfaceTile = _tileMap.get(tileKey(anchorTx, Math.floor(WORLD_GROUND_Y / TILE_SIZE)));
  if (surfaceTile) {
    groundY = surfaceTile.y;
  } else {
    const noise = noise2D(anchorTx * TILE_SIZE * 0.005, 0);
    groundY = WORLD_GROUND_Y + Math.round((noise * 60) / TILE_SIZE) * TILE_SIZE;
  }

  const startX = Math.floor(anchorX / TILE_SIZE) * TILE_SIZE;
  const startY = groundY - (houseH - 1) * TILE_SIZE;

  const layout = buildHouseLayout(houseW, houseH, entries);

  return {
    id: 'player-house',
    x: startX,
    y: startY,
    width: houseW,
    height: houseH,
    floorPlan: layout.floorPlan,
    decorations: layout.decorations,
    portal: layout.portal,
  };
}

export function resizeHouseToScreen(
  house: House,
  screenW: number,
  screenH: number,
  entries: JournalEntry[]
): House {
  // 小屋尺寸精确匹配屏幕，避免额外边距把地板挤出可视区。
  const targetW = Math.max(house.width, Math.ceil(screenW / TILE_SIZE));
  const targetH = Math.max(house.height, Math.ceil(screenH / TILE_SIZE));
  if (targetW === house.width && targetH === house.height) return house;

  const offsetX = Math.floor((targetW - house.width) / 2);
  const offsetY = Math.floor((targetH - house.height) / 2);

  // 按新尺寸生成双层小屋默认布局。
  const layout = buildHouseLayout(targetW, targetH, entries);

  // 保留玩家编辑过的格子（playerPlaced）。
  for (let gy = 0; gy < targetH; gy++) {
    for (let gx = 0; gx < targetW; gx++) {
      const oldGx = gx - offsetX;
      const oldGy = gy - offsetY;
      const oldCell = house.floorPlan[oldGy]?.[oldGx];
      if (oldCell?.playerPlaced) {
        layout.floorPlan[gy][gx] = { ...oldCell };
      }
    }
  }

  // 偏移并保留原有装饰（含玩家放置的）。
  const oldDecoPositions = new Set<string>();
  for (const d of house.decorations) {
    const newGx = d.gx + offsetX;
    const newGy = d.gy + offsetY;
    if (newGx >= 0 && newGx < targetW && newGy >= 0 && newGy < targetH) {
      layout.decorations.push({ ...d, gx: newGx, gy: newGy });
      oldDecoPositions.add(`${newGx},${newGy}`);
    }
  }

  // 移除与旧装饰位置冲突的默认装饰，避免重叠。
  layout.decorations = layout.decorations.filter((d) => {
    const isNewDefault = !house.decorations.some((od) => od.id === d.id);
    if (isNewDefault && oldDecoPositions.has(`${d.gx},${d.gy}`)) return false;
    return true;
  });

  return {
    ...house,
    x: house.x - offsetX * TILE_SIZE,
    y: house.y - offsetY * TILE_SIZE,
    width: targetW,
    height: targetH,
    floorPlan: layout.floorPlan,
    decorations: layout.decorations,
    portal: layout.portal,
  };
}

function addSpecialTiles(tiles: Tile[], nodes: MapNode[]): void {
  const nodeXs = new Set(nodes.map((n) => Math.floor(n.x / TILE_SIZE) * TILE_SIZE));

  for (const tile of tiles) {
    if (!tile.solid) continue;
    if (nodeXs.has(tile.x)) continue;

    if (tile.biome === 'sad' && tile.type === 'mud') {
      const seed = hashString(`raincurtain-${tile.x}`);
      const rand = seededRandom(seed);
      if (rand() >= 0.04) continue;
      const height = 2 + Math.floor(rand() * 3);
      for (let d = 1; d <= height; d++) {
        tiles.push({
          x: tile.x,
          y: tile.y - d * TILE_SIZE,
          type: 'raincurtain',
          biome: 'sad',
          solid: true,
        });
      }
    } else if (tile.biome === 'angry' && tile.type === 'ash') {
      const seed = hashString(`brittle-${tile.x}`);
      const rand = seededRandom(seed);
      if (rand() >= 0.04) continue;
      tiles.push({
        x: tile.x,
        y: tile.y - TILE_SIZE,
        type: 'brittle',
        biome: 'angry',
        solid: true,
      });
    }
  }
}

function topTileTypeForMood(mood: Mood): Tile['type'] {
  switch (mood) {
    case 'joy':
      return 'grass';
    case 'calm':
      return 'grass';
    case 'sad':
      return 'mud';
    case 'angry':
      return 'ash';
    case 'tired':
      return 'sand';
    case 'anxious':
      return 'mycelium';
    default:
      return 'grass';
  }
}

function bodyTileTypeForMood(mood: Mood, depth: number): Tile['type'] {
  if (depth <= 2) return 'dirt';
  if (depth <= 5) return 'stone';
  return 'stone';
}

function chooseDecoration(t: Tile): string | undefined {
  if (!t.solid || t.type === 'water' || t.type === 'platform') return undefined;
  const rand = seededRandom(hashString(`${t.x},${t.y},${t.type},${t.biome}-deco`));
  const r = rand();
  const { biome, type } = t;

  if (type === 'grass') {
    switch (biome) {
      case 'joy':
        if (r < 0.28) return 'tree';
        if (r < 0.4) return 'flower';
        if (r < 0.62) return 'grass';
        if (r < 0.7) return 'rock';
        break;
      case 'calm':
        if (r < 0.22) return 'tree';
        if (r < 0.34) return 'flower';
        if (r < 0.56) return 'grass';
        if (r < 0.64) return 'rock';
        break;
      case 'tired':
        if (r < 0.08) return 'tree';
        if (r < 0.18) return 'grass';
        if (r < 0.3) return 'rock';
        break;
      case 'angry':
        if (r < 0.1) return 'deadTree';
        if (r < 0.28) return 'rock';
        break;
      case 'sad':
        if (r < 0.12) return 'tree';
        if (r < 0.26) return 'flower';
        if (r < 0.44) return 'grass';
        break;
      case 'anxious':
        if (r < 0.14) return 'mushroom';
        if (r < 0.3) return 'grass';
        break;
    }
  } else if (type === 'sand') {
    if (r < 0.14) return 'cactus';
    if (r < 0.26) return 'rock';
  } else if (type === 'ash') {
    if (r < 0.22) return 'volcanic';
    if (r < 0.36) return 'rock';
  } else if (type === 'mycelium') {
    if (r < 0.24) return 'mushroom';
    if (r < 0.38) return 'grass';
  }
  return undefined;
}

export function buildUndergroundGems(tiles: Tile[], count = 24): Collectible[] {
  const gems: Collectible[] = [];
  const candidates = tiles.filter(
    (t) =>
      t.solid &&
      t.type !== 'platform' &&
      t.type !== 'water' &&
      t.y >= WORLD_GROUND_Y + TILE_SIZE * 8 &&
      !t.type.startsWith('raincurtain') &&
      !t.type.startsWith('brittle')
  );

  for (let i = 0; i < count; i++) {
    const base = candidates[Math.floor((i / count) * candidates.length)];
    if (!base) continue;
    const rand = seededRandom(hashString(`gem-${base.x}-${base.y}-${i}`));
    // Place gem just above the solid tile with some horizontal jitter.
    const gx = base.x + Math.floor(rand() * 12) - 6;
    const gy = base.y - TILE_SIZE - Math.floor(rand() * 8);
    gems.push({
      id: `underground-gem-${i}`,
      x: gx,
      y: gy,
      width: 14,
      height: 14,
      kind: 'gem',
      label: '地下晶簇',
      collected: false,
      floatOffset: rand() * Math.PI * 2,
    });
  }

  return gems;
}

export function getTilesInRange(tiles: Tile[], cameraX: number, cameraY: number, viewWidth: number, viewHeight: number): Tile[] {
  const index = tileIndex.get(tiles);
  if (!index) {
    return tiles.filter(
      (t) =>
        t.x + TILE_SIZE >= cameraX - RENDER_MARGIN &&
        t.x <= cameraX + viewWidth + RENDER_MARGIN &&
        t.y + TILE_SIZE >= cameraY - RENDER_MARGIN &&
        t.y <= cameraY + viewHeight + RENDER_MARGIN
    );
  }

  const startTx = Math.floor((cameraX - RENDER_MARGIN) / TILE_SIZE);
  const endTx = Math.floor((cameraX + viewWidth + RENDER_MARGIN) / TILE_SIZE);
  const startTy = Math.floor((cameraY - RENDER_MARGIN) / TILE_SIZE);
  const endTy = Math.floor((cameraY + viewHeight + RENDER_MARGIN) / TILE_SIZE);

  const result: Tile[] = [];
  for (let tx = startTx; tx <= endTx; tx++) {
    for (let ty = startTy; ty <= endTy; ty++) {
      const tile = index.get(tileKey(tx, ty));
      if (tile) result.push(tile);
    }
  }
  // 让切片数组也能复用同一空间索引，保证 TileRenderer 内部查询为 O(1)。
  registerTileIndex(result, index);
  return result;
}

export function findSurfaceYAt(tiles: Tile[], x: number): number | undefined {
  const tx = Math.floor(x / TILE_SIZE);
  let surface: Tile | undefined;
  for (const t of tiles) {
    if (Math.floor(t.x / TILE_SIZE) !== tx) continue;
    if (!t.solid) continue;
    // 优先选择地表附近的实心瓦片，避免出生在天空岛或悬浮平台上。
    if (t.y < WORLD_GROUND_Y - 120) continue;
    if (!surface || t.y < surface.y) surface = t;
  }
  return surface?.y;
}

export function tileAt(tiles: Tile[], x: number, y: number): Tile | undefined {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  const index = tileIndex.get(tiles);
  if (index) return index.get(tileKey(tx, ty));
  return tiles.find((t) => Math.floor(t.x / TILE_SIZE) === tx && Math.floor(t.y / TILE_SIZE) === ty);
}

export function isSolidAt(tiles: Tile[], x: number, y: number): boolean {
  const tile = tileAt(tiles, x, y);
  return tile ? tile.solid && !tile.destroyed : false;
}

/** 动态添加瓦片并同步空间索引。 */
export function addTile(tiles: Tile[], tile: Tile): void {
  tiles.push(tile);
  const index = tileIndex.get(tiles);
  if (index) {
    index.set(tileKey(Math.floor(tile.x / TILE_SIZE), Math.floor(tile.y / TILE_SIZE)), tile);
  }
}

export function applyHouseFloorPlan(house: House, tiles: Tile[]): void {
  for (let gy = 0; gy < house.height; gy++) {
    const row = house.floorPlan[gy];
    if (!row) continue;
    for (let gx = 0; gx < house.width; gx++) {
      const cell = row[gx];
      if (!cell) continue;
      const wx = house.x + gx * TILE_SIZE + TILE_SIZE / 2;
      const wy = house.y + gy * TILE_SIZE + TILE_SIZE / 2;
      const tile = tileAt(tiles, wx, wy);
      if (!tile) continue;

      switch (cell.type) {
        case 'wall':
        case 'floor':
          tile.type = 'wood';
          tile.solid = true;
          tile.houseTile = true;
          tile.destructible = false;
          break;
        case 'door':
          tile.type = 'door';
          tile.solid = false;
          tile.houseTile = true;
          tile.destructible = false;
          break;
        case 'window':
          tile.type = 'window';
          tile.solid = false;
          tile.houseTile = true;
          tile.destructible = false;
          break;
        case 'empty':
          tile.type = 'gap';
          tile.solid = false;
          tile.houseTile = true;
          tile.destructible = false;
          break;
      }
    }
  }
}

/** 将用户手动编辑的瓦片应用到世界，覆盖同网格位置的地形。 */
export function applyManualTiles(world: WorldData, manualTiles: Tile[]): void {
  for (const tile of manualTiles) {
    const tx = Math.floor(tile.x / TILE_SIZE);
    const ty = Math.floor(tile.y / TILE_SIZE);
    const key = tileKey(tx, ty);
    const existing = world.tileMap.get(key);
    if (existing) {
      // 保留世界生成中的部分只读标记，避免编辑意外破坏特殊结构。
      const preserved = {
        houseTile: existing.houseTile,
        ruinCenter: existing.ruinCenter,
      };
      Object.assign(existing, tile, preserved);
    } else {
      world.tileMap.set(key, tile);
      world.tiles.push(tile);
    }
  }
  registerTileIndex(world.tiles, world.tileMap);
}

/** 判断是否需要向指定方向扩展世界，返回方向或 null。 */
export function shouldExtendWorld(
  world: WorldData,
  cameraX: number,
  viewWidth: number,
  buffer = 300
): 'left' | 'right' | null {
  if (cameraX < world.minX + buffer) return 'left';
  if (cameraX + viewWidth > world.maxX - buffer) return 'right';
  return null;
}

/** 根据世界 x 坐标确定一个确定性生态，用于无节点区域。 */
function biomeForExtendedX(wx: number): Mood {
  const idx = Math.floor(hashString(`biome-${Math.floor(wx / (CHUNK_WIDTH_TILES * TILE_SIZE))}`) / 4294967296 * BIOME_KEYS.length);
  return BIOME_KEYS[idx % BIOME_KEYS.length] ?? 'calm';
}

/** 为世界单向扩展一个区块，保持生态、洞穴、水体等空间可探索。 */
export function extendWorld(world: WorldData, direction: 'left' | 'right'): void {
  const chunkWidth = CHUNK_WIDTH_TILES * TILE_SIZE;
  const newMinX = direction === 'left' ? world.minX - chunkWidth : world.minX;
  const newMaxX = direction === 'right' ? world.maxX + chunkWidth : world.maxX;
  const startX = direction === 'left' ? world.minX - chunkWidth : world.maxX;
  const endX = direction === 'left' ? world.minX : world.maxX + chunkWidth;

  const surfaceYs = new Map<number, number>();
  const biomeForColumn = new Map<number, Mood>();
  const newPlatforms: Tile[] = [];

  // 1. 地表与山体。
  for (let wx = Math.floor(startX / TILE_SIZE) * TILE_SIZE; wx <= endX; wx += TILE_SIZE) {
    const noise = noise2D(wx * 0.005, 0);
    const surfaceY = WORLD_GROUND_Y + Math.round((noise * 60) / TILE_SIZE) * TILE_SIZE;
    surfaceYs.set(wx, surfaceY);

    const biome = biomeForColumn.get(wx) ?? biomeForExtendedX(wx);
    biomeForColumn.set(wx, biome);

    const topKey = tileKey(Math.floor(wx / TILE_SIZE), Math.floor(surfaceY / TILE_SIZE));
    if (!world.tileMap.has(topKey)) {
      world.tileMap.set(topKey, {
        x: wx,
        y: surfaceY,
        type: topTileTypeForMood(biome),
        biome,
        solid: true,
        destructible: true,
      });
    }

    for (let d = 1; d <= MAX_BODY_DEPTH; d++) {
      const y = surfaceY + d * TILE_SIZE;
      const key = tileKey(Math.floor(wx / TILE_SIZE), Math.floor(y / TILE_SIZE));
      if (world.tileMap.has(key)) continue;
      world.tileMap.set(key, {
        x: wx,
        y,
        type: bodyTileTypeForMood(biome, d),
        biome,
        solid: true,
        destructible: d <= 8,
      });
    }
  }

  // 2. 洞穴、平台、水体使用与主世界一致的算法。
  for (let wx = Math.floor(startX / TILE_SIZE) * TILE_SIZE; wx <= endX; wx += TILE_SIZE) {
    const tx = Math.floor(wx / TILE_SIZE);
    const surfaceY = surfaceYs.get(wx) ?? WORLD_GROUND_Y;
    const biome = biomeForColumn.get(wx) ?? 'calm';

    // 洞穴。
    for (let d = CAVE_MIN_DEPTH; d <= CAVE_MAX_DEPTH; d++) {
      const caveVal = caveNoise2D(wx * 0.015, d * 0.25);
      if (caveVal > CAVE_THRESHOLD) {
        const tile = world.tileMap.get(tileKey(tx, Math.floor((surfaceY + d * TILE_SIZE) / TILE_SIZE)));
        if (tile && tile.type !== 'gap' && tile.type !== 'water') {
          tile.solid = false;
          tile.type = 'dirt';
        }
      }
    }

    // 平台。
    const platRand = seededRandom(hashString(`plat-${wx}`));
    if (platRand() < 0.05) {
      const depth = 2 + Math.floor(platRand() * 2);
      const length = 2 + Math.floor(platRand() * 2);
      for (let i = 0; i < length; i++) {
        const px = wx + i * TILE_SIZE;
        const py = surfaceY + depth * TILE_SIZE;
        const key = tileKey(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
        const existing = world.tileMap.get(key);
        if (existing && existing.solid) continue;
        const platform: Tile = { x: px, y: py, type: 'platform', biome, solid: true };
        world.tileMap.set(key, platform);
        newPlatforms.push(platform);
      }
    }

    // 地表洼地积水。
    const leftY = surfaceYs.get(wx - TILE_SIZE) ?? surfaceY;
    const rightY = surfaceYs.get(wx + TILE_SIZE) ?? surfaceY;
    if (surfaceY > leftY && surfaceY > rightY) {
      const key = tileKey(tx, Math.floor((surfaceY - TILE_SIZE) / TILE_SIZE));
      if (!world.tileMap.has(key)) {
        world.tileMap.set(key, { x: wx, y: surfaceY - TILE_SIZE, type: 'water', biome, solid: false });
      }
    }

    // 洞穴底部水体。
    for (let d = 1; d < MAX_BODY_DEPTH; d++) {
      const y = surfaceY + d * TILE_SIZE;
      const key = tileKey(tx, Math.floor(y / TILE_SIZE));
      const tile = world.tileMap.get(key);
      if (!tile || tile.solid || tile.type === 'water') continue;
      const belowKey = tileKey(tx, Math.floor((y + TILE_SIZE) / TILE_SIZE));
      const below = world.tileMap.get(belowKey);
      if (below && below.solid) {
        const waterRand = seededRandom(hashString(`water-${wx}-${d}`));
        if (waterRand() < 0.16) {
          tile.type = 'water';
          tile.solid = false;
        }
      }
    }
  }

  // 3. 天空岛、岩浆层、遗迹房间。
  generateSkyIslands(world.tileMap, world.platforms, startX, endX);
  generateLavaLayer(world.tileMap, surfaceYs);
  generateRuinRooms(world.tileMap, surfaceYs, Number.NaN, Number.NaN);

  // 4. 更新世界边界与数组。
  world.minX = newMinX;
  world.maxX = newMaxX;
  world.platforms.push(...newPlatforms);

  // 重建 tiles 数组、索引和装饰。
  world.tiles.length = 0;
  for (const t of world.tileMap.values()) {
    world.tiles.push(t);
  }

  // 为新增瓦片生成装饰与植物状态。
  for (const t of world.tiles) {
    if (t.decoration === undefined) {
      t.decoration = chooseDecoration(t);
      if (
        t.decoration === 'tree' ||
        t.decoration === 'flower' ||
        t.decoration === 'mushroom' ||
        t.decoration === 'deadTree' ||
        t.decoration === 'cactus'
      ) {
        t.plant = { kind: t.decoration, stage: 'full', growthTimer: 0 };
      }
    }
  }

  registerTileIndex(world.tiles, world.tileMap);
}

function generateSkyIslands(tileMap: Map<string, Tile>, platforms: Tile[], minX: number, maxX: number): void {
  const rand = seededRandom(hashString('sky-islands'));
  const count = 2 + Math.floor(rand() * 3); // 2-4
  const skyTop = -320;
  const skyBottom = WORLD_GROUND_Y - 220;

  for (let i = 0; i < count; i++) {
    const cx = minX + TILE_SIZE * 4 + Math.floor(rand() * ((maxX - minX - TILE_SIZE * 8) / TILE_SIZE)) * TILE_SIZE;
    const cy = skyTop + Math.floor(rand() * ((skyBottom - skyTop) / TILE_SIZE)) * TILE_SIZE;
    const rx = 4 + Math.floor(rand() * 5); // 4-8
    const ry = 4 + Math.floor(rand() * 5);
    const biome: Mood = rand() > 0.5 ? 'joy' : 'calm';

    const bottomByColumn = new Map<number, number>();

    for (let dx = -rx; dx <= rx; dx++) {
      for (let dy = -ry; dy <= ry; dy++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
        const x = cx + dx * TILE_SIZE;
        const y = cy + dy * TILE_SIZE;
        const key = tileKey(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
        if (tileMap.has(key)) continue;

        let type: Tile['type'] = 'stone';
        if (dy < -ry * 0.35) type = 'grass';
        else if (dy < ry * 0.35) type = 'dirt';

        const tile: Tile = { x, y, type, biome, solid: true };
        tileMap.set(key, tile);

        const col = Math.floor(x / TILE_SIZE);
        const currentBottom = bottomByColumn.get(col);
        if (currentBottom === undefined || y > currentBottom) {
          bottomByColumn.set(col, y);
        }
      }
    }

    for (const [col, bottomY] of bottomByColumn) {
      if (rand() >= 0.35) continue;
      const rootLength = 1 + Math.floor(rand() * 2); // 1-2
      for (let r = 1; r <= rootLength; r++) {
        const x = col * TILE_SIZE;
        const y = bottomY + r * TILE_SIZE;
        const key = tileKey(col, Math.floor(y / TILE_SIZE));
        if (tileMap.has(key)) continue;
        const root: Tile = { x, y, type: 'platform', biome, solid: true, decoration: 'root' };
        tileMap.set(key, root);
        platforms.push(root);
      }
    }
  }
}

function generateLavaLayer(tileMap: Map<string, Tile>, surfaceYs: Map<number, number>): void {
  const rand = seededRandom(hashString('deep-lava'));
  const depth = 12 + Math.floor(rand() * 9); // 12-20

  for (const [wx, surfaceY] of surfaceYs) {
    const bottomY = surfaceY + MAX_BODY_DEPTH * TILE_SIZE;
    const tx = Math.floor(wx / TILE_SIZE);
    for (let d = 0; d < depth; d++) {
      const y = bottomY - d * TILE_SIZE;
      if (y <= 800) continue;
      const ty = Math.floor(y / TILE_SIZE);
      const key = tileKey(tx, ty);
      const existing = tileMap.get(key);
      if (existing) {
        existing.type = 'lava';
        existing.solid = false;
        existing.destructible = false;
        existing.decoration = undefined;
      } else {
        tileMap.set(key, { x: wx, y, type: 'lava', biome: 'calm', solid: false });
      }
    }
  }
}

function generateRuinRooms(
  tileMap: Map<string, Tile>,
  surfaceYs: Map<number, number>,
  spawnTxMin: number,
  spawnTxMax: number
): void {
  const rand = seededRandom(hashString('ruin-rooms'));
  const count = 1 + Math.floor(rand() * 3); // 1-3
  const xs = Array.from(surfaceYs.keys());
  if (xs.length === 0) return;
  const minTx = Math.floor((Math.min(...xs) + TILE_SIZE * 2) / TILE_SIZE);
  const maxTx = Math.floor((Math.max(...xs) - TILE_SIZE * 2) / TILE_SIZE);
  if (maxTx <= minTx) return;

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let roomTx = 0;
    let roomTy = 0;
    let w = 0;
    let h = 0;
    let ok = false;

    while (attempts < 20 && !ok) {
      roomTx = minTx + Math.floor(rand() * (maxTx - minTx + 1));
      if (roomTx >= spawnTxMin - 2 && roomTx <= spawnTxMax + 2) {
        attempts++;
        continue;
      }
      w = 3 + Math.floor(rand() * 3); // 3-5
      h = 3 + Math.floor(rand() * 2); // 3-4
      roomTy = Math.floor((900 + Math.floor(rand() * 250)) / TILE_SIZE);
      const surfaceY = surfaceYs.get(roomTx * TILE_SIZE) ?? WORLD_GROUND_Y;
      const bottomY = surfaceY + MAX_BODY_DEPTH * TILE_SIZE;
      if ((roomTy + Math.floor(h / 2)) * TILE_SIZE >= bottomY - TILE_SIZE * 2) {
        attempts++;
        continue;
      }
      ok = true;
      for (let dx = 0; dx < w; dx++) {
        const x = (roomTx + dx) * TILE_SIZE;
        const surfaceTile = tileMap.get(tileKey(Math.floor(x / TILE_SIZE), Math.floor(surfaceY / TILE_SIZE)));
        if (surfaceTile && surfaceTile.type === 'gap') {
          ok = false;
          break;
        }
      }
      attempts++;
    }

    if (!ok) continue;

    const centerX = roomTx + Math.floor(w / 2);
    const centerY = roomTy + Math.floor(h / 2);

    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const tx = roomTx + dx;
        const ty = roomTy + dy;
        const key = tileKey(tx, ty);
        const existing = tileMap.get(key);
        if (existing) {
          existing.type = 'dirt';
          existing.solid = false;
          existing.destructible = false;
          existing.decoration = undefined;
        } else {
          tileMap.set(key, { x: tx * TILE_SIZE, y: ty * TILE_SIZE, type: 'dirt', biome: 'calm', solid: false });
        }
      }
    }

    const centerKey = tileKey(centerX, centerY);
    const centerTile = tileMap.get(centerKey);
    if (centerTile) {
      centerTile.type = 'stone';
      centerTile.solid = true;
      centerTile.destructible = false;
      centerTile.ruinCenter = true;
      centerTile.decoration = undefined;
    } else {
      tileMap.set(centerKey, {
        x: centerX * TILE_SIZE,
        y: centerY * TILE_SIZE,
        type: 'stone',
        biome: 'calm',
        solid: true,
        ruinCenter: true,
      });
    }
  }
}
