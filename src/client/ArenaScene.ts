import Phaser from 'phaser';
import { ARENA } from '../shared/arena';
import { PLANES, PX_PER_MACH } from '../shared/planes';
import type { PlayerSnapshot, ProjectileSnapshot } from '../shared/protocol';
import type { PlaneInput } from '../shared/types';
import { MISSILE } from '../shared/weapons';
import type { KillEvent, Network } from './network';
import { makeTextures } from './textures';

const ENEMY_TINT = 0xff8a7a;
const FEED_SIZE = 5;
const FEED_TTL_MS = 6000;
const RADAR_RADIUS = 80; // on screen, px
const RADAR_RANGE = 1600; // in the world, px
const RADAR_MARGIN = 20;

interface PlaneView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  exhaust: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class ArenaScene extends Phaser.Scene {
  private views = new Map<string, PlaneView>();
  private bulletSprites: Phaser.GameObjects.Image[] = [];
  private missileSprites: Phaser.GameObjects.Image[] = [];
  private explosions!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private radar!: Phaser.GameObjects.Graphics;
  private lockRing!: Phaser.GameObjects.Graphics;
  private lockText!: Phaser.GameObjects.Text;
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

    this.smoke = this.add.particles(0, 0, 'dot', {
      lifespan: 500,
      speed: { min: 0, max: 15 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xbfc8d8,
      emitting: false,
    });
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
    this.keys = kb.addKeys('W,A,S,D,F,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,SHIFT');
    this.input.mouse?.disableContextMenu();
    this.input.setDefaultCursor('crosshair');
    this.lockRing = this.add.graphics().setDepth(6);
    this.lockText = this.add
      .text(0, 0, 'LOCK', { fontFamily: 'monospace', fontSize: '12px', color: '#ff5a4a' })
      .setOrigin(0.5)
      .setDepth(6);

    const font = { fontFamily: 'monospace', fontSize: '14px', color: '#cfe0ff' };
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.radar = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.hud = this.add.text(16, 40, '', font).setScrollFactor(0).setDepth(10);
    this.board = this.add.text(0, 16, '', { ...font, align: 'right' }).setScrollFactor(0).setDepth(10).setOrigin(1, 0);
    this.feedText = this.add
      .text(0, 0, '', { ...font, align: 'right', color: '#ffd28a' })
      .setScrollFactor(0)
      .setDepth(10)
      .setOrigin(1, 0);
    this.banner = this.add
      .text(0, 0, '', { ...font, fontSize: '22px', color: '#ffffff', align: 'center' })
      .setScrollFactor(0)
      .setDepth(10)
      .setOrigin(0.5);
    this.help = this.add
      .text(16, 0, 'W/S throttle · A/D turn · SPACE/left-click guns · hover to lock · F/right-click missile · SHIFT skill', {
        ...font,
        fontSize: '12px',
        color: '#7f93bf',
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.scale.on('resize', () => this.layout());
    this.layout();

    this.net.onKill = (e) => this.handleKill(e);
    this.net.onBoom = (x, y) => this.handleBoom(x, y);
  }

  update(): void {
    this.net.sendInput(this.readInput());

    const players = this.net.interpolatedPlayers();
    for (const p of players) this.names.set(p.id, p.name);
    this.syncPlanes(players);
    const snap = this.net.current();
    this.syncProjectiles(this.bulletSprites, snap?.bullets ?? [], 'bullet');
    this.syncProjectiles(this.missileSprites, snap?.missiles ?? [], 'missile');
    for (const m of snap?.missiles ?? []) this.smoke.emitParticleAt(m.x - Math.cos(m.angle) * 10, m.y - Math.sin(m.angle) * 10);
    this.updateHud(players);
    this.drawRadar(players);
    this.drawLock(players);
  }

  private readInput(): PlaneInput {
    const k = this.keys;
    const pointer = this.input.activePointer;
    const aim = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const left = k.A.isDown || k.LEFT.isDown;
    const right = k.D.isDown || k.RIGHT.isDown;
    const up = k.W.isDown || k.UP.isDown;
    const down = k.S.isDown || k.DOWN.isDown;
    return {
      turn: (right ? 1 : 0) - (left ? 1 : 0),
      throttle: (up ? 1 : 0) - (down ? 1 : 0),
      fire: k.SPACE.isDown || pointer.leftButtonDown(),
      missile: k.F.isDown || pointer.rightButtonDown(),
      skill: k.SHIFT.isDown,
      aimX: aim.x,
      aimY: aim.y,
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
      exhaust.emitting = p.alive && p.speed > 20;
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
    const sprite = this.add.image(p.x, p.y, `jet-${p.planeId}`).setTint(mine ? PLANES[p.planeId].color : ENEMY_TINT);
    const label = this.add
      .text(p.x, p.y, p.name, { fontFamily: 'monospace', fontSize: '12px', color: mine ? '#cfe0ff' : '#ffb3a8' })
      .setOrigin(0.5);
    if (mine) this.cameras.main.startFollow(sprite, true, 0.15, 0.15);
    return { sprite, label, exhaust };
  }

  // Reuses sprites instead of creating one per shot.
  private syncProjectiles(pool: Phaser.GameObjects.Image[], items: ProjectileSnapshot[], texture: string): void {
    while (pool.length < items.length) pool.push(this.add.image(0, 0, texture));
    pool.forEach((s, i) => {
      const b = items[i];
      s.setVisible(!!b);
      if (b) s.setPosition(b.x, b.y).setRotation(b.angle);
    });
  }

  private handleBoom(x: number, y: number): void {
    this.explosions.explode(30, x, y);
    // A ring showing the real blast radius.
    const ring = this.add.circle(x, y, MISSILE.blastRadius).setStrokeStyle(3, 0xffb347).setDepth(5).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    const cam = this.cameras.main;
    if (Phaser.Math.Distance.Between(cam.midPoint.x, cam.midPoint.y, x, y) < 700) cam.shake(120, 0.004);
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
      // Gun heat, flashing red while overheated.
      const flash = me.overheated && Math.floor(this.time.now / 150) % 2 === 0;
      const heatY = this.hud.y + this.hud.height + 2;
      this.hpBar.fillStyle(0x1a2440).fillRect(16, heatY, 200, 6);
      this.hpBar.fillStyle(me.overheated ? (flash ? 0xff3b30 : 0x7a1f1a) : 0xffb347).fillRect(16, heatY, 200 * me.heat, 6);
      const pips = '▮'.repeat(me.missiles) + '▯'.repeat(spec.missiles - me.missiles);
      this.hud.setText(
        `${spec.name}\nMACH ${(me.speed / PX_PER_MACH).toFixed(2)}\nMSL  ${pips}\nK ${me.kills}  D ${me.deaths}\n${me.overheated ? 'GUNS OVERHEATED' : 'GUN HEAT'}`,
      );
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

  private drawRadar(players: PlayerSnapshot[]): void {
    const g = this.radar;
    const cx = this.scale.width - RADAR_MARGIN - RADAR_RADIUS;
    const cy = this.scale.height - RADAR_MARGIN - RADAR_RADIUS;
    const me = players.find((p) => p.id === this.net.myId);
    const scale = RADAR_RADIUS / RADAR_RANGE;

    g.clear();
    g.fillStyle(0x07101f, 0.85).fillCircle(cx, cy, RADAR_RADIUS);
    g.lineStyle(1, 0x2a4a7a).strokeCircle(cx, cy, RADAR_RADIUS).strokeCircle(cx, cy, RADAR_RADIUS / 2);
    if (!me) return;

    const plot = (x: number, y: number) => {
      const dx = (x - me.x) * scale;
      const dy = (y - me.y) * scale;
      return dx * dx + dy * dy <= RADAR_RADIUS * RADAR_RADIUS ? { x: cx + dx, y: cy + dy } : null;
    };

    // Arena walls, as a dotted line where they're in range.
    g.fillStyle(0x3a5a9a);
    for (let d = 0; d <= ARENA.width; d += 80) {
      for (const [x, y] of [
        [d, 0],
        [d, ARENA.height],
        [0, d],
        [ARENA.width, d],
      ]) {
        const pt = plot(x, y);
        if (pt) g.fillRect(pt.x - 1, pt.y - 1, 2, 2);
      }
    }

    g.fillStyle(0xff5a4a);
    for (const p of players) {
      if (p.id === me.id || !p.alive || !p.onRadar) continue;
      const pt = plot(p.x, p.y);
      if (pt) g.fillCircle(pt.x, pt.y, 3);
    }

    // You, as an arrow in the middle.
    const a = me.angle;
    g.fillStyle(0xcfe0ff).fillTriangle(
      cx + Math.cos(a) * 7,
      cy + Math.sin(a) * 7,
      cx + Math.cos(a + 2.5) * 5,
      cy + Math.sin(a + 2.5) * 5,
      cx + Math.cos(a - 2.5) * 5,
      cy + Math.sin(a - 2.5) * 5,
    );
  }

  /** Your lock-on ring: it closes in on the target as the lock builds. Only you see it. */
  private drawLock(players: PlayerSnapshot[]): void {
    const g = this.lockRing;
    g.clear();
    this.lockText.setVisible(false);
    const me = players.find((p) => p.id === this.net.myId);
    const target = me?.alive && me.lockTarget ? players.find((p) => p.id === me.lockTarget) : undefined;
    if (!me || !target || !target.alive) return;

    const full = me.lock >= 1;
    const radius = 70 - 44 * me.lock;
    const color = full ? 0xff3b30 : 0xffd28a;
    g.lineStyle(full ? 3 : 2, color, full ? 1 : 0.85).strokeCircle(target.x, target.y, radius);
    // Four ticks that make the ring read as a seeker reticle.
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + (full ? 0 : this.time.now / 400);
      g.lineBetween(
        target.x + Math.cos(a) * radius,
        target.y + Math.sin(a) * radius,
        target.x + Math.cos(a) * (radius + 8),
        target.y + Math.sin(a) * (radius + 8),
      );
    }
    if (full) this.lockText.setVisible(true).setPosition(target.x, target.y + radius + 12);
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.board.setX(width - 16);
    this.feedText.setPosition(width - 16, 140);
    this.banner.setPosition(width / 2, height / 2 - 80);
    this.help.setY(height - 28);
  }
}
