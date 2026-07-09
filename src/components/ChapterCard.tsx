import type { Chapter } from '@/types/game';

interface ChapterCardProps {
  chapter: Chapter;
  isActive?: boolean;
  onPlay: () => void;
  onSetActive?: () => void;
}

export function ChapterCard({ chapter, isActive, onPlay, onSetActive }: ChapterCardProps) {
  return (
    <div className="pixel-panel overflow-hidden">
      <div
        className="h-20 flex items-end p-3"
        style={{
          background: `linear-gradient(135deg, ${chapter.themeColor}22 0%, transparent 100%)`,
          borderBottom: `2px solid ${chapter.themeColor}`,
        }}
      >
        <div className="text-3xl" style={{ color: chapter.themeColor }}>
          ❖
        </div>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-display text-lg" style={{ color: chapter.themeColor }}>
          {chapter.title}
        </h3>
        <p className="text-xs text-et-muted">{chapter.subtitle}</p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onPlay}
            className="pixel-btn text-sm flex-1"
            style={{ background: chapter.themeColor, color: '#0f1c15' }}
          >
            播放章节
          </button>
          {onSetActive && (
            <button
              type="button"
              onClick={onSetActive}
              className={`pixel-btn text-sm flex-1 ${isActive ? 'opacity-70 cursor-default' : ''}`}
              disabled={isActive}
            >
              {isActive ? '当前章节' : '设为当前'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
