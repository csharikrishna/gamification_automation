/* Marble Machine — drop a marble and watch it run the course.
   Physics: Matter.js at a fixed 60 Hz. Rendering: canvas 2D with a camera that follows the marble.
   Every sound is synthesised. window.__mm.sim(i) runs a level headless to prove it can be finished. */
(() => {
'use strict';
const { Engine, Composite, Bodies, Body, Constraint, Vector, Events } = Matter;
const TAU = Math.PI * 2;
const R = 12;        // marble radius
const WALL = 16;     // wall thickness
const CAP = 26;      // speed cap — keeps a fast marble from tunnelling through a wall
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const SAVEKEY = 'marble-machine';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const MARBLE_SKINS = [['#8fd7ff', '#2f7fd0'], ['#ffd27f', '#d07a12'], ['#ff9ec4', '#c2377a'], ['#b7ff9e', '#3d9c34'], ['#d7b5ff', '#7a45c9']];

const canvas = $('c'), ctx = canvas.getContext('2d');
let VW = 0, VH = 0, DPR = 1;

const engine = Engine.create();
engine.positionIterations = 8; engine.velocityIterations = 8; engine.gravity.y = 1;
const world = engine.world;

let LV = null, lvIdx = 0;
let mechs = [], art = [], zones = [], marbles = [], parts = [];
let st = { delivered: 0, left: 0, stars: 0, starTotal: 0, coins: 0, coinTotal: 0, frames: 0, done: false, nudges: 0 };
let cam = { x: 450, y: 300, z: 1 }, camTarget = { x: 450, y: 300, z: 1 };
let follow = null, viewAll = false, speedMul = 1, started = false, silent = false, raf = 0;
let save = { stars: {}, coins: {}, unlocked: 1, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVEKEY) || '{}')); } catch (e) {}
if (!save.coins) save.coins = {};
if (!save.best) save.best = {};
const persist = () => { try { localStorage.setItem(SAVEKEY, JSON.stringify(save)); } catch (e) {} };

// ---------------------------------------------------------------- audio
const A = (() => {
  let ac = null, master;
  let lastClick = 0;
  function ctxOf() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0.42;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination); return ac;
  }
  function tone(f, dur, type = 'sine', vol = 0.3, slide, delay = 0) {
    const c = ctxOf(); if (!c || save.muted || silent) return;
    const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, hp) {
    const c = ctxOf(); if (!c || save.muted || silent) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 1200;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  return {
    unlock() { ctxOf(); },
    click(v) { const now = performance.now(); if (now - lastClick < 45) return; lastClick = now; const p = clamp(v / 14, 0.1, 1); tone(300 + 900 * p, 0.05, 'triangle', 0.05 + 0.13 * p, 180 + 300 * p); noise(0.03, 0.03 + 0.06 * p, 2600); },
    bell(n) { const f = NOTES[n % NOTES.length]; tone(f, 1.1, 'sine', 0.26); tone(f * 2, 0.6, 'sine', 0.07); tone(f * 3.01, 0.3, 'sine', 0.03); },
    star() { [880, 1174, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, undefined, i * 0.055)); },
    coin(n) { const f = NOTES[n % NOTES.length]; tone(f, 0.16, 'triangle', 0.16); tone(f * 2, 0.1, 'sine', 0.06); },
    hop() { tone(420, 0.12, 'triangle', 0.18, 900); },
    drop() { tone(220, 0.16, 'sine', 0.2, 520); },
    thunk() { tone(120, 0.12, 'sine', 0.3, 50); noise(0.06, 0.1); },
    whoosh() { noise(0.22, 0.2, 900); tone(200, 0.2, 'sine', 0.12, 700); },
    splash() { noise(0.35, 0.22); tone(260, 0.25, 'sine', 0.12, 90); },
    warp() { [600, 900, 1350].forEach((f, i) => tone(f, 0.18, 'sine', 0.16, undefined, i * 0.05)); },
    pop() { tone(700, 0.07, 'square', 0.18, 200); },
    goal() { [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.5, 'triangle', 0.26, undefined, i * 0.07); tone(f / 2, 0.4, 'sine', 0.12, undefined, i * 0.07); }); },
    win() { [523, 659, 784, 1047, 1318, 1568].forEach((f, i) => { tone(f, 0.55, 'triangle', 0.26, undefined, i * 0.1); tone(f * 2, 0.3, 'sine', 0.07, undefined, i * 0.1); }); },
    fail() { [400, 330, 260].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.12)); },
  };
})();

// ---------------------------------------------------------------- geometry helpers
function wallBodies(pts, w, extra) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 0.6) continue;
    out.push(Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len + w, w,
      Object.assign({ isStatic: true, friction: 0.008, frictionStatic: 0.02, restitution: 0.08, angle: Math.atan2(dy, dx) }, extra)));
  }
  return out;
}
// Round off the corners of a tube path. A sharp corner makes the outer wall of the next
// segment cut across the previous channel, which walls the marble in; a fillet keeps it open.
function smooth(pts, r = 95, steps = 7) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < 1 || l2 < 1) continue;
    const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
    const ang = Math.acos(clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1));
    if (ang > Math.PI * 0.94) { out.push(p1); continue; }          // already near-straight
    const rr = Math.min(r, l1 * 0.48, l2 * 0.48);
    const d = Math.min(rr / Math.max(0.2, Math.tan(ang / 2)), l1 * 0.92, l2 * 0.92);
    const a = [p1[0] + u1[0] * d, p1[1] + u1[1] * d], b = [p1[0] + u2[0] * d, p1[1] + u2[1] * d];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, m = 1 - t;
      out.push([m * m * a[0] + 2 * m * t * p1[0] + t * t * b[0], m * m * a[1] + 2 * m * t * p1[1] + t * t * b[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function addWall(pts, w, extra) { const b = wallBodies(pts, w, extra); Composite.add(world, b); return b; }
function addTube(pts, iw) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 0.6) continue;
    const ang = Math.atan2(dy, dx), nx = -Math.sin(ang), ny = Math.cos(ang), off = iw / 2 + WALL / 2;
    for (const s of [-1, 1]) {
      out.push(Bodies.rectangle((x1 + x2) / 2 + nx * off * s, (y1 + y2) / 2 + ny * off * s, len + WALL, WALL,
        { isStatic: true, friction: 0.008, frictionStatic: 0.02, restitution: 0.08, angle: ang }));
    }
  }
  Composite.add(world, out); return out;
}

