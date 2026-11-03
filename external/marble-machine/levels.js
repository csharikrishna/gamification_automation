/* Marble Machine — long courses built from proven modules.

   Every module is a section that was play-tested on its own. A module declares the x it must be
   fed at and the x it hands the marble off at; the course builder drops a full-width catch funnel
   between each pair, so any module can follow any other.

   Rules the physics tests taught us, worth keeping when editing a module:
     · One tube piece per continuous run. Two tubes meeting head-on wall each other off, and a tube
       path that crosses itself does the same.
     · A ramp's high end is buried in the side wall; its low end stops short so the marble has a gap
       to fall through. The next catch has to reach under that gap.
     · Ramps and tube runs want 12 degrees of slope or more, or the marble creeps to a halt.
     · Tube corners are filleted automatically, but a fillet under ~47px pinches a 54px tube shut,
       so a near-90 degree bend needs both legs over ~100px.
     · A bladed wheel carries the marble all the way round and sets it down at the BOTTOM. Keep the
       feed ramp's end outside the blade circle or the blades bat the marble back up it.
     · Bumpers belong inside a pin field. One against a wall bounces the marble in the corner forever.
· A 2D corkscrew does not work: at the left and right extremes of the ellipse the path turns
     almost on the spot, so the tube's inner wall inverts and seals the channel. The switchback
     tube gives the same coiled look and actually passes a marble.
*/
const MM_LEVELS = (() => {
  const TAU = Math.PI * 2;
  const W = 900;
  // points along an arc; sweep follows the sign of (a1 - a0). y is down, so a = 90 deg is the bottom.
  function arc(cx, cy, r, a0, a1, steps = 12, ry) {
    const out = []; ry = ry === undefined ? r : ry;
    for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry]); }
    return out;
  }
  function snakePts(xL, xR, yTop, rowH, rows, drop) {
    const pts = [], r = (rowH - drop) / 2;
    for (let i = 0; i < rows; i++) {
      const y = yTop + i * rowH, right = i % 2 === 0;
      const xa = right ? xL : xR, xb = right ? xR : xL;
      pts.push([xa, y], [xb, y + drop]);
      if (i < rows - 1) {
        const cy = y + drop + r;
        pts.push(...(right ? arc(xb, cy, r, -Math.PI / 2, Math.PI / 2, 10) : arc(xb, cy, r, -Math.PI / 2, -3 * Math.PI / 2, 10)));
      }
    }
    return pts;
  }
  const pegRows = (x0, x1, y0, rows, cols, dy) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const off = r % 2 ? (x1 - x0) / (cols - 1) / 2 : 0;
      const x = x0 + c * (x1 - x0) / (cols - 1) + off;
      if (x > x1 + 5) continue;
      out.push({ t: 'peg', x, y: y0 + r * dy, r: 17 });
    }
    return out;
  };

  // ---------------------------------------------------------------- modules
  // each: { entryX, build(y) -> { pieces, h, exitX } }
  const M = {
    // rows sit 320 apart so each ramp's high end clears the tip of the one above it;
    // at 190 the marble jammed in the 10px gap between them
    zig: (rows = 3) => ({ entryX: 450, build(y) {
      const pieces = []; let exitX = 60;
      for (let i = 0; i < rows; i++) {
        const left = i % 2 === 0, yy = y + i * 320;
        pieces.push({ t: 'wall', pts: left ? [[910, yy], [60, yy + 180]] : [[-10, yy], [840, yy + 180]], w: 18 });
        exitX = left ? 60 : 840;
      }
      return { pieces, h: rows * 320 + 40, exitX };
    } }),
    snake: (rows = 3) => ({ entryX: 80, build(y) {
      const pts = [[80, y], [125, y + 95], ...snakePts(170, 730, y + 140, 260, rows, 130)];
      return { pieces: [{ t: 'tube', pts, w: 54 }], h: 140 + (rows - 1) * 260 + 130 + 90, exitX: (rows - 1) % 2 === 0 ? 730 : 170 };
    } }),
    pins: (rows = 3) => ({ entryX: 450, build(y) {
      const deep = rows * 120 + 180;
      return { pieces: [
        { t: 'wall', pts: [[110, y], [110, y + deep]], w: 18 },
        { t: 'wall', pts: [[790, y], [790, y + deep]], w: 18 },
        ...pegRows(170, 730, y + 90, rows, 6, 120),
      ], h: deep + 30, exitX: 450 };
    } }),
    bumpers: () => ({ entryX: 450, build(y) {
      return { pieces: [
        { t: 'wall', pts: [[110, y], [110, y + 460]], w: 18 },
        { t: 'wall', pts: [[790, y], [790, y + 460]], w: 18 },
        { t: 'bumper', x: 300, y: y + 170, r: 40, power: 12 },
        { t: 'bumper', x: 600, y: y + 170, r: 40, power: 12 },
        { t: 'bumper', x: 450, y: y + 330, r: 40, power: 12 },
        ...pegRows(180, 720, y + 90, 1, 5, 100),
      ], h: 500, exitX: 450 };
    } }),
    seesaws: () => ({ entryX: 250, build(y) {
      return { pieces: [
        { t: 'seesaw', x: 330, y: y + 60, w: 340, tilt: 0.26 },
        { t: 'seesaw', x: 660, y: y + 260, w: 340, tilt: 0.26 },
        { t: 'seesaw', x: 660, y: y + 460, w: 340, tilt: -0.26 },
        { t: 'seesaw', x: 330, y: y + 660, w: 340, tilt: -0.26 },
      ], h: 760, exitX: 160 };
    } }),
    wheel: () => ({ entryX: 550, build(y) {
      return { pieces: [
        { t: 'wall', pts: [[700, y], [330, y + 90]], w: 18 },
        { t: 'wheel', x: 250, y: y + 280, r: 150, blades: 6, speed: 0.018 },
        { t: 'wall', pts: [[300, y + 500], [850, y + 640]], w: 18 },
      ], h: 700, exitX: 850 };
    } }),
    belt: () => ({ entryX: 550, build(y) {
      return { pieces: [
        { t: 'wall', pts: [[910, y], [200, y + 150]], w: 18 },
        { t: 'wall', pts: [[150, y + 175], [150, y + 240]], w: 16 },
        { t: 'belt', x: 450, y: y + 250, w: 520, speed: 3 },
      ], h: 380, exitX: 720 };
    } }),
    cannon: () => ({ entryX: 140, build(y) {
      const pts = [[140, y], [140, y + 250], [200, y + 330], [330, y + 390], [500, y + 415], [620, y + 420],
        ...arc(620, y + 290, 130, Math.PI / 2, 0, 10), [750, y + 235], ...arc(805, y + 235, 55, Math.PI, TAU, 12),
        [860, y + 470], ...arc(730, y + 470, 130, 0, Math.PI / 2, 10)];
      return { pieces: [{ t: 'tube', pts, w: 54 }, { t: 'launch', x: 560, y: y + 418, w: 120, h: 56, vx: 26, vy: -1 },
        { t: 'sign', x: 560, y: y + 350, s: 'cannon' }], h: 700, exitX: 730 };
    } }),
    water: () => ({ entryX: 450, build(y) {
      return { pieces: [
        { t: 'wall', pts: [[150, y], [150, y + 660]], w: 20 },
        { t: 'wall', pts: [[760, y], [760, y + 590]], w: 20 },
        { t: 'water', x: 455, y: y + 530, w: 600, h: 320 },
        { t: 'wall', pts: [[150, y + 630], [640, y + 790]], w: 20 },
        { t: 'sign', x: 455, y: y + 330, s: 'splash' },
      ], h: 880, exitX: 640 };
    } }),
    warp: () => ({ entryX: 700, build(y) {
      return { pieces: [
        { t: 'wall', pts: [[300, y], [840, y + 140]], w: 18 },
        { t: 'warp', x: 870, y: y + 200, tx: 90, ty: y + 320 },
        { t: 'sign', x: 790, y: y + 110, s: 'warp' },
        { t: 'wall', pts: [[-10, y + 400], [700, y + 560]], w: 18 },
      ], h: 640, exitX: 700 };
    } }),
    flip: () => ({ entryX: 450, build(y) {
      return { pieces: [
        { t: 'flip', x: 450, y: y + 50, w: 240 },
        { t: 'sign', x: 450, y: y + 10, s: 'left or right?' },
        { t: 'wall', pts: [[440, y + 120], [40, y + 260]], w: 18 },
        { t: 'wall', pts: [[460, y + 120], [860, y + 260]], w: 18 },
      ], h: 320, exitX: 450 };
    } }),
  };

  // ---------------------------------------------------------------- course builder
  function course(id, name, icon, hint, need, marbles, mods) {
    const pieces = [];
    let y = 200;
    for (const mk of mods) {
      // full-width catch funnel: whatever the last module did, the next one is fed where it wants
      const runL = mk.entryX - 45 + 10, runR = 910 - (mk.entryX + 45);
      const drop = Math.max(140, Math.round(Math.max(runL, runR) * 0.24));
      pieces.push({ t: 'wall', pts: [[-10, y], [mk.entryX - 45, y + drop]], w: 18 });
      pieces.push({ t: 'wall', pts: [[910, y], [mk.entryX + 45, y + drop]], w: 18 });
      y += drop + 30;
      const r = mk.build(y);
      pieces.push(...r.pieces);
      y += r.h;
    }
    pieces.push({ t: 'wall', pts: [[-10, y], [370, y + 140]], w: 18 });
    pieces.push({ t: 'wall', pts: [[910, y], [530, y + 140]], w: 18 });
    pieces.push({ t: 'goal', x: 450, y: y + 300, w: 250 });
    return { id, name, icon, hint, need, marbles, w: W, h: y + 460, start: { x: 450, y: 110 }, pieces };
  }
  const rep = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).flat();

  return [
    course('drop', 'First Drop', '🔽', 'Ramps, pins and belts, all the way down.', 1, 6,
      rep(7, () => [M.zig(3), M.pins(3), M.belt()]).concat([M.zig(4)])),
    course('switch', 'Switchback', '🪜', 'Switchback tubes and long zigzags.', 1, 6,
      rep(6, i => [M.snake(3), M.zig(2), i % 2 ? M.pins(3) : M.belt()]).concat([M.snake(4)])),
    course('spin', 'Spin Cycle', '⚙️', 'Paddle wheels all the way down.', 1, 6,
      rep(7, i => [M.wheel(), M.zig(2), i % 2 ? M.pins(3) : M.belt()])),
    course('seesaw', 'Seesaw Street', '🛝', 'Tilting planks, belts and warps.', 1, 6,
      rep(6, i => [M.seesaws(), M.belt(), i % 2 ? M.warp() : M.zig(3)])),
    course('split', 'Split Decision', '🔀', 'Levers, pins and bumpers. Two marbles have to make it.', 2, 10,
      rep(7, i => [M.flip(), M.pins(3), M.bumpers(), i % 2 ? M.zig(3) : M.snake(3)])),
    course('cannon', 'The Cannon', '🎢', 'Fired over the hump again and again.', 1, 8,
      rep(6, i => [M.cannon(), M.pins(3), i % 2 ? M.zig(3) : M.belt(), M.bumpers()])),
    course('water', 'Water Works', '💧', 'Tanks and corkscrews.', 1, 8,
      rep(5, i => [M.water(), M.snake(4), i % 2 ? M.zig(3) : M.pins(3), M.belt()])),
    course('machine', 'The Machine', '🏆', 'Every mechanism in the workshop. Twice.', 2, 12,
      rep(2, () => [M.wheel(), M.snake(3), M.seesaws(), M.cannon(), M.water(), M.snake(4),
        M.warp(), M.pins(3), M.belt(), M.flip(), M.bumpers(), M.zig(3)])),
  ];
})();
if (typeof module !== 'undefined') module.exports = MM_LEVELS;
