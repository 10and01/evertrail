import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookHeart, Gem, Sparkles, Users } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { collectMotifs } from '@/lib/narrativeEngine';
import { StorybookPreview } from '@/components/StorybookPreview';
import { buildLifeGraph } from '@/lib/lifeGraphEngine';

export default function Gallery() {
  const projects = useGameStore((state) => state.storyProjects);
  const entries = useGameStore((state) => state.entries);
  const journeyProgress = useGameStore((state) => state.journeyProgress);
  const [selectedId, setSelectedId] = useState(projects[0]?.id);
  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const motifs = collectMotifs(entries).slice(0, 8);
  const graph = useMemo(() => buildLifeGraph(entries), [entries]);

  return (
    <div className="page-stack pb-24 md:pb-8">
      <header className="page-hero gallery-hero">
        <div>
          <p className="eyebrow">Personal Gallery</p>
          <h1>个人展厅</h1>
          <p>作品、意象和相片在这里成为你的私人陈列。所有内容仍只保存在本机。</p>
        </div>
        <Link to="/studio" className="story-button">进入故事工坊</Link>
      </header>

      <section className="gallery-stats">
        <div className="storybook-panel"><BookHeart /><strong>{projects.length}</strong><span>部作品</span></div>
        <div className="storybook-panel"><Users /><strong>{graph.threads.length}</strong><span>条人生线索</span></div>
        <div className="storybook-panel"><Gem /><strong>{journeyProgress.keepsakes.length}</strong><span>件记忆信物</span></div>
      </section>

      <section className="keepsake-gallery storybook-panel">
        <div><p className="eyebrow">Memory keepsakes</p><h2>从记忆里带回来的东西</h2><p>它们不能消费，也不会提供数值加成；只是提醒你，哪些事情真正发生过。</p></div>
        <div className="keepsake-grid">
          {journeyProgress.keepsakes.length ? journeyProgress.keepsakes.map((item) => (
            <article key={item.id} className={item.resolutionTone ? `resolution-${item.resolutionTone}` : ''}><span>✦</span><strong>{item.label}</strong><small>{item.motif}</small>{item.resolutionTone && <em>{resolutionLabel(item.resolutionTone)}</em>}{item.storyPrompt && <p>{item.storyPrompt}</p>}</article>
          )) : <p className="text-et-muted">进入一段记忆并留下现在的理解，第一件信物就会出现在这里。</p>}
        </div>
      </section>

      <section className="life-thread-gallery storybook-panel">
        <div><p className="eyebrow">Life threads</p><h2>反复出现的人生线索</h2></div>
        <div className="thread-list">
          {graph.threads.slice(0, 10).map((thread) => <article key={thread.id}><Sparkles /><div><strong>{thread.title}</strong><span>{thread.entryIds.length} 段记忆 · 最近出现于 {thread.lastTouchedAt}</span></div></article>)}
        </div>
      </section>

      <section className="motif-shelf storybook-panel">
        <div><p className="eyebrow">Motif Shelf</p><h2>意象收藏</h2></div>
        <div className="motif-cloud">
          {motifs.length ? motifs.map(({ motif, count }) => <span key={motif}>{motif}<small>{count}</small></span>) : <p className="text-et-muted">记录中的雨、植物、星光与地点会逐渐出现在这里。</p>}
        </div>
      </section>

      {selected ? (
        <section className="gallery-projects">
          <div className="project-spines storybook-panel">
            {projects.map((project) => (
              <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className={project.id === selected.id ? 'is-active' : ''}>
                <span>{project.title}</span><small>{project.scenes.length} scenes</small>
              </button>
            ))}
          </div>
          <div>
            <StorybookPreview project={selected} entries={entries} />
            <div className="flex gap-2 mt-3"><Link to="/studio" className="story-button secondary">编辑作品</Link><Link to={`/export?project=${selected.id}`} className="story-button">预览与导出</Link></div>
          </div>
        </section>
      ) : (
        <section className="empty-story storybook-panel"><h2>展厅还没有作品</h2><p>先把几段可公开的记忆编排成第一本故事。</p><Link to="/studio" className="story-button">创建作品</Link></section>
      )}
    </div>
  );
}

function resolutionLabel(tone: 'hold' | 'release' | 'continue') {
  return tone === 'hold' ? '珍藏' : tone === 'release' ? '放下' : '继续理解';
}
