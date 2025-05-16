import { createScene } from './scene.js';

async function init() {
  window.scene = await createScene();
  window.scene.start();
}

window.onload = init;
