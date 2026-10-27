import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene';
import { Network } from './network';
import { setupPicker } from './picker';

setupPicker((name, planeId) => {
  const net = new Network(name, planeId);
  new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#0b1020',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new ArenaScene(net)],
  });
});
