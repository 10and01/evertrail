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
    <div className="max-w-4xl mx-auto pb-20 md:pb-0">
      <h2 className="font-display text-2xl text-et-gold mb-4">
        {isEditing ? '编辑旅程' : '记录今日旅程'}
      </h2>
      <PixelPanel>
        <EntryForm
          initial={editingEntry}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      </PixelPanel>
    </div>
  );
}
