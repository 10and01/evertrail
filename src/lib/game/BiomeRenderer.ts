import type { BiomeKey, BiomePalette, CameraState, Tile } from '@/types/game';
import { TILE_SIZE } from './constants';

export const BIOME_PALETTES: Record<BiomeKey, BiomePalette> = {
  joy: {
    skyTop: '#4facfe',
    skyBottom: '#ffe29f',
    groundTop: '#7bc043',
    groundBody: '#5a8f2f',
    groundDeep: '#4a6e28',
    treeTrunk: '#8b5a2b',
    treeLeaves: ['#66c24a', '#4a9f2e', '#85d65a'],
    accent: '#ffd700',
    particleType: 'leaf',
    platform: '#7bc043',
    water: '#63c5da',
    fog: '#ffffff33',
  },
  calm: {
    skyTop: '#1e3c72',
    skyBottom: '#a7c7e7',
    groundTop: '#2d6a4f',
    groundBody: '#1b4332',
    groundDeep: '#081c15',
    treeTrunk: '#4a3b2a',
    treeLeaves: ['#52796f', '#354f52', '#84a98c'],
    accent: '#87ceeb',
    particleType: 'firefly',
    platform: '#52796f',
    water: '#74c69d',
    fog: '#a7c7e766',
  },
  sad: {
    skyTop: '#141e30',
    skyBottom: '#4b3f72',
    groundTop: '#3e3b5e',
    groundBody: '#2a2744',
    groundDeep: '#151321',
    treeTrunk: '#2e2a3b',
    treeLeaves: ['#3a324a', '#4b4160', '#2c263a'],
    accent: '#6a5acd',
    particleType: 'rain',
    platform: '#4b4160',
    water: '#2c3e50',
    fog: '#4b3f7288',
  },
  angry: {
    skyTop: '#2c0b0b',
    skyBottom: '#7a1f00',
    groundTop: '#3d2b2b',
    groundBody: '#2a1a1a',
    groundDeep: '#110808',
    treeTrunk: '#1a0f0f',
    treeLeaves: ['#4a2020', '#5c2626', '#2e1313'],
    accent: '#ff4500',
    particleType: 'ember',
    platform: '#5c2626',
    water: '#330000',
    fog: '#7a1f0044',
  },
  tired: {
    skyTop: '#2d2a4a',
    skyBottom: '#b8a88a',
    groundTop: '#c2b280',
    groundBody: '#9e916e',
    groundDeep: '#6b6049',
    treeTrunk: '#7a6b55',
    treeLeaves: ['#a89f81', '#8b7d62', '#5e5442'],
    accent: '#a0a0a0',
    particleType: 'dust',
    platform: '#c2b280',
    water: '#8b9dc3',
    fog: '#b8a88a55',
  },
  anxious: {
    skyTop: '#1a0b2e',
    skyBottom: '#4a1f5c',
    groundTop: '#5e3a6e',
    groundBody: '#3d2450',
    groundDeep: '#1f1230',
    treeTrunk: '#2e1a3b',
    treeLeaves: ['#6b3e7d', '#4a2858', '#3a1f47'],
    accent: '#9d4edd',
    particleType: 'sparkle',
    platform: '#6b3e7d',
    water: '#3c096c',
    fog: '#9d4edd55',
  },
};

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

function makeRandom(seed: string, ...parts: (string | number)[]): () => number {
  const key = [seed, ...parts].join('|');
  return seededRandom(hashString(key));
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

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  return rgbToHex(lerpChannel(ca.r, cb.r, t), lerpChannel(ca.g, cb.g, t), lerpChannel(ca.b, cb.b, t));
}

export function getBlendedPalette(a: BiomeKey, b: BiomeKey, t: number): BiomePalette {
  const pa = BIOME_PALETTES[a];
  const pb = BIOME_PALETTES[b];
  if (t <= 0) return pa;
  if (t >= 1) return pb;
  return {
    skyTop: lerpColor(pa.skyTop, pb.skyTop, t),
    skyBottom: lerpColor(pa.skyBottom, pb.skyBottom, t),
    groundTop: lerpColor(pa.groundTop, pb.groundTop, t),
    groundBody: lerpColor(pa.groundBody, pb.groundBody, t),
    groundDeep: lerpColor(pa.groundDeep, pb.groundDeep, t),
    treeTrunk: lerpColor(pa.treeTrunk, pb.treeTrunk, t),
    treeLeaves: pa.treeLeaves.map((c, i) => lerpColor(c, pb.treeLeaves[i] ?? c, t)),
    accent: lerpColor(pa.accent, pb.accent, t),
    particleType: t < 0.5 ? pa.particleType : pb.particleType,
    platform: lerpColor(pa.platform, pb.platform, t),
    water: lerpColor(pa.water ?? '#3c096c', pb.water ?? '#3c096c', t),
    fog: lerpColor(pa.fog ?? '#ffffff00', pb.fog ?? '#ffffff00', t),
  };
}

