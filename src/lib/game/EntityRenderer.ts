import type { CameraState } from '@/types/game';
import { RENDER_MARGIN } from './constants';
import { Entity } from './Entity';

export class EntityRenderer {
  /**
   * 统一渲染实体：先绘制阴影，再绘制本体，带视口裁剪。
   */
  render(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    time: number,
    viewWidth: number,
    viewHeight: number,
    entities: Entity[],
    margin = RENDER_MARGIN
  ) {
    const left = camera.x - margin;
    const right = camera.x + viewWidth + margin;
    const top = camera.y - margin;
    const bottom = camera.y + viewHeight + margin;

    const visible: Entity[] = [];
    const simple: Entity[] = [];
    const shadowBlur: Entity[] = [];

    for (const e of entities) {
      if (e.x + e.width < left || e.x > right || e.y + e.height < top || e.y > bottom) {
        continue;
      }
      visible.push(e);
      if (e.usesShadowBlur) {
        shadowBlur.push(e);
      } else {
        simple.push(e);
      }
    }

    // 阴影优先，统一批次。
    ctx.save();
    for (const e of visible) {
      e.drawShadow(ctx, camera);
    }
    ctx.restore();

    // 不使用 shadowBlur 的简单实体先批量绘制。
    for (const e of simple) {
      ctx.save();
      e.draw(ctx, camera, time);
      ctx.restore();
    }

    // 使用 shadowBlur 的实体后批量绘制，减少状态切换。
    for (const e of shadowBlur) {
      ctx.save();
      e.draw(ctx, camera, time);
      ctx.restore();
    }
  }
}
