// Soldier models for everyone else: camo uniform, plate carrier, helmet with
// goggles, backpack, and a real gun held in both hands. The body is split at
// the hips, knees, waist and neck so it can run, strafe, crouch, aim, flinch
// and fall. Each body part is a single merged mesh to keep phones fast.

import * as THREE from 'three';
import { merge, limb, box, sphere } from './geom.js';
import { buildGun } from './guns.js';

// ------------------------------------------------------------------ shared textures

let atlas = null;
function atlasTexture() {
  if (atlas) return atlas;
  // Left half: camo blotches (tinted per team by vertex color). Right half: plain fabric.
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b4b4b4';
  ctx.fillRect(0, 0, 128, 128);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const [tone, n] of [['#d8d8d8', 14], ['#7c7c7c', 16], ['#565656', 10]]) {
    ctx.fillStyle = tone;
    for (let i = 0; i < n; i++) {
      const x = r() * 128;
      const y = r() * 128;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const rad = 6 + r() * 12;
        const px = x + Math.cos(a) * rad * 1.4;
        const py = y + Math.sin(a) * rad;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ececec';
  ctx.fillRect(128, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    const v = 215 + Math.floor(r() * 40);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(128 + r() * 128, r() * 128, 1.5, 1.5);
  }
  atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  return atlas;
}

const CAMO = [0, 0, 0.5, 1];
const PLAIN = [0.5, 0, 1, 1];
let bodyMat = null;
export function soldierMaterial() {
  if (!bodyMat) bodyMat = new THREE.MeshStandardMaterial({ map: atlasTexture(), vertexColors: true, roughness: 0.88, metalness: 0.02 });
  return bodyMat;
}

let flashTex = null;
export function glowTexture() {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.25, 'rgba(255,215,110,0.95)');
  g.addColorStop(1, 'rgba(255,140,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  flashTex = new THREE.CanvasTexture(c);
  return flashTex;
}

let starTex = null;
// A spiky muzzle-flash shape.
export function flashTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.3, 'rgba(255,200,90,0.95)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const len = i % 2 ? 40 : 62;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.22) * 10, Math.sin(a - 0.22) * 10);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.lineTo(Math.cos(a + 0.22) * 10, Math.sin(a + 0.22) * 10);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  starTex = new THREE.CanvasTexture(c);
  return starTex;
}

function nameSprite(name, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.4, 0.35, 1);
  s.renderOrder = 10;
  return s;
}

// ------------------------------------------------------------------ helpers

const SKINS = ['#e3b48f', '#c99872', '#a8754f', '#7d5236', '#f0c8a8', '#8f6040'];

function part(geo, color, region = PLAIN) {
  return { geo, color, uv: region };
}