// ---------------------------------------------------------------- level building
function addPiece(p) {
  switch (p.t) {
    case 'wall': addWall(p.pts, p.w || 16); art.push({ k: 'wall', pts: p.pts, w: p.w || 16 }); break;
    case 'tube': { const sp = smooth(p.pts); addTube(sp, p.w || 54); art.push({ k: 'tube', pts: sp, w: p.w || 54 }); break; }
    case 'peg': { Composite.add(world, Bodies.circle(p.x, p.y, p.r, { isStatic: true, restitution: 0.5, friction: 0.02 })); art.push({ k: 'peg', x: p.x, y: p.y, r: p.r }); break; }
    case 'bumper': {
      const b = Bodies.circle(p.x, p.y, p.r, { isStatic: true, restitution: 0.4, friction: 0.01 });
      b.plugin.bump = p.power || 14; Composite.add(world, b);
      art.push({ k: 'bumper', x: p.x, y: p.y, r: p.r, lit: 0 }); b.plugin.art = art[art.length - 1];
      break;
    }
    case 'wheel': {
      const partsW = [];
      for (let i = 0; i < p.blades; i++) {
        const a = i / p.blades * TAU;
        partsW.push(Bodies.rectangle(p.x + Math.cos(a) * p.r * 0.5, p.y + Math.sin(a) * p.r * 0.5, p.r, 16, { angle: a, chamfer: { radius: 4 } }));   // blade tip sits exactly at r
      }
      partsW.push(Bodies.circle(p.x, p.y, 28));
      const body = Body.create({ parts: partsW, friction: 0.08, frictionAir: 0, restitution: 0.05 });
      Body.setMass(body, 120); Body.setInertia(body, 5e5);   // heavy enough to shove the marble, light enough not to launch it
      Composite.add(world, body);
      Composite.add(world, Constraint.create({ bodyA: body, pointB: { x: p.x, y: p.y }, length: 0, stiffness: 1, damping: 0.4 }));
      mechs.push({ k: 'wheel', p, body, update() { Body.setAngularVelocity(body, p.speed); const d = Vector.sub({ x: p.x, y: p.y }, body.position); if (Vector.magnitude(d) > 1) Body.translate(body, d); } });
      art.push({ k: 'wheel', p, body });
      break;
    }
    case 'seesaw': {
      const plank = Bodies.rectangle(p.x, p.y, p.w, 16, { friction: 0.06, restitution: 0.04, density: 0.004, chamfer: { radius: 6 } });
      Composite.add(world, plank);
      Composite.add(world, Constraint.create({ bodyA: plank, pointB: { x: p.x, y: p.y }, length: 0, stiffness: 1, damping: 0.3 }));
      const tilt = p.tilt || 0;
      Body.setAngle(plank, tilt);
      mechs.push({
        k: 'seesaw', p, body: plank, update() {
          // spring back toward the plank's resting tilt, so it always sheds the marble the same way
          const av = plank.angularVelocity * 0.90 - (plank.angle - tilt) * 0.0045;
          Body.setAngularVelocity(plank, clamp(av, -0.06, 0.06));
          const lo = tilt - 0.30, hi = tilt + 0.30;
          if (plank.angle > hi) { Body.setAngle(plank, hi); Body.setAngularVelocity(plank, 0); }
          if (plank.angle < lo) { Body.setAngle(plank, lo); Body.setAngularVelocity(plank, 0); }
          Body.setPosition(plank, { x: p.x, y: p.y });
        }
      });
      art.push({ k: 'seesaw', p, body: plank });
      break;
    }
    case 'flip': {
      const body = Bodies.rectangle(p.x, p.y, p.w, 16, { isStatic: true, friction: 0.02, chamfer: { radius: 6 } });
      Body.setAngle(body, 0.5); Composite.add(world, body);
      const m = {
        k: 'flip', p, body, dir: 1, cool: 0, update() {
          if (this.cool > 0 && --this.cool === 0) { this.dir *= -1; Body.setAngle(body, this.dir * 0.5); }
          for (const mb of marbles) {
            if (mb.prevY < p.y && mb.body.position.y >= p.y && Math.abs(mb.body.position.x - p.x) < p.w * 0.7 && this.cool === 0) this.cool = 24;
          }
        }
      };
      mechs.push(m); art.push({ k: 'flip', p, body });
      break;
    }
    case 'lift': {
      const body = Bodies.rectangle(p.x, p.y, p.w, 18, { isStatic: true, friction: 0.1, chamfer: { radius: 6 } });
      Composite.add(world, body);
      mechs.push({
        k: 'lift', p, body, prev: p.y, update(f) {
          const y = p.y + Math.sin((f / (p.period || 180) + (p.phase || 0)) * TAU) * (p.dy || 120) * 0.5;
          const d = y - body.position.y;
          Body.setPosition(body, { x: p.x, y });
          for (const mb of marbles) {
            const b = mb.body;
            if (Math.abs(b.position.x - p.x) < p.w / 2 + R && b.position.y > y - 60 && b.position.y < y + 4) Body.setPosition(b, { x: b.position.x, y: b.position.y + d });
          }
        }
      });
      art.push({ k: 'lift', p, body });
      break;
    }
    case 'belt': {
      const body = Bodies.rectangle(p.x, p.y, p.w, 18, { isStatic: true, friction: 0.02, chamfer: { radius: 6 } });
      Composite.add(world, body);
      mechs.push({
        k: 'belt', p, body, update() {
          for (const mb of marbles) {
            const b = mb.body;
            if (Math.abs(b.position.x - p.x) < p.w / 2 + R && b.position.y > p.y - 44 && b.position.y < p.y) {
              Body.setVelocity(b, { x: b.velocity.x * 0.72 + p.speed * 0.28 * 3, y: b.velocity.y });
            }
          }
        }
      });
      art.push({ k: 'belt', p, body });
      break;
    }
    case 'gate': {
      const body = Bodies.rectangle(p.x, p.y, p.w, 18, { isStatic: true, friction: 0.05, chamfer: { radius: 6 } });
      Composite.add(world, body);
      mechs.push({
        k: 'gate', p, body, open: false, update(f) {
          const t = ((f / (p.period || 160)) + (p.phase || 0)) % 1;
          this.open = t > 0.5;
          const x = p.x + (this.open ? p.w * 0.98 : 0);
          Body.setPosition(body, { x, y: p.y });
        }
      });
      art.push({ k: 'gate', p, body });
      break;
    }
    case 'domino': {
      const bs = [];
      for (let i = 0; i < p.n; i++) bs.push(Bodies.rectangle(p.x + i * p.gap, p.y - 34, 14, 68, { friction: 0.4, restitution: 0.02, density: 0.003, chamfer: { radius: 2 } }));
      Composite.add(world, bs); art.push({ k: 'domino', bodies: bs });
      const home = bs.map(b => ({ x: b.position.x, y: b.position.y }));
      mechs.push({ k: 'domino', update() {}, reset() { bs.forEach((b, i) => { Body.setPosition(b, home[i]); Body.setAngle(b, 0); Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }); } });
      break;
    }
    case 'launch': zones.push({ kind: 'launch', x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, cool: 0 }); art.push({ k: 'launch', p, fire: 0 }); zones[zones.length - 1].art = art[art.length - 1]; break;
    case 'fan': zones.push({ kind: 'fan', x: p.x, y: p.y, w: p.w, h: p.h, force: p.force }); art.push({ k: 'fan', p }); break;
    case 'water': zones.push({ kind: 'water', x: p.x, y: p.y, w: p.w, h: p.h }); art.push({ k: 'water', p }); break;
    case 'warp': zones.push({ kind: 'warp', x: p.x, y: p.y, w: 70, h: 70, tx: p.tx, ty: p.ty, cool: 0 }); art.push({ k: 'warp', p }); break;
    case 'bell': zones.push({ kind: 'bell', x: p.x, y: p.y, r: 30, n: p.n || 0, cool: 0, art: null }); art.push({ k: 'bell', x: p.x, y: p.y, n: p.n || 0, lit: 0 }); zones[zones.length - 1].art = art[art.length - 1]; break;
    case 'star': st.starTotal++; zones.push({ kind: 'star', x: p.x, y: p.y, r: 30, got: false, art: null }); art.push({ k: 'star', x: p.x, y: p.y, got: false }); zones[zones.length - 1].art = art[art.length - 1]; break;
    case 'goal': {
      const w = p.w, x = p.x, y = p.y;
      addWall([[x - w / 2, y - 100], [x - w / 2, y + 46]], 16);
      addWall([[x + w / 2, y - 100], [x + w / 2, y + 46]], 16);
      addWall([[x - w / 2 - 10, y + 46], [x + w / 2 + 10, y + 46]], 16);
      zones.push({ kind: 'goal', x, y: y + 6, w: w - 16, h: 90 });
      art.push({ k: 'goal', x, y, w });
      break;
    }
    case 'coin': {
      st.coinTotal++;
      zones.push({ kind: 'coin', x: p.x, y: p.y, r: 27, got: false, n: p.n || 0, art: null });
      art.push({ k: 'coin', x: p.x, y: p.y, got: false, n: p.n || 0 });
      zones[zones.length - 1].art = art[art.length - 1];
      break;
    }
    case 'sign': art.push({ k: 'sign', x: p.x, y: p.y, s: p.s }); break;
  }
}

