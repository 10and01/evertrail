import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { ChapterCard } from '@/components/ChapterCard';
import { ChapterEditor } from '@/components/ChapterEditor';
import { EventCard } from '@/components/EventCard';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import type { Chapter, JournalEntry } from '@/types/game';

export default function Chapters() {
  const chapters = useGameStore((s) => s.chapters);
  const entries = useGameStore((s) => s.entries);
  const manualChapters = useGameStore((s) => s.manualChapters);
  const activeChapterId = useGameStore((s) => s.activeChapterId);
  const [playing, setPlaying] = useState<Chapter | null>(null);
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();

  const createChapter = useGameStore((s) => s.createChapter);
  const updateChapter = useGameStore((s) => s.updateChapter);
  const deleteChapter = useGameStore((s) => s.deleteChapter);
  const moveEntry = useGameStore((s) => s.moveEntry);
  const reorderChapterEntries = useGameStore((s) => s.reorderChapterEntries);
  const setActiveChapter = useGameStore((s) => s.setActiveChapter);

  const getEntries = (chapter: Chapter) => {
    return chapter.entryIds
      .map((id) => entries.find((e) => e.id === id))
      .filter(Boolean) as typeof entries;
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-et-gold">章节回忆</h2>
        <div className="flex gap-2">
          <PixelButton type="button" onClick={() => setEditing(true)} className="text-sm">
            编辑章节
          </PixelButton>
          <PixelButton
            type="button"
            variant="secondary"
            onClick={() => navigate('/map')}
            className="text-sm"
          >
            进入世界
          </PixelButton>
        </div>
      </div>
      {chapters.length === 0 ? (
        <PixelPanel>记录还不够多，继续旅程后会自动生成章节。</PixelPanel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              isActive={activeChapterId === chapter.id}
              onPlay={() => setPlaying(chapter)}
              onSetActive={() => setActiveChapter(chapter.id)}
            />
          ))}
        </div>
      )}

      {playing && (
        <ChapterPlayer entries={getEntries(playing)} onClose={() => setPlaying(null)} />
      )}

      {editing && (
        <ChapterEditor
          chapters={manualChapters.length > 0 ? manualChapters : chapters}
          entries={entries}
          onUpdateChapter={updateChapter}
          onDeleteChapter={deleteChapter}
          onCreateChapter={createChapter}
          onMoveEntry={moveEntry}
          onReorderEntries={reorderChapterEntries}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function ChapterPlayer({ entries, onClose }: { entries: JournalEntry[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const entry = entries[index];

  return (
    <div className="fixed inset-0 z-50 bg-et-bg/95 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-et-muted">
            {index + 1} / {entries.length}
          </div>
          <button onClick={onClose} className="text-et-muted hover:text-et-gold">
            关闭
          </button>
        </div>
        {entry && <EventCard entry={entry} />}
        <div className="flex justify-between mt-4">
          <PixelButton
            variant="secondary"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            上一张
          </PixelButton>
          {index < entries.length - 1 ? (
            <PixelButton onClick={() => setIndex((i) => i + 1)}>下一张</PixelButton>
          ) : (
            <PixelButton onClick={onClose}>章节结束</PixelButton>
          )}
        </div>
      </div>
    </div>
  );
}
