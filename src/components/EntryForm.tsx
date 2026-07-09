import { useMemo, useState } from 'react';
import type { JournalEntry, Mood } from '@/types/game';
import { computeRarity, computeStats } from '@/lib/cardGenerator';
import { PixelButton } from '@/components/ui/PixelButton';
import { MoodSelector } from './MoodSelector';
import { TagInput } from './TagInput';
import { EventCard } from './EventCard';

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
    } as JournalEntry;
  }, [date, text, mood, tags, image]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('图片大小不能超过 1MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit({ date, text: text.trim(), mood, tags, image });
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
            <label className="block text-sm text-et-muted mb-1">图片（可选，限 1MB）</label>
            <input type="file" accept="image/*" onChange={handleImage} className="w-full" />
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
