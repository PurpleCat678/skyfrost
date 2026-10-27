// Messages sent over the WebSocket, as JSON.

export const TICK_RATE = 30; // server simulation and snapshot rate, per second
export const RESPAWN_MS = 3000;
export const SPAWN_SHIELD_MS = 2000;
export const PLANE_RADIUS = 20;
export const MAX_NAME_LENGTH = 16;

export type ClientMessage =
  | { t: 'join'; name: string; planeId: string }
  | { t: 'input'; turn: number; throttle: number; fire: boolean };

export interface PlayerSnapshot {
  id: string;
  name: string;
  planeId: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  hp: number;
  alive: boolean;
  shielded: boolean;
  kills: number;
  deaths: number;
}

export interface BulletSnapshot {
  x: number;
  y: number;
  angle: number;
}

export type ServerMessage =
  | { t: 'welcome'; id: string }
  | { t: 'snap'; time: number; players: PlayerSnapshot[]; bullets: BulletSnapshot[] }
  | { t: 'kill'; killer: string; victim: string; x: number; y: number };
