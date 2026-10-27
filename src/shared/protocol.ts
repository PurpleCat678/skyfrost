// Messages sent over the WebSocket, as JSON.

export const TICK_RATE = 30; // server simulation and snapshot rate, per second
export const RESPAWN_MS = 3000;
export const SPAWN_SHIELD_MS = 2000;
export const PLANE_RADIUS = 20;
export const MAX_NAME_LENGTH = 16;
export const STEALTH_PING_EVERY_MS = 3000;
export const STEALTH_PING_MS = 400;
export const MAX_BOTS = 6;

export type ClientMessage =
  | { t: 'join'; name: string; planeId: string; bots?: number } // bots: AI pilot count for the whole match
  | ({ t: 'input' } & import('./types').PlaneInput);

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
  onRadar: boolean; // false while a stealth plane is between pings
  bot: boolean;
  missiles: number;
  heat: number; // gun heat 0..1, two decimals
  overheated: boolean;
  lockTarget: string | null; // who this plane's cursor is locking
  lock: number; // lock progress 0..1, two decimals
  kills: number;
  deaths: number;
}

export interface ProjectileSnapshot {
  x: number;
  y: number;
  angle: number;
}

export type ServerMessage =
  | { t: 'welcome'; id: string }
  | {
      t: 'snap';
      time: number;
      players: PlayerSnapshot[];
      bullets: ProjectileSnapshot[];
      missiles: ProjectileSnapshot[];
    }
  | { t: 'boom'; x: number; y: number }
  | { t: 'kill'; killer: string; victim: string; x: number; y: number };