function buildLevel(i) {
  lvIdx = i; LV = MM_LEVELS[i];
  Composite.clear(world, false);
  mechs = []; art = []; zones = []; marbles = []; parts = [];
  st = { delivered: 0, left: LV.marbles, stars: 0, starTotal: 0, coins: 0, coinTotal: 0, frames: 0, done: false, nudges: 0 };
  addWall([[-34, -600], [-34, LV.h + 60]], 64);
  addWall([[LV.w + 34, -600], [LV.w + 34, LV.h + 60]], 64);
  addWall([[-80, LV.h + 34], [LV.w + 80, LV.h + 34]], 64);
  for (const p of LV.pieces) addPiece(p);
  const coinList = (typeof MM_COINS !== 'undefined' && MM_COINS[LV.id]) || [];
  coinList.forEach((c, i) => addPiece({ t: 'coin', x: c[0], y: c[1], n: i }));
  cam.x = camTarget.x = LV.start.x; cam.y = camTarget.y = LV.start.y + 150;
  cam.z = camTarget.z = followZoom(); viewAll = false;
  follow = null;
  syncHud();
}

// ---------------------------------------------------------------- marbles
function spawn() {
  if (st.left <= 0) return null;
  st.left--;
  for (const m of mechs) if (m.reset) m.reset();   // re-arm the machine for the next marble
  const skin = MARBLE_SKINS[(LV.marbles - st.left - 1) % MARBLE_SKINS.length];
  const body = Bodies.circle(LV.start.x, LV.start.y, R, {
    restitution: 0.26, friction: 0.004, frictionStatic: 0.006, frictionAir: 0.002, density: 0.006, slop: 0.02,
  });
  body.plugin.marble = true;
  Composite.add(world, body);
  const m = { body, skin, trail: [], stuck: 0, nudges: 0, prevY: body.position.y, dead: false, hopCool: 0 };
  marbles.push(m); follow = m;
  A.drop(); syncHud();
  return m;
}
function kill(m, why) {
  if (m.dead) return; m.dead = true;
  const i = marbles.indexOf(m); if (i >= 0) marbles.splice(i, 1);
  Composite.remove(world, m.body);
  if (follow === m) follow = marbles[marbles.length - 1] || null;
  if (why === 'goal') {
    st.delivered++; burst(m.body.position.x, m.body.position.y, '#ffd27f', 26); A.goal();
    if (st.delivered >= LV.need) finish(true);
  } else {
    burst(m.body.position.x, m.body.position.y, '#6a7fb5', 12); A.pop();
    if (!st.done && st.left <= 0 && marbles.length === 0 && st.delivered < LV.need) finish(false);
  }
  syncHud();
}
function burst(x, y, c, n) { for (let k = 0; k < n; k++) { const a = rand(0, TAU), s = rand(1.5, 5.5); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: rand(18, 40), c, s: rand(2, 5) }); } }

