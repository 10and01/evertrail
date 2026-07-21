import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '@/types/game';
import { DEFAULT_THEME_PROFILE } from '@/types/narrative';
import { buildLifeGraph } from './lifeGraphEngine';
import { compileMemoryScene } from './sceneCompiler';

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'memory-1', date: '2026-04-18', text: '我和阿禾在雨后的车站重新出发。', mood: 'calm', tags: ['远行'],
    stats: { vitality: 2, insight: 3, connection: 3, adventure: 4 }, rarity: 3,
    createdAt: 1, updatedAt: 1, visibility: 'story', personalMeaning: '我终于愿意向前走。',
    signals: {
      energy: 4, relationship: '阿禾', location: '旧车站', motifs: ['雨', '灯火'], growthIntent: '重新开始',
      lifeStage: 'transition', people: ['阿禾'], objects: ['车票'], values: ['勇气'],
    },
    ...overrides,
  };
}

describe('memory scene compiler', () => {
  it('is deterministic for the same entry and theme', () => {
    const source = entry();
    const graph = buildLifeGraph([source]);
    expect(compileMemoryScene(source, graph, DEFAULT_THEME_PROFILE)).toEqual(
      compileMemoryScene(source, graph, DEFAULT_THEME_PROFILE)
    );
  });

  it('turns the three narrative lenses into distinct puzzle modes', () => {
    const source = entry();
    const graph = buildLifeGraph([source]);
    const wanderer = compileMemoryScene(source, graph, { ...DEFAULT_THEME_PROFILE, lens: 'wanderer' });
    const collector = compileMemoryScene(source, graph, { ...DEFAULT_THEME_PROFILE, lens: 'collector' });
    const chronicler = compileMemoryScene(source, graph, { ...DEFAULT_THEME_PROFILE, lens: 'chronicler' });
    expect([wanderer.puzzle.template, collector.puzzle.template, chronicler.puzzle.template]).toEqual(['route', 'keepsake', 'thread']);
    expect(new Set([wanderer.objective, collector.objective, chronicler.objective]).size).toBe(3);
    expect(collector.visual.photoTreatment).toBe('fragments');
  });

  it('uses personal fields to change visible scene grammar and clues', () => {
    const station = entry();
    const home = entry({ id: 'memory-2', signals: { ...entry().signals!, location: '外婆的厨房', objects: ['旧茶杯'], people: ['外婆'] } });
    const stationScene = compileMemoryScene(station, buildLifeGraph([station]), DEFAULT_THEME_PROFILE);
    const homeScene = compileMemoryScene(home, buildLifeGraph([home]), DEFAULT_THEME_PROFILE);
    expect(stationScene.visual.locationGrammar).toBe('transit');
    expect(homeScene.visual.locationGrammar).toBe('home');
    expect(homeScene.anchors.map((anchor) => anchor.label)).toEqual(expect.arrayContaining(['外婆的厨房', '外婆', '旧茶杯']));
    expect(homeScene.personalization.map((source) => source.field)).toEqual(expect.arrayContaining(['location', 'people', 'objects', 'mood', 'lens']));
  });

  it('uses a concrete fallback place instead of an abstract memory entrance', () => {
    const source = entry({
      id: 'memory-without-place',
      text: '今天只是安静地走了一段路。',
      mood: 'calm',
      signals: { ...entry().signals!, location: '', people: [], relationship: '', objects: [], motifs: [] },
    });
    const scene = compileMemoryScene(source, buildLifeGraph([source]), DEFAULT_THEME_PROFILE);
    expect(scene.location).toBe('林间小屋外');
    expect(scene.objective).not.toContain('记忆的入口');
    expect(scene.anchors.find((anchor) => anchor.kind === 'place')?.label).toBe('林间小屋外');
  });
});
