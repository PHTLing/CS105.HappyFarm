import { createScene } from './scene.js';

async function init() {
  window.scene = await createScene();
  window.scene.start();

  // Gắn sự kiện chuột vào phần tử chứa canvas (hoặc chính canvas)
  const canvas = document.querySelector('#render-target canvas');
  // Gán sự kiện chuột
  canvas.addEventListener('mousedown', window.scene.onMouseDown);
  canvas.addEventListener('mouseup', window.scene.onMouseUp);
  canvas.addEventListener('mousemove', window.scene.onMouseMove);
}

window.onload = init;
