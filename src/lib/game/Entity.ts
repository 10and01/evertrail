import type { Animal, CameraState, Collectible, CraftingFurnace, Echo, Mood, PlayerState, SaveBench, Tile, Waypoint } from '@/types/game';
import { TILE_SIZE } from './constants';
import { worldToScreen } from './Camera';
import { drawCraftingFurnace, drawSaveBench, drawWaypoint } from './InteractiveObjects';

export abstract class Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 是否使用 shadowBlur 等需要单独批量绘制的光效。 */
  usesShadowBlur = false;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  drawShadow(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    const screen = worldToScreen(camera, this.x, this.y);
    const cx = screen.x + this.width / 2;
    const cy = screen.y + this.height - 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, this.width * 0.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  abstract draw(ctx: CanvasRenderingContext2D, camera: CameraState, time: number): void;
}

export class PlayerEntity extends Entity {
  private player: PlayerState;
  private groundY = 0;
  private getMoodForm: () => Mood;

  constructor(player: PlayerState, getMoodForm: () => Mood) {
    super(player.x, player.y, player.width, player.height);
    this.player = player;
    this.getMoodForm = getMoodForm;
    this.groundY = player.y + player.height;
  }

  drawShadow(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    this.sync();
    if (this.player.onGround) {
      this.groundY = this.y + this.height;
    }

    const screen = worldToScreen(camera, this.x, this.y);
    const cx = screen.x + this.width / 2;
    const cy = screen.y + this.height - 2;
    const baseRx = this.width * 0.4;

    const dist = Math.max(0, this.groundY - (this.y + this.height));
    const maxDist = 120;
    const scale = Math.max(0.25, 1 - dist / maxDist);
    const alpha = Math.max(0.05, 0.25 * scale);

    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, baseRx * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState, time: number): void {
    this.sync();
    const t = time / 1000;
    const screen = worldToScreen(camera, this.x, this.y);
    const mirror = !this.player.facingRight;
    const form = this.getMoodForm();
    const colors = getPlayerColors(form);

    // Idle breathing.
    const breathY = this.player.onGround ? Math.sin(t * 2) * 1 : 0;
    // Walk sway.
    const walkSway =
      this.player.onGround && Math.abs(this.player.vx) > 0.1
        ? Math.sin(t * 8) * 1.5 * (this.player.vx > 0 ? 1 : -1)
        : 0;
    // Jump tilt.
    const tilt =
      !this.player.onGround ? (this.player.vy < 0 ? -0.12 : 0.08) * (mirror ? -1 : 1) : 0;

    const cx = screen.x + this.width / 2 + walkSway;
    const cy = screen.y + this.height / 2 + breathY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.translate(-cx, -cy);

    // Character rim light / glow halo to stand out against dark terrain.
    const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 42);
    halo.addColorStop(0, 'rgba(255,230,180,0.18)');
    halo.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();

    // Anxious form leaves a faint purple afterimage.
    if (form === 'anxious') {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#a855f7';
      const offsetX = mirror ? 6 : -6;
      ctx.fillRect(screen.x + offsetX, screen.y, this.width, this.height);
      ctx.restore();
    }

    // Sad form is semi-transparent.
    if (form === 'sad') {
      ctx.globalAlpha = 0.75;
    }

    const px = (bx: number, by: number, w: number, h: number) => {
      const drawX = mirror ? this.width - bx - w : bx;
      ctx.fillRect(screen.x + drawX, screen.y + by, w, h);
    };

    const walkCycle = this.player.onGround && Math.abs(this.player.vx) > 0.1 ? t * 10 : 0;
    const legSwing = Math.sin(walkCycle) * 2;
    const armSwing = Math.cos(walkCycle) * 2;
    const bodyBounce = Math.abs(Math.sin(walkCycle)) * 0.5;

    // Hair / hat.
    ctx.fillStyle = colors.hair;
    px(4, 0, 12, 4);

    // Head.
    ctx.fillStyle = '#f5cba7';
    px(5, 3, 10, 9);

    // Eyes.
    ctx.fillStyle = colors.eyes;
    if (mirror) {
      px(6, 6, 2, 2);
    } else {
      px(12, 6, 2, 2);
    }

    // Body (shirt).
    ctx.fillStyle = colors.body;
    px(6, 12 + bodyBounce, 8, 10);

    // Joy form golden accents.
    if (form === 'joy') {
      ctx.fillStyle = '#ffd700';
      px(8, 14 + bodyBounce, 4, 2);
    }

