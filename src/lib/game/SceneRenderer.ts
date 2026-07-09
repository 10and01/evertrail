import type { CameraState, House, HouseDecoration, PlayerState, Tile } from '@/types/game';
import { TILE_SIZE } from './constants';
import { MOODS } from '@/lib/moods';
import { drawPlayer } from './Player';
import { LightingSystem } from './LightingSystem';
import type { LightSource } from './LightingSystem';

const imageCache = new Map<string, HTMLImageElement>();

function loadSceneImage(url: string): HTMLImageElement | undefined {
  if (imageCache.has(url)) {
    const img = imageCache.get(url);
    if (img && img.complete && img.naturalWidth > 0) return img;
    return undefined;
  }
  const img = new Image();
  // data URL 与同源图片无需 crossOrigin；外部链接需要 CORS 才能重新绘制到画布。
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    img.crossOrigin = 'anonymous';
  }
  img.src = url;
  img.onload = () => imageCache.set(url, img);
  return undefined;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeSeededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function tileRand(gx: number, gy: number): () => number {
  return makeSeededRandom(hashString(`${gx},${gy}`));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
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

export type MemorySceneState = {
  entry: import('@/types/game').JournalEntry;
  charIndex: number;
  timer: number;
};

export function updateMemorySceneState(state: MemorySceneState, delta: number): void {
  state.timer += delta;
  const charsPerMs = 0.03;
  if (state.charIndex < state.entry.text.length) {
    state.charIndex = Math.min(state.entry.text.length, Math.floor(state.timer * charsPerMs));
  }
}

export function drawMemoryScene(
  ctx: CanvasRenderingContext2D,
  uiCtx: CanvasRenderingContext2D,
  state: MemorySceneState,
  size: { width: number; height: number },
  palette: { skyTop: string; skyBottom: string; accent: string },
  time: number
): void {
  const { width, height } = size;
  const entry = state.entry;

  // 背景：与当前心情对应的深渐变，并在中央留有微弱光晕。
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 轻微漂浮光点。
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 24; i++) {
    const tx = ((i * 137.5 + time * 0.02) % width);
    const ty = ((i * 73.3 + Math.sin(time * 0.001 + i) * 40) % height);
    const r = 1 + (i % 3);
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // UI 层绘制记忆文本与图片，无字框。
  const padding = 32;
  const maxTextW = Math.min(640, width - padding * 2);

  uiCtx.save();
  uiCtx.font = '15px monospace';
  const displayed = entry.text.slice(0, state.charIndex);
  const lines = wrapText(uiCtx, displayed, maxTextW);
  const lineH = 24;
  const imageSize = entry.image ? Math.min(220, maxTextW) : 0;

  const dateStr = entry.date || new Date(entry.createdAt).toLocaleDateString();
  const moodInfo = MOODS[entry.mood];
  const header = `${moodInfo.emoji} ${dateStr} · ${moodInfo.label} · ${entry.tags.join(' · ') || '无标签'}`;

  const contentH = 28 + lines.length * lineH + (imageSize ? imageSize + 24 : 0);
  const startY = height / 2 - contentH / 2 + 40;
  let textY = startY;

  uiCtx.shadowColor = 'rgba(0,0,0,0.9)';
  uiCtx.shadowBlur = 6;

  // 标题。
  uiCtx.fillStyle = 'rgba(255,255,255,0.7)';
  uiCtx.font = '12px monospace';
  uiCtx.textAlign = 'center';
  uiCtx.textBaseline = 'top';
  uiCtx.fillText(header, width / 2, textY);
  textY += 28;

  // 正文。
  uiCtx.fillStyle = '#f0e6d2';
  uiCtx.font = '16px monospace';
  uiCtx.textAlign = 'center';
  uiCtx.textBaseline = 'top';
  lines.forEach((l) => {
    uiCtx.fillText(l, width / 2, textY);
    textY += lineH;
  });

  // 图片。
  if (entry.image && state.charIndex >= entry.text.length) {
    const img = loadSceneImage(entry.image);
    const imgY = textY + 16;
    if (img) {
      const aspect = img.naturalWidth / img.naturalHeight;
      const drawW = aspect >= 1 ? imageSize : imageSize * aspect;
      const drawH = aspect >= 1 ? imageSize / aspect : imageSize;
      const imgX = width / 2 - drawW / 2;
      if (imgY + drawH < height - 32) {
        uiCtx.drawImage(img, imgX, imgY, drawW, drawH);
      }
    } else {
      uiCtx.fillStyle = 'rgba(40,40,40,0.8)';
      uiCtx.fillRect(width / 2 - imageSize / 2, imgY, imageSize, imageSize * 0.75);
      uiCtx.fillStyle = 'rgba(255,255,255,0.5)';
      uiCtx.font = '11px monospace';
      uiCtx.textAlign = 'center';
      uiCtx.textBaseline = 'middle';
      uiCtx.fillText('加载照片中...', width / 2, imgY + (imageSize * 0.75) / 2);
    }
  }
  uiCtx.restore();
}

export function buildHouseSceneTiles(house: House): Tile[] {
  const tiles: Tile[] = [];
  for (let gy = 0; gy < house.height; gy++) {
    for (let gx = 0; gx < house.width; gx++) {
      const cell = house.floorPlan[gy]?.[gx];
      if (!cell || cell.type === 'empty') continue;
      const wx = house.x + gx * TILE_SIZE;
      const wy = house.y + gy * TILE_SIZE;
      // 墙壁仅作背景，不生成碰撞；房门可穿过；只有地板参与碰撞。
      const isSolid = cell.type === 'floor';
      const type: Tile['type'] = cell.type === 'wall' ? 'stone' : cell.type === 'floor' ? 'wood' : cell.type;
      tiles.push({
        x: wx,
        y: wy,
        type,
        biome: 'calm',
        solid: isSolid,
        houseTile: true,
        destructible: false,
      });
    }
  }
  return tiles;
}

interface NeighborTypes {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

function getNeighbors(house: House, gx: number, gy: number): NeighborTypes {
  return {
    top: house.floorPlan[gy - 1]?.[gx]?.type,
    bottom: house.floorPlan[gy + 1]?.[gx]?.type,
    left: house.floorPlan[gy]?.[gx - 1]?.type,
    right: house.floorPlan[gy]?.[gx + 1]?.type,
  };
}

function drawInteriorTile(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  sx: number,
  sy: number,
  neighbors: NeighborTypes,
  rand: () => number,
  isOpen = false
): void {
  const s = TILE_SIZE;
  switch (tile.type) {
    case 'stone': {
      // 墙基色
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(sx, sy, s, s);
      // 内层高光，形成砖块厚度
      ctx.fillStyle = '#4d3930';
      ctx.fillRect(sx + 2, sy + 2, s - 4, s - 4);
      ctx.fillStyle = 'rgba(80,60,50,0.25)';
      ctx.fillRect(sx + 4, sy + 4, s - 8, s - 8);

      // 像素噪点：裂纹与污渍
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const px = sx + 3 + rand() * (s - 6);
        const py = sy + 3 + rand() * (s - 6);
        const w = 1 + rand() * 3;
        const h = 1 + rand() * 2;
        ctx.fillStyle = rand() > 0.55 ? 'rgba(28,18,14,0.55)' : 'rgba(95,75,62,0.35)';
        ctx.fillRect(px, py, w, h);
      }

      // 墙角阴影
      if (!neighbors.left) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(sx, sy, 4, s);
      }
      if (!neighbors.right) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sx + s - 4, sy, 4, s);
      }

      // 踢脚线：墙下邻接地板时
      if (neighbors.bottom === 'floor') {
        ctx.fillStyle = '#241a16';
        ctx.fillRect(sx + 1, sy + s - 5, s - 2, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(sx + 1, sy + s - 5, s - 2, 1);
      }

      // 吊顶边缘 / 屋檐装饰：上方为空或天花板时
      if (!neighbors.top || neighbors.top === 'empty') {
        ctx.fillStyle = '#2a1e18';
        ctx.fillRect(sx, sy, s, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(sx, sy + 4, s, 1);
      }
      break;
    }
    case 'wood': {
      // 地板基色
      ctx.fillStyle = '#5a4538';
      ctx.fillRect(sx, sy, s, s);
      ctx.fillStyle = 'rgba(110,85,70,0.45)';
      ctx.fillRect(sx + 2, sy + 2, s - 4, s - 4);

      // 木板缝隙
      ctx.strokeStyle = 'rgba(55,40,32,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + s / 2, sy + 1);
      ctx.lineTo(sx + s / 2, sy + s - 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 1, sy + s / 2);
      ctx.lineTo(sx + s - 1, sy + s / 2);
      ctx.stroke();

      // 污渍噪点
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const px = sx + rand() * s;
        const py = sy + rand() * s;
        ctx.fillStyle = 'rgba(40,28,22,0.32)';
        ctx.fillRect(px, py, 2 + rand() * 3, 1 + rand() * 2);
      }
      break;
    }
    case 'door': {
      // 门框。
      ctx.fillStyle = '#2a1e18';
      ctx.fillRect(sx, sy, s, s);
      ctx.fillStyle = '#4a3525';
      ctx.fillRect(sx + 2, sy + 2, s - 4, s - 4);

      if (isOpen) {
        // 左侧打开的门板。
        ctx.fillStyle = '#7a5a42';
        ctx.fillRect(sx + 4, sy + 4, s / 2 - 5, s - 8);
        ctx.fillStyle = 'rgba(40,30,20,0.22)';
        ctx.fillRect(sx + 7, sy + 8, s / 2 - 11, s - 16);
        // 右侧门框。
        ctx.fillStyle = '#5c4332';
        ctx.fillRect(sx + s / 2 + 1, sy + 4, s / 2 - 5, s - 8);
      } else {
        // 关闭的门板。
        ctx.fillStyle = '#7a5a42';
        ctx.fillRect(sx + 4, sy + 4, s - 8, s - 8);
        ctx.fillStyle = 'rgba(40,30,20,0.22)';
        ctx.fillRect(sx + 7, sy + 8, s - 14, s - 16);
      }

      // 门把手与微光。
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(sx + s / 2 - 6, sy + s / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,160,0.22)';
      ctx.fillRect(sx + s / 2 - 1, sy + 6, 2, s - 12);
      break;
    }
    case 'window': {
      ctx.fillStyle = '#2a1e18';
      ctx.fillRect(sx, sy, s, s);
      if (isOpen) {
        // 打开的窗户：窗扇外开，能看到夜光。
        const moonGlow = ctx.createLinearGradient(sx + 4, sy + 6, sx + s - 4, sy + s - 6);
        moonGlow.addColorStop(0, 'rgba(180,210,255,0.28)');
        moonGlow.addColorStop(1, 'rgba(120,150,200,0.12)');
        ctx.fillStyle = moonGlow;
        ctx.fillRect(sx + 4, sy + 6, s - 8, s - 12);
        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 4, sy + 6, s - 8, s - 12);
        // 外开的窗扇。
        ctx.fillStyle = '#4a3525';
        ctx.fillRect(sx + 4, sy + 6, (s - 8) / 2 - 1, s - 12);
        ctx.fillRect(sx + s / 2 + 1, sy + 6, (s - 8) / 2 - 1, s - 12);
      } else {
        // 关闭的窗户：玻璃反光。
        ctx.fillStyle = 'rgba(180,210,255,0.22)';
        ctx.fillRect(sx + 4, sy + 6, s - 8, s - 12);
        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 4, sy + 6, s - 8, s - 12);
      }
      ctx.beginPath();
      ctx.moveTo(sx + s / 2, sy + 6);
      ctx.lineTo(sx + s / 2, sy + s - 6);
      ctx.moveTo(sx + 4, sy + s / 2);
      ctx.lineTo(sx + s - 4, sy + s / 2);
      ctx.stroke();
      break;
    }
    default:
      ctx.fillStyle = '#2a1e18';
      ctx.fillRect(sx, sy, s, s);
  }
}