// ---------------------------------------------------------------- zones
function checkZones(m) {
  const b = m.body, p = b.position;
  for (const z of zones) {
    if (z.cool > 0) z.cool--;
    if (z.kind === 'coin') {
      if (z.got || Math.hypot(p.x - z.x, p.y - z.y) > z.r) continue;
      z.got = true; z.art.got = true; st.coins++;
      A.coin(z.n); burst(z.x, z.y, '#ffd24a', 10); syncHud();
      continue;
    }
    if (z.kind === 'star' || z.kind === 'bell') {
      if (Math.hypot(p.x - z.x, p.y - z.y) > z.r) continue;
      if (z.kind === 'star') { if (!z.got) { z.got = true; z.art.got = true; st.stars++; A.star(); burst(z.x, z.y, '#ffd27f', 18); syncHud(); } }
      else if (z.cool === 0) { z.cool = 20; z.art.lit = 14; A.bell(z.n); burst(z.x, z.y, '#9fe0ff', 6); }
      continue;
    }
    const inside = Math.abs(p.x - z.x) < z.w / 2 && Math.abs(p.y - z.y) < z.h / 2;
    if (!inside) continue;
    if (z.kind === 'goal') { kill(m, 'goal'); return; }
    if (z.kind === 'launch' && z.cool === 0) { z.cool = 12; Body.setVelocity(b, { x: z.vx, y: z.vy }); z.art.fire = 12; A.whoosh(); }
    if (z.kind === 'fan') { Body.applyForce(b, p, { x: Math.sin(st.frames * 0.05) * 0.00004, y: -z.force }); if (st.frames % 4 === 0) parts.push({ x: p.x + rand(-20, 20), y: p.y + 20, vx: 0, vy: -6, life: 20, c: 'rgba(180,220,255,.5)', s: 2 }); }
    if (z.kind === 'water') {
      const sub = clamp((p.y + R - (z.y - z.h / 2)) / (R * 2), 0, 1);
      Body.applyForce(b, p, { x: 0, y: -engine.gravity.y * engine.gravity.scale * b.mass * 0.5 * sub });
      Body.setVelocity(b, { x: b.velocity.x * 0.965, y: b.velocity.y * 0.93 });
      if (!m.wet) { m.wet = true; A.splash(); burst(p.x, z.y - z.h / 2, '#7fd2ff', 14); }
      if (st.frames % 6 === 0) parts.push({ x: p.x + rand(-8, 8), y: p.y, vx: 0, vy: -1.4, life: 30, c: 'rgba(200,240,255,.7)', s: rand(1.5, 3), bub: true });
    }
    if (z.kind === 'warp' && z.cool === 0) {
      z.cool = 30; Body.setPosition(b, { x: z.tx, y: z.ty });
      Body.setVelocity(b, { x: 0, y: 3 });   // the pipe sets it down gently instead of flinging it onward
      burst(z.x, z.y, '#c9a3ff', 16); burst(z.tx, z.ty, '#c9a3ff', 16); A.warp();
    }
  }
}

// ---------------------------------------------------------------- collisions (clicks + bumpers)
Events.on(engine, 'collisionStart', ev => {
  for (const { bodyA, bodyB } of ev.pairs) {
    const m = bodyA.plugin.marble ? bodyA : bodyB.plugin.marble ? bodyB : null;
    if (!m) continue;
    const other = m === bodyA ? bodyB : bodyA;
    const v = Vector.magnitude(Vector.sub(m.velocity, other.velocity));
    if (v > 1.6) A.click(v);
    const parent = other.parent && other.parent !== other ? other.parent : other;
    const power = other.plugin.bump || parent.plugin.bump;
    if (power) {
      const dir = Vector.normalise(Vector.sub(m.position, other.position));
      Body.setVelocity(m, Vector.mult(dir, power));
      const a = other.plugin.art || parent.plugin.art; if (a) a.lit = 12;
      A.thunk(); burst(m.position.x, m.position.y, '#ffb0c8', 8);
    }
  }
});

// ---------------------------------------------------------------- simulation step
function step() {
  for (const m of mechs) m.update(st.frames);
  Engine.update(engine, 1000 / 60);
  st.frames++;
  if (tug && tug.m && !tug.m.dead) {
    const b = tug.m.body, d = Vector.sub(tug.w, b.position), len = Vector.magnitude(d);
    if (len > 4) Body.applyForce(b, b.position, Vector.mult(Vector.normalise(d), Math.min(len, 260) / 260 * 0.0014 * b.mass));
    if (st.frames % 3 === 0) parts.push({ x: b.position.x + rand(-10, 10), y: b.position.y + rand(-10, 10), vx: 0, vy: 0, life: 12, c: 'rgba(160,220,255,.9)', s: 2 });
  } else if (tug) tug = null;
  for (const m of [...marbles]) {
    const b = m.body, v = Math.hypot(b.velocity.x, b.velocity.y);
    if (m.hopCool > 0) m.hopCool--;
    if (v > CAP) Body.setVelocity(b, { x: b.velocity.x / v * CAP, y: b.velocity.y / v * CAP });
    m.trail.push(b.position.x, b.position.y); if (m.trail.length > 44) m.trail.splice(0, 2);
    if (v < 0.5) {
      if (++m.stuck > 150) {
        m.stuck = 0; m.nudges++; st.nudges++;
        Body.setVelocity(b, { x: rand(-5, 5), y: -6 });
        if (m.nudges > 5) { kill(m, 'fizz'); continue; }
      }
    } else m.stuck = 0;
    if (b.position.y > LV.h + 160 || b.position.x < -120 || b.position.x > LV.w + 120) { kill(m, 'lost'); continue; }
    checkZones(m);
    m.prevY = b.position.y;
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.x += p.vx; p.y += p.vy; if (!p.bub) p.vy += 0.22; p.life--;
    if (p.life <= 0) parts.splice(i, 1);
  }
  for (const a of art) { if (a.lit > 0) a.lit--; if (a.fire > 0) a.fire--; }
}

