import type {
  Waypoint,
  Collectible,
  JournalEntry,
  MapNode,
  Mood,
  PlayerState,
  SaveBench,
  Tile,
  Echo,
  CraftingFurnace,
} from '@/types/game';
import { MOODS } from '@/lib/moods';
import { TILE_SIZE, WORLD_GROUND_Y } from '@/lib/game/constants';

const WAYPOINT_WIDTH = 24;
const WAYPOINT_HEIGHT = 40;
const COLLECTIBLE_SIZE = 16;
const INTERACT_RADIUS = 40;
const BENCH_WIDTH = 36;
const BENCH_HEIGHT = 28;
const ECHO_WIDTH = 28;
const ECHO_HEIGHT = 44;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return (Math.abs(h) % 100000) / 100000;
}

function makeSeededRandom(seedStr: string): () => number {
  let s = Math.floor(hashString(seedStr) * 1000000) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getEntryById(entries: JournalEntry[], entryId: string): JournalEntry | undefined {
  return entries.find((e) => e.id === entryId);
}

function determineCollectibleKind(tag: string): Collectible['kind'] {
  if (['学习', '反思', '工作'].includes(tag)) return 'book';
  if (['运动', '户外', '挑战'].includes(tag)) return 'footprint';
  if (['家庭', '朋友', '爱情'].includes(tag)) return 'heart';
  if (['旅行', '冒险'].includes(tag)) return 'star';
  if (tag === '美食') return 'leaf';
  if (tag === '创作') return 'flame';
  return 'gem';
}

export function buildWaypoints(nodes: MapNode[], entries: JournalEntry[], tiles?: Tile[]): Waypoint[] {
  const sorted = [...nodes].sort((a, b) => a.index - b.index);
  const lastIndex = sorted.length > 0 ? sorted[sorted.length - 1].index : -1;

  const waypoints = sorted.map((node) => {
    const entry = getEntryById(entries, node.entryId);
    return {
      x: node.x - WAYPOINT_WIDTH / 2,
      y: node.y,
      width: WAYPOINT_WIDTH,
      height: WAYPOINT_HEIGHT,
      nodeId: node.id,
      entryId: node.entryId,
      index: node.index,
      biome: (node.biome as Mood) || entry?.mood || 'calm',
      rarity: entry?.rarity ?? 1,
      activated: node.index === lastIndex,
      pulse: Math.random() * Math.PI * 2,
    };
  });

  // 为记忆之门创造合理的立足点：地表门保护下方地面；洞穴/天空/深层门清理周围并铺设平台。
  if (tiles && tiles.length > 0) {
    for (const waypoint of waypoints) {
      const gx = Math.floor((waypoint.x + waypoint.width / 2) / TILE_SIZE);
      const gy = Math.floor((waypoint.y + waypoint.height) / TILE_SIZE);

      const columnTiles = tiles.filter((t) => Math.floor(t.x / TILE_SIZE) === gx && t.solid);
      const surfaceTile = columnTiles.sort((a, b) => a.y - b.y)[0];
      const surfaceY = surfaceTile?.y ?? WORLD_GROUND_Y;
      const isNonSurface = Math.abs((waypoint.y + waypoint.height) - (surfaceY + TILE_SIZE)) > TILE_SIZE;

      if (isNonSurface) {
        // 清理周围 3x5 空间，让门在洞穴/天空中可见且可站立。
        for (const tile of tiles) {
          const tx = Math.floor(tile.x / TILE_SIZE);
          const ty = Math.floor(tile.y / TILE_SIZE);
          const dx = tx - gx;
          const dy = ty - gy;
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 2 && tile.solid && tile.destructible !== false) {
            tile.type = 'gap';
            tile.solid = false;
          }
        }
      }

      // 脚下铺设不可破坏平台。
      for (let dx = -1; dx <= 1; dx++) {
        const tile = tiles.find((t) => Math.floor(t.x / TILE_SIZE) === gx + dx && Math.floor(t.y / TILE_SIZE) === gy);
        if (tile) {
          tile.solid = true;
          tile.type = 'platform';
          tile.destructible = false;
        } else {
          tiles.push({
            x: (gx + dx) * TILE_SIZE,
            y: gy * TILE_SIZE,
            type: 'platform',
            biome: waypoint.biome,
            solid: true,
            destructible: false,
          });
        }
      }
    }
  }

  return waypoints;
}

