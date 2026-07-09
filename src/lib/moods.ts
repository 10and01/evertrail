import type { Mood, SoulStats } from '@/types/game';

export interface MoodConfig {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  intensity: number;
  stats: Partial<SoulStats>;
}

export const MOODS: Record<Mood, MoodConfig> = {
  joy: {
    label: '开心',
    emoji: '☀️',
    color: '#ffd700',
    bg: '#3d3a1a',
    intensity: 2,
    stats: { vitality: 2, adventure: 1 },
  },
  calm: {
    label: '平静',
    emoji: '🍃',
    color: '#87ceeb',
    bg: '#1a2f35',
    intensity: 1,
    stats: { insight: 2 },
  },
  sad: {
    label: '难过',
    emoji: '🌧️',
    color: '#6a5acd',
    bg: '#221a33',
    intensity: 2,
    stats: { insight: 2, connection: 1 },
  },
  angry: {
    label: '愤怒',
    emoji: '🔥',
    color: '#ff4500',
    bg: '#33150a',
    intensity: 3,
    stats: { vitality: 2, insight: 1 },
  },
  tired: {
    label: '疲惫',
    emoji: '🌙',
    color: '#a0a0a0',
    bg: '#2a2a2a',
    intensity: 1,
    stats: { insight: 1 },
  },
  anxious: {
    label: '焦虑',
    emoji: '⚡',
    color: '#ff8c00',
    bg: '#33200a',
    intensity: 2,
    stats: { insight: 2, adventure: 1 },
  },
};

export const MOOD_LIST: Mood[] = ['joy', 'calm', 'sad', 'angry', 'tired', 'anxious'];
