// Deterministic Mulberry32 Pseudorandom Number Generator
// Guaranteed cross-platform 32-bit integer PRNG producing identical float sequences
// in Node.js, Headless Chrome, and Browser contexts for a given 32-bit seed.

class PRNG {
  constructor(seed = 1337) {
    this.initialSeed = typeof seed === 'number' ? seed : 1337;
    this.s = this.initialSeed >>> 0;
  }

  // Generates next deterministic float in [0, 1)
  random() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns float in [min, max)
  range(min, max) {
    return min + this.random() * (max - min);
  }

  // Returns integer in [min, max]
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // Returns random element from array
  choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(this.random() * arr.length)];
  }

  // Resets generator to initial seed
  reset() {
    this.s = this.initialSeed >>> 0;
  }
}

if (typeof window !== 'undefined') {
  window.PRNG = PRNG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRNG };
}
