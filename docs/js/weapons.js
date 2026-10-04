// Weapon stats, classes, and the per-soldier weapon state (ammo, reload, recoil, spread).
//
// Picking a loadout picks a class: a primary weapon plus a class skill (see
// CLASSES). Everyone also carries a sidearm pistol as a secondary weapon. The
// Gunslinger's primary is a hand cannon that hits much harder than that sidearm.
//
// Every gun trades something away. Light guns let you run faster and aim
// quicker but take more hits to kill; heavy guns hit hard or hold lots of
// ammo but slow you down, take longer to aim and need a moment to raise after
// sprinting. Damage falls off with distance, and headshots do extra.
// With 100 health, a burst from any automatic takes about half a second of
// solid hits, so you have time to react and get to cover.

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: '.50 Hand Cannon',
    icon: '🤠',
    blurb: 'A heavy pistol: 4 body shots, fastest on your feet and quickest to aim.',
    auto: false,
    rpm: 300,
    dmg: 30,
    dmgFar: 19,
    near: 14,
    far: 40,
    headMul: 1.7,
    pellets: 1,
    mag: 8,
    reload: 1.5,
    hip: 0.03,
    ads: 0.01,
    bloom: 0.014,
    maxBloom: 0.04,
    movePenalty: 0.2,
    recoil: 0.034,
    adsFov: 0.82,
    move: 1.14,
    sprintMul: 1.06,
    adsMove: 1.25,
    adsTime: 0.12,
    sprintOut: 0.08,
    autoRange: 30,
    stats: { damage: 6, range: 4, rate: 4, mobility: 10, control: 6 },
  },
  smg: {
    id: 'smg',
    name: 'Viper SMG',
    icon: '⚡',
    blurb: 'Fast and mobile. Shreds up close, weak at range.',
    auto: true,
    rpm: 850,
    dmg: 15,
    dmgFar: 8,
    near: 10,
    far: 28,
    headMul: 1.4,
    pellets: 1,
    mag: 32,
    reload: 1.9,
    hip: 0.045,
    ads: 0.02,
    bloom: 0.008,
    maxBloom: 0.04,
    movePenalty: 0.25,
    recoil: 0.009,
    adsFov: 0.8,
    move: 1.07,
    sprintMul: 1.03,
    adsMove: 1.15,
    adsTime: 0.18,
    sprintOut: 0.14,
    autoRange: 26,
    stats: { damage: 5, range: 3, rate: 10, mobility: 8, control: 6 },
  },
  ar: {
    id: 'ar',
    name: 'Ranger AR',
    icon: '🎖️',
    blurb: 'The all-rounder. Good at every range, best at none.',
    auto: true,
    rpm: 600,
    dmg: 17,
    dmgFar: 13,
    near: 25,
    far: 55,
    headMul: 1.5,
    pellets: 1,
    mag: 30,
    reload: 2.1,
    hip: 0.05,
    ads: 0.008,
    bloom: 0.01,
    maxBloom: 0.05,
    movePenalty: 0.5,
    recoil: 0.011,
    adsFov: 0.68,
    move: 1,
    sprintMul: 1,
    adsMove: 1,
    adsTime: 0.26,
    sprintOut: 0.22,
    autoRange: 45,
    stats: { damage: 6, range: 7, rate: 7, mobility: 6, control: 6 },
  },
  lmg: {
    id: 'lmg',
    name: 'Bulwark LMG',
    icon: '🛡️',
    blurb: 'Huge belt and steady at range. Slow to move, aim and reload.',
    auto: true,
    rpm: 640,
    dmg: 18,
    dmgFar: 15,
    near: 35,
    far: 70,
    headMul: 1.4,
    pellets: 1,
    mag: 75,
    reload: 4.4,
    hip: 0.075,
    ads: 0.01,
    bloom: 0.012,
    maxBloom: 0.07,
    movePenalty: 0.9,
    recoil: 0.008,
    adsFov: 0.66,
    move: 0.86,
    sprintMul: 0.95,
    adsMove: 0.75,
    adsTime: 0.42,
    sprintOut: 0.4,
    autoRange: 50,
    stats: { damage: 7, range: 8, rate: 7, mobility: 2, control: 7 },
  },
  shotgun: {
    id: 'shotgun',
    name: 'Breacher',
    icon: '💥',
    blurb: 'Two pumps up close, often one. Useless beyond a few meters.',
    auto: false,
    rpm: 72,
    dmg: 13,
    dmgFar: 2,
    near: 6,
    far: 18,
    headMul: 1.25,
    pellets: 8,
    mag: 6,
    reload: 3.0,
    hip: 0.085,
    ads: 0.065,
    bloom: 0,
    maxBloom: 0,
    movePenalty: 0,
    recoil: 0.06,
    adsFov: 0.85,
    move: 1.03,
    sprintMul: 1.02,
    adsMove: 1.05,
    adsTime: 0.22,
    sprintOut: 0.18,
    autoRange: 12,
    stats: { damage: 10, range: 1, rate: 2, mobility: 7, control: 4 },
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    icon: '🎯',
    blurb: 'One hit kills. Slowest to move and aim, sways unless you hold still, and your scope glints.',
    auto: false,
    rpm: 45,
    dmg: 100,
    dmgFar: 100,
    near: 100,
    far: 200,
    headMul: 2,
    pellets: 1,
    mag: 5,
    reload: 3.2,
    hip: 0.12,
    ads: 0.002,
    bloom: 0,
    maxBloom: 0,
    movePenalty: 4,
    recoil: 0.07,
    adsFov: 0.28,
    move: 0.82,
    sprintMul: 0.93,
    adsMove: 0.6,
    adsTime: 0.5,
    sprintOut: 0.5,
    autoRange: 120,
    adsOnlyAuto: true,
    scope: true,
    sway: true,
    stats: { damage: 10, range: 10, rate: 1, mobility: 1, control: 3 },
  },
  // The backup pistol everyone carries. Not a loadout choice of its own.
  sidearm: {
    id: 'sidearm',
    name: 'M9 Sidearm',
    icon: '🔫',
    secondary: true,
    auto: false,
    rpm: 380,
    dmg: 16,
    dmgFar: 10,
    near: 10,
    far: 30,
    headMul: 1.6,
    pellets: 1,
    mag: 12,
    reload: 1.3,
    hip: 0.03,
    ads: 0.012,
    bloom: 0.01,
    maxBloom: 0.03,
    movePenalty: 0.2,
    recoil: 0.02,
    adsFov: 0.85,
    move: 1.1,
    sprintMul: 1.04,
    adsMove: 1.2,
    adsTime: 0.12,
    sprintOut: 0.08,
    autoRange: 24,
    stats: { damage: 2, range: 3, rate: 5, mobility: 9, control: 8 },
  },
};
// Loadouts you can pick (the sidearm comes with all of them).
export const WEAPON_IDS = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].secondary);
export const SECONDARY = 'sidearm';

