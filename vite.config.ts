import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // During development the game server runs separately on port 2567.
    proxy: { '/ws': { target: 'ws://localhost:2567', ws: true } },
  },
});
