import Phaser from 'phaser';

// Placeholder art drawn at startup, so the MVP needs no image files.
export function makeTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);

  // Jet, nose pointing right (angle 0).
  g.clear();
  g.fillStyle(0xffffff);
  g.fillPoints(
    [
      { x: 52, y: 24 }, // nose
      { x: 30, y: 19 },
      { x: 22, y: 4 }, // left wingtip
      { x: 14, y: 4 },
      { x: 16, y: 18 },
      { x: 4, y: 14 }, // left tail
      { x: 6, y: 24 },
      { x: 4, y: 34 }, // right tail
      { x: 16, y: 30 },
      { x: 14, y: 44 },
      { x: 22, y: 44 }, // right wingtip
      { x: 30, y: 29 },
    ],
    true,
  );
  g.fillStyle(0x1b2a3a);
  g.fillEllipse(38, 24, 10, 5); // cockpit
  g.generateTexture('jet', 56, 48);

  // Bullet tracer.
  g.clear();
  g.fillStyle(0xffe58a);
  g.fillRect(0, 0, 12, 3);
  g.generateTexture('bullet', 12, 3);

  // Particle dot for explosions and exhaust.
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