    // Arms.
    ctx.fillStyle = '#f5cba7';
    px(3, 13 + bodyBounce - armSwing, 3, 8);
    px(14, 13 + bodyBounce + armSwing, 3, 8);

    // Pants.
    ctx.fillStyle = colors.pants;
    px(6, 22 + bodyBounce, 3, 4);
    px(11, 22 + bodyBounce, 3, 4);

    // Legs.
    ctx.fillStyle = colors.legs;
    px(6, 24 + bodyBounce + legSwing, 3, 4);
    px(11, 24 + bodyBounce - legSwing, 3, 4);

    ctx.restore();
  }

  private sync(): void {
    this.x = this.player.x;
    this.y = this.player.y;
    this.width = this.player.width;
    this.height = this.player.height;
  }
}

export class TreeEntity extends Entity {
  baseX: number;
  baseY: number;
  trunkHeight: number;
  crownRadius: number;
  private seed: number;

  constructor(x: number, y: number, trunkHeight = 48, crownRadius = 28, seed = 0) {
    super(x - crownRadius, y - trunkHeight - crownRadius, crownRadius * 2, trunkHeight + crownRadius * 2);
    this.baseX = x;
    this.baseY = y;
    this.trunkHeight = trunkHeight;
    this.crownRadius = crownRadius;
    this.seed = seed;
  }

