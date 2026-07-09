import type { Collectible, Inventory } from '@/types/game';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Partial<Record<Collectible['kind'], number>>;
  effect: string;
  duration: number; // 毫秒
  /** 是否必须在记忆熔炉旁才能合成。 */
  requireFurnace?: boolean;
}

export const RECIPES: Record<string, Recipe> = {
  'heart-bridge': {
    id: 'heart-bridge',
    name: '心桥',
    description: '以温暖回忆搭起光桥，跨越眼前的裂隙。',
    ingredients: { heart: 2, book: 1 },
    effect: '在缺口附近按 E 生成临时光桥，持续 15 秒。',
    duration: 15000,
  },
  'star-lantern': {
    id: 'star-lantern',
    name: '星灯',
    description: '引路之星点亮更远的黑暗。',
    ingredients: { star: 2, flame: 1 },
    effect: '扩大光源半径至 180，持续 30 秒。',
    duration: 30000,
  },
  'camera-sight': {
    id: 'camera-sight',
    name: '快照',
    description: '捕捉未收集的回忆碎片方位。',
    ingredients: { camera: 1, gem: 2 },
    effect: '高亮并指向最近未收集物，持续 20 秒。',
    duration: 20000,
  },
  'leaf-shelter': {
    id: 'leaf-shelter',
    name: '避风叶',
    description: '疲惫之境中仍可轻盈前行。',
    ingredients: { leaf: 2, footprint: 1 },
    effect: '抵消 tired 生态的速度惩罚。',
    duration: 0, // 被动永久效果
  },
  'calm-charm': {
    id: 'calm-charm',
    name: '安抚咒',
    description: '让焦躁的阴影暂时平静。',
    ingredients: { heart: 1, star: 1, flame: 1 },
    effect: '释放一圈安抚光芒，让周围空气安静下来。',
    duration: 0, // 即时效果
  },
  'mood-lantern': {
    id: 'mood-lantern',
    name: '情绪灯塔',
    description: '将一束稳定的光芒留在身边。',
    ingredients: { shard: 3, flame: 1 },
    effect: '光源半径扩大至 220，持续 60 秒。',
    duration: 60000,
  },
  'rain-cloak': {
    id: 'rain-cloak',
    name: '雨披',
    description: '忧伤之雾不再拖慢你的脚步。',
    ingredients: { shard: 3, leaf: 2 },
    effect: '永久免疫忧伤之雾的减速与光芒流失。',
    duration: 0, // 被动永久效果
  },
  'echo-whistle': {
    id: 'echo-whistle',
    name: '共鸣笛',
    description: '未诉说的回声会回应这声呼唤。',
    ingredients: { shard: 2, camera: 1 },
    effect: '高亮并指向最近的 Echo，持续 30 秒。',
    duration: 30000,
  },
  'memory-anchor': {
    id: 'memory-anchor',
    name: '记忆锚',
    description: '将此刻的位置锚定在记忆之中。',
    ingredients: { shard: 2, heart: 1 },
    effect: '设置临时重生点，跌落或重进时优先从此处醒来。',
    duration: 0,
    requireFurnace: true,
  },
  'wind-feather': {
    id: 'wind-feather',
    name: '风之羽',
    description: '身体变得轻盈，可以再跃起一次。',
    ingredients: { shard: 3, leaf: 1 },
    effect: '装备饰品：获得二段跳能力。',
    duration: 0,
  },
  'light-core': {
    id: 'light-core',
    name: '光之核',
    description: '一团稳定的光贴在胸口。',
    ingredients: { shard: 2, star: 1, flame: 1 },
    effect: '装备饰品：光源半径扩大 25%。',
    duration: 0,
  },
  'wooden-chair': {
    id: 'wooden-chair',
    name: '木椅',
    description: '用木材制作的简易椅子。',
    ingredients: { wood: 2 },
    effect: '放置装饰',
    duration: 0,
  },
  'wooden-table': {
    id: 'wooden-table',
    name: '木桌',
    description: '用木材制作的小桌子。',
    ingredients: { wood: 3 },
    effect: '放置装饰',
    duration: 0,
  },
  'flower-pot': {
    id: 'flower-pot',
    name: '花盆',
    description: '可以放置植物的花盆。',
    ingredients: { wood: 1, petal: 1 },
    effect: '放置装饰',
    duration: 0,
  },
  'firefly-lamp': {
    id: 'firefly-lamp',
    name: '萤火灯',
    description: '散发柔和光芒的灯具。',
    ingredients: { spore: 2, wood: 1 },
    effect: '扩大光源',
    duration: 0,
  },
  'flower-wreath': {
    id: 'flower-wreath',
    name: '花环',
    description: '用花瓣编织的花环。',
    ingredients: { petal: 3 },
    effect: '装饰/小幅恢复光芒',
    duration: 0,
  },
};

export function countInventoryByKind(inventory: Inventory): Record<Collectible['kind'], number> {
  const counts = {
    book: 0,
    camera: 0,
    footprint: 0,
    heart: 0,
    star: 0,
    leaf: 0,
    flame: 0,
    gem: 0,
    shard: 0,
    wood: 0,
    petal: 0,
    spore: 0,
  };
  for (const item of inventory.items) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }
  return counts;
}

export function canCraft(recipe: Recipe, inventory: Inventory, furnaceNearby = false): boolean {
  if (recipe.requireFurnace && !furnaceNearby) return false;
  const counts = countInventoryByKind(inventory);
  for (const [kind, amount] of Object.entries(recipe.ingredients)) {
    if ((counts[kind as Collectible['kind']] ?? 0) < (amount ?? 0)) return false;
  }
  return true;
}

export function craft(recipe: Recipe, inventory: Inventory, furnaceNearby = false): boolean {
  if (!canCraft(recipe, inventory, furnaceNearby)) return false;
  if (inventory.crafted.includes(recipe.id)) return false;

  const needed: Partial<Record<Collectible['kind'], number>> = {};
  for (const [kind, amount] of Object.entries(recipe.ingredients)) {
    needed[kind as Collectible['kind']] = amount ?? 0;
  }

  inventory.items = inventory.items.filter((item) => {
    const need = needed[item.kind] ?? 0;
    if (need > 0) {
      needed[item.kind] = need - 1;
      return false;
    }
    return true;
  });

  inventory.crafted.push(recipe.id);
  return true;
}

export function hasCrafted(inventory: Inventory, recipeId: string): boolean {
  return inventory.crafted.includes(recipeId);
}

export function getCraftableRecipes(inventory: Inventory, furnaceNearby = false): Recipe[] {
  return Object.values(RECIPES).filter((r) => canCraft(r, inventory, furnaceNearby));
}
