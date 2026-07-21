import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { createSceneFromEntry } from '@/lib/narrativeEngine';
import type { SceneLayout, SceneTransition, StoryProject } from '@/types/narrative';
import { StorybookPreview } from '@/components/StorybookPreview';

export default function Studio() {
  const entries = useGameStore((state) => state.entries);
  const projects = useGameStore((state) => state.storyProjects);
  const journeyProgress = useGameStore((state) => state.journeyProgress);
  const createStory = useGameStore((state) => state.createStory);
  const updateStory = useGameStore((state) => state.updateStory);
  const deleteStory = useGameStore((state) => state.deleteStory);
  const storyEntries = entries.filter((entry) => entry.visibility === 'story');
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? '');
  const [draftTitle, setDraftTitle] = useState('我的旅程故事');
  const [selectedEntries, setSelectedEntries] = useState<string[]>(storyEntries.map((entry) => entry.id));
  const [activeSceneId, setActiveSceneId] = useState<string>();

  const selected = selectedId === '__new__' ? undefined : projects.find((project) => project.id === selectedId) ?? projects[0];
  const availableEntries = useMemo(
    () => storyEntries.filter((entry) => !selected?.scenes.some((scene) => scene.entryId === entry.id)),
    [selected, storyEntries]
  );

  const create = () => {
    const id = createStory(draftTitle, selectedEntries);
    setSelectedId(id);
  };

  const patchProject = (patch: Partial<StoryProject>) => {
    if (!selected) return;
    updateStory({ ...selected, ...patch });
  };

  const updateScene = (sceneId: string, patch: Partial<StoryProject['scenes'][number]>) => {
    if (!selected) return;
    patchProject({
      scenes: selected.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene),
    });
  };

  const moveScene = (sceneId: string, direction: -1 | 1) => {
    if (!selected) return;
    const next = [...selected.sceneIds];
    const index = next.indexOf(sceneId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchProject({ sceneIds: next });
  };

  if (!selected) {
    return (
      <div className="page-stack pb-24 md:pb-8">
        <header className="page-hero compact-hero">
          <p className="eyebrow">Story Studio</p>
          <h1>故事工坊</h1>
          <p>把允许作为故事素材的记录编排成一段可以离线分享的动态绘本。</p>
        </header>
        <section className="storybook-panel max-w-3xl mx-auto w-full">
          {storyEntries.length === 0 ? (
            <div className="empty-story">
              <h2>还没有故事素材</h2>
              <p>在记录室中把一条记录设为“可作为故事素材”，它才会出现在这里。</p>
              <Link className="story-button" to="/journal">写一段记录</Link>
            </div>
          ) : (
            <>
              <label className="field-label">作品标题</label>
              <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="w-full" />
              <div className="scene-source-list mt-5">
                {storyEntries.map((entry) => (
                  <label key={entry.id} className="source-entry">
                    <input
                      type="checkbox"
                      checked={selectedEntries.includes(entry.id)}
                      onChange={() => setSelectedEntries((current) => current.includes(entry.id)
                        ? current.filter((id) => id !== entry.id)
                        : [...current, entry.id])}
                    />
                    <span><strong>{entry.date}</strong>{entry.text.slice(0, 80)}</span>
                  </label>
                ))}
              </div>
              <button type="button" className="story-button mt-5" onClick={create} disabled={!selectedEntries.length}>
                创建作品
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="studio-shell pb-24 md:pb-8">
      <aside className="studio-library storybook-panel">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="eyebrow">作品</p>
            <h1 className="text-xl font-display">故事工坊</h1>
          </div>
          <button type="button" className="icon-button" onClick={() => setSelectedId('__new__')} aria-label="新建作品">
            <Plus size={18} />
          </button>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedId(project.id)}
              className={project.id === selected.id ? 'is-active' : ''}
            >
              <strong>{project.title}</strong>
              <span>{project.scenes.length} 个场景</span>
            </button>
          ))}
        </div>
        <Link to="/gallery" className="story-button secondary w-full"><Eye size={16} /> 查看展厅</Link>
      </aside>

      <main className="studio-workspace">
        <div className="studio-toolbar storybook-panel">
          <input
            value={selected.title}
            onChange={(event) => patchProject({ title: event.target.value })}
            aria-label="作品标题"
            className="studio-title-input"
          />
          <div className="flex gap-2">
            <Link to={`/export?project=${selected.id}`} className="story-button">预览与导出</Link>
            <button
              type="button"
              className="icon-button danger"
              onClick={() => {
                deleteStory(selected.id);
                setSelectedId(projects.find((item) => item.id !== selected.id)?.id ?? '');
              }}
              aria-label="删除作品"
            ><Trash2 size={17} /></button>
          </div>
        </div>

        <StorybookPreview project={selected} entries={entries} activeSceneId={activeSceneId} />

        <section className="storybook-panel">
          <div className="theme-row">
            <label>副标题<input value={selected.subtitle} onChange={(event) => patchProject({ subtitle: event.target.value })} /></label>
            <label>色板
              <select value={selected.theme.palette} onChange={(event) => patchProject({ theme: { ...selected.theme, palette: event.target.value as StoryProject['theme']['palette'] } })}>
                <option value="dawn">晨曦</option><option value="forest">森林</option><option value="midnight">午夜</option><option value="paper">纸页</option>
              </select>
            </label>
            <label>节奏
              <select value={selected.theme.pacing} onChange={(event) => patchProject({ theme: { ...selected.theme, pacing: event.target.value as StoryProject['theme']['pacing'] } })}>
                <option value="quiet">安静</option><option value="balanced">平衡</option><option value="cinematic">电影感</option>
              </select>
            </label>
          </div>
        </section>

        <section className="scene-timeline">
          {selected.sceneIds.map((sceneId, index) => {
            const scene = selected.scenes.find((item) => item.id === sceneId);
            const entry = scene ? entries.find((item) => item.id === scene.entryId) : undefined;
            const keepsake = entry ? journeyProgress.keepsakes.find((item) => item.entryId === entry.id) : undefined;
            const reflection = keepsake?.sceneId ? journeyProgress.reflections[keepsake.sceneId] : undefined;
            if (!scene) return null;
            return (
              <article key={scene.id} className={`scene-editor storybook-panel ${activeSceneId === scene.id ? 'is-active' : ''}`} onClick={() => setActiveSceneId(scene.id)}>
                <header>
                  <span className="scene-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="scene-order-actions">
                    <button type="button" onClick={() => moveScene(scene.id, -1)} aria-label="前移"><ArrowUp size={15} /></button>
                    <button type="button" onClick={() => moveScene(scene.id, 1)} aria-label="后移"><ArrowDown size={15} /></button>
                    <button type="button" onClick={() => patchProject({ scenes: selected.scenes.filter((item) => item.id !== scene.id), sceneIds: selected.sceneIds.filter((id) => id !== scene.id) })} aria-label="移除"><Trash2 size={15} /></button>
                  </div>
                </header>
                <input value={scene.title} onChange={(event) => updateScene(scene.id, { title: event.target.value })} aria-label="场景标题" />
                <textarea value={scene.excerpt} onChange={(event) => updateScene(scene.id, { excerpt: event.target.value })} rows={4} aria-label="公开摘录" />
                <textarea value={scene.narration} onChange={(event) => updateScene(scene.id, { narration: event.target.value })} rows={2} placeholder="可公开的旁白" aria-label="公开旁白" />
                {keepsake && (
                  <div className={`scene-memory-material ${keepsake.resolutionTone ? `resolution-${keepsake.resolutionTone}` : ''}`}>
                    <span>✦ 旅程素材</span><strong>{keepsake.label}</strong><p>{keepsake.storyPrompt}</p>
                    {reflection?.customText && <blockquote>“{reflection.customText}”</blockquote>}
                    <button type="button" className="text-link" onClick={() => updateScene(scene.id, { narration: scene.narration || keepsake.storyPrompt || '' })}>用作公开旁白草稿</button>
                  </div>
                )}
                <div className="scene-options">
                  <select value={scene.transition} onChange={(event) => updateScene(scene.id, { transition: event.target.value as SceneTransition })} aria-label="转场">
                    <option value="fade">淡入</option><option value="page">翻页</option><option value="drift">漂移</option><option value="light">光晕</option>
                  </select>
                  <select value={scene.layout} onChange={(event) => updateScene(scene.id, { layout: event.target.value as SceneLayout })} aria-label="版式">
                    <option value="landscape">风景</option><option value="portrait">肖像</option><option value="letter">信笺</option>
                  </select>
                  {entry?.image && <label className="inline-check"><input type="checkbox" checked={scene.includeImage} onChange={(event) => updateScene(scene.id, { includeImage: event.target.checked })} />公开图片</label>}
                </div>
              </article>
            );
          })}
          {availableEntries.length > 0 && (
            <div className="add-scene storybook-panel">
              <select id="add-scene-select" defaultValue="">
                <option value="" disabled>选择一条故事素材</option>
                {availableEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.date} · {entry.text.slice(0, 28)}</option>)}
              </select>
              <button type="button" className="story-button" onClick={() => {
                const select = document.getElementById('add-scene-select') as HTMLSelectElement | null;
                const entry = availableEntries.find((item) => item.id === select?.value);
                if (!entry) return;
                const scene = createSceneFromEntry(entry);
                patchProject({ scenes: [...selected.scenes, scene], sceneIds: [...selected.sceneIds, scene.id] });
              }}>加入场景</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
