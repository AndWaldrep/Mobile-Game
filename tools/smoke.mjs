// Browser smoke test: drives the real game in headless Chromium.
//
// Needs the game server and the local PeerJS server running:
//   npm start            (http://localhost:3000)
//   npm run peer         (127.0.0.1:9000)
// and Playwright (not a dependency, it's big):
//   npm i --no-save playwright && npx playwright install chromium
//
// Usage:
//   node tools/smoke.mjs solo [dust|docks] [weapon]   one phone vs bots, screenshots + checks
//   node tools/smoke.mjs pc                           mouse/keyboard: aim, fire while aimed, R, G, Space
//   node tools/smoke.mjs duo                          two phones: invite link, lobby, match, rejoin, results
//
// Screenshots go to tools/out/. Headless Chromium renders with SwiftShader (software, ~3 fps
// with shadows), so waits are long and frame-rate numbers mean nothing here.

import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.GAME_URL || 'http://localhost:3000/';
const PEER = process.env.PEER || '127.0.0.1:9000';
const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const [mode = 'solo', map = 'dust', weapon = 'ar'] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

async function phone(name, opts = {}) {
  const ctx = await browser.newContext(
    opts.pc ? { viewport: { width: 1000, height: 560 } } : { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }
  );
  ctx.setDefaultTimeout(90000);
  await ctx.addInitScript(
    ({ name, weapon, gfx, noLock }) => {
      localStorage.setItem('po-profile', JSON.stringify({ name, color: '#43a047', weapon }));
      localStorage.setItem('po-settings', JSON.stringify({ gfx, autoFire: false }));
      // Pointer lock in headless Chromium makes synthetic mouse moves cancel out; skip it.
      if (noLock) HTMLCanvasElement.prototype.requestPointerLock = function () {};
    },
    { name, weapon, gfx: opts.gfx || 'high', noLock: !!opts.pc }
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));
  return page;
}

const url = (extra = '') => `${BASE}?peerserver=${PEER}${extra}`;
const me = (p) => p.evaluate(() => {
  const m = window.pocketOps.app.match.me;
  return { ammo: m.wpn.ammo, ads: +m.wpn.adsT.toFixed(2), y: +m.sim.y.toFixed(2), yaw: +m.sim.yaw.toFixed(3), reloading: m.wpn.reloading > 0, nades: m.wpn.nades };
});

async function host(p, { bots = 0, map: mp = map } = {}) {
  await p.goto(url());
  await p.click('#createBtn');
  await p.waitForSelector('#lobby:not([hidden])');
  await p.click(`[data-setting="map"][data-value="${mp}"]`);
  const now = Number(await p.textContent('#botsVal'));
  for (let i = now; i > bots; i--) await p.click('[data-setting="bots"][data-delta="-1"]');
  for (let i = now; i < bots; i++) await p.click('[data-setting="bots"][data-delta="1"]');
  await p.click('#startBtn');
  await p.waitForSelector('#hud:not([hidden])');
  await p.waitForTimeout(4500); // countdown
}

if (mode === 'solo') {
  const p = await phone('Solo');
  await host(p, { bots: 3 });
  await p.screenshot({ path: `${OUT}solo-start.png` });
  await p.waitForTimeout(10000);
  await p.screenshot({ path: `${OUT}solo-later.png` });
  console.log('state', await me(p));
} else if (mode === 'pc') {
  const p = await phone('PC', { pc: true });
  await host(p);
  const a = await me(p);
  await p.mouse.move(500, 300);
  await p.mouse.move(600, 260, { steps: 6 });
  await p.waitForTimeout(1500);
  const b = await me(p);
  console.log('mouse aims without clicking:', a.yaw !== b.yaw);
  await p.mouse.down({ button: 'right' });
  await p.waitForTimeout(2500);
  const c = await me(p);
  await p.mouse.down({ button: 'left' });
  await p.waitForTimeout(2500);
  const d = await me(p);
  await p.mouse.up({ button: 'left' });
  await p.mouse.up({ button: 'right' });
  console.log('right click aims:', c.ads > 0.9, '| fires while aimed:', c.ammo - d.ammo > 0);
  await p.keyboard.press('r');
  await p.waitForTimeout(1500);
  console.log('R reloads:', (await me(p)).reloading);
  await p.keyboard.press('g');
  await p.waitForTimeout(1500);
  console.log('G throws a grenade:', (await me(p)).nades < 2);
} else if (mode === 'duo') {
  const h = await phone('Host', { gfx: 'low' });
  await h.goto(url('&autopilot'));
  await h.click('#createBtn');
  await h.waitForSelector('#lobby:not([hidden])');
  const invite = h.url();
  const g = await phone('Guest', { gfx: 'low' });
  await g.goto(invite);
  await g.click('#joinInviteBtn');
  await g.waitForSelector('#lobby:not([hidden])');
  await h.waitForFunction(() => document.querySelectorAll('#playerList li').length === 2);
  console.log('guest joined the lobby');
  await h.click('#startBtn');
  await g.waitForSelector('#hud:not([hidden])');
  await h.waitForTimeout(12000);
  const score = (p) => p.evaluate(() => window.pocketOps.app.match.list().map((e) => `${e.name}:${e.kills}/${e.deaths}`).sort().join(' '));
  console.log('host sees ', await score(h));
  console.log('guest sees', await score(g));
  await g.reload();
  await g.waitForSelector('#hud:not([hidden])');
  console.log('guest rejoined after reload');
  await h.evaluate(() => window.pocketOps.net.send({ t: 'endMatch' }));
  await g.waitForSelector('#results:not([hidden])');
  console.log('results:', await g.textContent('#resultTitle'));
  await h.click('#againBtn');
  await g.waitForSelector('#lobby:not([hidden])');
  console.log('back in the lobby');
}

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no page errors');
await browser.close();
process.exit(problems.length ? 1 : 0);
