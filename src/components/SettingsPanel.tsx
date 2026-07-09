import React, { useCallback, useEffect, useRef } from 'react';
import type { GameSettings, LightingQuality, ParticleDensity } from '@/lib/settings';
import { AUDIO_PACKS } from '@/lib/game/AudioManager';

export interface SettingsPanelProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onClose: () => void;
}

const densityLabels: Record<ParticleDensity, string> = {
  off: '关闭',
  low: '低',
  medium: '中',
  high: '高',
};

const qualityLabels: Record<LightingQuality, string> = {
  low: '低（禁用径向渐变）',
  high: '高',
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const update = useCallback(
    <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      onChange({ ...settings, [key]: value });
    },
    [onChange, settings]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.focus();
  }, []);

  const renderSlider = (
    label: string,
    key: 'masterVolume' | 'sfxVolume' | 'musicVolume' | 'cameraSmoothSpeed',
    min: number,
    max: number,
    step: number,
    format: (v: number) => string
  ) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-et-gold">
        <span>{label}</span>
        <span>{format(settings[key])}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        onChange={(e) => update(key, Number(e.target.value))}
        className="w-full accent-et-gold h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );

  const renderSegmented = <T extends string>(
    label: string,
    key: keyof GameSettings,
    options: T[],
    labels: Record<T, string>
  ) => (
    <div className="space-y-1">
      <div className="text-xs text-et-gold">{label}</div>
      <div className="flex rounded border border-et-border overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => update(key, opt as GameSettings[typeof key])}
            className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
              settings[key] === opt
                ? 'bg-et-gold/20 text-et-gold border-et-gold'
                : 'bg-et-panel text-white/80 hover:bg-et-gold/10'
            }`}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  );

  const renderToggle = (label: string, key: 'screenShake' | 'reduceMotion' | 'atmosphereMode') => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-white/90">{label}</span>
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(e) => update(key, e.target.checked)}
        className="w-4 h-4 accent-et-gold"
      />
    </label>
  );

  return (
    <div
      className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4 pb-24 md:pb-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="游戏设置"
        className="w-full max-w-sm bg-et-panel/95 border border-et-border rounded-lg shadow-xl flex flex-col outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-et-border">
          <h2 className="text-et-gold font-bold">设置</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-et-gold hover:text-white"
            aria-label="关闭设置"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
          {renderSlider('主音量', 'masterVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
          {renderSlider('音效', 'sfxVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
          {renderSlider('音乐', 'musicVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}

          <div className="space-y-1">
            <div className="text-xs text-et-gold">背景音乐包</div>
            <select
              value={settings.audioPack}
              onChange={(e) => update('audioPack', e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-et-panel border border-et-border rounded text-white/90 outline-none focus:border-et-gold"
            >
              {Object.values(AUDIO_PACKS).map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} — {pack.description}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-white/60 leading-relaxed">
              选择外部音频包前，请将文件放入 public/audio/&lt;包名&gt;/&lt;心情&gt;.mp3；缺少文件时自动回退到合成器。
            </p>
          </div>

          {renderSlider('相机平滑速度', 'cameraSmoothSpeed', 0.02, 0.25, 0.01, (v) => `${v.toFixed(2)}`)}

          {renderSegmented('粒子密度', 'particleDensity', ['off', 'low', 'medium', 'high'], densityLabels)}
          {renderSegmented('光照质量', 'lightingQuality', ['low', 'high'], qualityLabels)}

          <div className="space-y-3 pt-2 border-t border-et-border/50">
            {renderToggle('氛围模式（关闭敌人与风暴）', 'atmosphereMode')}
            {settings.atmosphereMode && (
              <p className="text-[10px] text-white/60 leading-relaxed">
                开启后不再生成敌人、BOSS 与情绪风暴，专注探索与建造。
              </p>
            )}
            {renderToggle('屏幕震动', 'screenShake')}
            {renderToggle('减少动态效果', 'reduceMotion')}
            {settings.reduceMotion && (
              <p className="text-[10px] text-white/60 leading-relaxed">
                开启后自动禁用粒子、视差背景与相机抖动，降低前庭不适风险。
              </p>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-et-border text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-et-gold/20 text-et-gold border border-et-gold rounded hover:bg-et-gold/30 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
