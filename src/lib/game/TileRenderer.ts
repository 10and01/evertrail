import type { BiomeKey, BiomePalette, CameraState, Tile, TileType } from '@/types/game';
import { TILE_SIZE, RENDER_MARGIN } from './constants';
import { BIOME_PALETTES, getBlendedPalette } from './BiomeRenderer';
import { tileAt } from './World';

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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function adjustColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r + amount)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g + amount)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b + amount)));
  return `rgb(${r},${g},${b})`;
}

const TILE_GRADIENTS: Record<TileType, [string, string]> = {
  grass: ['#5aaa45', '#2a5a22'],
  stone: ['#8a8a8a', '#5a5a5a'],
  dirt: ['#8b5a2b', '#5a3a1a'],
  wood: ['#a67c52', '#6b4e32'],
  platform: ['#7a8a7a', '#4a5a4a'],
  gap: ['#1a1018', '#0d0810'],
  raincurtain: ['#4a6fa5', '#2a3f5a'],
  brittle: ['#5a4a4a', '#3a2a2a'],
  water: ['#3c096c', '#1f0840'],
  lava: ['#e85d04', '#9d0208'],
  door: ['#6b4e32', '#4a3520'],
  window: ['#6b4e32', '#4a3520'],
};

function getTileGradient(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  cache?: Map<string, CanvasGradient>
): CanvasGradient {
  const key = `${tile.type}:${tile.biome}`;
  if (cache) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const grad = ctx.createLinearGradient(0, 0, 0, TILE_SIZE);
  const base = TILE_GRADIENTS[tile.type as TileType];
  if (base) {
    grad.addColorStop(0, base[0]);
    grad.addColorStop(1, base[1]);
  } else {
    // Fallback for legacy biome tiles (sand, snow, mud, ash, mycelium).
    const palette = BIOME_PALETTES[tile.biome];
    grad.addColorStop(0, adjustColor(palette.groundBody, 22));
    grad.addColorStop(1, adjustColor(palette.groundBody, -32));
  }

  if (cache) cache.set(key, grad);
  return grad;
}

function computeNeighbors(tile: Tile, tiles: Tile[]): { top: boolean; bottom: boolean; left: boolean; right: boolean } {
  return {
    top: !!tileAt(tiles, tile.x, tile.y - TILE_SIZE),
    bottom: !!tileAt(tiles, tile.x, tile.y + TILE_SIZE),
    left: !!tileAt(tiles, tile.x - TILE_SIZE, tile.y),
    right: !!tileAt(tiles, tile.x + TILE_SIZE, tile.y),
  };
}

function getNeighborTypes(tile: Tile, tiles: Tile[]): { top?: Tile['type']; bottom?: Tile['type']; left?: Tile['type']; right?: Tile['type'] } {
  return {
    top: tileAt(tiles, tile.x, tile.y - TILE_SIZE)?.type,
    bottom: tileAt(tiles, tile.x, tile.y + TILE_SIZE)?.type,
    left: tileAt(tiles, tile.x - TILE_SIZE, tile.y)?.type,
    right: tileAt(tiles, tile.x + TILE_SIZE, tile.y)?.type,
  };
}

