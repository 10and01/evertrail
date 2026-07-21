import type { JournalEntry } from '@/types/game';
import type {
  EvertrailStoryPackageV1,
  NarrativeSignals,
  PublishedStoryEntry,
  StoryProject,
  StoryScene,
  ThemeProfile,
} from '@/types/narrative';
import { DEFAULT_NARRATIVE_SIGNALS, DEFAULT_THEME_PROFILE } from '@/types/narrative';
import { generateId } from './id';

const MOTIF_RULES: Array<{ motif: string; terms: string[] }> = [
  { motif: '雨', terms: ['雨', '潮湿', '伞', '水滴'] },
  { motif: '植物', terms: ['树', '花', '草', '森林', '叶'] },
  { motif: '星光', terms: ['星', '夜空', '月亮', '宇宙'] },
  { motif: '车站', terms: ['车站', '地铁', '火车', '出发'] },
  { motif: '海', terms: ['海', '浪', '沙滩', '潮汐'] },
  { motif: '灯火', terms: ['灯', '烛光', '城市', '霓虹'] },
];

export function normalizeSignals(entry: Pick<JournalEntry, 'text' | 'tags' | 'signals'>): NarrativeSignals {
  const current = entry.signals ?? DEFAULT_NARRATIVE_SIGNALS;
  const haystack = `${entry.text} ${entry.tags.join(' ')}`.toLowerCase();
  const suggested = MOTIF_RULES.filter((rule) =>
    rule.terms.some((term) => haystack.includes(term.toLowerCase()))
  ).map((rule) => rule.motif);
  return {
    ...DEFAULT_NARRATIVE_SIGNALS,
    ...current,
    motifs: Array.from(new Set([...(current.motifs ?? []), ...suggested])).slice(0, 6),
  };
}

export function createSceneFromEntry(entry: JournalEntry): StoryScene {
  const firstLine = entry.text.split(/\n|。|！|？/).find(Boolean)?.trim() || '一段记忆';
  return {
    id: generateId(),
    entryId: entry.id,
    title: firstLine.slice(0, 22),
    excerpt: entry.text.slice(0, 180),
    narration: '',
    includeImage: Boolean(entry.image),
    transition: entry.mood === 'joy' ? 'light' : entry.mood === 'calm' ? 'drift' : 'fade',
    layout: entry.image ? 'landscape' : 'letter',
    duration: 8,
  };
}

export function createStoryProject(
  title: string,
  entries: JournalEntry[],
  theme: ThemeProfile = DEFAULT_THEME_PROFILE
): StoryProject {
  const scenes = entries.filter((entry) => entry.visibility === 'story').map(createSceneFromEntry);
  const now = Date.now();
  return {
    id: generateId(),
    title: title.trim() || '未命名旅程',
    subtitle: '一段由真实生活生长出的旅程',
    description: '',
    scenes,
    sceneIds: scenes.map((scene) => scene.id),
    theme: { ...DEFAULT_THEME_PROFILE, ...theme },
    endingNote: '故事仍在继续。',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildStoryPackage(
  project: StoryProject,
  entries: JournalEntry[]
): EvertrailStoryPackageV1 {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const publishedEntries: PublishedStoryEntry[] = project.scenes.flatMap((scene) => {
    const entry = entryMap.get(scene.entryId);
    if (!entry || entry.visibility !== 'story') return [];
    return [{
      id: entry.id,
      date: entry.date,
      mood: entry.mood,
      title: scene.title,
      excerpt: scene.excerpt,
      narration: scene.narration,
      motifs: normalizeSignals(entry).motifs,
      image: scene.includeImage ? entry.image : undefined,
    }];
  });
  return {
    format: 'evertrail-story',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      ...project,
      scenes: project.scenes.map((scene) => ({ ...scene })),
    },
    entries: publishedEntries,
  };
}

export function collectMotifs(entries: JournalEntry[]): Array<{ motif: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const motif of normalizeSignals(entry).motifs) {
      counts.set(motif, (counts.get(motif) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([motif, count]) => ({ motif, count })).sort((a, b) => b.count - a.count);
}
