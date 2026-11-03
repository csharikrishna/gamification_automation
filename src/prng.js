// Deterministic Mulberry32 Seeded Pseudo-Random Number Generator
// Guaranteed identical random sequences across Node.js, Headless Chrome, and Browsers.

class PRNG {
  constructor(seed = 1337) {
    this.s = (seed >>> 0) || 1337;
  }

  random() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.random() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(this.random() * arr.length)];
  }
}

if (typeof window !== 'undefined') {
  window.PRNG = PRNG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRNG };
}
