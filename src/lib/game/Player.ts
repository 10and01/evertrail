import type { Mood, PlayerState, Tile } from '@/types/game';
import type { ParticleSystem } from './ParticleSystem';
import {
  TILE_SIZE,
  GRAVITY,
  PLAYER_SPEED,
  JUMP_FORCE,
  FRICTION,
  AIR_FRICTION,
  MAX_FALL_SPEED,
  MOOD_FORMS,
  LIGHT_TIRED_REGEN_RATE,
  WATER_GRAVITY,
  WATER_BUOYANCY,
  WATER_MAX_FALL_SPEED,
  WATER_SPEED_MUL,
  WATER_JUMP_MUL,
} from './constants';
import { isSolidAt, tileAt } from './World';

export const PLAYER_WIDTH = 20;
export const PLAYER_HEIGHT = 28;

const ANIM_FRAME_DURATION = 100; // ms per walk frame
const WALK_FRAMES = 4;

export function createPlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: false,
    facingRight: true,
    animFrame: 0,
    animTimer: 0,
    light: 100,
    teleportCooldown: 0,
    tiredStandTimer: 0,
    toolEnergy: 100,
    airJumpsLeft: 0,
    maxAirJumps: 0,
  };
}

export function setPlayerPosition(player: PlayerState, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
}

export interface PlayerKeys {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  teleport: boolean;
  teleportPressed: boolean;
}

export interface PlayerUpdateContext {
  currentMoodForm: Mood;
  particles?: ParticleSystem;
  onLightRegen?: (amount: number) => void;
  onBrittleDestroy?: () => void;
  /** 装备风之羽等饰品后获得的额外空中跳跃次数。 */
  extraAirJumps?: number;
}