function finish(won) {
  if (st.done) return; st.done = true;
  const id = LV.id;
  if (silent) return;
  if (won) {
    save.coins[id] = Math.max(save.coins[id] || 0, st.coins);
    const secs = +(st.frames / 60).toFixed(1);
    if (!save.best) save.best = {};
    save.best[id] = save.best[id] ? Math.min(save.best[id], secs) : secs;
    if (lvIdx + 1 >= save.unlocked) save.unlocked = Math.min(MM_LEVELS.length, lvIdx + 2);
    persist();
    setTimeout(() => A.win(), 350);
  } else setTimeout(() => A.fail(), 200);
  setTimeout(() => {
    $('overT').textContent = won ? 'Machine complete!' : 'Out of marbles';
    $('overS').textContent = won ? `🪙 ${st.coins} / ${st.coinTotal}` : '🪙 ' + st.coins;
    $('overP').textContent = won
      ? `${st.delivered} home · ${(st.frames / 60).toFixed(1)}s · best ${save.coins[LV.id] || 0} coins, ${(save.best && save.best[LV.id]) || '—'}s`
      : `You collected ${st.coins} coins but nothing reached the bucket.`;
    $('btnNext').style.display = won && lvIdx + 1 < MM_LEVELS.length ? '' : 'none';
    $('over').classList.add('on');
  }, won ? 900 : 500);
}

// ---------------------------------------------------------------- camera
function followZoom() { return clamp(Math.min(VW / 780, VH / 620), 0.42, 2.0); }
function fitZoom() { return clamp(Math.min(VW / (LV.w + 90), VH / 1400), 0.22, 1); }   // pull back, not the whole 20,000px
function updateCam() {
  if (viewAll) { camTarget.x = LV.w / 2; camTarget.y = LV.h / 2; camTarget.z = fitZoom(); }
  else {
    camTarget.z = followZoom();
    const t = follow && !follow.dead ? follow.body : null;
    if (t) { camTarget.x = t.position.x + t.velocity.x * 3; camTarget.y = t.position.y + t.velocity.y * 3 + 40; }
    else { camTarget.x = LV.start.x; camTarget.y = LV.start.y + 160; }
    const hw = VW / (2 * camTarget.z), hh = VH / (2 * camTarget.z);
    camTarget.x = LV.w < hw * 2 ? LV.w / 2 : clamp(camTarget.x, hw - 40, LV.w - hw + 40);
    camTarget.y = LV.h < hh * 2 ? LV.h / 2 : clamp(camTarget.y, hh - 60, LV.h - hh + 60);
  }
  const k = viewAll ? 0.12 : 0.14;
  cam.x += (camTarget.x - cam.x) * k; cam.y += (camTarget.y - cam.y) * k; cam.z += (camTarget.z - cam.z) * 0.1;
}

