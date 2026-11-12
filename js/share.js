// SNS 共有: 共有画像の合成（2D canvas）、Web Share API / X インテント / PNG 保存。
import { goldLeafCanvas, brocadeCanvas, washiCanvas, feltCanvas } from './textures.js';
import { FONT_FAMILY } from './util.js';

export const GAME_TITLE = '泥酔書道パフォーマンス！';
export const HASHTAG = '#泥酔書道パフォーマンス';

export function shareUrl(odai) {
  const base = location.origin + location.pathname;
  return odai ? `${base}?odai=${encodeURIComponent(odai)}` : base;
}

export function shareText(odai, score, rank) {
  return `お題「${odai}」を泥酔状態で書きました。一致率 ${score}%（${rank}）\n${HASHTAG}`;
}

/**
 * 1200×1200 の共有画像を作る。作品部分は墨キャンバスをそのまま使う（下書きは含めない）。
 */
export function makeShareImage({ inkCanvas, layout, odai, score, rank, url }) {
  const S = 1200;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');

  // 背景（暗い舞台）
  g.fillStyle = '#120a07';
  g.fillRect(0, 0, S, S);

  // 金屏風（6 枚、折れの陰影つき）
  const by0 = 120;
  const bh = 760;
  const n = 6;
  const pw = (S - 80) / n;
  for (let i = 0; i < n; i++) {
    const x = 40 + i * pw;
    const gold = goldLeafCanvas(256, 760, 31 + i * 7, 44);
    g.drawImage(gold, x, by0, pw, bh);
    const sh = g.createLinearGradient(x, 0, x + pw, 0);
    if (i % 2 === 0) {
      sh.addColorStop(0, 'rgba(255,240,190,0.22)');
      sh.addColorStop(1, 'rgba(60,30,0,0.18)');
    } else {
      sh.addColorStop(0, 'rgba(60,30,0,0.28)');
      sh.addColorStop(1, 'rgba(255,240,190,0.08)');
    }
    g.fillStyle = sh;
    g.fillRect(x, by0, pw, bh);
    g.strokeStyle = '#0b0706';
    g.lineWidth = 8;
    g.strokeRect(x + 4, by0 + 4, pw - 8, bh - 8);
    g.fillStyle = '#d9b14d';
    for (const yy of [by0 + 4, by0 + bh - 18]) {
      g.fillRect(x + 4, yy, 14, 14);
      g.fillRect(x + pw - 18, yy, 14, 14);
    }
  }
  // スポットライト
  const spot = g.createRadialGradient(S / 2, 470, 40, S / 2, 470, 560);
  spot.addColorStop(0, 'rgba(255,240,200,0.30)');
  spot.addColorStop(0.6, 'rgba(255,200,90,0.06)');
  spot.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = spot;
  g.fillRect(0, 0, S, S);

  // 赤い毛氈
  const felt = feltCanvas(256);
  const pat = g.createPattern(felt, 'repeat');
  g.fillStyle = pat;
  g.fillRect(0, by0 + bh - 20, S, S - (by0 + bh - 20));
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, by0 + bh - 20, S, 14);

  // 表装された作品
  const aspect = layout.aspect;
  let ph = aspect >= 1 ? 470 : 600;
  let pwid = ph * aspect;
  if (pwid > 520) { pwid = 520; ph = pwid / aspect; }
  const side = 40;
  const ten = 110;
  const chi = 70;
  const mw = pwid + side * 2;
  const mh = ph + ten + chi;
  const mx = (S - mw) / 2;
  const my = 150;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 12;
  g.drawImage(brocadeCanvas(Math.round(mw), Math.round(mh), '#24384f', '#cfae55'), mx, my, mw, mh);
  g.restore();
  g.fillStyle = '#d8cba4';
  g.fillRect(mx + side - 16, my + ten - 30, pwid + 32, ph + 60);
  g.fillStyle = '#d9b45a';
  g.fillRect(mx + side - 16, my + ten - 30, pwid + 32, 14);
  g.fillRect(mx + side - 16, my + ten + ph + 16, pwid + 32, 14);
  g.drawImage(washiCanvas(512, Math.round(512 / aspect), 21), mx + side, my + ten, pwid, ph);
  g.drawImage(inkCanvas, mx + side, my + ten, pwid, ph);
  // 軸
  g.fillStyle = '#2a1a10';
  g.fillRect(mx - 10, my + mh - 6, mw + 20, 18);
  g.fillStyle = '#f1ead8';
  g.fillRect(mx - 34, my + mh - 10, 26, 26);
  g.fillRect(mx + mw + 8, my + mh - 10, 26, 26);
  g.fillStyle = '#2a1a10';
  g.fillRect(mx, my - 4, mw, 8);

  // タイトル帯
  g.fillStyle = 'rgba(10,6,5,0.85)';
  g.fillRect(0, 0, S, 104);
  g.fillStyle = '#e8c766';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `400 62px ${FONT_FAMILY}`;
  g.fillText(GAME_TITLE, S / 2, 56);

  // 立て札風の情報帯
  const iy = by0 + bh + 10;
  g.fillStyle = 'rgba(244,226,191,0.95)';
  g.fillRect(70, iy, S - 140, 220);
  g.strokeStyle = '#5a3a1a';
  g.lineWidth = 6;
  g.strokeRect(70, iy, S - 140, 220);
  g.fillStyle = '#1a1410';
  const fitText = (text, size, x, y, maxW, align = 'center') => {
    let s = size;
    g.textAlign = align;
    g.font = `400 ${s}px ${FONT_FAMILY}`;
    while (g.measureText(text).width > maxW && s > 18) {
      s -= 2;
      g.font = `400 ${s}px ${FONT_FAMILY}`;
    }
    g.fillText(text, x, y);
  };
  fitText(`題『${odai}』`, 64, 110, iy + 62, 560, 'left');
  fitText(`一致率 ${score}%`, 84, S - 110, iy + 66, 440, 'right');
  g.fillStyle = '#b3142a';
  fitText(`段位: ${rank}`, 60, S / 2, iy + 160, S - 220);
  // URL
  g.fillStyle = '#c9b48a';
  fitText(decodeURI(url).replace(/^https?:\/\//, ''), 26, S / 2, S - 26, S - 80);
  return c;
}

function canvasToBlob(canvas) {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}

export async function saveImage(canvas, filename = 'deisui-shodo.png') {
  const blob = await canvasToBlob(canvas);
  if (!blob) return false;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return true;
}

/**
 * Web Share API（画像つき）が使えればそれで、無理なら X の投稿インテントを開く。
 * @returns {'shared'|'intent'|'cancelled'}
 */
export async function shareResult({ canvas, text, url }) {
  try {
    const blob = await canvasToBlob(canvas);
    if (blob && navigator.canShare) {
      const file = new File([blob], 'deisui-shodo.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${url}` });
        return 'shared';
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(intent, '_blank', 'noopener');
  return 'intent';
}
