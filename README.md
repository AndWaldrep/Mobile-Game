# 🎯 Pocket Ops

A first-person shooter that runs in a phone's web browser. Create a match on
your iPhone, text the link to a friend, and they tap it on any phone to join,
even mid-match. There's nothing to install, and it runs on free GitHub Pages.

**Play: https://andwaldrep.github.io/Mobile-Game/**

- 1–8 players plus bots (up to 12 soldiers), **Team Deathmatch** or
  **Free-for-all**
- 2 maps with buildings you can go inside: doors, windows you can see and
  shoot through, stairs, and roofs you can stand on.
  - **Dust Yard**: a desert market town. Four small houses, a long two-level
    building with inside and outside stairs up to a rooftop with a parapet,
    a fountain plaza, and a walled courtyard with covered corners.
  - **Dockyard**: shipping containers at sunset. A roofed warehouse with
    skylights, high windows and a catwalk; a two-room site office in the
    middle with stairs up to a rooftop overlooking the yard; containers you
    can climb; an open quay by the water.
- 6 loadouts, each with a trade-off (see **Weapons** below). Switch between lives.
- 2 grenades per life, regenerating health, headshots, spawn protection,
  kill feed, radar (enemies show up when they fire), and a UAV after 3 kills
  in a row
- Bots at three skill levels. They find their way around the map, chase
  gunfire, strafe, and take a moment to react, like people do.
- Reconnects on its own if a phone locks or loses signal mid-match
- Real-time sun shadows, sky reflections on metal, water and guns, bumpy
  surface detail, bullet holes, sparks, shell casings, and explosions that
  light up the area. **Graphics: Auto** drops to a lighter mode on phones that
  can't keep up.
- Detailed soldiers (camo, vest, helmet and goggles, backpack) that run,
  strafe, crouch, flinch and fall; detailed guns with a red-dot or holo
  sight, scope, pump or bolt action, and a magazine-swap reload

## Weapons

You have 100 health, and it comes back if you avoid getting hit for 5
seconds. Fights take long enough to react and get to cover: with every
shot hitting, an automatic needs about half a second, and in real fights
it's usually a couple of seconds.

| Weapon | Good at | Paying for it with |
|---|---|---|
| **M9 Sidearm** (pistol) | Fastest running and aiming; ready the instant you stop sprinting | Weakest: 5+ hits to kill, small magazine |
| **Viper SMG** | Huge fire rate; quick to aim; you move faster | Damage drops off fast past ~10 m |
| **Ranger AR** | Good at every range | Best at none |
| **Bulwark LMG** | 75-round belt; hits hard and stays accurate at range | Slowest automatic to move, aim, and reload; slow to fire after sprinting |
| **Breacher** (shotgun) | One or two pumps kills up close | Useless past ~15 m; slow reload |
| **Longbow** (sniper) | One hit to the body or head kills at any range | Slowest to move and aim; the scope sways unless you crouch and hold still; wild if you don't scope in; a scope glint gives you away |

The loadout screen shows each gun's damage, range, fire rate, mobility and
control as bars.

## Movement

Movement has weight. You speed up and slow down over a moment, and you strafe
and backpedal slower than you run forward. Sprinting runs out (a small bar
under your health shows your breath), and your gun needs a moment to come up
after a sprint. Heavier guns take longer. Crouch mid-sprint to **slide**, and
jump at a ledge up to about chest height (crates, truck cabs) to **climb** it.
Your view bobs as you walk, leans when you strafe, and dips when you land.

## Controls

| | Phone (turn it sideways) | Keyboard + mouse |
|---|---|---|
| Move | Left thumb anywhere on the left side (a joystick appears) | WASD |
| Sprint | Push the left stick all the way up | Shift |
| Aim / look | Right thumb anywhere on the right side. Push further to turn faster | Just move the mouse (the first click or key press locks it to the game) |
| Fire | **FIRE** (either side). Drag on it to aim while shooting | Left click |
| Aim down sights | **AIM** (tap to toggle) | Right click |
| Jump / climb | **⤒** | Space |
| Crouch / slide | **⤓** (while sprinting to slide) | C |
| Reload / grenade | **↻** / **💣** | R / G |
| Scoreboard / menu | Tap the score / **☰** | Tab / Esc (letting go of the mouse also opens the menu) |
| Full screen | **⛶** (top right) | |

