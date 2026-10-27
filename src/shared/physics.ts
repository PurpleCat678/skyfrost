import { ARENA } from './arena';
import type { Bullet, PlaneInput, PlaneSpec, PlaneState } from './types';

const BULLET_TTL = 1.1;
const NOSE_OFFSET = 26;

export function spawnPlane(spec: PlaneSpec, x: number, y: number, angle = 0): PlaneState {
  return { x, y, angle, speed: (spec.minSpeed + spec.maxSpeed) / 2, hp: spec.maxHp, fireCooldown: 0 };
}

/** Advances one plane by dt seconds. Returns a bullet if the plane fired this step. */
export function stepPlane(
  s: PlaneState,
  spec: PlaneSpec,
  input: PlaneInput,
  dt: number,
  ownerId: string,
): Bullet | null {
  s.angle += input.turn * spec.turnRate * dt;

  // Without throttle input the jet settles back to cruise speed.
  const cruise = (spec.minSpeed + spec.maxSpeed) / 2;
  const target = input.throttle > 0 ? spec.maxSpeed : input.throttle < 0 ? spec.minSpeed : cruise;
  const delta = target - s.speed;
  const maxChange = spec.accel * dt;
  s.speed += Math.max(-maxChange, Math.min(maxChange, delta));

  s.x += Math.cos(s.angle) * s.speed * dt;
  s.y += Math.sin(s.angle) * s.speed * dt;

  // Hitting the arena wall bounces you back in.
  if (s.x < 0 || s.x > ARENA.width) {
    s.x = Math.max(0, Math.min(ARENA.width, s.x));
    s.angle = Math.PI - s.angle;
  }
  if (s.y < 0 || s.y > ARENA.height) {
    s.y = Math.max(0, Math.min(ARENA.height, s.y));
    s.angle = -s.angle;
  }

  s.fireCooldown = Math.max(0, s.fireCooldown - dt);
  if (input.fire && s.fireCooldown === 0) {
    s.fireCooldown = spec.fireInterval;
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    const v = s.speed + spec.bulletSpeed;
    return {
      x: s.x + cos * NOSE_OFFSET,
      y: s.y + sin * NOSE_OFFSET,
      vx: cos * v,
      vy: sin * v,
      ttl: BULLET_TTL,
      damage: spec.bulletDamage,
      ownerId,
    };
  }
  return null;
}

/** Moves bullets and drops expired or out-of-bounds ones, in place. */
export function stepBullets(bullets: Bullet[], dt: number): void {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.ttl -= dt;
    if (b.ttl <= 0 || b.x < 0 || b.y < 0 || b.x > ARENA.width || b.y > ARENA.height) {
      bullets.splice(i, 1);
    }
  }
}

export function hits(b: Bullet, x: number, y: number, radius: number): boolean {
  const dx = b.x - x;
  const dy = b.y - y;
  return dx * dx + dy * dy <= radius * radius;
}
