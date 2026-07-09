import type { SoulStats } from '@/types/game';

export const TAG_STATS: Record<string, Partial<SoulStats>> = {
  运动: { vitality: 2 },
  户外: { vitality: 1, adventure: 1 },
  健康: { vitality: 1, insight: 1 },
  学习: { insight: 2 },
  工作: { insight: 1 },
  反思: { insight: 2 },
  创作: { insight: 1, vitality: 1 },
  家庭: { connection: 2 },
  朋友: { connection: 1, adventure: 1 },
  爱情: { connection: 2 },
  旅行: { adventure: 2 },
  挑战: { adventure: 2, vitality: 1 },
  美食: { vitality: 1, connection: 1 },
  游戏: { adventure: 1, insight: 1 },
  电影: { insight: 1, connection: 1 },
  音乐: { insight: 1, vitality: 1 },
};

export const DEFAULT_TAGS = Object.keys(TAG_STATS);
