import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Heart, MapPin, PackageOpen, Pause, Sparkles, UserRound } from 'lucide-react';
import type { JournalEntry } from '@/types/game';
import type { AnchorKind, JourneySceneState, LifeGraph, MemoryAnchor } from '@/types/life';
import { LIFE_STAGE_LABELS } from '@/types/life';
import { useGameStore } from '@/store/useGameStore';
import { useJourneyControls } from '@/hooks/useJourneyControls';
import { playAnchorCue, playPuzzleCue, playResolutionCue } from '@/lib/journeyAudio';
import { advancePuzzleSelection } from '@/lib/journeyPuzzle';
import { JourneyRenderer } from './JourneyRenderer';

interface JourneyRuntimeProps {
  blueprint: import('@/types/life').MemorySceneBlueprint;
  entry: JournalEntry;
  graph: LifeGraph;
  onExit: () => void;
}

const EMPTY_SCENE_STATE: JourneySceneState = {
  discoveredAnchorIds: [],
  puzzleStatus: 'exploring',
  puzzleSelection: [],
  playerProgress: 0,
  updatedAt: 0,
};

const ANCHOR_LABELS: Record<AnchorKind, string> = {
  place: '发生在哪里',
  person: '谁留在这里',
  object: '什么被留下',
  feeling: '身体记得什么',
  meaning: '现在怎样理解',
};

