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
  color: number;
}

export interface PlaneState {
  x: number;
  y: number;
  angle: number; // radians, 0 = facing right
  speed: number;
  hp: number;
  fireCooldown: number;
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
}
