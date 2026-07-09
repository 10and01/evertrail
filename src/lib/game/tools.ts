import type { Collectible, Mood, PlayerState, Tile, PlantState } from '@/types/game';
import type { ParticleSystem } from './ParticleSystem';
import { TILE_SIZE } from './constants';
import { tileAt } from './World';

const TOOL_RANGE = TILE_SIZE * 2.2;
const TOOL_COOLDOWN_MS = 250;

const ENERGY_COSTS: Record<Mood, number> = {
  joy: 8,
  sad: 8,
  angry: 12,
  anxious: 15,
  calm: 10,
  tired: 10,
};

export interface ToolResult {
  consumed: boolean;
  destroyedTile?: Tile;
  spawnedCollectible?: Collectible;
  message?: string;
}

export interface ToolContext {
  tiles: Tile[];
  particles?: ParticleSystem;
  deltaTime: number;
  onDropCollectible?: (c: Collectible) => void;
  /** 鼠标/触摸指向的世界坐标。未提供时按玩家面向水平瞄准。 */
  aimWorldX?: number;
  aimWorldY?: number;
}

function isSolidTile(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.solid && !tile.destroyed;
}

function canDigTile(tile: Tile | undefined): tile is Tile {
  if (!isSolidTile(tile)) return false;
  if (tile.type === 'water' || tile.type === 'lava' || tile.type === 'platform' || tile.type === 'raincurtain') return false;
  if (tile.destructible === false) return false;
  return true;
}

