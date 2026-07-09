import {
  BookOpen,
  Camera,
  Feather,
  Footprints,
  Heart,
  Palette,
  Scroll,
  type LucideIcon,
} from 'lucide-react';
import type { AchievementDef } from '@/types/game';

const ICON_MAP: Record<string, LucideIcon> = {
  Footprints,
  Palette,
  Camera,
  Scroll,
  BookOpen,
  Heart,
  Feather,
};

interface AchievementBadgeProps {
  achievement: AchievementDef;
  unlocked: boolean;
}

export function AchievementBadge({ achievement, unlocked }: AchievementBadgeProps) {
  const Icon = ICON_MAP[achievement.icon] || Footprints;
  return (
    <div
      className={`pixel-panel p-3 text-center ${
        unlocked ? '' : 'opacity-50 grayscale'
      }`}
    >
      <div className="flex justify-center mb-2">
        <Icon className="w-8 h-8 text-et-gold" />
      </div>
      <div className="font-display text-sm">{achievement.name}</div>
      <div className="text-xs text-et-muted mt-1">{achievement.description}</div>
    </div>
  );
}
