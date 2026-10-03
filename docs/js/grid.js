// The map is a grid of 1 m cells. Each cell has a solid column from the
// ground up to some height, and can also have one floating "slab" above it: a
// roof, a door lintel, or the wall above a window. That's enough for buildings
// you can walk into, windows you can shoot through and roofs you can stand on,
// while keeping collision, bullets, line of sight and bot pathfinding simple,
// exact and fast on phones. Nothing here touches Three.js, so the room (host)
// and the tests can use it too.

export const STEP = 0.55; // highest ledge you can walk up without jumping
export const JUMP_UP = 1.15; // highest ledge bots will jump onto
export const REACH = 0.6; // within this of a slab's top, you're standing on it
export const HEADROOM = 1.85; // space a standing soldier needs
export const OUT = 99; // height outside the map

export class Grid {
  // def: { w, d, mats: { name: {...} }, build(api) }
  constructor(def) {
    this.def = def;
    this.w = def.w;
    this.d = def.d;
    const n = this.w * this.d;
    this.col = new Float32Array(n); // solid column you collide with
    this.ray = new Float32Array(n); // column that stops bullets
    this.vis = new Float32Array(n); // column that's drawn
    this.slo = new Float32Array(n).fill(-1); // slab bottom (-1: none)
    this.shi = new Float32Array(n).fill(-1); // slab top
    this.mat = new Uint16Array(n);
    this.mat2 = new Uint16Array(n); // slab material
    this.tint = new Float32Array(n).fill(1);
    this.matNames = Object.keys(def.mats);
    this.matIndex = Object.fromEntries(this.matNames.map((m, i) => [m, i]));
    this.spawns = [];
    this.props = [];
    this.maxH = 0;
    const mz = (z, d) => this.d - z - d;
    const api = {
      box: (x, z, w, d, h, mat, o = {}) => this.box(x, z, w, d, h, mat, o),
      // Same box mirrored to the other half of the map (both teams get the same layout).
      mbox: (x, z, w, d, h, mat, o = {}) => {
        this.box(x, z, w, d, h, mat, o);
        this.box(x, mz(z, d), w, d, h, mat, o);
      },
      slab: (x, z, w, d, lo, hi, mat, mirror = false) => {
        this.slab(x, z, w, d, lo, hi, mat);
        if (mirror) this.slab(x, mz(z, d), w, d, lo, hi, mat);
      },
      noslab: (x, z, w, d, mirror = false) => {
        this.slab(x, z, w, d, -1, -1, null);
        if (mirror) this.slab(x, mz(z, d), w, d, -1, -1, null);
      },
      building: (o) => {
        this.building(o);
        if (o.mirror) this.building(this.mirrored(o));
      },
      stairs: (x, z, w, d, dir, from, to, mat, mirror = false) => this.stairs(x, z, w, d, dir, from, to, mat, mirror),
      spawn: (x, z, team, mirror = true) => {
        this.spawns.push({ x: x + 0.5, z: z + 0.5, team });
        if (mirror) this.spawns.push({ x: x + 0.5, z: this.d - z - 0.5, team: team === null ? null : 1 - team });
      },
      prop: (type, x, z, o = {}, mirror = false) => {
        this.props.push({ type, x, z, ...o });
        if (mirror) this.props.push({ type, x, z: this.d - z, ...o, flip: !o.flip });
      },
    };
    def.build(api);
    for (let i = 0; i < n; i++) {
      if (this.vis[i] < 50) this.maxH = Math.max(this.maxH, this.ray[i], this.vis[i]);
      this.maxH = Math.max(this.maxH, this.shi[i]);
    }
    const cx = this.w / 2;
    const cz = this.d / 2;
    for (const s of this.spawns) {
      s.y = this.floorAt(s.x, s.z, 0.01, 0);
      s.yaw = Math.atan2(-(cx - s.x), -(cz - s.z)); // face the middle of the map
    }
  }

  idx(cx, cz) {
    return cz * this.w + cx;
  }

  inside(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.w && cz < this.d;
  }

