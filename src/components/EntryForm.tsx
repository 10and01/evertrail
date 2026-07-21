import { useMemo, useState } from 'react';
import type { JournalEntry, Mood } from '@/types/game';
import { computeRarity, computeStats } from '@/lib/cardGenerator';
import { PixelButton } from '@/components/ui/PixelButton';
import { MoodSelector } from './MoodSelector';
import { TagInput } from './TagInput';
import { EventCard } from './EventCard';
import { DEFAULT_NARRATIVE_SIGNALS } from '@/types/narrative';
import type { EntryVisibility } from '@/types/narrative';
import { compressImageFile } from '@/lib/assets';
import { LIFE_STAGE_LABELS, type LifeStage } from '@/types/life';

interface EntryFormProps {
  initial?: JournalEntry | null;
  onSubmit: (entry: Omit<JournalEntry, 'id' | 'stats' | 'rarity' | 'createdAt' | 'updatedAt'>) => void;
  onCancel?: () => void;
}

export function EntryForm({ initial, onSubmit, onCancel }: EntryFormProps) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [text, setText] = useState(initial?.text || '');
  const [mood, setMood] = useState<Mood>(initial?.mood || 'joy');
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [image, setImage] = useState<string | undefined>(initial?.image);
  const [visibility, setVisibility] = useState<EntryVisibility>(initial?.visibility || 'private');
  const [personalMeaning, setPersonalMeaning] = useState(initial?.personalMeaning || '');
  const [signals, setSignals] = useState({ ...DEFAULT_NARRATIVE_SIGNALS, ...(initial?.signals || {}) });
  const [imageError, setImageError] = useState('');

  const preview = useMemo(() => {
    const stats = computeStats(text, tags, mood);
    const rarity = computeRarity(text, !!image, tags.length, mood);
    return {
      id: 'preview',
      date,
      text,
      mood,
      tags,
      image,
      stats,
      rarity,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      visibility,
      personalMeaning,
      signals,
    } as JournalEntry;
  }, [date, text, mood, tags, image, visibility, personalMeaning, signals]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    try {
      setImage(await compressImageFile(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : '图片处理失败');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit({
      date,
      text: text.trim(),
      mood,
      tags,
      image,
      visibility,
      personalMeaning: personalMeaning.trim(),
      signals,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-et-muted mb-1">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-et-muted mb-1">今天发生了什么？</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="写几句话，让这段旅程留下脚印..."
              className="w-full resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-et-muted mb-1">心情</label>
            <MoodSelector value={mood} onChange={setMood} />
          </div>
          <div>
            <label className="block text-sm text-et-muted mb-1">标签</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <div>
            <label className="block text-sm text-et-muted mb-1">图片（可选，自动压缩）</label>
            <input type="file" accept="image/*" onChange={handleImage} className="w-full" />
            {imageError && <p className="mt-1 text-xs text-red-300">{imageError}</p>}
          </div>
          <div className="narrative-fields">
            <div>
              <label className="block text-sm text-et-muted mb-1">这件事对你意味着什么？</label>
              <textarea
                value={personalMeaning}
                onChange={(event) => setPersonalMeaning(event.target.value)}
                rows={3}
                placeholder="只写给自己，除非你主动把它加入作品"
                className="w-full resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-et-muted">
                当时的能量 · {signals.energy}/5
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={signals.energy}
                  onChange={(event) => setSignals((current) => ({
                    ...current,
                    energy: Number(event.target.value) as 1 | 2 | 3 | 4 | 5,
                  }))}
                  className="mt-2 w-full"
                />
              </label>
              <label className="text-sm text-et-muted">
                地点
                <input
                  value={signals.location}
                  onChange={(event) => setSignals((current) => ({ ...current, location: event.target.value }))}
                  placeholder="家、车站、海边…"
                  className="mt-1 w-full"
                />
              </label>
            </div>
            <label className="text-sm text-et-muted">
              这段记忆属于哪个人生阶段？
              <select
                value={signals.lifeStage}
                onChange={(event) => setSignals((current) => ({ ...current, lifeStage: event.target.value as LifeStage }))}
                className="mt-1 w-full"
              >
                {Object.entries(LIFE_STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div>
              <label className="block text-sm text-et-muted mb-1">出现的人</label>
              <TagInput
                tags={signals.people}
                onChange={(people) => setSignals((current) => ({ ...current, people }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-et-muted">
                想带走的成长意图
                <input
                  value={signals.growthIntent}
                  onChange={(event) => setSignals((current) => ({ ...current, growthIntent: event.target.value }))}
                  placeholder="勇敢、告别、重新开始…"
                  className="mt-1 w-full"
                />
              </label>
              <label className="text-sm text-et-muted">
                这段经历靠近哪个价值？
                <TagInput tags={signals.values} onChange={(values) => setSignals((current) => ({ ...current, values }))} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-et-muted mb-1">记得的物件</label>
                <TagInput tags={signals.objects} onChange={(objects) => setSignals((current) => ({ ...current, objects }))} />
              </div>
              <div>
                <label className="block text-sm text-et-muted mb-1">画面意象</label>
                <TagInput tags={signals.motifs} onChange={(motifs) => setSignals((current) => ({ ...current, motifs }))} />
              </div>
            </div>
            <fieldset>
              <legend className="text-sm text-et-muted mb-2">公开边界</legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['private', '仅自己可见', '不会进入作品导出'],
                  ['story', '可作为故事素材', '仍需在工坊中主动选择'],
                ] as const).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVisibility(value)}
                    className={`privacy-choice ${visibility === value ? 'is-active' : ''}`}
                  >
                    <strong>{label}</strong>
                    <span>{hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm text-et-muted">事件卡预览</label>
          <EventCard entry={preview} />
        </div>
      </div>
      <div className="flex gap-3">
        <PixelButton type="submit" className="flex-1">
          {initial ? '保存修改' : '记录今日'}
        </PixelButton>
        {onCancel && (
          <PixelButton type="button" variant="secondary" onClick={onCancel}>
            取消
          </PixelButton>
        )}
      </div>
    </form>
  );
}
