/**
 * Scene, camera, lighting and picking for the 3D field.
 *
 * The visual target is a drawing sheet that happens to be live: flat-lit
 * surfaces with a hard edge overlay, so silhouettes and part boundaries read
 * clearly at any zoom, the way a line drawing does and a photoreal render
 * does not.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applyDisassembly } from './parts.js';

export function createScene(canvas, { build, theme }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(theme.clear, 1);

  const scene = new THREE.Scene();
  if (theme.fog) scene.fog = new THREE.Fog(theme.clear, theme.fog.near, theme.fog.far);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(...theme.camera);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = theme.minDistance;
  controls.maxDistance = theme.maxDistance;
  controls.maxPolarAngle = theme.maxPolarAngle;
  controls.target.set(...theme.target);

  // ---- Lighting ---------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x9fd6f2, 0x0a1a26, 1.15));
  const key = new THREE.DirectionalLight(0xdff0ff, 1.5);
  key.position.set(9, 14, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x3d7ea8, 0.7);
  fill.position.set(-10, 5, -8);
  scene.add(fill);

  // ---- Ground grid ------------------------------------------------------
  const grid = theme.grid
    ? new THREE.GridHelper(theme.grid.size, theme.grid.div, theme.grid.c1, theme.grid.c2)
    : null;
  if (grid) scene.add(grid);

  // ---- Materials --------------------------------------------------------
  const mk = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.12, ...opts });

  const materials = {
    body: mk(0x2c5171),
    dark: mk(0x1a3245),
    accentBody: mk(0x37678a),
    glass: mk(0x7fe6ff, { emissive: 0x16617a, roughness: 0.25, metalness: 0.4 }),
    rubber: mk(0x14222f, { roughness: 0.95, metalness: 0.02 }),
  };
  const materialList = Object.values(materials);

  // ---- Model ------------------------------------------------------------
  const { root, groups } = build(materials);
  scene.add(root);

  // ---- Edge overlay -----------------------------------------------------
  // One LineSegments per mesh, parented to the mesh so it follows every
  // disassembly move for free. Sheets whose lines are their own edges
  // (maps) pass edge: null and skip this.
  const edgeMat = new THREE.LineBasicMaterial({
    color: theme.edge?.color ?? 0xffffff,
    transparent: true,
    opacity: theme.edge?.opacity ?? 0.55,
  });
  const edges = [];
  if (theme.edge) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const seg = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), edgeMat);
      seg.userData.isEdge = true;
      o.add(seg);
      edges.push(seg);
    });
  }

  // ---- Selection highlight ---------------------------------------------
  const highlightMat = new THREE.MeshStandardMaterial({
    color: theme.select.color,
    emissive: theme.select.emissive,
    roughness: 0.5,
    metalness: 0.1,
  });
  const flatHighlight = new THREE.MeshBasicMaterial({
    color: theme.select.color,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const originalMats = new Map();

  function setSelected(partId) {
    // Restore anything previously swapped.
    originalMats.forEach((mat, mesh) => {
      mesh.material = mat;
    });
    originalMats.clear();
    if (!partId) return;
    const grp = groups.get(partId);
    if (!grp) return;
    grp.traverse((o) => {
      if (o.isMesh && !o.userData.noHighlight) {
        originalMats.set(o, o.material);
        o.material = o.material.isMeshStandardMaterial ? highlightMat : flatHighlight;
      }
    });
  }

  // ---- Isolate ----------------------------------------------------------
  function setIsolated(partId) {
    groups.forEach((grp, id) => {
      grp.visible = !partId || id === partId;
    });
    if (grid) grid.visible = true;
  }

  // ---- Blueprint mode ---------------------------------------------------
  let blueprint = false;
  function setBlueprint(on) {
    blueprint = on;
    materialList.forEach((m) => {
      m.transparent = on;
      m.opacity = on ? 0.22 : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    });
    edgeMat.opacity = on ? 0.95 : theme.edge?.opacity ?? 0.55;
  }

  // ---- Picking ----------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(root, true);
    for (const hit of hits) {
      if (hit.object.userData.isEdge) continue;
      let o = hit.object;
      while (o && !o.userData.partId) o = o.parent;
      if (o) return o.userData.partId;
    }
    return null;
  }

  // ---- Camera moves -----------------------------------------------------
  let tween = null;

  function focusOn(partId) {
    const grp = groups.get(partId);
    if (!grp) return;
    const boxHelper = new THREE.Box3().setFromObject(grp);
    if (boxHelper.isEmpty()) return;
    const centre = boxHelper.getCenter(new THREE.Vector3());
    const size = boxHelper.getSize(new THREE.Vector3()).length();
    const dist = Math.max(size * 1.9, 5);
    const dir = camera.position.clone().sub(controls.target).normalize();
    tween = {
      t: 0,
      fromTarget: controls.target.clone(),
      toTarget: centre,
      fromPos: camera.position.clone(),
      toPos: centre.clone().addScaledVector(dir, dist),
    };
  }

  const HOME_POS = camera.position.clone();
  const HOME_TARGET = controls.target.clone();

  function resetView() {
    tween = {
      t: 0,
      fromTarget: controls.target.clone(),
      toTarget: HOME_TARGET.clone(),
      fromPos: camera.position.clone(),
      toPos: HOME_POS.clone(),
    };
  }

  function stepTween(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt * 2.2);
    const e = 1 - Math.pow(1 - tween.t, 3);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    if (tween.t >= 1) tween = null;
  }

  // ---- Resize -----------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    THREE,
    scene,
    camera,
    controls,
    renderer,
    root,
    groups,
    resize,
    pick,
    setSelected,
    setIsolated,
    setBlueprint,
    focusOn,
    resetView,
    stepTween,
    setDisassembly: (t) => applyDisassembly(groups, t),
    get blueprint() {
      return blueprint;
    },
  };
}
