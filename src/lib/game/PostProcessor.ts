export type PostProcessEffect = 'vignette' | 'night-tint' | 'underground-tint' | 'blood-moon' | 'critical-vignette';

interface TintConfig {
  style: string;
  alpha: number;
}

const TINTS: Record<Exclude<PostProcessEffect, 'vignette' | 'critical-vignette'>, TintConfig> = {
  'night-tint': { style: 'rgb(80,120,200)', alpha: 0.06 },
  'underground-tint': { style: 'rgb(50,42,26)', alpha: 0.18 },
  'blood-moon': { style: 'rgb(200,50,50)', alpha: 0.08 },
};

export function resolveActiveEffects(input: {
  playerY: number;
  cameraBottom: number;
  groundY: number;
  biome: string;
  light: number;
  bloodMoon?: boolean;
}): PostProcessEffect[] {
  const effects: PostProcessEffect[] = ['vignette', 'night-tint'];

  const underground =
    input.playerY > input.groundY + 120 || input.cameraBottom > input.groundY + 180;
  if (underground) {
    effects.push('underground-tint');
  }

  if (input.bloodMoon || input.biome === 'angry') {
    effects.push('blood-moon');
  }

  if (input.light <= 0) {
    effects.push('critical-vignette');
  }

  return effects;
}

export class PostProcessSystem {
  /**
   * 直接在主画布上叠加后期处理效果。
   * 不使用额外离屏 canvas，只通过 fillRect 覆盖。
   */
  render(
    ctx: CanvasRenderingContext2D,
    viewWidth: number,
    viewHeight: number,
    activeEffects: PostProcessEffect[],
    scanlines = false
  ) {
    if (activeEffects.length === 0 && !scanlines) return;

    const cx = Number.isFinite(viewWidth) ? viewWidth / 2 : 0;
    const cy = Number.isFinite(viewHeight) ? viewHeight / 2 : 0;

    ctx.save();

    // 色调覆盖：使用 globalAlpha 控制透明度。
    for (const effect of activeEffects) {
      if (effect === 'vignette') continue;
      const tint = TINTS[effect];
      if (!tint) continue;
      ctx.globalAlpha = tint.alpha;
      ctx.fillStyle = tint.style;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    }

    // 暗角：中心透明，边缘半透明黑。
    if (activeEffects.includes('vignette')) {
      ctx.globalAlpha = 1;
      const innerR = viewHeight * 0.35;
      const outerR = viewHeight * 0.85;
      const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.6, 'rgba(0,0,0,0.12)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    }

    // 光芒枯竭暗红晕影。
    if (activeEffects.includes('critical-vignette')) {
      ctx.globalAlpha = 1;
      const innerR = viewHeight * 0.25;
      const outerR = viewHeight * 0.75;
      const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      gradient.addColorStop(0, 'rgba(80,0,0,0)');
      gradient.addColorStop(0.5, 'rgba(120,0,0,0.2)');
      gradient.addColorStop(1, 'rgba(180,0,0,0.55)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    }

    // 扫描线：每 2px 一条 1px 高的半透明黑线。
    if (scanlines) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let y = 0; y < viewHeight; y += 2) {
        ctx.fillRect(0, y, viewWidth, 1);
      }
    }

    ctx.restore();
  }
}
