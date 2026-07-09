import type { JournalEntry, Mood, SoulStats } from '@/types/game';
import { MOODS } from './moods';
import { TAG_STATS } from './tags';

const BASE_STATS: SoulStats = {
  vitality: 1,
  insight: 1,
  connection: 1,
  adventure: 1,
};

function clamp(n: number, min = 1, max = 10): number {
  return Math.max(min, Math.min(max, n));
}

export function computeRarity(text: string, hasImage: boolean, tagCount: number, mood: Mood): number {
  const moodScore = MOODS[mood].intensity * 0.5;
  const lengthScore = Math.min(text.length / 80, 2);
  const imageScore = hasImage ? 1 : 0;
  const tagScore = tagCount * 0.3;
  const raw = 1 + Math.floor(lengthScore + imageScore + tagScore + moodScore);
  return clamp(raw, 1, 5);
}

export function computeStats(text: string, tags: string[], mood: Mood): SoulStats {
  const stats: SoulStats = { ...BASE_STATS };

  const moodStats = MOODS[mood].stats;
  if (moodStats) {
    (Object.keys(moodStats) as (keyof SoulStats)[]).forEach((key) => {
      stats[key] += moodStats[key] ?? 0;
    });
  }

  tags.forEach((tag) => {
    const tagStats = TAG_STATS[tag];
    if (tagStats) {
      (Object.keys(tagStats) as (keyof SoulStats)[]).forEach((key) => {
        stats[key] += tagStats[key] ?? 0;
      });
    } else {
      stats.insight += 1;
    }
  });

  if (text.length > 200) stats.insight += 1;
  if (text.length > 50) stats.connection += 1;

  return {
    vitality: clamp(stats.vitality),
    insight: clamp(stats.insight),
    connection: clamp(stats.connection),
    adventure: clamp(stats.adventure),
  };
}

export function xpForEntry(entry: JournalEntry): number {
  return 10 + entry.rarity * 5 + entry.text.length / 20;
}
