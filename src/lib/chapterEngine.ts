import type { Chapter, Echo, JournalEntry, Mood } from '@/types/game';
import { MOODS } from './moods';
import { generateId } from './id';

function dominantMood(entries: JournalEntry[]): Mood {
  const counts: Record<string, number> = {};
  entries.forEach((e) => {
    counts[e.mood] = (counts[e.mood] || 0) + 1;
  });
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'calm') as Mood;
}

function topTag(entries: JournalEntry[]): string {
  const counts: Record<string, number> = {};
  entries.forEach((e) => {
    e.tags.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '旅途';
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function buildChapters(entries: JournalEntry[]): Chapter[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const chapters: Chapter[] = [];
  let current: JournalEntry[] = [sorted[0]];
  let prevMonth = monthLabel(sorted[0].date);

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i];
    const m = monthLabel(entry.date);
    if (current.length >= 7 || m !== prevMonth) {
      const mood = dominantMood(current);
      const tag = topTag(current);
      chapters.push({
        id: generateId(),
        title: `${MOODS[mood].label}的${tag}`,
        subtitle: `${prevMonth} · ${current.length} 段记忆`,
        startId: current[0].id,
        endId: current[current.length - 1].id,
        entryIds: current.map((e) => e.id),
        themeColor: MOODS[mood].color,
        unlockedAt: Date.now(),
      });
      current = [entry];
      prevMonth = m;
    } else {
      current.push(entry);
    }
  }

  if (current.length > 0) {
    const mood = dominantMood(current);
    const tag = topTag(current);
    chapters.push({
      id: generateId(),
      title: `${MOODS[mood].label}的${tag}`,
      subtitle: `${prevMonth} · ${current.length} 段记忆`,
      startId: current[0].id,
      endId: current[current.length - 1].id,
      entryIds: current.map((e) => e.id),
      themeColor: MOODS[mood].color,
      unlockedAt: Date.now(),
    });
  }

  return chapters;
}

function chapterFromEntryIds(
  base: Chapter,
  entryIds: string[],
  entries: JournalEntry[]
): Chapter {
  const validEntryIds = entryIds.filter((id) => entries.some((e) => e.id === id));
  const chapterEntries = validEntryIds
    .map((id) => entries.find((e) => e.id === id)!)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const mood = chapterEntries.length > 0 ? dominantMood(chapterEntries) : 'calm';
  return {
    ...base,
    entryIds: validEntryIds,
    startId: chapterEntries[0]?.id ?? base.startId,
    endId: chapterEntries[chapterEntries.length - 1]?.id ?? base.endId,
    themeColor: base.themeColor || MOODS[mood].color,
  };
}

/**
 * 将用户手动编辑的章节覆盖合并到自动生成的章节列表中。
 * 手动章节的 entryIds 会覆盖自动生成章节的内容；新增的章节会追加到末尾。
 */
export function mergeManualChapters(
  autoChapters: Chapter[],
  manualChapters: Chapter[],
  entries: JournalEntry[]
): Chapter[] {
  if (manualChapters.length === 0) return autoChapters;

  const manualById = new Map(manualChapters.map((c) => [c.id, c]));
  const result: Chapter[] = [];
  const usedManualIds = new Set<string>();

  for (const auto of autoChapters) {
    const manual = manualById.get(auto.id);
    if (manual) {
      result.push(chapterFromEntryIds(manual, manual.entryIds, entries));
      usedManualIds.add(manual.id);
    } else {
      result.push(auto);
    }
  }

  for (const manual of manualChapters) {
    if (usedManualIds.has(manual.id)) continue;
    result.push(chapterFromEntryIds(manual, manual.entryIds, entries));
  }

  return result;
}

export function buildHiddenChapters(echoes: Echo[], entries: JournalEntry[]): Chapter[] {
  return echoes
    .map((echo) => {
      const entry = entries.find((e) => e.id === echo.entryId);
      if (!entry) return null;

      const related = entries.filter((e) => e.mood === entry.mood).slice(0, 5);
      const chapterEntries = related.length > 1 ? related : [entry];
      const mood = dominantMood(chapterEntries);
      const tag = topTag(chapterEntries);

      return {
        id: echo.unlockedChapterId ?? generateId(),
        title: `${MOODS[mood].label}的低语：${tag}`,
        subtitle: `由幻影解锁 · ${chapterEntries.length} 段隐藏记忆`,
        startId: chapterEntries[0].id,
        endId: chapterEntries[chapterEntries.length - 1].id,
        entryIds: chapterEntries.map((e) => e.id),
        themeColor: MOODS[mood].color,
        unlockedAt: 0,
      };
    })
    .filter(Boolean) as Chapter[];
}
