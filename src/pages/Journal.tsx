import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { EntryForm } from '@/components/EntryForm';
import { PixelPanel } from '@/components/ui/PixelPanel';

export default function Journal() {
  const { id } = useParams<{ id?: string }>();
  const addEntry = useGameStore((s) => s.addEntry);
  const updateEntry = useGameStore((s) => s.updateEntry);
  const entries = useGameStore((s) => s.entries);
  const navigate = useNavigate();

  const editingEntry = id ? entries.find((e) => e.id === id) : undefined;
  const isEditing = !!editingEntry;

  const handleSubmit = (data: Parameters<typeof addEntry>[0]) => {
    if (isEditing && editingEntry) {
      updateEntry({ ...editingEntry, ...data });
    } else {
      addEntry(data);
    }
    navigate('/');
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 md:pb-8 page-stack">
      <header className="page-hero compact-hero">
        <p className="eyebrow">Private Journal Room</p>
        <h1>{isEditing ? '编辑这段记忆' : '私密记录室'}</h1>
        <p>原始文字默认只保存在本机。只有明确设为故事素材并加入作品的内容才会被导出。</p>
      </header>
      <PixelPanel className="storybook-panel">
        <EntryForm
          initial={editingEntry}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      </PixelPanel>
    </div>
  );
}
