import type { House, HouseDecoration, HouseTile, PlayerState } from '@/types/game';
import { TILE_SIZE } from './constants';

export type HouseTool =
  | 'wall'
  | 'floor'
  | 'door'
  | 'window'
  | 'empty'
  | 'chair'
  | 'table'
  | 'lamp'
  | 'rug'
  | 'plant'
  | 'picture-frame'
  | 'portal'
  | 'bookshelf'
  | 'ladder'
  | 'move'
  | 'delete';

export function isHouseBoundary(house: House, gx: number, gy: number): boolean {
  return gx === 0 || gx === house.width - 1 || gy === 0 || gy === house.height - 1;
}

export function getHouseCell(house: House, gx: number, gy: number): HouseTile | undefined {
  return house.floorPlan[gy]?.[gx];
}

export function decorationAt(house: House, gx: number, gy: number): HouseDecoration | undefined {
  return house.decorations.find((d) => d.gx === gx && d.gy === gy);
}

export function canPlaceDecoration(house: House, gx: number, gy: number): boolean {
  const cell = getHouseCell(house, gx, gy);
  return !!cell && cell.type === 'empty' && !decorationAt(house, gx, gy);
}

export function canPlaceWallDecoration(house: House, gx: number, gy: number): boolean {
  const cell = getHouseCell(house, gx, gy);
  return !!cell && cell.type === 'wall' && !decorationAt(house, gx, gy);
}

export function getHouseFloorYs(house: House): number[] {
  const ys: number[] = [];
  for (let gy = 0; gy < house.height; gy++) {
    const row = house.floorPlan[gy];
    if (row && row.some((cell) => cell.type === 'floor')) {
      ys.push(gy);
    }
  }
  return ys.sort((a, b) => a - b);
}

export function canPlacePortal(house: House, gx: number, gy: number): boolean {
  const cell = getHouseCell(house, gx, gy);
  if (!cell) return false;
  if (cell.type !== 'floor' && cell.type !== 'door') return false;
  return !decorationAt(house, gx, gy);
}

export function canPlaceLadder(house: House, gx: number, gy: number): boolean {
  const cell = getHouseCell(house, gx, gy);
  if (!cell) return false;
  if (cell.type !== 'empty' && cell.type !== 'floor') return false;
  return !decorationAt(house, gx, gy);
}

export function getLadderAt(house: House, player: PlayerState): HouseDecoration | undefined {
  return house.decorations.find((d) => {
    if (d.kind !== 'ladder') return false;
    const x = house.x + d.gx * TILE_SIZE;
    const y = house.y + d.gy * TILE_SIZE;
    return (
      player.x < x + TILE_SIZE &&
      player.x + player.width > x &&
      player.y < y + TILE_SIZE &&
      player.y + player.height > y
    );
  });
}

export function findHouseCraftingTable(
  house: House | undefined,
  player: PlayerState
): HouseDecoration | undefined {
  if (!house) return undefined;
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  return house.decorations.find((d) => {
    if (d.kind !== 'crafting-table') return false;
    const cx = house.x + d.gx * TILE_SIZE + TILE_SIZE / 2;
    const cy = house.y + d.gy * TILE_SIZE + TILE_SIZE / 2;
    return Math.hypot(px - cx, py - cy) < TILE_SIZE * 1.5;
  });
}

export function findNearestHouseInteraction(
  house: House,
  player: PlayerState
): { type: 'door' | 'window' | 'decoration'; gx: number; gy: number; deco?: HouseDecoration } | null {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  const threshold = TILE_SIZE * 1.3;
  let best: { type: 'door' | 'window' | 'decoration'; gx: number; gy: number; deco?: HouseDecoration; dist: number } | null = null;

  for (let gy = 0; gy < house.height; gy++) {
    const row = house.floorPlan[gy];
    if (!row) continue;
    for (let gx = 0; gx < house.width; gx++) {
      const cell = row[gx];
      if (!cell || (cell.type !== 'door' && cell.type !== 'window')) continue;
      const cx = house.x + gx * TILE_SIZE + TILE_SIZE / 2;
      const cy = house.y + gy * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < threshold && (!best || dist < best.dist)) {
        best = { type: cell.type, gx, gy, dist };
      }
    }
  }

  for (const deco of house.decorations) {
    const cx = house.x + deco.gx * TILE_SIZE + TILE_SIZE / 2;
    const cy = house.y + deco.gy * TILE_SIZE + TILE_SIZE / 2;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < threshold && (!best || dist < best.dist)) {
      best = { type: 'decoration', gx: deco.gx, gy: deco.gy, deco, dist };
    }
  }

  if (!best) return null;
  return { type: best.type, gx: best.gx, gy: best.gy, deco: best.deco };
}

