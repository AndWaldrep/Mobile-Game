// Turns a map grid into 3D meshes: textured, bump-mapped blocks with soft shading in the
// corners, a sky, scenery outside the walls, and props like palms and cranes.
// Textures are painted on canvases at startup, so there's nothing to download.

import * as THREE from 'three';

// ------------------------------------------------------------------ textures

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function speckle(ctx, s, r, n, lo, hi, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(lo + r() * (hi - lo));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(r() * s, r() * s, size, size);
  }
}

const PAINTERS = {
  sand(ctx, s, r) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, r, 1800, 205, 255, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const y = r() * s;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 10, s * 0.6, y - 10, s, y);
      ctx.stroke();
    }
  },
  tiles(ctx, s, r) {
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, 0, s, s);
    const n = 2;
    const q = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = 215 + Math.floor(r() * 35);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x * q + 3, y * q + 3, q - 6, q - 6);
      }
    speckle(ctx, s, r, 400, 180, 240, 2);
  },
  plaster(ctx, s, r) {
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const v = 215 + Math.floor(r() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 6 + r() * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, s, r, 500, 200, 255, 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = r() * s;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < s * 0.5) {
      x += (r() - 0.5) * 12;
      y += 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
  stone(ctx, s, r) {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, s, s);
    const rows = 4;
    const h = s / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 40;
      while (x < s) {
        const w = 30 + r() * 40;
        const v = 190 + Math.floor(r() * 50);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x + 2, i * h + 2, w - 4, h - 4);
        x += w;
      }
    }
    speckle(ctx, s, r, 500, 150, 230, 2);
  },
  brick(ctx, s, r) {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, s, s);
    const rows = 8;
    const h = s / rows;
    for (let i = 0; i < rows; i++) {
      const off = i % 2 ? s / 8 : 0;
      for (let x = -s / 4 + off; x < s; x += s / 4) {
        const v = 200 + Math.floor(r() * 55);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x + 2, i * h + 2, s / 4 - 4, h - 3);
      }
    }
    speckle(ctx, s, r, 300, 170, 240, 2);
  },
  wood(ctx, s, r) {
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(0, 0, s, s);
    const planks = 4;
    const h = s / planks;
    for (let i = 0; i < planks; i++) {
      const v = 205 + Math.floor(r() * 45);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, i * h + 1, s, h - 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        const y = i * h + 4 + r() * (h - 8);
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + 3, s * 0.7, y - 3, s, y);
        ctx.stroke();
      }
    }
    // Crate frame
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, s - 6, s - 6);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(s - 6, s - 6);
    ctx.stroke();
  },
  metal(ctx, s, r) {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) {
      const v = 200 + Math.floor(r() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v},0.6)`;
      ctx.fillRect(0, i, s, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (const [x, y] of [[8, 8], [s - 10, 8], [8, s - 10], [s - 10, s - 10]]) ctx.fillRect(x, y, 3, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
  },
  container(ctx, s, r) {
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, s, s);
    const ribs = 8;
    const w = s / ribs;
    for (let i = 0; i < ribs; i++) {
      const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      g.addColorStop(0, '#bdbdbd');
      g.addColorStop(0.5, '#f4f4f4');
      g.addColorStop(1, '#c4c4c4');
      ctx.fillStyle = g;
      ctx.fillRect(i * w, 0, w, s);
    }
    speckle(ctx, s, r, 250, 150, 230, 2);
    ctx.fillStyle = 'rgba(120,70,40,0.18)';
    for (let i = 0; i < 6; i++) ctx.fillRect(r() * s, r() * s, 3 + r() * 6, 8 + r() * 20);
  },
  concrete(ctx, s, r) {
    ctx.fillStyle = '#d6d6d6';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, r, 1400, 180, 250, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  },
  asphalt(ctx, s, r) {
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, r, 2000, 130, 230, 2);
    ctx.fillStyle = 'rgba(255,235,120,0.8)';
    ctx.fillRect(s / 2 - 3, 0, 6, s * 0.5);
  },
  water(ctx, s, r) {
    ctx.fillStyle = '#c8d8e0';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = r() * s;
      const y = r() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y);
      ctx.stroke();
    }
  },
};


// Surface detail for lighting: a normal map made from each texture's light and dark areas.
function normalFrom(src, strength) {
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(w, h);
  const L = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (L(x + 1, y) - L(x - 1, y)) * strength;
      const dy = (L(x, y + 1) - L(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

const SURF = {
  sand: { rough: 0.97, bump: 1.4 },
  tiles: { rough: 0.78, bump: 3 },
  plaster: { rough: 0.93, bump: 1.4 },
  stone: { rough: 0.85, bump: 4 },
  brick: { rough: 0.88, bump: 4 },
  wood: { rough: 0.72, bump: 2.5 },
  metal: { rough: 0.42, metal: 0.55, bump: 1.2 },
  container: { rough: 0.5, metal: 0.35, bump: 5 },
  concrete: { rough: 0.92, bump: 1.4 },
  asphalt: { rough: 0.96, bump: 1 },
  water: { rough: 0.06, metal: 0.3, bump: 3 },
};

const texCache = new Map();
function textures(name) {
  if (!texCache.has(name)) {
    // Painted at 128 units, drawn at 256 px for crisp detail.
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    (PAINTERS[name] || PAINTERS.concrete)(ctx, 128, rng(name.length * 977));
    const map = new THREE.CanvasTexture(c);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const normal = new THREE.CanvasTexture(normalFrom(c, SURF[name]?.bump ?? 1.5));
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    texCache.set(name, { map, normal });
  }
  return texCache.get(name);
}

function surface(name, extra = {}) {
  const t = textures(name);
  const s = SURF[name] || {};
  return new THREE.MeshStandardMaterial({
    map: t.map,
    normalMap: t.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: s.rough ?? 0.85,
    metalness: s.metal ?? 0,
    vertexColors: true,
    ...extra,
  });
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
}

// Windows and doors, painted once into one small texture.
let decoTex = null;
function decoTexture() {
  if (decoTex) return decoTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  // Window (left)
  ctx.fillStyle = '#d9d2c4';
  ctx.fillRect(0, 0, 128, 128);
  const g = ctx.createLinearGradient(0, 10, 0, 118);
  g.addColorStop(0, '#5a7488');
  g.addColorStop(0.55, '#24323d');
  g.addColorStop(1, '#151c22');
  ctx.fillStyle = g;
  ctx.fillRect(12, 10, 104, 108);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(30, 10);
  ctx.lineTo(56, 10);
  ctx.lineTo(24, 118);
  ctx.lineTo(12, 118);
  ctx.lineTo(12, 60);
  ctx.fill();
  ctx.fillStyle = '#d9d2c4';
  ctx.fillRect(60, 10, 8, 108);
  ctx.fillRect(12, 60, 104, 7);
  ctx.fillStyle = '#6b5a45';
  ctx.fillRect(4, 114, 120, 12); // sill
  // Door (right)
  ctx.fillStyle = '#4b3a2a';
  ctx.fillRect(128, 0, 128, 128);
  ctx.fillStyle = '#7a5532';
  ctx.fillRect(138, 6, 108, 122);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  for (let x = 152; x < 246; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, 126);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a2c1f';
  ctx.fillRect(144, 30, 96, 6);
  ctx.fillRect(144, 92, 96, 6);
  ctx.fillStyle = '#c8b27a';
  ctx.beginPath();
  ctx.arc(232, 70, 4, 0, Math.PI * 2);
  ctx.fill();
  decoTex = new THREE.CanvasTexture(c);
  decoTex.colorSpace = THREE.SRGBColorSpace;
  decoTex.anisotropy = 4;
  return decoTex;
}

function hash(x, z, k = 0) {
  let h = (x * 374761393 + z * 668265263 + k * 2147483647) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return h;
}

// ------------------------------------------------------------------ the level

export function buildWorld(grid, def) {
  const root = new THREE.Group();
  const th = def.theme;
  const groups = new Map(); // texture -> buffers
  const buf = (t) => {
    if (!groups.has(t)) groups.set(t, { pos: [], nor: [], uv: [], col: [], idx: [] });
    return groups.get(t);
  };
  const deco = { pos: [], nor: [], uv: [], idx: [] };
  const color = new THREE.Color();
  const mats = grid.matNames.map((n) => def.mats[n]);

  function quad(b, p, n, uv, c) {
    const base = b.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      b.pos.push(...p[i]);
      b.nor.push(...n);
      b.uv.push(...uv[i]);
      if (c) b.col.push(c[i][0], c[i][1], c[i][2]);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // A window or door on the outside of a wall face.
  function decal(kind, n, cx, cz, y0, y1, half) {
    const off = 0.015;
    const px = cx + n[0] * off;
    const pz = cz + n[2] * off;
    // Horizontal direction along the face (so the quad faces outward).
    const tx = -n[2];
    const tz = n[0];
    const u0 = kind === 'door' ? 0.5 : 0;
    const u1 = kind === 'door' ? 1 : 0.5;
    quad(
      deco,
      [[px - tx * half, y0, pz - tz * half], [px - tx * half, y1, pz - tz * half], [px + tx * half, y1, pz + tz * half], [px + tx * half, y0, pz + tz * half]],
      n,
      [[u1, 0], [u1, 1], [u0, 1], [u0, 0]]
    );
  }

  const W = grid.w;
  const D = grid.d;
  const vis = (x, z) => (x < 0 || z < 0 || x >= W || z >= D ? 0 : grid.vis[z * W + x]);
  const props = { barrel: [], bags: [] };
  const slabOf = (x, z) => {
    if (x < 0 || z < 0 || x >= W || z >= D) return null;
    const k = z * W + x;
    return grid.shi[k] > grid.slo[k] ? [grid.slo[k], grid.shi[k]] : null;
  };
  // Parts of [lo, hi] not covered by any of the given intervals.
  const minus = (lo, hi, cover) => {
    let segs = [[lo, hi]];
    for (const [a, b] of cover) {
      const next = [];
      for (const [p, q] of segs) {
        if (b <= p || a >= q) next.push([p, q]);
        else {
          if (a > p) next.push([p, a]);
          if (b < q) next.push([b, q]);
        }
      }
      segs = next;
    }
    return segs.filter(([p, q]) => q - p > 0.01);
  };
  const SIDES = (x, z) => [
    [x + 1, z, [1, 0, 0], [[x + 1, z + 1], [x + 1, z]]],
    [x - 1, z, [-1, 0, 0], [[x, z], [x, z + 1]]],
    [x, z + 1, [0, 0, 1], [[x, z + 1], [x + 1, z + 1]]],
    [x, z - 1, [0, 0, -1], [[x + 1, z], [x, z]]],
  ];
  function side(b, n, a, c, lo, hi, shade, darkBottom) {
    const u0 = n[0] !== 0 ? a[1] : a[0];
    const u1 = n[0] !== 0 ? c[1] : c[0];
    quad(
      b,
      [[c[0], lo, c[1]], [c[0], hi, c[1]], [a[0], hi, a[1]], [a[0], lo, a[1]]],
      n,
      [[u1, lo], [u1, hi], [u0, hi], [u0, lo]],
      [shade(darkBottom), shade(1.02), shade(1.02), shade(darkBottom)]
    );
  }
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const i = z * W + x;
      const h = grid.vis[i];
      let m = mats[grid.mat[i]];
      if (m.render) props[m.render].push([x, z, grid.col[i]]);
      if (m.under && h <= 0.001) m = def.mats[m.under];
      const tint = grid.tint[i] * (0.94 + (hash(x, z) % 1000) / 1000 * 0.1);
      const mySlab = slabOf(x, z);
      // Indoors (under a roof) is a little darker, even without shadows.
      const indoor = mySlab && mySlab[0] > h ? 0.78 : 1;
      color.set(m.color).multiplyScalar(tint);
      const base = [color.r, color.g, color.b];
      const shade = (k) => [base[0] * k * indoor, base[1] * k * indoor, base[2] * k * indoor];
      const b = buf(m.tex);
      // Top: darken corners next to taller blocks (soft ambient occlusion).
      const ao = (vx, vz) => {
        let occ = 0;
        for (const [ox, oz] of [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]]) if (vis(ox, oz) > h + 0.25) occ++;
        return 1 - occ * 0.16;
      };
      const ts = m.tex === 'sand' || m.tex === 'concrete' || m.tex === 'asphalt' ? 0.5 : m.tex === 'water' ? 0.25 : 1;
      quad(
        b,
        [[x, h, z], [x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z]],
        [0, 1, 0],
        [[x * ts, z * ts], [x * ts, (z + 1) * ts], [(x + 1) * ts, (z + 1) * ts], [(x + 1) * ts, z * ts]],
        [shade(ao(x, z)), shade(ao(x, z + 1)), shade(ao(x + 1, z + 1)), shade(ao(x + 1, z))]
      );
      // Column sides wherever the neighbor doesn't cover them.
      SIDES(x, z).forEach(([nx, nz, n, [a, c]], k) => {
        const nh = vis(nx, nz);
        const ns = slabOf(nx, nz);
        const segs = nh < h ? minus(nh, h, ns ? [ns] : []) : [];
        for (const [lo, hi] of segs) side(b, n, a, c, lo, hi, shade, lo <= 0.01 && hi > 0.3 ? 0.7 : 0.86);
        // Windows and doors painted on plain building walls that face open ground.
        if (m.deco && nh <= 0.01 && nh > -0.1 && !ns) {
          const fx = (a[0] + c[0]) / 2;
          const fz = (a[1] + c[1]) / 2;
          const r = hash(x, z, k + 1);
          if (m.deco !== 'high' && h >= 2.5 && r % 13 === 4 && m.doors !== false) decal('door', n, fx, fz, 0, 2.05, 0.45);
          else if (m.deco === 'high' && h >= 4.5 && r % 3 === 0) decal('window', n, fx, fz, 3.1, 4.1, 0.38);
          else if (m.deco !== 'high' && h >= 3 && r % 4 === 1) decal('window', n, fx, fz, Math.min(h - 1.5, 1.6), Math.min(h - 0.5, 2.6), 0.36);
        }
      });
      // Floating slab: roof, lintel, or the wall above a window.
      if (mySlab) {
        const [slo, shi] = mySlab;
        const m2 = mats[grid.mat2[i]];
        color.set(m2.color).multiplyScalar(grid.tint[i]);
        const b2 = buf(m2.tex);
        const base2 = [color.r, color.g, color.b];
        const shade2 = (k2) => [base2[0] * k2, base2[1] * k2, base2[2] * k2];
        const ts2 = m2.tex === 'concrete' ? 0.5 : 1;
        quad(
          b2,
          [[x, shi, z], [x, shi, z + 1], [x + 1, shi, z + 1], [x + 1, shi, z]],
          [0, 1, 0],
          [[x * ts2, z * ts2], [x * ts2, (z + 1) * ts2], [(x + 1) * ts2, (z + 1) * ts2], [(x + 1) * ts2, z * ts2]],
          [shade2(1), shade2(1), shade2(1), shade2(1)]
        );
        // Underside (a ceiling, seen from inside)
        quad(
          b2,
          [[x, slo, z], [x + 1, slo, z], [x + 1, slo, z + 1], [x, slo, z + 1]],
          [0, -1, 0],
          [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]],
          [shade2(0.55), shade2(0.55), shade2(0.55), shade2(0.55)]
        );
        SIDES(x, z).forEach(([nx, nz, n, [a, c]]) => {
          const nh = vis(nx, nz);
          const ns = slabOf(nx, nz);
          const cover = [[-1e9, nh]];
          if (ns) cover.push(ns);
          for (const [lo, hi] of minus(slo, shi, cover)) side(b2, n, a, c, lo, hi, shade2, 0.8);
        });
      }
    }
  }

  const surfaces = {};
  for (const [t, b] of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    const mat = surface(t, t === 'water' ? { transparent: false } : {});
    if (t === 'water') {
      mat.map = textures('water').map.clone();
      mat.normalMap = textures('water').normal.clone();
      mat.map.needsUpdate = mat.normalMap.needsUpdate = true;
    }
    surfaces[t] = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = t !== 'water';
    root.add(mesh);
  }
  if (deco.pos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(deco.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(deco.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(deco.uv, 2));
    geo.setIndex(deco.idx);
    const mat = new THREE.MeshStandardMaterial({ map: decoTexture(), roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  root.add(buildBarrels(props.barrel));
  root.add(buildSandbags(grid, props.bags));
  root.add(buildRoofStuff(grid, def));

  const water = surfaces.water;
  root.add(buildSky(th));
  const decor = buildDecor(grid, def);
  root.add(decor.group);
  for (const p of grid.props) {
    const m = PROPS[p.type]?.(p, def);
    if (m) {
      m.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      root.add(m);
    }
  }

  return {
    group: root,
    update(dt, t) {
      for (const m of [water, decor.water]) {
        if (!m) continue;
        m.map.offset.set((t * 0.02) % 1, (t * 0.013) % 1);
        m.normalMap.offset.set((-t * 0.031) % 1, (t * 0.017) % 1);
      }
      for (const c of decor.clouds) c.position.x = c.userData.x0 + ((t * c.userData.speed) % 600) - 300;
    },
  };
}

// Oil drums, one per cell, a little rotated and dented for variety.
function buildBarrels(list) {
  const g = new THREE.Group();
  if (!list.length) return g;
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 16, 3);
  // Ribs
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (Math.abs(Math.abs(y) - 0.166) < 0.01) {
      pos.setX(i, pos.getX(i) * 1.04);
      pos.setZ(i, pos.getZ(i) * 1.04);
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.45, map: textures('metal').map });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const colors = ['#2d5c8f', '#a8342a', '#4f6b3a', '#d0a22a', '#3a3a3a'];
  const m4 = new THREE.Matrix4();
  const c = new THREE.Color();
  list.forEach(([x, z, h], i) => {
    const r = hash(x, z, 5);
    const sy = Math.min(1.05, h);
    m4.compose(
      new THREE.Vector3(x + 0.5, sy / 2, z + 0.5),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r % 628) / 100, 0)),
      new THREE.Vector3(1, sy, 1)
    );
    im.setMatrixAt(i, m4);
    im.setColorAt(i, c.set(colors[r % colors.length]));
  });
  im.castShadow = true;
  im.receiveShadow = true;
  g.add(im);
  return g;
}

// Stacked sandbags for low cover walls.
function buildSandbags(grid, list) {
  const g = new THREE.Group();
  if (!list.length) return g;
  const geo = new THREE.SphereGeometry(0.5, 10, 6);
  geo.scale(0.56, 0.2, 0.36);
  const mat = new THREE.MeshStandardMaterial({ color: '#b39b72', roughness: 0.97, map: textures('sand').map });
  const per = 6;
  const im = new THREE.InstancedMesh(geo, mat, list.length * per);
  const m4 = new THREE.Matrix4();
  const set = new Set(list.map(([x, z]) => z * grid.w + x));
  let n = 0;
  for (const [x, z, h] of list) {
    // Run the bags along the wall's direction.
    const alongX = set.has(z * grid.w + x + 1) || set.has(z * grid.w + x - 1) || !(set.has((z + 1) * grid.w + x) || set.has((z - 1) * grid.w + x));
    const rows = 3;
    for (let row = 0; row < rows; row++) {
      for (let k = 0; k < 2; k++) {
        const r = hash(x, z, row * 2 + k);
        const off = (k - 0.5) * 0.5 + (row % 2 ? 0.12 : -0.12);
        const y = (h / rows) * (row + 0.5);
        const pos = alongX ? new THREE.Vector3(x + 0.5 + off, y, z + 0.5) : new THREE.Vector3(x + 0.5, y, z + 0.5 + off);
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (alongX ? 0 : Math.PI / 2) + ((r % 100) - 50) / 600, ((r % 37) - 18) / 300));
        m4.compose(pos, rot, new THREE.Vector3(1, (h / rows) / 0.2, 1.6));
        im.setMatrixAt(n++, m4);
      }
    }
  }
  im.count = n;
  im.castShadow = true;
  im.receiveShadow = true;
  g.add(im);
  return g;
}

// Air conditioners, water tanks and satellite dishes on rooftops nobody can reach.
function buildRoofStuff(grid, def) {
  const g = new THREE.Group();
  const roofMat = Object.keys(def.mats).find((k) => def.mats[k].roofProps);
  if (!roofMat) return g;
  const mi = grid.matIndex[roofMat];
  const ac = std('#c9c6bd', { roughness: 0.6, metalness: 0.3 });
  const tank = std('#3d6fa3', { roughness: 0.5, metalness: 0.2 });
  const dish = std('#e8e8e8', { roughness: 0.5 });
  for (let z = 1; z < grid.d - 1; z++) {
    for (let x = 1; x < grid.w - 1; x++) {
      const i = z * grid.w + x;
      // Props sit on roofs made of this material (slabs) that are surrounded by more roof.
      if (!(grid.shi[i] > grid.slo[i]) || grid.mat2[i] !== mi) continue;
      const h = grid.shi[i];
      let inner = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (z + dz) * grid.w + x + dx;
        if (!(grid.shi[j] > grid.slo[j]) || grid.mat2[j] !== mi) inner = false;
      }
      if (!inner) continue;
      const r = hash(x, z, 9) % 5;
      if (r === 0) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), ac);
        m.position.set(x + 0.5, h + 0.3, z + 0.5);
        g.add(m);
      } else if (r === 1) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 12), tank);
        m.position.set(x + 0.5, h + 0.45, z + 0.5);
        g.add(m);
      } else if (r === 2) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, 1.0), dish);
        m.rotation.x = -0.9;
        m.position.set(x + 0.5, h + 0.45, z + 0.5);
        g.add(m);
      }
    }
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

function skyDome(th, radius = 900) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const top = new THREE.Color(th.skyTop);
  const bottom = new THREE.Color(th.skyBottom);
  const sunDir = new THREE.Vector3(...th.sunDir).normalize();
  const sunCol = new THREE.Color(th.sun);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const cols = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const f = Math.pow(Math.max(0, v.y), 0.5);
    c.copy(bottom).lerp(top, f);
    // Glow around the sun
    const glow = Math.pow(Math.max(0, v.dot(sunDir)), 6) * 0.6;
    c.lerp(sunCol, glow);
    if (v.y < 0) c.multiplyScalar(0.8);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -1;
  return mesh;
}

// A small scene used to light everything with the sky's colors (reflections on metal, water and guns).
export function buildEnvScene(th) {
  const s = new THREE.Scene();
  s.add(skyDome(th, 50));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.sun).multiplyScalar(6) }));
  sun.position.copy(new THREE.Vector3(...th.sunDir).normalize().multiplyScalar(45));
  s.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 16), new THREE.MeshBasicMaterial({ color: th.outside }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  s.add(ground);
  return s;
}

function buildSky(th) {
  const g = new THREE.Group();
  g.add(skyDome(th));
  const sunGeo = new THREE.CircleGeometry(36, 24);
  const sun = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: th.sun, fog: false, transparent: true, opacity: 0.9 }));
  const d = new THREE.Vector3(...th.sunDir).normalize().multiplyScalar(850);
  sun.position.copy(d);
  sun.lookAt(0, 0, 0);
  g.add(sun);
  g.userData.sky = true;
  return g;
}

let cloudTex = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const r = rng(42);
  for (let i = 0; i < 26; i++) {
    const x = 40 + r() * 176;
    const y = 50 + r() * 40 - Math.abs(x - 128) * 0.15;
    const rad = 14 + r() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  cloudTex = new THREE.CanvasTexture(c);
  return cloudTex;
}

function buildDecor(grid, def) {
  const g = new THREE.Group();
  const th = def.theme;
  const cx = grid.w / 2;
  const cz = grid.d / 2;
  const r = rng(def.id.length * 31);
  let water = null;
  const clouds = [];
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTexture(), color: th.cloud || '#ffffff', fog: false, transparent: true, depthWrite: false, opacity: 0.9 });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(cloudMat);
    const a = r() * Math.PI * 2;
    const dist = 250 + r() * 350;
    s.position.set(cx + Math.cos(a) * dist, 110 + r() * 120, cz + Math.sin(a) * dist);
    s.scale.set(160 + r() * 140, 60 + r() * 40, 1);
    s.userData.x0 = s.position.x;
    s.userData.speed = 1 + r() * 2;
    g.add(s);
    clouds.push(s);
  }
  const big = (name, rep) => {
    const t = textures(name);
    const map = t.map.clone();
    const normal = t.normal.clone();
    map.repeat.set(rep, rep);
    normal.repeat.set(rep, rep);
    map.needsUpdate = normal.needsUpdate = true;
    return { map, normal };
  };
  if (th.decor === 'dunes') {
    const t = big('sand', 400);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std(th.outside, { map: t.map, normalMap: t.normal, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.02, cz);
    ground.receiveShadow = true;
    g.add(ground);
    const duneMat = std('#dcb67a', { roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2;
      const dist = 60 + r() * 120;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), duneMat);
      dune.scale.set(18 + r() * 25, 4 + r() * 8, 14 + r() * 20);
      dune.position.set(cx + Math.cos(a) * dist, -1, cz + Math.sin(a) * dist);
      g.add(dune);
    }
    const mesaMat = std('#b8754a', { roughness: 0.95 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r();
      const dist = 260 + r() * 140;
      const h = 30 + r() * 50;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(30 + r() * 30, 45 + r() * 30, h, 9), mesaMat);
      mesa.position.set(cx + Math.cos(a) * dist, h / 2 - 2, cz + Math.sin(a) * dist);
      g.add(mesa);
    }
    // The rest of the town peeking over the walls, plus a minaret and power poles.
    const houseMats = ['#d2b088', '#c9a274', '#e0c9a4'].map((col) => surface('plaster', { vertexColors: false, color: col }));
    for (let i = 0; i < 36; i++) {
      const side = i % 4;
      const along = r();
      const out = 6 + r() * 30;
      const x = side === 0 ? -out : side === 1 ? grid.w + out : along * grid.w;
      const z = side === 2 ? -out : side === 3 ? grid.d + out : along * grid.d;
      const w = 5 + r() * 8;
      const h = 4 + r() * 7;
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5 + r() * 8), houseMats[i % 3]);
      house.position.set(x, h / 2, z);
      g.add(house);
    }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 26, 10), houseMats[2]);
    tower.position.set(-22, 13, cz - 6);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#3f8f7a', { roughness: 0.5, metalness: 0.3 }));
    cap.position.set(-22, 26, cz - 6);
    g.add(tower, cap);
    const pole = std('#5b4632');
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 6), pole);
      p.position.set(-3 + i * 6, 4.5, -3);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), pole);
      bar.position.set(-3 + i * 6, 8.6, -3);
      g.add(p, bar);
    }
  } else if (th.decor === 'sea') {
    const wt = big('water', 160);
    water = new THREE.MeshStandardMaterial({ color: '#2f5f7a', map: wt.map, normalMap: wt.normal, roughness: 0.08, metalness: 0.3 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), water);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(cx + 500, -0.62, cz);
    sea.receiveShadow = true;
    g.add(sea);
    const lt = big('concrete', 200);
    const land = new THREE.Mesh(new THREE.PlaneGeometry(400, 900), std(th.outside, { map: lt.map, normalMap: lt.normal }));
    land.rotation.x = -Math.PI / 2;
    land.position.set(44 - 200, -0.02, cz);
    land.receiveShadow = true;
    g.add(land);
    // Container stacks outside the fence.
    const cols = ['#b8392c', '#2d6db5', '#3c8d4f', '#d9a52b', '#d8d8d2', '#7a3f8f'];
    const ctex = textures('container');
    const cmats = cols.map((col) => new THREE.MeshStandardMaterial({ color: col, map: ctex.map, normalMap: ctex.normal, roughness: 0.5, metalness: 0.35 }));
    for (let i = 0; i < 70; i++) {
      const side = i % 3;
      let x;
      let z;
      if (side === 0) (x = -4 - r() * 70), (z = r() * grid.d);
      else (x = r() * 44), (z = side === 1 ? -4 - r() * 50 : grid.d + 4 + r() * 50);
      const stack = 1 + Math.floor(r() * 3);
      const along = r() < 0.5;
      for (let k = 0; k < stack; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(along ? 6 : 2.4, 2.6, along ? 2.4 : 6), cmats[Math.floor(r() * cmats.length)]);
        c.position.set(x, 1.3 + k * 2.6, z);
        c.castShadow = true;
        g.add(c);
      }
    }
    // Floodlight towers
    const steel = std('#7d858d', { metalness: 0.6, roughness: 0.4 });
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
    for (const [x, z] of [[-3, 6], [-3, 40], [20, -4], [20, 50], [46, -4], [46, 50]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 18, 8), steel);
      p.position.set(x, 9, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.5), steel);
      head.position.set(x, 18, z);
      head.lookAt(cx, 18, cz);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), lamp);
      glow.position.copy(head.position).add(new THREE.Vector3(cx - x, 0, cz - z).normalize().multiplyScalar(0.3));
      glow.lookAt(cx, 18, cz);
      g.add(p, head, glow);
    }
    // Far city skyline, with lit windows.
    const cityMat = std('#4b4560', { roughness: 0.9 });
    for (let i = 0; i < 40; i++) {
      const h = 15 + r() * 60;
      const b = new THREE.Mesh(new THREE.BoxGeometry(10 + r() * 14, h, 10 + r() * 14), cityMat);
      b.position.set(-180 - r() * 120, h / 2, cz - 300 + i * 15 + r() * 8);
      g.add(b);
    }
  }
  return { group: g, water, clouds };
}

// ------------------------------------------------------------------ props

const PROPS = {
  palm(p) {
    const g = new THREE.Group();
    const trunkMat = std('#8a6239', { roughness: 0.95 });
    let y = 0;
    let lean = 0;
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.008, 0.23 - i * 0.01, 0.8, 8), trunkMat);
      lean += 0.035;
      seg.position.set(lean * i * 0.5, y + 0.4, 0);
      seg.rotation.z = -lean * 0.5;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19 - i * 0.008, 0.035, 4, 10), trunkMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(lean * i * 0.5, y + 0.78, 0);
      g.add(seg, ring);
      y += 0.78;
    }
    const top = new THREE.Vector3(lean * 3.6, y, 0);
    const leafMat = std('#3f8f3a', { side: THREE.DoubleSide, roughness: 0.8 });
    const leafMat2 = std('#2f7a30', { side: THREE.DoubleSide, roughness: 0.8 });
    for (let i = 0; i < 11; i++) {
      // Each frond is a curved, tapered strip.
      const len = 2.6 + (i % 3) * 0.4;
      const shape = new THREE.PlaneGeometry(0.7, len, 1, 6);
      const pos = shape.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const t = (pos.getY(k) + len / 2) / len; // 0 at base .. 1 at tip
        pos.setX(k, pos.getX(k) * Math.sin(Math.PI * Math.min(1, t * 1.1)) * 1.1);
        pos.setZ(k, -t * t * 1.4);
      }
      shape.translate(0, len / 2, 0);
      shape.computeVertexNormals();
      const leaf = new THREE.Mesh(shape, i % 2 ? leafMat : leafMat2);
      const a = (i / 11) * Math.PI * 2;
      leaf.position.copy(top);
      leaf.rotation.set(0, -a, 0, 'YXZ');
      leaf.rotateX(-1.1 - (i % 3) * 0.15);
      g.add(leaf);
    }
    const nutMat = std('#5a3d1f');
    for (let i = 0; i < 4; i++) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), nutMat);
      n.position.set(top.x + Math.cos(i * 1.6) * 0.2, top.y - 0.25, Math.sin(i * 1.6) * 0.2);
      g.add(n);
    }
    g.position.set(p.x, 0, p.z);
    return g;
  },
  crane(p) {
    const g = new THREE.Group();
    const orange = std('#e8a020', { metalness: 0.4, roughness: 0.5 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 0.9), orange);
    beam.position.set(0.5, 12.2, 0);
    g.add(beam);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 1.2), orange);
    boom.position.set(13, 13.1, 0);
    g.add(boom);
    // Lattice braces along the boom
    for (let x = -2; x < 29; x += 2.2) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), orange);
      brace.position.set(x, 13.9, 0);
      brace.rotation.z = 0.6;
      g.add(brace);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(34, 0.2, 0.3), orange);
    top.position.set(13, 14.6, 0);
    g.add(top);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.2), std('#dddddd', { roughness: 0.4 }));
    cab.position.set(2, 11, 0);
    g.add(cab);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.06, 7, 0.06), std('#222'));
    cable.position.set(18, 9.5, 0);
    g.add(cable);
    const ct = textures('container');
    const hook = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), std('#3c8d4f', { map: ct.map, normalMap: ct.normal, metalness: 0.35, roughness: 0.5 }));
    hook.position.set(18, 4.8, 0);
    g.add(hook);
    g.position.set(p.x, 0, p.z);
    return g;
  },
  ship(p) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 70), std('#3a3f4a', { metalness: 0.3, roughness: 0.6 }));
    hull.position.set(0, 2, 0);
    g.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(22.2, 1.2, 70.2), std('#a33a2c'));
    stripe.position.set(0, -0.8, 0);
    g.add(stripe);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 8), std('#e8e8e8', { roughness: 0.5 }));
    bridge.position.set(0, 10, 28);
    g.add(bridge);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 6, 12), std('#b23a2c'));
    funnel.position.set(0, 17, 30);
    g.add(funnel);
    const cols = ['#b8392c', '#2d6db5', '#3c8d4f', '#d9a52b', '#d8d8d2'];
    const ct = textures('container');
    const cm = cols.map((col) => std(col, { map: ct.map, normalMap: ct.normal, metalness: 0.35, roughness: 0.5 }));
    const r = rng(5);
    for (let z = -30; z < 20; z += 6.5)
      for (let x = -8; x <= 8; x += 2.6) {
        const h = 1 + Math.floor(r() * 3);
        const c = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6 * h, 6), cm[Math.floor(r() * cm.length)]);
        c.position.set(x, 5.5 + 1.3 * h, z);
        g.add(c);
      }
    g.position.set(p.x + 18, 0, p.z);
    return g;
  },
  awning(p) {
    // A cloth market awning on poles, high enough to walk under.
    const g = new THREE.Group();
    const cloth = std(p.color || '#c0392b', { side: THREE.DoubleSide, roughness: 0.95 });
    const geo = new THREE.PlaneGeometry(p.w || 2.4, p.d || 1.8, 6, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / (p.w || 2.4)) * Math.PI * 6) * 0.04);
    geo.computeVertexNormals();
    const top = new THREE.Mesh(geo, cloth);
    top.rotation.x = -Math.PI / 2 + 0.25;
    top.position.y = p.h || 2.7;
    g.add(top);
    const pole = std('#5b4632');
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, (p.h || 2.7) + sz * 0.2, 6), pole);
        m.position.set((sx * (p.w || 2.4)) / 2 * 0.95, ((p.h || 2.7) + sz * 0.2) / 2, (sz * (p.d || 1.8)) / 2 * 0.9);
        g.add(m);
      }
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot || 0;
    if (p.flip) g.scale.z = -1;
    return g;
  },
};