  box(x, z, w, d, h, mat, o) {
    const m = this.matIndex[mat];
    if (m === undefined) throw new Error('unknown material ' + mat);
    const info = this.def.mats[mat];
    for (let cz = z; cz < z + d; cz++) {
      for (let cx = x; cx < x + w; cx++) {
        if (!this.inside(cx, cz)) continue;
        const i = this.idx(cx, cz);
        this.mat[i] = m;
        this.vis[i] = info.vis ?? h;
        this.col[i] = info.col ?? h;
        this.ray[i] = info.ray ?? h;
        this.tint[i] = o.tint ?? 1;
      }
    }
  }

  slab(x, z, w, d, lo, hi, mat) {
    const m = mat ? this.matIndex[mat] : 0;
    if (m === undefined) throw new Error('unknown material ' + mat);
    for (let cz = z; cz < z + d; cz++) {
      for (let cx = x; cx < x + w; cx++) {
        if (!this.inside(cx, cz)) continue;
        const i = this.idx(cx, cz);
        this.slo[i] = lo;
        this.shi[i] = hi;
        this.mat2[i] = m;
      }
    }
  }

  // A building you can walk into: walls (with a parapet so the roof is safe to stand on),
  // a floor, a flat roof, doors and windows (lists of [x, z] wall cells), and holes in
  // the roof for stairwells ([x, z, w, d]).
  building(o) {
    const { x, z, w, d } = o;
    const h = o.h ?? 3.2;
    const top = h + (o.parapet ?? 1);
    for (let cz = z; cz < z + d; cz++) {
      for (let cx = x; cx < x + w; cx++) {
        const edge = cx === x || cz === z || cx === x + w - 1 || cz === z + d - 1;
        if (edge) {
          this.box(cx, cz, 1, 1, top, o.wall, {});
          this.slab(cx, cz, 1, 1, -1, -1, null);
        } else {
          this.box(cx, cz, 1, 1, 0, o.floor, {});
          this.slab(cx, cz, 1, 1, h - 0.3, h, o.roof);
        }
      }
    }
    for (const [cx, cz] of o.doors || []) {
      this.box(cx, cz, 1, 1, 0, o.floor, {});
      this.slab(cx, cz, 1, 1, 2.3, top, o.wall);
    }
    for (const [cx, cz] of o.windows || []) {
      this.box(cx, cz, 1, 1, o.sill ?? 1.0, o.wall, {});
      this.slab(cx, cz, 1, 1, 2.1, top, o.wall);
    }
    for (const [hx, hz, hw, hd] of o.holes || []) this.slab(hx, hz, hw, hd, -1, -1, null);
  }

  mirrored(o) {
    const mzc = (cz) => this.d - 1 - cz;
    return {
      ...o,
      z: this.d - o.z - o.d,
      doors: (o.doors || []).map(([x, z]) => [x, mzc(z)]),
      windows: (o.windows || []).map(([x, z]) => [x, mzc(z)]),
      holes: (o.holes || []).map(([x, z, w, d]) => [x, this.d - z - d, w, d]),
    };
  }

  // A staircase rising in direction dir ('n','s','e','w' = -z,+z,+x,-x) from height `from` to `to`.
  stairs(x, z, w, d, dir, from, to, mat, mirror) {
    const len = dir === 'n' || dir === 's' ? d : w;
    for (let k = 0; k < len; k++) {
      const h = from + ((to - from) * (k + 1)) / len;
      let bx = x;
      let bz = z;
      let bw = w;
      let bd = d;
      if (dir === 'e') (bx = x + k), (bw = 1);
      if (dir === 'w') (bx = x + w - 1 - k), (bw = 1);
      if (dir === 's') (bz = z + k), (bd = 1);
      if (dir === 'n') (bz = z + d - 1 - k), (bd = 1);
      this.box(bx, bz, bw, bd, h, mat, {});
      if (mirror) this.box(bx, this.d - bz - bd, bw, bd, h, mat, {});
    }
  }

  colAt(cx, cz) {
    return this.inside(cx, cz) ? this.col[cz * this.w + cx] : OUT;
  }

