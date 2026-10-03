// Headless bot match for balancing: a host phone plus bots on a fake clock, no browser.
// Usage: node tools/sim.mjs [dust|docks] [tdm|ffa] [bots=7] [seconds=180] [skill=2]
// Prints kills per weapon, bot hit rate, how long people survive once they start taking
// hits (non-sniper), and per-bot K/D. Runs ~3 simulated minutes in a few seconds.
import { Room } from '../docs/js/room.js';
import { Match } from '../docs/js/match.js';

let clock = 1_000_000;
const timers = [];
globalThis.setTimeout = (fn, ms) => {
  const t = { at: clock + ms, fn };
  timers.push(t);
  return t;
};
globalThis.clearTimeout = (t) => {
  const i = timers.indexOf(t);
  if (i >= 0) timers.splice(i, 1);
};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

const [map = 'dust', mode = 'tdm', bots = 7, secs = 180, skill = 2] = process.argv.slice(2).map((v, i) => (i >= 2 ? Number(v) : v));
const room = new Room('SIMS', { now: () => clock });
const inbox = [];
const host = { local: true, send: (m) => inbox.push(JSON.parse(JSON.stringify(m))), close() {} };
room.attach(host);
room.handle(host, { t: 'create', name: 'Host', color: '#e53935' });
room.handle(host, { t: 'settings', map, mode, bots, skill, time: 10 });
room.handle(host, { t: 'settings', limit: mode === 'ffa' ? 30 : 75 });
room.handle(host, { t: 'startMatch' });

let myId;
let match = null;
const stats = { shots: 0, hits: 0, kills: 0 };
const byWeapon = {};
const firstHit = {};
const survive = [];
function pump() {
  while (inbox.length) {
    const m = inbox.shift();
    if (m.t === 'welcome') myId = m.id;
    else if (m.t === 'start') match = new Match(m, { myId, isHost: true, send: (x) => room.handle(host, JSON.parse(JSON.stringify(x))), now: () => clock });
    else if (m.t === 'results') match.over = true;
    else if (match) {
      if (m.t === 'dmg' && firstHit[m.id] == null) firstHit[m.id] = clock;
      if (m.t === 'kill') {
        if (firstHit[m.victim] != null && m.w !== 'sniper' && m.w !== 'nade') survive.push(clock - firstHit[m.victim]);
        delete firstHit[m.victim];
      }
      match.handle(m);
    }
  }
}
pump();
for (let f = 0; f < secs * 30 && match && !match.over; f++) {
  clock += 1000 / 30;
  timers.sort((a, b) => a.at - b.at);
  while (timers.length && timers[0].at <= clock) timers.shift().fn();
  pump();
  match.update(1 / 30, {});
  for (const ev of match.events) {
    if (ev.type === 'shot') {
      stats.shots++;
      if (ev.rays.some((r) => r.ent)) stats.hits++;
    }
    if (ev.type === 'kill') {
      stats.kills++;
      byWeapon[ev.w] = (byWeapon[ev.w] || 0) + 1;
    }
  }
  match.events.length = 0;
  pump();
}
survive.sort((a, b) => a - b);
console.log(`${map} ${mode}: ${stats.kills} kills in ${secs}s, bot hit rate ${Math.round((100 * stats.hits) / Math.max(1, stats.shots))}%`);
console.log('kills by weapon', byWeapon);
console.log(`survival once hit (non-sniper): median ${Math.round(survive[survive.length >> 1] || 0)} ms, 25th pct ${Math.round(survive[survive.length >> 2] || 0)} ms, ${survive.filter((t) => t < 300).length}/${survive.length} under 300 ms`);
for (const e of match.list()) console.log(`  ${e.name.padEnd(8)} ${e.weapon.padEnd(8)} team ${e.team}  K ${e.kills}  D ${e.deaths}`);