export function updatePlayer(
  player: PlayerState,
  keys: PlayerKeys,
  tiles: Tile[],
  deltaTime: number,
  speedMultiplier: number,
  context: PlayerUpdateContext
): void {
  const dt = deltaTime / (1000 / 60);
  const form = MOOD_FORMS[context.currentMoodForm];
  const inWater = isInWater(player, tiles);
  const waterSpeedMul = inWater ? WATER_SPEED_MUL : 1;
  const waterJumpMul = inWater ? WATER_JUMP_MUL : 1;
  const effectiveSpeed = PLAYER_SPEED * form.speedMul * speedMultiplier * waterSpeedMul;
  const effectiveJumpForce = (JUMP_FORCE + form.jumpBonus) * waterJumpMul;

  // Horizontal input and acceleration.
  const accel = effectiveSpeed * 0.5 * dt;
  let movedHorizontally = false;

  if (keys.left) {
    player.vx -= accel;
    player.facingRight = false;
    movedHorizontally = true;
  }
  if (keys.right) {
    player.vx += accel;
    player.facingRight = true;
    movedHorizontally = true;
  }

  // Clamp horizontal speed.
  if (player.vx > effectiveSpeed) player.vx = effectiveSpeed;
  if (player.vx < -effectiveSpeed) player.vx = -effectiveSpeed;

  // Apply friction when no directional input is held.
  if (!keys.left && !keys.right) {
    const friction = player.onGround ? FRICTION : AIR_FRICTION;
    player.vx *= friction;
    if (Math.abs(player.vx) < 0.05) {
      player.vx = 0;
    }
  }

  // Jump (from ground, while swimming, or extra air jump with wind-feather).
  const extraAirJumps = context.extraAirJumps ?? 0;
  if (extraAirJumps !== player.maxAirJumps) {
    player.maxAirJumps = extraAirJumps;
    player.airJumpsLeft = extraAirJumps;
  }
  if (keys.jumpPressed && (player.onGround || inWater)) {
    player.vy = effectiveJumpForce;
    player.onGround = false;
    player.airJumpsLeft = player.maxAirJumps;
  } else if (keys.jumpPressed && player.airJumpsLeft && player.airJumpsLeft > 0) {
    player.vy = effectiveJumpForce * 0.85;
    player.airJumpsLeft -= 1;
    context.particles?.emit('leaf', player.x + player.width / 2, player.y + player.height, 6);
  }

  // Anxious form short teleport.
  player.teleportCooldown = Math.max(0, (player.teleportCooldown ?? 0) - deltaTime);
  if (keys.teleportPressed && (player.teleportCooldown ?? 0) <= 0 && context.currentMoodForm === 'anxious') {
    const dir = player.facingRight ? 1 : -1;
    player.x += dir * 48;
    player.teleportCooldown = 2000;
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    context.particles?.emit('dust', cx, cy, 10);
    context.particles?.emit('sparkle', cx, cy, 6);
  }

  // Gravity / buoyancy and terminal velocity.
  if (inWater) {
    player.vy += WATER_GRAVITY * dt;
    player.vy -= WATER_BUOYANCY * dt;
    if (player.vy > WATER_MAX_FALL_SPEED) player.vy = WATER_MAX_FALL_SPEED;
    if (player.vy < -WATER_MAX_FALL_SPEED) player.vy = -WATER_MAX_FALL_SPEED;
  } else {
    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL_SPEED) {
      player.vy = MAX_FALL_SPEED;
    }
  }

  // Reset ground state; resolved again after vertical movement.
  player.onGround = false;

  // Horizontal movement and collision.
  player.x += player.vx;
  resolveHorizontalCollisions(player, tiles, context);

  // Vertical movement and collision.
  player.y += player.vy;
  resolveVerticalCollisions(player, tiles, context);

  // Tired form standing light regeneration.
  if (context.currentMoodForm === 'tired' && player.onGround && Math.abs(player.vx) < 0.1 && !keys.left && !keys.right) {
    player.tiredStandTimer = (player.tiredStandTimer ?? 0) + deltaTime;
    if ((player.tiredStandTimer ?? 0) >= 2000) {
      context.onLightRegen?.((LIGHT_TIRED_REGEN_RATE * deltaTime) / 1000);
    }
  } else {
    player.tiredStandTimer = 0;
  }

  // Standing-ground probe for cases with zero vertical velocity.
  if (!player.onGround && player.vy >= 0) {
    const groundPoints = [
      { x: player.x + 2, y: player.y + player.height + 1 },
      { x: player.x + player.width / 2, y: player.y + player.height + 1 },
      { x: player.x + player.width - 2, y: player.y + player.height + 1 },
    ];
    if (groundPoints.some((p) => isSolidAt(tiles, p.x, p.y))) {
      player.onGround = true;
      player.vy = 0;
    }
  }

  if (player.onGround) {
    player.airJumpsLeft = player.maxAirJumps;
  }

  // Walk animation.
  if (player.onGround && movedHorizontally && Math.abs(player.vx) > 0.1) {
    player.animTimer += deltaTime;
    if (player.animTimer >= ANIM_FRAME_DURATION) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % WALK_FRAMES;
    }
  } else {
    player.animTimer = 0;
    player.animFrame = 0;
  }
}

function resolveHorizontalCollisions(player: PlayerState, tiles: Tile[], context: PlayerUpdateContext): void {
  if (Math.abs(player.vx) < 0.01) return;

  const sampleY = [
    player.y + 2,
    player.y + player.height / 2,
    player.y + player.height - 2,
  ];

  if (player.vx > 0) {
    const edgeX = player.x + player.width;
    for (const sy of sampleY) {
      const tile = tileAt(tiles, edgeX, sy);
      if (tile && tile.type === 'brittle' && context.currentMoodForm === 'angry' && !tile.destroyed) {
        tile.destroyed = true;
        tile.solid = false;
        context.particles?.emit('debris', tile.x + TILE_SIZE / 2, tile.y + TILE_SIZE / 2, 8);
        context.onBrittleDestroy?.();
        continue;
      }
      if (isSolidAt(tiles, edgeX, sy)) {
        const tileX = Math.floor(edgeX / TILE_SIZE) * TILE_SIZE;
        player.x = tileX - player.width;
        player.vx = 0;
        return;
      }
    }
  } else {
    const edgeX = player.x;
    for (const sy of sampleY) {
      const tile = tileAt(tiles, edgeX, sy);
      if (tile && tile.type === 'brittle' && context.currentMoodForm === 'angry' && !tile.destroyed) {
        tile.destroyed = true;
        tile.solid = false;
        context.particles?.emit('debris', tile.x + TILE_SIZE / 2, tile.y + TILE_SIZE / 2, 8);
        context.onBrittleDestroy?.();
        continue;
      }
      if (isSolidAt(tiles, edgeX, sy)) {
        const tileX = Math.floor(edgeX / TILE_SIZE) * TILE_SIZE;
        player.x = tileX + TILE_SIZE;
        player.vx = 0;
        return;
      }
    }
  }
}

