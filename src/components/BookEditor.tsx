import { useState, useEffect, useRef } from 'react';
import type { House } from '@/types/game';

interface Book {
  title: string;
  content: string;
}

interface BookEditorProps {
  house: House | undefined;
  target: { gx: number; gy: number };
  onClose: () => void;
  onSave: (books: Book[]) => void;
}

export function BookEditor({ house, target, onClose, onSave }: BookEditorProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const deco = house?.decorations.find((d) => d.gx === target.gx && d.gy === target.gy && d.kind === 'bookshelf');
    const initial = deco?.books?.length ? [...deco.books] : [{ title: '', content: '' }];
    setBooks(initial);
    setSelectedIndex(0);
  }, [house, target.gx, target.gy]);

  const selected = books[selectedIndex];

  const updateSelected = (patch: Partial<Book>) => {
    setBooks((prev) => {
      const next = [...prev];
      next[selectedIndex] = { ...next[selectedIndex], ...patch };
      return next;
    });
  };

  const addBook = () => {
    setBooks((prev) => {
      const next = [...prev, { title: '新书', content: '' }];
      return next;
    });
    setSelectedIndex(books.length);
  };

  const removeBook = () => {
    if (books.length <= 1) {
      setBooks([{ title: '', content: '' }]);
      return;
    }
    setBooks((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex((prev) => Math.max(0, prev - 1));
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const title = file.name.replace(/\.txt$/i, '');
      const content = String(reader.result ?? '');
      updateSelected({ title, content });
    };
    reader.readAsText(file);
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl bg-et-panel/95 border border-et-border rounded-lg shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-et-border">
          <h2 className="text-et-gold font-bold">编辑书架</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-et-gold hover:text-white"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 p-4 overflow-hidden flex-1 min-h-0">
          {/* 书籍列表 */}
          <div className="w-full md:w-48 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-et-gold">书籍</h3>
              <span className="text-xs text-white/50">{books.length}</span>
            </div>
            <div className="flex-1 overflow-auto border border-et-border/50 rounded p-1 space-y-1 max-h-32 md:max-h-none">
              {books.map((book, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors ${
                    idx === selectedIndex
                      ? 'bg-et-gold/20 text-et-gold border border-et-gold/50'
                      : 'text-white/80 hover:bg-et-panel'
                  }`}
                >
                  {book.title || '未命名'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addBook}
                className="flex-1 px-2 py-1 text-xs rounded border border-et-border hover:bg-et-panel text-et-gold"
              >
                新建
              </button>
              <button
                type="button"
                onClick={removeBook}
                className="flex-1 px-2 py-1 text-xs rounded border border-et-border hover:bg-et-panel text-white/80"
              >
                删除
              </button>
            </div>
          </div>

          {/* 编辑器 */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div>
              <label className="block text-xs text-et-muted mb-1">书名</label>
              <input
                type="text"
                value={selected?.title ?? ''}
                onChange={(e) => updateSelected({ title: e.target.value })}
                placeholder="输入书名"
                className="w-full px-2 py-1.5 bg-et-bg border border-et-border rounded text-sm text-white placeholder:text-white/30 focus:border-et-gold outline-none"
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-et-muted">内容</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-et-gold hover:text-white underline"
                >
                  从 .txt 导入
                </button>
              </div>
              <textarea
                value={selected?.content ?? ''}
                onChange={(e) => updateSelected({ content: e.target.value })}
                placeholder="在此书写你的故事、笔记或喜欢的文字..."
                className="flex-1 min-h-[120px] w-full px-2 py-1.5 bg-et-bg border border-et-border rounded text-sm text-white placeholder:text-white/30 focus:border-et-gold outline-none resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-et-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-et-border hover:bg-et-panel"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(books.filter((b) => b.title.trim() || b.content.trim()))}
            className="px-3 py-1.5 text-xs rounded bg-et-gold text-black font-bold hover:brightness-110"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