function computeAutotileIndex(neighbors: { top: boolean; bottom: boolean; left: boolean; right: boolean }): number {
  return (
    (neighbors.top ? 1 : 0) |
    (neighbors.bottom ? 2 : 0) |
    (neighbors.left ? 4 : 0) |
    (neighbors.right ? 8 : 0)
  );
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  camera: CameraState,
  gradientCache?: Map<string, CanvasGradient>,
  topBlendPalette?: BiomePalette,
  time = 0,
  neighborTypes?: { top?: Tile['type']; bottom?: Tile['type']; left?: Tile['type']; right?: Tile['type'] }
) {
  const sx = tile.x - camera.x;
  const sy = tile.y - camera.y;
  const s = TILE_SIZE;

  const neighbors = tile.neighbors ?? { top: false, bottom: false, left: false, right: false };
  const autotileIndex = computeAutotileIndex(neighbors);

  // 使用局部坐标绘制，使渐变缓存与屏幕位置无关。
  ctx.save();
  ctx.translate(sx, sy);

  // Base gradient fill.
  ctx.fillStyle = getTileGradient(ctx, tile, gradientCache);
  ctx.fillRect(0, 0, s, s);

  // Top cap for surface tiles, blended at biome boundaries.
  const topTypes = ['grass', 'sand', 'snow', 'mud', 'ash', 'mycelium'];
  if (topTypes.includes(tile.type)) {
    const palette = topBlendPalette ?? BIOME_PALETTES[tile.biome];
    ctx.fillStyle = palette.groundTop;
    ctx.fillRect(0, 0, s, 6);
  }

  // Edge highlights / shadows (only on exposed sides).
  if (!neighbors.bottom) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, s - 2, s, 2);
  }
  if (!neighbors.right) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s - 2, 0, 2, s);
  }
  if (!neighbors.top) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, s, 2);
  }
  if (!neighbors.left) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, 2, s);
  }

  // Type-specific pixel-art details.
  const seed = hashString(`${tile.x},${tile.y},${tile.type},${autotileIndex}`);
  const rand = seededRandom(seed);

  // Transition noise between different tile types (breaks straight block edges).
  drawEdgeNoise(ctx, 0, 0, s, tile.type, neighborTypes, rand);

  switch (tile.type) {
    case 'grass':
      drawGrassBlades(ctx, 0, 0, rand, time);
      break;
    case 'stone':
      drawStoneCracks(ctx, 0, 0, rand);
      break;
    case 'dirt':
      drawDirtPebbles(ctx, 0, 0, rand);
      break;
    case 'wood':
      drawWoodGrain(ctx, 0, 0, rand);
      break;
    case 'door':
      drawDoorDetail(ctx, 0, 0, rand);
      break;
    case 'window':
      drawWindowDetail(ctx, 0, 0, rand);
      break;
    case 'platform':
      drawPlatformDetail(ctx, 0, 0);
      break;
    case 'gap':
      drawGapDetail(ctx, 0, 0, rand);
      break;
    case 'raincurtain':
      drawRaincurtainDetail(ctx, 0, 0, rand);
      break;
    case 'brittle':
      drawBrittleDetail(ctx, 0, 0, rand);
      break;
    default:
      // Legacy biome tiles keep their previous detail look.
      drawLegacyDetail(ctx, tile, 0, 0, rand);
  }

  ctx.restore();
}

function drawGrassBlades(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number, time = 0) {
  ctx.strokeStyle = '#6acc55';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  const wind = Math.sin(time * 0.002 + sx * 0.1) * 2;
  for (let ox = 2; ox < TILE_SIZE - 2; ox += 6) {
    const x = sx + ox + rand() * 4;
    const y = sy + 2 + rand() * 3;
    const lean = (rand() - 0.5) * 10 + wind * (0.6 + rand() * 0.4);
    const h = 4 + rand() * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.5, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }
}

function drawEdgeNoise(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  s: number,
  type: string,
  neighborTypes: { top?: Tile['type']; bottom?: Tile['type']; left?: Tile['type']; right?: Tile['type'] } | undefined,
  rand: () => number
) {
  if (!neighborTypes) return;
  const transitions: { side: 'top' | 'bottom' | 'left' | 'right'; nx: number; ny: number; dx: number; dy: number }[] = [
    { side: 'top', nx: 0, ny: -1, dx: 1, dy: 0 },
    { side: 'bottom', nx: 0, ny: 1, dx: 1, dy: 0 },
    { side: 'left', nx: -1, ny: 0, dx: 0, dy: 1 },
    { side: 'right', nx: 1, ny: 0, dx: 0, dy: 1 },
  ];

  for (const t of transitions) {
    const neighborType = neighborTypes[t.side];
    if (!neighborType || neighborType === type) continue;
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const pos = rand() * s;
      const depth = 1 + rand() * 3;
      const px = sx + (t.dx ? pos : t.nx === -1 ? 0 : t.nx === 1 ? s - depth : pos);
      const py = sy + (t.dy ? pos : t.ny === -1 ? 0 : t.ny === 1 ? s - depth : pos);
      const w = t.dx ? 2 + rand() * 2 : depth;
      const h = t.dy ? 2 + rand() * 2 : depth;
      ctx.fillStyle = getNoiseColor(type, neighborType);
      ctx.globalAlpha = 0.5 + rand() * 0.3;
      ctx.fillRect(px, py, w, h);
    }
  }
  ctx.globalAlpha = 1;
}

