import { useGameStore } from '@/store/useGameStore';
import type { NarrativeLens, StoryPacing, StoryPalette, ThemeProfile } from '@/types/narrative';

const choices = {
  lens: [['wanderer', '漫游者', '让地点与途中发现成为故事线索'], ['collector', '收藏家', '突出反复出现的物件与意象'], ['chronicler', '记录者', '以时间和文字为主要叙事结构']],
  palette: [['dawn', '晨曦'], ['forest', '森林'], ['midnight', '午夜'], ['paper', '纸页']],
  pacing: [['quiet', '安静'], ['balanced', '平衡'], ['cinematic', '电影感']],
} as const;

export default function Preferences() {
  const theme = useGameStore((state) => state.themeProfile);
  const update = useGameStore((state) => state.updateThemeProfile);
  const patch = (next: Partial<ThemeProfile>) => update({ ...theme, ...next });

  return (
    <div className="page-stack max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="page-hero compact-hero"><p className="eyebrow">Your Story Language</p><h1>主题与偏好</h1><p>这些选择只影响系统如何提出视觉与编排建议，随时可以修改。</p></header>
      <section className="storybook-panel preference-section">
        <h2>叙事视角</h2>
        <div className="choice-grid three">
          {choices.lens.map(([value, label, hint]) => <button key={value} type="button" className={theme.lens === value ? 'is-active' : ''} onClick={() => patch({ lens: value as NarrativeLens })}><strong>{label}</strong><span>{hint}</span></button>)}
        </div>
      </section>
      <section className="storybook-panel preference-section"><h2>绘本色板</h2><div className="choice-grid four">{choices.palette.map(([value, label]) => <button key={value} type="button" className={`palette-chip palette-${value} ${theme.palette === value ? 'is-active' : ''}`} onClick={() => patch({ palette: value as StoryPalette })}>{label}</button>)}</div></section>
      <section className="storybook-panel preference-section"><h2>播放节奏</h2><div className="choice-grid three">{choices.pacing.map(([value, label]) => <button key={value} type="button" className={theme.pacing === value ? 'is-active' : ''} onClick={() => patch({ pacing: value as StoryPacing })}>{label}</button>)}</div></section>
      <section className="storybook-panel preference-section"><label className="toggle-row"><span><strong>减少动态</strong><small>关闭大幅视差与自动转场，保留必要反馈。</small></span><input type="checkbox" checked={theme.reduceMotion} onChange={(event) => patch({ reduceMotion: event.target.checked })} /></label></section>
      <section className="storybook-panel preference-section"><label className="toggle-row"><span><strong>允许可选 AI 增强</strong><small>默认关闭。开启后也不会自动上传原文、图片、人物姓名或私人解释；只有未来主动确认增强时才可发送脱敏场景摘要，失败时始终使用本地结果。</small></span><input type="checkbox" checked={theme.aiEnhancementConsent} onChange={(event) => patch({ aiEnhancementConsent: event.target.checked })} /></label></section>
    </div>
  );
}
