import Phaser from 'phaser';
import { ARENA } from '../shared/arena';
import { PLANES } from '../shared/planes';
import type { PlayerSnapshot } from '../shared/protocol';
import type { PlaneInput } from '../shared/types';
import type { KillEvent, Network } from './network';
import { makeTextures } from './textures';

const ENEMY_TINT = 0xff8a7a;
const FEED_SIZE = 5;
const FEED_TTL_MS = 6000;

interface PlaneView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  exhaust: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class ArenaScene extends Phaser.Scene {
  private views = new Map<string, PlaneView>();
  private bulletSprites: Phaser.GameObjects.Image[] = [];
  private explosions!: Phaser.GameObjects.Particles.ParticleEmitter;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private board!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private feed: { text: string; at: number }[] = [];
  private lastKiller = '';
  private names = new Map<string, string>();

  constructor(private net: Network) {
    super('arena');
  }

  create(): void {
    makeTextures(this);

    this.add.tileSprite(0, 0, ARENA.width, ARENA.height, 'grid').setOrigin(0);
    this.add.rectangle(0, 0, ARENA.width, ARENA.height).setOrigin(0).setStrokeStyle(4, 0x3a5a9a);

    this.explosions = this.add
      .particles(0, 0, 'dot', {
        lifespan: 700,
        speed: { min: 60, max: 280 },
        scale: { start: 1.8, end: 0 },
        tint: [0xffe58a, 0xff8c42, 0xd9534f],
        emitting: false,
      })
      .setDepth(5);

    this.cameras.main.setBounds(-200, -200, ARENA.width + 400, ARENA.height + 400);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');

    const font = { fontFamily: 'monospace', fontSize: '14px', color: '#cfe0ff' };
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.hud = this.add.text(16, 40, '', font).setScrollFactor(0).setDepth(10);
    this.board = this.add.text(0, 16, '', { ...font, align: 'right' }).setScrollFactor(0).setDepth(10).setOrigin(1, 0);
    this.feedText = this.add.text(0, 0, '', { ...font, align: 'right', color: '#ffd28a' }).setScrollFactor(0).setDepth(10).setOrigin(1, 0);
    this.banner = this.add
      .text(0, 0, '', { ...font, fontSize: '22px', color: '#ffffff', align: 'center' })
      .setScrollFactor(0)
      .setDepth(10)
      .setOrigin(0.5);
    this.help = this.add
      .text(16, 0, 'W/S throttle · A/D turn · SPACE fire', { ...font, fontSize: '12px', color: '#7f93bf' })
      .setScrollFactor(0)
      .setDepth(10);
    this.scale.on('resize', () => this.layout());
    this.layout();

    this.net.onKill = (e) => this.handleKill(e);
  }

  update(): void {
    this.net.sendInput(this.readInput());

    const players = this.net.interpolatedPlayers();
    for (const p of players) this.names.set(p.id, p.name);
    this.syncPlanes(players);
    this.syncBullets();
    this.updateHud(players);
  }

  private readInput(): PlaneInput {
    const k = this.keys;
    const left = k.A.isDown || k.LEFT.isDown;
    const right = k.D.isDown || k.RIGHT.isDown;
    const up = k.W.isDown || k.UP.isDown;
    const down = k.S.isDown || k.DOWN.isDown;
    return {
      turn: (right ? 1 : 0) - (left ? 1 : 0),
      throttle: (up ? 1 : 0) - (down ? 1 : 0),
      fire: k.SPACE.isDown,
    };
  }