export function canMoveDecorationTo(house: House, deco: HouseDecoration, gx: number, gy: number): boolean {
  if (gx < 0 || gx >= house.width || gy < 0 || gy >= house.height) return false;
  if (gx === deco.gx && gy === deco.gy) return true;
  const target = decorationAt(house, gx, gy);
  if (target && target.id !== deco.id) return false;
  const cell = getHouseCell(house, gx, gy);
  if (!cell) return false;
  switch (deco.kind) {
    case 'lamp':
    case 'picture-frame':
      return cell.type === 'wall';
    case 'bookshelf':
    case 'chair':
    case 'table':
    case 'rug':
    case 'plant':
    case 'crafting-table':
      return cell.type === 'empty' || cell.type === 'floor';
    case 'ladder':
      return canPlaceLadder(house, gx, gy);
    default:
      return false;
  }
}

export function applyHouseEdit(
  house: House,
  gx: number,
  gy: number,
  tool: HouseTool,
  onPictureFrame: (pos: { gx: number; gy: number }) => void
): boolean {
  if (gx < 0 || gx >= house.width || gy < 0 || gy >= house.height) return false;

  // 删除工具：移除任意格子上的装饰或结构（墙壁/边界除外）。
  if (tool === 'delete') {
    const cell = getHouseCell(house, gx, gy);
    if (cell?.type === 'wall') return false;
    if (isHouseBoundary(house, gx, gy)) return false;
    const existing = decorationAt(house, gx, gy);
    if (existing) {
      house.decorations = house.decorations.filter((d) => !(d.gx === gx && d.gy === gy));
      return true;
    }
    if (cell && cell.type !== 'empty') {
      house.floorPlan[gy][gx] = { type: 'empty', playerPlaced: true };
      return true;
    }
    return false;
  }

  if (tool === 'wall' || tool === 'floor' || tool === 'door' || tool === 'window' || tool === 'empty') {
    const cell = getHouseCell(house, gx, gy);
    // 墙壁作为背景，不可被编辑/移除；边界也不可删除为空。
    if (cell?.type === 'wall') return false;
    if (tool === 'empty' && isHouseBoundary(house, gx, gy)) return false;
    house.floorPlan[gy][gx] = { type: tool, playerPlaced: true };
    return true;
  }

  if (tool === 'portal') {
    if (!canPlacePortal(house, gx, gy)) return false;
    house.portal = { gx, gy };
    return true;
  }

  if (tool === 'picture-frame') {
    const existing = decorationAt(house, gx, gy);
    if (existing && existing.kind === 'picture-frame') {
      house.decorations = house.decorations.filter((d) => !(d.gx === gx && d.gy === gy));
      return true;
    }
    if (!canPlaceDecoration(house, gx, gy) && !canPlaceWallDecoration(house, gx, gy)) {
      return false;
    }
    onPictureFrame({ gx, gy });
    return true;
  }

  if (tool === 'move') {
    // 移动工具在拖拽逻辑中处理，点击本身不执行任何放置/删除。
    return false;
  }

  // 装饰工具：chair/table/lamp/rug/plant/bookshelf/ladder
  const existing = decorationAt(house, gx, gy);
  if (existing) {
    house.decorations = house.decorations.filter((d) => !(d.gx === gx && d.gy === gy));
    return true;
  }

  if (tool === 'bookshelf') {
    const cell = getHouseCell(house, gx, gy);
    if (!cell || (cell.type !== 'empty' && cell.type !== 'floor') || decorationAt(house, gx, gy)) {
      return false;
    }
    house.decorations.push({ id: `house-${tool}-${Date.now()}`, kind: tool, gx, gy });
    return true;
  }

  if (tool === 'lamp') {
    const cell = getHouseCell(house, gx, gy);
    if (!cell || (cell.type !== 'empty' && cell.type !== 'wall') || decorationAt(house, gx, gy)) {
      return false;
    }
    house.decorations.push({ id: `house-${tool}-${Date.now()}`, kind: tool, gx, gy });
    return true;
  }

  if (tool === 'ladder') {
    if (!canPlaceLadder(house, gx, gy)) return false;
    house.decorations.push({ id: `house-${tool}-${Date.now()}`, kind: tool, gx, gy });
    return true;
  }

  if (!canPlaceDecoration(house, gx, gy)) return false;
  house.decorations.push({ id: `house-${tool}-${Date.now()}`, kind: tool, gx, gy });
  return true;
}
