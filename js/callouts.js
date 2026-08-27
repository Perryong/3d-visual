/**
 * Annotation callouts.
 *
 * Each part gets an HTML label parked in a margin column and a leader line
 * back to the part itself. The label positions are recomputed every frame
 * from the projected 3D anchor, so they track the model as it rotates and
 * as it comes apart.
 *
 * Labels are stacked rather than left where they land: a real annotated
 * drawing keeps its callouts in tidy columns with the leaders doing the
 * work of pointing.
 */

import * as THREE from 'three';

const ROW_H = 26;
const MARGIN = 14;

export function createCallouts(layer, svg, parts, api) {
  const nodes = new Map();
  const anchorBox = new THREE.Box3();
  const anchor = new THREE.Vector3();
  const projected = new THREE.Vector3();

  parts.forEach((p) => {
    const el = document.createElement('button');
    el.className = 'callout';
    el.type = 'button';
    el.dataset.partId = p.id;
    el.innerHTML = `<span class="callout__id">${p.id}</span><span class="callout__name">${p.name}</span>`;
    layer.appendChild(el);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('class', 'leader');
    svg.appendChild(line);

    nodes.set(p.id, { el, line });
  });

  let enabled = true;
  let selectedId = null;

  function setEnabled(on) {
    enabled = on;
    layer.classList.toggle('is-hidden', !on);
    svg.classList.toggle('is-hidden', !on);
  }

  function setSelected(id) {
    selectedId = id;
    nodes.forEach((n, partId) => {
      n.el.classList.toggle('is-selected', partId === id);
      n.line.classList.toggle('is-selected', partId === id);
    });
  }

  function update() {
    if (!enabled) return;
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (!w || !h) return;

    const left = [];
    const right = [];

    api.groups.forEach((grp, id) => {
      const node = nodes.get(id);
      if (!node) return;
      if (!grp.visible) {
        node.el.style.display = 'none';
        node.line.style.display = 'none';
        return;
      }

      anchorBox.setFromObject(grp);
      if (anchorBox.isEmpty()) {
        node.el.style.display = 'none';
        node.line.style.display = 'none';
        return;
      }
      anchorBox.getCenter(anchor);
      projected.copy(anchor).project(api.camera);

      if (projected.z > 1) {
        node.el.style.display = 'none';
        node.line.style.display = 'none';
        return;
      }

      const sx = ((projected.x + 1) / 2) * w;
      const sy = ((1 - projected.y) / 2) * h;
      (projected.x < 0 ? left : right).push({ id, node, sx, sy });
    });

    layoutColumn(left, 'left', w, h);
    layoutColumn(right, 'right', w, h);
  }

  function layoutColumn(items, side, w, h) {
    items.sort((a, b) => a.sy - b.sy);

    // Push labels apart so they never overlap, then nudge the whole stack
    // back inside the viewport if it has run off the bottom.
    let y = MARGIN;
    items.forEach((item) => {
      item.ly = Math.max(y, Math.min(item.sy - ROW_H / 2, h - MARGIN - ROW_H));
      y = item.ly + ROW_H + 4;
    });
    const overflow = y - (h - MARGIN);
    if (overflow > 0) {
      items.forEach((item) => {
        item.ly -= overflow;
      });
    }

    // The label width is set in CSS and changes at the mobile breakpoint, so
    // measure it rather than assuming it.
    const labelW = items[0]?.node.el.offsetWidth || 176;
    const lx = side === 'left' ? MARGIN : w - MARGIN - labelW;
    const elbowX = side === 'left' ? lx + labelW + 10 : lx - 10;

    items.forEach((item) => {
      const { node, sx, sy, ly } = item;
      node.el.style.display = '';
      node.line.style.display = '';
      node.el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;

      const anchorY = ly + ROW_H / 2;
      node.line.setAttribute(
        'points',
        `${elbowX},${anchorY} ${elbowX + (side === 'left' ? 16 : -16)},${anchorY} ${sx},${sy}`
      );
    });
  }

  layer.addEventListener('click', (e) => {
    const btn = e.target.closest('.callout');
    if (btn) api.onCalloutClick?.(btn.dataset.partId);
  });

  return { update, setEnabled, setSelected };
}
