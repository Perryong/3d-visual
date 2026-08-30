/**
 * Geometry for the TPZ-77 general arrangement.
 *
 * Everything is built from primitives at 1 unit = 1 metre, with Z running
 * forward, X to the right and Y up. Each builder returns a THREE.Group whose
 * name matches a part ID in data/bom.js, so the parts list, the 3D field and
 * the callouts all address the same object.
 *
 * Deliberately low detail: this is a schematic for reading a layout, in the
 * spirit of an exploded assembly diagram, not a model of anything real.
 */

import * as THREE from 'three';
import { PARTS } from '../data/bom.js';

const HULL_LEN = 8.0;
const HULL_HALF_W = 1.2;
const TRACK_X = 1.45;

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rTop, rBottom, h, seg, mat) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
}

/** Cylinder lying on the X axis, the way every wheel and the gun tube sit. */
function axle(r, len, seg, mat) {
  const m = cyl(r, r, len, seg, mat);
  m.rotation.z = Math.PI / 2;
  return m;
}

function place(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

/** Rounded-rectangle band, used for the track loops. */
function trackShape() {
  const outer = new THREE.Shape();
  const L = 4.45;
  const top = 1.22;
  const bottom = 0.16;
  const r = 0.5;
  outer.moveTo(-L + r, bottom);
  outer.lineTo(L - r, bottom);
  outer.quadraticCurveTo(L, bottom, L, bottom + r);
  outer.lineTo(L, top - r);
  outer.quadraticCurveTo(L, top, L - r, top);
  outer.lineTo(-L + r, top);
  outer.quadraticCurveTo(-L, top, -L, top - r);
  outer.lineTo(-L, bottom + r);
  outer.quadraticCurveTo(-L, bottom, -L + r, bottom);

  const hole = new THREE.Path();
  const iL = L - 0.16;
  const iTop = top - 0.16;
  const iBottom = bottom + 0.16;
  const ir = r - 0.1;
  hole.moveTo(-iL + ir, iBottom);
  hole.lineTo(iL - ir, iBottom);
  hole.quadraticCurveTo(iL, iBottom, iL, iBottom + ir);
  hole.lineTo(iL, iTop - ir);
  hole.quadraticCurveTo(iL, iTop, iL - ir, iTop);
  hole.lineTo(-iL + ir, iTop);
  hole.quadraticCurveTo(-iL, iTop, -iL, iTop - ir);
  hole.lineTo(-iL, iBottom + ir);
  hole.quadraticCurveTo(-iL, iBottom, -iL + ir, iBottom);
  outer.holes.push(hole);
  return outer;
}

/**
 * Trapezoidal prism, for the turret shell and the sloped glacis.
 * Defined by a front width, a back width, a height and a depth.
 */
function wedge(frontW, backW, h, d, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-backW / 2, -d / 2);
  shape.lineTo(backW / 2, -d / 2);
  shape.lineTo(frontW / 2, d / 2);
  shape.lineTo(-frontW / 2, d / 2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  return m;
}

/**
 * Builds the whole vehicle.
 * Returns { root, groups } where groups is a Map of part ID -> THREE.Group.
 */
export function buildVehicle(materials) {
  const { body, dark, accentBody, glass, rubber } = materials;
  const root = new THREE.Group();
  const groups = new Map();

  const g = (id) => {
    const grp = new THREE.Group();
    grp.name = id;
    grp.userData.partId = id;
    groups.set(id, grp);
    root.add(grp);
    return grp;
  };

  // ---- Lower hull -------------------------------------------------------
  const lower = g('HULL-01');
  lower.add(place(box(HULL_HALF_W * 2, 0.72, HULL_LEN, body), 0, 0.78, 0));
  lower.add(place(box(HULL_HALF_W * 2 + 0.5, 0.34, HULL_LEN - 0.6, body), 0, 1.06, 0));
  // Final drive housings
  [-1, 1].forEach((s) => {
    lower.add(place(axle(0.34, 0.4, 16, dark), s * (HULL_HALF_W + 0.1), 0.82, -3.5));
  });

  // ---- Upper hull deck --------------------------------------------------
  const deck = g('HULL-02');
  deck.add(place(box(HULL_HALF_W * 2 + 0.44, 0.22, HULL_LEN - 1.4, body), 0, 1.34, -0.3));
  deck.add(place(box(1.1, 0.1, 1.0, dark), -0.55, 1.46, 2.1)); // driver's recess
  deck.add(place(box(2.0, 0.12, 0.9, dark), 0, 1.46, -3.05)); // rear plate lip

  // ---- Glacis -----------------------------------------------------------
  const glacis = g('HULL-03');
  const gl = box(HULL_HALF_W * 2 + 0.3, 0.26, 2.3, body);
  gl.rotation.x = -0.62;
  glacis.add(place(gl, 0, 1.06, 3.35));

  // ---- Driver's hatch ---------------------------------------------------
  const hatch = g('HULL-04');
  hatch.add(place(cyl(0.34, 0.34, 0.16, 24, accentBody), -0.55, 1.53, 2.1));
  hatch.add(place(box(0.16, 0.1, 0.1, glass), -0.55, 1.62, 2.34));

  // ---- Appliqué armour --------------------------------------------------
  const applique = g('HULL-05');
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 6; i++) {
      const z = 2.6 - i * 1.05;
      applique.add(place(box(0.14, 0.5, 0.92, dark), s * (HULL_HALF_W + 0.28), 1.06, z));
    }
  });

  // ---- Turret race ------------------------------------------------------
  const race = g('TUR-02');
  race.add(place(cyl(1.05, 1.05, 0.18, 32, dark), 0, 1.52, 0.2));
  race.add(place(cyl(0.95, 0.95, 0.7, 24, dark), 0, 1.15, 0.2)); // basket

  // ---- Turret shell -----------------------------------------------------
  const turret = g('TUR-01');
  const shell = wedge(1.9, 2.9, 0.86, 3.6, body);
  turret.add(place(shell, 0, 2.06, 0.1));
  turret.add(place(box(2.7, 0.2, 1.5, body), 0, 2.56, -1.0)); // bustle roof
  turret.add(place(box(2.6, 0.62, 0.16, dark), 0, 2.16, -1.72)); // blow-out panel

  // ---- Mantlet ----------------------------------------------------------
  const mantlet = g('TUR-03');
  mantlet.add(place(box(1.5, 0.78, 0.42, dark), 0, 2.12, 1.86));

  // ---- Cupola -----------------------------------------------------------
  const cupola = g('TUR-04');
  cupola.add(place(cyl(0.44, 0.48, 0.3, 24, accentBody), -0.5, 2.62, -0.4));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const v = place(box(0.16, 0.14, 0.06, glass), -0.5 + Math.cos(a) * 0.45, 2.64, -0.4 + Math.sin(a) * 0.45);
    v.rotation.y = -a;
    cupola.add(v);
  }

  // ---- Sights -----------------------------------------------------------
  const gps = g('OPT-01');
  gps.add(place(box(0.5, 0.38, 0.44, dark), 0.62, 2.66, 0.9));
  gps.add(place(box(0.34, 0.24, 0.05, glass), 0.62, 2.68, 1.13));

  const pano = g('OPT-02');
  pano.add(place(cyl(0.22, 0.22, 0.34, 20, dark), -0.5, 2.92, 0.2));
  pano.add(place(box(0.26, 0.2, 0.05, glass), -0.5, 2.94, 0.41));

  // ---- Main gun ---------------------------------------------------------
  const gun = g('ARM-01');
  gun.add(place(cyl(0.115, 0.115, 4.9, 20, dark), 0, 2.12, 4.3).rotateX(Math.PI / 2)); // tube
  gun.add(place(cyl(0.2, 0.2, 0.62, 20, dark), 0, 2.12, 3.6).rotateX(Math.PI / 2)); // fume extractor
  gun.add(place(cyl(0.155, 0.155, 1.4, 20, body), 0, 2.12, 2.6).rotateX(Math.PI / 2)); // thermal sleeve
  gun.add(place(box(0.5, 0.5, 1.1, dark), 0, 2.12, 0.8)); // breech

  const mrs = g('ARM-02');
  mrs.add(place(box(0.2, 0.24, 0.08, accentBody), 0, 2.32, 6.6));
  mrs.add(place(box(0.05, 0.2, 0.05, dark), 0, 2.2, 6.6));

  // ---- Smoke dischargers ------------------------------------------------
  const smoke = g('ARM-03');
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const t = cyl(0.075, 0.075, 0.3, 10, dark);
        t.rotation.x = -Math.PI / 2 + 0.25;
        smoke.add(place(t, s * (1.12 - j * 0.02), 2.24 + j * 0.19, 0.9 - i * 0.19));
      }
    }
  });

  // ---- Powerpack --------------------------------------------------------
  const pack = g('PWR-01');
  pack.add(place(box(2.1, 0.9, 2.2, accentBody), 0, 0.92, -2.6));
  pack.add(place(cyl(0.3, 0.3, 1.6, 16, dark), 0.6, 0.92, -2.6).rotateZ(Math.PI / 2));
  pack.add(place(box(1.0, 0.6, 0.7, dark), -0.5, 0.95, -3.6)); // transmission

  const grilles = g('PWR-02');
  for (let i = 0; i < 4; i++) {
    grilles.add(place(box(0.86, 0.08, 1.5, dark), -0.99 + (i % 2) * 1.98, 1.5, -2.0 - Math.floor(i / 2) * 1.6));
  }

  const exhaust = g('PWR-03');
  exhaust.add(place(box(0.7, 0.5, 0.3, dark), 0.72, 1.0, -4.1));
  exhaust.add(place(box(0.6, 0.06, 0.06, accentBody), 0.72, 1.12, -4.26));

  // ---- Running gear -----------------------------------------------------
  const wheels = g('RUN-01');
  const wheelZ = [3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -3.0];
  [-1, 1].forEach((s) => {
    wheelZ.forEach((z) => {
      wheels.add(place(axle(0.42, 0.3, 20, rubber), s * TRACK_X, 0.6, z));
      wheels.add(place(axle(0.18, 0.34, 12, dark), s * TRACK_X, 0.6, z));
    });
  });

  const sprockets = g('RUN-02');
  [-1, 1].forEach((s) => {
    sprockets.add(place(axle(0.36, 0.28, 12, dark), s * TRACK_X, 0.98, -3.9));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sprockets.add(
        place(box(0.3, 0.1, 0.1, dark), s * TRACK_X, 0.98 + Math.sin(a) * 0.4, -3.9 + Math.cos(a) * 0.4)
      );
    }
  });

  const idlers = g('RUN-03');
  [-1, 1].forEach((s) => {
    idlers.add(place(axle(0.34, 0.3, 18, dark), s * TRACK_X, 0.86, 3.9));
  });

  const tracks = g('RUN-04');
  const trackGeo = new THREE.ExtrudeGeometry(trackShape(), { depth: 0.56, bevelEnabled: false });
  trackGeo.rotateY(Math.PI / 2);
  trackGeo.translate(-0.28, 0, 0);
  [-1, 1].forEach((s) => {
    const band = new THREE.Mesh(trackGeo, rubber);
    band.rotation.y = 0; // shape is already in the Z/Y plane
    tracks.add(place(band, s * TRACK_X, 0, 0));
  });

  const skirts = g('RUN-05');
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 5; i++) {
      skirts.add(place(box(0.08, 0.62, 1.5, body), s * (TRACK_X + 0.34), 1.1, 3.0 - i * 1.55));
    }
  });

  // ---- Stowage ----------------------------------------------------------
  const stow = g('STO-01');
  stow.add(place(box(0.4, 0.42, 1.2, body), -1.3, 1.55, -1.6));
  stow.add(place(box(0.4, 0.42, 1.2, body), 1.3, 1.55, -1.6));
  stow.add(place(box(1.6, 0.4, 0.42, body), 0, 2.4, -2.0));

  // ---- Record home + exploded positions ---------------------------------
  PARTS.forEach((p) => {
    const grp = groups.get(p.id);
    if (!grp) return;
    grp.userData.home = grp.position.clone();
    grp.userData.explode = new THREE.Vector3(...p.explode);

    // A group holding a left-hand and a right-hand copy of the same part
    // cannot just slide sideways — the pair has to split outward from the
    // centreline. Detect that case by looking for children on both sides.
    let hasLeft = false;
    let hasRight = false;
    grp.children.forEach((c) => {
      if (c.position.x < -0.05) hasLeft = true;
      if (c.position.x > 0.05) hasRight = true;
    });
    grp.userData.paired = hasLeft && hasRight && Math.abs(p.explode[0]) > 0.001;

    if (grp.userData.paired) {
      grp.children.forEach((c) => {
        c.userData.homeLocal = c.position.clone();
        c.userData.side = Math.sign(c.position.x) || 1;
      });
    }
  });

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // The track bottoms sit 0.16 m above the local origin; drop the whole
  // assembly so the vehicle stands on the grid instead of hovering.
  root.position.y = -0.16;

  return { root, groups };
}

/**
 * Moves every part between its assembled and fully separated position.
 * `t` runs 0 (assembled) to 1 (full disassembly).
 */
export function applyDisassembly(groups, t) {
  groups.forEach((grp) => {
    const { home, explode, paired } = grp.userData;
    if (!home) return;
    if (paired) {
      // The pair splits outward; the group itself only travels in Y and Z.
      grp.position.set(home.x, home.y + explode.y * t, home.z + explode.z * t);
      const spread = Math.abs(explode.x) * t;
      grp.children.forEach((child) => {
        const hl = child.userData.homeLocal;
        if (!hl) return;
        child.position.x = hl.x + spread * (child.userData.side || 1);
      });
    } else {
      grp.position.copy(home).addScaledVector(explode, t);
    }
  });
}