function meshOf(parts) {
  const m = new THREE.Mesh(merge(parts, true), soldierMaterial());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function shade(hex, k) {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
}

// Two-bone reach: where the elbow goes for a shoulder S reaching to hand H.
export function elbow(S, H, a, b, hint) {
  const sv = new THREE.Vector3(...S);
  const hv = new THREE.Vector3(...H);
  const dir = hv.clone().sub(sv);
  const d = Math.min(dir.length(), (a + b) * 0.999);
  dir.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const perp = new THREE.Vector3(...hint);
  perp.sub(dir.clone().multiplyScalar(perp.dot(dir))).normalize();
  return sv.add(dir.multiplyScalar(along)).add(perp.multiplyScalar(h)).toArray();
}

export const GRIPS = {
  ar: { grip: [0, -0.14, 0.07], fore: [0, -0.085, -0.27] },
  smg: { grip: [0, -0.13, 0.06], fore: [0, -0.09, -0.22] },
  shotgun: { grip: [0, -0.085, 0.16], fore: [0, -0.085, -0.3] },
  sniper: { grip: [0, -0.15, 0.1], fore: [0, -0.12, -0.22] },
};

// ------------------------------------------------------------------ soldier

export class Soldier {
  // uniform: camo tint, accent: helmet band / armband color, id: picks a skin tone
  constructor(uniform, accent, id = '') {
    let hash = 0;
    for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    this.uniform = uniform;
    this.accent = accent;
    this.skin = SKINS[hash % SKINS.length];
    this.gear = '#3c3e36';
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // tilts as a whole when dying
    this.root.add(this.body);

    const U = uniform;
    const pants = shade(U, 0.85);
    const dark = '#26272a';
    const boot = '#2b241d';

    // Hips
    this.hips = new THREE.Group();
    this.hips.position.y = 0.9;
    this.body.add(this.hips);
    this.hips.add(
      meshOf([
        part(box(0.34, 0.17, 0.22, 0, 0, 0), pants, CAMO),
        part(box(0.36, 0.05, 0.24, 0, 0.07, 0), dark),
        part(box(0.08, 0.1, 0.06, 0.16, -0.02, -0.06), this.gear), // thigh rig
        part(box(0.07, 0.07, 0.05, -0.14, 0.02, 0.1), this.gear),
      ])
    );
    // Legs: thigh -> knee -> shin
    this.thighs = [];
    this.shins = [];
    for (const x of [-0.1, 0.1]) {
      const thigh = new THREE.Group();
      thigh.position.set(x, -0.05, 0);
      this.hips.add(thigh);
      thigh.add(meshOf([part(limb([0, 0, 0], [0, -0.43, 0], 0.075), pants, CAMO), part(box(0.1, 0.1, 0.05, 0, -0.42, -0.07), dark)]));
      const shin = new THREE.Group();
      shin.position.y = -0.43;
      thigh.add(shin);
      shin.add(
        meshOf([
          part(limb([0, 0, 0], [0, -0.38, 0], 0.065), pants, CAMO),
          part(box(0.12, 0.11, 0.25, 0, -0.42, -0.04), boot),
          part(box(0.13, 0.03, 0.26, 0, -0.47, -0.04), '#161412'),
        ])
      );
      this.thighs.push(thigh);
      this.shins.push(shin);
    }

    // Torso, vest, backpack
    this.torso = new THREE.Group();
    this.torso.position.y = 0.06;
    this.hips.add(this.torso);
    const pouches = [];
    for (const px of [-0.12, 0, 0.12]) pouches.push(part(box(0.1, 0.11, 0.06, px, 0.2, -0.17), this.gear));
    this.torso.add(
      meshOf([
        part(box(0.38, 0.48, 0.22, 0, 0.25, 0), U, CAMO),
        part(box(0.42, 0.34, 0.28, 0, 0.27, 0), this.gear),
        part(box(0.3, 0.06, 0.29, 0, 0.45, 0), shade(this.gear, 0.8)),
        ...pouches,
        part(box(0.06, 0.08, 0.04, -0.13, 0.36, -0.15), '#4a5a3a'), // radio
        part(box(0.3, 0.36, 0.14, 0, 0.3, 0.2), shade(U, 0.7), CAMO), // pack
        part(box(0.26, 0.08, 0.1, 0, 0.12, 0.21), shade(this.gear, 0.9)),
        part(limb([0, 0.46, 0], [0, 0.55, 0], 0.055), this.skin),
      ])
    );

    // Head with helmet and goggles
    this.head = new THREE.Group();
    this.head.position.y = 0.5;
    this.torso.add(this.head);
    const helm = new THREE.SphereGeometry(0.138, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55);
    helm.scale(1, 0.85, 1.08);
    helm.translate(0, 0.15, 0.01);
    const band = new THREE.CylinderGeometry(0.139, 0.139, 0.03, 12, 1, true);
    band.translate(0, 0.16, 0.01);
    this.head.add(
      meshOf([
        part(sphere(0.105, 0, 0.12, 0, 1, 1.12, 1.02, 10), this.skin),
        part(helm, shade(U, 0.9), CAMO),
        part(band, accent),
        part(box(0.2, 0.05, 0.05, 0, 0.21, -0.12), dark), // goggles on the helmet
        part(box(0.06, 0.035, 0.02, -0.05, 0.21, -0.146), '#3b6d8a'),
        part(box(0.06, 0.035, 0.02, 0.05, 0.21, -0.146), '#3b6d8a'),
        part(box(0.14, 0.05, 0.03, 0, 0.07, -0.1), shade(U, 0.6), CAMO), // face wrap
        part(box(0.03, 0.06, 0.08, 0.13, 0.13, 0.0), dark), // headset
        part(box(0.03, 0.06, 0.08, -0.13, 0.13, 0.0), dark),
      ])
    );

    // Arms + gun pivot at the shoulders and follow the aim.
    this.aim = new THREE.Group();
    this.aim.position.set(0, 0.42, 0);
    this.torso.add(this.aim);
    this.weapon = null;
    this.flash = null;
    this.walk = 0;
    this.kick = 0;
    this.flinch = 0;
    this.flashT = 0;
    this.deadT = -1;
    this.fallDir = 1;
    this.spin = 0;
    this.label = null;
    this.prev = null;
    this.vel = new THREE.Vector2();
  }

  setWeapon(id) {
    if (this.weapon === id) return;
    this.weapon = id;
    this.aim.traverse((o) => o.geometry && o.geometry.dispose());
    this.aim.clear();
    const gun = buildGun(id, false);
    const g = GRIPS[id] || GRIPS.ar;
    // The gun's stock sits in the right shoulder.
    const gx = 0.13;
    const gy = -0.02;
    const gz = -0.3;
    gun.group.position.set(gx, gy, gz);
    this.aim.add(gun.group);
    const hand = (p) => [p[0] + gx, p[1] + gy, p[2] + gz];
    const RS = [0.2, 0, 0.02];
    const LS = [-0.2, 0, 0.02];
    const rh = hand(g.grip);
    const lh = hand(g.fore);
    const re = elbow(RS, rh, 0.29, 0.28, [0.6, -1, 0.3]);
    const le = elbow(LS, lh, 0.29, 0.28, [-0.4, -1, 0]);
    const U = this.uniform;
    const glove = '#2a2a2a';
    const mid = [(LS[0] + le[0]) / 2, (LS[1] + le[1]) / 2, (LS[2] + le[2]) / 2];
    this.aim.add(
      meshOf([
        part(limb(RS, re, 0.065), U, CAMO),
        part(limb(re, rh, 0.055), shade(U, 0.95), CAMO),
        part(sphere(0.05, ...rh, 1, 1, 1.2, 8), glove),
        part(limb(LS, le, 0.065), U, CAMO),
        part(limb(le, lh, 0.055), shade(U, 0.95), CAMO),
        part(sphere(0.05, ...lh, 1, 1, 1.2, 8), glove),
        part(limb([(LS[0] + mid[0]) / 2, (LS[1] + mid[1]) / 2, (LS[2] + mid[2]) / 2], mid, 0.07), this.accent), // armband
        part(sphere(0.085, RS[0], RS[1], RS[2], 1, 0.8, 1, 8), U, CAMO),
        part(sphere(0.085, LS[0], LS[1], LS[2], 1, 0.8, 1, 8), U, CAMO),
      ])
    );
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.set(0.5, 0.5, 1);
    this.flash.position.set(gx, gy + (gun.muzzleY || -0.05), gz + gun.muzzle - 0.04);
    this.flash.visible = false;
    this.aim.add(this.flash);
  }

  setLabel(name, color) {
    if (this.label) {
      this.root.remove(this.label);
      this.label.material.map.dispose();
      this.label.material.dispose();
      this.label = null;
    }
    if (!name) return;
    this.label = nameSprite(name, color);
    this.label.position.y = 2.15;
    this.root.add(this.label);
  }

  muzzle() {
    this.flashT = 0.055;
    this.kick = 1;
  }

  muzzleWorld(out) {
    if (!this.flash) return out.set(this.root.position.x, this.root.position.y + 1.4, this.root.position.z);
    this.root.updateMatrixWorld();
    return this.flash.getWorldPosition(out);
  }

  hit() {
    this.flinch = 1;
  }

  die() {
    this.deadT = 0;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    this.spin = (Math.random() - 0.5) * 0.8;
  }

  revive() {
    this.deadT = -1;
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.root.visible = true;
    this.prev = null;
  }

  // v: { x, y, z, yaw, pitch, cr, mv, gr }
  pose(v, dt) {
    const r = this.root;
    r.position.set(v.x, v.y, v.z);
    r.rotation.y = v.yaw;
    if (this.flash) {
      if (this.flashT > 0) {
        this.flashT -= dt;
        this.flash.visible = this.deadT < 0;
        this.flash.material.rotation = Math.random() * 6;
        const s = 0.35 + Math.random() * 0.3;
        this.flash.scale.set(s, s, 1);
      } else this.flash.visible = false;
    }
    if (this.deadT >= 0) {
      // Crumple and fall, then sink out of sight.
      this.deadT += dt;
      const t = Math.min(1, this.deadT / 0.55);
      const e = t * t;
      this.body.rotation.x = this.fallDir * e * 1.45;
      this.body.rotation.z = this.spin * e;
      this.body.position.y = this.deadT > 2.4 ? -(this.deadT - 2.4) * 0.5 : 0;
      for (const th of this.thighs) th.rotation.x = e * 0.5;
      for (const sh of this.shins) sh.rotation.x = -e * 0.9;
      this.aim.rotation.x = -e * 0.8;
      this.root.visible = this.deadT < 4;
      return;
    }
    // Which way are we moving, relative to where we face?
    if (this.prev && dt > 0) {
      const vx = (v.x - this.prev[0]) / dt;
      const vz = (v.z - this.prev[1]) / dt;
      const k = Math.min(1, dt * 10);
      this.vel.x += (Math.max(-9, Math.min(9, vx)) - this.vel.x) * k;
      this.vel.y += (Math.max(-9, Math.min(9, vz)) - this.vel.y) * k;
    }
    this.prev = [v.x, v.z];
    const s = Math.sin(v.yaw);
    const c = Math.cos(v.yaw);
    const fwd = -s * this.vel.x - c * this.vel.y;
    const side = c * this.vel.x - s * this.vel.y;
    const speed = Math.min(8, v.mv ?? Math.hypot(this.vel.x, this.vel.y));
    const cr = v.cr || 0;
    const air = v.gr === 0;
    const moving = speed > 0.4;
    const back = fwd < -0.5;
    this.walk += dt * speed * 2.3 * (back ? -1 : 1) * (moving ? 1 : 0);
    const amp = Math.min(0.85, speed * 0.13) * (1 - cr * 0.5);
    const ph = this.walk;
    // Legs turn toward the strafing direction.
    const legYaw = moving ? Math.max(-0.7, Math.min(0.7, Math.atan2(-side, Math.abs(fwd) + 0.01) * (back ? -1 : 1))) : 0;
    this.hips.rotation.y += (legYaw - this.hips.rotation.y) * Math.min(1, dt * 10);
    this.torso.rotation.y = -this.hips.rotation.y;
    for (let i = 0; i < 2; i++) {
      const p = ph + (i ? Math.PI : 0);
      let th = Math.sin(p) * amp;
      let sh = -Math.max(0, Math.sin(p + 1.3)) * amp * 1.4 - 0.08;
      if (cr > 0.01) {
        th += cr * (i ? 1.45 : 0.4);
        sh -= cr * (i ? 0.6 : 2.0);
      }
      if (air) {
        th += i ? 0.7 : 0.25;
        sh -= i ? 1.1 : 0.4;
      }
      this.thighs[i].rotation.x = th;
      this.shins[i].rotation.x = sh;
    }
    const bob = Math.abs(Math.sin(ph)) * Math.min(1, speed / 6) * 0.05;
    this.hips.position.y = 0.9 - cr * 0.42 + bob - (air ? 0.05 : 0);
    // Lean into a run; the aim follows the view, with recoil and flinch.
    this.kick = Math.max(0, this.kick - dt * 9);
    this.flinch = Math.max(0, this.flinch - dt * 5);
    const lean = -Math.min(0.22, Math.max(0, fwd) * 0.03) - cr * 0.12;
    this.torso.rotation.x = lean - this.flinch * 0.25;
    this.torso.rotation.z = this.flinch * 0.12;
    const pitch = v.pitch || 0;
    this.aim.rotation.x = pitch - lean + this.kick * 0.1 + Math.sin(ph * 2) * 0.02 * Math.min(1, speed / 5);
    this.aim.position.z = this.kick * 0.05;
    this.head.rotation.x = pitch * 0.6 - lean * 0.5;
  }

  dispose(scene) {
    scene.remove(this.root);
    this.setLabel(null);
    this.root.traverse((o) => o.geometry && o.geometry.dispose());
  }
}