export function JourneyRuntime({ blueprint, entry, graph, onExit }: JourneyRuntimeProps) {
  const theme = useGameStore((state) => state.themeProfile);
  const progress = useGameStore((state) => state.journeyProgress);
  const enterScene = useGameStore((state) => state.enterJourneyScene);
  const leaveScene = useGameStore((state) => state.leaveJourneyScene);
  const updateSceneState = useGameStore((state) => state.updateJourneySceneState);
  const recordReflection = useGameStore((state) => state.recordJourneyReflection);
  const [nearby, setNearby] = useState<MemoryAnchor | null>(null);
  const [openAnchor, setOpenAnchor] = useState<MemoryAnchor | null>(null);
  const [paused, setPaused] = useState(false);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [completionEcho, setCompletionEcho] = useState('');
  const [puzzleFeedback, setPuzzleFeedback] = useState('');
  const controls = useJourneyControls({ onEscape: () => {
    if (openAnchor) setOpenAnchor(null);
    else if (puzzleOpen) setPuzzleOpen(false);
    else if (reflectionOpen) setReflectionOpen(false);
    else if (paused) setPaused(false);
    else setPaused(true);
  } });
  const season = graph.seasons.find((item) => item.id === blueprint.seasonId);
  const primaryThread = graph.threads.find((thread) => blueprint.threadIds.includes(thread.id));
  const existingReflection = progress.reflections[blueprint.id];
  const sceneState = progress.sceneStates[blueprint.id] ?? EMPTY_SCENE_STATE;
  const discovered = useMemo(() => new Set(sceneState.discoveredAnchorIds), [sceneState.discoveredAnchorIds]);
  const puzzleResolved = sceneState.puzzleStatus === 'solved' || sceneState.puzzleStatus === 'skipped' || Boolean(existingReflection);
  const requiredCount = blueprint.puzzle.anchorIds.length;
  const discoveredRequired = blueprint.puzzle.anchorIds.filter((id) => discovered.has(id)).length;
  const resolutionTone = sceneState.resolutionTone ?? existingReflection?.tone;

  useEffect(() => {
    enterScene(blueprint.id, blueprint.threadIds);
    return () => leaveScene();
  }, [blueprint.id, blueprint.threadIds, enterScene, leaveScene]);

  useEffect(() => {
    if (existingReflection && sceneState.puzzleStatus === 'exploring') {
      updateSceneState(blueprint.id, {
        puzzleStatus: existingReflection.puzzleSkipped ? 'skipped' : 'solved',
        puzzleSkipped: existingReflection.puzzleSkipped,
        resolutionTone: existingReflection.tone,
      });
    }
  }, [blueprint.id, existingReflection, sceneState.puzzleStatus, updateSceneState]);

  useEffect(() => {
    if (sceneState.puzzleStatus === 'exploring' && discoveredRequired === requiredCount) {
      updateSceneState(blueprint.id, { puzzleStatus: 'ready' });
      setPuzzleFeedback('线索已经足够，记忆中央出现了一道可以重新连接的路。');
    }
  }, [blueprint.id, discoveredRequired, requiredCount, sceneState.puzzleStatus, updateSceneState]);

  const discoverAnchor = (anchor: MemoryAnchor) => {
    playAnchorCue(anchor.kind);
    if (anchor.kind === 'meaning') {
      if (puzzleResolved) setReflectionOpen(true);
      else if (sceneState.puzzleStatus === 'ready') setPuzzleOpen(true);
      else setPuzzleFeedback(`还差 ${Math.max(0, requiredCount - discoveredRequired)} 条线索，先在场景里继续寻找光点。`);
      return;
    }
    if (!discovered.has(anchor.id)) {
      updateSceneState(blueprint.id, {
        discoveredAnchorIds: [...sceneState.discoveredAnchorIds, anchor.id],
      });
    }
    setOpenAnchor(anchor);
  };

  const selectPuzzleAnchor = (anchorId: string) => {
    const result = advancePuzzleSelection(blueprint.puzzle, sceneState.puzzleSelection, anchorId);
    if (result.outcome === 'wrong') {
      playPuzzleCue(false);
      updateSceneState(blueprint.id, { puzzleSelection: [] });
      setPuzzleFeedback(`这两条线暂时接不上。提示：${blueprint.puzzle.hint}`);
      return;
    }
    if (result.outcome === 'solved') {
      playPuzzleCue(true);
      updateSceneState(blueprint.id, { puzzleStatus: 'solved', puzzleSelection: result.selection, puzzleSkipped: false });
      setPuzzleFeedback(blueprint.puzzle.completion);
      setPuzzleOpen(false);
      setReflectionOpen(true);
      return;
    }
    updateSceneState(blueprint.id, { puzzleSelection: result.selection });
    setPuzzleFeedback('第一条线已经亮起，再选择下一条。');
  };

  const skipPuzzle = () => {
    updateSceneState(blueprint.id, { puzzleStatus: 'skipped', puzzleSelection: [], puzzleSkipped: true });
    setPuzzleFeedback('你选择先不解开它。记忆仍然允许你留下现在的理解。');
    setPuzzleOpen(false);
    setReflectionOpen(true);
  };

  const reflect = (choiceId: string, echo: string) => {
    const choice = blueprint.reflectionChoices.find((item) => item.id === choiceId);
    if (!choice) return;
    const now = Date.now();
    playResolutionCue(choice.tone);
    recordReflection({
      sceneId: blueprint.id,
      entryId: entry.id,
      choiceId,
      tone: choice.tone,
      puzzleSkipped: sceneState.puzzleStatus === 'skipped',
      customText: customText.trim(),
      reflectedAt: now,
    }, {
      ...blueprint.keepsake,
      resolutionTone: choice.tone,
      acquiredAt: now,
    });
    setReflectionOpen(false);
    setCompletionEcho(echo);
  };

  const updatePosition = (playerProgress: number) => {
    if (Math.abs(playerProgress - sceneState.playerProgress) < 0.015) return;
    updateSceneState(blueprint.id, { playerProgress });
  };

  const nearbyAction = nearby?.kind === 'meaning' && !puzzleResolved
    ? sceneState.puzzleStatus === 'ready' ? '连接线索' : '尚未显现'
    : '走近看看';

  return (
    <div className={`journey-runtime ${theme.reduceMotion ? 'reduce-motion' : ''}`}>
      <JourneyRenderer
        blueprint={blueprint}
        entry={entry}
        directionRef={controls.directionRef}
        interactRef={controls.interactRef}
        reduceMotion={theme.reduceMotion || paused || Boolean(openAnchor) || puzzleOpen || reflectionOpen || Boolean(completionEcho)}
        discoveredAnchorIds={sceneState.discoveredAnchorIds}
        puzzleStatus={sceneState.puzzleStatus}
        resolutionTone={resolutionTone}
        initialProgress={sceneState.playerProgress}
        avatarStyle={theme.avatarStyle}
        onNearbyAnchor={setNearby}
        onInteractAnchor={discoverAnchor}
        onPlayerProgress={updatePosition}
      />

      <header className="journey-hud">
        <button type="button" onClick={onExit} className="journey-round-button" aria-label="返回人生图谱"><ArrowLeft /></button>
        <div className="journey-thread-label"><span>{season?.title ?? LIFE_STAGE_LABELS.unspecified}</span><strong>{primaryThread?.title ?? (blueprint.location || '属于我的一段路')}</strong></div>
        <button type="button" onClick={() => setPaused((value) => !value)} className="journey-round-button" aria-label="暂停"><Pause /></button>
      </header>

      <aside className="journey-objective-card">
        <span>{puzzleResolved ? '场景已经回应' : '这一段还没有完成'}</span>
        <strong>{blueprint.objective}</strong>
        <div><i style={{ width: `${Math.min(100, (discoveredRequired / requiredCount) * 100)}%` }} /><small>{discoveredRequired}/{requiredCount} 线索</small></div>
      </aside>

      {puzzleFeedback && <div className="journey-feedback" role="status">{puzzleFeedback}</div>}

      <div className="journey-context">
        {nearby ? <><span>{nearby.label}</span><button type="button" onClick={controls.requestInteract}>{nearbyAction} · E</button></> : <span>{puzzleResolved ? '场景已经因你的选择而改变，可以继续漫游' : '向左右漫游，寻找会发光的个人线索'}</span>}
      </div>

      <div className="journey-mobile-controls" aria-label="移动控制">
        <div className="journey-move-pad">
          <button type="button" aria-label="向左移动" onPointerDown={() => controls.setDirection(-1)} onPointerUp={() => controls.setDirection(0)} onPointerCancel={() => controls.setDirection(0)}>←</button>
          <button type="button" aria-label="向右移动" onPointerDown={() => controls.setDirection(1)} onPointerUp={() => controls.setDirection(0)} onPointerCancel={() => controls.setDirection(0)}>→</button>
        </div>
        <button type="button" className="journey-interact-button" onClick={controls.requestInteract} disabled={!nearby}><Sparkles /></button>
      </div>

      {paused && !openAnchor && (
        <div className="journey-modal-backdrop"><section className="journey-modal pause-card">
          <p className="eyebrow">Journey paused</p><h2>在这里停一会儿</h2><p>进度已经保存在本机。离开后再次进入，会从现在的位置和线索状态继续。</p>
          <div className="personalization-list">{blueprint.personalization.map((source) => <span key={`${source.field}:${source.value}`}><small>{source.label}</small>{source.value}</span>)}</div>
          <button type="button" className="story-button" onClick={() => setPaused(false)}>继续漫游</button><button type="button" className="story-button secondary" onClick={onExit}>保存并回到图谱</button>
        </section></div>
      )}

      {openAnchor && (
        <div className="journey-modal-backdrop" onClick={() => setOpenAnchor(null)}>
          <section className="journey-modal memory-anchor-card" onClick={(event) => event.stopPropagation()}>
            <div className={`anchor-kind anchor-${openAnchor.kind}`}>{anchorIcon(openAnchor.kind)}</div>
            <p className="eyebrow">{ANCHOR_LABELS[openAnchor.kind]}</p><h2>{openAnchor.label}</h2><p>{openAnchor.detail}</p>
            <blockquote>{openAnchor.clue}</blockquote>
            {openAnchor.kind === 'place' && entry.image && <img src={entry.image} alt="这段记忆中的照片" />}
            <button type="button" className="story-button" onClick={() => setOpenAnchor(null)}>记住这条线索</button>
          </section>
        </div>
      )}

      {puzzleOpen && (
        <div className="journey-modal-backdrop"><section className="journey-modal memory-puzzle-card">
          <p className="eyebrow">Memory puzzle · {blueprint.puzzle.template}</p><h2>{blueprint.puzzle.title}</h2><p>{blueprint.puzzle.prompt}</p><p className="reflection-note">{blueprint.puzzle.instructions}</p>
          <div className="puzzle-selection" aria-label="已经连接的线索">{blueprint.puzzle.solution.map((_, index) => <span key={index} className={sceneState.puzzleSelection[index] ? 'is-filled' : ''}>{index + 1}</span>)}</div>
          <div className="puzzle-anchor-grid">
            {blueprint.puzzle.anchorIds.map((anchorId) => {
              const anchor = blueprint.anchors.find((item) => item.id === anchorId);
              if (!anchor || !discovered.has(anchorId)) return null;
              return <button key={anchorId} type="button" onClick={() => selectPuzzleAnchor(anchorId)} disabled={sceneState.puzzleSelection.includes(anchorId)}>{anchorIcon(anchor.kind)}<strong>{anchor.label}</strong><small>{ANCHOR_LABELS[anchor.kind]}</small></button>;
            })}
          </div>
          {puzzleFeedback && <p className="puzzle-hint">{puzzleFeedback}</p>}
          <button type="button" className="text-link" onClick={skipPuzzle}>暂时跳过，不影响留下反思</button>
        </section></div>
      )}

      {reflectionOpen && (
        <div className="journey-modal-backdrop"><section className="journey-modal reflection-card">
          <p className="eyebrow">Reflection</p><h2>{blueprint.reflectionPrompt}</h2>
          {puzzleFeedback && <p className="puzzle-completion-copy">{puzzleFeedback}</p>}
          <p className="reflection-note">选择会立即改变天气、道路、人物距离与声音，但不会修改你原本写下的记录。</p>
          <div className="reflection-choices">
            {blueprint.reflectionChoices.map((choice) => <button key={choice.id} type="button" onClick={() => reflect(choice.id, choice.echo)}><strong>{choice.label}</strong><small>{blueprint.transformations[choice.tone].ending}</small></button>)}
          </div>
          <textarea value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="或者留下一句只属于现在的你的话（可选）" rows={3} />
          <button type="button" className="text-link" onClick={() => setReflectionOpen(false)}>我想再走一会儿</button>
        </section></div>
      )}

      {completionEcho && resolutionTone && (
        <div className="journey-modal-backdrop"><section className={`journey-modal completion-card resolution-${resolutionTone}`}>
          <span className="keepsake-mark">✦</span><p className="eyebrow">Memory keepsake</p><h2>{blueprint.keepsake.label}</h2><p>{completionEcho}</p>
          <p className="transformation-ending">{blueprint.transformations[resolutionTone].ending}</p>
          <p className="reflection-note">信物、人生线索和场景变化已经保存，并可在个人展厅与故事工坊中使用。</p>
          <button type="button" className="story-button" onClick={onExit}>回到人生图谱</button><button type="button" className="story-button secondary" onClick={() => setCompletionEcho('')}>看看改变后的场景</button>
        </section></div>
      )}

      {existingReflection && !completionEcho && <div className="journey-reflected-badge">这段记忆保持着“{resolutionTone ? toneLabel(resolutionTone) : '回响'}”的变化</div>}
    </div>
  );
}

function anchorIcon(kind: AnchorKind) {
  if (kind === 'place') return <MapPin />;
  if (kind === 'person') return <UserRound />;
  if (kind === 'object') return <PackageOpen />;
  if (kind === 'feeling') return <Heart />;
  return <Sparkles />;
}

function toneLabel(tone: NonNullable<JourneySceneState['resolutionTone']>) {
  return tone === 'hold' ? '珍藏' : tone === 'release' ? '放下' : '继续理解';
}
