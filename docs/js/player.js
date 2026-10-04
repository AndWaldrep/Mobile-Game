// Soldier movement and hitboxes. Shared by your own soldier and the bots.
// Yaw 0 looks toward -z (north); yaw grows turning left, like Three.js cameras.
//
// Movement has weight: you speed up and slow down over a moment, strafe and
// backpedal slower than you run forward, sprint until you're out of breath,
// slide if you crouch mid-sprint, and climb onto ledges up to chest height.

import { STEP, HEADROOM } from './grid.js';

export const RADIUS = 0.32;
export const EYE = 1.6;
export const EYE_CROUCH = 1.08;
export const BODY = HEADROOM; // standing height for collisions
export const BODY_CROUCH = 1.25;
export const GRAVITY = 21;
export const JUMP_V = 7.2; // about 1.25 m: onto crates and over low walls
export const WALK = 4.6;
export const SPRINT = 6.6;
export const CROUCH_SPEED = 2.1;
export const ADS_SPEED = 2.6;
export const SLIDE_SPEED = 8.2;
export const MAX_HP = 100;
export const REGEN_DELAY = 5000; // ms after the last hit before health comes back
export const REGEN_RATE = 25 / 1000; // hp per ms

// Health after regeneration, given the hp at the last hit and when that was.
export function hpAt(hp, lastHit, now) {
  if (hp <= 0) return 0;
  const t = now - lastHit - REGEN_DELAY;
  return t > 0 ? Math.min(MAX_HP, hp + t * REGEN_RATE) : hp;
}

