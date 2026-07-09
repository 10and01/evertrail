import { useState } from 'react';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelPanel } from '@/components/ui/PixelPanel';

interface ProfileCreatorProps {
  onCreate: (nickname: string) => void;
}

export function ProfileCreator({ onCreate }: ProfileCreatorProps) {
  const [nickname, setNickname] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    onCreate(name);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <PixelPanel className="w-full max-w-md text-center space-y-4">
        <h1 className="font-display text-3xl text-et-gold">Evertrail</h1>
        <p className="text-sm text-et-muted">每个人的一生都是一场独特的旅行</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="给自己取个旅人名字"
            className="w-full text-center"
            maxLength={12}
          />
          <PixelButton type="submit" className="w-full">
            开始旅程
          </PixelButton>
        </form>
      </PixelPanel>
    </div>
  );
}
