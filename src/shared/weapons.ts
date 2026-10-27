export const GUN = {
  heatPerShot: 0.04, // about 3s of continuous fire to overheat
  coolPerSecond: 0.35,
  overheatCoolPerSecond: 0.45, // locked out for about 2.2s after overheating
};

export const MISSILE = {
  speed: 900, // px/s
  ttl: 12, // seconds before it detonates on its own
  launchGap: 0.4, // seconds between launches
  hitRadius: 24, // contact distance to a plane
  proximityFuse: 50, // a fully locked missile detonates this close to its target
  blastRadius: 120,
  blastDamageCenter: 60,
  blastDamageEdge: 20,
  partialLockTurn: 2.5, // rad/s at just under a full lock; scales down with lock progress
  fullLockTurn: 9, // rad/s with a full lock: tight enough that it doesn't miss
};

export const LOCK = {
  hoverRadius: 60, // how close the cursor must be to a plane, in world px
  maxRange: 1600, // can't lock planes farther than this
};

/** Blast damage at a distance from the center, or 0 outside the blast. */
export function blastDamage(distance: number): number {
  if (distance > MISSILE.blastRadius) return 0;
  const t = distance / MISSILE.blastRadius;
  return Math.round(MISSILE.blastDamageCenter + (MISSILE.blastDamageEdge - MISSILE.blastDamageCenter) * t);
}

/** How hard a missile steers, from lock progress 0..1. */
export function missileTurnRate(lock: number): number {
  if (lock >= 1) return MISSILE.fullLockTurn;
  return MISSILE.partialLockTurn * Math.max(0, lock);
}
