// Pocket Ops: maps, collision, bullets and movement.
import test from 'node:test';
import assert from 'node:assert';
import { MAPS, MAP_IDS, getGrid } from '../docs/js/maps.js';
import { PlayerSim, hitSoldier, EYE } from '../docs/js/player.js';
import { Grenade } from '../docs/js/combat.js';

for (const id of MAP_IDS) {
  const g = getGrid(id);

  test(`${id}: spawns are on open ground and everyone can reach everywhere`, () => {
    const reach = g.reachable();
    for (const team of [0, 1]) assert.ok(g.spawns.filter((s) => s.team === team).length >= 6, 'enough team spawns');
    for (const s of g.spawns) {
      const i = Math.floor(s.z) * g.w + Math.floor(s.x);
      assert.ok(g.col[i] < 0.5, `spawn ${s.x},${s.z} is on the ground`);
      assert.ok(reach[i * 2], `spawn ${s.x},${s.z} is reachable`);
      assert.strictEqual(g.floorAt(s.x, s.z, 0.32), g.col[i], `spawn ${s.x},${s.z} isn't touching a wall`);
    }
    // Every bit of open floor, indoors and out, is connected (no sealed-off pockets).
    for (let i = 0; i < g.w * g.d; i++) {
      if (g.col[i] === 0 && g.standable(i * 2)) assert.ok(reach[i * 2], `floor cell ${i % g.w},${Math.floor(i / g.w)} is reachable`);
    }
  });

  test(`${id}: no team spawn can see the other team's spawns`, () => {
    for (const a of g.spawns.filter((s) => s.team === 0)) {
      for (const b of g.spawns.filter((s) => s.team === 1)) {
        const seen = g.clear(a.x, a.y + EYE, a.z, b.x, b.y + 1.2, b.z);
        assert.ok(!seen, `spawn ${a.x},${a.z} can see ${b.x},${b.z}`);
      }
    }
  });

  test(`${id}: bots can path between the two spawn areas`, () => {
    const a = g.spawns.find((s) => s.team === 0);
    const b = g.spawns.find((s) => s.team === 1);
    const p = g.path(Math.floor(a.x), Math.floor(a.z), Math.floor(b.x), Math.floor(b.z));
    assert.ok(p && p.length > 10);
  });
}

test('dust: the roof and its stairs can be climbed on foot', () => {
  const g = getGrid('dust');
  const reach = g.reachable();
  assert.ok(reach[(20 * g.w + 9) * 2 + 1], 'roof is reachable');
  assert.ok(reach[(20 * g.w + 9) * 2], 'and the room under it');
  assert.ok(Math.abs(g.shi[20 * g.w + 9] - 3.2) < 1e-5);
  // Walk up the north stairs (x 10..11, rising toward +z) onto the roof.
  const sim = new PlayerSim(g, { x: 11, z: 8, yaw: Math.PI }); // yaw π faces +z
  for (let i = 0; i < 90; i++) sim.update(1 / 30, { mx: 0, mz: -1 });
  assert.ok(sim.y >= 3.19, `climbed to ${sim.y}`);
  assert.ok(sim.z > 15, `walked onto the roof (${sim.z})`);
});

test('docks: catwalk and container tops can be reached, water can not', () => {
  const g = getGrid('docks');
  const reach = g.reachable();
  assert.ok(reach[(22 * g.w + 4) * 2], 'warehouse catwalk');
  assert.ok(reach[(13 * g.w + 32) * 2], 'container top');
  assert.ok(reach[(21 * g.w + 24) * 2 + 1], 'office roof');
  assert.ok(!reach[(20 * g.w + 46) * 2], 'water');
  const roof = g.path(40, 3, 24, 21, 0, 3.2);
  assert.ok(roof && Math.abs(roof.at(-1)[2] - 3.2) < 1e-5, 'bots can path up the office stairs onto its roof');
  const p = g.path(40, 3, 32, 13);
  assert.ok(p, 'bots can path up onto the container');
});