function drawCeilingFill(
  ctx: CanvasRenderingContext2D,
  house: House,
  sx: number,
  sy: number,
  s: number
): void {
  const widthPx = house.width * s;
  // 顶部暗影渐变，避免纯黑正方形
  const grad = ctx.createLinearGradient(0, 0, 0, sy + s * 1.5);
  grad.addColorStop(0, '#0a0605');
  grad.addColorStop(0.6, '#150f0c');
  grad.addColorStop(1, 'rgba(26,20,16,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, widthPx, sy + s * 1.5);

  // 若顶行存在空单元格，用天花板砖块补齐
  for (let gx = 0; gx < house.width; gx++) {
    const cell = house.floorPlan[0]?.[gx];
    if (!cell || cell.type === 'empty') {
      const x = sx + gx * s;
      ctx.fillStyle = '#1e1712';
      ctx.fillRect(x, sy, s, s);
      // 吊顶木梁
      ctx.fillStyle = '#0f0a08';
      ctx.fillRect(x, sy + s - 4, s, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, sy + s - 4, s, 1);
    }
  }
}

function drawDecorationShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number
): void {
  const g = ctx.createRadialGradient(cx, cy - 1, 1, cx, cy - 1, w * 0.65);
  g.addColorStop(0, 'rgba(0,0,0,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, w * 0.5, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawInteriorDecoration(
  ctx: CanvasRenderingContext2D,
  deco: HouseDecoration,
  sx: number,
  sy: number,
  s: number
): void {
  const cx = sx + deco.gx * s + s / 2;
  const cy = sy + deco.gy * s + s;
  const rand = makeSeededRandom(hashString(`${deco.gx},${deco.gy}`));

  switch (deco.kind) {
    case 'chair': {
      // 家具阴影
      drawDecorationShadow(ctx, cx, cy, 20, 8);
      // 后腿
      ctx.fillStyle = '#3e2e24';
      ctx.fillRect(cx - 7, cy - 14, 3, 12);
      ctx.fillRect(cx + 4, cy - 14, 3, 12);
      // 靠背
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(cx - 8, cy - 26, 16, 14);
      // 座面
      ctx.fillStyle = '#6b5642';
      ctx.fillRect(cx - 8, cy - 14, 16, 5);
      // 坐垫
      ctx.fillStyle = '#8b6f4e';
      ctx.fillRect(cx - 7, cy - 16, 14, 4);
      // 坐下状态：显示一团柔和的休息光晕。
      if (deco.open) {
        const restGlow = ctx.createRadialGradient(cx, cy - 18, 2, cx, cy - 18, 18);
        restGlow.addColorStop(0, 'rgba(255,230,180,0.35)');
        restGlow.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = restGlow;
        ctx.beginPath();
        ctx.arc(cx, cy - 18, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'table': {
      drawDecorationShadow(ctx, cx, cy, 34, 10);
      // 桌腿
      ctx.fillStyle = '#4a3525';
      ctx.fillRect(cx - 12, cy - 6, 3, 8);
      ctx.fillRect(cx + 9, cy - 6, 3, 8);
      // 桌面侧面
      ctx.fillStyle = '#5c4332';
      ctx.fillRect(cx - 15, cy - 8, 30, 5);
      // 桌面顶面
      ctx.fillStyle = '#7a5a42';
      ctx.fillRect(cx - 16, cy - 13, 32, 6);
      // 桌面小物
      if (rand() > 0.35) {
        // 书本
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(cx - 8, cy - 16, 7, 4);
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(cx - 8, cy - 15, 7, 1);
      }
      if (rand() > 0.45) {
        // 蜡烛
        ctx.fillStyle = '#8b5a3c';
        ctx.fillRect(cx + 2, cy - 17, 3, 5);
        ctx.fillStyle = 'rgba(255,220,160,0.9)';
        ctx.beginPath();
        ctx.arc(cx + 3.5, cy - 18, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (rand() > 0.6) {
        // 小水杯
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(cx + 6, cy - 16, 4, 4);
      }
      break;
    }
    case 'lamp': {
      // 底座
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(cx - 5, cy - 3, 10, 3);
      ctx.fillStyle = '#555555';
      ctx.fillRect(cx - 2, cy - 14, 4, 11);
      // 灯罩
      ctx.fillStyle = 'rgba(90,60,40,0.95)';
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 14);
      ctx.lineTo(cx + 7, cy - 14);
      ctx.lineTo(cx + 5, cy - 23);
      ctx.lineTo(cx - 5, cy - 23);
      ctx.closePath();
      ctx.fill();
      // 灯泡辉光（仅在开灯时显示）。
      if (deco.open) {
        const bulb = ctx.createRadialGradient(cx, cy - 19, 2, cx, cy - 19, 16);
        bulb.addColorStop(0, 'rgba(255,230,160,0.95)');
        bulb.addColorStop(0.5, 'rgba(255,190,90,0.35)');
        bulb.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = bulb;
        ctx.beginPath();
        ctx.arc(cx, cy - 19, 16, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 关灯时显示暗淡灯泡。
        ctx.fillStyle = 'rgba(120,120,120,0.5)';
        ctx.beginPath();
        ctx.arc(cx, cy - 19, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'rug': {
      ctx.fillStyle = 'rgba(130,75,55,0.85)';
      ctx.fillRect(cx - 18, cy - 5, 36, 10);
      ctx.fillStyle = 'rgba(170,120,80,0.55)';
      ctx.fillRect(cx - 16, cy - 3, 32, 6);
      ctx.strokeStyle = 'rgba(210,180,130,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 16, cy - 3, 32, 6);
      // 中央纹样
      ctx.fillStyle = 'rgba(220,190,140,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 5, cy);
      ctx.lineTo(cx, cy + 3);
      ctx.lineTo(cx - 5, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'plant': {
      drawDecorationShadow(ctx, cx, cy, 14, 6);
      // 花盆
      ctx.fillStyle = '#6b4e32';
      ctx.fillRect(cx - 5, cy - 4, 10, 5);
      ctx.fillStyle = '#8b6f4e';
      ctx.fillRect(cx - 6, cy - 7, 12, 3);
      // 多层叶子
      ctx.fillStyle = '#3a5a2a';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a6a3a';
      ctx.beginPath();
      ctx.arc(cx + 4, cy - 12, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a7a4a';
      ctx.beginPath();
      ctx.arc(cx, cy - 17, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'picture-frame':
      drawInteriorPictureFrame(ctx, deco, cx, cy, s, rand);
      break;
    case 'crafting-table':
      drawInteriorCraftingTable(ctx, cx, cy);
      break;
    case 'bookshelf': {
      // 书架占据 2.5 格宽、2.5 格高，向上延伸，更显眼。
      const bw = Math.floor(s * 2.5);
      const bh = Math.floor(s * 2.5);
      const bx = cx - bw / 2;
      const by = cy - bh;
      drawDecorationShadow(ctx, cx, cy, bw + 8, 12);
      // 书架背板
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(bx, by, bw, bh);
      // 书架主体
      ctx.fillStyle = '#4a3525';
      ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
      // 边框
      ctx.strokeStyle = '#2a1e18';
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.strokeStyle = '#5c4332';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);
      // 隔板
      ctx.fillStyle = '#2a1e18';
      const shelfCount = 5;
      for (let i = 1; i < shelfCount; i++) {
        const sy = by + (bh / shelfCount) * i;
        ctx.fillRect(bx + 4, sy, bw - 8, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(bx + 4, sy + 1, bw - 8, 1);
        ctx.fillStyle = '#2a1e18';
      }
      // 书籍
      const bookColors = ['#8b5a3c', '#3c6b8b', '#7a8b3c', '#8b3c5a', '#d4af37', '#6b4e8b'];
      const books = deco.books?.length ? deco.books : [];
      const displayCount = Math.max(books.length, 4 + Math.floor(rand() * 3));
      const slotsPerShelf = 4;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < Math.min(displayCount, slotsPerShelf * shelfCount); i++) {
        const shelf = Math.floor(i / slotsPerShelf);
        const slot = i % slotsPerShelf;
        const cellH = bh / shelfCount;
        const bookW = Math.floor((bw - 14) / slotsPerShelf) - 2;
        const bookH = cellH - 8;
        const bookX = bx + 7 + slot * (bookW + 2);
        const bookY = by + 4 + shelf * cellH;
        const color = bookColors[Math.floor(rand() * bookColors.length)];
        ctx.fillStyle = color;
        ctx.fillRect(bookX, bookY, bookW, bookH);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bookX, bookY + bookH - 3, bookW, 3);
        // 若该位置有真实书籍，在书脊上显示书名前两个字。
        const book = books[i];
        if (book?.title) {
          ctx.save();
          ctx.translate(bookX + bookW / 2, bookY + bookH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.font = 'bold 10px monospace';
          const label = book.title.slice(0, 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
      break;
    }
    case 'ladder': {
      // 梯子紧贴墙面
      ctx.strokeStyle = '#6b5a42';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 36);
      ctx.lineTo(cx - 6, cy);
      ctx.moveTo(cx + 6, cy - 36);
      ctx.lineTo(cx + 6, cy);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const ly = cy - 30 + i * 8;
        ctx.beginPath();
        ctx.moveTo(cx - 6, ly);
        ctx.lineTo(cx + 6, ly);
        ctx.stroke();
      }
      break;
    }
  }
}

function drawInteriorCraftingTable(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
): void {
  drawDecorationShadow(ctx, cx, cy, 36, 10);
  // 桌面侧面
  ctx.fillStyle = '#5c4332';
  ctx.fillRect(cx - 16, cy - 8, 32, 5);
  // 桌面顶面
  ctx.fillStyle = '#7a5a42';
  ctx.fillRect(cx - 17, cy - 13, 34, 6);
  // 桌腿
  ctx.fillStyle = '#4a3525';
  ctx.fillRect(cx - 13, cy - 3, 3, 6);
  ctx.fillRect(cx + 10, cy - 3, 3, 6);
  // 卷轴
  ctx.fillStyle = '#e8dcc8';
  ctx.fillRect(cx - 10, cy - 16, 11, 3);
  ctx.fillStyle = '#bfa67a';
  ctx.fillRect(cx - 10, cy - 15, 11, 1);
  // 工具与微光
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(cx + 5, cy - 16, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(cx + 9, cy - 18, 3, 5);
  // 合成台辉光
  const glow = ctx.createRadialGradient(cx, cy - 14, 2, cx, cy - 14, 12);
  glow.addColorStop(0, 'rgba(255,220,160,0.5)');
  glow.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawInteriorPictureFrame(
  ctx: CanvasRenderingContext2D,
  deco: HouseDecoration,
  cx: number,
  cy: number,
  s: number,
  rand: () => number
): void {
  // 进一步放大相框
  const fw = Math.floor(s * 1.75);
  const fh = Math.floor(s * 2.15);
  const fx = cx - fw / 2;
  const fy = cy - fh - 2;

  // 魔法光柱 / 蜘蛛丝：若相框较高，从顶部连接到天花板
  if (fy < s * 2.5) {
    const beam = ctx.createLinearGradient(cx, 0, cx, fy);
    beam.addColorStop(0, 'rgba(255,220,140,0)');
    beam.addColorStop(0.5, 'rgba(255,220,140,0.08)');
    beam.addColorStop(1, 'rgba(255,220,140,0.18)');
    ctx.fillStyle = beam;
    ctx.fillRect(cx - 2, 0, 4, fy);
    // 微光粒子点缀
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    for (let i = 0; i < 5; i++) {
      const py = (fy * (i + 1)) / 6 + Math.sin((Date.now() / 300) + i) * 2;
      ctx.beginPath();
      ctx.arc(cx + (rand() - 0.5) * 4, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 相框背板
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
  // 金边
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(fx - 2, fy - 2, fw + 4, fh + 4);
  // 内衬
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(fx, fy, fw, fh);
  ctx.strokeStyle = 'rgba(212,175,55,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 3, fy + 3, fw - 6, fh - 6);

  // 图片内容
  if (deco.imageUrl) {
    const img = loadSceneImage(deco.imageUrl);
    if (img) {
      const pad = 6;
      const iw = fw - pad * 2;
      const ih = fh - pad * 2;
      const aspect = img.naturalWidth / img.naturalHeight;
      let drawW = iw;
      let drawH = ih;
      if (aspect > iw / ih) {
        drawH = iw / aspect;
      } else {
        drawW = ih * aspect;
      }
      const ix = fx + pad + (iw - drawW) / 2;
      const iy = fy + pad + (ih - drawH) / 2;
      ctx.drawImage(img, ix, iy, drawW, drawH);
    } else {
      ctx.fillStyle = 'rgba(40,40,40,0.8)';
      ctx.fillRect(fx + 4, fy + 4, fw - 8, fh - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('照片', cx, fy + fh / 2);
    }
  } else {
    ctx.fillStyle = 'rgba(40,40,40,0.8)';
    ctx.fillRect(fx + 4, fy + 4, fw - 8, fh - 8);
  }
}

function drawInteriorPortal(
  ctx: CanvasRenderingContext2D,
  house: House,
  sx: number,
  sy: number,
  time: number
): void {
  if (!house.portal) return;
  const cx = sx + house.portal.gx * TILE_SIZE + TILE_SIZE / 2;
  const cy = sy + house.portal.gy * TILE_SIZE + TILE_SIZE;
  const pulse = 1 + Math.sin(time / 200) * 0.1;

  ctx.save();
  ctx.translate(cx, cy - 18);
  ctx.scale(pulse, pulse);

  // 外圈光晕
  const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
  gradient.addColorStop(0, 'rgba(140,210,255,0.75)');
  gradient.addColorStop(0.45, 'rgba(100,180,255,0.25)');
  gradient.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  // 传送门椭圆
  ctx.fillStyle = 'rgba(20,40,80,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,220,255,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 内部旋涡
  ctx.strokeStyle = 'rgba(200,240,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 5 + Math.sin(time / 150) * 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawHouseScene(
  ctx: CanvasRenderingContext2D,
  uiCtx: CanvasRenderingContext2D,
  house: House,
  player: PlayerState,
  camera: CameraState,
  size: { width: number; height: number },
  palette: { accent: string },
  time: number,
  lightingSystem?: LightingSystem
): void {
  const { width, height } = size;

  // 背景：室内基调，稍亮于之前，避免整体过暗。
  const roomGrad = ctx.createLinearGradient(0, 0, 0, height);
  roomGrad.addColorStop(0, '#221a16');
  roomGrad.addColorStop(1, '#1a1410');
  ctx.fillStyle = roomGrad;
  ctx.fillRect(0, 0, width, height);

  const s = TILE_SIZE;
  const sx = house.x - camera.x;
  const sy = house.y - camera.y;

  // 天花板填充：处理顶部的黑色区域
  drawCeilingFill(ctx, house, sx, sy, s);

  // 绘制地板计划。
  for (let gy = 0; gy < house.height; gy++) {
    for (let gx = 0; gx < house.width; gx++) {
      const cell = house.floorPlan[gy]?.[gx];
      if (!cell || cell.type === 'empty') continue;
      const type: Tile['type'] =
        cell.type === 'wall' ? 'stone' : cell.type === 'floor' ? 'wood' : cell.type;
      const tile: Tile = {
        x: house.x + gx * s,
        y: house.y + gy * s,
        type,
        biome: 'calm',
        // 墙壁仅作背景，不参与碰撞；只有地板是实心平台。
        solid: cell.type === 'floor',
        houseTile: true,
        destructible: false,
      };
      const neighbors = getNeighbors(house, gx, gy);
      const rand = tileRand(gx, gy);
      drawInteriorTile(ctx, tile, sx + gx * s, sy + gy * s, neighbors, rand, cell.open);
    }
  }

  // 绘制装饰物。
  for (const deco of house.decorations) {
    drawInteriorDecoration(ctx, deco, sx, sy, s);
  }

  // 传送门。
  drawInteriorPortal(ctx, house, sx, sy, time);

  // 玩家（使用与世界一致的人形绘制）。
  drawPlayer(ctx, player, player.x - camera.x, player.y - camera.y);

  // 室内动态光照：灯笼、传送门、玩家自身轮廓光
  const houseLights: LightSource[] = [];
  for (const deco of house.decorations) {
    const cx = sx + deco.gx * s + s / 2;
    const cy = sy + deco.gy * s + s;
    if (deco.kind === 'lamp' && deco.open) {
      houseLights.push({
        x: cx,
        y: cy - 19,
        radius: 120,
        color: '255,170,80',
        intensity: 0.55,
      });
    }
  }
  if (house.portal) {
    const cx = sx + house.portal.gx * s + s / 2;
    const cy = sy + house.portal.gy * s + s;
    houseLights.push({
      x: cx,
      y: cy - 18,
      radius: 140,
      color: '120,200,255',
      intensity: 0.5,
    });
  }
  houseLights.push({
    x: player.x - camera.x + player.width / 2,
    y: player.y - camera.y + player.height / 2,
    radius: 45,
    color: '255,220,180',
    intensity: 0.28,
  });

  if (lightingSystem) {
    lightingSystem.resize(width, height);
    // 提高环境亮度，让未照亮区域仍可见；光源作为额外提亮。
    lightingSystem.apply(ctx, 'rgb(255,245,235)', houseLights, 'high', 0.72);
  }

  // 室内暗角（减弱，避免压得太黑）
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.min(width, height) * 0.85
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