**Auto-fire** (on by default for touch) shoots when your crosshair is on an
enemy in range, and **aim assist** slows your aim slightly over enemies.
Under **⚙️ Controls** on the home screen (or in the in-match **☰** menu) you
can also change aim speed, **button size** (S/M/L), hide the left-side FIRE
button, switch **graphics** between Auto/High/Low, and turn sound on or off.

The HUD keeps the middle clear: a faded radar in the top-right corner
(enemies appear on it when they fire), the kill feed top-left, and health and
ammo in one bar at the bottom. The health bar shows the number, turns yellow
then red as you get hurt, shows a white trail for damage you just took, and
glows while it's coming back.

**Full screen:** on Android, tap **⛶**. iPhone's Safari doesn't let web games
go full screen, so there the button explains the fix: **Share → Add to Home
Screen**, then open Pocket Ops from your home screen and it runs full screen
like an app.

## Inviting a friend

1. Tap **Create match**. You get a 4-letter match code.
2. Tap **💬 Invite a friend by text**. On iPhone this opens the share sheet, so
   pick Messages. You can also use **Open Messages** or **Copy link**.
3. Your friend taps the link and taps **Join match**.
4. As host, pick the map, mode, bots, score and time, then tap
   **Start match!** Friends who join later drop straight into the fight.

## Putting it online with GitHub Pages (free)

The whole game is static files in the `docs/` folder.

1. The repo must be public (it is).
2. Go to **Settings → Pages**. Under *Build and deployment* set
   **Source: Deploy from a branch**, pick **main** and the **/docs** folder,
   and click **Save**.
3. After a minute or two the game is live at
   **https://andwaldrep.github.io/Mobile-Game/**. Tip: in Safari, use
   **Share → Add to Home Screen** for a full-screen, app-like experience.

## Running it on your own computer

```bash
npm start            # http://localhost:3000
```

The preview server just serves `docs/`, so no install step is needed. Phones on
the same Wi‑Fi can open `http://<your-computer's-IP>:3000`. Run `npm install`
only for the tests, or to update the bundled libraries with `npm run vendor`.

## Tests

Developer notes (architecture, testing tools, gotchas) are in `CLAUDE.md`.

```bash
npm install
npm test
```

The tests check the maps (every spot reachable, no spawn can see the other
team's spawns), movement, bullets, grenades and the match rules, and play
whole matches headless: a host phone and a guest phone plus bots on both
maps, in both modes.

## How it works

- There's no game server. The host's phone runs the match room
  (`docs/js/room.js`): the lobby, teams, health, kills, spawns and the
  clock. Friends' phones connect straight to it over WebRTC.
  [PeerJS](https://peerjs.com)'s free public service only introduces the
  phones to each other.
- Each phone moves its own soldier and works out what its own bullets hit, so
  aiming feels instant. The room applies the damage and announces kills. The
  host's phone also runs the bots (`bot.js`).
- Maps are built on a 1 m grid (`maps.js`): each cell is a solid column plus
  an optional floating "slab" (a roof, a door lintel, or the wall above a
  window). That's enough for real buildings while keeping collision,
  bullets, line of sight and bot pathfinding simple and fast (`grid.js`).
  Bots path in and out of doors and up stairs onto roofs. To
  make a new map, add an entry to `maps.js`; the tests check it automatically.
- `world.js` builds the 3D level from the grid; `soldier.js`, `guns.js` and
  `viewmodel.js` are the people and weapons, all built from simple shapes and
  merged so each soldier is only about a dozen draw calls.
- `match.js` is the game without any drawing, which is how the tests play
  whole matches. `main.js` draws it with Three.js and runs the HUD;
  `input.js` is the twin-stick controls.
- Debug aids: add `?debug` to the URL for a frame rate, ping and position
  readout, or `?autopilot` to have a bot play for you. In the browser
  console, `pocketOps` holds the game state.