test('walls stop you, crates can be jumped on', () => {
  const g = getGrid('dust');
  // Walk west into the outer wall.
  const sim = new PlayerSim(g, { x: 3, z: 3, yaw: Math.PI / 2 }); // yaw π/2 faces -x
  for (let i = 0; i < 60; i++) sim.update(1 / 30, { mx: 0, mz: -1 });
  assert.ok(sim.x > 1 && sim.x < 1.4, `stopped at the wall (${sim.x})`);
  // Crate at (14..15, 5), 1 m tall. Without jumping you bump into it.
  const a = new PlayerSim(g, { x: 14.5, z: 7.5, yaw: 0 });
  for (let i = 0; i < 30; i++) a.update(1 / 30, { mx: 0, mz: -1 });
  assert.ok(a.y === 0 && a.z > 6, 'blocked by the crate');
  const b = new PlayerSim(g, { x: 14.5, z: 7.2, yaw: 0 });
  let stood = false;
  for (let i = 0; i < 40; i++) {
    b.update(1 / 30, { mx: 0, mz: -1, jump: i === 2 });
    if (b.ground && b.y === 1 && b.z < 6 && b.z > 5) stood = true;
  }
  assert.ok(stood, 'landed on the crate');
});

test('bullets stop at walls and fly over low cover', () => {
  const g = getGrid('dust');
  // From (3, 1.6, 3) looking west: wall at x = 1.
  const hit = g.raycast(3, 1.6, 3, -1, 0, 0);
  assert.ok(Math.abs(hit.t - 2) < 1e-6 && hit.nx === 1);
  // Low cover wall (22..25, z 6) is 1.1 m tall: chest-height shots go over, knee-height shots don't.
  assert.ok(g.clear(23.5, 1.6, 4, 23.5, 1.6, 8.5));
  assert.ok(!g.clear(23.5, 0.5, 4, 23.5, 0.5, 8.5));
  // Shooting at the ground
  const down = g.raycast(10, 1.6, 3, 0, -1, 0);
  assert.ok(Math.abs(down.y) < 1e-6 && down.ny === 1);
  // Over the sea, bullets leave the map instead of hitting an invisible wall.
  assert.strictEqual(getGrid('docks').raycast(40, 1.6, 30.5, 1, 0, 0), null);
});

test('soldier hitboxes: head and body', () => {
  const v = { x: 0, y: 0, z: -10, cr: 0 };
  const head = hitSoldier(0, 1.62, 0, 0, 0, -1, v, 100);
  assert.ok(head && head.head && Math.abs(head.t - 9.75) < 0.01);
  const body = hitSoldier(0, 1.0, 0, 0, 0, -1, v, 100);
  assert.ok(body && !body.head && Math.abs(body.t - 9.6) < 0.01);
  assert.strictEqual(hitSoldier(0, 1.0, 0, 1, 0, 0, v, 100), null);
  // Crouching lowers the head.
  const cr = { ...v, cr: 1 };
  assert.ok(!hitSoldier(0, 1.62, 0, 0, 0, -1, cr, 100));
});

test('grenades bounce, settle and blow up behind cover only if exposed', () => {
  const g = getGrid('dust');
  const n = Grenade.throwFrom(g, 'a', [30, 1.6, 3], Math.PI, -0.2); // throw south (+z)
  let boom = false;
  for (let i = 0; i < 200 && !boom; i++) boom = n.update(1 / 30) === 'boom';
  assert.ok(boom);
  assert.ok(n.y >= 0 && n.y < 0.5 && n.x > 0 && n.x < g.w && n.z > 4 && n.z < 9, `landed in the map at ${n.x},${n.y},${n.z}`);
  const ents = [
    { id: 'near', alive: true, team: 1, view: { x: n.x + 1, y: g.floorAt(n.x + 1, n.z, 0.3), z: n.z, cr: 0 } },
    { id: 'far', alive: true, team: 1, view: { x: n.x + 30, y: 0, z: n.z, cr: 0 } },
  ];
  const out = n.blast(ents, { id: 'a', team: 0 }, 'ffa');
  assert.deepStrictEqual(out.map((h) => h.ent.id), ['near']);
  assert.ok(out[0].dmg > 60);
});

