import Phaser from 'phaser';
import { COCKPITS, SHAPES } from './shapes';

// Placeholder art drawn at startup, so the MVP needs no image files.
export function makeTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);

  // One white jet per plane type, tinted at runtime. Nose points right.
  for (const [id, points] of Object.entries(SHAPES)) {
    g.clear();
    g.fillStyle(0xffffff);
    g.fillPoints(points, true);
    g.fillStyle(0x1b2a3a);
    g.fillEllipse(COCKPITS[id].x, COCKPITS[id].y, 10, 5);
    g.generateTexture(`jet-${id}`, 56, 48);
  }

  // Bullet tracer.
  g.clear();
  g.fillStyle(0xffe58a);
  g.fillRect(0, 0, 12, 3);
  g.generateTexture('bullet', 12, 3);

  // Missile body with a red tip.
  g.clear();
  g.fillStyle(0xe6e6e6);
  g.fillRect(0, 1, 16, 4);
  g.fillStyle(0xd9534f);
  g.fillTriangle(16, 0, 22, 3, 16, 6);
  g.generateTexture('missile', 22, 6);

  // Particle dot for explosions, exhaust, and smoke trails.
  g.clear();
  g.fillStyle(0xffffff);
  g.fillCircle(4, 4, 4);
  g.generateTexture('dot', 8, 8);

  // Background grid tile.
  g.clear();
  g.fillStyle(0x0b1020);
  g.fillRect(0, 0, 128, 128);
  g.lineStyle(1, 0x1a2440);
  g.strokeRect(0, 0, 128, 128);
  g.generateTexture('grid', 128, 128);

  g.destroy();
}
