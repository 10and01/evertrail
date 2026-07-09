import { useGameStore } from '@/store/useGameStore';
import { AchievementBadge } from '@/components/AchievementBadge';
import { ACHIEVEMENTS } from '@/lib/achievementEngine';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { MOODS } from '@/lib/moods';
import { BarChart3, BookOpen, Calendar, Sparkles } from 'lucide-react';

export default function Growth() {
  const profile = useGameStore((s) => s.profile);
  const entries = useGameStore((s) => s.entries);
  const unlocked = useGameStore((s) => s.unlockedAchievements);

  if (!profile) return null;

  const totalWords = entries.reduce((sum, e) => sum + e.text.length, 0);
  const avgWords = entries.length ? Math.round(totalWords / entries.length) : 0;
  const moodCounts: Record<string, number> = {};
  entries.forEach((e) => {
    moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h2 className="font-display text-2xl text-et-gold">成长与成就</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Sparkles} label="等级" value={`Lv.${profile.level}`} />
        <StatCard icon={BookOpen} label="记录数" value={`${entries.length}`} />
        <StatCard icon={BarChart3} label="总字数" value={`${totalWords}`} />
        <StatCard icon={Calendar} label="平均字数" value={`${avgWords}`} />
      </div>

      <PixelPanel>
        <h3 className="font-display text-lg mb-3">心情分布</h3>
        {Object.keys(moodCounts).length === 0 ? (
          <p className="text-et-muted text-sm">暂无数据</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(moodCounts).map(([mood, count]) => {
              const config = MOODS[mood as keyof typeof MOODS];
              return (
                <div
                  key={mood}
                  className="flex items-center gap-2 px-3 py-1 border-2"
                  style={{ borderColor: config.color, color: config.color }}
                >
                  <span>{config.emoji}</span>
                  <span className="font-number text-lg">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </PixelPanel>

      <PixelPanel>
        <h3 className="font-display text-lg mb-3">徽章墙</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => (
            <AchievementBadge
              key={a.id}
              achievement={a}
              unlocked={unlocked.includes(a.id)}
            />
          ))}
        </div>
      </PixelPanel>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <PixelPanel className="text-center">
      <Icon className="w-6 h-6 mx-auto text-et-gold mb-2" />
      <div className="text-xs text-et-muted">{label}</div>
      <div className="font-number text-2xl">{value}</div>
    </PixelPanel>
  );
}