export function buildCollectibles(
  entries: JournalEntry[],
  nodes: MapNode[]
): Collectible[] {
  const collectibles: Collectible[] = [];

  for (const entry of entries) {
    const node = nodes.find((n) => n.entryId === entry.id);
    if (!node) continue;

    const tags = entry.tags.length > 0 ? entry.tags : ['回忆'];
    const count = Math.min(3, tags.length);
    const baseSeed = hashString(entry.id);

    for (let i = 0; i < count; i++) {
      const tag = tags[i];
      const seed = (baseSeed + i * 0.37) % 1;
      const kind: Collectible['kind'] = entry.image ? 'camera' : determineCollectibleKind(tag);
      const xOffset = (seed * 2 - 1) * TILE_SIZE * 2;
      const yOffset = (hashString(`${entry.id}-${i}-y`) - 0.5) * 12;

      collectibles.push({
        id: `${entry.id}-c-${i}`,
        x: node.x + xOffset - COLLECTIBLE_SIZE / 2,
        y: node.y - TILE_SIZE - COLLECTIBLE_SIZE / 2 + yOffset,
        width: COLLECTIBLE_SIZE,
        height: COLLECTIBLE_SIZE,
        kind,
        label: tag,
        entryId: entry.id,
        collected: false,
        floatOffset: seed * Math.PI * 2,
      });
    }
  }

  return collectibles;
}

export function buildSkyCollectibles(_nodes: MapNode[], tiles: Tile[]): Collectible[] {
  const rand = makeSeededRandom('sky-collectibles');
  const collectibles: Collectible[] = [];
  const skyTopTiles = tiles.filter(
    (t) =>
      t.solid &&
      t.type === 'grass' &&
      t.y < WORLD_GROUND_Y - 200 &&
      !tiles.some((o) => o.x === t.x && o.y === t.y - TILE_SIZE)
  );
  if (skyTopTiles.length === 0) return collectibles;

  const count = Math.min(3 + Math.floor(rand() * 4), skyTopTiles.length);
  const kinds: Collectible['kind'][] = ['star', 'leaf', 'flame'];
  const labels: Record<Collectible['kind'], string> = {
    star: '天空之星',
    leaf: '浮云之叶',
    flame: '高天之火',
    gem: '遗迹晶簇',
    camera: '遗迹留影',
    book: '书',
    footprint: '足迹',
    heart: '心',
    shard: '情绪碎片',
    wood: '木材',
    petal: '花瓣',
    spore: '孢子',
  };
  const step = Math.max(1, Math.floor(skyTopTiles.length / count));
  for (let i = 0; i < count; i++) {
    const base = skyTopTiles[(i * step + Math.floor(rand() * step)) % skyTopTiles.length];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    collectibles.push({
      id: `sky-${i}`,
      x: base.x + 4 + Math.floor(rand() * 8),
      y: base.y - TILE_SIZE - 4,
      width: 14,
      height: 14,
      kind,
      label: labels[kind],
      collected: false,
      floatOffset: rand() * Math.PI * 2,
    });
  }
  return collectibles;
}

export function buildRuinCollectibles(tiles: Tile[]): Collectible[] {
  const rand = makeSeededRandom('ruin-collectibles');
  const collectibles: Collectible[] = [];
  const centers = tiles.filter((t) => t.ruinCenter);
  const kinds: Collectible['kind'][] = ['gem', 'camera'];
  const labels: Record<Collectible['kind'], string> = {
    star: '天空之星',
    leaf: '浮云之叶',
    flame: '高天之火',
    gem: '遗迹晶簇',
    camera: '遗迹留影',
    book: '书',
    footprint: '足迹',
    heart: '心',
    shard: '情绪碎片',
    wood: '木材',
    petal: '花瓣',
    spore: '孢子',
  };
  let idx = 0;
  for (const center of centers) {
    const count = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(rand() * kinds.length)];
      const xOffset = (i === 0 ? -TILE_SIZE / 2 : TILE_SIZE / 2) + Math.floor(rand() * 8) - 4;
      collectibles.push({
        id: `ruin-${idx++}`,
        x: center.x + xOffset + TILE_SIZE / 2 - 7,
        y: center.y - TILE_SIZE - 4,
        width: 14,
        height: 14,
        kind,
        label: labels[kind],
        collected: false,
        floatOffset: rand() * Math.PI * 2,
      });
    }
  }
  return collectibles;
}

