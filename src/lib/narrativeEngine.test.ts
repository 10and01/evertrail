import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '@/types/game';
import { DEFAULT_THEME_PROFILE } from '@/types/narrative';
import { buildStoryPackage, createStoryProject, normalizeSignals } from './narrativeEngine';

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1', date: '2026-07-11', text: '我在雨里的车站重新出发。', mood: 'calm', tags: ['旅行'],
    stats: { vitality: 1, insight: 2, connection: 1, adventure: 2 }, rarity: 2,
    createdAt: 1, updatedAt: 1, visibility: 'story', personalMeaning: '这是私人解释',
    signals: { energy: 3, relationship: '', location: '车站', motifs: [], growthIntent: '重新开始', lifeStage: 'transition', people: [], objects: [], values: [] },
    ...overrides,
  };
}

describe('narrative engine', () => {
  it('suggests deterministic motifs without replacing user choices', () => {
    expect(normalizeSignals(entry()).motifs).toEqual(expect.arrayContaining(['雨', '车站']));
  });

  it('only exports explicitly public story material', () => {
    const publicEntry = entry();
    const privateEntry = entry({ id: 'private', visibility: 'private', text: '不能导出的原文' });
    const project = createStoryProject('旅程', [publicEntry, privateEntry], DEFAULT_THEME_PROFILE);
    const bundle = buildStoryPackage(project, [publicEntry, privateEntry]);
    const serialized = JSON.stringify(bundle);
    expect(bundle.entries).toHaveLength(1);
    expect(serialized).not.toContain('不能导出的原文');
    expect(serialized).not.toContain('这是私人解释');
    expect(serialized).not.toContain('personalMeaning');
  });
});
