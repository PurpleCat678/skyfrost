import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene';

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: '#0b1020',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [ArenaScene],
});
