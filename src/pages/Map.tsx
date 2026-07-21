import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, MapPin, Sparkles, Users } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { buildLifeGraph } from '@/lib/lifeGraphEngine';
import { compileMemoryScenes } from '@/lib/sceneCompiler';
import type { MemorySceneBlueprint, SceneArchetype } from '@/types/life';
import { JourneyRuntime } from '@/components/journey/JourneyRuntime';

const ARCHETYPE_LABELS: Record<SceneArchetype, string> = {
  encounter: '一次相遇',
  ritual: '日常仪式',
  transition: '改变发生时',
  conflict: '穿过压力',
  celebration: '值得记住的光',
  farewell: '一段告别',
};

export default function MapPage() {
  const entries = useGameStore((state) => state.entries);
  const progress = useGameStore((state) => state.journeyProgress);
  const theme = useGameStore((state) => state.themeProfile);
  const leaveScene = useGameStore((state) => state.leaveJourneyScene);
  const navigate = useNavigate();
  const graph = useMemo(() => buildLifeGraph(entries), [entries]);
  const scenes = useMemo(() => compileMemoryScenes(entries, graph, theme), [entries, graph, theme]);
  const [selectedSceneId, setSelectedSceneId] = useState(progress.activeSceneId);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId);
  const selectedEntry = selectedScene ? entries.find((entry) => entry.id === selectedScene.entryId) : undefined;

  const exitScene = () => {
    leaveScene();
    setSelectedSceneId(null);
  };

  if (selectedScene && selectedEntry) {
    return <JourneyRuntime blueprint={selectedScene} entry={selectedEntry} graph={graph} onExit={exitScene} />;
  }

  if (entries.length === 0) {
    return (
      <div className="journey-empty-page">
        <div className="journey-empty-landscape" aria-hidden="true"><span /><span /><i>✦</i></div>
        <section className="journey-empty-copy"><p className="eyebrow">Your life atlas</p><h1>人生图谱还没有展开</h1><p>写下一段真实发生过的事，再告诉系统那里有谁、是什么地方、留下些什么物件。</p><Link to="/journal" className="story-button">写下第一段记忆</Link><button type="button" className="story-button secondary" onClick={() => navigate('/')}>回到今天</button></section>
      </div>
    );
  }

  const completed = new Set(progress.completedSceneIds);
  const visited = new Set(progress.visitedSceneIds);
  const leadingThreads = graph.threads.slice(0, 6);

  return (
    <div className="life-atlas-page">
      <header className="life-atlas-header">
        <button type="button" onClick={() => navigate('/')} className="journey-round-button" aria-label="返回今天"><ArrowLeft /></button>
        <div><p className="eyebrow">Your life atlas</p><h1>我的人生图谱</h1><p>这些不是关卡，而是你生命里反复出现的人、地点和主题。</p></div>
        <Link to="/journal" className="story-button">记录新的片段</Link>
      </header>

      <section className="life-thread-ribbon" aria-label="人生线索">
        <div className="thread-ribbon-title"><Sparkles /><span>正在形成的人生线索</span></div>
        {leadingThreads.length ? leadingThreads.map((thread) => (
          <div key={thread.id} className={`life-thread-chip ${progress.discoveredThreadIds.includes(thread.id) ? 'is-discovered' : ''}`}>
            <strong>{thread.title}</strong><span>{thread.resonance} 段记忆</span>
          </div>
        )) : <p>为记录补充人物、地点和意象后，人生线索会出现在这里。</p>}
      </section>

      <main className="life-seasons">
        {graph.seasons.map((season, seasonIndex) => {
          const seasonScenes = scenes.filter((scene) => scene.seasonId === season.id);
          return (
            <section key={season.id} className="life-season-section">
              <header className="life-season-heading">
                <div className="season-index">{String(seasonIndex + 1).padStart(2, '0')}</div>
                <div><p>{season.startDate === season.endDate ? season.startDate : `${season.startDate} — ${season.endDate}`}</p><h2>{season.title}</h2></div>
                <span>{seasonScenes.filter((scene) => completed.has(scene.id)).length}/{seasonScenes.length} 留下回响</span>
              </header>
              <div className="memory-scene-track">
                {seasonScenes.map((scene, index) => (
                  <MemorySceneCard
                    key={scene.id}
                    scene={scene}
                    index={index}
                    visited={visited.has(scene.id)}
                    completed={completed.has(scene.id)}
                    discoveredCount={progress.sceneStates[scene.id]?.discoveredAnchorIds.length ?? 0}
                    resolutionTone={progress.sceneStates[scene.id]?.resolutionTone}
                    onEnter={() => setSelectedSceneId(scene.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="life-atlas-footer"><Compass /><div><strong>{scenes.length} 段可进入的记忆</strong><span>{graph.entities.length} 个人生元素 · {progress.keepsakes.length} 件记忆信物</span></div><Link to="/gallery" className="text-link">查看个人展厅 <ArrowRight /></Link></footer>
    </div>
  );
}

function MemorySceneCard({ scene, index, visited, completed, discoveredCount, resolutionTone, onEnter }: { scene: MemorySceneBlueprint; index: number; visited: boolean; completed: boolean; discoveredCount: number; resolutionTone?: 'hold' | 'release' | 'continue'; onEnter: () => void }) {
  const people = scene.people.slice(0, 2).join('、');
  const visualLabel = [scene.location, people, scene.objects[0], scene.motifs[0]].filter(Boolean).slice(0, 3).join(' · ');
  return (
    <button
      type="button"
      className={`memory-scene-card archetype-${scene.archetype} ${visited ? 'is-visited' : ''} ${completed ? 'is-completed' : ''} ${resolutionTone ? `resolution-${resolutionTone}` : ''}`}
      onClick={onEnter}
      style={{ '--scene-sky': scene.palette[0], '--scene-horizon': scene.palette[1], '--scene-ground': scene.palette[3], '--scene-accent': scene.palette[4] } as React.CSSProperties}
    >
      <div className="memory-card-art" aria-hidden="true"><span className="memory-sun" /><span className="memory-hill one" /><span className="memory-hill two" /><span className="memory-figure">●</span>{scene.people.length > 0 && <span className="memory-figure other">●</span>}</div>
      <div className="memory-card-content"><span className="memory-number">{String(index + 1).padStart(2, '0')}</span><p>{ARCHETYPE_LABELS[scene.archetype]} · {scene.puzzle.template}</p><strong>{visualLabel || '一段只有你知道的记忆'}</strong><small className="memory-card-objective">{scene.objective}</small><div>{scene.location && <span><MapPin />{scene.location}</span>}{scene.people.length > 0 && <span><Users />{scene.people.length} 人</span>}</div></div>
      <footer><span>{scene.date}</span><span>{completed ? resolutionLabel(resolutionTone) : visited ? `${discoveredCount} 条线索 · 继续进入` : '第一次进入'}</span></footer>
    </button>
  );
}

function resolutionLabel(tone?: 'hold' | 'release' | 'continue') {
  if (tone === 'hold') return '以“珍藏”留下回响';
  if (tone === 'release') return '以“放下”留下回响';
  if (tone === 'continue') return '仍在继续理解';
  return '已留下回响';
}
