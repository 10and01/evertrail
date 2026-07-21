import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Compass, Feather, Sparkles } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { ProfileCreator } from '@/components/ProfileCreator';
import { EventCard } from '@/components/EventCard';
import { StorybookPreview } from '@/components/StorybookPreview';
import { collectMotifs } from '@/lib/narrativeEngine';

export default function Home() {
  const profile = useGameStore((state) => state.profile);
  const entries = useGameStore((state) => state.entries);
  const projects = useGameStore((state) => state.storyProjects);
  const initProfile = useGameStore((state) => state.initProfile);

  if (!profile) return <ProfileCreator onCreate={initProfile} />;

  const recent = entries.at(-1);
  const activeProject = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const motifs = collectMotifs(entries).slice(0, 5);

  return (
    <div className="page-stack pb-24 md:pb-8">
      <header className="today-hero page-hero">
        <div className="today-copy">
          <p className="eyebrow">Today · {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          <h1>欢迎回来，{profile.nickname}</h1>
          <p>先把今天留在这里。它不必完整，也不必立刻成为一个故事。</p>
          <div className="hero-actions">
            <Link to="/journal" className="story-button"><Feather size={17} /> 写下今天</Link>
            <Link to="/map" className="story-button secondary"><Compass size={17} /> 继续旅程</Link>
          </div>
        </div>
        <div className="today-landscape" aria-hidden="true">
          <span className="sun" />
          <span className="hill far" />
          <span className="hill near" />
          <span className="traveler">✦</span>
        </div>
      </header>

      <section className="today-grid">
        <article className="storybook-panel daily-prompt">
          <p className="eyebrow">A gentle prompt</p>
          <h2>今天，有什么瞬间值得被轻轻放大？</h2>
          <p>可以是一句话、一张照片，或一个你想记住的地点。</p>
          <Link to="/journal" className="text-link">进入私密记录室 <ArrowRight size={15} /></Link>
        </article>

        <article className="storybook-panel quiet-stats">
          <div><Sparkles /><strong>{entries.length}</strong><span>段记忆</span></div>
          <div><BookOpen /><strong>{projects.length}</strong><span>部作品</span></div>
          <div><Compass /><strong>{motifs.length}</strong><span>种意象</span></div>
        </article>
      </section>

      <section className="section-heading"><div><p className="eyebrow">Continue</p><h2>{activeProject ? '继续编排你的故事' : '让第一段记录成为故事'}</h2></div><Link to="/studio" className="text-link">打开工坊 <ArrowRight size={15} /></Link></section>

      {activeProject ? (
        <div className="home-story-grid">
          <StorybookPreview project={activeProject} entries={entries} compact />
          <aside className="storybook-panel project-note"><span className="project-index">{String(activeProject.scenes.length).padStart(2, '0')}</span><h3>{activeProject.title}</h3><p>{activeProject.description || activeProject.subtitle}</p><Link to="/studio" className="story-button">继续编辑</Link></aside>
        </div>
      ) : (
        <div className="storybook-panel empty-inline"><div><h3>你的故事工坊还是空的</h3><p>先将记录标记为“可作为故事素材”，再决定公开哪些摘录和图片。</p></div><Link to="/studio" className="story-button">了解如何开始</Link></div>
      )}

      {recent && (
        <section><div className="section-heading"><div><p className="eyebrow">Latest memory</p><h2>最近记录</h2></div><Link to={`/journal/${recent.id}`} className="text-link">编辑记录 <ArrowRight size={15} /></Link></div><div className="max-w-2xl"><EventCard entry={recent} /></div></section>
      )}
    </div>
  );
}
