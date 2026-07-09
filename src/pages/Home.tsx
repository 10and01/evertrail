import { Link } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { ProfileCreator } from '@/components/ProfileCreator';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { EventCard } from '@/components/EventCard';
import { MOODS } from '@/lib/moods';
import { Footprints, Sparkles, Trophy } from 'lucide-react';

export default function Home() {
  const profile = useGameStore((s) => s.profile);
  const entries = useGameStore((s) => s.entries);
  const unlocked = useGameStore((s) => s.unlockedAchievements);
  const initProfile = useGameStore((s) => s.initProfile);

  if (!profile) {
    return <ProfileCreator onCreate={initProfile} />;
  }

  const recent = entries.slice(-3).reverse();
  const moodCounts: Record<string, number> = {};
  entries.forEach((e) => {
    moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  });
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <section className="flex flex-col md:flex-row gap-4">
        <PixelPanel className="flex-1">
          <h2 className="font-display text-2xl text-et-gold mb-1">
            欢迎回来，{profile.nickname}
          </h2>
          <p className="text-sm text-et-muted">"每个人的一生都是一场独特的旅行"</p>
          <div className="flex gap-3 mt-4">
            <Link to="/journal">
              <PixelButton>今日打卡</PixelButton>
            </Link>
            <Link to="/map">
              <PixelButton variant="secondary">查看地图</PixelButton>
            </Link>
          </div>
        </PixelPanel>

        <PixelPanel className="md:w-72 grid grid-cols-2 gap-3">
          <Stat icon={Sparkles} label="等级" value={`Lv.${profile.level}`} />
          <Stat icon={Footprints} label="连续打卡" value={`${profile.streak} 天`} />
          <Stat icon={Trophy} label="成就" value={`${unlocked.length}`} />
          <Stat
            icon={Sparkles}
            label="记录数"
            value={`${entries.length}`}
          />
        </PixelPanel>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <PixelPanel className="md:col-span-2">
          <h3 className="font-display text-lg mb-3">最近旅程</h3>
          {recent.length === 0 ? (
            <p className="text-et-muted text-sm">还没有记录，写下第一段旅程吧。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((entry) => (
                <EventCard key={entry.id} entry={entry} compact />
              ))}
            </div>
          )}
        </PixelPanel>

        <PixelPanel>
          <h3 className="font-display text-lg mb-3">状态</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-et-muted">总里程</span>
              <span className="font-number text-et-gold">{entries.length} 步</span>
            </div>
            <div className="flex justify-between">
              <span className="text-et-muted">当前心情主题</span>
              <span>
                {topMood ? (
                  <>
                    {MOODS[topMood[0] as keyof typeof MOODS].emoji}{' '}
                    {MOODS[topMood[0] as keyof typeof MOODS].label}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-et-muted">经验值</span>
              <span className="font-number">{Math.floor(profile.xp)}</span>
            </div>
          </div>
        </PixelPanel>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <Icon className="w-5 h-5 mx-auto text-et-gold mb-1" />
      <div className="text-xs text-et-muted">{label}</div>
      <div className="font-number text-lg">{value}</div>
    </div>
  );
}
