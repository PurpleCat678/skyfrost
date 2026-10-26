import type { PlaneSpec } from './types';

// Step 1 ships one plane. The rest of the arsenal arrives in step 3.
export const PLANES: Record<string, PlaneSpec> = {
  f22: {
    id: 'f22',
    name: 'F-22 Raptor',
    faction: 'usa',
    maxHp: 100,
    minSpeed: 140,
    maxSpeed: 420,
    accel: 260,
    turnRate: 3.2,
    fireInterval: 0.12,
    bulletSpeed: 650,
    bulletDamage: 8,
    color: 0x9fb4c8,
  },
};
