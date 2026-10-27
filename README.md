# Skyfrost

A top-down browser jet dogfighting game, inspired by Operation: Inner Space.

## Run it

```bash
npm install
npm run dev
```

This starts the game server (port 2567) and the Vite dev client together. Open http://localhost:5173, type a callsign, and press Enter. Open a second tab to fight yourself.

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
| Space | Fire |

## Layout

- `src/shared/` holds the game rules (plane movement, bullets, plane stats) and the network message types. It has no Phaser code, so the server runs the same rules.
- `server/` is the authoritative match server: a WebSocket server that simulates the free-for-all at 30 ticks a second and broadcasts snapshots.
- `src/client/` holds the Phaser scene, placeholder art, input, and the network client, which renders other planes slightly in the past and blends between snapshots so they move smoothly.

## Roadmap

1. Playable core, offline: fly, shoot, practice drones. ✅
2. Online free-for-all: shared arena, kills, respawns with a short spawn shield, kill feed, and leaderboard. ✅
3. Six planes in three factions (F-22, F-35, Su-57, Su-35, J-20, J-10), each with one unique skill.
4. Hosting and a scoreboard.
