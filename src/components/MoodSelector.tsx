import { MOODS, MOOD_LIST } from '@/lib/moods';
import type { Mood } from '@/types/game';
import { cn } from '@/lib/utils';

interface MoodSelectorProps {
  value: Mood;
  onChange: (mood: Mood) => void;
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOOD_LIST.map((mood) => {
        const config = MOODS[mood];
        const active = value === mood;
        return (
          <button
            key={mood}
            type="button"
            onClick={() => onChange(mood)}
            className={cn(
              'flex items-center gap-1 px-3 py-2 border-2 transition-all',
              active ? 'scale-105' : 'opacity-70 hover:opacity-100'
            )}
            style={{
              borderColor: config.color,
              background: active ? config.bg : 'transparent',
              color: config.color,
            }}
          >
            <span>{config.emoji}</span>
            <span className="text-sm font-display">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
