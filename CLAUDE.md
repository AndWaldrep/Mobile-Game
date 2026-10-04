# CLAUDE.md: Pocket Ops handoff

Context for Claude Code working on this repo. It was built in a series of
cloud sessions; this file captures what you'd otherwise have to rediscover.

## What this is

**Pocket Ops**: a Call of Duty–style multiplayer first-person shooter that runs
in a phone's web browser. It's plain static files with no build step, hosted on
GitHub Pages.

- **Live:** https://andwaldrep.github.io/Mobile-Game/ (the path is case-sensitive; `/mobile-game/` 404s)
- **Deploys:** GitHub Pages serves `main` → `/docs`. Pushing to `main` puts it
  live in about a minute. Check with
  `curl -s https://andwaldrep.github.io/Mobile-Game/js/<file>.js | grep <something new>`.
- **Sibling project:** *Kart Clash* lives in a different repo,
  `AndWaldrep/AppProduction` (https://andwaldrep.github.io/AppProduction/). The
  owner wants the two kept separate: don't move or modify Kart Clash from here.
  The home screen has one link to it.

## About the owner

- Plays mostly on an **iPhone** (Safari), sometimes on a **PC**. Mobile-first,
  landscape. Android should work too.
- Wants it to feel like COD: twin-stick touch controls, realistic movement,
  weapons with real trade-offs, enterable buildings, good graphics.
- Asks for "fully functional": run the tests and the browser smoke tests
  before pushing, and say plainly what you couldn't verify (real-device frame
  rate and touch feel can't be tested headless).
- Prefers plain-language summaries of what changed, not code walkthroughs.

## Commands

```bash
npm start                 # local server for docs/ at http://localhost:3000
npm test                  # node:test suites in test/ (31 tests, a few seconds)
npm run peer              # local PeerJS server on 127.0.0.1:9000 (for multiplayer testing)
node tools/sim.mjs dust tdm 7 180 2   # headless bot match, prints balance numbers
node tools/smoke.mjs solo|pc|duo      # drives the real game in headless Chromium (see below)
npm run vendor            # refresh docs/vendor from node_modules (three, peerjs)
```

Open `http://localhost:3000/?peerserver=127.0.0.1:9000` to use the local
PeerJS server instead of the public cloud one. Other URL flags: `?debug` shows
fps, ping, draw calls and position; `?autopilot` lets a bot play for you
(useful for watching matches). In the browser console, `window.pocketOps`
holds `{ app, net, input, scene, camera, renderer }`.

### Browser smoke tests (`tools/smoke.mjs`)

Needs `npm start`, `npm run peer`, and Playwright, which isn't a dependency
because it's large:
`npm i --no-save playwright && npx playwright install chromium`.

- `solo [map] [weapon]`: one phone against bots, saves screenshots to `tools/out/`.
- `pc`: mouse aims without clicking, right click aims, fires while aimed, R, G,
  2/wheel weapon swap, the controls guide and H, and dying frees the mouse
  without popping the pause menu (pointer lock is faked so this can be tested).
- `duo`: two phones: invite link → lobby → match → guest reloads and rejoins
  → results → back to lobby.

If Playwright's own Chromium download doesn't match, point it at the
preinstalled one: `CHROMIUM=/opt/pw-browsers/chromium node tools/smoke.mjs pc`.

Headless Chromium renders with **SwiftShader** (software, about 3 fps with
shadows). So:
- Allow generous waits. A 300 ms wait may not include a single frame.
- "Graphics lowered to keep things smooth" toasts are expected there.
- Running two pages at once can starve networking (pings of 10+ s). The
  `duo` test uses Low graphics for this reason.
- Frame-rate numbers from headless runs mean nothing for real phones.
- With pointer lock active, Playwright's synthetic mouse moves cancel out.
  The `pc` test stubs `requestPointerLock` so the "aim without clicking" path
  can be exercised.

To look at things, take screenshots and view them. That's how every visual
change so far has been checked (viewmodel placement, buildings, HUD, portrait
layout).

## Architecture (`docs/js/`)

| File | Role |
|---|---|
| `main.js` | App shell: renderer, lighting/shadows/env map, screens, lobby UI, HUD, minimap, camera, effects/sound dispatch, settings, fullscreen, main loop. Biggest file. |
| `match.js` | **The game without drawing**: everyone's soldiers on this phone, simulating the ones it owns (you, plus bots if host), shooting, grenades, interpolating remote soldiers. Emits `events` that main.js turns into effects and sounds. The tests run this headless. |
| `room.js` | The match room, which **runs on the host's phone**: lobby, settings, teams, health, damage, kills, spawns (picked away from enemies), clock, results. The other phones talk to it via `net.js`. |
| `net.js` | PeerJS peer-to-peer. Host = room owner; guests connect over WebRTC. Handles reconnects, page reloads (sessionStorage seat), and a host who's away. |
| `grid.js` | **The map model.** 1 m cells: a solid column plus an optional floating **slab** (roof, door lintel, or the wall above a window). Collision (`slide`, `floorAt`, `ceilAt`), bullets (`raycast`), grenades (`solidAt`), bot A* over (cell, level) nodes, `reachable()`. No Three.js, so the room and tests use it too. |
| `maps.js` | The two maps (Dust Yard, Dockyard) built with `box/mbox/stairs/slab/building/spawn/prop`. Both are mirror-symmetric in z, so `mbox` places a box and its mirror. |
| `player.js` | `PlayerSim` movement: momentum, strafe/backpedal penalties, sprint stamina, slide, mantle (climb ledges up to ~2 m), ceilings, landing. Hitboxes (head sphere + body cylinder). Health regen (`hpAt`). |
| `weapons.js` | The weapons' stats (damage falloff, rpm, mag, reload, spread, move/ADS/sprint-out speeds, UI `stats`), the 6 `CLASSES` and their skills, and `WeaponState` (two slots: primary + sidearm, each with its own ammo; swap, reload, ADS progress, bloom, movement spread). |
| `combat.js` | Shooting rays with spread (`shoot`, `trace`), `aimTarget` (auto-fire), grenade physics and blast. |
| `bot.js` | Bot AI: perception with line of sight, reaction time, aim error that settles, strafing, grenades, A* roaming toward enemies/gunfire, unsticking. Three skill levels in `SKILL`. |
| `world.js` | Three.js level from the grid: textured, normal-mapped surfaces (procedural canvas textures), baked AO, slabs, painted window/door decals, instanced barrels/sandbags, sky dome, decor (dunes/sea, ship, crane), props, clouds, `buildEnvScene` for reflections. |
| `soldier.js` | Other soldiers: segmented model (hips/thighs/shins/torso/head/aim group) with camo atlas + vertex colors, IK-posed arms holding a real gun, run/strafe/crouch/jump/flinch/death animations, name labels, muzzle flash, sniper scope glint. |
| `guns.js` | Gun models for all 7 weapons (the hand cannon and sidearm share `pistolBody`) (detailed for first person, simpler for others), merged per material. |
| `viewmodel.js` | Your own gun and hands in a separate scene drawn on top: bob, sway, ADS, sprint pose, magazine-swap reload, pump/bolt action, shell casings, muzzle flash and light. |
| `fx.js` | Pools: tracers, impact puffs and sparks, blood, bullet-hole decals, explosions (flash light + shockwave), grenade meshes. |
| `input.js` | Twin floating sticks, buttons, keyboard and mouse (see "Gotchas"). |
| `audio.js` | Synthesized Web Audio sounds (no audio files), with a convolver echo on gunshots and explosions. |
| `geom.js` | Geometry helpers: `merge` (fewer draw calls), `limb` (capsule between two points), box/sphere/tube. |

### How multiplayer works

- The host's phone runs `Room`. Each phone simulates **its own soldier** (and
  the host also simulates the bots). Phones send state at 20 Hz; the others
  interpolate with a 110 ms delay.
