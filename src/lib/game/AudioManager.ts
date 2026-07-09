import type { Mood } from '@/types/game';
import type { GameSettings } from '@/lib/settings';

export interface AudioManager {
  applySettings(settings: GameSettings): void;
  playJump(): void;
  playStep(): void;
  playCollect(): void;
  playOpenMemory(): void;
  playUnlock(): void;
  playTool(): void;
  playCraft(): void;
  playDamage(): void;
  playStorm(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setBiome(biome: Mood): void;
  setAudioPack(packName: string): void;
  getCurrentAudioPack(): string;
  getFrequencyData(): Uint8Array | null;
  isAnalyserEnabled(): boolean;
  setAnalyzerEnabled(enabled: boolean): void;
}

type BiomePreset = {
  baseFreq: number;
  harmony: number[];
  filterFreq: number;
  tempo: number;
  rainNoise?: boolean;
};

// 经过频谱分析后降低高频占比：
// - 和弦从 4 音减为 3 音，移除最高泛音；
// - filterFreq 整体下调 25%~35%，进一步削弱 1kHz 以上能量；
// - tempo 降低约 15%，减少听觉疲劳。
const BIOME_PRESETS: Record<Mood, BiomePreset> = {
  joy: {
    baseFreq: 392,
    harmony: [392, 523.25, 659.25],
    filterFreq: 1700,
    tempo: 0.15,
  },
  calm: {
    baseFreq: 330,
    harmony: [330, 392, 494],
    filterFreq: 1200,
    tempo: 0.2,
  },
  sad: {
    baseFreq: 293.66,
    harmony: [293.66, 349.23, 392],
    filterFreq: 850,
    tempo: 0.25,
    rainNoise: true,
  },
  angry: {
    baseFreq: 220,
    harmony: [220, 261.63, 329.63],
    filterFreq: 650,
    tempo: 0.12,
  },
  tired: {
    baseFreq: 196,
    harmony: [196, 246.94, 293.66],
    filterFreq: 500,
    tempo: 0.3,
  },
  anxious: {
    baseFreq: 261.63,
    harmony: [261.63, 311.13, 392],
    filterFreq: 1100,
    tempo: 0.1,
  },
};

export type AudioPackDefinition = {
  id: string;
  name: string;
  description: string;
  files: Partial<Record<Mood, string>>;
  source?: string;
  license?: string;
};

export const DEFAULT_AUDIO_PACK = 'synth';

// 三套基于合法网络音频资源库的备选方案。
// 实际文件请按路径放到 public/audio/<packId>/<mood>.mp3，代码会自动加载。
// 下方 source 为推荐来源（Freesound / OpenGameArt），请遵循对应授权协议。
export const AUDIO_PACKS: Record<string, AudioPackDefinition> = {
  [DEFAULT_AUDIO_PACK]: {
    id: DEFAULT_AUDIO_PACK,
    name: '合成器氛围',
    description: '当前程序化合成器，温暖低亮',
    files: {},
  },
  nature: {
    id: 'nature',
    name: '自然声景',
    description: '程序生成的风声、鸟鸣、雨声与虫鸣，沉浸且舒缓',
    files: {},
    source: '程序化自然音合成',
    license: '无需外部资源',
  },
  lofi: {
    id: 'lofi',
    name: '轻缓 Lo-Fi',
    description: '柔和节拍与钢琴循环，适合长时间游玩',
    files: {
      joy: 'lofi/joy.mp3',
      calm: 'lofi/calm.mp3',
      sad: 'lofi/sad.mp3',
      angry: 'lofi/angry.mp3',
      tired: 'lofi/tired.mp3',
      anxious: 'lofi/anxious.mp3',
    },
    source: 'OpenGameArt / FreePD lo-fi loops',
    license: 'CC-BY 3.0 / Public Domain',
  },
  piano: {
    id: 'piano',
    name: '钢琴弦乐',
    description: '钢琴与铺底弦乐，情绪叙事感强',
    files: {
      joy: 'piano/joy.mp3',
      calm: 'piano/calm.mp3',
      sad: 'piano/sad.mp3',
      angry: 'piano/angry.mp3',
      tired: 'piano/tired.mp3',
      anxious: 'piano/anxious.mp3',
    },
    source: 'Freesound / MusOpen CC-BY piano loops',
    license: 'CC-BY 3.0 / 需署名',
  },
};

export function createAudioManager(): AudioManager {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  let muted = false;
  let settings: GameSettings = {
    masterVolume: 0.8,
    sfxVolume: 0.7,
    musicVolume: 0.5,
    particleDensity: 'medium',
    lightingQuality: 'high',
    cameraSmoothSpeed: 0.08,
    screenShake: true,
    reduceMotion: false,
    atmosphereMode: true,
    audioPack: DEFAULT_AUDIO_PACK,
  };

  const masterGain = ctx.createGain();
  const bgmGain = ctx.createGain();
  const sfxGain = ctx.createGain();

  // 总线压缩：防止多个音效叠加时爆音，让整体更“成团”。
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;

  // 音效低通滤波：去掉刺耳高频，保留温暖主体。
  const sfxFilter = ctx.createBiquadFilter();
  sfxFilter.type = 'lowpass';
  // 将高频截止从 5200Hz 降至 3800Hz，减少 4kHz 以上刺耳泛音。
  sfxFilter.frequency.value = 3800;
  sfxFilter.Q.value = 0.7;

  // 氛围总线低通：进一步压低背景高频能量，防止听觉疲劳。
  const bgmFilter = ctx.createBiquadFilter();
  bgmFilter.type = 'lowpass';
  bgmFilter.frequency.value = 1800;
  bgmFilter.Q.value = 0.5;

  // 简单的氛围延迟/混响，让音效更悦耳、更有空间感。
  const delayNode = ctx.createDelay();
  delayNode.delayTime.value = 0.28;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.28;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 2200;

  // 频谱分析器：用于运行时观察高频能量，连接在总线之后。
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  let analyserEnabled = false;

  sfxGain.connect(sfxFilter);
  sfxFilter.connect(delayFilter);
  delayFilter.connect(delayNode);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayFilter);
  delayNode.connect(masterGain);
  sfxFilter.connect(masterGain);

