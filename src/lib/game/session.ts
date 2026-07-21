import type { Chapter, JournalEntry, MapNode, Tile } from '@/types/game';
import type { WorldDelta } from '@/types/narrative';
import type { WorldData } from './World';

export function getWorldKey(activeChapterId?: string | null): string {
  return activeChapterId ? `chapter:${activeChapterId}` : 'world:all';
}

export function selectWorldContent(
  entries: JournalEntry[],
  nodes: MapNode[],
  chapters: Chapter[],
  activeChapterId?: string | null
) {
  const chapter = activeChapterId ? chapters.find((item) => item.id === activeChapterId) : undefined;
  if (!chapter) return { entries, nodes };
  const entryIds = new Set(chapter.entryIds);
  return {
    entries: entries.filter((entry) => entryIds.has(entry.id)),
    nodes: nodes.filter((node) => entryIds.has(node.entryId)),
  };
}

export function recordTileMutation(
  deltas: Record<string, WorldDelta>,
  worldKey: string,
  tile: Tile
) {
  const current = deltas[worldKey] ?? { worldKey, tiles: [], updatedAt: Date.now() };
  const mutation = {
    x: tile.x,
    y: tile.y,
    type: tile.type,
    solid: tile.solid,
    decoration: tile.decoration,
    destroyed: tile.destroyed,
    destructible: tile.destructible,
    plant: tile.plant ? { ...tile.plant } : undefined,
  };
  const tiles = current.tiles.filter((item) => item.x !== tile.x || item.y !== tile.y);
  deltas[worldKey] = { worldKey, tiles: [...tiles, mutation], updatedAt: Date.now() };
}

export function applyWorldDelta(world: WorldData, delta?: WorldDelta) {
  if (!delta) return;
  const lookup = new Map(world.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  for (const mutation of delta.tiles) {
    const tile = lookup.get(`${mutation.x},${mutation.y}`);
    if (!tile) continue;
    tile.type = mutation.type;
    tile.solid = mutation.solid;
    tile.decoration = mutation.decoration;
    tile.destroyed = mutation.destroyed;
    tile.destructible = mutation.destructible;
    tile.plant = mutation.plant ? { ...mutation.plant } : undefined;
  }
}