  private syncPlanes(players: PlayerSnapshot[]): void {
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.id);
      let view = this.views.get(p.id);
      if (!view) {
        view = this.makeView(p);
        this.views.set(p.id, view);
      }
      const { sprite, label, exhaust } = view;
      sprite.setVisible(p.alive).setPosition(p.x, p.y).setRotation(p.angle);
      // Blink while spawn-shielded.
      sprite.setAlpha(p.shielded ? 0.4 + 0.4 * Math.sin(this.time.now / 60) : 1);
      label.setVisible(p.alive).setPosition(p.x, p.y - 36);
      exhaust.emitting = p.alive;
      exhaust.setPosition(p.x - Math.cos(p.angle) * 26, p.y - Math.sin(p.angle) * 26);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.sprite.destroy();
      view.label.destroy();
      view.exhaust.destroy();
      this.views.delete(id);
    }
  }

  private makeView(p: PlayerSnapshot): PlaneView {
    const mine = p.id === this.net.myId;
    const exhaust = this.add.particles(0, 0, 'dot', {
      lifespan: 350,
      speed: { min: 10, max: 40 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xffb347, 0xff6a3d],
      frequency: 16,
    });
    const sprite = this.add.image(p.x, p.y, 'jet').setTint(mine ? PLANES[p.planeId].color : ENEMY_TINT);
    const label = this.add
      .text(p.x, p.y, p.name, { fontFamily: 'monospace', fontSize: '12px', color: mine ? '#cfe0ff' : '#ffb3a8' })
      .setOrigin(0.5);
    if (mine) this.cameras.main.startFollow(sprite, true, 0.15, 0.15);
    return { sprite, label, exhaust };
  }

  private syncBullets(): void {
    const bullets = this.net.latest()?.bullets ?? [];
    while (this.bulletSprites.length < bullets.length) this.bulletSprites.push(this.add.image(0, 0, 'bullet'));
    this.bulletSprites.forEach((s, i) => {
      const b = bullets[i];
      s.setVisible(!!b);
      if (b) s.setPosition(b.x, b.y).setRotation(b.angle);
    });
  }

  private handleKill(e: KillEvent): void {
    this.explosions.explode(50, e.x, e.y);
    const cam = this.cameras.main;
    if (Phaser.Math.Distance.Between(cam.midPoint.x, cam.midPoint.y, e.x, e.y) < 700) cam.shake(150, 0.005);
    if (e.victim === this.net.myId) this.lastKiller = this.names.get(e.killer) ?? 'someone';
    const killer = this.names.get(e.killer) ?? '?';
    const victim = this.names.get(e.victim) ?? '?';
    this.feed.push({ text: `${killer} ✈ ${victim}`, at: this.time.now });
    if (this.feed.length > FEED_SIZE) this.feed.shift();
  }

  private updateHud(players: PlayerSnapshot[]): void {
    const me = players.find((p) => p.id === this.net.myId);

    this.hpBar.clear();
    if (me) {
      const spec = PLANES[me.planeId];
      const frac = Math.max(0, me.hp / spec.maxHp);
      this.hpBar.fillStyle(0x1a2440).fillRect(16, 16, 200, 14);
      this.hpBar.fillStyle(frac > 0.3 ? 0x4cd97b : 0xd9534f).fillRect(16, 16, 200 * frac, 14);
      this.hud.setText(`${spec.name}\nSPD ${me.speed}\nK ${me.kills}  D ${me.deaths}`);
    } else {
      this.hud.setText(this.net.connected ? 'Joining…' : 'Connecting to server…');
    }

    this.banner.setText(me && !me.alive ? `Shot down by ${this.lastKiller}\nRespawning…` : '');

    const top = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).slice(0, 5);
    this.board.setText(
      [`PILOTS ${players.length}`, ...top.map((p) => `${p.name.padEnd(16)} ${String(p.kills).padStart(3)}`)].join('\n'),
    );

    this.feed = this.feed.filter((f) => this.time.now - f.at < FEED_TTL_MS);
    this.feedText.setText(this.feed.map((f) => f.text).join('\n'));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.board.setX(width - 16);
    this.feedText.setPosition(width - 16, 140);
    this.banner.setPosition(width / 2, height / 2 - 80);
    this.help.setY(height - 28);
  }
}
