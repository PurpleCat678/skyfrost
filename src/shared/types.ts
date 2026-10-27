// Plain data shared by the client and the server.

export type Faction = 'usa' | 'russia' | 'china';

/**
 * stealth: shows on enemy radar only in a brief ping every few seconds.
 * airbrake: holding the skill key bleeds speed to a full stop and tightens turns.
 */
export type SkillId = 'stealth' | 'airbrake';

export interface PlaneSpec {
  id: string;
  name: string;
  faction: Faction;
  skill: SkillId;
  skillName: string;
  maxHp: number;
  minSpeed: number; // px/s, jets never stop (unless a skill says otherwise)
  maxSpeed: number; // px/s
  accel: number; // px/s^2
  turnRate: number; // rad/s
  fireInterval: number; // seconds between gun shots
  bulletSpeed: number; // px/s, added to plane speed
  bulletDamage: number;
  missiles: number; // missiles carried
  missileReload: number; // seconds to reload one missile
  lockTime: number; // seconds of cursor lock for a missile that never misses
  color: number;
}

export interface PlaneState {
  x: number;
  y: number;
  angle: number; // radians, 0 = facing right
  speed: number;
  hp: number;
  fireCooldown: number;
  heat: number; // gun heat, 0..1
  overheated: boolean; // guns locked until heat is back to 0
  missiles: number;
  missileCooldown: number; // short gap between launches
  missileReload: number; // time until the next missile is reloaded
}

export interface PlaneInput {
  turn: number; // -1 left, 1 right
  throttle: number; // -1 brake, 1 boost
  fire: boolean;
  missile: boolean;
  skill: boolean;
  aimX: number; // cursor position in the world, for missile lock
  aimY: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  damage: number;
  ownerId: string;
}

export interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  ownerId: string;
  targetId: string | null;
  turnRate: number; // rad/s it can steer toward its target; 0 flies straight
}