function getNoiseColor(fromType: string, toType: string): string {
  if (fromType === 'grass' && toType === 'dirt') return '#4a8a32';
  if (fromType === 'dirt' && toType === 'grass') return '#6b4a2a';
  if (fromType === 'dirt' && toType === 'stone') return '#5a4a3a';
  if (fromType === 'stone' && toType === 'dirt') return '#7a7a7a';
  if (fromType === 'grass' && toType === 'stone') return '#5a7a4a';
  if (fromType === 'stone' && toType === 'grass') return '#6a6a6a';
  return 'rgba(0,0,0,0.25)';
}

function drawStoneCracks(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  const cracks = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < cracks; i++) {
    const x = sx + 4 + rand() * 24;
    const y = sy + 4 + rand() * 24;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 14, y + (rand() - 0.5) * 14);
    if (rand() > 0.5) {
      ctx.lineTo(x + (rand() - 0.5) * 10, y + (rand() - 0.5) * 10);
    }
    ctx.stroke();
  }
}

function drawDirtPebbles(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.fillStyle = 'rgba(60,40,20,0.35)';
  const dots = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < dots; i++) {
    const px = sx + 4 + rand() * 24;
    const py = sy + 4 + rand() * 24;
    const r = 1 + rand() * 2;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWoodGrain(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.strokeStyle = 'rgba(80,50,30,0.25)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  const lines = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < lines; i++) {
    const y = sy + 6 + rand() * 20;
    ctx.beginPath();
    ctx.moveTo(sx + 2, y);
    ctx.lineTo(sx + TILE_SIZE - 2, y + (rand() - 0.5) * 3);
    ctx.stroke();
  }
}

function drawDoorDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  const s = TILE_SIZE;
  // 外框：深色木质门框，带轻微厚度。
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(sx, sy, s, s);
  ctx.fillStyle = '#5c4332';
  ctx.fillRect(sx + 2, sy + 2, s - 4, s - 4);

  // 门板：两扇对开木门，带嵌板细节。
  ctx.fillStyle = '#7a5a42';
  ctx.fillRect(sx + 4, sy + 4, s / 2 - 5, s - 8);
  ctx.fillRect(sx + s / 2 + 1, sy + 4, s / 2 - 5, s - 8);

  // 门板内嵌阴影。
  ctx.fillStyle = 'rgba(40,30,20,0.25)';
  ctx.fillRect(sx + 7, sy + 8, s / 2 - 11, s - 16);
  ctx.fillRect(sx + s / 2 + 4, sy + 8, s / 2 - 11, s - 16);

  // 门把手：金色小圆点，左右对称，高度有轻微随机变化。
  const handleY = sy + s / 2 + Math.floor(rand() * 5) - 2;
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(sx + s / 2 - 6, handleY, 2.5, 0, Math.PI * 2);
  ctx.arc(sx + s / 2 + 6, handleY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 门缝微光：提示可交互。
  ctx.fillStyle = 'rgba(255,220,160,0.18)';
  ctx.fillRect(sx + s / 2 - 1, sy + 4, 2, s - 8);

  // 顶部小窗：增加精细度。
  ctx.fillStyle = 'rgba(180,210,255,0.25)';
  ctx.fillRect(sx + 8, sy + 6, s - 16, 6);
  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 8, sy + 6, s - 16, 6);
}

function drawWindowDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  drawWoodGrain(ctx, sx, sy, rand);
  ctx.fillStyle = 'rgba(160,210,255,0.35)';
  ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.beginPath();
  ctx.moveTo(sx + TILE_SIZE / 2, sy + 4);
  ctx.lineTo(sx + TILE_SIZE / 2, sy + TILE_SIZE - 4);
  ctx.moveTo(sx + 4, sy + TILE_SIZE / 2);
  ctx.lineTo(sx + TILE_SIZE - 4, sy + TILE_SIZE / 2);
  ctx.stroke();
}

function drawPlatformDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(sx + 2, sy + TILE_SIZE - 4, TILE_SIZE - 4, 2);
}

function drawGapDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.fillStyle = 'rgba(80,40,80,0.25)';
  const dots = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < dots; i++) {
    const px = sx + 4 + rand() * 24;
    const py = sy + 4 + rand() * 24;
    ctx.beginPath();
    ctx.arc(px, py, 1 + rand() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRaincurtainDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.strokeStyle = 'rgba(180,210,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  const strands = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < strands; i++) {
    const x = sx + 4 + rand() * 24;
    ctx.beginPath();
    ctx.moveTo(x, sy + 2);
    ctx.lineTo(x + (rand() - 0.5) * 4, sy + TILE_SIZE - 2);
    ctx.stroke();
  }
}

function drawBrittleDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.fillStyle = 'rgba(40,20,20,0.35)';
  const cracks = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < cracks; i++) {
    const x = sx + 4 + rand() * 24;
    const y = sy + 4 + rand() * 24;
    ctx.fillRect(x, y, 2 + rand() * 4, 1);
  }
  ctx.fillStyle = 'rgba(220,60,40,0.35)';
  ctx.beginPath();
  ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, 3 + rand() * 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegacyDetail(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  sx: number,
  sy: number,
  rand: () => number
) {
  switch (tile.type) {
    case 'sand':
      drawSandRipples(ctx, sx, sy, rand);
      break;
    case 'snow':
      drawSnowSparkle(ctx, sx, sy, rand);
      break;
    case 'mud':
    case 'ash':
      drawDirtNoise(ctx, sx, sy, rand);
      break;
    case 'mycelium':
      drawMyceliumDots(ctx, sx, sy, BIOME_PALETTES[tile.biome].accent, rand);
      break;
  }
}

function drawSandRipples(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  const lines = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < lines; i++) {
    const y = sy + 8 + rand() * 18;
    ctx.beginPath();
    ctx.moveTo(sx + 4, y);
    ctx.lineTo(sx + 28, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }
}

function drawSnowSparkle(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const sparkles = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < sparkles; i++) {
    const px = sx + 4 + rand() * 24;
    const py = sy + 4 + rand() * 24;
    ctx.fillRect(Math.floor(px), Math.floor(py), 2, 2);
  }
}

function drawDirtNoise(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: () => number) {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  const dots = 6 + Math.floor(rand() * 6);
  for (let i = 0; i < dots; i++) {
    const px = sx + 3 + rand() * 26;
    const py = sy + 3 + rand() * 26;
    ctx.fillRect(Math.floor(px), Math.floor(py), 2, 2);
  }
}

