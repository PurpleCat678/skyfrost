import { ARENA } from '../src/shared/arena';
import { PLANES } from '../src/shared/planes';
import type { PlaneInput, PlaneState } from '../src/shared/types';

export const BOT_NAMES = ['Viper', 'Jester', 'Goose', 'Hollywood', 'Sundown', 'Merlin', 'Cougar', 'Slider'];

const WALL_MARGIN = 280;
const GUN_RANGE = 650;
const GUN_CONE = 0.12; // radians either side of the nose
const MISSILE_RANGE = 1400;

interface Target {
  id: string;
  state: PlaneState;
}

/** Remembers a bot's mood between ticks so it doesn't fire every missile at once. */
export interface BotBrain {
  missileWait: number; // seconds until it's willing to launch again
  jitter: number; // small personal aiming error, radians
}

export function newBrain(): BotBrain {
  return { missileWait: 2 + Math.random() * 3, jitter: (Math.random() - 0.5) * 0.12 };
}

/** Picks a simple dogfighting input: chase the nearest enemy, shoot when lined up. */
export function botInput(
  brain: BotBrain,
  me: PlaneState,
  planeId: string,
  enemies: Target[],
  lock: number,
  dt: number,
): PlaneInput {
  brain.missileWait -= dt;
  const input: PlaneInput = {
    turn: 0,
    throttle: 0,
    fire: false,
    missile: false,
    skill: false,
    aimX: me.x,
    aimY: me.y,
  };

  let target: Target | null = null;
  let best = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.state.x - me.x, e.state.y - me.y);
    if (d < best) {
      best = d;
      target = e;
    }
  }

  // Lead the target a little, based on how long bullets take to arrive.
  let goalX = ARENA.width / 2;
  let goalY = ARENA.height / 2;
  if (target) {
    const t = target.state;
    const lead = Math.min(best / 1000, 0.6);
    goalX = t.x + Math.cos(t.angle) * t.speed * lead;
    goalY = t.y + Math.sin(t.angle) * t.speed * lead;
    input.aimX = t.x;
    input.aimY = t.y;
  }

  // Walls win over chasing.
  const nearWall =
    me.x < WALL_MARGIN || me.y < WALL_MARGIN || me.x > ARENA.width - WALL_MARGIN || me.y > ARENA.height - WALL_MARGIN;
  if (nearWall) {
    goalX = ARENA.width / 2;
    goalY = ARENA.height / 2;
  }

  const wanted = Math.atan2(goalY - me.y, goalX - me.x) + brain.jitter;
  const diff = Math.atan2(Math.sin(wanted - me.angle), Math.cos(wanted - me.angle));
  input.turn = Math.max(-1, Math.min(1, diff * 3));
  input.throttle = best > 900 ? 1 : Math.abs(diff) > 1.2 ? -1 : 0;

  if (target && !nearWall) {
    input.fire = best < GUN_RANGE && Math.abs(diff) < GUN_CONE && me.heat < 0.8;
    // Su-57 bots airbrake to swing round when the enemy is behind them and close.
    input.skill = PLANES[planeId].skill === 'airbrake' && Math.abs(diff) > 2.2 && best < 500;
    if (lock >= 1 && best < MISSILE_RANGE && brain.missileWait <= 0) {
      input.missile = true;
      brain.missileWait = 3 + Math.random() * 4;
    }
  }
  return input;
}
