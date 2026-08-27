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
import { buildVehicle, applyDisassembly } from './parts.js';

const INK = 0x070f18;
const LINE = 0x5cc8f2;
const SELECT = 0xf2a33c;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(INK, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 28, 62);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(12.5, 7.5, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 6;
  controls.maxDistance = 55;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 1.6, 0);

  // ---- Lighting ---------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x9fd6f2, 0x0a1a26, 1.15));
  const key = new THREE.DirectionalLight(0xdff0ff, 1.5);
  key.position.set(9, 14, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x3d7ea8, 0.7);
  fill.position.set(-10, 5, -8);
  scene.add(fill);

  // ---- Ground grid ------------------------------------------------------
  const grid = new THREE.GridHelper(60, 60, 0x1d4258, 0x122d3d);
  grid.position.y = 0;
  scene.add(grid);

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

  // ---- Vehicle ----------------------------------------------------------
  const { root, groups } = buildVehicle(materials);
  // The track bottoms sit 0.16 m above the local origin; drop the whole
  // assembly so the vehicle stands on the grid instead of hovering.
  root.position.y = -0.16;
  scene.add(root);

  // ---- Edge overlay -----------------------------------------------------
  // One LineSegments per mesh, parented to the mesh so it follows every
  // disassembly move for free.
  const edgeMat = new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.55 });
  const edges = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const seg = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), edgeMat);
    seg.userData.isEdge = true;
    o.add(seg);
    edges.push(seg);
  });

  // ---- Selection highlight ---------------------------------------------
  const highlightMat = new THREE.MeshStandardMaterial({
    color: SELECT,
    emissive: 0x6b3d05,
    roughness: 0.5,
    metalness: 0.1,
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
      if (o.isMesh) {
        originalMats.set(o, o.material);
        o.material = highlightMat;
      }
    });
  }

  // ---- Isolate ----------------------------------------------------------
  function setIsolated(partId) {
    groups.forEach((grp, id) => {
      grp.visible = !partId || id === partId;
    });
    grid.visible = true;
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
    edgeMat.opacity = on ? 0.95 : 0.55;
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
