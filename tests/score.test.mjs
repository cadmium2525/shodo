// score.js の純粋関数の最小テスト（node --test tests/ で実行）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridSize, distanceField, computeScore, GRID_LONG_SIDE } from '../js/score.js';

function blankMask(w, h) {
  return new Uint8Array(w * h);
}

/** 縦棒と横棒の「十」をマスクに描く */
function crossMask(w, h, dx = 0, dy = 0, thick = 6) {
  const m = blankMask(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vx = Math.abs(x - (w / 2 + dx)) < thick / 2 && y > h * 0.1 && y < h * 0.9;
      const hz = Math.abs(y - (h / 2 + dy)) < thick / 2 && x > w * 0.1 && x < w * 0.9;
      if (vx || hz) m[y * w + x] = 1;
    }
  }
  return m;
}

test('gridSize は長辺 128 セル', () => {
  assert.deepEqual(gridSize(1), { w: GRID_LONG_SIDE, h: GRID_LONG_SIDE });
  assert.deepEqual(gridSize(0.5), { w: 64, h: 128 });
  assert.deepEqual(gridSize(2 / 3), { w: 85, h: 128 });
  assert.deepEqual(gridSize(2), { w: 128, h: 64 });
});

test('distanceField は 1 のセルで 0、離れるほど大きい', () => {
  const w = 9;
  const h = 9;
  const m = blankMask(w, h);
  m[4 * w + 4] = 1;
  const d = distanceField(m, w, h);
  assert.equal(d[4 * w + 4], 0);
  assert.equal(d[4 * w + 5], 1);
  assert.ok(Math.abs(d[5 * w + 5] - Math.SQRT2) < 1e-6);
  assert.ok(d[0] > d[3 * w + 3]);
});

test('お手本と同じなら 100、白紙なら 0', () => {
  const { w, h } = gridSize(1);
  const t = crossMask(w, h);
  assert.equal(computeScore(t, t, w, h, { charCells: 128 }).score, 100);
  assert.equal(computeScore(t, blankMask(w, h), w, h, { charCells: 128 }).score, 0);
});

test('少しのずれは許容される', () => {
  const { w, h } = gridSize(1);
  const t = crossMask(w, h);
  const p = crossMask(w, h, 3, -2);
  const { score } = computeScore(t, p, w, h, { charCells: 128 });
  assert.ok(score >= 70, `score=${score}`);
  // 大きくずれるほど下がる
  const far = computeScore(t, crossMask(w, h, 12, -9), w, h, { charCells: 128 });
  assert.ok(far.score < score - 20, `near=${score} far=${far.score}`);
});

test('余計な墨（足跡など）は適合率を下げる', () => {
  const { w, h } = gridSize(1);
  const t = crossMask(w, h);
  const p = crossMask(w, h);
  const clean = computeScore(t, p, w, h, { charCells: 128 });
  // 左上の角に足跡のような点々を追加
  for (let i = 0; i < 12; i++) {
    const cx = 6 + (i % 2) * 4;
    const cy = 4 + i * 3;
    for (let y = cy; y < cy + 2; y++) for (let x = cx; x < cx + 2; x++) p[y * w + x] = 1;
  }
  const dirty = computeScore(t, p, w, h, { charCells: 128 });
  assert.equal(dirty.recall, clean.recall);
  assert.ok(dirty.precision < clean.precision);
  assert.ok(dirty.score < clean.score);
});

test('まったく違う場所に書くと低得点', () => {
  const { w, h } = gridSize(1);
  const t = crossMask(w, h);
  const p = blankMask(w, h);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) p[y * w + x] = 1;
  const { score } = computeScore(t, p, w, h, { charCells: 128 });
  assert.ok(score < 10, `score=${score}`);
});
