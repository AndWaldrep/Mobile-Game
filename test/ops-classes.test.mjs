// Pocket Ops: classes, their skills, and the sidearm everyone carries.
import test, { mock } from 'node:test';
import assert from 'node:assert';
import { WEAPONS, WEAPON_IDS, CLASSES, SECONDARY, SWAP_TIME, WeaponState, damageAt } from '../docs/js/weapons.js';
import { PlayerSim } from '../docs/js/player.js';
import { getGrid } from '../docs/js/maps.js';
import { Room, PROTECT_MS } from '../docs/js/room.js';

test('every loadout is a class with a skill, and the sidearm is not a loadout of its own', () => {
  assert.ok(!WEAPON_IDS.includes(SECONDARY));
  for (const id of WEAPON_IDS) {
    assert.ok(CLASSES[id]?.name && CLASSES[id].skill && CLASSES[id].desc, `${id} has a class`);
    const w = new WeaponState(id);
    assert.strictEqual(w.slots[0].w.id, id);
    assert.strictEqual(w.slots[1].w.id, SECONDARY, `${id} carries a sidearm`);
  }
  assert.strictEqual(WEAPONS.sniper.name, 'Sniper');
});

test("the Gunslinger's hand cannon hits harder than everyone's sidearm", () => {
  for (const d of [5, 20, 40]) assert.ok(damageAt(WEAPONS.pistol, d) > damageAt(WEAPONS.sidearm, d) * 1.5, `at ${d} m`);
  const shots = (w) => Math.ceil(100 / w.dmg);
  assert.ok(shots(WEAPONS.pistol) < shots(WEAPONS.sidearm));
});

test('switching weapons keeps each gun’s ammo, drops a reload and takes a moment', () => {
  const w = new WeaponState('ar');
  w.fire();
  w.cooldown = 0;
  w.fire();
  assert.strictEqual(w.ammo, 28);
  w.cooldown = 0;
  w.startReload();
  assert.ok(w.swap(1));
  assert.strictEqual(w.w.id, SECONDARY);
  assert.strictEqual(w.ammo, WEAPONS.sidearm.mag);
  assert.strictEqual(w.reloading, 0, 'reload cancelled');
  assert.ok(!w.canFire(), 'still raising the sidearm');
  w.update(SWAP_TIME + 0.01, false);
  assert.ok(w.canFire());
  w.fire();
  assert.ok(!w.swap(1), 'already holding it');
  w.swap(0);
  assert.strictEqual(w.ammo, 28, 'rifle ammo kept');
  w.swap(1);
  assert.strictEqual(w.ammo, WEAPONS.sidearm.mag - 1, 'sidearm ammo kept');
  w.set('ar');
  assert.strictEqual(w.cur, 0, 'respawning starts on the primary');

  const g = new WeaponState('pistol');
  g.swap(1);
  assert.ok(g.cooldown < SWAP_TIME, 'Gunslinger swaps faster');
});

test('class skills: Grenadier grenades, Assault reloads, Scout stamina', () => {
  assert.strictEqual(new WeaponState('shotgun').nades, 4);
  assert.strictEqual(new WeaponState('ar').nades, 2);

  const reloadTime = (id) => {
    const w = new WeaponState(id);
    w.ammo = 0;
    w.startReload();
    return w.reloading / w.w.reload;
  };
  assert.ok(reloadTime('ar') < 0.75);
  assert.strictEqual(reloadTime('lmg'), 1);

  const g = getGrid('dust');
  const run = (stamina) => {
    const s = new PlayerSim(g, { x: 3, z: 3, yaw: Math.PI });
    for (let i = 0; i < 30 * 7; i++) s.update(1 / 30, { mz: -1, sprint: true, stamina });
    return s;
  };
  assert.ok(!run(1).sprinting);
  const scout = run(2);
  assert.ok(scout.sprinting && scout.stamina > 0.3, 'Scout still sprinting after 7 s');
});

test('room: Heavy armor soaks bullets but not grenades, and the sidearm shows to others', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  try {
    const room = new Room('ABCD', { random: () => 0.3 });
    const conn = () => {
      const c = { inbox: [], send: (m) => c.inbox.push(JSON.parse(JSON.stringify(m))), close() {}, say: (m) => room.handle(c, m) };
      c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
      room.attach(c);
      return c;
    };
    const host = conn();
    const guest = conn();
    host.say({ t: 'create', name: 'Host', color: '#e53935', weapon: 'ar' });
    guest.say({ t: 'join', code: 'ABCD', name: 'Tank', color: '#1e88e5', weapon: 'lmg' });
    host.say({ t: 'settings', bots: 0, mode: 'ffa' });
    const hid = host.last('welcome').id;
    const gid = guest.last('welcome').id;
    host.say({ t: 'startMatch' });
    const start = guest.last('start');
    mock.timers.tick(start.startAt - Date.now() + PROTECT_MS + 10);

    host.say({ t: 'hit', id: hid, target: gid, dmg: 50, w: 'ar' });
    assert.strictEqual(guest.last('dmg').hp, 60, '50 bullet damage becomes 40');
    host.say({ t: 'hit', id: hid, target: gid, dmg: 30, w: 'nade' });
    assert.strictEqual(guest.last('dmg').hp, 30, 'grenades hit full');
    guest.say({ t: 'hit', id: gid, target: hid, dmg: 50, w: 'lmg' });
    assert.strictEqual(host.last('dmg').hp, 50, 'no armor for the Assault class');

    const life = room.match.ents.get(gid).life;
    guest.say({ t: 's', e: [{ id: gid, l: life, ts: 1, x: 1, y: 0, z: 1, yaw: 0, pitch: 0, cr: 0, mv: 0, ads: 0, gr: 1, sec: 1 }] });
    assert.strictEqual(host.last('s').e[0].sec, 1);
  } finally {
    mock.timers.reset();
  }
});
