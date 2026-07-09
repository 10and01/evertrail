import type { MoodFormKey, MoodForm } from '@/types/game';

export const TILE_SIZE = 32;
export const GRAVITY = 0.6;
export const PLAYER_SPEED = 4;
export const JUMP_FORCE = -12;
export const FRICTION = 0.8;
export const AIR_FRICTION = 0.95;
export const MAX_FALL_SPEED = 14;
export const CHUNK_WIDTH_TILES = 40;
export const WORLD_GROUND_Y = 416;
export const RENDER_MARGIN = 200;

export const BIOME_KEYS = ['joy', 'calm', 'sad', 'angry', 'tired', 'anxious'] as const;

export const MOOD_FORMS: Record<MoodFormKey, MoodForm> = {
  joy: {
    speedMul: 1.15,
    jumpBonus: 1.2,
    passiveName: '欢愉',
    passiveDesc: '身轻如燕，跳跃更高',
    auraParticle: 'sparkle',
  },
  calm: {
    speedMul: 1,
    jumpBonus: 0,
    passiveName: '宁静',
    passiveDesc: '脚步更轻，不易惊扰生灵',
    auraParticle: 'firefly',
  },
  sad: {
    speedMul: 0.9,
    jumpBonus: -0.5,
    passiveName: '忧伤',
    passiveDesc: '可穿行雨幕',
    auraParticle: 'rain',
  },
  angry: {
    speedMul: 1.05,
    jumpBonus: 0.5,
    passiveName: '愤怒',
    passiveDesc: '可破坏脆岩障碍',
    auraParticle: 'ember',
  },
  tired: {
    speedMul: 0.75,
    jumpBonus: -1,
    passiveName: '疲惫',
    passiveDesc: '静止站立时缓慢恢复光芒',
    auraParticle: 'dust',
  },
  anxious: {
    speedMul: 1.1,
    jumpBonus: 0,
    passiveName: '焦虑',
    passiveDesc: '按 Q 短距离瞬移',
    auraParticle: 'dust',
  },
};

export const LIGHT_MAX = 100;
export const LIGHT_RADIUS_MAX = 140;
export const LIGHT_RADIUS_MIN = 60;
export const LIGHT_RECOVERY_COLLECTIBLE = 5;
export const LIGHT_RECOVERY_WAYPOINT = 20;
export const LIGHT_DAMAGE_ENEMY = 15;
export const LIGHT_DAMAGE_FALL = 25;
export const LIGHT_TIRED_REGEN_RATE = 2; // 每秒恢复 2 点

export const WATER_GRAVITY = 0.18;
export const WATER_BUOYANCY = 0.28;
export const WATER_MAX_FALL_SPEED = 4.5;
export const WATER_SPEED_MUL = 0.55;
export const WATER_JUMP_MUL = 0.55;

export const CAMERA_SKY_MIN_Y = -400;
export const CAMERA_UNDERGROUND_MAX_Y = 1200;

// 昼夜循环：游戏内 24 小时对应现实世界分钟数。
export const DAY_LENGTH_MINUTES = 8;
export const HOURS_PER_DAY = 24;
