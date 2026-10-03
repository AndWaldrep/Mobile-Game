// Your own gun and hands, drawn in their own little scene on top of the world
// so they never poke through walls. Detailed gun, gloved hands on the grip and
// handguard, shell casings, magazine-swap reloads, pump and bolt actions.

import * as THREE from 'three';
import { buildGun, casingGeometry, GUN_MATS } from './guns.js';
import { soldierMaterial, flashTexture, glowTexture, elbow, GRIPS, shade } from './soldier.js';
import { merge, limb, box, sphere } from './geom.js';

const CAMO = [0, 0, 0.5, 1];
const PLAIN = [0.5, 0, 1, 1];

function armsMesh(id, sleeve) {
  const g = GRIPS[id] || GRIPS.ar;
  // Shoulders sit below and behind the camera (in gun space).
  const RS = [0.14, -0.42, 0.6];
  const LS = [-0.32, -0.46, 0.36];
  const rh = g.grip;
  const lh = g.fore;
  const re = elbow(RS, rh, 0.34, 0.34, [0.8, -1, 0]);
  const le = elbow(LS, lh, 0.34, 0.34, [-0.5, -1, 0]);
  const glove = '#2b2c2e';
  const parts = [
    { geo: limb(RS, re, 0.06), color: sleeve, uv: CAMO },
    { geo: limb(re, rh, 0.05), color: shade(sleeve, 0.95), uv: CAMO },
    { geo: limb(LS, le, 0.06), color: sleeve, uv: CAMO },
    { geo: limb(le, lh, 0.05), color: shade(sleeve, 0.95), uv: CAMO },
  ];
  // Gloved hands wrapped around the grip and handguard, with fingers.
  for (const [p, wrap] of [[rh, 1], [lh, -1]]) {
    parts.push({ geo: sphere(0.042, p[0] + 0.035 * wrap, p[1] + 0.005, p[2] + 0.01, 0.8, 1.1, 1.5, 9), color: glove, uv: PLAIN });
    for (let f = 0; f < 3; f++) parts.push({ geo: box(0.07, 0.016, 0.018, p[0] - 0.005 * wrap, p[1] - 0.025 + f * 0.022, p[2] - 0.03 + f * 0.004), color: glove, uv: PLAIN });
    parts.push({ geo: box(0.05, 0.016, 0.018, p[0] - 0.03 * wrap, p[1] + 0.03, p[2] - 0.02), color: glove, uv: PLAIN }); // thumb
    // Glove cuff
    parts.push({ geo: sphere(0.05, p[0] + 0.04 * wrap, p[1] - 0.01, p[2] + 0.07, 1, 1, 1.2, 8), color: '#1e1f20', uv: PLAIN });
  }
  const mesh = new THREE.Mesh(merge(parts, true), soldierMaterial());
  return mesh;
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#555555', 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.0);
    this.sun.position.set(1, 2, 1);
    this.scene.add(this.sun);
    this.flashLight = new THREE.PointLight('#ffb35c', 0, 2.5, 2);
    this.scene.add(this.flashLight);
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.gun = null;
    this.parts = null;
    this.id = null;
    this.bob = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.raise = 1;
    this.t = 0;
    this.action = 0; // pump / bolt cycle after a shot
    this.portrait = false;
    // Muzzle flash: a spiky star on crossed cards plus a soft glow.
    this.flash = new THREE.Group();
    const fm = new THREE.MeshBasicMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
    const card = new THREE.PlaneGeometry(0.22, 0.22);
    const a = new THREE.Mesh(card, fm);
    const b = new THREE.Mesh(card, fm);
    b.rotation.y = Math.PI / 2;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), fm);
    c.rotation.x = Math.PI / 2;
    this.flash.add(a, b, c);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.set(0.18, 0.18, 1);
    this.flash.add(glow);
    this.flashT = 0;
    // Shell casings
    this.casings = [];
    const cg = casingGeometry();
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(cg, GUN_MATS.brass);
      m.visible = false;
      this.scene.add(m);
      this.casings.push({ m, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    this.ci = 0;
    this.pendingEject = -1;
  }

  setEnvironment(env) {
    this.scene.environment = env;
  }

  setWeapon(id, sleeve) {
    if (this.id === id && this.sleeve === sleeve) return;
    this.id = id;
    this.sleeve = sleeve;
    if (this.gun) {
      this.gun.remove(this.flash);
      this.rig.remove(this.gun);
      this.gun.traverse((o) => o.geometry && o.geometry.dispose());
    }
    const built = buildGun(id, true);
    this.parts = built;
    const g = new THREE.Group();
    g.add(built.group);
    g.add(armsMesh(id, sleeve));
    this.flash.position.set(0, built.muzzleY ?? -0.05, built.muzzle - 0.06);
    g.add(this.flash);
    this.magY = built.mag ? built.mag.position.y : 0;
    this.gun = g;
    this.rig.add(g);
    this.raise = 1;
    this.action = 0;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // An upright phone is narrow: widen the view a bit and hold the gun lower and closer to the middle.
    this.portrait = aspect < 1;
    this.camera.fov = this.portrait ? 74 : 56;
    this.camera.updateProjectionMatrix();
  }

  fire() {
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = (this.id === 'shotgun' ? 1.5 : this.id === 'sniper' ? 1.3 : 1) * (0.8 + Math.random() * 0.4);
    this.flash.scale.setScalar(s);
    this.flashLight.intensity = 3;
    if (this.id === 'shotgun' || this.id === 'sniper') {
      this.action = 1;
      this.pendingEject = 0.28;
    } else this.eject();
  }

  eject() {
    if (!this.gun || !this.parts) return;
    const c = this.casings[this.ci++ % this.casings.length];
    const p = new THREE.Vector3(...this.parts.eject);
    this.gun.localToWorld(p);
    c.m.position.copy(p);
    c.v.set(1.2 + Math.random() * 0.6, 1.4 + Math.random() * 0.5, 0.3 + Math.random() * 0.3);
    c.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
    c.life = 0.7;
    c.m.visible = true;
    c.m.scale.setScalar(this.id === 'shotgun' ? 1.8 : this.id === 'sniper' ? 1.4 : 1);
  }

  // s: { ads 0..1, kick 0..1, reload 0..1 (progress, -1 none), sprint, speed, dyaw, dpitch, scoped, ground }
  update(dt, s) {
    this.t += dt;
    // Casings fly out and tumble.
    for (const c of this.casings) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.v.y -= 9 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.spin.x * dt;
      c.m.rotation.y += c.spin.y * dt;
      if (c.life <= 0) c.m.visible = false;
    }
    if (this.pendingEject >= 0) {
      this.pendingEject -= dt;
      if (this.pendingEject < 0) this.eject();
    }
    if (!this.gun) return;
    const ads = s.ads;
    this.raise = Math.max(0, this.raise - dt * 3);
    const speed = Math.min(1, s.speed / 6);
    this.bob += dt * (4 + s.speed * 1.6) * (speed > 0.05 ? 1 : 0.3);
    const bobAmt = (s.sprint ? 0.03 : 0.012 * speed) * (1 - ads * 0.85);
    const breathe = Math.sin(this.t * 1.6) * 0.0035 * (1 - ads * 0.7);
    this.swayX += (-s.dyaw * 0.6 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (s.dpitch * 0.6 - this.swayY) * Math.min(1, dt * 8);
    const hip = this.portrait ? { x: 0.1, y: -0.2, z: -0.52 } : { x: 0.19, y: -0.135, z: -0.5 };
    const aim = { x: 0, y: 0, z: -0.47 };
    let x = hip.x + (aim.x - hip.x) * ads;
    let y = hip.y + (aim.y - hip.y) * ads;
    let z = hip.z + (aim.z - hip.z) * ads;
    x += Math.cos(this.bob * 0.5) * bobAmt + this.swayX * 0.035 * (1 - ads * 0.7);
    y += -Math.abs(Math.sin(this.bob * 0.5)) * bobAmt + this.swayY * 0.035 * (1 - ads * 0.7) + breathe;
    z += s.kick * (this.id === 'sniper' || this.id === 'shotgun' ? 0.09 : 0.045) * (1 - ads * 0.4);
    let rx = s.kick * (this.id === 'sniper' || this.id === 'shotgun' ? 0.16 : 0.07);
    let ry = this.swayX * 0.05 * (1 - ads);
    let rz = -this.swayX * 0.08 * (1 - ads);
    if (s.sprint) {
      x += 0.02;
      y -= 0.06;
      ry += 0.75;
      rz += 0.3;
      rx -= 0.3;
    }
    // Reload: tip the gun, drop the magazine out, slap a new one in.
    const mag = this.parts.mag;
    if (s.reload >= 0) {
      const p = s.reload;
      const dip = Math.sin(Math.min(1, p) * Math.PI);
      rx -= dip * 0.35;
      rz += dip * 0.55;
      ry -= dip * 0.15;
      y -= dip * 0.05;
      if (mag) {
        let out = 0;
        if (p > 0.15 && p < 0.42) out = (p - 0.15) / 0.27;
        else if (p >= 0.42 && p < 0.7) out = 1 - (p - 0.42) / 0.28;
        mag.position.y = this.magY - out * 0.28;
        mag.visible = !(p > 0.38 && p < 0.46);
      }
      if (this.parts.bolt && p > 0.75) this.parts.bolt.position.z = Math.sin(((p - 0.75) / 0.25) * Math.PI) * 0.07;
      if (this.parts.pump && p > 0.8) this.parts.pump.position.z = Math.sin(((p - 0.8) / 0.2) * Math.PI) * 0.08;
    } else if (mag) {
      mag.position.y = this.magY;
      mag.visible = true;
    }
    // Pump or bolt cycles after each shot.
    if (this.action > 0) {
      this.action = Math.max(0, this.action - dt * 1.9);
      const a = Math.sin((1 - this.action) * Math.PI);
      if (this.parts.pump) this.parts.pump.position.z = a * 0.08;
      if (this.parts.bolt) {
        this.parts.bolt.position.z = a * 0.07;
        rz += a * 0.12;
      }
    }
    y -= this.raise * this.raise * 0.3;
    rx -= this.raise * 0.7;
    this.gun.position.set(x, y, z);
    this.gun.rotation.set(rx, ry, rz);
    this.gun.visible = !s.scoped;
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.visible = true;
    } else this.flash.visible = false;
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 60);
    this.flash.getWorldPosition(this.flashLight.position);
  }
}
