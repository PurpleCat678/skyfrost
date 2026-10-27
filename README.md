# Skyfrost

A top-down browser jet dogfighting game, inspired by Operation: Inner Space.

## Run it

```bash
npm install
npm run dev
```

This starts the game server (port 2567) and the Vite dev client together. Open http://localhost:5173, type a callsign, pick a plane with ← →, and press Enter. Open a second tab to fight yourself.

To run it the way it will be hosted, with one server serving both the game and the page:

```bash
npm run build
npm start
```

Then open http://localhost:2567.

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Throttle up |
| S / ↓ | Brake |
| A / D or ← / → | Turn |
| Space | Guns |
| F or right-click | Missile |
| Shift | Plane skill |

## Planes

| Plane | Top speed | HP | Missiles | Skill |
| --- | --- | --- | --- | --- |
| F-22 Raptor (USA) | Mach 2.3 | 70 | 4 | Stealth: shows on enemy radar only in a brief ping every 3s |
| Su-57 Felon (Russia) | Mach 1.9 | 140 | 6 | Airbrake: hold Shift to bleed speed to a full stop and turn faster |

Missiles fly dead straight at 900 px/s, detonate on contact, at the arena wall, or after 12s, and blast everyone within 120 px except the shooter (60 damage at the center, 20 at the edge). One missile reloads every 6s.

All of these numbers live in `src/shared/planes.ts` and `src/shared/weapons.ts`. One Mach on the HUD is 210 px/s.

## Layout

- `src/shared/` holds the game rules (plane movement, bullets, plane stats) and the network message types. It has no Phaser code, so the server runs the same rules.
- `server/` is the authoritative match server: a WebSocket server that simulates the free-for-all at 30 ticks a second and broadcasts snapshots.
- `src/client/` holds the Phaser scene, placeholder art, input, and the network client, which renders other planes slightly in the past and blends between snapshots so they move smoothly.

## Roadmap

1. Playable core, offline: fly, shoot, practice drones. ✅
2. Online free-for-all: shared arena, kills, respawns with a short spawn shield, kill feed, and leaderboard. ✅
3. Missiles, radar, Mach speed, plane picker, F-22 and Su-57. ✅
4. The remaining jets: F-35, Su-35, J-20, J-10.
5. Hosting.
