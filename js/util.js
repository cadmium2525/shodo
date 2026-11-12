// 小物ユーティリティ（乱数・補間など）

/** 32bit シードの決定的乱数（mulberry32） */
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  return rng;
}

export function seedFromUrl() {
  try {
    const s = new URLSearchParams(location.search).get('seed');
    if (s !== null && s !== '' && Number.isFinite(Number(s))) return Number(s) >>> 0;
  } catch (_) { /* noop */ }
  return null;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function storageGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { /* noop */ }
}

export const FONT_FAMILY = '"Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif';