export function getDayNightFactor(hour: number): { brightness: number; isNight: boolean; sunT: number } {
  // hour in [0,24); 6 sunrise, 12 noon, 18 sunset, 24/0 midnight
  let norm = hour;
  if (norm < 0) norm += 24;
  if (norm >= 24) norm -= 24;

  // brightness: 0 at midnight, 1 at noon
  let brightness = 1;
  let isNight = false;
  if (norm >= 6 && norm < 18) {
    // day
    const t = Math.abs(norm - 12) / 6; // 0 at noon, 1 at sunrise/sunset
    brightness = 1 - t * 0.45;
    isNight = false;
  } else {
    // night
    const distFromMidnight = Math.min(Math.abs(norm), Math.abs(norm - 24));
    brightness = 0.35 + distFromMidnight / 6 * 0.25; // 0.35 at midnight, 0.6 at twilight
    isNight = true;
  }

  // sunT: -1..1 where 0 = noon, -1 = sunrise, 1 = sunset
  let sunT = 0;
  if (norm >= 6 && norm <= 18) {
    sunT = (norm - 12) / 6;
  } else if (norm > 18) {
    sunT = (norm - 12) / 6;
  } else {
    sunT = (norm - 12) / 6;
  }

  return { brightness, isNight, sunT };
}

function darkenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return rgbToHex(r, g, b);
}

export function getSkyColors(biome: BiomeKey, hour: number): { top: string; bottom: string; accent: string } {
  const palette = BIOME_PALETTES[biome];
  const { brightness, isNight } = getDayNightFactor(hour);
  let top = darkenColor(palette.skyTop, brightness);
  let bottom = darkenColor(palette.skyBottom, brightness);

  // 夜晚向深蓝紫色偏移。
  if (isNight) {
    const nightFactor = 1 - brightness;
    const nightTop = { r: 15 + nightFactor * 20, g: 20 + nightFactor * 20, b: 45 + nightFactor * 40 };
    const nightBottom = { r: 25 + nightFactor * 30, g: 25 + nightFactor * 30, b: 55 + nightFactor * 50 };
    const baseTop = hexToRgb(top) ?? { r: 15, g: 20, b: 45 };
    const baseBottom = hexToRgb(bottom) ?? { r: 25, g: 25, b: 55 };
    top = rgbToHex(
      Math.round(baseTop.r * (1 - nightFactor * 0.7) + nightTop.r * nightFactor * 0.7),
      Math.round(baseTop.g * (1 - nightFactor * 0.7) + nightTop.g * nightFactor * 0.7),
      Math.round(baseTop.b * (1 - nightFactor * 0.7) + nightBottom.b * nightFactor * 0.7)
    );
    bottom = rgbToHex(
      Math.round(baseBottom.r * (1 - nightFactor * 0.7) + nightBottom.r * nightFactor * 0.7),
      Math.round(baseBottom.g * (1 - nightFactor * 0.7) + nightBottom.g * nightFactor * 0.7),
      Math.round(baseBottom.b * (1 - nightFactor * 0.7) + nightBottom.b * nightFactor * 0.7)
    );
  }

  return {
    top,
    bottom,
    accent: isNight ? '#c0c8ff' : palette.accent,
  };
}

