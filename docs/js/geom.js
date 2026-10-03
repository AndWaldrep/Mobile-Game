// Small geometry helpers: merge many parts into one mesh (fewer draw calls on
// phones), and make limbs that run between two points.

import * as THREE from 'three';

// parts: [{ geo, color?, uv? }] -> one BufferGeometry with position/normal/uv(/color).
// `uv` remaps that part's UVs into a region [u0, v0, u1, v1] of a texture atlas.
export function merge(parts, withColor = false) {
  let count = 0;
  for (const p of parts) count += p.geo.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = withColor ? new Float32Array(count * 3) : null;
  const idx = [];
  let o = 0;
  const c = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.geo : p.geo;
    const a = g.attributes;
    const n = a.position.count;
    pos.set(a.position.array, o * 3);
    nor.set(a.normal.array, o * 3);
    if (a.uv) {
      const r = p.uv || [0, 0, 1, 1];
      for (let i = 0; i < n; i++) {
        uv[(o + i) * 2] = r[0] + a.uv.array[i * 2] * (r[2] - r[0]);
        uv[(o + i) * 2 + 1] = r[1] + a.uv.array[i * 2 + 1] * (r[3] - r[1]);
      }
    }
    if (col) {
      c.set(p.color ?? '#ffffff');
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], (o + i) * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.array[i] + o);
    else for (let i = 0; i < n; i++) idx.push(i + o);
    o += n;
    p.geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();

// Place a geometry built along +y (centered) so it runs from a to b.
export function between(geo, a, b) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  geo.applyMatrix4(tmpM.makeScale(1, len / geo.userData.len, 1));
  tmpQ.setFromUnitVectors(UP, dir.normalize());
  geo.applyMatrix4(tmpM.makeRotationFromQuaternion(tmpQ));
  geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return geo;
}

// A rounded limb from point a to point b.
export function limb(a, b, r, seg = 7) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2 + r), 3, seg);
  geo.userData.len = len + r; // capsule total height = length + 2r; keep the ends a bit inside the joints
  return between(geo, a, b);
}

export function cyl(r1, r2, len, seg = 10) {
  const geo = new THREE.CylinderGeometry(r1, r2, len, seg);
  geo.userData.len = len;
  return geo;
}

// Cylinder along z (for barrels, scopes, etc).
export function tubeZ(r, len, x, y, z, seg = 12, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

export function box(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

export function sphere(r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
