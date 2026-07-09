import type { BiomeKey, CameraState, House, PlayerState, Tile } from '@/types/game';
import type { LightSource } from './LightingSystem';
import type { PostProcessEffect } from './PostProcessor';
import { BackgroundSystem } from './ParallaxBackground';
import { TileRenderer } from './TileRenderer';
import { EntityRenderer } from './EntityRenderer';
import { HouseRenderer } from './HouseRenderer';
import { ParticleSystem } from './ParticleSystem';
import { LightingSystem } from './LightingSystem';
import { PostProcessSystem } from './PostProcessor';
import { Entity } from './Entity';
import { getTilesInRange } from './World';
import { getBlendedPalette, getDayNightFactor } from './BiomeRenderer';

export interface Camera {
  x: number;
  y: number;
  zoom?: number;
}

export interface RenderWorld {
  tiles: Tile[];
  platforms: Tile[];
  minX: number;
  maxX: number;
  groundY: number;
}

/**
 * 管线内部使用的游戏状态（对应需求中的 GameState 接口）。
 */
export interface GameState {
  player: PlayerState | null;
  world: RenderWorld;
  camera: Camera;
  time: number;
}

export interface RenderGameState extends GameState {
  biome: BiomeKey;
  blendBiome?: BiomeKey;
  biomeBlend?: number;
  entities: Entity[];
  lights: LightSource[];
  activeEffects: PostProcessEffect[];
  reduceMotion?: boolean;
  lightingQuality?: 'low' | 'high';
  house?: House;
  houseEditMode?: boolean;
  hour?: number;
}

const AMBIENT_COLOR = 'rgb(15,25,50)';

export class RenderPipeline {
  private houseRenderer = new HouseRenderer();

  constructor(
    private backgroundSystem: BackgroundSystem,
    private tileRenderer: TileRenderer,
    private entityRenderer: EntityRenderer,
    private particleSystem: ParticleSystem,
    private lightingSystem: LightingSystem,
    private postProcessSystem: PostProcessSystem
  ) {}

  /**
   * 按固定顺序渲染一帧：
   * 1. 清空画布
   * 2. 视差背景
   * 3. 背景墙装饰
   * 4. 液体层（预留）
   * 5. 前景方块
   * 6. 实体 / NPC
   * 7. 粒子
   * 8. 光照叠加（multiply）
   * 9. 后期处理
   * 10. UI（通过 drawUI 回调）
   */
  render(
    ctx: CanvasRenderingContext2D,
    state: RenderGameState,
    viewWidth: number,
    viewHeight: number,
    drawUI?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
    onBeforeUI?: (ctx: CanvasRenderingContext2D) => void
  ) {
    const { camera, world, biome, blendBiome, biomeBlend, time, entities, lights, activeEffects, reduceMotion, lightingQuality, house, houseEditMode, hour } = state;
    const currentHour = hour ?? 12;
    const { brightness } = getDayNightFactor(currentHour);

    ctx.clearRect(0, 0, viewWidth, viewHeight);

    // 2. 视差背景（支持生态混合与昼夜循环）。
    this.backgroundSystem.render(
      ctx,
      camera as CameraState,
      viewWidth,
      viewHeight,
      time,
      biome,
      blendBiome,
      biomeBlend ?? 0,
      reduceMotion,
      currentHour
    );

    // 视口内方块，带 200px 缓冲裁剪。
    const visibleTiles = getTilesInRange(world.tiles, camera.x, camera.y, viewWidth, viewHeight);

    // 3. 背景墙 / 装饰层。
    this.tileRenderer.drawDecorations(
      ctx,
      visibleTiles,
      camera as CameraState,
      viewWidth,
      viewHeight
    );

    // 4. 液体层。
    this.renderLiquids(ctx, visibleTiles, camera, viewWidth, viewHeight, biome, blendBiome, biomeBlend ?? 0, time);

    // 5. 前景方块（生态边界顶层混合）。
    this.tileRenderer.draw(
      ctx,
      visibleTiles,
      camera as CameraState,
      viewWidth,
      viewHeight,
      biome,
      blendBiome,
      biomeBlend ?? 0,
      time
    );

    // 5.5 玩家小屋装饰与传送门。
    this.houseRenderer.draw(ctx, house, camera as CameraState, time, houseEditMode);

    // 6. 实体 / NPC（含阴影）。
    this.entityRenderer.render(ctx, camera as CameraState, time, viewWidth, viewHeight, entities);

    // 7. 粒子。
    this.particleSystem.render(ctx, camera as CameraState);

    // 8. 光照叠加（multiply 混合），根据昼夜亮度调整环境遮罩强度。
    this.lightingSystem.resize(viewWidth, viewHeight);
    const ambientIntensity = 0.25 + 0.7 * (1 - brightness);
    this.lightingSystem.apply(ctx, AMBIENT_COLOR, lights, lightingQuality, ambientIntensity);

    // 9. 后期处理。
    this.postProcessSystem.render(ctx, viewWidth, viewHeight, activeEffects);

    // 10. 世界层额外绘制（如临时传送门），在 UI 之前渲染。
    onBeforeUI?.(ctx);

    // 11. UI。
    drawUI?.(ctx, viewWidth, viewHeight);
  }

  private renderLiquids(
    ctx: CanvasRenderingContext2D,
    tiles: Tile[],
    camera: Camera,
    viewWidth: number,
    viewHeight: number,
    biome: BiomeKey,
    blendBiome?: BiomeKey,
    blendT = 0,
    time = 0
  ) {
    const palette = getBlendedPalette(biome, blendBiome ?? biome, blendT);
    const waterColor = palette.water ?? '#3c096c';
    const lavaBase = '#d9381e';
    const lavaGlow = '#ff9d00';
    const surfaceOffset = Math.sin(time / 700) * 2;

    ctx.save();
    for (const tile of tiles) {
      if (tile.type !== 'water' && tile.type !== 'lava') continue;
      const isLava = tile.type === 'lava' || (tile.type === 'water' && tile.y > 850);
      const sx = tile.x - camera.x;
      const sy = tile.y - camera.y;
      if (sx + 32 < 0 || sx > viewWidth || sy + 32 < 0 || sy > viewHeight) continue;

      if (isLava) {
        // 岩浆微光：径向渐变模拟热源。
        const glow = ctx.createRadialGradient(sx + 16, sy + 16, 4, sx + 16, sy + 16, 28);
        glow.addColorStop(0, 'rgba(255, 120, 40, 0.35)');
        glow.addColorStop(1, 'rgba(255, 60, 20, 0)');
        ctx.fillStyle = glow;
        ctx.globalAlpha = 1;
        ctx.fillRect(sx - 12, sy - 12, 56, 56);

        ctx.fillStyle = lavaBase;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(sx, sy, 32, 32);

        ctx.fillStyle = lavaGlow;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(sx + 8, sy + 8, 16, 16);
      } else {
        ctx.fillStyle = waterColor;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(sx, sy, 32, 32);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.22;
        ctx.fillRect(sx, sy + 26 + surfaceOffset, 32, 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