// ---------------------------------------------------------------- drawing
function applyCam() { ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (VW / 2 - cam.x * cam.z), DPR * (VH / 2 - cam.y * cam.z)); }
function strokePath(pts, w, color, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke();
}
function draw(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#16203a'); g.addColorStop(1, '#0c1120');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  applyCam();
  // back board with rivets
  ctx.fillStyle = '#121a30'; ctx.fillRect(-20, -40, LV.w + 40, LV.h + 80);
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 2 / cam.z;
  for (let x = 0; x <= LV.w; x += 100) { ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, LV.h + 40); ctx.stroke(); }
  for (let y = 0; y <= LV.h; y += 100) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(LV.w + 20, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let x = 50; x < LV.w; x += 200) for (let y = 50; y < LV.h; y += 200) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }

  // --- back layer
  for (const a of art) {
    if (a.k === 'tube') { strokePath(a.pts, a.w + WALL * 2, '#26365e'); strokePath(a.pts, a.w + WALL * 2 - 6, '#1a2748'); strokePath(a.pts, a.w, '#0e1730'); }
    else if (a.k === 'water') { ctx.fillStyle = 'rgba(60,150,255,.30)'; ctx.fillRect(a.p.x - a.p.w / 2, a.p.y - a.p.h / 2, a.p.w, a.p.h); }
    else if (a.k === 'goal') {
      ctx.fillStyle = '#1d2c50'; ctx.fillRect(a.x - a.w / 2, a.y - 60, a.w, 110);
      ctx.fillStyle = 'rgba(94,224,138,.16)'; ctx.fillRect(a.x - a.w / 2 + 8, a.y - 54, a.w - 16, 100);
      ctx.fillStyle = '#5ee08a'; ctx.font = `bold 26px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.fillText('🎯', a.x, a.y - 66);
    }
  }
  // --- walls and posts
  for (const a of art) {
    if (a.k === 'wall') { strokePath(a.pts, a.w + 6, '#3a2a18'); strokePath(a.pts, a.w, '#c98a4b'); strokePath(a.pts, Math.max(2, a.w - 9), 'rgba(255,220,170,.35)'); }
    else if (a.k === 'peg') { ctx.fillStyle = '#8fa4d6'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(a.x - a.r * .3, a.y - a.r * .3, a.r * .38, 0, TAU); ctx.fill(); }
    else if (a.k === 'bumper') {
      const lit = a.lit > 0; ctx.fillStyle = lit ? '#fff' : '#ff6b8b'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffd27f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(a.x, a.y, a.r - 7, 0, TAU); ctx.stroke();
    }
    else if (a.k === 'sign') { ctx.fillStyle = 'rgba(180,200,240,.5)'; ctx.font = `600 22px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.fillText(a.s, a.x, a.y); }
  }
  // --- mechanisms
  for (const a of art) {
    if (a.k === 'wheel') {
      const b = a.body, p = a.p;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.angle);
      ctx.strokeStyle = '#ffc861'; ctx.lineWidth = 15; ctx.lineCap = 'round';
      for (let i = 0; i < p.blades; i++) { const ang = i / p.blades * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 22, Math.sin(ang) * 22); ctx.lineTo(Math.cos(ang) * p.r, Math.sin(ang) * p.r); ctx.stroke(); }
      ctx.fillStyle = '#7a5a20'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.restore();
    }
    else if (a.k === 'seesaw' || a.k === 'flip' || a.k === 'lift' || a.k === 'gate' || a.k === 'belt') {
      const b = a.body, p = a.p, w = p.w, h = 18;
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      ctx.fillStyle = a.k === 'belt' ? '#2f3d63' : a.k === 'gate' ? '#ff6b8b' : '#c98a4b';
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-w / 2 + 4, -h / 2 + 2, w - 8, 3);
      if (a.k === 'belt') { ctx.strokeStyle = '#9fb6ea'; ctx.lineWidth = 3; const off = (st.frames * p.speed * 0.8) % 24; for (let x = -w / 2 + off; x < w / 2; x += 24) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + 3); ctx.lineTo(x + 8, h / 2 - 3); ctx.stroke(); } }
      if (a.k === 'seesaw' || a.k === 'flip') { ctx.fillStyle = '#7a5a20'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); }
      ctx.restore();
      if (a.k === 'seesaw' || a.k === 'flip') { ctx.fillStyle = '#6b7ba8'; ctx.beginPath(); ctx.moveTo(p.x, p.y + 6); ctx.lineTo(p.x - 18, p.y + 44); ctx.lineTo(p.x + 18, p.y + 44); ctx.closePath(); ctx.fill(); }
    }
    else if (a.k === 'domino') { for (const b of a.bodies) { ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle); ctx.fillStyle = '#e8eefc'; ctx.beginPath(); ctx.roundRect(-7, -34, 14, 68, 3); ctx.fill(); ctx.fillStyle = '#2b3a63'; ctx.beginPath(); ctx.arc(0, -16, 3, 0, TAU); ctx.arc(0, 16, 3, 0, TAU); ctx.fill(); ctx.restore(); } }
    else if (a.k === 'launch') {
      const p = a.p; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#5b6bb5'; ctx.beginPath(); ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 10); ctx.fill();
      ctx.fillStyle = a.fire > 0 ? '#fff' : '#ffc861'; ctx.beginPath(); ctx.roundRect(p.w / 2 - 14, -p.h / 2 + 6, 10, p.h - 12, 4); ctx.fill();
      ctx.restore();
    }
    else if (a.k === 'fan') { const p = a.p; ctx.fillStyle = 'rgba(140,200,255,.08)'; ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); ctx.save(); ctx.translate(p.x, p.y + p.h / 2 + 14); ctx.rotate(st.frames * 0.3); ctx.strokeStyle = '#9fb6ea'; ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke(); } ctx.restore(); }
    else if (a.k === 'warp') { const p = a.p; for (const [x, y, c] of [[p.x, p.y, '#c9a3ff'], [p.tx, p.ty, '#8fe7ff']]) { ctx.save(); ctx.translate(x, y); ctx.rotate(st.frames * 0.04); ctx.strokeStyle = c; ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 14 + i * 9, i * 1.2, i * 1.2 + 4); ctx.stroke(); } ctx.restore(); } }
  }
  // --- coins
  for (const a of art) {
    if (a.k !== 'coin' || a.got) continue;
    const wob = Math.cos(t / 320 + a.n) * 0.5 + 0.5;
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(0.35 + 0.65 * wob, 1);
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8951b'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe9a6'; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // --- bells and stars
  for (const a of art) {
    if (a.k === 'bell') {
      ctx.save(); ctx.translate(a.x, a.y + (a.lit > 0 ? Math.sin(a.lit) * 3 : 0));
      ctx.fillStyle = a.lit > 0 ? '#fff6d0' : '#ffc861';
      ctx.beginPath(); ctx.arc(0, 0, 17, Math.PI, 0); ctx.lineTo(19, 10); ctx.lineTo(-19, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a5a20'; ctx.beginPath(); ctx.arc(0, 13, 5, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (a.k === 'star' && !a.got) {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.sin(t / 700) * 0.3); ctx.scale(1 + Math.sin(t / 400) * 0.06, 1 + Math.sin(t / 400) * 0.06);
      ctx.fillStyle = '#ffd27f'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? 9 : 21; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a06a10'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
  }
  // --- marbles
  for (const m of marbles) {
    const b = m.body;
    if (m.trail.length > 4) { ctx.strokeStyle = m.skin[0] + '55'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.trail[0], m.trail[1]); for (let i = 2; i < m.trail.length; i += 2) ctx.lineTo(m.trail[i], m.trail[i + 1]); ctx.stroke(); }
    const gr = ctx.createRadialGradient(b.position.x - 4, b.position.y - 5, 1, b.position.x, b.position.y, R);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, m.skin[0]); gr.addColorStop(1, m.skin[1]);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(b.position.x - 4, b.position.y - 5, 3, 0, TAU); ctx.fill();
  }
  // --- glass fronts
  for (const a of art) {
    if (a.k === 'tube') { strokePath(a.pts, a.w, 'rgba(150,210,255,.10)'); strokePath(a.pts, Math.max(2, a.w * 0.22), 'rgba(220,245,255,.10)'); }
    else if (a.k === 'water') { const p = a.p; ctx.fillStyle = 'rgba(80,170,255,.18)'; ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); ctx.strokeStyle = 'rgba(210,240,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = p.x - p.w / 2; x <= p.x + p.w / 2; x += 8) { const y = p.y - p.h / 2 + Math.sin(x * 0.06 + t / 260) * 3; x === p.x - p.w / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  }
  // --- particles
  for (const p of parts) { ctx.globalAlpha = clamp(p.life / 18, 0, 1); ctx.fillStyle = p.c; if (p.bub) { ctx.strokeStyle = p.c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); } }
  ctx.globalAlpha = 1;
  if (tug && tug.m && !tug.m.dead) {
    const b = tug.m.body;
    ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.lineWidth = 3; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(b.position.x, b.position.y); ctx.lineTo(tug.w.x, tug.w.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(160,220,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tug.w.x, tug.w.y, 14, 0, TAU); ctx.stroke();
  }
  // --- start marker
  if (!marbles.length && !st.done) { ctx.strokeStyle = 'rgba(255,200,97,.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(LV.start.x, LV.start.y, 22 + Math.sin(t / 300) * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ---------------------------------------------------------------- loop
let acc = 0, last = performance.now();
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(48, now - last); last = now;
  if (started && LV) {
    acc += dt * speedMul;
    let n = 0;
    while (acc >= 1000 / 60 && n < 9) { step(); acc -= 1000 / 60; n++; }
    if (n === 9) acc = 0;
    updateCam();
    draw(now);
    $('pTime').textContent = (st.frames / 60).toFixed(1) + 's';
  }
}

// ---------------------------------------------------------------- UI
function syncHud() {
  if (!LV) return;
  $('pName').textContent = `${LV.icon} ${LV.name}`;
  $('pGoal').textContent = `🎯 ${st.delivered}/${LV.need}`;
  $('pMarbles').textContent = `⚪ ${st.left}`;
  $('pStars').textContent = `🪙 ${st.coins}/${st.coinTotal}`;
  $('drop').disabled = st.left <= 0 || st.done;
}
function resize() {
  const r = $('stage').getBoundingClientRect();
  DPR = Math.min(2, devicePixelRatio || 1);
  VW = Math.floor(r.width); VH = Math.floor(r.height);
  canvas.width = VW * DPR; canvas.height = VH * DPR;
}
window.addEventListener('resize', () => { resize(); if (LV) { camTarget.z = viewAll ? fitZoom() : followZoom(); } });

function playLevel(i) {
  buildLevel(i);
  $('menu').classList.remove('on'); $('play').classList.add('on');
  $('over').classList.remove('on');
  resize(); cam.z = camTarget.z = followZoom();
  $('hint').textContent = (LV.hint || '') + '  ·  tap the marble to hop and boost, hold to tug it';
  $('hint').style.display = '';
  syncHud();
}
function buildMenu() {
  const wrap = $('cards'); wrap.innerHTML = '';
  let total = 0; for (const k in save.coins) total += save.coins[k];
  $('totStars').textContent = `🪙 ${total}`;
  MM_LEVELS.forEach((lv, i) => {
    const locked = i >= save.unlocked;
    const card = document.createElement('button'); card.className = 'card' + (locked ? ' locked' : '');
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 220;
    card.appendChild(cv);
    const row = document.createElement('div'); row.className = 'row';
    const got = save.coins[lv.id] || 0;
    const coinsHere = ((typeof MM_COINS !== 'undefined' && MM_COINS[lv.id]) || []).length || 100;
    row.innerHTML = `<span class="no">${i + 1}</span><span class="nm">${lv.icon} ${lv.name}</span><span class="st">🪙 ${got}/${coinsHere}</span>`;
    card.appendChild(row);
    card.addEventListener('click', () => { if (locked) return; A.unlock(); started = true; $('tap').classList.add('hide'); playLevel(i); });
    wrap.appendChild(card);
    drawPreview(cv, lv);
  });
}
function drawPreview(cv, lv) {
  const c = cv.getContext('2d'), pad = 8;
  // a 20,000px course is a sliver upright, so the card shows it running left to right
  const s = Math.min((cv.height - pad * 2) / lv.w, (cv.width - pad * 2) / lv.h);
  c.fillStyle = '#0b1120'; c.fillRect(0, 0, cv.width, cv.height);
  c.save(); c.translate((cv.width - lv.h * s) / 2, (cv.height + lv.w * s) / 2); c.rotate(-Math.PI / 2); c.scale(s, s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const p of lv.pieces) {
    if (p.t === 'tube' || p.t === 'wall') {
      c.beginPath(); c.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i++) c.lineTo(p.pts[i][0], p.pts[i][1]);
      c.lineWidth = p.t === 'tube' ? (p.w || 54) : (p.w || 16) * 1.6;
      c.strokeStyle = p.t === 'tube' ? '#3f5fa8' : '#c98a4b'; c.stroke();
    } else if (p.t === 'goal') { c.fillStyle = '#5ee08a'; c.fillRect(p.x - p.w / 2, p.y - 40, p.w, 90); }
    else if (p.t === 'wheel') { c.strokeStyle = '#ffc861'; c.lineWidth = 14; c.beginPath(); c.arc(p.x, p.y, p.r * 0.7, 0, TAU); c.stroke(); }
    else if (p.t === 'star') { c.fillStyle = '#ffd27f'; c.beginPath(); c.arc(p.x, p.y, 22, 0, TAU); c.fill(); }
    else if (p.t === 'water') { c.fillStyle = 'rgba(80,170,255,.5)'; c.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); }
    else if (p.t === 'peg' || p.t === 'bumper') { c.fillStyle = p.t === 'bumper' ? '#ff6b8b' : '#8fa4d6'; c.beginPath(); c.arc(p.x, p.y, (p.r || 16) * 1.4, 0, TAU); c.fill(); }
    else if (p.t === 'seesaw' || p.t === 'belt' || p.t === 'flip') { c.strokeStyle = '#c98a4b'; c.lineWidth = 22; c.beginPath(); c.moveTo(p.x - p.w / 2, p.y); c.lineTo(p.x + p.w / 2, p.y); c.stroke(); }
  }
  c.restore();
}

