export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
}

export class LightingSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('无法创建光照离屏画布');
    this.ctx = ctx;
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  apply(
    targetCtx: CanvasRenderingContext2D,
    ambientColor: string,
    lights: LightSource[],
    quality: 'low' | 'high' = 'high',
    ambientIntensity = 1
  ) {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = ambientColor;
    ctx.globalAlpha = Math.max(0, Math.min(1, ambientIntensity));
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    const largeThreshold = Math.max(width, height) * 0.75;

    for (const light of lights) {
      if (
        !Number.isFinite(light.x) ||
        !Number.isFinite(light.y) ||
        !Number.isFinite(light.radius)
      ) {
        continue;
      }

      // 光源视口裁剪。
      if (
        light.x < -light.radius ||
        light.x > width + light.radius ||
        light.y < -light.radius ||
        light.y > height + light.radius
      ) {
        continue;
      }

      const rgb = light.color.split(',').map((v) => Number(v.trim()));
      if (rgb.length !== 3 || rgb.some((v) => Number.isNaN(v))) continue;
      const [r, g, b] = rgb;

      // 超大半径光源（如月亮）改为全屏环境叠加，避免逐像素径向渐变。
      if (light.radius >= largeThreshold) {
        ctx.fillStyle = `rgba(${r},${g},${b},${light.intensity * 0.3})`;
        ctx.fillRect(0, 0, width, height);
        continue;
      }

      if (quality === 'low') {
        ctx.fillStyle = `rgba(${r},${g},${b},${light.intensity * 0.35})`;
        ctx.beginPath();
        ctx.arc(light.x, light.y, light.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const gradient = ctx.createRadialGradient(
          light.x,
          light.y,
          0,
          light.x,
          light.y,
          light.radius
        );
        gradient.addColorStop(0, `rgba(${r},${g},${b},${light.intensity})`);
        gradient.addColorStop(0.35, `rgba(${r},${g},${b},${light.intensity * 0.45})`);
        gradient.addColorStop(0.7, `rgba(${r},${g},${b},${light.intensity * 0.12})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    targetCtx.save();
    targetCtx.globalCompositeOperation = 'multiply';
    targetCtx.drawImage(this.canvas, 0, 0);
    targetCtx.restore();
  }
}
