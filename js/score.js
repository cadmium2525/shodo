// 一致率の計算。DOM に依存しない純粋関数は Node からもテストできる。
//
// 使い方:
//   const { w, h } = gridSize(paperAspect);            // 長辺 128 セルのグリッド
//   const target = maskFromCanvas(targetCanvas, w, h); // お題を描いたキャンバス（透明背景に不透明の文字）
//   const player = maskFromCanvas(inkCanvas, w, h);    // 墨キャンバス（透明背景に墨）
//   const { score, recall, precision } = computeScore(target, player, w, h, { charCells });
//
// charCells: 1 文字のマスの一辺が何セルか（許容誤差を文字サイズに比例させるため）。
// score は 0〜100 の整数。

export const GRID_LONG_SIDE = 128;

// 許容誤差（charCells=60 のときのセル数）と採点カーブ。
export const SCORE_PARAMS = {
  rNear: 1, rFar: 3.5,   // 再現率: お手本から墨までの距離
  pNear: 0.5, pFar: 3,   // 適合率: 墨からお手本までの距離
  areaCap: 2.2, areaExp: 0.6, // 墨の面積がお手本の areaCap 倍を超えると減点
  exp: 0.8,
};

/** aspect = 紙の 幅 / 高さ */
export function gridSize(aspect) {
  if (aspect >= 1) return { w: GRID_LONG_SIDE, h: Math.max(1, Math.round(GRID_LONG_SIDE / aspect)) };
  return { w: Math.max(1, Math.round(GRID_LONG_SIDE * aspect)), h: GRID_LONG_SIDE };
}

/**
 * キャンバスのアルファ値を w×h のグリッドに縮小して 2 値マスクにする。
 * セルの平均アルファが threshold（0..1）以上なら 1。
 */
export function maskFromCanvas(canvas, w, h, threshold = 0.3) {
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 一気に縮小するとエイリアシングで細い線が消えるので、半分ずつ段階的に縮小する。
  let src = canvas;
  let sw = canvas.width;
  let sh = canvas.height;
  while (sw / 2 > w && sh / 2 > h) {
    const half = document.createElement('canvas');
    half.width = Math.max(w, Math.floor(sw / 2));
    half.height = Math.max(h, Math.floor(sh / 2));
    const hctx = half.getContext('2d');
    hctx.imageSmoothingEnabled = true;
    hctx.drawImage(src, 0, 0, sw, sh, 0, 0, half.width, half.height);
    src = half;
    sw = half.width;
    sh = half.height;
  }
  ctx.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  const t = threshold * 255;
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] >= t ? 1 : 0;
  return mask;
}

/** マスクの各セルから、最も近い「1 のセル」までの距離（セル単位、チャンファー 3-4 近似）。 */
export function distanceField(mask, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  const A = 1;
  const B = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + A);
      if (y > 0) {
        v = Math.min(v, d[i - w] + A);
        if (x > 0) v = Math.min(v, d[i - w - 1] + B);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + B);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + A);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + A);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + B);
        if (x > 0) v = Math.min(v, d[i + w - 1] + B);
      }
      d[i] = v;
    }
  }
  return d;
}

// 距離 d が near 以下なら 1、far 以上なら 0、その間は線形。
function closeness(d, near, far) {
  if (d <= near) return 1;
  if (d >= far) return 0;
  return 1 - (d - near) / (far - near);
}

/**
 * @param {Uint8Array} target お題マスク
 * @param {Uint8Array} player 墨マスク
 * @param {object} [opts]
 * @param {number} [opts.charCells=60] 1 文字のマスの一辺（セル数）
 * @returns {{score:number, recall:number, precision:number, inkRatio:number}}
 */
export function computeScore(target, player, w, h, opts = {}) {
  const charCells = opts.charCells ?? 60;
  const k = charCells / 60;
  const P = { ...SCORE_PARAMS, ...(opts.params || {}) };
  const rNear = P.rNear * k;
  const rFar = P.rFar * k;
  const pNear = P.pNear * k;
  const pFar = P.pFar * k;

  let targetCount = 0;
  let playerCount = 0;
  for (let i = 0; i < target.length; i++) {
    targetCount += target[i];
    playerCount += player[i];
  }
  const inkRatio = playerCount / target.length;
  if (targetCount === 0 || playerCount === 0) {
    return { score: 0, recall: 0, precision: 0, inkRatio };
  }

  const dPlayer = distanceField(player, w, h);
  const dTarget = distanceField(target, w, h);
  let rSum = 0;
  let pSum = 0;
  for (let i = 0; i < target.length; i++) {
    if (target[i]) rSum += closeness(dPlayer[i], rNear, rFar);
    if (player[i]) pSum += closeness(dTarget[i], pNear, pFar);
  }
  const recall = rSum / targetCount;
  const precision = pSum / playerCount;
  // 塗りつぶし対策: 墨の面積がお手本の areaCap 倍を超えたぶんだけ減点する。
  const over = playerCount / (targetCount * P.areaCap);
  const areaPenalty = over > 1 ? Math.pow(1 / over, P.areaExp) : 1;
  // 積をとって両方そろわないと伸びないようにし、指数で体感に合わせる。
  const raw = Math.pow(recall * precision, P.exp) * areaPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
  return { score, recall, precision, inkRatio };
}
