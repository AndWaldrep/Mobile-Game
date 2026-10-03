// Detailed weapon models, shared by your own first-person gun and the soldiers
// everyone else sees. Built from simple shapes, merged by material so each gun
// is only a few draw calls. Guns point down -z with the sight line at y = 0.

import * as THREE from 'three';
import { merge, box, tubeZ, sphere } from './geom.js';

export const GUN_MATS = {
  metal: new THREE.MeshStandardMaterial({ color: '#2c2f34', metalness: 0.75, roughness: 0.36 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1c1d20', metalness: 0.3, roughness: 0.6 }),
  poly: new THREE.MeshStandardMaterial({ color: '#2a2c2f', metalness: 0.05, roughness: 0.72 }),
  tan: new THREE.MeshStandardMaterial({ color: '#a48a5f', metalness: 0.02, roughness: 0.78 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4a28', metalness: 0.0, roughness: 0.55 }),
  steel: new THREE.MeshStandardMaterial({ color: '#8d939b', metalness: 0.9, roughness: 0.25 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c79a3a', metalness: 0.9, roughness: 0.3 }),
  lens: new THREE.MeshStandardMaterial({ color: '#1b3d55', metalness: 0.2, roughness: 0.05, emissive: '#0b2233', transparent: true, opacity: 0.55 }),
  dot: new THREE.MeshBasicMaterial({ color: '#ff2a1a' }),
};

// Red-dot / holographic sight. y is the sight line (0).
function redDot(P, z, holo = false) {
  P.metal.push(box(0.03, 0.012, 0.07, 0, -0.03, z)); // mount
  if (holo) {
    P.poly.push(box(0.05, 0.022, 0.09, 0, -0.019, z));
    P.poly.push(box(0.006, 0.042, 0.05, -0.026, 0.005, z - 0.012));
    P.poly.push(box(0.006, 0.042, 0.05, 0.026, 0.005, z - 0.012));
    P.poly.push(box(0.058, 0.007, 0.05, 0, 0.027, z - 0.012));
    P.lens.push(box(0.044, 0.04, 0.003, 0, 0.004, z - 0.03));
  } else {
    // Round tube sight
    const ring = new THREE.TorusGeometry(0.022, 0.0055, 6, 16);
    ring.translate(0, 0, z - 0.03);
    P.poly.push(ring);
    const ring2 = new THREE.TorusGeometry(0.022, 0.0055, 6, 16);
    ring2.translate(0, 0, z + 0.015);
    P.poly.push(ring2);
    P.poly.push(box(0.012, 0.012, 0.05, 0, 0.026, z - 0.008));
    P.poly.push(box(0.012, 0.018, 0.04, 0.026, -0.004, z - 0.008));
    P.lens.push(box(0.04, 0.04, 0.002, 0, 0, z - 0.03));
  }
  P.dot.push(box(0.0035, 0.0035, 0.001, 0, 0, z - 0.034));
}

function rail(P, len, y, z0) {
  P.metal.push(box(0.03, 0.008, len, 0, y, z0 - len / 2));
  for (let z = z0 - 0.01; z > z0 - len; z -= 0.016) P.metal.push(box(0.034, 0.006, 0.007, 0, y + 0.006, z));
}

const BUILD = {
  ar(P, lod) {
    P.metal.push(box(0.05, 0.05, 0.26, 0, -0.045, -0.03)); // upper receiver
    P.metal.push(box(0.046, 0.05, 0.2, 0, -0.092, 0.0)); // lower
    P.poly.push(box(0.056, 0.056, 0.26, 0, -0.05, -0.29)); // handguard
    if (lod) {
      rail(P, 0.5, -0.017, 0.1);
      for (let z = -0.19; z > -0.4; z -= 0.035) P.dark.push(box(0.058, 0.012, 0.018, 0, -0.04, z)); // vents
      P.dark.push(box(0.004, 0.022, 0.05, 0.026, -0.04, -0.02)); // ejection port
      P.metal.push(box(0.012, 0.012, 0.03, 0.0, -0.016, 0.105)); // charging handle
      P.poly.push(box(0.026, 0.02, 0.012, 0, -0.12, 0.03)); // trigger guard
    }
    P.metal.push(tubeZ(0.011, 0.2, 0, -0.05, -0.52)); // barrel
    P.metal.push(tubeZ(0.017, 0.055, 0, -0.05, -0.645, 8)); // muzzle brake
    P.poly.push(box(0.035, 0.11, 0.045, 0, -0.15, 0.07, -0.35)); // grip
    P.metal.push(tubeZ(0.016, 0.13, 0, -0.06, 0.18)); // buffer tube
    P.tan.push(box(0.044, 0.08, 0.13, 0, -0.075, 0.29)); // stock
    P.dark.push(box(0.046, 0.06, 0.02, 0, -0.08, 0.36)); // butt pad
    if (lod) redDot(P, -0.03);
    else P.metal.push(box(0.03, 0.03, 0.06, 0, -0.01, -0.03));
    P.mag = [box(0.03, 0.08, 0.06, 0, -0.14, -0.05, 0.12), box(0.03, 0.07, 0.06, 0, -0.2, -0.06, 0.3)];
    return { muzzle: -0.68, eject: [0.03, -0.04, -0.02], muzzleY: -0.05 };
  },
  smg(P, lod) {
    P.metal.push(box(0.05, 0.065, 0.3, 0, -0.055, -0.04)); // receiver
    P.poly.push(box(0.056, 0.05, 0.13, 0, -0.07, -0.24)); // handguard
    P.metal.push(tubeZ(0.01, 0.08, 0, -0.045, -0.34)); // barrel
    P.dark.push(tubeZ(0.022, 0.16, 0, -0.045, -0.43, 12)); // suppressor
    P.poly.push(box(0.034, 0.1, 0.045, 0, -0.14, 0.06, -0.3)); // grip
    if (lod) {
      rail(P, 0.26, -0.018, 0.08);
      P.dark.push(box(0.004, 0.02, 0.05, 0.026, -0.05, -0.03));
      P.metal.push(box(0.006, 0.006, 0.2, 0.02, -0.07, 0.22)); // folding stock wires
      P.metal.push(box(0.006, 0.006, 0.2, -0.02, -0.07, 0.22));
      P.poly.push(box(0.05, 0.07, 0.02, 0, -0.08, 0.32)); // stock pad
    }
    if (lod) redDot(P, -0.04, true);
    else P.metal.push(box(0.03, 0.03, 0.05, 0, -0.01, -0.04));
    P.mag = [box(0.028, 0.09, 0.04, 0, -0.13, -0.11, 0.15), box(0.028, 0.08, 0.04, 0, -0.2, -0.125, 0.3)];
    return { muzzle: -0.52, eject: [0.03, -0.05, -0.03], muzzleY: -0.045 };
  },
  shotgun(P, lod) {
    P.metal.push(box(0.05, 0.07, 0.22, 0, -0.06, 0.0)); // receiver
    P.metal.push(tubeZ(0.014, 0.58, 0, -0.035, -0.4)); // barrel
    P.metal.push(tubeZ(0.013, 0.46, 0, -0.07, -0.34)); // magazine tube
    P.wood.push(box(0.04, 0.05, 0.13, 0, -0.08, 0.17, 0.12)); // grip/wrist
    P.wood.push(box(0.045, 0.085, 0.2, 0, -0.1, 0.3, 0.12)); // stock
    P.dark.push(box(0.046, 0.09, 0.02, 0, -0.115, 0.4, 0.12));
    P.steel.push(sphere(0.004, 0, 0, -0.68, 1, 1, 1, 6)); // bead
    P.metal.push(box(0.008, 0.012, 0.01, 0, -0.008, -0.68));
    if (lod) {
      P.dark.push(box(0.004, 0.03, 0.06, 0.026, -0.05, -0.01));
      P.metal.push(box(0.026, 0.006, 0.18, 0, -0.022, 0.0)); // top rib
      P.poly.push(box(0.026, 0.02, 0.012, 0, -0.1, 0.06));
    }
    P.pump = [box(0.045, 0.045, 0.16, 0, -0.07, -0.3)];
    if (lod) for (let z = -0.37; z < -0.23; z += 0.02) P.pump.push(box(0.048, 0.006, 0.008, 0, -0.07 + 0.024, z));
    return { muzzle: -0.7, eject: [0.03, -0.05, -0.01], muzzleY: -0.035 };
  },
  sniper(P, lod) {
    P.metal.push(box(0.05, 0.055, 0.3, 0, -0.07, 0.0)); // receiver
    P.metal.push(tubeZ(0.013, 0.62, 0, -0.06, -0.46, 10, 0.009)); // tapered barrel
    P.metal.push(tubeZ(0.018, 0.06, 0, -0.06, -0.79, 8)); // muzzle brake
    P.tan.push(box(0.055, 0.06, 0.42, 0, -0.1, -0.12)); // stock fore
    P.tan.push(box(0.05, 0.1, 0.22, 0, -0.12, 0.25, 0.08)); // butt
    P.tan.push(box(0.04, 0.03, 0.12, 0, -0.06, 0.26)); // cheek rest
    P.dark.push(box(0.052, 0.11, 0.02, 0, -0.13, 0.37, 0.08));
    P.poly.push(box(0.034, 0.1, 0.045, 0, -0.16, 0.1, -0.35));
    // Scope
    P.dark.push(tubeZ(0.02, 0.2, 0, 0, -0.02, 14));
    P.dark.push(tubeZ(0.03, 0.06, 0, 0, -0.15, 14, 0.02));
    P.dark.push(tubeZ(0.026, 0.06, 0, 0, 0.1, 14, 0.02));
    P.dark.push(box(0.016, 0.03, 0.02, 0, 0.022, -0.02)); // turret
    P.dark.push(box(0.03, 0.016, 0.02, 0.022, 0, -0.02));
    P.metal.push(box(0.016, 0.03, 0.03, 0, -0.03, -0.08));
    P.metal.push(box(0.016, 0.03, 0.03, 0, -0.03, 0.05));
    P.lens.push(tubeZ(0.028, 0.004, 0, 0, -0.18, 14));
    if (lod) {
      P.metal.push(box(0.012, 0.03, 0.012, 0, -0.12, -0.3)); // bipod (folded)
      P.metal.push(box(0.008, 0.008, 0.2, 0.012, -0.13, -0.4));
      P.metal.push(box(0.008, 0.008, 0.2, -0.012, -0.13, -0.4));
    }
    P.bolt = [box(0.008, 0.008, 0.05, 0.045, -0.05, 0.06, 0, 0.5), sphere(0.012, 0.065, -0.05, 0.075, 1, 1, 1, 8)];
    P.mag = [box(0.03, 0.05, 0.07, 0, -0.12, -0.02)];
    return { muzzle: -0.83, eject: [0.03, -0.05, 0.02], muzzleY: -0.06 };
  },
};

function meshOf(geos, mat) {
  const m = new THREE.Mesh(merge(geos.map((geo) => ({ geo }))), mat);
  m.castShadow = true;
  return m;
}

// lod: true for the detailed first-person gun, false for the simpler version on other soldiers.
export function buildGun(id, lod = true) {
  const P = { metal: [], dark: [], poly: [], tan: [], wood: [], steel: [], brass: [], lens: [], dot: [], mag: null, pump: null, bolt: null };
  const info = (BUILD[id] || BUILD.ar)(P, lod);
  const group = new THREE.Group();
  for (const k of Object.keys(GUN_MATS)) {
    if (!P[k].length) continue;
    if (!lod && (k === 'lens' || k === 'dot')) continue;
    const m = meshOf(P[k], GUN_MATS[k]);
    m.castShadow = lod ? false : k !== 'lens';
    group.add(m);
  }
  const parts = {};
  for (const k of ['mag', 'pump', 'bolt']) {
    if (!P[k]) continue;
    const m = meshOf(P[k], k === 'pump' ? (id === 'shotgun' ? GUN_MATS.wood : GUN_MATS.poly) : k === 'bolt' ? GUN_MATS.steel : GUN_MATS.poly);
    m.castShadow = !lod;
    group.add(m);
    parts[k] = m;
  }
  return { group, ...parts, ...info };
}

// Brass shell casing, for ejecting from your gun.
export function casingGeometry() {
  const g = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6);
  g.rotateX(Math.PI / 2);
  return g;
}
