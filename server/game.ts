import { ARENA } from '../src/shared/arena';
import { hits, spawnPlane, stepBullets, stepMissiles, stepPlane } from '../src/shared/physics';
import { PLANES } from '../src/shared/planes';
import {
  MAX_NAME_LENGTH,
  PLANE_RADIUS,
  RESPAWN_MS,
  SPAWN_SHIELD_MS,
  STEALTH_PING_EVERY_MS,
  STEALTH_PING_MS,
  type ServerMessage,
} from '../src/shared/protocol';
import type { Bullet, Missile, PlaneInput, PlaneState } from '../src/shared/types';
import { MISSILE, blastDamage } from '../src/shared/weapons';

interface Player {
  id: string;
  name: string;
  planeId: string;
  state: PlaneState;
  input: PlaneInput;
  alive: boolean;
  respawnAt: number;
  shieldUntil: number;
  pingOffset: number; // staggers stealth pings between players
  kills: number;
  deaths: number;
}

const NO_INPUT: PlaneInput = { turn: 0, throttle: 0, fire: false, missile: false, skill: false };

/** The authoritative free-for-all match. One instance per server. */
export class Game {
  private players = new Map<string, Player>();
  private bullets: Bullet[] = [];
  private missiles: Missile[] = [];

  constructor(private broadcast: (msg: ServerMessage) => void) {}

  join(id: string, rawName: string, planeId: string): void {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || `Pilot ${id.slice(0, 4)}`;
    const spec = PLANES[planeId] ?? PLANES.f22;
    const player: Player = {
      id,
      name,
      planeId: spec.id,
      state: spawnPlane(spec, 0, 0),
      input: { ...NO_INPUT },
      alive: true,
      respawnAt: 0,
      shieldUntil: 0,
      pingOffset: Math.random() * STEALTH_PING_EVERY_MS,
      kills: 0,
      deaths: 0,
    };
    this.respawn(player, Date.now());
    this.players.set(id, player);
  }

  leave(id: string): void {
    this.players.delete(id);
  }

  setInput(id: string, input: PlaneInput): void {
    const p = this.players.get(id);
    if (!p) return;
    // Never trust the client: clamp everything.
    p.input = {
      turn: clampUnit(input.turn),
      throttle: clampUnit(input.throttle),
      fire: input.fire === true,
      missile: input.missile === true,
      skill: input.skill === true,
    };
  }

  tick(dt: number): void {
    const now = Date.now();

    for (const p of this.players.values()) {
      if (!p.alive) {
        if (now >= p.respawnAt) this.respawn(p, now);
        continue;
      }
      const spec = PLANES[p.planeId];
      // Shielded planes can't fire, so spawn protection can't be abused.
      const input = now < p.shieldUntil ? { ...p.input, fire: false, missile: false } : p.input;
      const shots = stepPlane(p.state, spec, input, dt, p.id);
      if (shots.bullet) this.bullets.push(shots.bullet);
      if (shots.missile) this.missiles.push(shots.missile);
    }

    stepBullets(this.bullets, dt);
    for (const m of stepMissiles(this.missiles, dt)) this.explode(m, now);
    this.resolveBulletHits(now);
    this.resolveMissileHits(now);

    this.broadcast({
      t: 'snap',
      time: now,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        planeId: p.planeId,
        x: Math.round(p.state.x),
        y: Math.round(p.state.y),
        angle: Math.round(p.state.angle * 1000) / 1000,
        speed: Math.round(p.state.speed),
        hp: p.state.hp,
        alive: p.alive,
        shielded: now < p.shieldUntil,
        onRadar: this.onRadar(p, now),
        missiles: p.state.missiles,
        kills: p.kills,
        deaths: p.deaths,
      })),
      bullets: this.bullets.map(snapProjectile),
      missiles: this.missiles.map(snapProjectile),
    });
  }

  private onRadar(p: Player, now: number): boolean {
    if (PLANES[p.planeId].skill !== 'stealth') return true;
    return (now + p.pingOffset) % STEALTH_PING_EVERY_MS < STEALTH_PING_MS;
  }

  private resolveBulletHits(now: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      for (const p of this.players.values()) {
        if (!p.alive || p.id === b.ownerId || !hits(b, p.state.x, p.state.y, PLANE_RADIUS)) continue;
        this.bullets.splice(i, 1);
        this.damage(p, b.damage, b.ownerId, now);
        break;
      }
    }
  }

  private resolveMissileHits(now: number): void {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      for (const p of this.players.values()) {
        if (!p.alive || p.id === m.ownerId || !hits(m, p.state.x, p.state.y, MISSILE.hitRadius)) continue;
        this.missiles.splice(i, 1);
        this.explode(m, now);
        break;
      }
    }
  }

  /** Blast damage to everyone in range except the shooter. */
  private explode(m: Missile, now: number): void {
    this.broadcast({ t: 'boom', x: Math.round(m.x), y: Math.round(m.y) });
    for (const p of this.players.values()) {
      if (!p.alive || p.id === m.ownerId) continue;
      const dmg = blastDamage(Math.hypot(p.state.x - m.x, p.state.y - m.y));
      if (dmg > 0) this.damage(p, dmg, m.ownerId, now);
    }
  }

  private damage(p: Player, amount: number, attackerId: string, now: number): void {
    if (now < p.shieldUntil) return;
    p.state.hp -= amount;
    if (p.state.hp <= 0) this.kill(p, attackerId, now);
  }

  private kill(victim: Player, killerId: string, now: number): void {
    victim.alive = false;
    victim.state.hp = 0;
    victim.deaths++;
    victim.respawnAt = now + RESPAWN_MS;
    const killer = this.players.get(killerId);
    if (killer) killer.kills++;
    this.broadcast({ t: 'kill', killer: killerId, victim: victim.id, x: victim.state.x, y: victim.state.y });
  }

  private respawn(p: Player, now: number): void {
    const spec = PLANES[p.planeId];
    const margin = 300;
    const x = margin + Math.random() * (ARENA.width - margin * 2);
    const y = margin + Math.random() * (ARENA.height - margin * 2);
    // Face the middle of the arena so nobody spawns flying into a wall.
    const angle = Math.atan2(ARENA.height / 2 - y, ARENA.width / 2 - x);
    p.state = spawnPlane(spec, x, y, angle);
    p.alive = true;
    p.shieldUntil = now + SPAWN_SHIELD_MS;
  }
}

function snapProjectile(b: { x: number; y: number; vx: number; vy: number }) {
  return { x: Math.round(b.x), y: Math.round(b.y), angle: Math.round(Math.atan2(b.vy, b.vx) * 100) / 100 };
}

function clampUnit(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}