- **Client-side hit detection:** the shooter's phone decides what its bullets
  hit (against interpolated positions) and sends `hit {id, target, dmg, head, w}`.
  The room validates (alive, team, spawn protection, damage cap), applies the
  damage and broadcasts `dmg`/`kill`/`spawn`.
- Life numbers (`l`) on state messages stop stale positions from applying after
  a respawn.
- If the host leaves, the match ends for everyone (no host migration).

## Conventions

- Plain ES modules, no build, no framework. Three.js is vendored in
  `docs/vendor/` and loaded via an import map. Keep it static-hostable.
- Style: 2-space indent, single quotes, semicolons, ~150-char lines. Comments
  explain *why*, in plain sentences, at the top of files and above non-obvious
  blocks.
- Tests live in `test/*.test.mjs` (node:test; `mock.timers` for the room).
  Map invariants are tested automatically: spawns on open ground, **every
  floor cell reachable**, **no team spawn can see the other team's spawns**,
  bots can path between spawns and onto roofs. Change a map, run `npm test`.
- Balance changes: run `node tools/sim.mjs` on both maps and compare kills per
  weapon, bot hit rate and "survival once hit". The owner asked for fights to
  last long enough to react. Current median is about 2–3 s with 0 kills under
  300 ms; keep it there or longer.
