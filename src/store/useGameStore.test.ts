import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_JOURNEY_PROGRESS } from '@/types/life';
import { useGameStore } from './useGameStore';

describe('journey progress store', () => {
  beforeEach(() => {
    useGameStore.setState({
      loaded: false,
      journeyProgress: structuredClone(DEFAULT_JOURNEY_PROGRESS),
    });
  });

  it('persists exploration, puzzle and resolution state for re-entry', () => {
    useGameStore.getState().enterJourneyScene('scene-1', ['thread-1']);
    useGameStore.getState().updateJourneySceneState('scene-1', {
      discoveredAnchorIds: ['place', 'object'],
      puzzleStatus: 'ready',
      playerProgress: 0.62,
    });
    useGameStore.getState().recordJourneyReflection({
      sceneId: 'scene-1', entryId: 'entry-1', choiceId: 'release', tone: 'release', puzzleSkipped: false,
      customText: '现在可以向前了', reflectedAt: 10,
    }, {
      id: 'keepsake-1', entryId: 'entry-1', sceneId: 'scene-1', label: '旧车票', motif: '车票', resolutionTone: 'release', acquiredAt: 10,
    });
    const progress = useGameStore.getState().journeyProgress;
    expect(progress.completedSceneIds).toContain('scene-1');
    expect(progress.discoveredThreadIds).toContain('thread-1');
    expect(progress.sceneStates['scene-1']).toMatchObject({
      discoveredAnchorIds: ['place', 'object'], playerProgress: 0.62, puzzleStatus: 'solved', resolutionTone: 'release',
    });
    expect(progress.keepsakes[0].label).toBe('旧车票');
  });
});