function extractEchoLines(text: string, seed: number): string[] {
  const sentences = text
    .split(/[。！？.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  const count = Math.min(3, Math.max(2, 2 + Math.floor(seed * 2)));
  const picked: string[] = sentences.slice(0, count);
  if (picked.length === 0) {
    // 文本过短无法分句时，按固定长度截断。
    const chunk = text.length > 40 ? `${text.slice(0, 38)}…` : text;
    picked.push(chunk);
  }

  const prefixes = [
    '那天我写下的："{s}"',
    '依稀记得："{s}"',
    '它在我心底回响："{s}"',
    '昔日的回响："{s}"',
    '我听见自己的声音："{s}"',
  ];

  return picked.map((s, i) => {
    const prefix = prefixes[(Math.floor(seed * 100) + i) % prefixes.length];
    return prefix.replace('{s}', s);
  });
}

export function buildEchoes(entries: JournalEntry[], nodes: MapNode[]): Echo[] {
  const echoes: Echo[] = [];

  for (const entry of entries) {
    if (entry.rarity < 3 && entry.text.length <= 200) continue;

    const node = nodes.find((n) => n.entryId === entry.id);
    if (!node) continue;

    const seed = hashString(`${entry.id}-echo`);
    const side = seed > 0.5 ? 1 : -1;
    const xOffset = (TILE_SIZE * 1.5 + Math.floor(seed * TILE_SIZE)) * side;
    const lines = extractEchoLines(entry.text, seed);
    const biome: Mood = (node.biome as Mood) || entry.mood || 'calm';

    echoes.push({
      id: `echo-${entry.id}`,
      entryId: entry.id,
      nodeId: node.id,
      x: node.x + xOffset - ECHO_WIDTH / 2,
      y: node.y - ECHO_HEIGHT,
      width: ECHO_WIDTH,
      height: ECHO_HEIGHT,
      biome,
      lines,
      unlockedChapterId: `hidden-${entry.id}`,
      talked: false,
    });
  }

  if (echoes.length > 0) {
    console.log('[Echo] generated', echoes.map((e) => ({ id: e.id, x: e.x, y: e.y, biome: e.biome, lines: e.lines })));
  }
  return echoes;
}

export function buildSaveBenches(nodes: MapNode[], entries: JournalEntry[]): SaveBench[] {
  const sorted = [...nodes].sort((a, b) => a.index - b.index);
  const benches: SaveBench[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const node = sorted[i];
    const entry = getEntryById(entries, node.entryId);
    const seed = hashString(`${node.id}-bench`);
    const side = seed > 0.5 ? 1 : -1;
    const xOffset = (TILE_SIZE * 1.2 + Math.floor(seed * TILE_SIZE)) * side;

    benches.push({
      id: `bench-${node.id}`,
      nodeId: node.id,
      entryId: node.entryId,
      index: node.index,
      x: node.x + xOffset - BENCH_WIDTH / 2,
      y: node.y - BENCH_HEIGHT + 8,
      width: BENCH_WIDTH,
      height: BENCH_HEIGHT,
      biome: (node.biome as Mood) || entry?.mood || 'calm',
      glow: seed * Math.PI * 2,
    });
  }

  return benches;
}

export function buildCraftingFurnaces(nodes: MapNode[], entries: JournalEntry[]): CraftingFurnace[] {
  const sorted = [...nodes].sort((a, b) => a.index - b.index);
  const furnaces: CraftingFurnace[] = [];

  for (const node of sorted) {
    const entry = getEntryById(entries, node.entryId);
    const seed = hashString(`${node.id}-furnace`);
    if (seed > 0.55) continue;

    const side = seed > 0.5 ? 1 : -1;
    const xOffset = (TILE_SIZE * 2.2 + Math.floor(seed * TILE_SIZE)) * side;
    furnaces.push({
      id: `furnace-${node.id}`,
      nodeId: node.id,
      entryId: node.entryId,
      x: node.x + xOffset - 18,
      y: node.y - 32,
      width: 36,
      height: 32,
      biome: (node.biome as Mood) || entry?.mood || 'calm',
      pulse: seed * Math.PI * 2,
    });
  }

  return furnaces;
}

export function drawWaypoint(
  ctx: CanvasRenderingContext2D,
  waypoint: Waypoint,
  screenX: number,
  screenY: number,
  selected = false
): void {
  ctx.save();
  ctx.translate(screenX + waypoint.width / 2, screenY + waypoint.height);

  const mood = MOODS[waypoint.biome];
  const moodColor = mood?.color ?? '#ffffff';
  const pulseScale = 1 + Math.sin(waypoint.pulse) * 0.05;
  waypoint.pulse += 0.06;

  // Rarity / mood glow
  const glowRadius = 28 + waypoint.rarity * 4;
  const gradient = ctx.createRadialGradient(0, -waypoint.height / 2, 4, 0, -waypoint.height / 2, glowRadius);
  gradient.addColorStop(0, moodColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.25 + Math.sin(waypoint.pulse) * 0.1;
  ctx.beginPath();
  ctx.arc(0, -waypoint.height / 2, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.scale(pulseScale, pulseScale);

  if (waypoint.activated) {
    // Campfire stone base
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-10, -8, 20, 8);

    // Logs
    ctx.fillStyle = '#3e2f22';
    ctx.fillRect(-9, -6, 18, 3);
    ctx.fillRect(-7, -9, 4, 8);
    ctx.fillRect(3, -9, 4, 8);

    // Flame
    const flameHue = moodColor === '#6a5acd' ? 250 : moodColor === '#87ceeb' ? 190 : 30;
    ctx.fillStyle = `hsl(${flameHue}, 90%, 60%)`;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(-6, -18, 0, -28);
    ctx.quadraticCurveTo(6, -18, 0, -10);
    ctx.fill();
    ctx.fillStyle = '#ffdd55';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(-3, -17, 0, -22);
    ctx.quadraticCurveTo(3, -17, 0, -12);
    ctx.fill();
  } else {
    // Stone stele
    ctx.fillStyle = '#6e6e6e';
    ctx.fillRect(-WAYPOINT_WIDTH / 2, -WAYPOINT_HEIGHT, WAYPOINT_WIDTH, WAYPOINT_HEIGHT);
    ctx.fillStyle = '#858585';
    ctx.fillRect(-WAYPOINT_WIDTH / 2 + 2, -WAYPOINT_HEIGHT + 2, WAYPOINT_WIDTH - 4, WAYPOINT_HEIGHT - 4);

    // Runes / cracks
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(-4, -WAYPOINT_HEIGHT + 8, 8, 4);
    ctx.fillRect(-2, -WAYPOINT_HEIGHT + 16, 4, 12);
  }

  // Rarity halo ring
  if (waypoint.rarity >= 3) {
    ctx.strokeStyle = moodColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + Math.sin(waypoint.pulse) * 0.25;
    ctx.beginPath();
    ctx.arc(0, -waypoint.height / 2, WAYPOINT_WIDTH / 2 + 4 + Math.sin(waypoint.pulse) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Selection outline
  if (selected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-WAYPOINT_WIDTH / 2 - 4, -WAYPOINT_HEIGHT - 4, WAYPOINT_WIDTH + 8, WAYPOINT_HEIGHT + 8);
  }

  // Index number
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 2;
  ctx.fillText(String(waypoint.index + 1), 0, -waypoint.height / 2);
  ctx.shadowBlur = 0;

  ctx.restore();
}

export function drawSaveBench(
  ctx: CanvasRenderingContext2D,
  bench: SaveBench,
  screenX: number,
  screenY: number,
  sitting = false
): void {
  ctx.save();
  ctx.translate(screenX + bench.width / 2, screenY + bench.height);

  const mood = MOODS[bench.biome];
  const moodColor = mood?.color ?? '#ffd700';
  bench.glow += 0.04;
  const glowAlpha = 0.25 + Math.sin(bench.glow) * 0.1;

  // Ground glow.
  const gradient = ctx.createRadialGradient(0, -bench.height / 2, 4, 0, -bench.height / 2, 40);
  gradient.addColorStop(0, moodColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = glowAlpha;
  ctx.beginPath();
  ctx.arc(0, -bench.height / 2, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Bench / stele body.
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(-14, -bench.height, 28, bench.height - 4);
  ctx.fillStyle = '#6e6e6e';
  ctx.fillRect(-10, -bench.height + 4, 20, bench.height - 12);

  // Glowing rune line.
  ctx.fillStyle = moodColor;
  ctx.globalAlpha = 0.8 + Math.sin(bench.glow) * 0.2;
  ctx.fillRect(-8, -bench.height + 10, 16, 3);
  ctx.globalAlpha = 1;

  // Seat if sitting.
  if (sitting) {
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(-6, -bench.height - 8, 12, 8);
  }

  ctx.restore();
}

function interactRadiusFor(type: 'waypoint' | 'collectible' | 'bench'): number {
  void type;
  return INTERACT_RADIUS;
}

export function checkInteraction(
  player: PlayerState,
  waypoints: Waypoint[],
  collectibles: Collectible[]
): { waypoint?: Waypoint; collectible?: Collectible } {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  let best: { type: 'waypoint' | 'collectible'; entity: Waypoint | Collectible; dist: number } | null = null;

  const candidates: { type: 'waypoint' | 'collectible'; entity: Waypoint | Collectible }[] = [
    ...waypoints.map((w) => ({ type: 'waypoint' as const, entity: w })),
    ...collectibles.filter((c) => !c.collected).map((c) => ({ type: 'collectible' as const, entity: c })),
  ];

  for (const { type, entity } of candidates) {
    const ex = entity.x + entity.width / 2;
    const ey = entity.y + entity.height / 2;
    const dist = Math.hypot(px - ex, py - ey);
    const radius = interactRadiusFor(type);
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { type, entity, dist };
    }
  }

  if (!best) return {};

  if (best.type === 'waypoint') return { waypoint: best.entity as Waypoint };
  return { collectible: best.entity as Collectible };
}

export function collect(collectible: Collectible): void {
  collectible.collected = true;
}

export function activateWaypoint(waypoint: Waypoint): void {
  waypoint.activated = true;
  waypoint.pulse = 0;
}

export function findNearestEcho(player: PlayerState, echoes: Echo[]): Echo | null {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  let best: Echo | null = null;
  let bestDist = Infinity;

  for (const echo of echoes) {
    const ex = echo.x + echo.width / 2;
    const ey = echo.y + echo.height / 2;
    const dist = Math.hypot(px - ex, py - ey);
    if (dist <= INTERACT_RADIUS && dist < bestDist) {
      best = echo;
      bestDist = dist;
    }
  }

  return best;
}

export function findNearestBench(player: PlayerState, benches: SaveBench[]): SaveBench | null {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  let best: SaveBench | null = null;
  let bestDist = Infinity;

  for (const bench of benches) {
    const ex = bench.x + bench.width / 2;
    const ey = bench.y + bench.height / 2;
    const dist = Math.hypot(px - ex, py - ey);
    if (dist <= INTERACT_RADIUS && dist < bestDist) {
      best = bench;
      bestDist = dist;
    }
  }

  return best;
}

export function findNearestFurnace(player: PlayerState, furnaces: CraftingFurnace[]): CraftingFurnace | null {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  let best: CraftingFurnace | null = null;
  let bestDist = Infinity;

  for (const furnace of furnaces) {
    const ex = furnace.x + furnace.width / 2;
    const ey = furnace.y + furnace.height / 2;
    const dist = Math.hypot(px - ex, py - ey);
    if (dist <= INTERACT_RADIUS * 1.5 && dist < bestDist) {
      best = furnace;
      bestDist = dist;
    }
  }

  return best;
}

export function drawCraftingFurnace(
  ctx: CanvasRenderingContext2D,
  furnace: CraftingFurnace,
  screenX: number,
  screenY: number
): void {
  ctx.save();
  ctx.translate(screenX + furnace.width / 2, screenY + furnace.height);
  furnace.pulse += 0.05;

  const mood = MOODS[furnace.biome];
  const color = mood?.color ?? '#f4c430';
  const glowAlpha = 0.25 + Math.sin(furnace.pulse) * 0.1;

  const gradient = ctx.createRadialGradient(0, -furnace.height / 2, 4, 0, -furnace.height / 2, 44);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = glowAlpha;
  ctx.beginPath();
  ctx.arc(0, -furnace.height / 2, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Furnace body.
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(-16, -furnace.height, 32, furnace.height);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(-12, -furnace.height + 4, 24, furnace.height - 8);

  // Glowing core.
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8 + Math.sin(furnace.pulse) * 0.2;
  ctx.beginPath();
  ctx.arc(0, -furnace.height / 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}
