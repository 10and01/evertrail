import type { CameraState, House } from '@/types/game';
import { TILE_SIZE } from './constants';

export class HouseRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    house: House | undefined,
    camera: CameraState,
    time: number,
    editMode = false
  ) {
    if (!house) return;

    const sx = house.x - camera.x;
    const sy = house.y - camera.y;
    const s = TILE_SIZE;
    const cx = sx + (house.width * s) / 2;
    const cy = sy + (house.height * s) / 2;

    ctx.save();

    // 编辑模式下高亮小屋外框。
    if (editMode) {
      ctx.strokeStyle = 'rgba(255,215,0,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sx - 4, sy - 4, house.width * s + 8, house.height * s + 8);
      ctx.setLineDash([]);
    }

    // 在地图上用一个统一的“家门”标记表示小屋，避免再画一个完整房屋造成“两种房屋”的观感。
    const pulse = 1 + Math.sin(time / 300) * 0.08;
    const size = 14 * pulse;

    // 门柱发光
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 2.5);
    glow.addColorStop(0, 'rgba(255,200,100,0.35)');
    glow.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 门扇
    ctx.fillStyle = 'rgba(120,80,50,0.9)';
    ctx.fillRect(cx - size / 2, cy - size, size, size * 1.6);
    ctx.fillStyle = 'rgba(212,175,55,0.8)';
    ctx.fillRect(cx - size / 2, cy - size, size, 2);
    ctx.fillStyle = 'rgba(255,220,160,0.9)';
    ctx.beginPath();
    ctx.arc(cx + size / 4, cy - size / 3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 标签
    ctx.fillStyle = 'rgba(255,245,220,0.9)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText('家', cx, cy + size * 0.8);
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
