// お題データとレイアウト計算、お題マスク / 下書き / サムネイルの描画。
import { FONT_FAMILY } from './util.js';

export const ODAI = {
  shodan: ['酒', '夢', '愛', '肝', '寿', '祭', '無', '友', '山', '月'],
  nidan: ['泥酔', '根性', '乾杯', '反省', '禁酒', '人生', '青春', '上司'],
  shihan: ['一期一会', '七転八起', '一石二鳥', '十人十色', '以心伝心', '二日酔い', '千鳥足', '酒池肉林', '四面楚歌', '自業自得'],
  // 6 文字以内に収まるものだけ（「飲んだら乗るな」は 7 文字なので不採用）
  meigen: ['なせば成る', '明日から本気', 'もう飲まない', '酒は百薬の長', '継続は力なり', '初心忘れず', '笑う門に福', '寝る子は育つ'],
};

/** お題文字列 → 難易度 id。リストに無ければ文字数から推定 */
export function levelOf(text) {
  for (const [lv, list] of Object.entries(ODAI)) if (list.includes(text)) return lv;
  const n = [...text].length;
  if (n <= 1) return 'shodan';
  if (n === 2) return 'nidan';
  if (n <= 4) return 'shihan';
  return 'meigen';
}

export function isKnownOdai(text) {
  return Object.values(ODAI).some((l) => l.includes(text));
}

/**
 * 縦書き・右から左のレイアウト。座標は紙に対する 0..1（左上原点）。
 * @returns {{text, chars, aspect, cols, rows, cells:Array<{ch,x,y,w,h}>}}
 */
export function layoutOdai(text) {
  const chars = [...text].slice(0, 6);
  const n = chars.length;
  let cols;
  let rows;
  let aspect; // 幅 / 高さ
  if (n <= 1) { cols = 1; rows = 1; aspect = 1; }
  else if (n === 2) { cols = 1; rows = 2; aspect = 0.5; }
  else if (n <= 4) { cols = 2; rows = 2; aspect = 1; }
  else { cols = 2; rows = 3; aspect = 2 / 3; }
  const cells = [];
  chars.forEach((ch, i) => {
    const colFromRight = Math.floor(i / rows);
    const row = i % rows;
    const col = cols - 1 - colFromRight;
    cells.push({ ch, x: col / cols, y: row / rows, w: 1 / cols, h: 1 / rows });
  });
  return { text: chars.join(''), chars, aspect, cols, rows, cells };
}

let fontOk = false;
export const fontState = { get ok() { return fontOk; } };

/** その文字を明示的にロードしてから描くため、使う前に呼ぶ。失敗したら serif で続行。 */
export async function loadFontFor(text) {
  if (!document.fonts || !document.fonts.load) return false;
  try {
    const faces = await Promise.race([
      document.fonts.load(`400 64px "Yuji Syuku"`, text),
      new Promise((res) => setTimeout(() => res(null), 6000)),
    ]);
    fontOk = !!(faces && faces.length);
  } catch (_) {
    fontOk = false;
  }
  return fontOk;
}

const MARGIN = 0.08;

/** layout をキャンバス全面（紙全体）に描く */
export function drawOdai(ctx, W, H, layout, color = '#000') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const family = fontOk ? FONT_FAMILY : 'serif';
  for (const c of layout.cells) {
    const cw = c.w * W;
    const chh = c.h * H;
    const inner = Math.min(cw, chh) * (1 - MARGIN * 2);
    let size = inner;
    ctx.font = `400 ${size}px ${family}`;
    let m = ctx.measureText(c.ch);
    let bw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    let bh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const over = Math.max(bw / inner, bh / inner);
    if (over > 1) {
      size /= over;
      ctx.font = `400 ${size}px ${family}`;
      m = ctx.measureText(c.ch);
      bw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      bh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    }
    const cx = (c.x + c.w / 2) * W;
    const cy = (c.y + c.h / 2) * H;
    const x = cx - bw / 2 + m.actualBoundingBoxLeft;
    const y = cy - bh / 2 + m.actualBoundingBoxAscent;
    ctx.fillText(c.ch, x, y);
  }
  ctx.restore();
}

/** 長辺 long px で、紙のアスペクトに合ったキャンバスを作る */
export function makePaperCanvas(layout, long) {
  const c = document.createElement('canvas');
  if (layout.aspect >= 1) { c.width = long; c.height = Math.round(long / layout.aspect); }
  else { c.height = long; c.width = Math.round(long * layout.aspect); }
  return c;
}

/** 採点用マスク（透明背景に不透明の文字） */
export function renderMaskCanvas(layout, long) {
  const c = makePaperCanvas(layout, long);
  drawOdai(c.getContext('2d'), c.width, c.height, layout, '#000');
  return c;
}

/** 下書き（灰色の文字、透明背景）。不透明度はメッシュ側で掛ける */
export function renderGuideCanvas(layout, long) {
  const c = makePaperCanvas(layout, long);
  drawOdai(c.getContext('2d'), c.width, c.height, layout, '#3a3a3a');
  return c;
}

/** HUD 用のお手本サムネ（和紙色の背景＋墨） */
export function renderThumbCanvas(layout, long = 128) {
  const c = makePaperCanvas(layout, long);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f0e1';
  ctx.fillRect(0, 0, c.width, c.height);
  drawOdai(ctx, c.width, c.height, layout, '#1a1410');
  return c;
}
