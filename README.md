# Skyfrost

A top-down browser jet dogfighting game, inspired by Operation: Inner Space.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Throttle up |
| S / ↓ | Brake |
| A / D or ← / → | Turn |
| Space | Fire |

## Layout

- `src/shared/` holds the game simulation (plane movement, bullets, plane stats). It has no Phaser code so the multiplayer server can run the same rules.
- `src/client/` holds the Phaser scene, placeholder art, and input.

## Roadmap

1. Playable core, offline: fly, shoot, practice drones. ✅
2. Online free-for-all server.
3. Six planes in three factions (F-22, F-35, Su-57, Su-35, J-20, J-10), each with one unique skill.
4. Hosting and a scoreboard.
