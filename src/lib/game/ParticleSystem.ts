import type { Particle, BiomeKey, CameraState } from '@/types/game';
import { RENDER_MARGIN } from './constants';
import { worldToScreen } from './Camera';

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const POOL_SIZE = 500;
const MAX_ACTIVE = 300;


export type ParticleType = Particle['type'];

function makeEmptyParticle(): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    radius: 0,
    color: '#ffffff',
    gravity: 0,
    phase: 0,
    alpha: 0,
    baseAlpha: 1,
    active: false,
    type: 'dust',
  };
}

function safeGradient(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  r0: number,
  r1: number
): CanvasGradient {
  const x = Number.isFinite(sx) ? sx : 0;
  const y = Number.isFinite(sy) ? sy : 0;
  return ctx.createRadialGradient(x, y, r0, x, y, r1);
}

export class ParticleSystem {
  private pool: Particle[] = [];
  private activeCount = 0;
  private lastCamera: CameraState = { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, free: false };
  private lastViewWidth = 0;
  private lastViewHeight = 0;

  constructor(poolSize = POOL_SIZE) {
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(makeEmptyParticle());
    }
  }

  private findInactive(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    return null;
  }

  private initParticle(p: Particle, type: ParticleType, x: number, y: number): void {
    p.active = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.phase = rand(0, Math.PI * 2);
    p.rotation = 0;
    p.rotSpeed = 0;

    switch (type) {
      case 'firefly': {
        p.vx = rand(-0.6, 0.6);
        p.vy = rand(-0.6, 0.6);
        p.life = randInt(200, 400);
        p.radius = rand(2, 4);
        p.color = Math.random() > 0.5 ? '255,255,150' : '180,255,120';
        p.gravity = 0;
        p.baseAlpha = rand(0.75, 0.95);
        break;
      }
      case 'debris': {
        p.vx = rand(-3, 3);
        p.vy = rand(-6, -2.5);
        p.life = randInt(30, 70);
        p.radius = rand(2, 5);
        p.color = pick(['#7a7a7a', '#5a5a5a', '#4a4a4a']);
        p.gravity = 0.35;
        p.baseAlpha = 1;
        p.rotation = rand(0, Math.PI * 2);
        p.rotSpeed = rand(-0.2, 0.2);
        break;
      }
      case 'weapon_trail': {
        p.vx = rand(-1.5, 1.5);
        p.vy = rand(-1.5, 1.5);
        p.life = randInt(10, 25);
        p.radius = rand(1.5, 3);
        p.color = Math.random() > 0.6 ? '#fffbe6' : '#ffe066';
        p.gravity = 0;
        p.baseAlpha = rand(0.7, 0.95);
        break;
      }
      case 'rain': {
        p.vx = rand(-4, -2);
        p.vy = rand(12, 18);
        p.life = randInt(30, 55);
        p.radius = rand(1, 2);
        p.color = '#60a5fa';
        p.gravity = 0;
        p.baseAlpha = 0.7;
        break;
      }
      case 'snow': {
        p.vx = rand(-0.6, 0.6);
        p.vy = rand(0.8, 1.6);
        p.life = randInt(160, 260);
        p.radius = rand(2, 4);
        p.color = '#ffffff';
        p.gravity = 0;
        p.baseAlpha = 0.85;
        break;
      }
      case 'ember': {
        p.vx = rand(-0.8, 0.8);
        p.vy = rand(-2.5, -0.5);
        p.life = randInt(40, 90);
        p.radius = rand(1.5, 3);
        p.color = pick(['#ff6b35', '#f59e0b', '#ef4444']);
        p.gravity = 0;
        p.baseAlpha = 0.9;
        break;
      }
      case 'leaf': {
        p.vx = rand(-1.2, 1.2);
        p.vy = rand(0.6, 1.6);
        p.life = randInt(140, 240);
        p.radius = rand(3, 6);
        p.color = pick(['#4ade80', '#65a30d', '#a8a29e', '#d97706']);
        p.gravity = 0;
        p.baseAlpha = 0.9;
        break;
      }
      case 'sparkle': {
        p.vx = rand(-0.8, 0.8);
        p.vy = rand(-0.8, 0.8);
        p.life = randInt(30, 80);
        p.radius = rand(2, 4);
        p.color = '#fbbf24';
        p.gravity = 0;
        p.baseAlpha = 1;
        break;
      }
      case 'dust': {
        p.vx = rand(-0.4, 0.4);
        p.vy = rand(-0.3, 0.3);
        p.life = randInt(180, 320);
        p.radius = rand(1.5, 3);
        p.color = pick(['#d6c6a8', '#a855f7', '#c084fc', '#7e22ce']);
        p.gravity = 0;
        p.baseAlpha = 0.55;
        break;
      }
    }

    p.maxLife = p.life;
    p.alpha = p.baseAlpha;
  }

  spawn(type: ParticleType, x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= MAX_ACTIVE) break;
      const p = this.findInactive();
      if (!p) break;
      this.initParticle(p, type, x + rand(-8, 8), y + rand(-8, 8));
      this.activeCount++;
    }
  }

  emit(type: ParticleType, x: number, y: number, count: number): void {
    this.spawn(type, x, y, count);
  }

  emitDebris(x: number, y: number, color: string, count = 6): void {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= MAX_ACTIVE) break;
      const p = this.findInactive();
      if (!p) break;
      this.initParticle(p, 'debris', x + rand(-10, 10), y + rand(-6, 6));
      p.color = color;
      this.activeCount++;
    }
  }

  emitAmbient(
    biome: BiomeKey,
    camera: CameraState,
    viewWidth: number,
    viewHeight: number,
    densityMultiplier = 1
  ): void {
    this.lastCamera = camera;
    this.lastViewWidth = viewWidth;
    this.lastViewHeight = viewHeight;

    const margin = RENDER_MARGIN;
    const left = camera.x - margin;
    const right = camera.x + viewWidth + margin;
    const top = camera.y - margin;
    const bottom = camera.y + viewHeight + margin;
    const area = viewWidth * viewHeight;

    const countOf = (type: ParticleType): number => {
      let count = 0;
      for (const p of this.pool) {
        if (p.active && p.type === type) count++;
      }
      return count;
    };

    const spawnInView = (type: ParticleType, target: number): void => {
      const needed = target - countOf(type);
      for (let i = 0; i < needed; i++) {
        const x = rand(left, right);
        const y = rand(top, bottom);
        this.spawn(type, x, y, 1);
      }
    };

    switch (biome) {
      case 'joy':
      case 'calm': {
        spawnInView('firefly', Math.floor((area / 9000) * densityMultiplier));
        spawnInView('leaf', Math.floor((area / 26000) * densityMultiplier));
        spawnInView('sparkle', Math.floor((area / 22000) * densityMultiplier));
        break;
      }
      case 'sad': {
        spawnInView('rain', Math.floor((area / 2400) * densityMultiplier));
        spawnInView('firefly', Math.floor((area / 14000) * densityMultiplier));
        break;
      }
      case 'angry': {
        spawnInView('ember', Math.floor((area / 6000) * densityMultiplier));
        spawnInView('firefly', Math.floor((area / 20000) * densityMultiplier));
        break;
      }
      case 'tired': {
        spawnInView('dust', Math.floor((area / 8000) * densityMultiplier));
        spawnInView('firefly', Math.floor((area / 16000) * densityMultiplier));
        break;
      }
      case 'anxious': {
        spawnInView('dust', Math.floor((area / 5000) * densityMultiplier));
        spawnInView('firefly', Math.floor((area / 12000) * densityMultiplier));
        break;
      }
    }
  }

  triggerAchievementEffect(x: number, y: number): void {
    const count = 28;
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= MAX_ACTIVE) break;
      const p = this.findInactive();
      if (!p) break;
      const angle = (i / count) * Math.PI * 2;
      const speed = rand(2, 5.5);
      this.initParticle(p, 'sparkle', x, y);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.phase = angle;
      this.activeCount++;
    }
  }

  update(deltaTime: number): void {
    const dt = deltaTime / (1000 / 60);
    const cam = this.lastCamera;
    const viewW = this.lastViewWidth;
    const viewH = this.lastViewHeight;

    this.activeCount = 0;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity > 0) {
        p.vy += p.gravity * dt;
      }

      switch (p.type) {
        case 'snow': {
          p.x += Math.sin(p.life * 0.05 + p.phase) * 0.3 * dt;
          break;
        }
        case 'ember': {
          p.x += Math.sin(p.life * 0.12 + p.phase) * 0.2 * dt;
          break;
        }
        case 'firefly': {
          p.x += Math.sin(p.life * 0.04 + p.phase) * 0.25 * dt;
          p.y += Math.cos(p.life * 0.04 + p.phase) * 0.15 * dt;
          break;
        }
        case 'leaf': {
          p.x += Math.sin((p.maxLife - p.life) * 0.08 + p.phase) * 0.6 * dt;
          break;
        }
        case 'dust': {
          p.x += Math.sin(p.life * 0.02 + p.phase) * 0.15 * dt;
          p.y += Math.cos(p.life * 0.02 + p.phase) * 0.1 * dt;
          break;
        }
        case 'debris': {
          if (p.rotation !== undefined && p.rotSpeed !== undefined) {
            p.rotation += p.rotSpeed * dt;
          }
          break;
        }
        case 'weapon_trail': {
          p.vx *= 0.92;
          p.vy *= 0.92;
          break;
        }
      }

      // Recycle rain / snow that leaves the viewport.
      if ((p.type === 'rain' || p.type === 'snow') && viewW > 0 && viewH > 0) {
        if (
          p.y > cam.y + viewH + RENDER_MARGIN ||
          p.x < cam.x - RENDER_MARGIN ||
          p.x > cam.x + viewW + RENDER_MARGIN
        ) {
          p.active = false;
          continue;
        }
      }

      p.alpha = (p.life / p.maxLife) * p.baseAlpha;
      this.activeCount++;
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    this.lastCamera = camera;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const viewW = ctx.canvas.width / dpr;
    const viewH = ctx.canvas.height / dpr;
    this.lastViewWidth = viewW;
    this.lastViewHeight = viewH;

    const left = -RENDER_MARGIN;
    const right = viewW + RENDER_MARGIN;
    const top = -RENDER_MARGIN;
    const bottom = viewH + RENDER_MARGIN;

    ctx.save();

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const screen = worldToScreen(camera, p.x, p.y);
      if (screen.x < left || screen.x > right || screen.y < top || screen.y > bottom) {
        continue;
      }

      const sx = screen.x;
      const sy = screen.y;

      switch (p.type) {
        case 'rain': {
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.radius;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + p.vx * 0.4, sy + p.vy * 0.4);
          ctx.stroke();
          break;
        }
        case 'snow': {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'ember': {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.radius * 3;
          ctx.beginPath();
          ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
        case 'firefly': {
          const flicker = 0.45 + Math.sin(p.life * 0.08 + p.phase) * 0.35;
          ctx.globalAlpha = Math.max(0, p.alpha * flicker);
          const glowRadius = p.radius * 3;
          const glow = safeGradient(ctx, sx, sy, 0, glowRadius);
          glow.addColorStop(0, `rgba(${p.color},0.95)`);
          glow.addColorStop(0.5, `rgba(${p.color},0.45)`);
          glow.addColorStop(1, `rgba(${p.color},0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'leaf': {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          const angle = (p.maxLife - p.life) * 0.12 + p.phase;
          ctx.translate(sx, sy);
          ctx.rotate(angle);
          ctx.fillRect(-p.radius / 2, -p.radius / 2, p.radius, p.radius);
          ctx.rotate(-angle);
          ctx.translate(-sx, -sy);
          break;
        }
        case 'sparkle': {
          const flicker = 0.5 + Math.sin(p.life * 0.4 + p.phase) * 0.45;
          ctx.globalAlpha = Math.max(0, p.alpha * flicker);
          ctx.fillStyle = p.color;
          drawStar(ctx, sx, sy, 4, p.radius, p.radius * 0.4);
          break;
        }
        case 'dust': {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'weapon_trail': {
          ctx.globalAlpha = p.alpha;
          const glow = safeGradient(ctx, sx, sy, 0, p.radius * 3);
          glow.addColorStop(0, p.color);
          glow.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(sx, sy, p.radius * 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'debris': {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          const lifeRatio = p.maxLife > 0 ? p.life / p.maxLife : 0;
          const drawSize = p.radius * 2 * lifeRatio;
          if (p.rotation !== undefined) {
            ctx.translate(sx, sy);
            ctx.rotate(p.rotation);
            ctx.fillRect(-drawSize / 2, -drawSize / 2, drawSize, drawSize);
            ctx.rotate(-p.rotation);
            ctx.translate(-sx, -sy);
          } else {
            ctx.fillRect(sx - drawSize / 2, sy - drawSize / 2, drawSize, drawSize);
          }
          break;
        }
      }
    }

    ctx.restore();
  }
}

export function createParticleSystem(): ParticleSystem {
  return new ParticleSystem();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(rot) * radius;
    const y = cy + Math.sin(rot) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}
