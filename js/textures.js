// キャンバスで生成するテクスチャ類（和紙・板床・金箔・裂地・畳マットなど）。画像ファイルは使わない。
import { makeRng } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** 和紙: 生成りの地に繊維と雲状のムラ */
export function washiCanvas(w, h, seed = 7) {
  const rng = makeRng(seed);
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#f7f2e4';
  g.fillRect(0, 0, w, h);
  // 雲状のムラ
  for (let i = 0; i < 60; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = (0.05 + rng() * 0.18) * Math.max(w, h);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rng() < 0.5 ? '235,226,203' : '255,253,246';
    grd.addColorStop(0, `rgba(${tone},0.18)`);
    grd.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 繊維
  const fibers = Math.round((w * h) / 900);
  g.lineCap = 'round';
  for (let i = 0; i < fibers; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 4 + rng() * 22;
    const a = rng() * Math.PI * 2;
    g.strokeStyle = rng() < 0.7 ? `rgba(200,185,150,${0.12 + rng() * 0.2})` : `rgba(255,255,255,${0.3 + rng() * 0.3})`;
    g.lineWidth = 0.4 + rng() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  return c;
}

/** 体育館風の板張りの床（タイル用、正方形） */
export function woodFloorCanvas(size = 512, seed = 3) {
  const rng = makeRng(seed);
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const planks = 8;
  const pw = size / planks;
  for (let i = 0; i < planks; i++) {
    let y = -rng() * size;
    while (y < size) {
      const len = size * (0.4 + rng() * 0.6);
      const l = 52 + rng() * 10;
      g.fillStyle = `hsl(${30 + rng() * 6}, ${45 + rng() * 10}%, ${l}%)`;
      g.fillRect(i * pw, y, pw, len);
      // 木目
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(110,60,20,${0.08 + rng() * 0.1})`;
        g.lineWidth = 0.6 + rng() * 1.2;
        const x0 = i * pw + rng() * pw;
        g.beginPath();
        g.moveTo(x0, y);
        g.bezierCurveTo(x0 + (rng() - 0.5) * 8, y + len * 0.3, x0 + (rng() - 0.5) * 8, y + len * 0.7, x0 + (rng() - 0.5) * 6, y + len);
        g.stroke();
      }
      g.fillStyle = 'rgba(60,30,10,0.55)';
      g.fillRect(i * pw, y + len - 1.5, pw, 1.5);
      y += len;
    }
    g.fillStyle = 'rgba(50,25,8,0.6)';
    g.fillRect(i * pw, 0, 1.6, size);
  }
  // 体育館のライン
  g.fillStyle = 'rgba(255,255,255,0.0)';
  return c;
}

/** 金箔: 正方形の箔を重ねた格子。ムラ・箔足（重なりの線）・わずかな赤み */
export function goldLeafCanvas(w, h, seed = 11, tile = 64) {
  const rng = makeRng(seed);
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#c9a23a';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      const ox = (rng() - 0.5) * 3;
      const oy = (rng() - 0.5) * 3;
      const l = 52 + rng() * 14;
      const hue = 42 + rng() * 6;
      const grd = g.createLinearGradient(x, y, x + tile, y + tile);
      grd.addColorStop(0, `hsl(${hue}, 72%, ${l + 6}%)`);
      grd.addColorStop(0.5, `hsl(${hue + 2}, 78%, ${l}%)`);
      grd.addColorStop(1, `hsl(${hue - 3}, 70%, ${l - 7}%)`);
      g.fillStyle = grd;
      g.fillRect(x + ox, y + oy, tile + 1, tile + 1);
      // 箔足（重なりの縁）
      g.strokeStyle = `rgba(120,80,10,${0.25 + rng() * 0.2})`;
      g.lineWidth = 1;
      g.strokeRect(x + ox + 0.5, y + oy + 0.5, tile, tile);
      g.strokeStyle = 'rgba(255,240,180,0.25)';
      g.beginPath();
      g.moveTo(x + ox + 1.5, y + oy + tile);
      g.lineTo(x + ox + 1.5, y + oy + 1.5);
      g.lineTo(x + ox + tile, y + oy + 1.5);
      g.stroke();
    }
  }
  // 細かい皺
  for (let i = 0; i < (w * h) / 600; i++) {
    g.strokeStyle = rng() < 0.5 ? 'rgba(255,245,200,0.18)' : 'rgba(110,70,10,0.14)';
    g.lineWidth = 0.6;
    const x = rng() * w;
    const y = rng() * h;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 14);
    g.stroke();
  }
  // 金雲（すやり霞）
  for (let i = 0; i < 4; i++) {
    const cy = h * (0.12 + rng() * 0.76);
    const cx = rng() * w;
    const rw = w * (0.25 + rng() * 0.3);
    const rh = h * 0.035;
    g.fillStyle = 'rgba(255,236,160,0.22)';
    g.beginPath();
    g.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** 表装の裂地（緞子風の地紋） */
export function brocadeCanvas(w, h, base = '#2f4a3a', pattern = '#c9a64a', seed = 5) {
  const rng = makeRng(seed);
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const s = 28;
  g.strokeStyle = pattern;
  g.globalAlpha = 0.35;
  g.lineWidth = 1.4;
  for (let y = 0; y < h + s; y += s) {
    for (let x = (y / s) % 2 ? s / 2 : 0; x < w + s; x += s) {
      // 七宝つなぎ風
      g.beginPath();
      g.arc(x, y, s * 0.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 0.5;
  g.fillStyle = pattern;
  for (let y = 0; y < h + s; y += s) {
    for (let x = (y / s) % 2 ? 0 : s / 2; x < w + s; x += s) {
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // 織りのざらつき
  for (let i = 0; i < (w * h) / 40; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
    g.fillRect(rng() * w, rng() * h, 1, 2);
  }
  return c;
}

/** 毛氈（赤） */
export function feltCanvas(size = 256, seed = 9) {
  const rng = makeRng(seed);
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#b3142a';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.5; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,90,90,0.07)';
    g.fillRect(rng() * size, rng() * size, 1, 1);
  }
  return c;
}

/** 足ふきマット（い草のござ風）＋文字 */
export function matCanvas(size = 256, label = '足ふき', fontFamily = 'serif') {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#9fb36a';
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 4) {
    g.fillStyle = y % 8 ? 'rgba(80,100,30,0.25)' : 'rgba(230,240,180,0.25)';
    g.fillRect(0, y, size, 2);
  }
  g.strokeStyle = '#3d4f6b';
  g.lineWidth = size * 0.06;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, size - g.lineWidth, size - g.lineWidth);
  g.fillStyle = 'rgba(40,40,40,0.75)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `400 ${size * 0.22}px ${fontFamily}`;
  g.fillText(label, size / 2, size / 2);
  return c;
}

/** 文字だけのスプライト用キャンバス */
export function labelCanvas(text, { size = 128, color = '#fff', stroke = '#000', fontFamily = 'serif', w = 256, h = 128 } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `400 ${size}px ${fontFamily}`;
  g.lineJoin = 'round';
  g.lineWidth = size * 0.16;
  g.strokeStyle = stroke;
  g.strokeText(text, w / 2, h / 2);
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  return c;
}

/** 丸い影 */
export function blobShadowCanvas(size = 128) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}
