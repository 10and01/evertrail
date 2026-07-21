import type { JournalEntry } from '@/types/game';
import { MOODS } from '@/lib/moods';
import { Star } from 'lucide-react';

interface EventCardProps {
  entry: JournalEntry;
  compact?: boolean;
}

export function EventCard({ entry, compact }: EventCardProps) {
  const mood = MOODS[entry.mood];
  const fullStars = entry.rarity;
  const emptyStars = 5 - fullStars;

  return (
    <div
      className="pixel-panel overflow-hidden"
      style={{ borderColor: mood.color }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: mood.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{mood.emoji}</span>
          <span className="font-display text-sm" style={{ color: mood.color }}>
            {mood.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: fullStars }).map((_, i) => (
            <Star key={`f-${i}`} className="w-3 h-3 fill-et-gold text-et-gold" />
          ))}
          {Array.from({ length: emptyStars }).map((_, i) => (
            <Star key={`e-${i}`} className="w-3 h-3 text-et-muted" />
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="text-xs text-et-muted font-number">{entry.date}</div>
        <div className="flex flex-wrap gap-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${entry.visibility === 'story' ? 'bg-et-gold/15 text-et-gold' : 'bg-white/5 text-et-muted'}`}>
            {entry.visibility === 'story' ? '故事素材' : '仅自己可见'}
          </span>
          {entry.signals?.motifs?.slice(0, 3).map((motif) => <span key={motif} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-et-muted">{motif}</span>)}
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {entry.text}
        </p>
        {entry.image && (
          <img
            src={entry.image}
            alt="memory"
            className="w-full h-40 object-cover border-2 border-et-border"
          />
        )}
        {!compact && (
          <>
            <div className="flex flex-wrap gap-1 pt-1">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-et-panel border border-et-border"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 pt-2 text-xs font-number">
              <StatBox label="活力" value={entry.stats.vitality} />
              <StatBox label="洞察" value={entry.stats.insight} />
              <StatBox label="联结" value={entry.stats.connection} />
              <StatBox label="冒险" value={entry.stats.adventure} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center border border-et-border bg-et-bg py-1">
      <div className="text-et-gold">{value}</div>
      <div className="text-[10px] text-et-muted">{label}</div>
    </div>
  );
}
