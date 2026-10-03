// Bullet tracers, impact puffs and sparks, bullet holes, grenades and
// explosions (with a flash of light and a shockwave), from small reusable pools.

import * as THREE from 'three';
import { glowTexture } from './soldier.js';

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

let holeTex = null;
function holeTexture() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(10,8,6,1)');
  g.addColorStop(0.25, 'rgba(25,20,16,0.95)');
  g.addColorStop(0.45, 'rgba(60,50,40,0.5)');
  g.addColorStop(1, 'rgba(60,50,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(20,16,12,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + i;
    ctx.beginPath();
    ctx.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
    ctx.lineTo(32 + Math.cos(a) * (14 + (i % 3) * 5), 32 + Math.sin(a) * (14 + (i % 3) * 5));
    ctx.stroke();
  }
  holeTex = new THREE.CanvasTexture(c);
  return holeTex;
}

const tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, -0.5);
const holeGeo = new THREE.PlaneGeometry(0.14, 0.14);
const Z = new THREE.Vector3(0, 0, 1);

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: '#ffe38a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    this.parts = [];
    for (let i = 0; i < 140; i++) {
      const mat = new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.parts.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0, size: 1, glow: false, grav: 0 });
    }
    // Bullet holes stay on walls for a while.
    this.holes = [];
    const holeMat = new THREE.MeshBasicMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(holeGeo, holeMat);
      m.visible = false;
      m.renderOrder = 1;
      scene.add(m);
      this.holes.push(m);
    }
    this.hi = 0;
    // Shockwave ring for explosions
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.ringT = 0;
    scene.add(this.ring);
    // One light reused for muzzle flashes and explosions (kept in the scene so nothing recompiles).
    this.light = new THREE.PointLight('#ffb35c', 0, 9, 2);
    scene.add(this.light);
    this.nades = new Map();
    this.nadeGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this.nadeMat = new THREE.MeshStandardMaterial({ color: '#3d4a2f', roughness: 0.6, metalness: 0.3 });
    this.pi = 0;
    this.ti = 0;
  }

  tracer(from, to, color = '#ffe38a') {
    const t = this.tracers[this.ti++ % this.tracers.length];
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.rotateY(Math.PI); // geometry points down -z; lookAt aims +z
    t.mesh.scale.set(1, 1, len);
    t.mesh.material.color.set(color);
    t.mesh.material.opacity = 0.9;
    t.mesh.visible = true;
    t.life = 0.07;
  }

  particle(x, y, z, o) {
    const p = this.parts[this.pi++ % this.parts.length];
    p.s.position.set(x, y, z);
    p.life = p.max = o.life ?? 0.5;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.size = o.size ?? 0.3;
    p.grow = o.grow ?? 1;
    p.grav = o.grav ?? 0;
    p.glow = !!o.glow;
    p.s.material.map = p.glow ? glowTexture() : smokeTexture();
    p.s.material.blending = p.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.material.color.set(o.color ?? '#cccccc');
    p.s.material.opacity = o.opacity ?? 0.8;
    p.alpha = o.opacity ?? 0.8;
    p.s.scale.set(p.size, p.size, 1);
    p.s.visible = true;
  }

  hole(x, y, z, nx, ny, nz) {
    const m = this.holes[this.hi++ % this.holes.length];
    m.position.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01);
    m.quaternion.setFromUnitVectors(Z, new THREE.Vector3(nx, ny, nz));
    m.rotateZ(Math.random() * 6);
    const s = 0.7 + Math.random() * 0.6;
    m.scale.set(s, s, 1);
    m.visible = true;
  }

  flashLight(x, y, z, power = 2.5, range = 7) {
    this.light.position.set(x, y, z);
    this.light.intensity = Math.max(this.light.intensity, power);
    this.light.distance = range;
  }

  impact(x, y, z, nx, ny, nz, color = '#cdbb9a') {
    // Sparks off hard surfaces
    for (let i = 0; i < 3; i++) {
      this.particle(x, y, z, {
        life: 0.18,
        vx: nx * 3 + (Math.random() - 0.5) * 5,
        vy: ny * 3 + Math.random() * 3,
        vz: nz * 3 + (Math.random() - 0.5) * 5,
        size: 0.05,
        grow: 0,
        glow: true,
        color: '#ffc46b',
        opacity: 1,
        grav: 12,
      });
    }
    for (let i = 0; i < 4; i++) {
      this.particle(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, {
        life: 0.35 + Math.random() * 0.25,
        vx: nx * 1.5 + (Math.random() - 0.5) * 1.6,
        vy: ny * 1.5 + Math.random() * 1.2,
        vz: nz * 1.5 + (Math.random() - 0.5) * 1.6,
        size: 0.12 + Math.random() * 0.1,
        grow: 1.2,
        color,
        grav: 3,
      });
    }
    this.particle(x, y, z, { life: 0.06, size: 0.25, glow: true, color: '#ffd27a', opacity: 1 });
  }

  blood(x, y, z) {
    for (let i = 0; i < 5; i++) {
      this.particle(x, y, z, {
        life: 0.3 + Math.random() * 0.2,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 1.5,
        vz: (Math.random() - 0.5) * 2,
        size: 0.1 + Math.random() * 0.1,
        grow: 0.6,
        color: '#b0141a',
        opacity: 0.9,
        grav: 6,
      });
    }
  }

  explosion(x, y, z) {
    this.flashLight(x, y + 1, z, 40, 18);
    this.ring.position.set(x, y + 0.15, z);
    this.ring.visible = true;
    this.ringT = 0;
    this.particle(x, y + 0.5, z, { life: 0.25, size: 5, grow: 2, glow: true, color: '#ffcf6a', opacity: 1 });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      this.particle(x, y + 0.3, z, {
        life: 0.9 + Math.random() * 0.8,
        vx: Math.cos(a) * sp,
        vy: 1 + Math.random() * 2.5,
        vz: Math.sin(a) * sp,
        size: 0.8 + Math.random() * 0.8,
        grow: 2.2,
        color: i < 4 ? '#ff9a3a' : '#555049',
        opacity: 0.85,
      });
    }
    for (let i = 0; i < 10; i++) {
      this.particle(x, y + 0.2, z, {
        life: 0.5,
        vx: (Math.random() - 0.5) * 12,
        vy: 3 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 12,
        size: 0.12,
        grow: 0,
        glow: true,
        color: '#ffb347',
        opacity: 1,
        grav: 14,
      });
    }
  }

  addNade(g) {
    const mesh = new THREE.Mesh(this.nadeGeo, this.nadeMat);
    mesh.position.set(g.x, g.y, g.z);
    this.scene.add(mesh);
    this.nades.set(g, mesh);
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        continue;
      }
      p.vy -= p.grav * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const k = Math.exp(-dt * 2);
      p.vx *= k;
      p.vz *= k;
      const age = 1 - p.life / p.max;
      const sz = p.size * (1 + p.grow * age);
      p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = p.alpha * (1 - age);
    }
    this.light.intensity = Math.max(0, this.light.intensity - dt * (this.light.intensity > 5 ? 120 : 50));
    if (this.ring.visible) {
      this.ringT += dt;
      const t = this.ringT / 0.35;
      this.ring.scale.setScalar(0.5 + t * 7);
      this.ring.material.opacity = Math.max(0, 0.8 * (1 - t));
      if (t >= 1) this.ring.visible = false;
    }
    for (const [g, mesh] of this.nades) {
      if (g.done) {
        this.scene.remove(mesh);
        this.nades.delete(g);
        continue;
      }
      mesh.position.set(g.x, g.y, g.z);
      mesh.rotation.x += dt * 8;
    }
  }

  clear() {
    for (const t of this.tracers) (t.life = 0), (t.mesh.visible = false);
    for (const p of this.parts) (p.life = 0), (p.s.visible = false);
    for (const mesh of this.nades.values()) this.scene.remove(mesh);
    for (const h of this.holes) h.visible = false;
    this.ring.visible = false;
    this.light.intensity = 0;
    this.nades.clear();
  }
}