// Each loadout is a class with its own skill. Keyed by the primary weapon's id,
// which is what the lobby and the network already send around as "weapon".
export const CLASSES = {
  pistol: { name: 'Gunslinger', skill: 'Quick Draw', desc: 'Hand cannon instead of a long gun, and swaps weapons twice as fast.', swapMul: 0.5 },
  smg: { name: 'Scout', skill: 'Marathon', desc: 'Sprints twice as long and catches their breath faster.', stamina: 2 },
  ar: { name: 'Assault', skill: 'Quick Hands', desc: 'Reloads 30% faster.', reloadMul: 0.7 },
  lmg: { name: 'Heavy', skill: 'Body Armor', desc: 'Takes 20% less damage from bullets.', armor: 0.8 },
  shotgun: { name: 'Grenadier', skill: 'Bandolier', desc: 'Starts with 4 grenades instead of 2.', nades: 4 },
  sniper: { name: 'Marksman', skill: 'Ghost', desc: "Firing doesn't put you on the enemy radar.", quiet: true },
};
export function classOf(id) {
  return CLASSES[id] || CLASSES.ar;
}

export const NADE = { fuse: 2.2, radius: 6, dmg: 110, speed: 15, count: 2 };
export const SWAP_TIME = 0.45; // seconds to put one gun away and raise the other
export const MAX_HIT = 210; // most damage one message can do (sniper headshot)