function drawMyceliumDots(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  accent: string,
  rand: () => number
) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.35;
  const dots = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < dots; i++) {
    const px = sx + 6 + rand() * 20;
    const py = sy + 6 + rand() * 20;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export class TileRenderer {
  private gradientCache = new Map<string, CanvasGradient>();

  draw(
    ctx: CanvasRenderingContext2D,
    tiles: Tile[],
    camera: CameraState,
    viewWidth: number,
    viewHeight: number,
    biome: BiomeKey,
    blendBiome?: BiomeKey,
    blendT = 0,
    time = 0
  ) {
    const topBlendPalette = blendBiome ? getBlendedPalette(biome, blendBiome, blendT) : undefined;

    for (const tile of tiles) {
      if (tile.type === 'water' || tile.type === 'lava') continue;
      // 已破坏或代表空缺的瓦片不应再渲染，露出背景。
      if (tile.type === 'gap' || tile.destroyed) continue;
      const sx = tile.x - camera.x;
      const sy = tile.y - camera.y;
      if (
        sx + TILE_SIZE < -RENDER_MARGIN ||
        sx > viewWidth + RENDER_MARGIN ||
        sy + TILE_SIZE < -RENDER_MARGIN ||
        sy > viewHeight + RENDER_MARGIN
      ) {
        continue;
      }

      // Compute and cache neighbor info for autotiling.
      if (!tile.neighbors) {
        tile.neighbors = computeNeighbors(tile, tiles);
      }

      const neighborTypes = getNeighborTypes(tile, tiles);
      drawTile(ctx, tile, camera, this.gradientCache, topBlendPalette, time, neighborTypes);
    }
  }

  drawDecorations(
    ctx: CanvasRenderingContext2D,
    tiles: Tile[],
    camera: CameraState,
    viewWidth: number,
    viewHeight: number
  ) {
    for (const tile of tiles) {
      if (tile.type === 'water' || tile.type === 'lava') continue;
      const sx = tile.x - camera.x;
      const sy = tile.y - camera.y;
      if (
        sx < -RENDER_MARGIN ||
        sx > viewWidth + RENDER_MARGIN ||
        sy < -RENDER_MARGIN ||
        sy > viewHeight + RENDER_MARGIN
      ) {
        continue;
      }

      const deco = tile.decoration;
      if (!deco) continue;
      // 使用瓦片所属生态的调色板，保证跨生态边界时装饰物颜色一致。
      const palette = BIOME_PALETTES[tile.biome];
      // 视觉变化使用独立种子，避免与生成阶段决策种子耦合。
      const rand = seededRandom(hashString(`${tile.x},${tile.y},${tile.type},${tile.biome}-visual`));

      const cx = sx + TILE_SIZE / 2;
      const cy = sy + 4;

      switch (deco) {
        case 'tree':
          // 树木由 TreeEntity 在实体层统一绘制，这里仅做标记。
          break;
        case 'deadTree':
          this.drawDeadTree(ctx, cx, cy, palette, rand);
          break;
        case 'flower':
          this.drawFlower(ctx, cx, cy, palette, rand);
          break;
        case 'grass':
          this.drawGrassTuft(ctx, cx, cy, palette, rand);
          break;
        case 'rock':
          this.drawSmallRock(ctx, cx, cy, rand);
          break;
        case 'cactus':
          this.drawCactus(ctx, cx, cy, palette, rand);
          break;
        case 'volcanic':
          this.drawVolcanicRock(ctx, cx, cy, palette, rand);
          break;
        case 'mushroom':
          this.drawMushroom(ctx, cx, cy, palette, rand);
          break;
        case 'root':
          this.drawRootVines(ctx, cx, cy, rand);
          break;
      }
    }
  }

  private drawDeadTree(ctx: CanvasRenderingContext2D, x: number, y: number, palette: BiomePalette, rand: () => number) {
    const trunkW = 5 + Math.floor(rand() * 3);
    const trunkH = 28 + Math.floor(rand() * 16);
    ctx.fillStyle = palette.treeTrunk;
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);
    const branches = 2 + Math.floor(rand() * 2);
    ctx.strokeStyle = palette.treeTrunk;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < branches; i++) {
      const dir = rand() > 0.5 ? 1 : -1;
      const bx = x + dir * (8 + rand() * 14);
      const by = y - trunkH + 6 + i * (trunkH / (branches + 1));
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(bx, by - 4 - rand() * 8);
      ctx.stroke();
    }
  }

  private drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, palette: BiomePalette, rand: () => number) {
    const colors = [palette.accent, '#ff6b6b', '#feca57', '#ffffff'];
    const color = colors[Math.floor(rand() * colors.length)];
    const h = 6 + Math.floor(rand() * 6);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(x - 1, y - h, 2, h);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - h, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, palette: BiomePalette, rand: () => number) {
    ctx.fillStyle = palette.groundTop;
    const h = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 3 + (rand() - 0.5) * 3;
      ctx.fillRect(x + ox - 1, y - h, 2, h);
    }
  }

  private drawSmallRock(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number) {
    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath();
    ctx.arc(x, y - 3, 4 + rand() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCactus(ctx: CanvasRenderingContext2D, x: number, y: number, palette: BiomePalette, rand: () => number) {
    const h = 24 + Math.floor(rand() * 16);
    ctx.fillStyle = palette.groundTop;
    ctx.fillRect(x - 4, y - h, 8, h);
    ctx.fillRect(x - 12, y - h * 0.6, 8, 4);
    ctx.fillRect(x + 4, y - h * 0.75, 8, 4);
    ctx.fillStyle = palette.groundBody;
    ctx.fillRect(x - 3, y - h + 2, 2, h - 4);
  }

  private drawVolcanicRock(ctx: CanvasRenderingContext2D, x: number, y: number, palette: BiomePalette, rand: () => number) {
    const w = 16 + rand() * 16;
    const h = 14 + rand() * 14;
    ctx.fillStyle = palette.groundBody;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.3, y - h);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + w * 0.35, y - h * 0.5, 2, h * 0.45);
  }

  private drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, palette: BiomePalette, rand: () => number) {
    const h = 8 + Math.floor(rand() * 6);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(x - 1.5, y - h, 3, h);
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(x, y - h, 6, Math.PI, 0);
    ctx.fill();
  }

  private drawRootVines(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number) {
    ctx.strokeStyle = '#5a7a5a';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    const vines = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < vines; i++) {
      const startX = x - 6 + rand() * 12;
      const len = 10 + rand() * 14;
      const sway = (rand() - 0.5) * 10;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.quadraticCurveTo(startX + sway * 0.5, y + len * 0.6, startX + sway, y + len);
      ctx.stroke();
    }
  }
}