  visAt(cx, cz) {
    return this.inside(cx, cz) ? this.vis[cz * this.w + cx] : OUT;
  }

  hasSlab(i) {
    return this.shi[i] > this.slo[i];
  }

  // What you'd stand on in a cell if your feet are at height y.
  floorFor(cx, cz, y) {
    if (!this.inside(cx, cz)) return OUT;
    const i = cz * this.w + cx;
    if (this.shi[i] > this.slo[i] && y >= this.shi[i] - REACH) return this.shi[i];
    return this.col[i];
  }

  // The lowest thing overhead in a cell, for feet at height y.
  ceilFor(cx, cz, y) {
    if (!this.inside(cx, cz)) return -OUT;
    const i = cz * this.w + cx;
    if (this.shi[i] > this.slo[i] && y < this.shi[i] - REACH) return this.slo[i];
    return Infinity;
  }

  // Highest floor under a square of half-size r centered at (x, z), for feet at height y.
  floorAt(x, z, r, y = 0) {
    let h = -Infinity;
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const z0 = Math.floor(z - r);
    const z1 = Math.floor(z + r);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) h = Math.max(h, this.floorFor(cx, cz, y));
    return h;
  }

  // Lowest ceiling over the same square.
  ceilAt(x, z, r, y) {
    let c = Infinity;
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const z0 = Math.floor(z - r);
    const z1 = Math.floor(z + r);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) c = Math.min(c, this.ceilFor(cx, cz, y));
    return c;
  }

  // Can a body (feet at y, height bodyH) be in this cell, stepping up at most maxStep?
  blocks(cx, cz, y, maxStep, bodyH) {
    if (this.floorFor(cx, cz, y) > y + maxStep) return true;
    return this.ceilFor(cx, cz, y) < y + bodyH - 0.02;
  }

  // Move a square body of half-size r along one axis. Returns the new coordinate and whether it was blocked.
  slide(x, z, r, axis, delta, y, maxStep, bodyH = HEADROOM) {
    if (axis === 0) {
      const nx = x + delta;
      const edge = delta > 0 ? Math.floor(nx + r) : Math.floor(nx - r);
      const old = delta > 0 ? Math.floor(x + r) : Math.floor(x - r);
      if (edge !== old) {
        for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) {
          if (this.blocks(edge, cz, y, maxStep, bodyH)) return [delta > 0 ? edge - r - 1e-3 : edge + 1 + r + 1e-3, true];
        }
      }
      return [nx, false];
    }
    const nz = z + delta;
    const edge = delta > 0 ? Math.floor(nz + r) : Math.floor(nz - r);
    const old = delta > 0 ? Math.floor(z + r) : Math.floor(z - r);
    if (edge !== old) {
      for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
        if (this.blocks(cx, edge, y, maxStep, bodyH)) return [delta > 0 ? edge - r - 1e-3 : edge + 1 + r + 1e-3, true];
      }
    }
    return [nz, false];
  }

  // Is the point (x, y, z) inside something solid? (Grenades)
  solidAt(x, y, z) {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!this.inside(cx, cz)) return true;
    const i = cz * this.w + cx;
    if (y < this.ray[i]) return true;
    return this.shi[i] > this.slo[i] && y > this.slo[i] && y < this.shi[i];
  }

  // Ray against the map. (dx, dy, dz) must be normalized. Returns { t, x, y, z, nx, ny, nz } or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT = 200) {
    let cx = Math.floor(ox);
    let cz = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? cx + 1 - ox : ox - cx) * tdx : Infinity;
    let tmz = dz !== 0 ? (dz > 0 ? cz + 1 - oz : oz - cz) * tdz : Infinity;
    let t = 0;
    let nx = 0;
    let nz = 0;
    const hit = (tt, ny, sx, sz) => ({ t: tt, x: ox + dx * tt, y: oy + dy * tt, z: oz + dz * tt, nx: sx, ny, nz: sz });
    for (let guard = 0; guard < 600; guard++) {
      if (!this.inside(cx, cz)) return null; // flew out of the map (over the sea, say)
      const i = cz * this.w + cx;
      const H = this.ray[i];
      const tExit = Math.min(tmx, tmz, maxT);
      const yIn = oy + dy * t;
      let best = null;
      // Solid column
      if (yIn < H - 1e-6) {
        if (guard === 0 && t <= 1e-6) return hit(0, 1, 0, 0); // started inside something
        best = hit(t, 0, nx, nz);
      } else if (dy < 0) {
        const tTop = (H - oy) / dy;
        if (tTop >= t && tTop <= tExit) best = hit(tTop, 1, 0, 0);
      }
      // Floating slab (roof, lintel, wall above a window)
      if (this.shi[i] > this.slo[i]) {
        const lo = this.slo[i];
        const hi = this.shi[i];
        let ts = null;
        if (yIn > lo + 1e-6 && yIn < hi - 1e-6) {
          if (guard === 0 && t <= 1e-6) return hit(0, 1, 0, 0);
          ts = hit(t, 0, nx, nz);
        } else if (dy < 0 && yIn >= hi) {
          const tt = (hi - oy) / dy;
          if (tt >= t && tt <= tExit) ts = hit(tt, 1, 0, 0);
        } else if (dy > 0 && yIn <= lo) {
          const tt = (lo - oy) / dy;
          if (tt >= t && tt <= tExit) ts = hit(tt, -1, 0, 0);
        }
        if (ts && (!best || ts.t < best.t)) best = ts;
      }
      if (best) return best;
      if (tExit >= maxT) return null;
      if (dy > 0 && oy + dy * t > this.maxH + 0.5) return null; // flying over everything
      if (tmx < tmz) {
        t = tmx;
        tmx += tdx;
        cx += stepX;
        nx = -stepX;
        nz = 0;
      } else {
        t = tmz;
        tmz += tdz;
        cz += stepZ;
        nx = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  // Can a bullet get from a to b?
  clear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len);
  }

  // ------------------------------------------------------------ bot pathfinding
  //
  // Nodes are (cell, level): level 0 is the ground/column top, level 1 is the top of
  // the cell's slab (a roof). Node id = cell * 2 + level.

  nodeFloor(node) {
    const i = node >> 1;
    return node & 1 ? this.shi[i] : this.col[i];
  }

  // The node you'd be on in cell (cx, cz) with feet at about height y.
  nodeAt(cx, cz, y) {
    if (!this.inside(cx, cz)) return -1;
    const i = cz * this.w + cx;
    const lvl = this.shi[i] > this.slo[i] && y >= this.shi[i] - REACH ? 1 : 0;
    return i * 2 + lvl;
  }

  standable(node) {
    const i = node >> 1;
    const f = this.nodeFloor(node);
    if (f >= 50) return false;
    if (node & 1) return this.shi[i] > this.slo[i];
    return !(this.shi[i] > this.slo[i]) || this.slo[i] - f >= HEADROOM;
  }

  // From node a, step into neighboring cell (bx, bz). Returns [node, kind] (kind 1 walk, 2 jump) or null.
  step(a, bx, bz) {
    if (!this.inside(bx, bz)) return null;
    const fa = this.nodeFloor(a);
    const ai = a >> 1;
    const fw = this.floorFor(bx, bz, fa);
    const nw = this.nodeAt(bx, bz, fa);
    if (fw - fa <= STEP && this.standable(nw)) {
      // Room for your body at the height you walk in at (no ducking under a lintel at stair height).
      if (this.ceilFor(bx, bz, Math.min(fa, fw)) - Math.max(fa, fw) >= HEADROOM - 0.05) return [nw, 1];
      return null;
    }
    const fj = this.floorFor(bx, bz, fa + JUMP_UP);
    const nj = this.nodeAt(bx, bz, fa + JUMP_UP);
    if (fj - fa > STEP && fj - fa <= JUMP_UP && this.standable(nj)) {
      const ax = ai % this.w;
      const az = (ai - ax) / this.w;
      if (this.ceilFor(ax, az, fa) >= fa + 3 && this.ceilFor(bx, bz, fj) >= fj + 2) return [nj, 2];
    }
    return null;
  }

  // A* over nodes. Returns [[cx, cz, floor], ...] (not including the start) or null.
  // The goal can be a specific height (gy) or any level of the goal cell.
  path(sx, sz, gx, gz, sy = 0, gy = null, maxNodes = 6000) {
    const W = this.w;
    if (!this.inside(sx, sz) || !this.inside(gx, gz)) return null;
    const start = this.nodeAt(sx, sz, sy);
    const goalCell = gz * W + gx;
    const goalNode = gy === null ? -1 : this.nodeAt(gx, gz, gy);
    const isGoal = (n) => (goalNode >= 0 ? n === goalNode : n >> 1 === goalCell);
    if (isGoal(start)) return [];
    const g = new Map([[start, 0]]);
    const from = new Map();
    const open = [[this.heur(sx, sz, gx, gz), start]];
    const closed = new Set();
    let visited = 0;
    let found = -1;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length) {
      const [, cur] = open.shift();
      if (isGoal(cur)) {
        found = cur;
        break;
      }
      if (closed.has(cur)) continue;
      closed.add(cur);
      if (++visited > maxNodes) return null;
      const ci = cur >> 1;
      const cx = ci % W;
      const cz = (ci - cx) / W;
      for (const [ddx, ddz] of dirs) {
        const nx = cx + ddx;
        const nz = cz + ddz;
        const st = this.step(cur, nx, nz);
        if (!st) continue;
        const [nn, kind] = st;
        if (ddx && ddz) {
          // No cutting corners past walls.
          if (kind === 2) continue;
          const s1 = this.step(cur, nx, cz);
          const s2 = this.step(cur, cx, nz);
          if (!s1 || !s2 || s1[1] !== 1 || s2[1] !== 1) continue;
          if (!this.step(s1[0], nx, nz) || !this.step(s2[0], nx, nz)) continue;
        }
        const cost = (g.get(cur) ?? 0) + (ddx && ddz ? 1.414 : 1) + (kind === 2 ? 2.5 : 0);
        if (cost < (g.get(nn) ?? Infinity)) {
          g.set(nn, cost);
          from.set(nn, cur);
          const f = cost + this.heur(nx, nz, gx, gz);
          let lo = 0;
          let hi = open.length;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (open[mid][0] < f) lo = mid + 1;
            else hi = mid;
          }
          open.splice(lo, 0, [f, nn]);
        }
      }
    }
    if (found < 0) return null;
    const out = [];
    for (let c = found; c !== start; c = from.get(c)) {
      const i = c >> 1;
      out.push([i % W, Math.floor(i / W), this.nodeFloor(c)]);
    }
    return out.reverse();
  }

  heur(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
  }

  // Can you walk straight from (ax, az) at height y to (bx, bz) without jumping? (Smooths bot paths.)
  walkable(ax, az, bx, bz, y, r = 0.35) {
    const dist = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(dist / 0.25));
    let h = y;
    for (let i = 1; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      const nh = this.floorAt(x, z, r, h);
      if (nh - h > STEP || nh >= 50) return false;
      if (h - nh > 0.6) return false; // don't plan to walk off ledges
      if (this.ceilAt(x, z, r, nh) - nh < HEADROOM) return false;
      h = nh;
    }
    return true;
  }

  // Every node you can reach on foot from the first spawn. Index by node (cell * 2 + level).
  reachable() {
    const W = this.w;
    const s = this.spawns[0];
    const start = this.nodeAt(Math.floor(s.x), Math.floor(s.z), s.y);
    const seen = new Uint8Array(this.w * this.d * 2);
    seen[start] = 1;
    const q = [start];
    while (q.length) {
      const cur = q.pop();
      const ci = cur >> 1;
      const cx = ci % W;
      const cz = (ci - cx) / W;
      for (const [ddx, ddz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const st = this.step(cur, cx + ddx, cz + ddz);
        if (!st || seen[st[0]]) continue;
        seen[st[0]] = 1;
        q.push(st[0]);
      }
    }
    return seen;
  }
}
