import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { TICK_RATE, type ClientMessage, type ServerMessage } from '../src/shared/protocol';
import { Game } from './game';

const PORT = Number(process.env.PORT ?? 2567);
const DIST = join(import.meta.dirname, '..', 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// In production the same server hosts the built client from dist/.
const http = createServer((req, res) => {
  const urlPath = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, urlPath);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end('Client not built. Run `npm run build`, or use `npm run dev` during development.');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server: http, path: '/ws' });
const sockets = new Map<string, WebSocket>();

const game = new Game((msg: ServerMessage) => {
  const data = JSON.stringify(msg);
  for (const ws of sockets.values()) if (ws.readyState === WebSocket.OPEN) ws.send(data);
});

wss.on('connection', (ws) => {
  const id = randomUUID();

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.t === 'join' && !sockets.has(id)) {
      sockets.set(id, ws);
      game.join(id, String(msg.name ?? ''), String(msg.planeId ?? ''));
      ws.send(JSON.stringify({ t: 'welcome', id } satisfies ServerMessage));
    } else if (msg.t === 'input') {
      game.setInput(id, msg);
    }
  });

  ws.on('close', () => {
    sockets.delete(id);
    game.leave(id);
  });
});

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  game.tick(Math.min((now - last) / 1000, 0.1));
  last = now;
}, 1000 / TICK_RATE);

http.listen(PORT, () => console.log(`Skyfrost server on http://localhost:${PORT}`));