  bgmGain.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(compressor);
  compressor.connect(ctx.destination);

  const updateGains = () => {
    const master = muted ? 0 : settings.masterVolume;
    masterGain.gain.setTargetAtTime(master, ctx.currentTime, 0.05);
    bgmGain.gain.setTargetAtTime(settings.musicVolume, ctx.currentTime, 0.05);
    sfxGain.gain.setTargetAtTime(settings.sfxVolume, ctx.currentTime, 0.05);
  };

  const ensureContext = async () => {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  };

  const now = () => ctx.currentTime;

  const createOsc = (type: OscillatorType, freq: number, destination: AudioNode) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(destination);
    return osc;
  };

  const createGain = (value: number) => {
    const gain = ctx.createGain();
    gain.gain.value = value;
    return gain;
  };

  const createNoiseBuffer = () => {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };

  const noiseBuffer = createNoiseBuffer();

  // Biome ambient loop state.
  let currentBiome: Mood = 'calm';
  let nextBiome: Mood | null = null;
  let lastStormTime = 0;
  let lastBiomeChangeTime = 0;
  const BIOME_CHANGE_COOLDOWN_MS = 8000;
  let ambientNodes: { osc: OscillatorNode; gain: GainNode; pan: number }[] = [];
  let noiseNode: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  const ambientGain = createGain(0);
  ambientGain.connect(bgmFilter);
  bgmFilter.connect(bgmGain);
  let scheduledEnd = 0;
  let ambientEnabled = false;

  // Audio pack state.
  let currentPackName = DEFAULT_AUDIO_PACK;
  const packBuffers = new Map<string, AudioBuffer>();
  const packLoading = new Map<string, Promise<void>>();
  let packSource: AudioBufferSourceNode | null = null;
  const packGain = ctx.createGain();
  const packFilter = ctx.createBiquadFilter();
  packGain.gain.value = 0;
  packFilter.type = 'lowpass';
  packFilter.frequency.value = 1800;
  packFilter.Q.value = 0.5;
  packFilter.connect(packGain);
  packGain.connect(bgmGain);

  const loadPack = async (packName: string) => {
    const pack = AUDIO_PACKS[packName];
    if (!pack || packName === DEFAULT_AUDIO_PACK) return;
    if (packLoading.has(packName)) return packLoading.get(packName);

    const promise = (async () => {
      for (const [mood, file] of Object.entries(pack.files)) {
        if (!file) continue;
        try {
          const response = await fetch(`${import.meta.env.BASE_URL || ''}audio/${file}`);
          if (!response.ok) {
            console.warn(`[Audio] failed to load ${file}: ${response.status}`);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          packBuffers.set(`${packName}:${mood}`, audioBuffer);
        } catch (err) {
          console.warn(`[Audio] decode error for ${file}:`, err);
        }
      }
    })();

    packLoading.set(packName, promise);
    return promise;
  };

  const stopPack = (fadeOut = 0.5) => {
    if (packSource) {
      try {
        const stopTime = ctx.currentTime + fadeOut;
        packGain.gain.cancelScheduledValues(ctx.currentTime);
        packGain.gain.setValueAtTime(packGain.gain.value, ctx.currentTime);
        packGain.gain.linearRampToValueAtTime(0, stopTime);
        packSource.stop(stopTime + 0.1);
      } catch {
        // ignore
      }
      packSource = null;
    }
  };

  const playPackLoop = (biome: Mood, delay = 0) => {
    const buffer = packBuffers.get(`${currentPackName}:${biome}`);
    if (!buffer) return false;

    stopPack(0.3);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(packFilter);

    const startTime = ctx.currentTime + delay;
    packGain.gain.cancelScheduledValues(ctx.currentTime);
    packGain.gain.setValueAtTime(0, ctx.currentTime);
    packGain.gain.linearRampToValueAtTime(0.6, startTime + 1.5);

    source.start(startTime);
    packSource = source;
    return true;
  };

  const createPinkNoiseBuffer = () => {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    return buffer;
  };

  const pinkNoiseBuffer = createPinkNoiseBuffer();

  const scheduleNatureChirp = (startTime: number, volume: number) => {
    const freq = 2200 + Math.random() * 1800;
    const duration = 0.06 + Math.random() * 0.1;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * (1.3 + Math.random() * 0.5), startTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ambientGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  };

  const scheduleCrickets = (startTime: number, endTime: number, volume: number) => {
    let t = startTime + Math.random();
    while (t < endTime - 1) {
      const freq = 3200 + Math.random() * 600;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      for (let i = 0; i < 6; i++) {
        const pulse = t + i * 0.07;
        gain.gain.linearRampToValueAtTime(volume, pulse);
        gain.gain.linearRampToValueAtTime(0.001, pulse + 0.035);
      }
      osc.connect(gain);
      gain.connect(ambientGain);
      osc.start(t);
      osc.stop(Math.min(t + 0.6, endTime));
      t += 0.8 + Math.random() * 2.5;
    }
  };

  const startNatureAmbient = (biome: Mood, delay = 0): boolean => {
    if (!ambientEnabled) return false;

    const startTime = ctx.currentTime + delay;
    const duration = 20;
    scheduledEnd = startTime + duration;

    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.6, startTime + 1.5);

    // 风层：用粉噪声加缓慢调制滤波器模拟自然风。
    const windSource = ctx.createBufferSource();
    windSource.buffer = pinkNoiseBuffer;
    windSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.5;

    const windGain = ctx.createGain();
    windGain.gain.value = 0;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambientGain);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08 + Math.random() * 0.06;
    const lfoGain = ctx.createGain();

    const baseFreq = biome === 'angry' ? 220 : biome === 'tired' ? 350 : biome === 'anxious' ? 450 : 600;
    const freqRange = biome === 'angry' ? 300 : biome === 'anxious' ? 250 : 200;
    windFilter.frequency.value = baseFreq;
    lfoGain.gain.value = freqRange;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const windVolume = biome === 'angry' ? 0.18 : biome === 'anxious' ? 0.12 : biome === 'tired' ? 0.06 : 0.09;
    windGain.gain.setValueAtTime(0, startTime);
    windGain.gain.linearRampToValueAtTime(windVolume, startTime + 2);
    windGain.gain.setValueAtTime(windVolume, startTime + duration - 2);
    windGain.gain.linearRampToValueAtTime(0, startTime + duration);

    windSource.start(startTime);
    windSource.stop(startTime + duration + 0.2);
    lfo.start(startTime);
    lfo.stop(startTime + duration + 0.2);

    // 雨层（忧伤生态）。
    if (biome === 'sad') {
      const rainSource = ctx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 900;
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0;
      rainSource.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(ambientGain);
      rainGain.gain.setValueAtTime(0, startTime);
      rainGain.gain.linearRampToValueAtTime(0.08, startTime + 1.5);
      rainGain.gain.setValueAtTime(0.08, startTime + duration - 1.5);
      rainGain.gain.linearRampToValueAtTime(0, startTime + duration);
      rainSource.start(startTime);
      rainSource.stop(startTime + duration + 0.2);
      noiseNode = { source: rainSource, gain: rainGain, filter: rainFilter };
    }

    // 鸟鸣（开心/平静生态）。
    if (biome === 'joy' || biome === 'calm') {
      let t = startTime + 1;
      const density = biome === 'joy' ? 0.5 : 0.25;
      while (t < startTime + duration - 2) {
        if (Math.random() < density) {
          scheduleNatureChirp(t, biome === 'joy' ? 0.035 : 0.025);
          if (Math.random() < 0.4) {
            scheduleNatureChirp(t + 0.08 + Math.random() * 0.1, biome === 'joy' ? 0.025 : 0.018);
          }
        }
        t += 0.6 + Math.random() * 2.5;
      }
    }

    // 虫鸣（疲惫生态）。
    if (biome === 'tired') {
      scheduleCrickets(startTime, startTime + duration, 0.025);
    }

    // 愤怒生态加入低沉雷鸣般的铺底。
    if (biome === 'angry') {
      const rumbleOsc = ctx.createOscillator();
      rumbleOsc.type = 'sawtooth';
      rumbleOsc.frequency.value = 45;
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 120;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0;
      rumbleOsc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(ambientGain);
      rumbleGain.gain.setValueAtTime(0, startTime);
      rumbleGain.gain.linearRampToValueAtTime(0.05, startTime + 2);
      rumbleGain.gain.setValueAtTime(0.05, startTime + duration - 2);
      rumbleGain.gain.linearRampToValueAtTime(0, startTime + duration);
      rumbleOsc.start(startTime);
      rumbleOsc.stop(startTime + duration + 0.2);
    }

    // 焦虑生态偶尔加入不和谐的短促高音。
    if (biome === 'anxious') {
      let t = startTime + 1;
      while (t < startTime + duration - 2) {
        if (Math.random() < 0.2) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1600, t);
          osc.frequency.exponentialRampToValueAtTime(800, t + 0.4);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.02, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.connect(gain);
          gain.connect(ambientGain);
          osc.start(t);
          osc.stop(t + 0.5);
        }
        t += 1.5 + Math.random() * 3;
      }
    }

    ambientNodes = [{ osc: lfo, gain: windGain, pan: 0 }];

    setTimeout(() => {
      if (currentBiome === biome && nextBiome === null && currentPackName === 'nature') {
        startNatureAmbient(biome, 0);
      }
    }, (duration - 1) * 1000);

    return true;
  };

  const startBiomeAmbient = (biome: Mood, delay = 0) => {
    if (!ambientEnabled) return;

    // 自然音效包：使用程序生成的风声、鸟鸣、雨声等自然音。
    if (currentPackName === 'nature' && startNatureAmbient(biome, delay)) {
      return;
    }

    // 若已选择外部音频包且当前心情有对应文件，则播放采样循环。
    if (currentPackName !== DEFAULT_AUDIO_PACK && playPackLoop(biome, delay)) {
      return;
    }

    const preset = BIOME_PRESETS[biome];

    // Fade in the ambient gain when first started.
    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + delay + 1.5);

    const startTime = ctx.currentTime + delay;
    scheduledEnd = startTime;

    // Build chord voices.
    const voices: typeof ambientNodes = [];
    for (const freq of preset.harmony) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset.filterFreq;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ambientGain);

      const attack = 0.3 + Math.random() * 0.3;
      const duration = preset.tempo * (4 + Math.random() * 3);
      const release = Math.min(0.3 + Math.random() * 0.3, duration * 0.4);

      // 降低单音音量，避免高频泛音堆叠后过亮。
      const peakVolume = 0.04 + Math.random() * 0.03;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peakVolume, startTime + attack);
      gain.gain.setValueAtTime(peakVolume, Math.max(startTime + attack, startTime + duration - release));
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);

      voices.push({ osc, gain, pan: Math.random() });
      scheduledEnd = Math.max(scheduledEnd, startTime + duration + 0.1);
    }

    // Optional rain noise layer for sad biome.
    if (preset.rainNoise) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ambientGain);

      const duration = preset.tempo * 8;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.05, startTime + 1);
      gain.gain.setValueAtTime(0.05, startTime + duration - 1);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      source.start(startTime);
      source.stop(startTime + duration + 0.2);
      noiseNode = { source, gain, filter };
      scheduledEnd = Math.max(scheduledEnd, startTime + duration + 0.2);
    }

    ambientNodes = voices;

    // Schedule next chord cycle.
    const nextDelay = preset.tempo * 4;
    setTimeout(() => {
      if (currentBiome === biome && nextBiome === null) {
        startBiomeAmbient(biome, 0);
      }
    }, nextDelay * 1000);
  };

  const crossfadeToBiome = (biome: Mood) => {
    if (biome === currentBiome) return;
    nextBiome = biome;

    // Fade out current ambient voices.
    const fadeOut = 1.2;
    for (const node of ambientNodes) {
      try {
        node.gain.gain.cancelScheduledValues(ctx.currentTime);
        node.gain.gain.setValueAtTime(node.gain.gain.value, ctx.currentTime);
        node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
        node.osc.stop(ctx.currentTime + fadeOut + 0.1);
      } catch {
        // ignore already stopped
      }
    }
    if (noiseNode) {
      try {
        noiseNode.gain.gain.cancelScheduledValues(ctx.currentTime);
        noiseNode.gain.gain.setValueAtTime(noiseNode.gain.gain.value, ctx.currentTime);
        noiseNode.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
        noiseNode.source.stop(ctx.currentTime + fadeOut + 0.2);
      } catch {
        // ignore
      }
      noiseNode = null;
    }

    stopPack(fadeOut);

    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);

    setTimeout(() => {
      currentBiome = biome;
      nextBiome = null;
      ambientGain.gain.setValueAtTime(0, ctx.currentTime);
      startBiomeAmbient(biome, 0);
    }, fadeOut * 1000);
  };

  const maybeStartAmbient = () => {
    if (!ambientEnabled) return;
    if (ctx.currentTime >= scheduledEnd - 0.5 && nextBiome === null) {
      startBiomeAmbient(currentBiome, 0);
    }
  };

  const playTone = async (
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    slideTo?: number,
    volume = 0.18,
    harmonics: { ratio: number; gain: number; type: OscillatorType }[] = []
  ) => {
    if (muted) return;
    await ensureContext();

    const t = now();
    const output = createGain(0);
    output.connect(sfxGain);

    const oscs: OscillatorNode[] = [];
    const mainOsc = createOsc(type, freq, output);
    oscs.push(mainOsc);

    for (const h of harmonics) {
      const hg = createGain(h.gain);
      hg.connect(output);
      const ho = createOsc(h.type, freq * h.ratio, hg);
      oscs.push(ho);
    }

    if (slideTo !== undefined) {
      for (const osc of oscs) {
        osc.frequency.setValueAtTime(osc.frequency.value, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo * (osc.frequency.value / freq), 20), t + duration);
      }
    }

    const attack = Math.min(0.02, duration * 0.15);
    const release = Math.min(0.25, duration * 0.5);
    output.gain.setValueAtTime(0, t);
    output.gain.linearRampToValueAtTime(volume, t + attack);
    output.gain.setValueAtTime(volume, t + duration - release);
    output.gain.exponentialRampToValueAtTime(0.001, t + duration);

    for (const osc of oscs) {
      osc.start(t);
      osc.stop(t + duration + 0.05);
    }
  };

  const playArpeggio = async (
    frequencies: number[],
    durationPerNote: number,
    type: OscillatorType = 'sine',
    volume = 0.12
  ) => {
    if (muted) return;
    await ensureContext();

    const t = now();

    frequencies.forEach((freq, i) => {
      const output = createGain(0);
      output.connect(sfxGain);

      const osc = createOsc(type, freq, output);
      // 加入轻微泛音让琶音更丰满。
      const hg = createGain(0.18);
      hg.connect(output);
      const harmonic = createOsc('triangle', freq * 1.5, hg);

      const start = t + i * durationPerNote;
      const end = start + durationPerNote;
      const attack = Math.min(0.02, durationPerNote * 0.2);
      const release = Math.min(0.12, durationPerNote * 0.4);

      output.gain.setValueAtTime(0, start);
      output.gain.linearRampToValueAtTime(volume, start + attack);
      output.gain.setValueAtTime(volume, Math.max(start + attack, end - release));
      output.gain.exponentialRampToValueAtTime(0.001, end);

      osc.start(start);
      harmonic.start(start);
      osc.stop(end + 0.05);
      harmonic.stop(end + 0.05);
    });
  };

  return {
    applySettings(nextSettings: GameSettings) {
      settings = nextSettings;
      updateGains();
    },

    playJump() {
      maybeStartAmbient();
      // 跳跃：柔和的三角波向上滑音，像轻声的呼气。
      playTone(180, 0.22, 'triangle', 520, 0.12, [
        { ratio: 1.5, gain: 0.08, type: 'sine' },
      ]);
    },

    playStep() {
      maybeStartAmbient();
      // 脚步声：低频短促正弦 + 轻微噪声感，不刺耳。
      playTone(95, 0.07, 'sine', 75, 0.07, [
        { ratio: 2.5, gain: 0.04, type: 'triangle' },
      ]);
    },

    playCollect() {
      maybeStartAmbient();
      // 收集：清脆的五声音阶，带一点延迟回响。
      playArpeggio([523.25, 659.25, 783.99, 1046.5], 0.08, 'sine', 0.1);
    },

    playOpenMemory() {
      maybeStartAmbient();
      // 开启回忆：舒缓的大调和弦琶音。
      playArpeggio([330, 392, 494, 659], 0.14, 'sine', 0.11);
    },

    playUnlock() {
      maybeStartAmbient();
      // 解锁：两段上扬琶音，像发现秘密时的闪光；整体下移八度避免过亮。
      playArpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.1, 'sine', 0.11);
      setTimeout(() => playArpeggio([659.25, 783.99, 1046.5, 1318.5], 0.12, 'sine', 0.1), 380);
    },

    playTool() {
      maybeStartAmbient();
      // 工具挥动：短促的“嗖”声，高频快速衰减。
      playTone(420, 0.12, 'triangle', 180, 0.1, [
        { ratio: 2.2, gain: 0.06, type: 'sine' },
      ]);
    },

    playCraft() {
      maybeStartAmbient();
      // 合成成功：温暖的和弦 + 金属泛音。
      playArpeggio([392, 494, 587.33, 783.99], 0.12, 'triangle', 0.11);
    },

    playDamage() {
      maybeStartAmbient();
      // 受伤：不和谐的低频下滑，用三角波替代锯齿波，减少刺耳感。
      playTone(150, 0.28, 'triangle', 60, 0.12, [
        { ratio: 1.41, gain: 0.08, type: 'sine' },
      ]);
    },

    playStorm() {
      maybeStartAmbient();
      // 避免频繁触发，每次风暴状态进入时只播放一次。
      const nowTime = Date.now();
      if (nowTime - lastStormTime < 10000) return;
      lastStormTime = nowTime;
      // 低沉不和谐音簇：小二度叠加，营造压迫感。
      playArpeggio([98, 103, 92, 110], 0.16, 'triangle', 0.12);
    },

    setMuted(value: boolean) {
      muted = value;
      updateGains();
    },

    isMuted() {
      return muted;
    },

    setBiome(biome: Mood) {
      maybeStartAmbient();
      if (!ambientEnabled) {
        ambientEnabled = true;
        currentBiome = biome;
        lastBiomeChangeTime = performance.now();
        startBiomeAmbient(biome, 0.2);
        return;
      }
      const nowMs = performance.now();
      if (biome === currentBiome) return;
      if (nowMs - lastBiomeChangeTime < BIOME_CHANGE_COOLDOWN_MS) return;
      lastBiomeChangeTime = nowMs;
      crossfadeToBiome(biome);
    },

    setAudioPack(packName: string) {
      if (!AUDIO_PACKS[packName]) packName = DEFAULT_AUDIO_PACK;
      if (packName === currentPackName) return;
      currentPackName = packName;
      if (packName === DEFAULT_AUDIO_PACK) {
        stopPack(0.5);
        return;
      }
      loadPack(packName).then(() => {
        if (ambientEnabled) {
          startBiomeAmbient(currentBiome, 0.2);
        }
      });
    },

    getCurrentAudioPack() {
      return currentPackName;
    },

    getFrequencyData() {
      if (!analyserEnabled) return null;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      return data;
    },

    isAnalyserEnabled() {
      return analyserEnabled;
    },

    setAnalyzerEnabled(enabled: boolean) {
      analyserEnabled = enabled;
    },
  };
}
