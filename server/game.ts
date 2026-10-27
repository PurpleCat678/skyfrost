import { ARENA } from '../src/shared/arena';
import { hits, spawnPlane, stepBullets, stepMissiles, stepPlane } from '../src/shared/physics';
import { PLANES, PLANE_ORDER } from '../src/shared/planes';
import {
  MAX_BOTS,
  MAX_NAME_LENGTH,
  PLANE_RADIUS,
  RESPAWN_MS,
  SPAWN_SHIELD_MS,
  STEALTH_PING_EVERY_MS,
  STEALTH_PING_MS,
  type ServerMessage,
} from '../src/shared/protocol';
import type { Bullet, Missile, PlaneInput, PlaneState } from '../src/shared/types';
import { LOCK, MISSILE, blastDamage } from '../src/shared/weapons';
import { BOT_NAMES, botInput, newBrain, type BotBrain } from './bot';

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
  brain: BotBrain | null; // set for AI pilots
  lockTargetId: string | null;
  lockTime: number; // seconds the cursor has stayed on lockTargetId
  kills: number;
  deaths: number;
}

const NO_INPUT: PlaneInput = { turn: 0, throttle: 0, fire: false, missile: false, skill: false, aimX: 0, aimY: 0 };

/** The authoritative free-for-all match. One instance per server. */
export class Game {
  private players = new Map<string, Player>();
  private bullets: Bullet[] = [];
  private missiles: Missile[] = [];

  constructor(private broadcast: (msg: ServerMessage) => void) {}

  join(id: string, rawName: string, planeId: string, brain: BotBrain | null = null): void {
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
      brain,
      lockTargetId: null,
      lockTime: 0,
      kills: 0,
      deaths: 0,
    };
    this.respawn(player, Date.now());
    this.players.set(id, player);
  }

  leave(id: string): void {
    this.players.delete(id);
  }

  /** Adds or removes AI pilots until there are exactly `count`. */
  setBotCount(count: number): void {
    const want = Math.max(0, Math.min(MAX_BOTS, Math.floor(Number(count) || 0)));
    const bots = [...this.players.values()].filter((p) => p.brain);
    for (const b of bots.slice(want)) this.leave(b.id);
    for (let i = bots.length; i < want; i++) {
      const taken = new Set([...this.players.values()].map((p) => p.name));
      const name = BOT_NAMES.find((n) => !taken.has(`AI ${n}`)) ?? `${i + 1}`;
      const planeId = PLANE_ORDER[Math.floor(Math.random() * PLANE_ORDER.length)];
      this.join(`bot-${name}-${Date.now()}`, `AI ${name}`, planeId, newBrain());
    }
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
      aimX: finiteOr(input.aimX, p.state.x),
      aimY: finiteOr(input.aimY, p.state.y),
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
      if (p.brain) p.input = botInput(p.brain, p.state, p.planeId, this.enemiesOf(p), this.lockProgress(p), dt);
      this.updateLock(p, dt);
      // Shielded planes can't fire, so spawn protection can't be abused.
      const input = now < p.shieldUntil ? { ...p.input, fire: false, missile: false } : p.input;
      const lock = { targetId: p.lockTargetId, progress: this.lockProgress(p) };
      const shots = stepPlane(p.state, spec, input, dt, p.id, lock);
      if (shots.bullet) this.bullets.push(shots.bullet);
      if (shots.missile) this.missiles.push(shots.missile);
    }

    stepBullets(this.bullets, dt);
    const findTarget = (id: string) => {
      const t = this.players.get(id);
      return t && t.alive ? t.state : null;
    };
    for (const m of stepMissiles(this.missiles, dt, findTarget)) this.explode(m, now);
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
        bot: p.brain !== null,
        missiles: p.state.missiles,
        heat: Math.round(p.state.heat * 100) / 100,
        overheated: p.state.overheated,
        lockTarget: p.lockTargetId,
        lock: Math.round(this.lockProgress(p) * 100) / 100,
        kills: p.kills,
        deaths: p.deaths,
      })),
      bullets: this.bullets.map(snapProjectile),
      missiles: this.missiles.map(snapProjectile),
    });
  }

  private enemiesOf(p: Player): { id: string; state: PlaneState }[] {
    const now = Date.now();
    return [...this.players.values()].filter((e) => e !== p && e.alive && now >= e.shieldUntil);
  }

  private lockProgress(p: Player): number {
    if (!p.lockTargetId) return 0;
    return Math.min(1, p.lockTime / PLANES[p.planeId].lockTime);
  }

  /** Locks onto the enemy under the cursor; moving off it, or it dying, starts over. */
  private updateLock(p: Player, dt: number): void {
    let hovered: Player | null = null;
    let best = LOCK.hoverRadius;
    for (const e of this.players.values()) {
      if (e === p || !e.alive) continue;
      if (Math.hypot(e.state.x - p.state.x, e.state.y - p.state.y) > LOCK.maxRange) continue;
      const d = Math.hypot(e.state.x - p.input.aimX, e.state.y - p.input.aimY);
      if (d <= best) {
        best = d;
        hovered = e;
      }
    }
    if (!hovered) {
      p.lockTargetId = null;
      p.lockTime = 0;
    } else if (hovered.id !== p.lockTargetId) {
      p.lockTargetId = hovered.id;
      p.lockTime = 0;
    } else {
      p.lockTime += dt;
    }
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
        const fused = m.targetId === p.id && m.turnRate >= MISSILE.fullLockTurn;
        const radius = fused ? MISSILE.proximityFuse : MISSILE.hitRadius;
        if (!p.alive || p.id === m.ownerId || !hits(m, p.state.x, p.state.y, radius)) continue;
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
    p.lockTargetId = null;
    p.lockTime = 0;
  }
}

function snapProjectile(b: { x: number; y: number; vx: number; vy: number }) {
  return { x: Math.round(b.x), y: Math.round(b.y), angle: Math.round(Math.atan2(b.vy, b.vx) * 100) / 100 };
}

function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampUnit(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}
