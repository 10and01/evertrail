import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, FileImage, ShieldCheck } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { buildStoryPackage } from '@/lib/narrativeEngine';
import { buildStoryHTML, buildStoryPoster } from '@/lib/exportBuilder';
import { StorybookPreview } from '@/components/StorybookPreview';

export default function Export() {
  const [params] = useSearchParams();
  const projects = useGameStore((state) => state.storyProjects);
  const entries = useGameStore((state) => state.entries);
  const markStoryteller = useGameStore((state) => state.markStoryteller);
  const [projectId, setProjectId] = useState(params.get('project') ?? projects[0]?.id ?? '');
  const [error, setError] = useState('');
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  const packageData = useMemo(() => project ? buildStoryPackage(project, entries) : null, [project, entries]);

  const downloadHtml = () => {
    if (!packageData) return;
    const blob = new Blob([buildStoryHTML(packageData)], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${safeName(packageData.project.title)}.html`);
    markStoryteller();
  };

  const downloadPoster = async () => {
    if (!packageData) return;
    setError('');
    try {
      downloadBlob(await buildStoryPoster(packageData), `${safeName(packageData.project.title)}-long.png`);
      markStoryteller();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '长图生成失败');
    }
  };

  if (!project || !packageData) return <div className="empty-story storybook-panel max-w-2xl mx-auto"><h1>还没有可导出的作品</h1><p>导出不再包含整份私人存档。请先在故事工坊中创建作品。</p><Link to="/studio" className="story-button">进入故事工坊</Link></div>;

  return (
    <div className="page-stack pb-24 md:pb-8">
      <header className="page-hero compact-hero"><p className="eyebrow">Privacy Preview</p><h1>预览与导出</h1><p>这里看到的内容，就是离线作品中会出现的全部内容。</p></header>
      <div className="export-layout">
        <main><StorybookPreview project={project} entries={entries} /></main>
        <aside className="storybook-panel export-sidebar">
          <label className="field-label">选择作品</label>
          <select value={project.id} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <div className="privacy-summary"><ShieldCheck /><div><strong>隐私检查通过</strong><p>将导出 {packageData.entries.length} 个场景、{packageData.entries.filter((entry) => entry.image).length} 张明确选择的图片。</p></div></div>
          <ul className="privacy-list"><li>不包含私人原文之外的隐藏字段</li><li>不包含私人标签和个人意义</li><li>不包含游戏存档、背包与小屋</li><li>接收者无需联网即可浏览</li></ul>
          {packageData.entries.length === 0 && <p className="warning"><AlertTriangle size={16} />当前作品没有可公开场景。</p>}
          <button type="button" className="story-button w-full" onClick={downloadHtml} disabled={!packageData.entries.length}><Download size={17} />下载互动 HTML</button>
          <button type="button" className="story-button secondary w-full" onClick={downloadPoster} disabled={!packageData.entries.length}><FileImage size={17} />下载故事长图</button>
          <Link to="/studio" className="text-link">返回工坊调整公开内容</Link>
          {error && <p className="warning">{error}</p>}
        </aside>
      </div>
    </div>
  );
}

function safeName(name: string) { return name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'evertrail-story'; }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