test('every material used by the maps has a color', () => {
  for (const def of Object.values(MAPS)) for (const m of Object.values(def.mats)) assert.match(m.color, /^#[0-9a-f]{6}$/i);
});

test('buildings: doors, windows, roofs and ceilings', () => {
  const g = getGrid('dust');
  // North-west house: door on its south wall at (17, 12), windows at (15, 12) and (19, 12).
  const inDoor = new PlayerSim(g, { x: 17.5, z: 14, yaw: 0 }); // facing north (-z)
  for (let i = 0; i < 60; i++) inDoor.update(1 / 30, { mx: 0, mz: -1 });
  assert.ok(inDoor.z < 11.5, `walked in through the door (${inDoor.z})`);
  const atWindow = new PlayerSim(g, { x: 19.5, z: 14.5, yaw: 0 });
  for (let i = 0; i < 60; i++) atWindow.update(1 / 30, { mx: 0, mz: -1 });
  assert.ok(atWindow.z > 12.9, `windows don't let you walk through (${atWindow.z})`);
  // Bullets go through a window at chest height, but not through the wall next to it.
  assert.ok(g.clear(19.5, 1.5, 14, 19.5, 1.5, 10.5));
  assert.ok(!g.clear(18.5, 1.5, 14, 18.5, 1.5, 10.5));
  // The roof stops bullets from above, and you can't jump through it.
  assert.ok(!g.clear(17.5, 8, 10.5, 17.5, 1, 10.5));
  const inside = new PlayerSim(g, { x: 17.5, z: 10.5, yaw: 0 });
  let top = 0;
  for (let i = 0; i < 40; i++) {
    inside.update(1 / 30, { jump: i === 1 });
    top = Math.max(top, inside.y);
  }
  assert.ok(top + 1.85 <= 3.1 + 0.01, `head stays under the ceiling (${top})`);
  assert.strictEqual(inside.y, 0);
});

test('climbing: mantle onto a 2 m crate, not onto a container', () => {
  const g = getGrid('dust');
  // Tall crate at (21, 16), 2 m. Stand south of it facing north.
  const s = new PlayerSim(g, { x: 21.5, z: 17.45, yaw: 0 });
  let stood = false;
  for (let i = 0; i < 30; i++) {
    s.update(1 / 30, { mz: i < 20 ? -1 : 0, jump: i === 2 });
    if (s.ground && !s.mantle && Math.abs(s.y - 2) < 0.01) stood = true;
  }
  assert.ok(stood, `climbed up onto the crate (${s.y})`);
  const d = getGrid('docks');
  // Container (19..20, 11..16) is 2.6 m: too tall.
  const c = new PlayerSim(d, { x: 18.6, z: 13.5, yaw: -Math.PI / 2 }); // facing +x
  for (let i = 0; i < 30; i++) c.update(1 / 30, { mz: -1, jump: i === 2 });
  assert.ok(c.y < 0.01, 'containers are too tall to climb');
});

test('movement: strafing and backpedaling are slower; sprint runs out', () => {
  const g = getGrid('dust');
  const speed = (ctl) => {
    const s = new PlayerSim(g, { x: 12, z: 3.5, yaw: -Math.PI / 2 }); // open ground, facing +x
    for (let i = 0; i < 45; i++) s.update(1 / 30, ctl);
    return s.speed;
  };
  const fwd = speed({ mz: -1 });
  assert.ok(speed({ mx: 1 }) < fwd * 0.9);
  assert.ok(speed({ mz: 1 }) < fwd * 0.8);
  assert.ok(speed({ mz: -1, sprint: true }) > fwd * 1.3);
  const s = new PlayerSim(g, { x: 3, z: 3, yaw: Math.PI });
  for (let i = 0; i < 30 * 7; i++) s.update(1 / 30, { mz: -1, sprint: true });
  assert.ok(!s.sprinting && s.stamina < 0.3, 'out of breath after a long sprint');
});
