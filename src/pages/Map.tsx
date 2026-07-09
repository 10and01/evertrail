import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { MapCanvas } from '@/components/MapCanvas';
import { PixelPanel } from '@/components/ui/PixelPanel';
import type { Chapter } from '@/types/game';

export default function MapPage() {
  const nodes = useGameStore((s) => s.nodes);
  const entries = useGameStore((s) => s.entries);
  const chapters = useGameStore((s) => s.chapters);
  const hiddenChapters = useGameStore((s) => s.hiddenChapters);
  const talkedEchoIds = useGameStore((s) => s.talkedEchoIds);
  const unlockedHiddenChapterIds = useGameStore((s) => s.unlockedHiddenChapterIds);
  const activeChapterId = useGameStore((s) => s.activeChapterId);
  const setHiddenChapters = useGameStore((s) => s.setHiddenChapters);
  const talkEcho = useGameStore((s) => s.talkEcho);
  const unlockHiddenChapter = useGameStore((s) => s.unlockHiddenChapter);
  const setActiveChapter = useGameStore((s) => s.setActiveChapter);
  const navigate = useNavigate();

  const handleEnterChapter = (chapter: Chapter) => {
    navigate(`/chapters/${chapter.id}`);
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-0">
      <PixelPanel className="flex-1 relative p-0 overflow-hidden rounded-none border-0 h-full">
        {entries.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-et-muted">
            还没有记录，先去写一段旅程吧。
          </div>
        ) : (
          <>
            <MapCanvas
              nodes={nodes}
              entries={entries}
              chapters={chapters}
              hiddenChapters={hiddenChapters}
              talkedEchoIds={talkedEchoIds}
              unlockedHiddenChapterIds={unlockedHiddenChapterIds}
              activeChapterId={activeChapterId}
              onSelectEntry={() => {}}
              onEnterChapter={handleEnterChapter}
              onSetHiddenChapters={setHiddenChapters}
              onTalkEcho={talkEcho}
              onUnlockHiddenChapter={unlockHiddenChapter}
              onSetActiveChapter={setActiveChapter}
            />
            <button
              type="button"
              onClick={() => navigate('/')}
              className="absolute top-2 left-2 w-8 h-8 bg-et-panel/80 border border-et-border text-et-gold text-xs flex items-center justify-center hover:bg-et-panel z-30"
              aria-label="返回大厅"
            >
              ←
            </button>
          </>
        )}
      </PixelPanel>

    </div>
  );
}
