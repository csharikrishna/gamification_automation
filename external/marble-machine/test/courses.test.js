#!/usr/bin/env node
// Plays every course headlessly: loads the real game files into a Node vm behind a stubbed DOM
// and a no-op canvas context, then calls window.__mm.simFull(i) and checks each course is won.
// Usage: node test/courses.test.js [courseIndex ...]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const noop = () => {};
// Any property of a stub is either a function that returns another stub, or settable.
function stub() {
  const fn = function () { return stub(); };
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k in t) return t[k];
      if (k === 'getContext') return () => ctx;
      if (k === 'classList') return { add: noop, remove: noop, toggle: noop, contains: () => false };
      if (k === 'style') return (t.style = {});
      if (k === 'measureText') return () => ({ width: 10 });
      return (t[k] = stub());
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const ctx = stub();
const elements = {};
const document = {
  getElementById: id => (elements[id] = elements[id] || stub()),
  createElement: () => stub(),
  documentElement: stub(),
  fullscreenEnabled: false,
  addEventListener: noop,
};
const store = {};
const window = {
  innerWidth: 900, innerHeight: 700, devicePixelRatio: 1,
  addEventListener: noop,
};
const sandbox = {
  window, document, console, Math, JSON, Date,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  setTimeout, clearTimeout, performance: { now: () => Date.now() },
  navigator: { userAgent: 'node' },
  innerWidth: 900, innerHeight: 700, devicePixelRatio: 1,
};
sandbox.self = sandbox.globalThis = window.window = sandbox;
Object.assign(window, sandbox);
const context = vm.createContext(sandbox);
for (const f of ['vendor/matter.min.js', 'levels.js', 'coins.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });
}
const mm = vm.runInContext('window.__mm', context);
const which = process.argv.slice(2).map(Number);
const idx = which.length ? which : mm.levels.map((_, i) => i);
let failed = 0;
for (const i of idx) {
  const t0 = Date.now();
  const r = mm.simFull(i, 600);
  const ok = r.won;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.n}. ${r.name.padEnd(18)} marbles ${r.got}  coins ${r.coins}  ${r.sec}s game time  (${Date.now() - t0} ms)`);
}
console.log(failed ? `${failed} course(s) not finished` : 'all courses finished');
process.exit(failed ? 1 : 0);
