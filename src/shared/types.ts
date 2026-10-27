// Plain data shared by the client and (in step 2) the server.

export type Faction = 'usa' | 'russia' | 'china';

export interface PlaneSpec {
  id: string;
  name: string;
  faction: Faction;
  maxHp: number;
  minSpeed: number; // px/s, jets never stop
  maxSpeed: number; // px/s
  accel: number; // px/s^2
  turnRate: number; // rad/s
  fireInterval: number; // seconds between shots
  bulletSpeed: number; // px/s, added to plane speed
  bulletDamage: number;
  color: number;
}

export interface PlaneState {
  x: number;
  y: number;
  angle: number; // radians, 0 = facing right
  speed: number;
  hp: number;
  fireCooldown: number;
}

export interface PlaneInput {
  turn: number; // -1 left, 1 right
  throttle: number; // -1 brake, 1 boost
  fire: boolean;
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
