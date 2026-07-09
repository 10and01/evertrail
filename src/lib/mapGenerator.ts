import { createNoise2D } from 'simplex-noise';
import type { JournalEntry, MapNode, Mood } from '@/types/game';
import { MOODS } from './moods';
import { generateId } from './id';
import { WORLD_GROUND_Y } from './game/constants';

const SPACING = 720;
const SURFACE_AMP = 60;

type NodeEnvironment = 'surface' | 'cave' | 'sky' | 'deep';

function surfaceYAt(x: number, noise2D: (x: number, y: number) => number): number {
  const noise = noise2D(x * 0.005, 0);
  return WORLD_GROUND_Y + Math.round(noise * SURFACE_AMP / 32) * 32;
}

function chooseNodeEnvironment(seed: number): NodeEnvironment {
  // 优先分布在地表与洞穴，少量天空/深层以增加探索多样性。
  if (seed < 0.05) return 'sky';
  if (seed < 0.35) return 'cave';
  if (seed < 0.45) return 'deep';
  return 'surface';
}

function nodeYForEnvironment(env: NodeEnvironment, groundY: number, seed: number): number {
  switch (env) {
    case 'surface':
      return groundY - 40;
    case 'cave':
      // 洞穴层：地表下 3-5 格。
      return groundY + (3 + Math.floor(seed * 3)) * 32;
    case 'deep':
      // 深层：地表下 7-9 格。
      return groundY + (7 + Math.floor(seed * 3)) * 32;
    case 'sky':
      // 天空层：地表上 6-10 格。
      return groundY - (6 + Math.floor(seed * 5)) * 32;
  }
}

export function generateMapNodes(entries: JournalEntry[]): MapNode[] {
  const noise2D = createNoise2D(() => 0.42);
  return entries.map((entry, index) => {
    const nx = index * 0.7;
    const jitterX = Math.round(noise2D(nx, 0) * 30);
    const x = index * SPACING + 120 + jitterX;
    const groundY = surfaceYAt(x, noise2D);
    const envSeed = Math.abs(Math.sin((entry.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + index) * 123.45) % 1);
    const env = chooseNodeEnvironment(envSeed);
    return {
      id: generateId(),
      entryId: entry.id,
      index,
      x,
      y: nodeYForEnvironment(env, groundY, envSeed),
      biome: entry.mood,
      seed: entry.id,
    };
  });
}

export function biomeName(mood: Mood): string {
  const names: Record<Mood, string> = {
    joy: '阳光草地',
    calm: '晨雾森林',
    sad: '雨夜沼泽',
    angry: '熔岩裂谷',
    tired: '沉睡沙漠',
    anxious: '紫色迷雾',
  };
  return names[mood];
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nodes: MapNode[],
  cameraX: number,
  scale: number
) {
  const groundY = 420;
  ctx.save();
  ctx.scale(scale, scale);

  // sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a2f23');
  gradient.addColorStop(1, '#0f1c15');
  ctx.fillStyle = gradient;
  ctx.fillRect(cameraX / scale, 0, width / scale, height / scale);

  // distant hills
  ctx.beginPath();
  ctx.moveTo(cameraX / scale, groundY - 60);
  for (let i = 0; i <= width / scale; i += 20) {
    const x = cameraX / scale + i;
    const y = groundY - 80 + Math.sin(x * 0.01) * 30;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(cameraX / scale + width / scale, height / scale);
  ctx.lineTo(cameraX / scale, height / scale);
  ctx.closePath();
  ctx.fillStyle = '#14261d';
  ctx.fill();

  // ground
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(cameraX / scale, groundY, width / scale, height / scale - groundY);

  // terrain tops per node
  nodes.forEach((node) => {
    const bx = node.x;
    const by = node.y;
    const config = MOODS[node.biome as Mood] || MOODS.calm;

    // little biome pillar
    ctx.fillStyle = config.color + '33';
    ctx.fillRect(bx - 40, by + 24, 80, groundY - by - 24);

    ctx.fillStyle = config.color;
    ctx.fillRect(bx - 42, by + 20, 84, 8);
  });

  ctx.restore();
}
