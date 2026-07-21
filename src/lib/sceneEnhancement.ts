import type { JournalEntry } from '@/types/game';
import type { MemorySceneBlueprint } from '@/types/life';
import type { ThemeProfile } from '@/types/narrative';

export interface SanitizedSceneSummary {
  mood: JournalEntry['mood'];
  energy: number;
  archetype: MemorySceneBlueprint['archetype'];
  locationGrammar: MemorySceneBlueprint['visual']['locationGrammar'];
  motifs: string[];
  puzzleTemplate: MemorySceneBlueprint['puzzle']['template'];
  narrativeLens: ThemeProfile['lens'];
}

export interface SceneEnhancementSuggestion {
  objective?: string;
  unresolvedState?: string;
  motifProp?: string;
  reflectionPrompt?: string;
}

export interface SceneEnhancementProvider {
  enhance(summary: SanitizedSceneSummary): Promise<SceneEnhancementSuggestion>;
}

export function buildSanitizedSceneSummary(
  entry: JournalEntry,
  blueprint: MemorySceneBlueprint,
  theme: ThemeProfile
): SanitizedSceneSummary {
  return {
    mood: entry.mood,
    energy: blueprint.energy,
    archetype: blueprint.archetype,
    locationGrammar: blueprint.visual.locationGrammar,
    motifs: blueprint.motifs.slice(0, 4),
    puzzleTemplate: blueprint.puzzle.template,
    narrativeLens: theme.lens,
  };
}

export async function enhanceMemoryScene(
  blueprint: MemorySceneBlueprint,
  entry: JournalEntry,
  theme: ThemeProfile,
  provider?: SceneEnhancementProvider
): Promise<MemorySceneBlueprint> {
  if (!theme.aiEnhancementConsent || !provider) return blueprint;
  try {
    const suggestion = await provider.enhance(buildSanitizedSceneSummary(entry, blueprint, theme));
    return {
      ...blueprint,
      objective: safeText(suggestion.objective, blueprint.objective, 100),
      unresolvedState: safeText(suggestion.unresolvedState, blueprint.unresolvedState, 120),
      reflectionPrompt: safeText(suggestion.reflectionPrompt, blueprint.reflectionPrompt, 140),
      visual: {
        ...blueprint.visual,
        motifProp: safeText(suggestion.motifProp, blueprint.visual.motifProp, 24),
      },
    };
  } catch {
    return blueprint;
  }
}

function safeText(value: string | undefined, fallback: string, maxLength: number): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}