function getTileAtGrid(tiles: Tile[], tx: number, ty: number): Tile | undefined {
  return tileAt(tiles, tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
}

function findTargetTile(player: PlayerState, context: ToolContext): Tile | undefined {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  const footTy = Math.floor((player.y + player.height) / TILE_SIZE);
  const centerTx = Math.floor(px / TILE_SIZE);
  const centerTy = Math.floor(py / TILE_SIZE);

  // 工具只能作用于玩家周围 8 邻域内的瓦片，禁止隔空挖掘。
  const dir = player.facingRight ? 1 : -1;
  const candidates: { tx: number; ty: number }[] = [];

  // 若提供鼠标/触摸瞄准，优先尝试该网格方向，但仍受相邻限制。
  if (context.aimWorldX !== undefined && context.aimWorldY !== undefined) {
    const dx = context.aimWorldX - px;
    const dy = context.aimWorldY - py;
    if (Math.hypot(dx, dy) <= TOOL_RANGE) {
      candidates.push({
        tx: Math.floor(context.aimWorldX / TILE_SIZE),
        ty: Math.floor(context.aimWorldY / TILE_SIZE),
      });
    }
  }

  // 面向（水平）优先，其次脚下、头顶、身后，确保向下挖掘可用。
  candidates.push(
    { tx: centerTx + dir, ty: centerTy },
    { tx: centerTx, ty: footTy + 1 },
    { tx: centerTx, ty: centerTy - 1 },
    { tx: centerTx - dir, ty: centerTy },
    { tx: centerTx + dir, ty: footTy + 1 },
    { tx: centerTx - dir, ty: footTy + 1 },
    { tx: centerTx + dir, ty: centerTy - 1 },
    { tx: centerTx - dir, ty: centerTy - 1 }
  );

  const seen = new Set<string>();
  for (const c of candidates) {
    const key = `${c.tx},${c.ty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // 玩家中心高于脚底，正下方实际相隔两格，需要放宽一格；其余方向保持 8 邻域。
    const dx = c.tx - centerTx;
    const dy = c.ty - centerTy;
    if (Math.abs(dx) > 1 || dy < -1 || dy > (dx === 0 ? 2 : 1)) continue;
    const tile = getTileAtGrid(context.tiles, c.tx, c.ty);
    if (tile && canDigTile(tile)) return tile;
  }
  return undefined;
}

function spawnShardAt(tile: Tile): Collectible {
  return {
    id: `shard-${tile.x}-${tile.y}-${Date.now()}`,
    x: tile.x + TILE_SIZE / 2 - 7,
    y: tile.y - TILE_SIZE / 2 - 7,
    width: 14,
    height: 14,
    kind: 'shard',
    label: '情绪碎片',
    collected: false,
    floatOffset: Math.random() * Math.PI * 2,
    autoCollect: true,
  };
}

const TREE_PLANTS: PlantState['kind'][] = ['tree', 'deadTree', 'cactus'];
const FLOWER_PLANTS: PlantState['kind'][] = ['flower', 'mushroom'];

export function canHarvestPlant(tile: Tile | undefined): boolean {
  return !!tile && !!tile.plant && tile.plant.stage === 'full';
}

export function harvestPlant(tile: Tile, form: Mood): Collectible | undefined {
  const plant = tile.plant;
  if (!plant || plant.stage !== 'full') return undefined;

  const isTree = TREE_PLANTS.includes(plant.kind);
  const isFlower = FLOWER_PLANTS.includes(plant.kind);

  // 砍树：joy / tired；摘花：sad / calm。
  if (isTree && !['joy', 'tired'].includes(form)) return undefined;
  if (isFlower && !['sad', 'calm'].includes(form)) return undefined;

  // 树被砍后应当完全消失（连所在格一起清空），不留下树桩也不会再生。
  if (isTree) {
    tile.plant = undefined;
    tile.decoration = undefined;
    tile.type = 'gap';
    tile.solid = false;
    tile.destructible = false;
    tile.destroyed = true;
  } else {
    // 花朵/蘑菇仅移除装饰与植物状态，保留地面。
    tile.plant = undefined;
    tile.decoration = undefined;
  }

  const kind: Collectible['kind'] = isTree ? 'wood' : plant.kind === 'mushroom' ? 'spore' : 'petal';
  const label = isTree ? '木材' : plant.kind === 'mushroom' ? '孢子' : '花瓣';

  return {
    id: `plant-drop-${tile.x}-${tile.y}-${Date.now()}`,
    x: tile.x + TILE_SIZE / 2 - 7,
    y: tile.y - TILE_SIZE / 2 - 7,
    width: 14,
    height: 14,
    kind,
    label,
    collected: false,
    floatOffset: Math.random() * Math.PI * 2,
    autoCollect: true,
  };
}

export function getToolName(form: Mood): string {
  switch (form) {
    case 'joy':
      return '光镐';
    case 'sad':
      return '雨铲';
    case 'angry':
      return '碎岩锤';
    case 'anxious':
      return '相位铲';
    case 'calm':
      return '安抚杖';
    case 'tired':
      return '扎根杖';
    default:
      return '工具';
  }
}

export function getToolDesc(form: Mood): string {
  switch (form) {
    case 'joy':
      return '挖掘泥土、草地与石块';
    case 'sad':
      return '排干水体或消散雨幕';
    case 'angry':
      return '击碎岩石与脆岩，碎石向周围飞溅';
    case 'anxious':
      return '相位穿透一堵墙';
    case 'calm':
      return '按 T 释放安抚光芒，不采摘植物';
    case 'tired':
      return '在空处生成临时根须平台';
    default:
      return '';
  }
}

function destroyTile(tile: Tile): void {
  tile.solid = false;
  tile.destructible = false;
  tile.type = 'gap';
  tile.decoration = undefined;
  tile.destroyed = true;
}

function digJoy(player: PlayerState, target: Tile, context: ToolContext): ToolResult {
  if (!canDigTile(target)) return { consumed: false };
  if (!['grass', 'dirt', 'stone', 'sand', 'mud', 'ash', 'mycelium'].includes(target.type)) {
    return { consumed: false };
  }

  destroyTile(target);
  player.toolEnergy = Math.max(0, player.toolEnergy - ENERGY_COSTS.joy);

  const shard = spawnShardAt(target);
  context.onDropCollectible?.(shard);

  const px = target.x + TILE_SIZE / 2;
  const py = target.y + TILE_SIZE / 2;
  context.particles?.emit('debris', px, py, 6);
  context.particles?.emit('sparkle', px, py, 4);

  return { consumed: true, destroyedTile: target, spawnedCollectible: shard };
}

function digSad(player: PlayerState, target: Tile, context: ToolContext): ToolResult {
  player.toolEnergy = Math.max(0, player.toolEnergy - ENERGY_COSTS.sad);
  const px = target.x + TILE_SIZE / 2;
  const py = target.y + TILE_SIZE / 2;

  if (target.type === 'water') {
    target.type = 'gap';
    target.solid = false;
    context.particles?.emit('rain', px, py, 10);
    return { consumed: true, message: '雨铲排开了水流' };
  }

  if (target.type === 'raincurtain') {
    destroyTile(target);
    context.particles?.emit('rain', px, py, 8);
    return { consumed: true, message: '雨幕在你面前散开' };
  }

  // 尝试在缺口中引水（仅当下方有实体时）。
  if (target.type === 'gap') {
    const below = tileAt(context.tiles, target.x + TILE_SIZE / 2, target.y + TILE_SIZE * 1.5);
    if (below && below.solid) {
      target.type = 'water';
      target.solid = false;
      context.particles?.emit('rain', px, py, 10);
      return { consumed: true, message: '雨铲引来一缕积水' };
    }
  }

  return { consumed: false };
}

function digAngry(player: PlayerState, target: Tile, context: ToolContext): ToolResult {
  // 愤怒工具：可以粉碎目标可挖掘方块，并震裂周围的脆岩。
  const targetDiggable = canDigTile(target);
  const targetBrittle = target.type === 'brittle' && target.solid && !target.destroyed;
  if (!targetDiggable && !targetBrittle) return { consumed: false };

  player.toolEnergy = Math.max(0, player.toolEnergy - ENERGY_COSTS.angry);
  let destroyed = 0;

  // 若目标是普通可挖掘方块，直接粉碎它。
  if (targetDiggable && target.type !== 'brittle') {
    destroyTile(target);
    destroyed++;
    const px = target.x + TILE_SIZE / 2;
    const py = target.y + TILE_SIZE / 2;
    context.particles?.emit('ember', px, py, 6);
    context.particles?.emit('debris', px, py, 4);
    const shard = spawnShardAt(target);
    context.onDropCollectible?.(shard);
  }

  // 同时震裂范围内的脆岩。
  for (const tile of context.tiles) {
    if (tile.type !== 'brittle' || tile.destroyed) continue;
    const dist = Math.hypot(tile.x - target.x, tile.y - target.y);
    if (dist <= TILE_SIZE * 2.5) {
      destroyTile(tile);
      destroyed++;
      const px = tile.x + TILE_SIZE / 2;
      const py = tile.y + TILE_SIZE / 2;
      context.particles?.emit('ember', px, py, 6);
      context.particles?.emit('debris', px, py, 4);
      const shard = spawnShardAt(tile);
      context.onDropCollectible?.(shard);
    }
  }

  if (destroyed > 0) {
    return { consumed: true, message: `碎岩锤震裂了 ${destroyed} 块岩石` };
  }
  return { consumed: false };
}

function digAnxious(player: PlayerState, target: Tile, context: ToolContext): ToolResult {
  if (!isSolidTile(target)) return { consumed: false };
  if (target.destructible === false) return { consumed: false };

  destroyTile(target);
  player.toolEnergy = Math.max(0, player.toolEnergy - ENERGY_COSTS.anxious);

  const px = target.x + TILE_SIZE / 2;
  const py = target.y + TILE_SIZE / 2;
  context.particles?.emit('dust', px, py, 10);
  context.particles?.emit('sparkle', px, py, 6);

  return { consumed: true, destroyedTile: target };
}

function digCalm(player: PlayerState, _target: Tile, context: ToolContext): ToolResult {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  player.toolEnergy = Math.max(0, player.toolEnergy - ENERGY_COSTS.calm);
  context.particles?.emit('firefly', px, py, 12);
  context.particles?.emit('sparkle', px, py, 8);
  return { consumed: true, message: '安抚杖让空气平静下来' };
}

function digTired(player: PlayerState, target: Tile, context: ToolContext): ToolResult {
  // 扎根杖：在缺口/水体/平台位置生成长达 10 秒的临时木平台。
  if (target.type !== 'gap' && target.type !== 'water' && target.type !== 'platform') {
    return { consumed: false };
  }

  player.toolEnergy = Math.max(0, player.toolEnergy - ENERGY_COSTS.tired);

  if (target.type !== 'platform') {
    target.type = 'platform';
    target.solid = true;
    target.biome = 'tired';
    target.destructible = false;
    target.destroyed = false;
  }

  const px = target.x + TILE_SIZE / 2;
  const py = target.y + TILE_SIZE / 2;
  context.particles?.emit('leaf', px, py, 8);

  return { consumed: true, destroyedTile: target, message: '根须 platform 为你托起片刻安宁' };
}

export function canUseTool(form: Mood): { ok: boolean; reason?: string } {
  // 所有情绪都应当拥有可用的工具，愤怒也不例外。
  // form 保留作为公共 API 参数，供未来按情绪禁用工具时使用。
  void form;
  return { ok: true };
}

export function applyTool(
  player: PlayerState,
  form: Mood,
  context: ToolContext,
  lastUseTime: number,
  time: number
): ToolResult {
  if (time - lastUseTime < TOOL_COOLDOWN_MS) return { consumed: false };
  const usability = canUseTool(form);
  if (!usability.ok) {
    return { consumed: false, message: usability.reason };
  }
  const cost = ENERGY_COSTS[form];
  if (player.toolEnergy < cost) return { consumed: false };

  const target = findTargetTile(player, context);
  if (!target) return { consumed: false };

  // 工具键（T）只执行当前情绪对应的工具，不再采摘植物；
  // 采摘植物统一由交互键（E）处理，避免平静安抚与采摘冲突。
  switch (form) {
    case 'joy':
      return digJoy(player, target, context);
    case 'sad':
      return digSad(player, target, context);
    case 'angry':
      return digAngry(player, target, context);
    case 'anxious':
      return digAnxious(player, target, context);
    case 'calm':
      return digCalm(player, target, context);
    case 'tired':
      return digTired(player, target, context);
    default:
      return { consumed: false };
  }
}

export function regenToolEnergy(player: PlayerState, deltaTime: number): void {
  if (player.toolEnergy >= 100) return;
  // 每秒恢复 4 点工具能量。
  player.toolEnergy = Math.min(100, player.toolEnergy + (4 * deltaTime) / 1000);
}
