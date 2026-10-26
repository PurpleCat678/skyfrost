import Phaser from 'phaser';
import { ARENA } from '../shared/arena';
import { hits, spawnPlane, stepBullets, stepPlane } from '../shared/physics';
import { PLANES } from '../shared/planes';
import type { Bullet, PlaneInput, PlaneState } from '../shared/types';
import { makeTextures } from './textures';

const PLAYER_ID = 'local';
const DRONE_COUNT = 6;
const DRONE_HP = 40;
const DRONE_RADIUS = 18;
const DRONE_RESPAWN_MS = 3000;

interface Drone {
  sprite: Phaser.GameObjects.Image;
  hp: number;
  alive: boolean;
  // Drones fly a slow circle around a fixed center.
  cx: number;
  cy: number;
  orbit: number;
  phase: number;
  spin: number;
}

export class ArenaScene extends Phaser.Scene {
  private spec = PLANES.f22;
  private player!: PlaneState;
  private playerSprite!: Phaser.GameObjects.Image;
  private exhaust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private explosions!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bullets: Bullet[] = [];
  private bulletSprites: Phaser.GameObjects.Image[] = [];
  private drones: Drone[] = [];
  private kills = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('arena');
  }

  create(): void {
    makeTextures(this);

    this.add.tileSprite(0, 0, ARENA.width, ARENA.height, 'grid').setOrigin(0);
    this.add.rectangle(0, 0, ARENA.width, ARENA.height).setOrigin(0).setStrokeStyle(4, 0x3a5a9a);

    this.player = spawnPlane(this.spec, ARENA.width / 2, ARENA.height / 2);
    this.exhaust = this.add.particles(0, 0, 'dot', {
      lifespan: 350,
      speed: { min: 10, max: 40 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xffb347, 0xff6a3d],
      frequency: 16,
    });
    this.playerSprite = this.add.image(this.player.x, this.player.y, 'jet').setTint(this.spec.color);

    this.explosions = this.add.particles(0, 0, 'dot', {
      lifespan: 600,
      speed: { min: 60, max: 260 },
      scale: { start: 1.6, end: 0 },
      tint: [0xffe58a, 0xff8c42, 0xd9534f],
      emitting: false,
    });

    for (let i = 0; i < DRONE_COUNT; i++) this.drones.push(this.makeDrone());

    const cam = this.cameras.main;
    cam.setBounds(-200, -200, ARENA.width + 400, ARENA.height + 400);
    cam.startFollow(this.playerSprite, true, 0.12, 0.12);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');

    this.hpBar = this.add.graphics().setScrollFactor(0);
    this.hud = this.add
      .text(16, 40, '', { fontFamily: 'monospace', fontSize: '14px', color: '#cfe0ff' })
      .setScrollFactor(0);
    this.add
      .text(16, 0, 'W/S throttle · A/D turn · SPACE fire', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7f93bf',
      })
      .setScrollFactor(0)
      .setName('help');
    this.scale.on('resize', () => this.layoutHelp());
    this.layoutHelp();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);

    const shot = stepPlane(this.player, this.spec, this.readInput(), dt, PLAYER_ID);
    if (shot) this.bullets.push(shot);
    stepBullets(this.bullets, dt);

    this.updateDrones(dt);
    this.resolveHits();
    this.render();
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

  private makeDrone(): Drone {
    const margin = 300;
    const drone: Drone = {
      sprite: this.add.image(0, 0, 'drone'),
      hp: DRONE_HP,
      alive: true,
      cx: Phaser.Math.Between(margin, ARENA.width - margin),
      cy: Phaser.Math.Between(margin, ARENA.height - margin),
      orbit: Phaser.Math.Between(80, 220),
      phase: Math.random() * Math.PI * 2,
      spin: Phaser.Math.FloatBetween(0.3, 0.8) * (Math.random() < 0.5 ? -1 : 1),
    };
    return drone;
  }

  private updateDrones(dt: number): void {
    for (const d of this.drones) {
      if (!d.alive) continue;
      d.phase += d.spin * dt;
      d.sprite.setPosition(d.cx + Math.cos(d.phase) * d.orbit, d.cy + Math.sin(d.phase) * d.orbit);
    }
  }

  private resolveHits(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const target = this.drones.find((d) => d.alive && hits(b, d.sprite.x, d.sprite.y, DRONE_RADIUS));
      if (!target) continue;
      this.bullets.splice(i, 1);
      target.hp -= b.damage;
      target.sprite.setTintFill(0xffffff);
      this.time.delayedCall(60, () => target.sprite.clearTint());
      if (target.hp <= 0) this.killDrone(target);
    }
  }

  private killDrone(d: Drone): void {
    d.alive = false;
    d.sprite.setVisible(false);
    this.explosions.explode(40, d.sprite.x, d.sprite.y);
    this.cameras.main.shake(120, 0.004);
    this.kills++;
    this.time.delayedCall(DRONE_RESPAWN_MS, () => {
      const fresh = this.makeDrone();
      d.sprite.destroy();
      Object.assign(d, fresh);
    });
  }

  private render(): void {
    const p = this.player;
    this.playerSprite.setPosition(p.x, p.y).setRotation(p.angle);
    const tail = 26;
    this.exhaust.setPosition(p.x - Math.cos(p.angle) * tail, p.y - Math.sin(p.angle) * tail);

    // Reuse bullet sprites instead of creating one per shot.
    while (this.bulletSprites.length < this.bullets.length) {
      this.bulletSprites.push(this.add.image(0, 0, 'bullet'));
    }
    this.bulletSprites.forEach((s, i) => {
      const b = this.bullets[i];
      s.setVisible(!!b);
      if (b) s.setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx));
    });

    const hpFrac = p.hp / this.spec.maxHp;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x1a2440).fillRect(16, 16, 200, 14);
    this.hpBar.fillStyle(hpFrac > 0.3 ? 0x4cd97b : 0xd9534f).fillRect(16, 16, 200 * hpFrac, 14);

    this.hud.setText(
      `${this.spec.name}\nSPD ${Math.round(p.speed)}\nKILLS ${this.kills}`,
    );
  }

  private layoutHelp(): void {
    const help = this.children.getByName('help') as Phaser.GameObjects.Text | null;
    help?.setPosition(16, this.scale.height - 28);
  }
}
