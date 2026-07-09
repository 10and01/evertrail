import localforage from 'localforage';

export type ParticleDensity = 'off' | 'low' | 'medium' | 'high';
export type LightingQuality = 'low' | 'high';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  particleDensity: ParticleDensity;
  lightingQuality: LightingQuality;
  cameraSmoothSpeed: number;
  screenShake: boolean;
  reduceMotion: boolean;
  atmosphereMode: boolean;
  audioPack: string;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.7,
  musicVolume: 0.5,
  particleDensity: 'medium',
  lightingQuality: 'high',
  cameraSmoothSpeed: 0.08,
  screenShake: true,
  reduceMotion: false,
  atmosphereMode: true,
  audioPack: 'nature',
};

const SETTINGS_KEY = 'evertrail-settings';

const db = localforage.createInstance({
  name: 'Evertrail',
  storeName: 'settings',
  description: 'Evertrail game settings',
});

export async function loadSettings(): Promise<GameSettings> {
  try {
    const saved = await db.getItem<Partial<GameSettings>>(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  try {
    await db.setItem(SETTINGS_KEY, settings);
  } catch {
    // ignore storage errors
  }
}

export function particleDensityMultiplier(density: ParticleDensity): number {
  switch (density) {
    case 'off':
      return 0;
    case 'low':
      return 0.4;
    case 'medium':
      return 1;
    case 'high':
      return 1.8;
  }
}
