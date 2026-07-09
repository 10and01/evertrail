import type { AchievementDef, GameState } from '@/types/game';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'seven-days',
    name: '七日行者',
    description: '连续记录 7 天',
    icon: 'Footprints',
    condition: (s) => (s.profile?.streak || 0) >= 7,
  },
  {
    id: 'mood-variety',
    name: '百味人生',
    description: '使用过 6 种不同心情',
    icon: 'Palette',
    condition: (s) => new Set(s.entries.map((e) => e.mood)).size >= 6,
  },
  {
    id: 'photo-traveler',
    name: '光影旅人',
    description: '记录中包含 10 张图片',
    icon: 'Camera',
    condition: (s) => s.entries.filter((e) => e.image).length >= 10,
  },
  {
    id: 'epic-story',
    name: '长篇史诗',
    description: '单条记录超过 200 字',
    icon: 'Scroll',
    condition: (s) => s.entries.some((e) => e.text.length > 200),
  },
  {
    id: 'tag-collector',
    name: '标签收集者',
    description: '使用过 20 个不同标签',
    icon: 'BookOpen',
    condition: (s) => new Set(s.entries.flatMap((e) => e.tags)).size >= 20,
  },
  {
    id: 'heart-guardian',
    name: '心之守护者',
    description: '一个月内每天记录',
    icon: 'Heart',
    condition: (s) => (s.profile?.streak || 0) >= 30,
  },
  {
    id: 'storyteller',
    name: '故事讲述者',
    description: '导出过一次分享包',
    icon: 'Feather',
    condition: () => false, // set externally on export
  },
  {
    id: 'first-echo',
    name: '初闻回响',
    description: '与第一个幻影对话',
    icon: 'MessageCircle',
    condition: (s) => s.talkedEchoIds.length >= 1,
  },
  {
    id: 'echo-whisperer',
    name: '回响低语者',
    description: '与 5 个幻影对话',
    icon: 'MessagesSquare',
    condition: (s) => s.talkedEchoIds.length >= 5,
  },
  {
    id: 'hidden-chapter',
    name: '隐秘章节',
    description: '解锁一个隐藏章节',
    icon: 'BookMarked',
    condition: (s) => s.unlockedHiddenChapterIds.length >= 1,
  },
];

export function checkAchievements(state: GameState): string[] {
  return ACHIEVEMENTS.filter((a) => !state.unlockedAchievements.includes(a.id) && a.condition(state)).map(
    (a) => a.id
  );
}
