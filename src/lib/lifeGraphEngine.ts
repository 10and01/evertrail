import type { JournalEntry, Mood } from '@/types/game';
import type { LifeEntity, LifeEntityType, LifeGraph, LifeSeason, LifeStage, LifeThread } from '@/types/life';
import { LIFE_STAGE_LABELS } from '@/types/life';
import { normalizeSignals } from './narrativeEngine';

interface EntitySeed {
  type: LifeEntityType;
  label: string;
}

export function stableLifeId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (const character of `${prefix}:${value}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function buildLifeGraph(entries: JournalEntry[]): LifeGraph {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const entityMap = new Map<string, LifeEntity>();

  for (const entry of sorted) {
    for (const seed of entitySeeds(entry)) {
      const normalized = seed.label.trim().toLocaleLowerCase();
      if (!normalized) continue;
      const id = stableLifeId(seed.type, normalized);
      const existing = entityMap.get(id);
      if (existing) {
        if (!existing.entryIds.includes(entry.id)) existing.entryIds.push(entry.id);
        existing.lastSeenAt = entry.date;
      } else {
        entityMap.set(id, {
          id,
          type: seed.type,
          label: seed.label.trim(),
          entryIds: [entry.id],
          firstSeenAt: entry.date,
          lastSeenAt: entry.date,
        });
      }
    }
  }

  const entities = Array.from(entityMap.values()).sort((a, b) =>
    b.entryIds.length - a.entryIds.length || a.firstSeenAt.localeCompare(b.firstSeenAt)
  );
  const seasons = buildSeasons(sorted, entities);
  const threads = buildThreads(entities);
  return { entities, seasons, threads };
}

export function entitiesForEntry(graph: LifeGraph, entryId: string): LifeEntity[] {
  return graph.entities.filter((entity) => entity.entryIds.includes(entryId));
}

function entitySeeds(entry: JournalEntry): EntitySeed[] {
  const signals = normalizeSignals(entry);
  const relationshipPeople = signals.relationship.split(/[，,、/]/).map((value) => value.trim()).filter(Boolean);
  return [
    ...Array.from(new Set([...signals.people, ...relationshipPeople])).map((label) => ({ type: 'person' as const, label })),
    ...(signals.location ? [{ type: 'place' as const, label: signals.location }] : []),
    ...signals.values.map((label) => ({ type: 'value' as const, label })),
    ...signals.objects.map((label) => ({ type: 'object' as const, label })),
    ...signals.motifs.map((label) => ({ type: 'motif' as const, label })),
  ];
}

function buildThreads(entities: LifeEntity[]): LifeThread[] {
  return entities.map((entity) => ({
    id: stableLifeId('thread', entity.id),
    title: entity.label,
    entityIds: [entity.id],
    entryIds: [...entity.entryIds],
    resonance: entity.entryIds.length,
    lastTouchedAt: entity.lastSeenAt,
  }));
}

function buildSeasons(entries: JournalEntry[], entities: LifeEntity[]): LifeSeason[] {
  const groups = new Map<string, { stage: LifeStage; title: string; entries: JournalEntry[] }>();
  for (const entry of entries) {
    const signals = normalizeSignals(entry);
    const year = entry.date.slice(0, 4) || '未知';
    const key = signals.lifeStage === 'unspecified' ? `year:${year}` : `stage:${signals.lifeStage}`;
    const title = signals.lifeStage === 'unspecified' ? `${year} · 生活片段` : LIFE_STAGE_LABELS[signals.lifeStage];
    const group = groups.get(key) ?? { stage: signals.lifeStage, title, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const entryIds = group.entries.map((entry) => entry.id);
    return {
      id: stableLifeId('season', key),
      title: group.title,
      stage: group.stage,
      startDate: group.entries[0]?.date ?? '',
      endDate: group.entries.at(-1)?.date ?? '',
      entryIds,
      dominantMood: dominantMood(group.entries),
      entityIds: entities.filter((entity) => entity.entryIds.some((id) => entryIds.includes(id))).map((entity) => entity.id),
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function dominantMood(entries: JournalEntry[]): Mood {
  const counts = new Map<Mood, number>();
  for (const entry of entries) counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'calm';
}
