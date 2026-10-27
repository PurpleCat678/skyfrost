export const MISSILE = {
  speed: 900, // px/s, flies dead straight
  ttl: 12, // seconds before it detonates on its own
  launchGap: 0.4, // seconds between launches
  hitRadius: 24, // contact distance to a plane
  blastRadius: 120,
  blastDamageCenter: 60,
  blastDamageEdge: 20,
};

/** Blast damage at a distance from the center, or 0 outside the blast. */
export function blastDamage(distance: number): number {
  if (distance > MISSILE.blastRadius) return 0;
  const t = distance / MISSILE.blastRadius;
  return Math.round(MISSILE.blastDamageCenter + (MISSILE.blastDamageEdge - MISSILE.blastDamageCenter) * t);
}