export function damageAt(w, dist) {
  if (dist <= w.near) return w.dmg;
  if (dist >= w.far) return w.dmgFar;
  return w.dmg + ((w.dmgFar - w.dmg) * (dist - w.near)) / (w.far - w.near);
}

export class WeaponState {
  constructor(id) {
    this.set(id);
  }

  // id: the class (primary weapon). Slot 0 is the primary, slot 1 the sidearm.
  set(id) {
    this.cls = classOf(id);
    this.slots = [WEAPONS[id] && !WEAPONS[id].secondary ? WEAPONS[id] : WEAPONS.ar, WEAPONS[SECONDARY]].map((w) => ({ w, ammo: w.mag }));
    this.cur = 0;
    this.w = this.slots[0].w;
    this.ammo = this.w.mag;
    this.reloading = 0;
    this.reloadTotal = this.w.reload;
    this.cooldown = 0;
    this.bloomV = 0;
    this.adsT = 0; // 0 hip .. 1 aimed
    this.kick = 0; // visual recoil
    this.nades = this.cls.nades || NADE.count;
    this.sinceShot = 9;
    this.moveSpread = 0;
  }

  // Switch to slot `to` (0 primary, 1 sidearm). Each gun keeps its own ammo; a reload in progress is dropped.
  swap(to = 1 - this.cur) {
    if (to === this.cur || !this.slots[to]) return false;
    this.slots[this.cur].ammo = this.ammo;
    this.cur = to;
    this.w = this.slots[to].w;
    this.ammo = this.slots[to].ammo;
    this.reloading = 0;
    this.bloomV = 0;
    this.adsT = 0;
    this.kick = 0;
    this.cooldown = Math.max(this.cooldown, SWAP_TIME * (this.cls.swapMul || 1));
    return true;
  }

  get interval() {
    return 60 / this.w.rpm;
  }

  // Current inaccuracy (radians). Moving makes it worse.
  spread() {
    const w = this.w;
    const base = w.hip + (w.ads - w.hip) * this.adsT;
    return (base + this.bloomV) * (1 + this.moveSpread) + (w.sway ? this.moveSpread * 0.004 : 0);
  }

  // speed: how fast you're moving (m/s), crouch 0..1
  update(dt, ads, speed = 0, crouch = 0) {
    const w = this.w;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceShot += dt;
    this.bloomV = Math.max(0, this.bloomV - dt * 0.12);
    this.kick = Math.max(0, this.kick - dt * 6);
    this.moveSpread = Math.min(2.5, (speed / 5) * w.movePenalty * (0.5 + 0.5 * this.adsT)) * (1 - 0.25 * crouch);
    const target = ads && !this.reloading ? 1 : 0;
    const rate = 1 / (w.adsTime * 0.45);
    this.adsT += (target - this.adsT) * Math.min(1, dt * rate);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.ammo = w.mag;
        this.slots[this.cur].ammo = this.ammo;
        return 'reloaded';
      }
    }
    return null;
  }

  canFire() {
    return this.cooldown <= 0 && this.reloading <= 0 && this.ammo > 0;
  }

  // Call when the trigger is pulled. Returns true if a shot goes out.
  fire() {
    if (!this.canFire()) return false;
    this.ammo--;
    this.cooldown = this.interval;
    this.bloomV = Math.min(this.w.maxBloom, this.bloomV + this.w.bloom);
    this.kick = 1;
    this.sinceShot = 0;
    return true;
  }

  startReload() {
    if (this.reloading > 0 || this.ammo >= this.w.mag) return false;
    this.reloading = this.reloadTotal = this.w.reload * (this.cls.reloadMul || 1);
    return true;
  }
}
