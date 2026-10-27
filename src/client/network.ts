import type { ClientMessage, PlayerSnapshot, ProjectileSnapshot, ServerMessage } from '../shared/protocol';
import type { PlaneInput } from '../shared/types';

// How far behind real time we render, so there are always two snapshots to blend between.
const INTERP_DELAY_MS = 100;
const INPUT_RESEND_MS = 250;

interface TimedSnap {
  at: number; // local arrival time
  players: Map<string, PlayerSnapshot>;
  bullets: ProjectileSnapshot[];
  missiles: ProjectileSnapshot[];
}

export interface KillEvent {
  killer: string;
  victim: string;
  x: number;
  y: number;
}

export class Network {
  myId: string | null = null;
  connected = false;
  onKill: (e: KillEvent) => void = () => {};
  onBoom: (x: number, y: number) => void = () => {};
  private ws: WebSocket;
  private snaps: TimedSnap[] = [];
  private lastInput = '';
  private lastSentAt = 0;

  constructor(name: string, planeId: string) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => {
      this.connected = true;
      this.send({ t: 'join', name, planeId });
    };
    this.ws.onclose = () => (this.connected = false);
    this.ws.onmessage = (ev) => this.handle(JSON.parse(ev.data) as ServerMessage);
  }

  sendInput(input: PlaneInput): void {
    const key = `${input.turn}|${input.throttle}|${input.fire}|${input.missile}|${input.skill}`;
    const now = performance.now();
    if (key === this.lastInput && now - this.lastSentAt < INPUT_RESEND_MS) return;
    this.lastInput = key;
    this.lastSentAt = now;
    this.send({ t: 'input', ...input });
  }

  /** Index of the first snapshot at or after the render time. */
  private renderIndex(): number {
    const renderAt = performance.now() - INTERP_DELAY_MS;
    let i = this.snaps.length - 1;
    while (i > 0 && this.snaps[i - 1].at > renderAt) i--;
    return i;
  }

  /** The snapshot at the render time, so bullets and missiles line up with the planes. */
  current(): TimedSnap | undefined {
    return this.snaps[this.renderIndex()];
  }

  /** Players blended between the two snapshots around the render time. */
  interpolatedPlayers(): PlayerSnapshot[] {
    const renderAt = performance.now() - INTERP_DELAY_MS;
    const i = this.renderIndex();
    const to = this.snaps[i];
    const from = this.snaps[i - 1];
    if (!to) return [];
    if (!from) return [...to.players.values()];

    const t = Math.max(0, Math.min(1, (renderAt - from.at) / (to.at - from.at || 1)));
    return [...to.players.values()].map((p) => {
      const a = from.players.get(p.id);
      // Snap instead of blending across a respawn teleport.
      if (!a || !a.alive || !p.alive) return p;
      return { ...p, x: lerp(a.x, p.x, t), y: lerp(a.y, p.y, t), angle: lerpAngle(a.angle, p.angle, t) };
    });
  }

  private handle(msg: ServerMessage): void {
    if (msg.t === 'welcome') {
      this.myId = msg.id;
    } else if (msg.t === 'snap') {
      this.snaps.push({
        at: performance.now(),
        players: new Map(msg.players.map((p) => [p.id, p])),
        bullets: msg.bullets,
        missiles: msg.missiles,
      });
      if (this.snaps.length > 30) this.snaps.shift();
    } else if (msg.t === 'boom') {
      this.onBoom(msg.x, msg.y);
    } else if (msg.t === 'kill') {
      this.onKill(msg);
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}
