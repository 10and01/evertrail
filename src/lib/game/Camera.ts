import type { CameraState } from '@/types/game';

export interface CameraShake {
  intensity: number;
  duration: number;
  elapsed: number;
}

export function createCamera(x = 0, y = 0): CameraState {
  return {
    x,
    y,
    zoom: 1,
    targetX: x,
    targetY: y,
    free: false,
  };
}

let shake: CameraShake | null = null;

export function shakeCamera(intensity: number, duration: number): void {
  shake = { intensity, duration, elapsed: 0 };
}

export function updateCameraShake(deltaTime: number, enabled = true): { x: number; y: number } {
  if (!shake || !enabled) return { x: 0, y: 0 };

  shake.elapsed += deltaTime;
  const progress = Math.min(shake.elapsed / shake.duration, 1);
  const decay = 1 - progress;
  const currentIntensity = shake.intensity * decay * decay;

  const x = (Math.random() * 2 - 1) * currentIntensity;
  const y = (Math.random() * 2 - 1) * currentIntensity;

  if (progress >= 1) {
    shake = null;
  }

  return { x, y };
}

export function updateCamera(
  camera: CameraState,
  targetX: number,
  targetY: number,
  viewWidth: number,
  viewHeight: number,
  worldMinX: number,
  worldMaxX: number,
  smooth = 0.08
): void {
  if (!camera.free) {
    camera.targetX = targetX - viewWidth / 2;
    camera.targetY = targetY - viewHeight / 2;
  }

  camera.x += (camera.targetX - camera.x) * smooth;
  camera.y += (camera.targetY - camera.y) * smooth;

  // Clamp camera within world bounds.
  camera.x = Math.max(worldMinX - 100, Math.min(camera.x, worldMaxX + 100 - viewWidth));
  // 取消相机垂直限制，允许自由上下探索。
}

export function screenToWorld(
  camera: CameraState,
  screenX: number,
  screenY: number
): { x: number; y: number } {
  return {
    x: screenX + camera.x,
    y: screenY + camera.y,
  };
}

export function worldToScreen(
  camera: CameraState,
  worldX: number,
  worldY: number
): { x: number; y: number } {
  return {
    x: worldX - camera.x,
    y: worldY - camera.y,
  };
}
