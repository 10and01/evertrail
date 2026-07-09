import { useState, useRef, useCallback } from 'react';
import type { JournalEntry } from '@/types/game';

interface PictureSelectorProps {
  entries: JournalEntry[];
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

export function PictureSelector({ entries, onSelect, onClose }: PictureSelectorProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const confirm = useCallback(() => {
    if (preview) onSelect(preview);
  }, [preview, onSelect]);

  const entriesWithImage = entries.filter((e) => e.image);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl bg-et-panel/95 border border-et-border rounded-lg shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-et-border">
          <h2 className="text-et-gold font-bold">选择相框图片</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-et-gold hover:text-white"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 p-4 overflow-auto">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm text-et-gold mb-2">来自日记</h3>
            {entriesWithImage.length === 0 ? (
              <p className="text-xs text-white/60">暂无日记图片。</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {entriesWithImage.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setPreview(entry.image!)}
                    className={`relative aspect-square rounded border overflow-hidden ${
                      preview === entry.image
                        ? 'border-et-gold ring-1 ring-et-gold'
                        : 'border-et-border/50 hover:border-et-gold/60'
                    }`}
                  >
                    <img
                      src={entry.image}
                      alt={entry.text.slice(0, 20)}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white truncate px-1">
                      {entry.text.slice(0, 12)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm text-et-gold mb-2">本地上传</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 rounded border border-dashed border-et-border/70 text-et-gold hover:border-et-gold hover:bg-et-gold/5 text-sm"
            >
              点击上传图片
            </button>
            {preview && (
              <div className="mt-3 aspect-video rounded border border-et-border overflow-hidden bg-black/40">
                <img src={preview} alt="预览" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-et-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded border border-et-border text-sm text-white/80 hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!preview}
            className="px-4 py-1.5 rounded border border-et-gold bg-et-gold/10 text-sm text-et-gold hover:bg-et-gold/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            挂到墙上
          </button>
        </div>
      </div>
    </div>
  );
}
