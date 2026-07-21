import { describe, expect, it } from 'vitest';
import type { Tile } from '@/types/game';
import { applyWorldDelta, getWorldKey, recordTileMutation, selectWorldContent } from './session';

describe('world session', () => {
  it('keeps chapter entities scoped to the active chapter', () => {
    const entries = [{ id: 'a' }, { id: 'b' }] as never[];
    const nodes = [{ id: 'na', entryId: 'a' }, { id: 'nb', entryId: 'b' }] as never[];
    const chapters = [{ id: 'chapter-a', entryIds: ['a'] }] as never[];
    const scoped = selectWorldContent(entries, nodes, chapters, 'chapter-a');
    expect(scoped.entries).toHaveLength(1);
    expect(scoped.nodes).toHaveLength(1);
  });

  it('records and restores a tile mutation', () => {
    const tile: Tile = { x: 0, y: 32, type: 'grass', biome: 'calm', solid: true, decoration: 'flower' };
    const deltas = {};
    tile.type = 'gap'; tile.solid = false; tile.destroyed = true; tile.decoration = undefined;
    recordTileMutation(deltas, getWorldKey(null), tile);
    const restored: Tile = { x: 0, y: 32, type: 'grass', biome: 'calm', solid: true, decoration: 'flower' };
    applyWorldDelta({ tiles: [restored], platforms: [], tileMap: new Map(), minX: 0, maxX: 32, groundY: 320 }, deltas['world:all']);
    expect(restored.type).toBe('gap');
    expect(restored.solid).toBe(false);
    expect(restored.destroyed).toBe(true);
  });
});
