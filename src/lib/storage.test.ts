import { describe, expect, it } from 'vitest';
import type { GameState, JournalEntry } from '@/types/game';
import { CURRENT_SCHEMA_VERSION, migrateGameState } from './storage';

describe('storage migration', () => {
  it('upgrades legacy entries without losing their content', () => {
    const legacyEntry = {
      id: 'legacy', date: '2024-01-01', text: '旧日记', mood: 'joy', tags: [], image: undefined,
      stats: { vitality: 1, insight: 1, connection: 1, adventure: 1 }, rarity: 1, createdAt: 1, updatedAt: 1,
    } as JournalEntry;
    const migrated = migrateGameState({ entries: [legacyEntry] } as Partial<GameState>);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.entries[0].text).toBe('旧日记');
    expect(migrated.entries[0].visibility).toBe('private');
    expect(migrated.entries[0].signals?.energy).toBe(3);
    expect(migrated.storyProjects).toEqual([]);
  });
});
