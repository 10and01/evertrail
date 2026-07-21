import { describe, expect, it, vi } from 'vitest';
import type { JournalEntry } from '@/types/game';
import { DEFAULT_THEME_PROFILE } from '@/types/narrative';
import { buildLifeGraph } from './lifeGraphEngine';
import { compileMemoryScene } from './sceneCompiler';
import { buildSanitizedSceneSummary, enhanceMemoryScene } from './sceneEnhancement';

const entry: JournalEntry = {
  id: 'private-memory', date: '2026-01-02', text: '不能上传的完整原文', mood: 'sad', tags: ['私密'], image: 'private-image-data',
  stats: { vitality: 1, insight: 2, connection: 2, adventure: 1 }, rarity: 2, createdAt: 1, updatedAt: 1,
  visibility: 'private', personalMeaning: '不能上传的私人解释',
  signals: { energy: 2, relationship: '某人', location: '海边', motifs: ['雨'], growthIntent: '', lifeStage: 'recovery', people: ['某人'], objects: ['信'], values: [] },
};

describe('optional scene enhancement', () => {
  it('builds a summary without raw text, images, names or private meaning', () => {
    const scene = compileMemoryScene(entry, buildLifeGraph([entry]), DEFAULT_THEME_PROFILE);
    const serialized = JSON.stringify(buildSanitizedSceneSummary(entry, scene, DEFAULT_THEME_PROFILE));
    expect(serialized).not.toContain(entry.text);
    expect(serialized).not.toContain(entry.personalMeaning);
    expect(serialized).not.toContain(entry.image);
    expect(serialized).not.toContain('某人');
  });

  it('does not call a provider without consent and falls back on failure', async () => {
    const scene = compileMemoryScene(entry, buildLifeGraph([entry]), DEFAULT_THEME_PROFILE);
    const provider = { enhance: vi.fn().mockRejectedValue(new Error('offline')) };
    expect(await enhanceMemoryScene(scene, entry, DEFAULT_THEME_PROFILE, provider)).toBe(scene);
    expect(provider.enhance).not.toHaveBeenCalled();
    const consented = { ...DEFAULT_THEME_PROFILE, aiEnhancementConsent: true };
    expect(await enhanceMemoryScene(scene, entry, consented, provider)).toBe(scene);
    expect(provider.enhance).toHaveBeenCalledTimes(1);
  });
});
