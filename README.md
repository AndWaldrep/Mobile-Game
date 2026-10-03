# 🎯 Pocket Ops

A first-person shooter that runs in a phone's web browser. Create a match on
your iPhone, text the link to a friend, and they tap it on any phone to join,
even mid-match. There's nothing to install, and it runs on free GitHub Pages.

**Play: https://andwaldrep.github.io/Mobile-Game/**

- 1–8 players plus bots (up to 12 soldiers), **Team Deathmatch** or
  **Free-for-all**
- 2 maps:
  - **Dust Yard**: a desert market town. A long building with a walkable
    roof (stairs at both ends, parapets to hide behind), a fountain plaza
    and a walled courtyard with doors on every side.
  - **Dockyard**: shipping containers at sunset. A warehouse with a raised
    catwalk, containers you can climb onto, a two-high stack in the middle
    and an open quay by the water.
- 4 loadouts: **Ranger AR**, **Viper SMG**, **Breacher** shotgun,
  **Longbow** sniper (with a scope). You can switch between lives.
- 2 grenades per life, regenerating health, headshots, spawn protection,
  kill feed, radar (enemies show up when they fire), and a UAV after 3 kills
  in a row
- Bots at three skill levels. They find their way around the map, chase
  gunfire, strafe, and take a moment to react, like people do.
- Reconnects on its own if a phone locks or loses signal mid-match

## Controls

| | Phone (turn it sideways) | Keyboard + mouse |
|---|---|---|
| Move | Left thumb anywhere on the left side (a joystick appears) | WASD |
| Sprint | Push the left stick all the way up | Shift |
| Aim / look | Right thumb anywhere on the right side. Push further to turn faster | Mouse (click the game first) |
| Fire | **FIRE** (either side). Drag on it to aim while shooting | Left click |
| Aim down sights | **AIM** (tap to toggle) | Right click |
| Jump / crouch | **⤒** / **⤓** | Space / C |
| Reload / grenade | **↻** / **💣** | R / G |
| Scoreboard / menu | Tap the score / **☰** | Tab / Esc |

**Auto-fire** (on by default for touch) shoots when your crosshair is on an
enemy in range, and **aim assist** slows your aim slightly over enemies.
Turn either off, or change aim speed, under **⚙️ Controls** on the home
screen or in the in-match menu.

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
- Maps are built from boxes on a 1 m grid (`maps.js`). That keeps collision,
  bullets, line of sight and bot pathfinding simple and fast (`grid.js`). To
  make a new map, add an entry to `maps.js`; the tests check it automatically.
- `match.js` is the game without any drawing, which is how the tests play
  whole matches. `main.js` draws it with Three.js and runs the HUD;
  `input.js` is the twin-stick controls.
- Debug aids: add `?debug` to the URL for a frame rate, ping and position
  readout, or `?autopilot` to have a bot play for you. In the browser
  console, `pocketOps` holds the game state.