export function forward(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class PlayerSim {
  constructor(grid, spawn) {
    this.grid = grid;
    this.reset(spawn);
  }

  reset(s) {
    this.x = s.x;
    this.y = s.y ?? this.grid.floorAt(s.x, s.z, RADIUS, 0);
    this.z = s.z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = s.yaw ?? 0;
    this.pitch = 0;
    this.ground = true;
    this.crouch = 0; // 0 standing .. 1 crouched
    this.sprinting = false;
    this.speed = 0;
    this.recoil = 0;
    this.stamina = 1;
    this.tired = false;
    this.restT = 0;
    this.slideT = 0;
    this.mantle = null; // { t, from, to }
    this.landT = 0;
    this.sinceSprint = 9; // seconds since you stopped sprinting (guns need a moment to come up)
    this.prevCrouch = false;
    this.events = [];
  }

  eye() {
    return this.y + EYE + (EYE_CROUCH - EYE) * this.crouch;
  }

  bodyH() {
    return BODY + (BODY_CROUCH - BODY) * Math.min(1, this.crouch * 1.4);
  }

  // ctl: { mx, mz } stick (-1..1, mz < 0 is forward), sprint, jump, crouch, ads, speedMul, adsMul,
  // stamina (how many times longer than normal you can sprint)
  update(dt, ctl) {
    const g = this.grid;
    // Climbing onto a ledge takes over until it's done.
    if (this.mantle) {
      const m = this.mantle;
      m.t += dt / 0.42;
      const t = Math.min(1, m.t);
      const up = Math.min(1, t / 0.6);
      this.y = m.from[1] + (m.to[1] - m.from[1]) * (1 - (1 - up) * (1 - up));
      const fw = Math.max(0, (t - 0.6) / 0.4); // rise first, then roll forward onto the ledge
      this.x = m.from[0] + (m.to[0] - m.from[0]) * fw;
      this.z = m.from[2] + (m.to[2] - m.from[2]) * fw;
      this.vx = this.vy = this.vz = 0;
      if (t >= 1) {
        this.mantle = null;
        this.ground = true;
      }
      this.speed = 0;
      this.sprinting = false;
      return;
    }

    let mx = ctl.mx || 0;
    let mz = ctl.mz || 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    // Crouching mid-sprint starts a slide.
    const crouchPressed = !!ctl.crouch && !this.prevCrouch;
    this.prevCrouch = !!ctl.crouch;
    if (crouchPressed && this.sprinting && this.ground && this.speed > SPRINT * 0.8) {
      this.slideT = 0.75;
      const s = Math.max(SLIDE_SPEED, this.speed * 1.2) / Math.max(0.01, this.speed);
      this.vx *= s;
      this.vz *= s;
      this.events.push('slide');
    }
    const sliding = this.slideT > 0;
    let wantCrouch = !!ctl.crouch || sliding;
    // Stay low if there's no room to stand up.
    if (!wantCrouch && this.crouch > 0.3 && g.ceilAt(this.x, this.z, RADIUS, this.y) < this.y + BODY) wantCrouch = true;
    this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * Math.min(1, dt * (sliding ? 16 : 10));

    // Sprint uses stamina; run out and you have to catch your breath.
    const wantSprint = !!ctl.sprint && mz < -0.5 && !ctl.ads && this.crouch < 0.5 && !sliding && this.ground;
    if (this.stamina <= 0.02) this.tired = true;
    if (this.tired && this.stamina > 0.3) this.tired = false;
    this.sprinting = wantSprint && !this.tired;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt / (6 * (ctl.stamina || 1)));
      this.restT = 0;
      this.sinceSprint = 0;
    } else {
      this.sinceSprint += dt;
      this.restT += dt;
      if (this.restT > 0.9) this.stamina = Math.min(1, this.stamina + (dt / 4) * Math.sqrt(ctl.stamina || 1));
    }

    let top = WALK;
    if (this.sprinting) top = SPRINT * (ctl.sprintMul || 1);
    else if (this.crouch > 0.5) top = CROUCH_SPEED;
    else if (ctl.ads) top = ADS_SPEED * (ctl.adsMul || 1);
    top *= ctl.speedMul || 1;
    if (this.landT > 0) {
      this.landT -= dt;
      top *= 0.65;
    }
    // Strafing and backpedaling are slower than moving forward.
    const fwd = -mz;
    const dirScale = fwd >= 0 ? 1 : 0.72;
    const sideScale = 0.86;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = (-sin * fwd * dirScale + cos * mx * sideScale) * top;
    const wz = (-cos * fwd * dirScale - sin * mx * sideScale) * top;
    if (sliding) {
      // Slides carry you along and slowly bleed off speed.
      this.slideT -= dt;
      const k = Math.exp(-dt * 1.6);
      this.vx *= k;
      this.vz *= k;
    } else {
      const want = Math.hypot(wx, wz);
      const accel = this.ground ? (want > Math.hypot(this.vx, this.vz) ? 9 : 12) : 1.6;
      const k = Math.min(1, dt * accel);
      this.vx += (wx - this.vx) * k;
      this.vz += (wz - this.vz) * k;
    }

    if (ctl.jump && this.ground && !sliding) {
      if (!this.tryMantle()) {
        if (this.crouch < 0.5 && g.ceilAt(this.x, this.z, RADIUS, this.y) > this.y + BODY + 0.4) {
          this.vy = JUMP_V;
          this.ground = false;
          this.stamina = Math.max(0, this.stamina - 0.08);
          this.events.push('jump');
        }
      } else return;
    }
    if (!this.ground) this.vy -= GRAVITY * dt;

    // Move in small steps so nothing tunnels through thin walls.
    const bodyH = this.bodyH();
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vx, this.vz) * dt) / 0.2));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const climb = this.ground ? STEP : 0.02;
      let blocked;
      [this.x, blocked] = g.slide(this.x, this.z, RADIUS, 0, this.vx * sdt, this.y, climb, bodyH);
      if (blocked) this.vx = 0;
      [this.z, blocked] = g.slide(this.x, this.z, RADIUS, 1, this.vz * sdt, this.y, climb, bodyH);
      if (blocked) this.vz = 0;
    }

    const wasGround = this.ground;
    this.y += this.vy * dt;
    // Bump your head on ceilings when jumping indoors.
    const ceil = g.ceilAt(this.x, this.z, RADIUS - 0.02, this.y - this.vy * dt);
    if (this.y + bodyH > ceil && this.vy > 0) {
      this.y = ceil - bodyH;
      this.vy = 0;
    }
    const floor = g.floorAt(this.x, this.z, RADIUS - 0.02, Math.max(this.y, this.y - this.vy * dt));
    if (this.y <= floor) {
      if (!wasGround && this.vy < -8) {
        this.events.push('land');
        this.landT = Math.min(0.35, -this.vy * 0.025);
      }
      this.y = floor;
      this.vy = 0;
      this.ground = true;
    } else if (wasGround && this.vy <= 0 && this.y - floor <= STEP + 0.05) {
      this.y = floor; // walk down steps instead of falling off each one
      this.vy = 0;
    } else {
      this.ground = false;
    }
    this.speed = Math.hypot(this.vx, this.vz);
  }

  // Climb onto a ledge in front of you (crates, truck cabs, walls up to chest height).
  tryMantle() {
    const g = this.grid;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    for (const reach of [0.55, 0.85]) {
      const ax = this.x + fx * reach;
      const az = this.z + fz * reach;
      const top = g.floorAt(ax, az, 0.15, this.y + 2.05);
      const rise = top - this.y;
      if (rise <= 1.05 || rise > 2.05) continue; // a normal jump does it, or too high
      const tx = this.x + fx * (reach + 0.45);
      const tz = this.z + fz * (reach + 0.45);
      if (Math.abs(g.floorAt(tx, tz, RADIUS, top) - top) > 0.05) continue;
      if (g.ceilAt(tx, tz, RADIUS, top) - top < BODY) continue;
      if (g.ceilAt(this.x, this.z, RADIUS, this.y) < top + 1.2) continue;
      this.mantle = { t: 0, from: [this.x, this.y, this.z], to: [tx, top, tz] };
      this.events.push('mantle');
      return true;
    }
    return false;
  }

  snapshot() {
    return { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, cr: this.crouch, mv: this.speed, gr: this.ground ? 1 : 0 };
  }
}