$('drop').addEventListener('click', () => { A.unlock(); if (st.done) return; spawn(); });
$('btnBack').addEventListener('click', () => { $('play').classList.remove('on'); $('menu').classList.add('on'); buildMenu(); });
$('btnMenu2').addEventListener('click', () => { $('over').classList.remove('on'); $('play').classList.remove('on'); $('menu').classList.add('on'); buildMenu(); });
$('btnRetry').addEventListener('click', () => { playLevel(lvIdx); });
$('btnAgain2').addEventListener('click', () => { playLevel(lvIdx); });
$('btnNext').addEventListener('click', () => { playLevel(Math.min(MM_LEVELS.length - 1, lvIdx + 1)); });
$('btnView').addEventListener('click', () => { viewAll = !viewAll; $('btnView').classList.toggle('on', viewAll); });
const SPEEDS = [1, 2, 4, 0.4];
$('btnSpeed').addEventListener('click', () => {
  speedMul = SPEEDS[(SPEEDS.indexOf(speedMul) + 1) % SPEEDS.length];
  $('btnSpeed').textContent = speedMul === 0.4 ? '½×' : speedMul + '×';
  $('btnSpeed').classList.toggle('on', speedMul !== 1);
});
$('btnSound').addEventListener('click', () => { save.muted = !save.muted; persist(); $('btnSound').textContent = save.muted ? '🔇' : '🔊'; });
$('tap').addEventListener('click', () => { A.unlock(); started = true; $('tap').classList.add('hide'); if (document.fullscreenEnabled && matchMedia('(pointer:coarse)').matches) document.documentElement.requestFullscreen?.().catch(() => {}); });
// tap a marble to make it hop, hold to tug it along — enough to steer a run, not enough to fly
let tug = null;
function toWorld(ev) { const r = canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left - VW / 2) / cam.z + cam.x, y: (ev.clientY - r.top - VH / 2) / cam.z + cam.y }; }
function nearestMarble(w, reach) {
  let best = null, bd = reach;
  for (const m of marbles) { const d = Math.hypot(w.x - m.body.position.x, w.y - m.body.position.y); if (d < bd) { bd = d; best = m; } }
  return best;
}
function hop(m, w) {
  if (m.hopCool > 0) return;
  m.hopCool = 20;                       // about 0.4s — enough to steer, not enough to fly the course
  const b = m.body;
  const aim = clamp((w.x - b.position.x) / 70, -1, 1);
  const sp = Math.hypot(b.velocity.x, b.velocity.y);
  const boost = sp > 1 ? 1.22 : 1;                    // a tap also shoves it along, so you can hurry a run
  Body.setVelocity(b, { x: clamp(b.velocity.x * boost + aim * 4.5, -CAP, CAP), y: Math.min(b.velocity.y * boost, 0) - 8 });
  for (let k = 0; k < 10; k++) parts.push({ x: b.position.x, y: b.position.y + 8, vx: rand(-2.5, 2.5), vy: rand(0.5, 3), life: 16, c: '#bfe6ff', s: rand(2, 4) });
  A.hop();
}
canvas.addEventListener('pointerdown', ev => {
  A.unlock(); if (!LV) return;
  const w = toWorld(ev);
  const m = nearestMarble(w, 110);
  if (m) { follow = m; hop(m, w); tug = { m, w, id: ev.pointerId }; try { canvas.setPointerCapture(ev.pointerId); } catch (e) {} return; }
  if (Math.hypot(w.x - LV.start.x, w.y - LV.start.y) < 120 && !st.done) spawn();
});
canvas.addEventListener('pointermove', ev => { if (tug && ev.pointerId === tug.id) tug.w = toWorld(ev); });
const endTug = ev => { if (tug && (!ev || ev.pointerId === tug.id)) tug = null; };
canvas.addEventListener('pointerup', endTug); canvas.addEventListener('pointercancel', endTug); canvas.addEventListener('lostpointercapture', endTug);
window.addEventListener('keydown', ev => {
  if (ev.key === ' ') { ev.preventDefault(); $('drop').click(); }
  else if (ev.key.toLowerCase() === 'r') $('btnRetry').click();
  else if (ev.key.toLowerCase() === 'v') $('btnView').click();
  else if (ev.key.toLowerCase() === 's') $('btnSpeed').click();
  else if (ev.key === 'Escape') $('btnBack').click();
});