function resolveVerticalCollisions(player: PlayerState, tiles: Tile[], context: PlayerUpdateContext): void {
  if (Math.abs(player.vy) < 0.01) return;

  const sampleX = [
    player.x + 2,
    player.x + player.width / 2,
    player.x + player.width - 2,
  ];

  if (player.vy > 0) {
    // Falling / landing.
    const edgeY = player.y + player.height;
    for (const sx of sampleX) {
      const tile = tileAt(tiles, sx, edgeY);
      if (tile && tile.type === 'raincurtain' && context.currentMoodForm === 'sad') continue;
      if (isSolidAt(tiles, sx, edgeY)) {
        const tileY = Math.floor(edgeY / TILE_SIZE) * TILE_SIZE;
        player.y = tileY - player.height;
        player.vy = 0;
        player.onGround = true;
        return;
      }
    }
  } else {
    // Rising / hitting ceiling.
    const edgeY = player.y;
    for (const sx of sampleX) {
      const tile = tileAt(tiles, sx, edgeY);
      if (tile && tile.type === 'raincurtain' && context.currentMoodForm === 'sad') continue;
      if (isSolidAt(tiles, sx, edgeY)) {
        const tileY = Math.floor(edgeY / TILE_SIZE) * TILE_SIZE;
        player.y = tileY + TILE_SIZE;
        player.vy = 0;
        return;
      }
    }
  }
}

function isInWater(player: PlayerState, tiles: Tile[]): boolean {
  const probes = [
    { x: player.x + player.width / 2, y: player.y + player.height / 2 },
    { x: player.x + player.width / 2, y: player.y + player.height - 2 },
    { x: player.x + 2, y: player.y + player.height - 2 },
    { x: player.x + player.width - 2, y: player.y + player.height - 2 },
  ];
  return probes.some((p) => {
    const type = tileAt(tiles, p.x, p.y)?.type;
    return type === 'water' || type === 'lava';
  });
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  screenX: number,
  screenY: number
): void {
  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(
    screenX + player.width / 2,
    screenY + player.height - 2,
    player.width * 0.4,
    5,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const mirror = !player.facingRight;
  const px = (x: number, y: number, w: number, h: number) => {
    const drawX = mirror ? player.width - x - w : x;
    ctx.fillRect(screenX + drawX, screenY + y, w, h);
  };

  const frame = player.animFrame;
  const bounce = frame === 1 || frame === 3 ? -1 : 0;
  const legSwing = frame === 1 ? -2 : frame === 3 ? 2 : 0;
  const armSwing = frame === 1 ? 2 : frame === 3 ? -2 : 0;

  // Hair / hat.
  ctx.fillStyle = '#5d4037';
  px(4, 0, 12, 4);

  // Head.
  ctx.fillStyle = '#f5cba7';
  px(5, 3, 10, 9);

  // Eyes.
  ctx.fillStyle = '#2c3e50';
  if (mirror) {
    px(6, 6, 2, 2);
  } else {
    px(12, 6, 2, 2);
  }

  // Body (shirt).
  ctx.fillStyle = '#3498db';
  px(6, 12 + bounce, 8, 10);

  // Arms.
  ctx.fillStyle = '#f5cba7';
  // Back arm.
  px(3, 13 + bounce - armSwing, 3, 8);
  // Front arm.
  px(14, 13 + bounce + armSwing, 3, 8);

  // Pants.
  ctx.fillStyle = '#2c3e50';
  px(6, 22 + bounce, 3, 4);
  px(11, 22 + bounce, 3, 4);

  // Legs.
  ctx.fillStyle = '#34495e';
  // Back leg.
  px(6, 24 + bounce + legSwing, 3, 4);
  // Front leg.
  px(11, 24 + bounce - legSwing, 3, 4);
}
