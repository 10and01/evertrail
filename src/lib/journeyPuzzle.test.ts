import { describe, expect, it } from 'vitest';
import type { MemoryPuzzleBlueprint } from '@/types/life';
import { advancePuzzleSelection } from './journeyPuzzle';

const puzzle: MemoryPuzzleBlueprint = {
  id: 'puzzle', template: 'route', title: '路', prompt: 'prompt', instructions: 'instructions',
  anchorIds: ['place', 'object', 'feeling'], solution: ['place', 'object', 'feeling'], hint: 'hint', completion: 'done',
};

describe('journey puzzle', () => {
  it('advances and completes a deterministic clue sequence', () => {
    const first = advancePuzzleSelection(puzzle, [], 'place');
    const second = advancePuzzleSelection(puzzle, first.selection, 'object');
    const third = advancePuzzleSelection(puzzle, second.selection, 'feeling');
    expect(first.outcome).toBe('progress');
    expect(second.outcome).toBe('progress');
    expect(third).toEqual({ selection: ['place', 'object', 'feeling'], outcome: 'solved' });
  });

  it('resets without punishment when the connection is wrong', () => {
    expect(advancePuzzleSelection(puzzle, ['place'], 'feeling')).toEqual({ selection: [], outcome: 'wrong' });
  });
});
