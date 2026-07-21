import type { JournalEntry } from '@/types/game';
import type { StoryProject } from '@/types/narrative';
import { MOODS } from '@/lib/moods';

interface StorybookPreviewProps {
  project: StoryProject;
  entries: JournalEntry[];
  activeSceneId?: string;
  compact?: boolean;
}

export function StorybookPreview({ project, entries, activeSceneId, compact }: StorybookPreviewProps) {
  const ordered = project.sceneIds
    .map((id) => project.scenes.find((scene) => scene.id === id))
    .filter(Boolean) as StoryProject['scenes'];
  const scene = ordered.find((item) => item.id === activeSceneId) ?? ordered[0];
  const entry = scene ? entries.find((item) => item.id === scene.entryId) : undefined;
  const mood = entry ? MOODS[entry.mood] : MOODS.calm;

  return (
    <article className={`storybook-stage palette-${project.theme.palette} ${compact ? 'is-compact' : ''}`}>
      <div className="storybook-sky" />
      <div className="storybook-orb" style={{ background: mood.color }} />
      <div className="storybook-mist storybook-mist-a" />
      <div className="storybook-mist storybook-mist-b" />
      <div className="storybook-hills storybook-hills-back" />
      <div className="storybook-hills storybook-hills-front" />
      <div className="storybook-paper" />
      <div className="storybook-content">
        <p className="eyebrow">{project.subtitle || 'Evertrail Story'}</p>
        <h2>{scene?.title || project.title}</h2>
        {entry?.image && scene?.includeImage && (
          <img src={entry.image} alt={scene.title} className="storybook-image" />
        )}
        <p className="storybook-excerpt">{scene?.excerpt || project.description || '等待一段记忆成为故事。'}</p>
        {scene?.narration && <blockquote>{scene.narration}</blockquote>}
      </div>
      <footer>
        <span>{entry?.date || new Date(project.updatedAt).toLocaleDateString()}</span>
        <span>{ordered.length} 个场景</span>
      </footer>
    </article>
  );
}
