import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene';
import { Network } from './network';

const overlay = document.getElementById('join')!;
const nameInput = document.getElementById('name') as HTMLInputElement;

try {
  nameInput.value = localStorage.getItem('skyfrost:name') ?? '';
} catch {
  // Storage can be blocked; the name field just starts empty.
}
nameInput.focus();

nameInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const name = nameInput.value.trim();
  try {
    localStorage.setItem('skyfrost:name', name);
  } catch {
    // Ignore: remembering the name is a convenience.
  }
  overlay.remove();
  start(new Network(name, 'f22'));
});

function start(net: Network): void {
  new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#0b1020',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new ArenaScene(net)],
  });
}