- Floats: grid heights are Float32 (`3.2` is stored as `3.2000000476…`), so
  compare with a tolerance in tests.

### Classes and the sidearm

A loadout is a class, keyed by its primary weapon's id (`pistol`, `smg`, `ar`,
`lmg`, `shotgun`, `sniper`), so the network and lobby still send it as
`weapon`. `CLASSES` in `weapons.js` holds each skill's numbers; they're applied
where they act: `reloadMul`/`swapMul`/`nades` in `WeaponState`, `stamina` in
`PlayerSim`, `armor` in `Room.applyHit` (bullets only), `quiet` in main.js's
radar. Everyone also has the `sidearm` (`secondary: true`, so it's not in
`WEAPON_IDS`). The current slot goes out as `sec` on state messages so other
phones draw the right gun. The `pistol` id is the Gunslinger's .50 Hand
Cannon, deliberately much stronger than the sidearm.

### Adding a weapon

Touch all of these:
- `weapons.js`: stats, including the `stats` bars shown in the loadout, and a `CLASSES` entry with its skill.
- `guns.js`: a `BUILD` entry.
- `soldier.js`: `GRIPS` (where the hands go).
- `audio.js`: a `GUNS` entry.
- `room.js`: the bot starting-weapon list.
- `match.js`: the bot weapon-switch weights.

### Adding or changing a map

Use `building({ x, z, w, d, h, parapet, wall, floor, roof, doors, windows, holes, mirror })`
for enterable buildings.
- Doors and windows are `[x, z]` cells on the wall ring.
- Holes in the roof are for stairwells.
- Interior stairs: `stairs(...)` plus a matching `holes` entry.
- Keep parapets at least 1.2 m so bots don't treat them as jumpable.
- Check that the stairs don't block a door (that happened once).

## Gotchas learned the hard way

- **Mouse buttons:** browsers fire `pointerdown` only for the *first* button.
  A second button pressed while one is held (left click while holding right
  to aim) arrives as `pointermove`. `input.js` reads `e.buttons` on every
  pointer event for this reason. This was the "can't shoot while aiming" bug.
- **Pointer lock vs touch:** never call `requestPointerLock` on touch devices.
  It can break the touch sticks on Android. It's only used when
  `(pointer: fine)` matches or a mouse was actually used, and released on the
  first touch.
- **iPhone can't go full screen** from a web page (no Fullscreen API for
  elements on iPhone). The ⛶ button shows "Add to Home Screen" help there; in
  standalone (home-screen) mode the game is already full screen. Android and
  iPad use the real Fullscreen API.
- **Sandbox quirks** (cloud containers): `npx peerjs` fails without IPv6, which
  is why `tools/peer-server.cjs` binds 127.0.0.1. The proxy breaks TLS for
  headless Chromium, so live-site checks were done with `curl`. Don't disable
  TLS verification.
- Grid `floorAt(x, z, r, y)` and `ceilAt` depend on **your current height**:
  under a roof, the floor is the ground; on the roof, it's the slab top. Always
  pass `y`.
- The viewmodel has its own camera and FOV (wider in portrait). Its lights
  follow the map theme but are kept closer to white so the gun stays readable
  at Dockyard's sunset.
- Draw calls matter on phones. Soldiers are about a dozen meshes each because
  parts are merged; keep new props instanced or merged.

## Current state (all working, tested, live)

- 2 maps with enterable buildings, 2 modes (TDM, FFA), 6 classes with skills
  plus a sidearm for everyone, a 20-second controls guide at match start, bots at 3
  skill levels, grenades, UAV streak, killfeed, faded top-right radar, health
  panel with damage trail and regen glow, stamina bar.
- Settings: aim speed, auto-fire, aim assist, invert, left FIRE button, button
  size, graphics (Auto/High/Low, where Auto steps down on slow phones), sound.
- Touch, PC mouse + keyboard (mouse aims without clicking; Esc → menu; dying
  frees the mouse for the death-screen class picker and settings) and
  portrait all work.

## Not verified / known limits

- Real-device frame rate and how the touch aiming *feels*. Ask the owner how
  it plays on their iPhone.
- One slab per cell, so no multi-story interiors (only a ground floor plus a
  walkable roof).
- The public PeerJS cloud is used for matchmaking in production. If it's
  flaky, players can't connect (there's no self-hosted fallback).
- No host migration; host leaving ends the match.

## Ideas the owner might want next

Objective modes (Domination, Hardpoint), a killcam, more maps, weapon
attachments or perks, recoil patterns per gun, hit-direction audio, prone,
lean around corners, a third map with multi-story buildings (would need a
second slab per cell in `grid.js`), bots that switch to their sidearm.
