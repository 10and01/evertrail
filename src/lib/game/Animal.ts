import type { Animal, AnimalKind, MapNode, Mood, PlayerState, Tile } from '@/types/game';
import { TILE_SIZE, WORLD_GROUND_Y } from './constants';
import { isSolidAt, tileAt } from './World';

const ANIMAL_CAP = 64;

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function findGroundY(tiles: Tile[], x: number, startY: number): number | null {
  for (let y = startY; y < startY + TILE_SIZE * 8; y += TILE_SIZE / 2) {
    if (isSolidAt(tiles, x, y + TILE_SIZE)) {
      return y;
    }
  }
  return null;
}

function findWaterSurface(tiles: Tile[], x: number, startY: number): number | null {
  for (let y = startY - TILE_SIZE * 4; y < startY + TILE_SIZE * 6; y += TILE_SIZE / 2) {
    const tile = tileAt(tiles, x, y + TILE_SIZE / 2);
    if (tile && tile.type === 'water') {
      return y;
    }
  }
  return null;
}

function kindsForBiome(biome: Mood): AnimalKind[] {
  switch (biome) {
    case 'joy':
    case 'calm':
      return ['rabbit', 'butterfly'];
    case 'sad':
      return ['fish', 'butterfly'];
    case 'tired':
      return ['rabbit', 'firefly'];
    case 'anxious':
      return ['firefly'];
    case 'angry':
      return ['bird', 'firefly'];
    default:
      return ['rabbit'];
  }
}

export function buildAnimals(nodes: MapNode[], tiles: Tile[]): Animal[] {
  if (nodes.length === 0) return [];
  const animals: Animal[] = [];
  const rand = seededRandom(hashString('animals'));

  for (const node of nodes) {
    const biome = (node.biome as Mood) || 'calm';
    const kinds = kindsForBiome(biome);
    const count = 2 + Math.floor(rand() * 3); // 2-4 animals per node

    for (let i = 0; i < count && animals.length < ANIMAL_CAP; i++) {
      const kind = kinds[Math.floor(rand() * kinds.length)];
      const side = rand() < 0.5 ? -1 : 1;
      const offsetX = (TILE_SIZE * 2 + Math.floor(rand() * TILE_SIZE * 3)) * side;
      const x = node.x + offsetX;

      let y = WORLD_GROUND_Y;
      if (kind === 'bird') {
        y = node.y - TILE_SIZE * (3 + Math.floor(rand() * 4));
      } else if (kind === 'fish') {
        const waterY = findWaterSurface(tiles, x, node.y);
        if (waterY === null) continue;
        y = waterY;
      } else if (kind === 'butterfly' || kind === 'firefly') {
        y = node.y - TILE_SIZE * (1 + Math.floor(rand() * 3));
      } else {
        const groundY = findGroundY(tiles, x, node.y - TILE_SIZE);
        if (groundY === null) continue;
        y = groundY;
      }

      animals.push({
        id: `animal-${node.id}-${i}-${kind}`,
        kind,
        biome,
        x: x - 8,
        y: y - (kind === 'rabbit' ? 12 : 8),
        width: 16,
        height: kind === 'rabbit' ? 14 : 12,
        vx: 0,
        vy: 0,
        state: 'idle',
      });
    }
  }

  return animals.slice(0, ANIMAL_CAP);
}

export function updateAnimals(animals: Animal[], player: PlayerState | null, tiles: Tile[], delta: number): void {
  const dt = delta / (1000 / 60);
  const px = player ? player.x + player.width / 2 : -Infinity;
  const py = player ? player.y + player.height / 2 : -Infinity;

  for (const animal of animals) {
    const cx = animal.x + animal.width / 2;
    const cy = animal.y + animal.height / 2;
    const distToPlayer = player ? Math.hypot(px - cx, py - cy) : Infinity;
    const flee = distToPlayer < 60;

    switch (animal.kind) {
      case 'rabbit': {
        animal.hopTimer = (animal.hopTimer ?? 0) - delta;
        if (animal.hopTimer <= 0) {
          animal.hopTimer = 800 + Math.random() * 1200;
          const dir = flee ? (cx < px ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;
          animal.vx = dir * (1.2 + Math.random() * 0.8);
          animal.vy = -3.5;
          animal.state = 'hop';
        }
        animal.vy += 0.25 * dt;
        animal.x += animal.vx * dt;
        animal.y += animal.vy * dt;
        // Ground collision.
        const groundY = findGroundY(tiles, cx, animal.y + animal.height);
        if (groundY !== null && animal.y + animal.height > groundY) {
          animal.y = groundY - animal.height;
          animal.vy = 0;
          animal.vx *= 0.92;
          if (Math.abs(animal.vx) < 0.1) animal.state = 'idle';
        }
        break;
      }
      case 'bird': {
        const dir = flee ? (cx < px ? -1 : 1) : Math.sin((Date.now() / 1000 + animal.x) * 0.5);
        animal.vx = dir * (1 + Math.random() * 0.5);
        animal.vy = Math.sin(Date.now() / 400 + animal.x) * 0.3;
        animal.x += animal.vx * dt;
        animal.y += animal.vy * dt;
        animal.state = 'fly';
        break;
      }
      case 'fish': {
        const dir = flee ? (cx < px ? -1 : 1) : Math.sin(Date.now() / 700 + animal.y);
        animal.vx = dir * (0.6 + Math.random() * 0.4);
        animal.vy = Math.sin(Date.now() / 500 + animal.x) * 0.2;
        animal.x += animal.vx * dt;
        animal.y += animal.vy * dt;
        animal.state = 'swim';
        // Keep inside water.
        const tile = tileAt(tiles, cx, cy);
        if (!tile || tile.type !== 'water') {
          animal.vx *= -1;
          animal.x += animal.vx * dt * 2;
        }
        break;
      }
      case 'butterfly':
      case 'firefly': {
        const dir = flee ? (cx < px ? -1 : 1) : Math.sin(Date.now() / 600 + animal.y);
        animal.vx = dir * (0.4 + Math.random() * 0.3);
        animal.vy = Math.sin(Date.now() / 400 + animal.x) * 0.4 - 0.1;
        animal.x += animal.vx * dt;
        animal.y += animal.vy * dt;
        animal.state = 'fly';
        break;
      }
    }

    // Soft world bounds.
    if (animal.x < -1000 || animal.x > 5000 || animal.y < -600 || animal.y > 1400) {
      animal.vx *= -1;
    }
  }
}
