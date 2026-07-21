import type { BiomeKey, BiomePalette, CameraState } from '@/types/game';
import { getBlendedPalette, getSkyColors, getDayNightFactor } from './BiomeRenderer';

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
}

interface Nebula {
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface ParallaxLayer {
  parallaxFactor: number;
  scrollSpeed: number;
  baseY: number;
  draw: (ctx: CanvasRenderingContext2D, camera: CameraState, time: number, viewWidth: number, viewHeight: number) => void;
}

export function generateMountain(x: number): number {
  return (
    Math.sin(x * 0.005) * 40 +
    Math.sin(x * 0.02) * 20 +
    Math.sin(x * 0.05) * 10
  );
}

export class BackgroundSystem {
  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private nebulas: Nebula[] = [];
  private shootingStars: ShootingStar[] = [];
  private layers: ParallaxLayer[] = [];
  private initialized = false;
  private lastViewWidth = 0;
  private lastViewHeight = 0;
  private lastPaletteKey = '';

  // 静态星星层离屏缓存。
  private starCanvas?: HTMLCanvasElement;
  private starCtx?: CanvasRenderingContext2D;

  private init(viewWidth: number, viewHeight: number) {
    if (this.initialized) return;
    this.initialized = true;

    const starCount = 100 + Math.floor(Math.random() * 101);
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * viewWidth * 3,
        y: Math.random() * viewHeight * 0.65,
        size: Math.random() * 1.4 + 0.5,
        alpha: 0.4 + Math.random() * 0.5,
      });
    }

    for (let i = 0; i < 14; i++) {
      this.clouds.push({
        x: Math.random() * viewWidth * 4,
        y: Math.random() * viewHeight * 0.35 + 20,
        w: 90 + Math.random() * 180,
        h: 22 + Math.random() * 38,
        speed: 3 + Math.random() * 10,
        alpha: 0.06 + Math.random() * 0.12,
      });
    }

    const nebulaColors = ['#4a3f72', '#1a3b5c', '#2d1a4a', '#1a4a3a'];
    for (let i = 0; i < 5; i++) {
      this.nebulas.push({
        x: Math.random() * viewWidth * 3,
        y: Math.random() * viewHeight * 0.4,
        r: 80 + Math.random() * 150,
        color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
        alpha: 0.08 + Math.random() * 0.12,
      });
    }

    this.buildStarCache(viewWidth, viewHeight);
  }

  private resize(viewWidth: number, viewHeight: number, palette: BiomePalette) {
    const paletteKey = `${palette.skyTop}:${palette.groundDeep}:${palette.groundBody}:${palette.groundTop}`;
    if (this.lastViewWidth === viewWidth && this.lastViewHeight === viewHeight && this.lastPaletteKey === paletteKey) return;
    this.lastViewWidth = viewWidth;
    this.lastViewHeight = viewHeight;
    this.lastPaletteKey = paletteKey;

    this.layers = [
      this.createStarLayer(viewWidth),
      this.createNebulaLayer(viewWidth),
      this.createMountainLayer(viewWidth, viewHeight, palette.groundDeep, 0.1, viewHeight * 0.72),
      this.createMountainLayer(viewWidth, viewHeight, palette.groundBody, 0.25, viewHeight * 0.8),
      this.createMistLayer(viewWidth, viewHeight, 0.35),
      this.createMountainLayer(viewWidth, viewHeight, palette.groundTop, 0.4, viewHeight * 0.88),
    ];

    this.buildStarCache(viewWidth, viewHeight);
  }

  private buildStarCache(viewWidth: number, viewHeight: number) {
    const width = viewWidth * 3;
    const height = Math.ceil(viewHeight * 0.65);
    if (!this.starCanvas) {
      this.starCanvas = document.createElement('canvas');
      const ctx = this.starCanvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) return;
      this.starCtx = ctx;
    }
    this.starCanvas.width = width;
    this.starCanvas.height = height;

    const ctx = this.starCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  private createStarLayer(viewWidth: number): ParallaxLayer {
    return {
      parallaxFactor: 0.02,
      scrollSpeed: 0,
      baseY: 0,
      draw: (ctx, camera) => {
        if (!this.starCanvas) return;
        const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
        const starWrap = viewWidth * 3;
        let starOffset = -(safeCameraX * 0.02) % starWrap;
        if (starOffset > 0) starOffset -= starWrap;

        ctx.save();
        ctx.translate(starOffset, 0);
        ctx.drawImage(this.starCanvas, 0, 0);
        ctx.restore();
      },
    };
  }

  private createNebulaLayer(viewWidth: number): ParallaxLayer {
    return {
      parallaxFactor: 0.03,
      scrollSpeed: 0,
      baseY: 0,
      draw: (ctx, camera) => {
        const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
        const wrap = viewWidth * 3;
        let offset = -(safeCameraX * 0.03) % wrap;
        if (offset > 0) offset -= wrap;

        ctx.save();
        ctx.translate(offset, 0);
        for (const nebula of this.nebulas) {
          const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
          gradient.addColorStop(0, nebula.color + Math.floor(nebula.alpha * 60).toString(16).padStart(2, '0'));
          gradient.addColorStop(1, nebula.color + '00');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(nebula.x, nebula.y, nebula.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };
  }

  private createMistLayer(viewWidth: number, viewHeight: number, parallaxFactor: number): ParallaxLayer {
    return {
      parallaxFactor,
      scrollSpeed: 0,
      baseY: 0,
      draw: (ctx, camera, time) => {
        const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
        const wrap = viewWidth * 2;
        let offset = -(safeCameraX * parallaxFactor + time * 0.005) % wrap;
        if (offset > 0) offset -= wrap;

        ctx.save();
        ctx.translate(offset, 0);
        ctx.fillStyle = 'rgba(200,210,230,0.08)';
        for (let x = 0; x <= viewWidth * 2; x += 80) {
          const h = 20 + Math.sin(x * 0.02 + time * 0.001) * 10;
          const y = viewHeight * 0.75 + Math.sin(x * 0.01) * 15;
          ctx.beginPath();
          ctx.ellipse(x, y, 60, h, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };
  }

  private createMountainLayer(
    viewWidth: number,
    viewHeight: number,
    color: string,
    parallaxFactor: number,
    baseY: number
  ): ParallaxLayer {
    return {
      parallaxFactor,
      scrollSpeed: 0,
      baseY,
      draw: (ctx, camera) => {
        const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
        const wrap = viewWidth * 2;
        let offset = -(safeCameraX * parallaxFactor) % wrap;
        if (offset > 0) offset -= wrap;

        ctx.save();
        ctx.translate(offset, 0);
        ctx.fillStyle = color;
        ctx.globalAlpha = parallaxFactor < 0.25 ? 0.7 : 0.95;
        ctx.beginPath();
        ctx.moveTo(0, viewHeight);

        const step = 4;
        for (let x = 0; x <= viewWidth * 2 + step; x += step) {
          const y = baseY + generateMountain(x);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(viewWidth * 2, viewHeight);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      },
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    viewWidth: number,
    viewHeight: number,
    time: number,
    biome: BiomeKey = 'calm',
    blendBiome?: BiomeKey,
    blendT = 0,
    reduceMotion = false,
    hour = 12
  ) {
    this.drawBackground(ctx, camera, viewWidth, viewHeight, time, biome, blendBiome, blendT, reduceMotion, hour);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    _biome: string | null | undefined,
    viewWidth: number,
    viewHeight: number,
    time: number,
    biome: BiomeKey = 'calm',
    blendBiome?: BiomeKey,
    blendT = 0,
    reduceMotion = false,
    hour = 12
  ) {
    this.drawBackground(ctx, camera, viewWidth, viewHeight, time, biome, blendBiome, blendT, reduceMotion, hour);
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    viewWidth: number,
    viewHeight: number,
    time: number,
    biome: BiomeKey = 'calm',
    blendBiome?: BiomeKey,
    blendT = 0,
    reduceMotion = false,
    hour = 12
  ) {
    this.init(viewWidth, viewHeight);
    const palette = getBlendedPalette(biome, blendBiome ?? biome, blendT);
    this.resize(viewWidth, viewHeight, palette);
    const skyColors = getSkyColors(biome, hour);
    const { isNight } = getDayNightFactor(hour);

    // Layer 0 - sky gradient (vertical) with horizontal night tint.
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, viewHeight);
    sky.addColorStop(0, skyColors.top);
    sky.addColorStop(1, skyColors.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    if (isNight) {
      const horizonTint = ctx.createLinearGradient(0, 0, viewWidth, 0);
      horizonTint.addColorStop(0, 'rgba(30,15,50,0.25)');
      horizonTint.addColorStop(0.5, 'rgba(60,40,90,0.12)');
      horizonTint.addColorStop(1, 'rgba(40,55,80,0.22)');
      ctx.fillStyle = horizonTint;
      ctx.fillRect(0, 0, viewWidth, viewHeight * 0.7);
    }
    ctx.restore();

    // 夜晚额外绘制星星。
    if (isNight) {
      const staticCamera = reduceMotion ? { ...camera, x: 0 } : camera;
      const starLayer = this.layers[0];
      if (starLayer) {
        ctx.save();
        starLayer.draw(ctx, staticCamera, time, viewWidth, viewHeight);
        ctx.restore();
      }
    }

    // Celestial body (sun/moon) with glow.
    this.drawCelestialBody(ctx, camera, viewWidth, viewHeight, palette, hour);

    // Parallax layers from far to near (skip star/nebula layers during day).
    const staticCamera = reduceMotion ? { ...camera, x: 0 } : camera;
    const startLayer = isNight ? 1 : 2;
    for (let i = startLayer; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer) continue;
      ctx.save();
      layer.draw(ctx, staticCamera, time, viewWidth, viewHeight);
      ctx.restore();
    }

    // 夜晚在最前景云层之前绘制流星。
    if (isNight && !reduceMotion) {
      this.drawShootingStars(ctx, camera, viewWidth, viewHeight);
    }

    // Clouds drift independently (夜晚减少可见度），可能遮挡月亮。
    if (!reduceMotion) {
      this.drawClouds(ctx, camera, viewWidth, time, isNight, true);
    }

    // Biome fog overlay.
    if (palette.fog) {
      ctx.save();
      ctx.fillStyle = palette.fog;
      ctx.globalAlpha = isNight ? 0.25 : 0.5;
      ctx.fillRect(0, viewHeight * 0.55, viewWidth, viewHeight * 0.45);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  private drawCelestialBody(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    viewWidth: number,
    viewHeight: number,
    palette: BiomePalette,
    hour: number
  ) {
    const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
    const { isNight } = getDayNightFactor(hour);
    // 天体沿水平弧线移动：6 点从左侧升起，18 点从右侧落下。
    const t = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    const orbitRadiusX = viewWidth * 0.4;
    const orbitRadiusY = viewHeight * 0.32;
    let cx = viewWidth / 2 + Math.cos(t) * orbitRadiusX - (safeCameraX * 0.01) % viewWidth;
    const cy = viewHeight * 0.78 + Math.sin(t) * orbitRadiusY;
    if (cx < -60) cx += viewWidth;
    if (cx > viewWidth + 60) cx -= viewWidth;

    ctx.save();
    if (isNight) {
      const moonGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 80);
      moonGlow.addColorStop(0, palette.accent + 'F2');
      moonGlow.addColorStop(0.25, palette.accent + '59');
      moonGlow.addColorStop(1, palette.accent + '00');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(230,240,255,0.98)';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sunGlow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 56);
      sunGlow.addColorStop(0, palette.accent);
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,240,200,0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawClouds(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    viewWidth: number,
    time: number,
    isNight = false,
    canOccludeMoon = false
  ) {
    const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;
    const cloudWrap = viewWidth * 4;

    ctx.save();
    ctx.globalCompositeOperation = canOccludeMoon ? 'source-over' : 'lighter';
    for (const cloud of this.clouds) {
      let cx = (cloud.x - safeCameraX * 0.04 - time * 0.008 * cloud.speed) % cloudWrap;
      if (cx > viewWidth + cloud.w) cx -= cloudWrap;
      if (cx < -cloud.w * 2) cx += cloudWrap;
      const alpha = cloud.alpha * (isNight ? 0.45 : 1);
      ctx.fillStyle = `rgba(${isNight ? '160,170,190' : '255,255,255'},${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // 云层底部略暗，增加体积感。
      ctx.fillStyle = `rgba(${isNight ? '100,110,130' : '200,200,210'},${alpha * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(cx + cloud.w * 0.05, cloud.y + cloud.h * 0.15, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawShootingStars(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    viewWidth: number,
    viewHeight: number
  ) {
    const safeCameraX = Number.isFinite(camera.x) ? camera.x : 0;

    // 随机生成新流星。
    if (Math.random() < 0.008) {
      this.shootingStars.push({
        x: Math.random() * viewWidth + safeCameraX * 0.02,
        y: Math.random() * viewHeight * 0.35,
        vx: -4 - Math.random() * 4,
        vy: 2 + Math.random() * 2,
        life: 30 + Math.random() * 30,
        maxLife: 60,
      });
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    const remaining: ShootingStar[] = [];
    for (const star of this.shootingStars) {
      star.x += star.vx;
      star.y += star.vy;
      star.life--;
      if (star.life > 0) {
        remaining.push(star);
        const alpha = Math.min(1, star.life / 15);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(star.x - safeCameraX * 0.02, star.y);
        ctx.lineTo(star.x - safeCameraX * 0.02 - star.vx * 4, star.y - star.vy * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.shootingStars = remaining;
  }
}

export class ParallaxBackground extends BackgroundSystem {}