// ------------------------------------------------------------------ hitboxes

// Where to aim at a soldier: chest and head, for a view { x, y, z, cr }.
export function chest(v) {
  return [v.x, v.y + 1.15 - 0.4 * (v.cr || 0), v.z];
}
export function head(v) {
  return [v.x, v.y + EYE + (EYE_CROUCH - EYE) * (v.cr || 0) + 0.02, v.z];
}

const HEAD_R = 0.25;
const BODY_R = 0.4;

// Ray (normalized dir) against one soldier. Returns { t, head } or null.
export function hitSoldier(ox, oy, oz, dx, dy, dz, v, maxT) {
  let best = null;
  const [hx, hy, hz] = head(v);
  // Head sphere
  const lx = ox - hx;
  const ly = oy - hy;
  const lz = oz - hz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - HEAD_R * HEAD_R;
  const disc = b * b - c;
  if (disc >= 0) {
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < maxT) best = { t, head: true };
  }
  // Body: vertical cylinder from the feet to the shoulders
  const top = hy - HEAD_R;
  const a2 = dx * dx + dz * dz;
  if (a2 > 1e-8) {
    const px = ox - v.x;
    const pz = oz - v.z;
    const bb = px * dx + pz * dz;
    const cc = px * px + pz * pz - BODY_R * BODY_R;
    const d2 = bb * bb - a2 * cc;
    if (d2 >= 0) {
      const sq = Math.sqrt(d2);
      for (const t of [(-bb - sq) / a2, (-bb + sq) / a2]) {
        if (t <= 0 || t >= maxT) continue;
        const y = oy + dy * t;
        if (y >= v.y && y <= top && (!best || t < best.t)) {
          best = { t, head: false };
          break;
        }
      }
    }
  }
  return best;
}
