import { useState } from 'react';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { BrandMark } from '@/components/BrandMark';
import { useGameStore } from '@/store/useGameStore';
import type { NarrativeLens, StoryPalette } from '@/types/narrative';

interface ProfileCreatorProps {
  onCreate: (nickname: string) => void;
}

export function ProfileCreator({ onCreate }: ProfileCreatorProps) {
  const [nickname, setNickname] = useState('');
  const [lens, setLens] = useState<NarrativeLens>('wanderer');
  const [palette, setPalette] = useState<StoryPalette>('dawn');
  const updateTheme = useGameStore((state) => state.updateThemeProfile);
  const theme = useGameStore((state) => state.themeProfile);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    onCreate(name);
    updateTheme({ ...theme, lens, palette });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 onboarding-shell">
      <PixelPanel className="w-full max-w-2xl text-center space-y-5 storybook-panel">
        <div className="onboarding-brand">
          <BrandMark variant="hero" />
          <p className="eyebrow">A private story world</p>
        </div>
        <p className="text-sm text-et-muted">把真实生活留在本机，再亲手决定哪些片段成为故事。</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="给自己取个旅人名字"
            className="w-full text-center"
            maxLength={12}
          />
          <fieldset className="text-left pt-2">
            <legend className="field-label">你更喜欢怎样讲故事？</legend>
            <div className="choice-grid three">
              {([['wanderer', '漫游者'], ['collector', '收藏家'], ['chronicler', '记录者']] as const).map(([value, label]) => (
                <button key={value} type="button" className={lens === value ? 'is-active' : ''} onClick={() => setLens(value)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="text-left pt-2">
            <legend className="field-label">选择第一本绘本的色板</legend>
            <div className="choice-grid four">
              {([['dawn', '晨曦'], ['forest', '森林'], ['midnight', '午夜'], ['paper', '纸页']] as const).map(([value, label]) => (
                <button key={value} type="button" className={`palette-chip palette-${value} ${palette === value ? 'is-active' : ''}`} onClick={() => setPalette(value)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <PixelButton type="submit" className="w-full">
            进入我的私人世界
          </PixelButton>
        </form>
      </PixelPanel>
    </div>
  );
}
