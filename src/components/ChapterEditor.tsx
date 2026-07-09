import { useState, useMemo } from 'react';
import type { Chapter, JournalEntry, Tile } from '@/types/game';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { MapEditor } from './MapEditor';

interface ChapterEditorProps {
  chapters: Chapter[];
  entries: JournalEntry[];
  manualTiles?: Record<string, Tile[]>;
  onUpdateChapter: (chapter: Chapter) => void;
  onDeleteChapter: (id: string) => void;
  onCreateChapter: (chapter: Omit<Chapter, 'id' | 'unlockedAt'>) => void;
  onMoveEntry: (payload: { entryId: string; fromChapterId: string; toChapterId: string }) => void;
  onReorderEntries: (chapterId: string, entryIds: string[]) => void;
  onSetChapterTiles?: (chapterId: string, tiles: Tile[]) => void;
  onClose: () => void;
}

export function ChapterEditor({
  chapters,
  entries,
  manualTiles,
  onUpdateChapter,
  onDeleteChapter,
  onCreateChapter,
  onMoveEntry,
  onReorderEntries,
  onSetChapterTiles,
  onClose,
}: ChapterEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(chapters[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<'chapter' | 'map'>('chapter');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedId),
    [chapters, selectedId]
  );

  const chapterEntries = useMemo(() => {
    if (!selectedChapter) return [];
    return selectedChapter.entryIds
      .map((id) => entries.find((e) => e.id === id))
      .filter((e): e is JournalEntry => !!e);
  }, [entries, selectedChapter]);

  const unassignedEntries = useMemo(() => {
    const assignedIds = new Set(chapters.flatMap((c) => c.entryIds));
    return entries.filter((e) => !assignedIds.has(e.id));
  }, [chapters, entries]);

  const getEntryPreview = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return '未知日志';
    const text = entry.text.slice(0, 24);
    return text.length >= 24 ? `${text}…` : text;
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onCreateChapter({
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || '自定义章节',
      startId: '',
      endId: '',
      entryIds: [],
      themeColor: '#87ceeb',
    });
    setNewTitle('');
    setNewSubtitle('');
    setIsCreating(false);
  };

  const moveEntryUp = (chapter: Chapter, index: number) => {
    if (index <= 0) return;
    const next = [...chapter.entryIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onReorderEntries(chapter.id, next);
  };

  const moveEntryDown = (chapter: Chapter, index: number) => {
    if (index >= chapter.entryIds.length - 1) return;
    const next = [...chapter.entryIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onReorderEntries(chapter.id, next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-et-bg/95 flex items-center justify-center p-4">
      <PixelPanel className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-et-gold">章节与日志管理</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-et-muted hover:text-et-gold"
          >
            关闭
          </button>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* 章节列表 */}
          <div className="w-64 flex flex-col gap-2 overflow-auto pr-2">
            <PixelButton
              type="button"
              onClick={() => setIsCreating(true)}
              className="text-sm"
            >
              + 新建章节
            </PixelButton>
            {isCreating && (
              <div className="space-y-2 p-2 border border-et-border rounded">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="章节标题"
                  className="w-full text-sm"
                />
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="副标题"
                  className="w-full text-sm"
                />
                <div className="flex gap-2">
                  <PixelButton type="button" onClick={handleCreate} className="flex-1 text-xs">
                    创建
                  </PixelButton>
                  <PixelButton
                    type="button"
                    variant="secondary"
                    onClick={() => setIsCreating(false)}
                    className="text-xs"
                  >
                    取消
                  </PixelButton>
                </div>
              </div>
            )}
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setSelectedId(chapter.id)}
                className={`text-left p-2 rounded border text-sm transition-colors ${
                  selectedId === chapter.id
                    ? 'border-et-gold bg-et-gold/10'
                    : 'border-et-border/50 hover:border-et-gold/60'
                }`}
              >
                <div className="font-medium truncate" style={{ color: chapter.themeColor }}>
                  {chapter.title}
                </div>
                <div className="text-xs text-et-muted truncate">{chapter.subtitle}</div>
              </button>
            ))}
          </div>

          {/* 章节详情 */}
          <div className="flex-1 overflow-auto min-w-0">
            {selectedChapter ? (
              <div className="space-y-4">
                <div className="flex gap-2 border-b border-et-border pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chapter')}
                    className={`text-sm px-3 py-1 rounded border ${
                      activeTab === 'chapter'
                        ? 'border-et-gold bg-et-gold/10 text-et-gold'
                        : 'border-et-border/50 text-et-muted hover:border-et-gold/60'
                    }`}
                  >
                    章节内容
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('map')}
                    className={`text-sm px-3 py-1 rounded border ${
                      activeTab === 'map'
                        ? 'border-et-gold bg-et-gold/10 text-et-gold'
                        : 'border-et-border/50 text-et-muted hover:border-et-gold/60'
                    }`}
                  >
                    地图编辑
                  </button>
                </div>

                {activeTab === 'chapter' ? (
                  <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-et-muted">标题</label>
                  <input
                    type="text"
                    value={selectedChapter.title}
                    onChange={(e) =>
                      onUpdateChapter({ ...selectedChapter, title: e.target.value })
                    }
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-et-muted">副标题</label>
                  <input
                    type="text"
                    value={selectedChapter.subtitle}
                    onChange={(e) =>
                      onUpdateChapter({ ...selectedChapter, subtitle: e.target.value })
                    }
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-et-muted">主题色</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedChapter.themeColor}
                      onChange={(e) =>
                        onUpdateChapter({ ...selectedChapter, themeColor: e.target.value })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <span className="text-xs text-et-muted">{selectedChapter.themeColor}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-et-muted">章节日志排布</label>
                    <span className="text-xs text-et-muted">
                      {selectedChapter.entryIds.length} 段记忆
                    </span>
                  </div>
                  {selectedChapter.entryIds.length === 0 ? (
                    <p className="text-sm text-white/50">还没有日志，可从下方未分配日志中添加。</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedChapter.entryIds.map((entryId, index) => (
                        <div
                          key={entryId}
                          className="flex items-center gap-2 p-2 rounded border border-et-border/50 bg-et-panel/50"
                        >
                          <span className="text-xs text-et-muted w-6">{index + 1}</span>
                          <span className="flex-1 text-sm truncate">{getEntryPreview(entryId)}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveEntryUp(selectedChapter, index)}
                              className="w-6 h-6 text-xs border border-et-border rounded hover:border-et-gold disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedChapter.entryIds.length - 1}
                              onClick={() => moveEntryDown(selectedChapter, index)}
                              className="w-6 h-6 text-xs border border-et-border rounded hover:border-et-gold disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onMoveEntry({
                                  entryId,
                                  fromChapterId: selectedChapter.id,
                                  toChapterId: 'unassigned',
                                })
                              }
                              className="w-6 h-6 text-xs border border-et-border rounded hover:border-red-400 text-red-300"
                              title="移出章节"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-et-muted">未分配日志</label>
                  {unassignedEntries.length === 0 ? (
                    <p className="text-sm text-white/50">所有日志都已归入章节。</p>
                  ) : (
                    <div className="space-y-1">
                      {unassignedEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-2 p-2 rounded border border-et-border/30"
                        >
                          <span className="flex-1 text-sm truncate">
                            {entry.text.slice(0, 28)}
                            {entry.text.length > 28 ? '…' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onMoveEntry({
                                entryId: entry.id,
                                fromChapterId: 'unassigned',
                                toChapterId: selectedChapter.id,
                              })
                            }
                            className="px-2 py-0.5 text-xs border border-et-gold text-et-gold rounded hover:bg-et-gold/10"
                          >
                            加入
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-et-border">
                  <PixelButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (confirm('确定删除这个章节吗？日志不会被删除。')) {
                        onDeleteChapter(selectedChapter.id);
                        setSelectedId(null);
                      }
                    }}
                    className="text-sm"
                  >
                    删除章节
                  </PixelButton>
                </div>
              </div>
            ) : (
              <MapEditor
                chapterId={selectedChapter.id}
                entries={chapterEntries}
                manualTiles={manualTiles?.[selectedChapter.id] ?? []}
                onChange={(tiles) => onSetChapterTiles?.(selectedChapter.id, tiles)}
              />
            )}
          </div>
        ) : (
          <div className="text-et-muted text-sm">选择一个章节进行编辑。</div>
        )}
        </div>
      </div>
      </PixelPanel>
    </div>
  );
}
