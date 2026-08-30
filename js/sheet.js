/**
 * Page wiring shared by every sheet. Owns the single piece of shared state —
 * which part is selected — and keeps the scene, the parts list and the
 * callouts pointed at the same answer.
 */

import * as THREE from 'three';
import { createScene } from './scene.js';
import { createCallouts } from './callouts.js';
import { createUI } from './ui.js';

export function bootSheet({ data, build, theme }) {
  const { PARTS, SHEET } = data;
  const canvas = document.getElementById('field');
  const api = createScene(canvas, { build, theme });

  const callouts = createCallouts(
    document.getElementById('callout-layer'),
    document.getElementById('leader-layer'),
    PARTS,
    api
  );

  let selected = null;
  let isolated = null;

  const ui = createUI({ onSelect: select, data });

  function select(partId) {
    selected = partId === selected ? null : partId;
    api.setSelected(selected);
    callouts.setSelected(selected);
    ui.setActiveRow(selected);
    if (selected) ui.showPart(selected);
    else ui.clear();
    syncActionButtons();
  }

  function syncActionButtons() {
    document.querySelectorAll('[data-needs-selection]').forEach((btn) => {
      btn.disabled = !selected;
    });
    document.getElementById('btn-isolate').classList.toggle('is-on', Boolean(isolated));
  }

  api.onCalloutClick = select;

  // ---- Sheet header -------------------------------------------------------
  document.getElementById('sheet-designation').textContent = SHEET.designation;
  document.getElementById('sheet-type').textContent = SHEET.type;
  document.getElementById('sheet-subtitle').textContent = SHEET.subtitle;
  document.getElementById('tb-doc').textContent = SHEET.docNo;
  document.getElementById('tb-rev').textContent = SHEET.rev;
  document.getElementById('tb-scale').textContent = SHEET.scale;
  document.getElementById('tb-sheet').textContent = SHEET.sheet;
  document.getElementById('tb-status').textContent = SHEET.status;

  // ---- Disassembly --------------------------------------------------------
  const slider = document.getElementById('disassembly');
  const readout = document.getElementById('disassembly-readout');

  function setDisassembly(value, { updateSlider = false } = {}) {
    const pct = Math.max(0, Math.min(100, Number(value)));
    if (updateSlider) slider.value = String(pct);
    readout.textContent = `${Math.round(pct)} %`;
    api.setDisassembly(pct / 100);
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.classList.toggle('is-on', Number(btn.dataset.preset) === Math.round(pct));
    });
  }

  slider.addEventListener('input', () => setDisassembly(slider.value));

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      animateSlider(Number(btn.dataset.preset));
    });
  });

  let sliderTween = null;
  function animateSlider(to) {
    sliderTween = { from: Number(slider.value), to, t: 0 };
  }

  // ---- Toggles ------------------------------------------------------------
  const blueprintToggle = document.getElementById('toggle-blueprint');
  blueprintToggle.addEventListener('change', () => api.setBlueprint(blueprintToggle.checked));

  const calloutToggle = document.getElementById('toggle-callouts');
  calloutToggle.addEventListener('change', () => callouts.setEnabled(calloutToggle.checked));

  const rotateToggle = document.getElementById('toggle-rotate');
  rotateToggle.addEventListener('change', () => {
    api.controls.autoRotate = rotateToggle.checked;
    api.controls.autoRotateSpeed = 0.6;
  });

  // ---- Action buttons -----------------------------------------------------
  document.getElementById('btn-focus').addEventListener('click', () => {
    if (selected) api.focusOn(selected);
  });

  document.getElementById('btn-isolate').addEventListener('click', () => {
    isolated = isolated ? null : selected;
    api.setIsolated(isolated);
    syncActionButtons();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    isolated = null;
    api.setIsolated(null);
    if (selected) select(selected);
    syncActionButtons();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    api.resetView();
    isolated = null;
    api.setIsolated(null);
    animateSlider(0);
    syncActionButtons();
  });

  // ---- Picking ------------------------------------------------------------
  let pointerDown = null;
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 5) return; // that was a drag, not a click
    select(api.pick(e.clientX, e.clientY));
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected) select(selected);
  });

  // ---- Mobile panel toggles -----------------------------------------------
  document.querySelectorAll('[data-panel-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.panelToggle);
      target.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(target.classList.contains('is-open')));
    });
  });

  // ---- Loop ---------------------------------------------------------------
  const clock = new THREE.Clock();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (sliderTween) {
      sliderTween.t = Math.min(1, sliderTween.t + dt * (reducedMotion.matches ? 6 : 1.8));
      const e = 1 - Math.pow(1 - sliderTween.t, 3);
      setDisassembly(sliderTween.from + (sliderTween.to - sliderTween.from) * e, {
        updateSlider: true,
      });
      if (sliderTween.t >= 1) sliderTween = null;
    }

    api.stepTween(dt);
    api.controls.update();
    api.renderer.render(api.scene, api.camera);
    callouts.update();
    requestAnimationFrame(tick);
  }

  function resizeAll() {
    api.resize();
    const layer = document.getElementById('callout-layer');
    const svg = document.getElementById('leader-layer');
    svg.setAttribute('viewBox', `0 0 ${layer.clientWidth} ${layer.clientHeight}`);
    svg.setAttribute('width', layer.clientWidth);
    svg.setAttribute('height', layer.clientHeight);
  }

  window.addEventListener('resize', resizeAll);
  resizeAll();
  setDisassembly(0, { updateSlider: true });
  api.setBlueprint(false);
  syncActionButtons();
  tick();

  return api;
}
