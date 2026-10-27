import type { PlaneSpec } from './types';

// One Mach on the HUD equals this many px/s.
export const PX_PER_MACH = 210;

export const PLANES: Record<string, PlaneSpec> = {
  f22: {
    id: 'f22',
    name: 'F-22 Raptor',
    faction: 'usa',
    skill: 'stealth',
    skillName: 'Stealth: shows on enemy radar only every 3s',
    maxHp: 70,
    minSpeed: 160,
    maxSpeed: 480, // Mach 2.3
    accel: 300,
    turnRate: 3.0,
    fireInterval: 0.12,
    bulletSpeed: 650,
    bulletDamage: 8,
    missiles: 4,
    missileReload: 6,
    lockTime: 3,
    color: 0x9fb4c8,
  },
  su57: {
    id: 'su57',
    name: 'Su-57 Felon',
    faction: 'russia',
    skill: 'airbrake',
    skillName: 'Airbrake: hold SHIFT to stop dead and pivot',
    maxHp: 140,
    minSpeed: 130,
    maxSpeed: 400, // Mach 1.9
    accel: 260,
    turnRate: 3.8,
    fireInterval: 0.12,
    bulletSpeed: 650,
    bulletDamage: 8,
    missiles: 6,
    missileReload: 6,
    lockTime: 4,
    color: 0xb7c29a,
  },
};

export const PLANE_ORDER = ['f22', 'su57'];
