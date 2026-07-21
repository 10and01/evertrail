import type { MemoryPuzzleBlueprint } from '@/types/life';

export interface PuzzleAdvanceResult {
  selection: string[];
  outcome: 'progress' | 'solved' | 'wrong';
}

export function advancePuzzleSelection(
  puzzle: MemoryPuzzleBlueprint,
  selection: string[],
  anchorId: string
): PuzzleAdvanceResult {
  const expected = puzzle.solution[selection.length];
  if (!expected || anchorId !== expected) return { selection: [], outcome: 'wrong' };
  const next = [...selection, anchorId];
  return {
    selection: next,
    outcome: next.length === puzzle.solution.length ? 'solved' : 'progress',
  };
}
