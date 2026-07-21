import type { AnchorKind, ReflectionTone } from '@/types/life';

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ??= new AudioContextCtor();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => undefined);
  return audioContext;
}

function tone(frequency: number, delay: number, duration: number, gainValue = 0.035) {
  const ctx = context();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playAnchorCue(kind: AnchorKind) {
  const frequencies: Record<AnchorKind, number> = {
    place: 330,
    person: 392,
    object: 494,
    feeling: 440,
    meaning: 587,
  };
  tone(frequencies[kind], 0, 0.2);
  tone(frequencies[kind] * 1.5, 0.08, 0.24, 0.022);
}

export function playPuzzleCue(success: boolean) {
  if (success) {
    tone(392, 0, 0.2);
    tone(494, 0.1, 0.22);
    tone(659, 0.2, 0.32);
  } else {
    tone(220, 0, 0.16, 0.025);
    tone(196, 0.08, 0.2, 0.02);
  }
}

export function playResolutionCue(toneName: ReflectionTone) {
  const patterns: Record<ReflectionTone, number[]> = {
    hold: [392, 494, 587, 784],
    release: [523, 659, 784, 1046],
    continue: [330, 440, 523, 659],
  };
  patterns[toneName].forEach((frequency, index) => tone(frequency, index * 0.11, 0.34, 0.03));
}