  drawShadow(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    const screen = worldToScreen(camera, this.baseX, this.baseY);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - 2, this.crownRadius * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState, time: number): void {
    const t = time / 1000;
    const sway = Math.sin(t * 1.2 + this.seed) * 2.5;
    const screen = worldToScreen(camera, this.baseX, this.baseY);
    const bx = screen.x;
    const by = screen.y;
    const rand = seededRandom(this.seed || hashString(`${this.baseX},${this.baseY}`));

    ctx.save();

    // Trunk with bark texture lines.
    const trunkW = 8 + Math.floor(rand() * 4);
    ctx.fillStyle = '#4a2e18';
    ctx.fillRect(bx - trunkW / 2, by - this.trunkHeight, trunkW, this.trunkHeight);
    ctx.fillStyle = 'rgba(90,60,35,0.6)';
    for (let i = 0; i < 3; i++) {
      const tx = bx - trunkW / 2 + 2 + rand() * (trunkW - 4);
      ctx.fillRect(tx, by - this.trunkHeight + 4 + rand() * (this.trunkHeight - 8), 1, 6 + rand() * 8);
    }

    // Crown sways with the wind.
    ctx.translate(bx + sway, by - this.trunkHeight);

    // Darker under-layer.
    ctx.fillStyle = '#1e5a28';
    ctx.beginPath();
    ctx.arc(-4, 6, this.crownRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Main body layer.
    ctx.fillStyle = '#2d7a3a';
    ctx.beginPath();
    ctx.arc(0, 0, this.crownRadius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight layer.
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(-6 + rand() * 4, -8 + rand() * 4, this.crownRadius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Sun catch rim.
    ctx.fillStyle = 'rgba(120,255,120,0.18)';
    ctx.beginPath();
    ctx.arc(-8, -10, this.crownRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class CollectibleEntity extends Entity {
  private collectible: Collectible;

  constructor(collectible: Collectible) {
    super(collectible.x, collectible.y, collectible.width, collectible.height);
    this.collectible = collectible;
  }

  drawShadow(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    if (this.collectible.collected) return;
    this.sync();
    const screen = worldToScreen(camera, this.x, this.y);
    const cx = screen.x + this.width / 2;
    const cy = screen.y + this.height - 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, this.width * 0.35, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState, time: number): void {
    if (this.collectible.collected) return;
    this.sync();
    const t = time / 1000;
    const screen = worldToScreen(camera, this.x, this.y);
    const cx = screen.x + this.width / 2;
    const cy = screen.y + this.height / 2 + Math.sin(t * 2 + this.collectible.floatOffset) * 5;
    const w = this.width;
    const h = this.height;

    const isShard = this.collectible.kind === 'shard';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.5 + this.collectible.floatOffset);

    if (isShard) {
      // 情绪碎片：灰白不规则小石块，微光。
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
      glow.addColorStop(0, 'rgba(200,200,210,0.35)');
      glow.addColorStop(1, 'rgba(200,200,210,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#a0a0a8';
      ctx.beginPath();
      ctx.moveTo(-w / 3, -h / 4);
      ctx.lineTo(w / 4, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 5, h / 3);
      ctx.lineTo(-w / 3, h / 4);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(-w / 5, -h / 6);
      ctx.lineTo(0, -h / 3);
      ctx.lineTo(w / 6, -h / 8);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Outer cyan glow (30px radius).
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
      glow.addColorStop(0, 'rgba(100,220,255,0.4)');
      glow.addColorStop(0.5, 'rgba(80,190,255,0.15)');
      glow.addColorStop(1, 'rgba(80,190,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      // Main diamond.
      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fill();

      // Inner white highlight diamond.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -h / 4);
      ctx.lineTo(w / 4, 0);
      ctx.lineTo(0, h / 4);
      ctx.lineTo(-w / 4, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // Label.
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(this.collectible.label, cx, cy + h / 2 + 6);
  }

  private sync(): void {
    this.x = this.collectible.x;
    this.y = this.collectible.y;
  }
}

export class WaypointEntity extends Entity {
  private waypoint: Waypoint;
  private isSelected: () => boolean;

  constructor(waypoint: Waypoint, isSelected: () => boolean) {
    super(waypoint.x, waypoint.y, waypoint.width, waypoint.height);
    this.waypoint = waypoint;
    this.isSelected = isSelected;
    this.usesShadowBlur = true;
  }

  drawShadow(): void {
    // 路径点不投射阴影。
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    const screen = worldToScreen(camera, this.x, this.y);
    drawWaypoint(ctx, this.waypoint, screen.x, screen.y, this.isSelected());
  }
}

export class SaveBenchEntity extends Entity {
  private bench: SaveBench;
  private isSitting: () => boolean;

  constructor(bench: SaveBench, isSitting: () => boolean) {
    super(bench.x, bench.y, bench.width, bench.height);
    this.bench = bench;
    this.isSitting = isSitting;
  }

  drawShadow(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    const screen = worldToScreen(camera, this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(screen.x + this.width / 2, screen.y + this.height - 2, this.width * 0.35, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    const screen = worldToScreen(camera, this.x, this.y);
    drawSaveBench(ctx, this.bench, screen.x, screen.y, this.isSitting());
  }
}

export class CraftingFurnaceEntity extends Entity {
  private furnace: CraftingFurnace;

  constructor(furnace: CraftingFurnace) {
    super(furnace.x, furnace.y, furnace.width, furnace.height);
    this.furnace = furnace;
    this.usesShadowBlur = true;
  }

  drawShadow(): void {
    // 熔炉自身发光，不投射实体阴影。
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    this.sync();
    const screen = worldToScreen(camera, this.x, this.y);
    drawCraftingFurnace(ctx, this.furnace, screen.x, screen.y);
  }

  private sync(): void {
    this.x = this.furnace.x;
    this.y = this.furnace.y;
  }
}

export class EchoEntity extends Entity {
  private echo: Echo;
  private seed: number;

  constructor(echo: Echo) {
    super(echo.x, echo.y, echo.width, echo.height);
    this.echo = echo;
    this.seed = hashString(echo.id);
    this.usesShadowBlur = true;
  }

  drawShadow(): void {
    // 幻影不投射实体阴影。
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState, time: number): void {
    this.sync();
    const t = time / 1000;
    const screen = worldToScreen(camera, this.x, this.y);
    const cx = screen.x + this.width / 2;
    const cy = screen.y + this.height / 2 + Math.sin(t * 1.5 + this.seed * 10) * 2;
    const baseAlpha = this.echo.talked ? 0.35 : 0.85;

    ctx.save();
    ctx.globalAlpha = baseAlpha;

    switch (this.echo.biome) {
      case 'joy': {
        // 金色发光孩童轮廓，微微上下浮动。
        const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
        glow.addColorStop(0, 'rgba(255,215,0,0.5)');
        glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 8, 0, Math.PI * 2);
        ctx.moveTo(cx - 8, cy - 2);
        ctx.lineTo(cx - 10, cy + 14);
        ctx.lineTo(cx - 4, cy + 22);
        ctx.moveTo(cx + 8, cy - 2);
        ctx.lineTo(cx + 10, cy + 14);
        ctx.lineTo(cx + 4, cy + 22);
        ctx.stroke();
        break;
      }
      case 'calm': {
        // 蓝绿披风人影。
        ctx.fillStyle = 'rgba(42,157,143,0.6)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 18);
        ctx.quadraticCurveTo(cx - 16, cy + 4, cx - 10, cy + 22);
        ctx.lineTo(cx + 10, cy + 22);
        ctx.quadraticCurveTo(cx + 16, cy + 4, cx, cy - 18);
        ctx.fill();
        ctx.fillStyle = 'rgba(135,206,235,0.5)';
        ctx.fillRect(cx - 6, cy - 16, 12, 18);
        break;
      }
      case 'sad': {
        // 撑伞身影，雨滴粒子从伞边滑落。
        ctx.fillStyle = 'rgba(106,90,205,0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy + 4, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 3, cy + 12, 6, 14);

        ctx.strokeStyle = 'rgba(106,90,205,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 6);
        ctx.quadraticCurveTo(cx, cy - 24, cx + 18, cy - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 18);
        ctx.lineTo(cx, cy + 2);
        ctx.stroke();

        const rainPhase = (t * 3 + this.seed * 10) % 1;
        ctx.strokeStyle = 'rgba(150,180,255,0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const rx = -14 + i * 9;
          const ry = cy - 6 + rainPhase * 18 + (i % 2) * 6;
          ctx.beginPath();
          ctx.moveTo(cx + rx, ry);
          ctx.lineTo(cx + rx - 2, ry + 5);
          ctx.stroke();
        }
        break;
      }
      case 'angry': {
        // 熔岩剪影，周身余烬。
        ctx.fillStyle = 'rgba(60,10,5,0.85)';
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy + 22);
        ctx.lineTo(cx - 8, cy - 10);
        ctx.lineTo(cx, cy - 20);
        ctx.lineTo(cx + 8, cy - 10);
        ctx.lineTo(cx + 12, cy + 22);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ff4500';
        for (let i = 0; i < 5; i++) {
          const ex = cx - 10 + ((this.seed * 100 + i * 23) % 20);
          const ey = cy - 6 + ((Math.sin(t * 4 + i) + 1) * 8);
          const size = 1 + ((this.seed * 100 + i * 7) % 3);
          ctx.beginPath();
          ctx.arc(ex, ey, size, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'tired': {
        // 蜷缩睡觉的沙漠旅人。
        ctx.fillStyle = 'rgba(210,180,140,0.6)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 10, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,150,120,0.7)';
        ctx.beginPath();
        ctx.arc(cx - 8, cy + 8, 7, 0, Math.PI * 2);
        ctx.fill();

        const zAlpha = 0.5 + Math.sin(t * 2 + this.seed * 10) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${zAlpha})`;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('z', cx + 10, cy - 4 + Math.sin(t * 1.5 + this.seed) * 2);
        ctx.font = 'bold 7px monospace';
        ctx.fillText('z', cx + 16, cy - 10 + Math.sin(t * 2 + this.seed) * 2);
        break;
      }
      case 'anxious': {
        // 紫色迷雾中若隐若现的多重残影。
        ctx.fillStyle = 'rgba(100,40,120,0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 3; i++) {
          const offset = Math.sin(t * 3 + i * 2 + this.seed * 10) * 6;
          const alpha = 0.2 + 0.15 * Math.sin(t * 4 + i * 3);
          ctx.fillStyle = `rgba(160,80,200,${alpha})`;
          ctx.beginPath();
          ctx.arc(cx + offset, cy + i * 2, 9 - i, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default:
        break;
    }

    ctx.restore();
  }

  private sync(): void {
    this.x = this.echo.x;
    this.y = this.echo.y;
    this.width = this.echo.width;
    this.height = this.echo.height;
  }
}

export class AnimalEntity extends Entity {
  private animal: Animal;

  constructor(animal: Animal) {
    super(animal.x, animal.y, animal.width, animal.height);
    this.animal = animal;
  }

  drawShadow(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    if (this.animal.kind === 'bird' || this.animal.kind === 'butterfly' || this.animal.kind === 'firefly') return;
    this.sync();
    const screen = worldToScreen(camera, this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(screen.x + this.width / 2, screen.y + this.height - 1, this.width * 0.35, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState, time: number): void {
    this.sync();
    const t = time / 1000;
    const screen = worldToScreen(camera, this.x, this.y);
    const cx = screen.x + this.width / 2;
    const cy = screen.y + this.height / 2;

    ctx.save();
    // 统一添加浅色描边，让动物在复杂地形中更易辨认。
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    switch (this.animal.kind) {
      case 'rabbit': {
        const hop = this.animal.state === 'hop' ? Math.sin(t * 12) * 2 : 0;
        ctx.fillStyle = '#c2b280';
        ctx.fillRect(cx - 6, cy + hop, 12, 8);
        ctx.strokeRect(cx - 6, cy + hop, 12, 8);
        ctx.fillStyle = '#f5f5dc';
        ctx.fillRect(cx - 4, cy - 5 + hop, 8, 6);
        ctx.strokeRect(cx - 4, cy - 5 + hop, 8, 6);
        ctx.fillStyle = '#c2b280';
        ctx.fillRect(cx - 1, cy - 12 + hop, 2, 7);
        ctx.fillRect(cx + 3, cy - 11 + hop, 2, 6);
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(cx - 2, cy - 2 + hop, 1.5, 1.5);
        ctx.fillRect(cx + 1, cy - 2 + hop, 1.5, 1.5);
        break;
      }
      case 'bird': {
        const wing = Math.sin(t * 10) * 4;
        ctx.fillStyle = '#87ceeb';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e0f7fa';
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy);
        ctx.lineTo(cx - 12, cy - wing - 2);
        ctx.lineTo(cx - 2, cy + 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy);
        ctx.lineTo(cx + 12, cy - wing - 2);
        ctx.lineTo(cx + 2, cy + 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx + 4, cy - 1, 3, 2);
        break;
      }
      case 'fish': {
        const wiggle = Math.sin(t * 6) * 2;
        ctx.fillStyle = '#6fa8dc';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9fc5e8';
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy);
        ctx.lineTo(cx - 12, cy - 5 + wiggle);
        ctx.lineTo(cx - 12, cy + 5 + wiggle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + 3, cy - 1, 2, 2);
        break;
      }
      case 'butterfly': {
        const flutter = Math.sin(t * 15) * 2;
        ctx.fillStyle = '#ffab91';
        ctx.beginPath();
        ctx.ellipse(cx - 5, cy - 2 + flutter, 5, 7, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + 5, cy - 2 + flutter, 5, 7, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(cx - 1, cy - 5, 2, 10);
        break;
      }
      case 'firefly': {
        const glow = 0.5 + Math.sin(t * 4 + cx) * 0.4;
        ctx.fillStyle = `rgba(200,255,100,${glow})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,255,100,0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  private sync(): void {
    this.x = this.animal.x;
    this.y = this.animal.y;
  }
}

interface PlayerColors {
  hair: string;
  body: string;
  pants: string;
  legs: string;
  eyes: string;
}

function getPlayerColors(form: Mood): PlayerColors {
  switch (form) {
    case 'joy':
      return { hair: '#7a5c2a', body: '#f4d03f', pants: '#2c3e50', legs: '#34495e', eyes: '#2c3e50' };
    case 'calm':
      return { hair: '#5d4037', body: '#2a9d8f', pants: '#264653', legs: '#2a5a5a', eyes: '#2c3e50' };
    case 'sad':
      return { hair: '#5d4037', body: '#7f8c8d', pants: '#2c3e50', legs: '#34495e', eyes: '#5d6d7e' };
    case 'angry':
      return { hair: '#3e2723', body: '#922b21', pants: '#2c3e50', legs: '#34495e', eyes: '#e74c3c' };
    case 'tired':
      return { hair: '#5d4037', body: '#d2b48c', pants: '#8b7355', legs: '#a0826d', eyes: '#6c5b4f' };
    case 'anxious':
      return { hair: '#4a235a', body: '#7d3c98', pants: '#2c3e50', legs: '#34495e', eyes: '#8e44ad' };
    default:
      return { hair: '#5d4037', body: '#3498db', pants: '#2c3e50', legs: '#34495e', eyes: '#2c3e50' };
  }
}

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

export function buildTreeEntities(tiles: Tile[], seed = 'evertrail'): TreeEntity[] {
  const trees: TreeEntity[] = [];
  for (const tile of tiles) {
    if (tile.type !== 'grass') continue;
    if (tile.decoration !== 'tree') continue;
    const seedKey = `${seed},${tile.x},${tile.y},${tile.type},${tile.biome}`;
    const rand = seededRandom(hashString(seedKey + '-visual'));
    const trunkH = 36 + Math.floor(rand() * 24);
    const crownR = 22 + Math.floor(rand() * 10);
    trees.push(new TreeEntity(tile.x + TILE_SIZE / 2, tile.y + 4, trunkH, crownR, hashString(seedKey)));
  }
  return trees;
}
