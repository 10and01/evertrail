import { useState } from 'react';
import { DEFAULT_TAGS } from '@/lib/tags';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const suggestions = DEFAULT_TAGS.filter(
    (t) => !tags.includes(t) && t.includes(input.trim())
  ).slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm border border-et-border bg-et-panel"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-et-muted hover:text-et-gold"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input);
          }
        }}
        placeholder="输入标签后回车添加"
        className="w-full"
      />
      {input.trim() && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-xs px-2 py-1 border border-et-border hover:border-et-gold"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
