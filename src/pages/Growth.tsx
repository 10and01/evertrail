import { useMemo } from 'react';
import { Compass, Feather, Layers3, Sparkles } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { buildLifeGraph } from '@/lib/lifeGraphEngine';
import { collectMotifs, normalizeSignals } from '@/lib/narrativeEngine';
import { MOODS } from '@/lib/moods';

export default function Growth() {
  const entries = useGameStore((state) => state.entries);
  const progress = useGameStore((state) => state.journeyProgress);
  const graph = useMemo(() => buildLifeGraph(entries), [entries]);
  const motifs = collectMotifs(entries).slice(0, 10);
  const valueCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const value of normalizeSignals(entry).values) valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
  }
  const values = Array.from(valueCounts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  return (
    <div className="page-stack pb-24 md:pb-8">
      <header className="page-hero compact-hero"><div><p className="eyebrow">Life patterns</p><h1>人生线索</h1><p>这里没有好坏分数，只呈现哪些人物、地点、价值和意象正在你的生活中反复出现。</p></div></header>
      <section className="gallery-stats">
        <div className="storybook-panel"><Layers3 /><strong>{graph.seasons.length}</strong><span>个人生阶段</span></div>
        <div className="storybook-panel"><Compass /><strong>{graph.threads.length}</strong><span>条人生线索</span></div>
        <div className="storybook-panel"><Feather /><strong>{progress.completedSceneIds.length}</strong><span>段当下理解</span></div>
      </section>
      <section className="growth-pattern-grid">
        <article className="storybook-panel"><p className="eyebrow">People & places</p><h2>谁和哪里构成了这些年</h2><div className="pattern-list">{graph.entities.filter((entity) => entity.type === 'person' || entity.type === 'place').slice(0, 12).map((entity) => <div key={entity.id}><span>{entity.type === 'person' ? '人' : '地'}</span><strong>{entity.label}</strong><small>{entity.entryIds.length} 次出现</small></div>)}</div></article>
        <article className="storybook-panel"><p className="eyebrow">Values</p><h2>你正在靠近的价值</h2><div className="value-orbit">{values.length ? values.map((value, index) => <span key={value.label} style={{ fontSize: `${Math.min(1.7, .85 + value.count * .16)}rem`, opacity: Math.max(.45, 1 - index * .06) }}>{value.label}</span>) : <p>在记录室里补充“这段经历靠近哪个价值”，这里会逐渐形成你的价值轨迹。</p>}</div></article>
      </section>
      <section className="storybook-panel"><p className="eyebrow">Emotional weather</p><h2 className="growth-title">情绪只是天气，不是评价</h2><div className="emotion-weather">{Object.entries(MOODS).map(([key, mood]) => { const count = entries.filter((entry) => entry.mood === key).length; return <div key={key} style={{ '--mood-color': mood.color } as React.CSSProperties}><span>{mood.emoji}</span><strong>{mood.label}</strong><i style={{ height: `${Math.max(8, count * 12)}px` }} /><small>{count} 段</small></div>; })}</div></section>
      <section className="storybook-panel"><p className="eyebrow">Motifs</p><h2 className="growth-title">反复回到画面里的事物</h2><div className="motif-cloud justify-start">{motifs.map(({ motif, count }) => <span key={motif}><Sparkles size={13} />{motif}<small>{count}</small></span>)}</div></section>
    </div>
  );
}
