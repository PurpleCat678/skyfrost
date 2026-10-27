import { ARENA } from './arena';
import { GUN, MISSILE, missileTurnRate } from './weapons';
import type { Bullet, Missile, PlaneInput, PlaneSpec, PlaneState } from './types';

const BULLET_TTL = 1.1;
const NOSE_OFFSET = 26;
const AIRBRAKE_DECEL = 2.5; // multiple of normal accel
const AIRBRAKE_TURN = 1.6; // multiple of normal turn rate

export function spawnPlane(spec: PlaneSpec, x: number, y: number, angle = 0): PlaneState {
  return {
    x,
    y,
    angle,
    speed: (spec.minSpeed + spec.maxSpeed) / 2,
    hp: spec.maxHp,
    fireCooldown: 0,
    heat: 0,
    overheated: false,
    missiles: spec.missiles,
    missileCooldown: 0,
    missileReload: 0,
  };
}

export interface Shots {
  bullet: Bullet | null;
  missile: Missile | null;
}

export interface Lock {
  targetId: string | null;
  progress: number; // 0..1 of a full lock
}

const NO_LOCK: Lock = { targetId: null, progress: 0 };

/** Advances one plane by dt seconds and returns anything it fired this step. */
export function stepPlane(
  s: PlaneState,
  spec: PlaneSpec,
  input: PlaneInput,
  dt: number,
  ownerId: string,
  lock: Lock = NO_LOCK,
): Shots {
  const braking = spec.skill === 'airbrake' && input.skill;

  s.angle += input.turn * spec.turnRate * (braking ? AIRBRAKE_TURN : 1) * dt;

  // Without throttle input the jet settles back to cruise speed.
  const cruise = (spec.minSpeed + spec.maxSpeed) / 2;
  let target = input.throttle > 0 ? spec.maxSpeed : input.throttle < 0 ? spec.minSpeed : cruise;
  let accel = spec.accel;
  if (braking) {
    target = 0;
    accel *= AIRBRAKE_DECEL;
  }
  const maxChange = accel * dt;
  s.speed += Math.max(-maxChange, Math.min(maxChange, target - s.speed));

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

  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  const shots: Shots = { bullet: null, missile: null };

  // Guns heat up while firing; overheating locks them until fully cooled.
  s.fireCooldown = Math.max(0, s.fireCooldown - dt);
  const firing = input.fire && !s.overheated && s.fireCooldown === 0;
  if (!input.fire || s.overheated) {
    s.heat = Math.max(0, s.heat - (s.overheated ? GUN.overheatCoolPerSecond : GUN.coolPerSecond) * dt);
    if (s.heat === 0) s.overheated = false;
  }
  if (firing) {
    s.fireCooldown = spec.fireInterval;
    s.heat = Math.min(1, s.heat + GUN.heatPerShot);
    if (s.heat >= 1) s.overheated = true;
    const v = s.speed + spec.bulletSpeed;
    shots.bullet = {
      x: s.x + cos * NOSE_OFFSET,
      y: s.y + sin * NOSE_OFFSET,
      vx: cos * v,
      vy: sin * v,
      ttl: BULLET_TTL,
      damage: spec.bulletDamage,
      ownerId,
    };
  }

  // Missiles reload one at a time.
  if (s.missiles < spec.missiles) {
    s.missileReload -= dt;
    if (s.missileReload <= 0) {
      s.missiles++;
      s.missileReload = s.missiles < spec.missiles ? spec.missileReload : 0;
    }
  }
  s.missileCooldown = Math.max(0, s.missileCooldown - dt);
  if (input.missile && s.missiles > 0 && s.missileCooldown === 0) {
    if (s.missiles === spec.missiles) s.missileReload = spec.missileReload;
    s.missiles--;
    s.missileCooldown = MISSILE.launchGap;
    shots.missile = {
      x: s.x + cos * NOSE_OFFSET,
      y: s.y + sin * NOSE_OFFSET,
      vx: cos * MISSILE.speed,
      vy: sin * MISSILE.speed,
      ttl: MISSILE.ttl,
      ownerId,
      targetId: lock.progress > 0 ? lock.targetId : null,
      turnRate: missileTurnRate(lock.progress),
    };
  }

  return shots;
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

/**
 * Moves missiles, steering locked ones toward their target, and returns the
 * ones that timed out or reached the wall, removed from the list.
 */
export function stepMissiles(
  missiles: Missile[],
  dt: number,
  findTarget: (id: string) => { x: number; y: number } | null,
): Missile[] {
  const detonated: Missile[] = [];
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    const target = m.targetId ? findTarget(m.targetId) : null;
    if (target && m.turnRate > 0) {
      const heading = Math.atan2(m.vy, m.vx);
      const wanted = Math.atan2(target.y - m.y, target.x - m.x);
      const diff = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
      const maxTurn = m.turnRate * dt;
      const next = heading + Math.max(-maxTurn, Math.min(maxTurn, diff));
      m.vx = Math.cos(next) * MISSILE.speed;
      m.vy = Math.sin(next) * MISSILE.speed;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.ttl -= dt;
    if (m.ttl <= 0 || m.x <= 0 || m.y <= 0 || m.x >= ARENA.width || m.y >= ARENA.height) {
      m.x = Math.max(0, Math.min(ARENA.width, m.x));
      m.y = Math.max(0, Math.min(ARENA.height, m.y));
      detonated.push(...missiles.splice(i, 1));
    }
  }
  return detonated;
}

export function hits(p: { x: number; y: number }, x: number, y: number, radius: number): boolean {
  const dx = p.x - x;
  const dy = p.y - y;
  return dx * dx + dy * dy <= radius * radius;
}