export function drawSky(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  biome: BiomeKey,
  viewWidth: number,
  viewHeight: number,
  hour = 12
): void {
  const palette = BIOME_PALETTES[biome];
  const colors = getSkyColors(biome, hour);
  const { isNight } = getDayNightFactor(hour);

  const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
  grad.addColorStop(0, colors.top);
  grad.addColorStop(1, colors.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  // 星星：夜晚随机分布。
  if (isNight) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const rand = seededRandom(hashString(`stars-${Math.floor(hour)}`));
    const starCount = Math.floor(rand() * 40) + 30;
    for (let i = 0; i < starCount; i++) {
      const sx = (rand() * viewWidth + (camera.x * 0.02)) % viewWidth;
      const sy = rand() * viewHeight * 0.55;
      const r = rand() > 0.8 ? 1.5 : 1;
      ctx.globalAlpha = 0.4 + rand() * 0.6;
      ctx.beginPath();
      ctx.arc(sx < 0 ? sx + viewWidth : sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 天体：太阳/月亮按时间弧线运动。
  ctx.save();
  const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
  const celestialT = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  const orbitRadiusX = viewWidth * 0.4;
  const orbitRadiusY = viewHeight * 0.35;
  const celestialX = viewWidth / 2 + Math.cos(celestialT) * orbitRadiusX - (safeCameraX * 0.01) % viewWidth;
  const celestialY = viewHeight * 0.75 + Math.sin(celestialT) * orbitRadiusY;
  const cx = celestialX < -60 ? celestialX + viewWidth : celestialX > viewWidth + 60 ? celestialX - viewWidth : celestialX;

  if (isNight) {
    // 月亮
    ctx.fillStyle = 'rgba(220,230,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, celestialY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,210,255,0.18)';
    ctx.beginPath();
    ctx.arc(cx, celestialY, 42, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 太阳
    const glow = ctx.createRadialGradient(cx, celestialY, 8, cx, celestialY, 56);
    glow.addColorStop(0, palette.accent);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, celestialY, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.95)';
    ctx.beginPath();
    ctx.arc(cx, celestialY, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Light fog overlay for atmosphere.
  if (palette.fog) {
    ctx.fillStyle = palette.fog;
    ctx.globalAlpha = isNight ? 0.25 : 0.5;
    ctx.fillRect(0, viewHeight * 0.55, viewWidth, viewHeight * 0.45);
    ctx.globalAlpha = 1;
  }
}

export function drawBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  biome: BiomeKey,
  viewWidth: number,
  viewHeight: number,
  layer: number
): void {
  const palette = BIOME_PALETTES[biome];
  const parallax = layer === 0 ? 0.15 : 0.35;
  const baseY = viewHeight * 0.65 + layer * 40;
  const offsetX = -(camera.x * parallax) % viewWidth;

  ctx.save();

  if (layer === 0) {
    // Distant mountain silhouettes.
    const colors = [palette.groundDeep, palette.groundBody, palette.groundTop];
    for (let i = 0; i < 3; i++) {
      const x = offsetX + i * (viewWidth / 2) - 100;
      const h = 120 + i * 50;
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.55 + i * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, baseY + 60);
      ctx.lineTo(x + viewWidth / 2, baseY + 60 - h);
      ctx.lineTo(x + viewWidth, baseY + 60);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Midground trees / clouds / rock spires depending on biome.
    const count = Math.ceil(viewWidth / 180) + 2;
    for (let i = 0; i < count; i++) {
      const x = offsetX + i * 180;
      const y = baseY + Math.sin(i * 1.3) * 20;

      if (biome === 'joy' || biome === 'calm' || biome === 'sad') {
        // Soft cloud / tree line.
        ctx.fillStyle = palette.treeLeaves[0];
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(x + 60, y, 70, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(x + 110, y + 15, 55, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Angry / tired / anxious spires / ruins.
        ctx.fillStyle = palette.groundBody;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(x + 40, y + 60);
        ctx.lineTo(x + 70, y - 80 + Math.sin(i) * 30);
        ctx.lineTo(x + 100, y + 60);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  screenX: number,
  screenY: number
): void {
  const palette = BIOME_PALETTES[tile.biome];
  const s = TILE_SIZE;

  let mainColor = palette.groundBody;
  let topColor = palette.groundTop;

  switch (tile.type) {
    case 'grass':
      mainColor = palette.groundBody;
      topColor = palette.groundTop;
      break;
    case 'dirt':
      mainColor = palette.groundBody;
      topColor = palette.groundBody;
      break;
    case 'stone':
      mainColor = '#5a5a5a';
      topColor = '#757575';
      break;
    case 'sand':
      mainColor = '#d4c685';
      topColor = '#e6d7a3';
      break;
    case 'snow':
      mainColor = '#dbe9f4';
      topColor = '#ffffff';
      break;
    case 'mud':
      mainColor = '#4a3f5c';
      topColor = '#5e506e';
      break;
    case 'ash':
      mainColor = '#2b2b2b';
      topColor = '#3d3d3d';
      break;
    case 'mycelium':
      mainColor = '#4a2858';
      topColor = '#6b3e7d';
      break;
  }

  // Base block.
  ctx.fillStyle = mainColor;
  ctx.fillRect(screenX, screenY, s, s);

  // Top cap for grass-like tiles.
  if (tile.type === 'grass' || tile.type === 'sand' || tile.type === 'snow' || tile.type === 'mycelium') {
    ctx.fillStyle = topColor;
    ctx.fillRect(screenX, screenY, s, 6);
  }

  // Subtle pixel detail.
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  const rand = seededRandom(hashString(`${tile.x},${tile.y},${tile.type}`));
  for (let i = 0; i < 6; i++) {
    const px = screenX + Math.floor(rand() * (s - 4)) + 2;
    const py = screenY + Math.floor(rand() * (s - 8)) + 8;
    ctx.fillRect(px, py, 2, 2);
  }

  // Highlight edge.
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(screenX, screenY, 2, s);
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: BiomePalette,
  biome: BiomeKey,
  rand: () => number
): void {
  const trunkW = 6 + Math.floor(rand() * 4);
  const trunkH = 36 + Math.floor(rand() * 24);

  if (biome === 'sad' || biome === 'angry' || biome === 'tired') {
    // Dead / burnt / desert tree.
    ctx.fillStyle = palette.treeTrunk;
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);
    // Crooked branches.
    const branches = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < branches; i++) {
      const bx = x + (rand() > 0.5 ? 1 : -1) * (6 + rand() * 16);
      const by = y - trunkH + 8 + i * (trunkH / (branches + 1));
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(bx, by - 6 - rand() * 10);
      ctx.lineWidth = 3;
      ctx.strokeStyle = palette.treeTrunk;
      ctx.stroke();
    }
  } else {
    // Healthy pixel tree.
    ctx.fillStyle = palette.treeTrunk;
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);
    const crownY = y - trunkH;
    const crownR = 22 + rand() * 10;
    for (let i = 0; i < palette.treeLeaves.length; i++) {
      ctx.fillStyle = palette.treeLeaves[i];
      const offX = (rand() - 0.5) * 10;
      const offY = (rand() - 0.5) * 10;
      ctx.beginPath();
      ctx.arc(x + offX, crownY + offY, crownR - i * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: BiomePalette,
  rand: () => number
): void {
  const colors = [palette.accent, '#ff6b6b', '#feca57', '#ffffff'];
  const color = colors[Math.floor(rand() * colors.length)];
  const h = 6 + Math.floor(rand() * 6);
  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(x, y - h, 2, h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 1, y - h, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrassTuft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: BiomePalette,
  rand: () => number
): void {
  ctx.fillStyle = palette.groundTop;
  const h = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 3 + (rand() - 0.5) * 3;
    ctx.fillRect(x + ox, y - h, 2, h);
  }
}

function drawCactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: BiomePalette,
  rand: () => number
): void {
  const h = 24 + Math.floor(rand() * 16);
  ctx.fillStyle = palette.groundTop;
  ctx.fillRect(x - 4, y - h, 8, h);
  ctx.fillRect(x - 12, y - h * 0.6, 8, 4);
  ctx.fillRect(x + 4, y - h * 0.75, 8, 4);
  ctx.fillStyle = palette.groundBody;
  ctx.fillRect(x - 3, y - h + 2, 2, h - 4);
}

function drawVolcanicRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: BiomePalette,
  rand: () => number
): void {
  const w = 16 + rand() * 16;
  const h = 14 + rand() * 14;
  ctx.fillStyle = palette.groundBody;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.3, y - h);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  // Ember crack.
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x + w * 0.35, y - h * 0.5, 2, h * 0.45);
}

function drawMushroom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: BiomePalette,
  rand: () => number
): void {
  const h = 8 + Math.floor(rand() * 6);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(x, y - h, 3, h);
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(x + 1.5, y - h, 6, Math.PI, 0);
  ctx.fill();
}

export function drawDecorations(
  ctx: CanvasRenderingContext2D,
  tiles: Tile[],
  camera: CameraState,
  viewWidth: number,
  viewHeight: number,
  biome: BiomeKey,
  seed: string
): void {
  const palette = BIOME_PALETTES[biome];

  for (const tile of tiles) {
    if (tile.biome !== biome) continue;

    const screen = {
      x: tile.x - camera.x,
      y: tile.y - camera.y,
    };

    if (
      screen.x < -TILE_SIZE ||
      screen.x > viewWidth ||
      screen.y < -TILE_SIZE ||
      screen.y > viewHeight
    ) {
      continue;
    }

    const rand = makeRandom(seed, tile.x, tile.y, tile.type);

    if (tile.type === 'grass') {
      const deco = rand();
      const cx = screen.x + TILE_SIZE / 2;
      const cy = screen.y + 4;

      if (deco < 0.12) {
        drawTree(ctx, cx, cy, palette, biome, rand);
      } else if (deco < 0.22) {
        drawFlower(ctx, cx, cy, palette, rand);
      } else if (deco < 0.4) {
        drawGrassTuft(ctx, cx, cy, palette, rand);
      } else if (deco < 0.46) {
        // Small rock.
        ctx.fillStyle = '#7a7a7a';
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 4 + rand() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tile.type === 'sand' && rand() < 0.18) {
      drawCactus(ctx, screen.x + TILE_SIZE / 2, screen.y + 6, palette, rand);
    } else if (tile.type === 'ash' && rand() < 0.16) {
      drawVolcanicRock(ctx, screen.x + TILE_SIZE / 2, screen.y + 6, palette, rand);
    } else if (tile.type === 'mycelium' && rand() < 0.2) {
      drawMushroom(ctx, screen.x + TILE_SIZE / 2, screen.y + 6, palette, rand);
    }
  }
}
