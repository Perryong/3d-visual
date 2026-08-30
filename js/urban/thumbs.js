/**
 * Live observation thumbnails: the same scene rendered top-down, one layer
 * visible at a time, into small circular thumbnails. One shared, offscreen
 * WebGL canvas (#thumb-canvas) renders each area into a scissor viewport
 * (three.js "multiple elements" pattern); since that canvas can't be clipped
 * per element, each frame's viewport rect is then copied via drawImage into
 * the .thumb's own 2D <canvas>, which the CSS circle (overflow: hidden) does
 * clip.
 */
import * as THREE from 'three';
import { AREAS } from '../../data/urban/layers.js';

export function createThumbs(api, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setScissorTest(true);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  cam.up.set(0, 0, -1); // north up on the thumbnail

  // ponytail: re-renders every thumb every frame; throttle to on-scroll/resize if it ever matters.
  function update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * dpr)) renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    const thumbs = document.querySelectorAll('.thumb[data-layer]');
    if (!thumbs.length) return;
    const saved = new Map();
    api.groups.forEach((g, id) => saved.set(id, g.visible));
    thumbs.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h || r.width === 0) return;
      const grp = api.groups.get(el.dataset.layer);
      const out = el.querySelector('canvas');
      if (!grp || !out) return;
      const area = AREAS[el.dataset.area] ?? AREAS.island;
      api.groups.forEach((g, id) => { g.visible = id === el.dataset.layer; });
      const cx = (area.x[0] + area.x[1]) / 2;
      const cz = (area.z[0] + area.z[1]) / 2;
      const half = Math.max(area.x[1] - area.x[0], area.z[1] - area.z[0]) / 2;
      const y = grp.position.y;
      cam.position.set(cx, y + 100, cz);
      cam.lookAt(cx, y, cz);
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
      const x = r.left, yTop = h - r.bottom;
      renderer.setViewport(x, yTop, r.width, r.height);
      renderer.setScissor(x, yTop, r.width, r.height);
      renderer.render(api.scene, cam);

      // Copy this viewport rect out of the shared canvas while the drawing
      // buffer still holds it (preserveDrawingBuffer is off, so this must
      // happen synchronously, right here, before the next render() clears
      // or overwrites it). WebGL's viewport y is bottom-up; the canvas
      // bitmap drawImage reads from is top-down, so the source y is r.top.
      const sw = Math.round(r.width * dpr), sh = Math.round(r.height * dpr);
      if (out.width !== sw || out.height !== sh) { out.width = sw; out.height = sh; }
      out.getContext('2d').drawImage(canvas, r.left * dpr, r.top * dpr, sw, sh, 0, 0, sw, sh);
    });
    saved.forEach((v, id) => { api.groups.get(id).visible = v; });
  }
  return { update };
}