// ---------------------------------------------------------------- test harness
window.__mm = {
  get st() { return st; }, get world() { return world; }, get M() { return Matter; }, get marbles() { return marbles; }, get cam() { return cam; }, get lv() { return LV; },
  play: playLevel, levels: MM_LEVELS, drawOnce(t) { draw(t || 0); },
  step() { step(); }, spawn() { return spawn(); },
  hop(i, dx) { const m = marbles[i || 0]; if (m) hop(m, { x: m.body.position.x + (dx || 0), y: m.body.position.y }); return !!m; },
  get zones() { return zones; }, get tug() { return tug; }, setTug(i, x, y) { const m = marbles[i || 0]; tug = m ? { m, w: { x, y }, id: 1 } : null; }, get silent() { return silent; }, set silent(v) { silent = v; },
  sim(i, maxSec = 90) {
    const wasSilent = silent; silent = true;
    buildLevel(i);
    const m = spawn();
    const maxF = Math.round(maxSec * 60);
    let f = 0;
    while (f < maxF && st.delivered < 1 && !st.done) { step(); f++; }
    const res = {
      n: i + 1, name: LV.name, ok: st.delivered > 0, sec: +(f / 60).toFixed(1),
      stars: st.stars + '/' + st.starTotal, nudges: st.nudges,
      end: m && !m.dead ? [Math.round(m.body.position.x), Math.round(m.body.position.y)] : (m && m.dead ? 'gone' : 'none'),
    };
    silent = wasSilent; return res;
  },
  simAll(maxSec = 90) { return MM_LEVELS.map((_, i) => this.sim(i, maxSec)); },
  // play a level for real: keep feeding marbles until it is won or they run out
  simFull(i, maxSec = 240) {
    const wasSilent = silent; silent = true;
    buildLevel(i);
    let f = 0; const maxF = Math.round(maxSec * 60);
    while (f < maxF && !st.done) {
      if (marbles.length === 0) { if (st.left <= 0) break; spawn(); }
      step(); f++;
    }
    const res = { n: i + 1, name: LV.name, won: st.delivered >= LV.need, got: st.delivered + '/' + LV.need,
      used: LV.marbles - st.left + '/' + LV.marbles, coins: st.coins + '/' + st.coinTotal, sec: +(f / 60).toFixed(1), nudges: st.nudges };
    silent = wasSilent; return res;
  },
  // frame-by-frame path of one marble — used to design and debug the courses
  trace(i, sec = 30, every = 20) {
    const wasSilent = silent; silent = true;
    buildLevel(i); const m = spawn(); const out = [];
    for (let f = 0; f < sec * 60 && st.delivered < 1; f++) {
      step();
      if (f % every === 0) out.push([f, Math.round(m.body.position.x), Math.round(m.body.position.y), +Math.hypot(m.body.velocity.x, m.body.velocity.y).toFixed(1)]);
      if (m.dead) { out.push([f, 'dead']); break; }
    }
    silent = wasSilent; return out;
  },
};

// ---------------------------------------------------------------- boot
resize();
$('btnSound').textContent = save.muted ? '🔇' : '🔊';
buildLevel(0); buildMenu();
raf = requestAnimationFrame(frame);
})();
