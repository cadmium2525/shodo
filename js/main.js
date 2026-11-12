// 起動・画面遷移（title → select → play → result）とゲームループ、テスト用フック。
import { config as C, LEVELS } from './config.js';
import { makeRng, seedFromUrl, clamp } from './util.js';
import { ODAI, levelOf, isKnownOdai, layoutOdai, loadFontFor, renderMaskCanvas, renderGuideCanvas, renderThumbCanvas } from './odai.js';
import { createRenderer, Stage } from './scene.js';
import { Player } from './player.js';
import { InkLayer } from './ink.js';
import { Input } from './input.js';
import { gridSize, maskFromCanvas, computeScore } from './score.js';
import { ResultScene, makeComment } from './result.js';
import { makeShareImage, shareResult, saveImage, shareText, shareUrl } from './share.js';
import { sound } from './audio.js';

const $ = (id) => document.getElementById(id);

const app = {
  state: 'title',
  round: null,
  lastResult: null,
  guide: true,
  level: 'shodan',
  urlSeed: seedFromUrl(),
  urlOdai: null,
  shareCanvas: null,
};

let renderer;
let stage;
let player;
let resultScene;
let input;
let titleRng = makeRng(app.urlSeed ?? 12345);
let titleInk = null;

// ---------------- 画面切り替え ----------------

const screens = { title: $('scr-title'), select: $('scr-select'), play: $('hud'), result: $('scr-result') };

function show(name) {
  app.state = name;
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  input.enabled = name === 'play';
  // ボタンにフォーカスが残っていると Space で押されてしまうので外す
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  if (name !== 'play') { input.reset(); sound.setBrush(0); }
  onResize();
}

function toast(msg, ms = 1400) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), ms);
}

function callout(msg, ms = 900) {
  const el = $('callout');
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(callout.t);
  if (ms > 0) callout.t = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------------- タイトル背景 ----------------

function buildTitleStage() {
  const layout = layoutOdai('酒');
  titleInk = new InkLayer(layout, C.CELL, C.CELL, titleRng);
  stage.build(layout, titleInk.canvas, null);
  player.rng = titleRng;
  player.reset(0, 0.5);
}

function titleInput(t) {
  return {
    x: Math.sin(t * 0.5) * 0.6 + Math.sin(t * 1.3) * 0.3,
    y: Math.cos(t * 0.37) * 0.5,
    brush: false,
  };
}

// ---------------- お題選択 ----------------

function buildSelect() {
  const tabs = $('tabs');
  tabs.innerHTML = '';
  for (const lv of LEVELS) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.dataset.level = lv.id;
    b.innerHTML = `${lv.name}<small>${lv.desc}・${C.TIME_BY_LEVEL[lv.id]}秒</small>`;
    b.addEventListener('click', () => { sound.start(); sound.ka(); app.level = lv.id; renderSelect(); });
    tabs.appendChild(b);
  }
  renderSelect();
}

function renderSelect() {
  for (const b of $('tabs').children) b.setAttribute('aria-selected', b.dataset.level === app.level ? 'true' : 'false');
  const grid = $('odai-grid');
  grid.innerHTML = '';
  for (const text of ODAI[app.level]) {
    const b = document.createElement('button');
    b.className = 'odai-btn';
    b.textContent = text;
    b.addEventListener('click', () => beginRound(text));
    grid.appendChild(b);
  }
}

function beginRound(text) {
  sound.start();
  app.guide = $('guide-toggle').checked;
  startRound(text, { guide: app.guide });
}

// ---------------- プレイ ----------------

async function startRound(text, opts = {}) {
  const odai = [...String(text)].slice(0, 6).join('');
  const level = levelOf(odai);
  const guide = opts.guide ?? app.guide;
  const seed = (opts.seed ?? app.urlSeed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const drunk = opts.drunk ?? C.DRUNK_BY_LEVEL[level] ?? 1;
  await loadFontFor(odai);
  const rng = makeRng(seed);
  const layout = layoutOdai(odai);
  const PW = layout.cols * C.CELL;
  const PH = layout.rows * C.CELL;
  const ink = new InkLayer(layout, PW, PH, rng);
  const guideCanvas = guide ? renderGuideCanvas(layout, 1024) : null;
  stage.build(layout, ink.canvas, guideCanvas);
  const grid = gridSize(layout.aspect);
  const targetMask = maskFromCanvas(renderMaskCanvas(layout, C.MASK_CANVAS_LONG), grid.w, grid.h);
  player.rng = rng;
  player.reset(0, PH / 2 + C.SUZURI_GAP * 0.5);
  player.makeHiccupSprite();
  const timeLimit = C.TIME_BY_LEVEL[level] ?? 90;
  app.level = level;
  app.round = {
    odai, level, layout, guide, seed, drunk, rng, ink, grid, targetMask, PW, PH,
    charCells: grid.w / layout.cols,
    timeLimit, timeLeft: timeLimit, elapsed: 0,
    phase: 'ready', phaseT: 0,
    inkLevel: 100, footInk: 0,
    wasDown: false, lastTip: player.tip(), tipSpeed: 0,
    lastStroke: { id: 0, liftT: -99 },
    inPool: false, poolT: 0, onMat: false,
    beatT: 0, endT: 0, ended: false,
    stats: { inkOuts: 0, refills: 0, strokes: 0, hiccups: 0, staggers: 0 },
  };
  // HUD
  $('hud-odai-text').textContent = odai;
  const th = renderThumbCanvas(layout, 128);
  const thumb = $('thumb');
  thumb.width = th.width;
  thumb.height = th.height;
  thumb.getContext('2d').drawImage(th, 0, 0);
  thumb.style.width = `${Math.round(44 * Math.min(1, layout.aspect))}px`;
  $('hud-time').parentElement.classList.remove('hurry');
  show('play');
  updateHud();
  callout('用意…', 0);
  sound.taiko(0.5);
}

function endRound(reason) {
  const r = app.round;
  if (!r || r.ended) return;
  r.ended = true;
  r.phase = 'over';
  r.endT = 0;
  r.ink.end();
  player.setBanzai(true);
  sound.setBrush(0);
  callout(reason === 'timeup' ? 'そこまで！' : '書き上げた！', 1500);
  sound.taiko(1);
  sound.taiko(0.9, 0.25);
}

function currentScore() {
  const r = app.round;
  if (!r) return { score: 0, recall: 0, precision: 0, inkRatio: 0 };
  const pm = maskFromCanvas(r.ink.canvas, r.grid.w, r.grid.h);
  return computeScore(r.targetMask, pm, r.grid.w, r.grid.h, { charCells: r.charCells });
}

function updatePlay(dt) {
  const r = app.round;
  r.phaseT += dt;
  if (r.phase === 'ready' && r.phaseT >= 1.0) {
    r.phase = 'go';
    r.phaseT = 0;
    callout('ドン！', 700);
    sound.don();
  }
  if (r.phase === 'go') {
    r.timeLeft -= dt;
    r.elapsed += dt;
    // 太鼓のリズム（残り 10 秒で速く）
    r.beatT -= dt;
    if (r.beatT <= 0) {
      const hurry = r.timeLeft <= C.HURRY_TIME;
      r.beatT = hurry ? 0.4 : 2.0;
      sound.taiko(hurry ? 0.45 : 0.18, 0, hurry ? 1.2 : 1);
    }
    if (r.timeLeft <= 0) { r.timeLeft = 0; endRound('timeup'); }
  }
  if (r.phase === 'over') {
    r.endT += dt;
    if (r.endT > 1.7) goResult();
  }

  const frozen = r.phase !== 'go';
  const inp = input.get();
  const ev = player.update(dt, inp, r.drunk, stage.bounds, frozen);
  if (ev.hiccup) { sound.hiccup(); r.stats.hiccups++; }
  if (ev.staggerStart) r.stats.staggers++;

  // 筆
  const tip = player.tip();
  r.tipSpeed = Math.hypot(tip.x - r.lastTip.x, tip.z - r.lastTip.z) / Math.max(dt, 1e-4);
  r.lastTip = tip;
  const down = player.brushDown && !frozen;
  if (down) {
    const before = r.inkLevel;
    let used;
    if (!r.wasDown) { used = r.ink.begin(tip.x, tip.z, r.inkLevel); r.stats.strokes++; }
    else used = r.ink.move(tip.x, tip.z, r.tipSpeed, r.inkLevel, dt);
    r.inkLevel = Math.max(0, r.inkLevel - used);
    if (before > 0 && r.inkLevel <= 0) { r.stats.inkOuts++; toast('墨切れ！硯へ急げ'); }
    sound.setBrush(r.inkLevel > 0 ? clamp(0.25 + r.tipSpeed / C.MAX_SPEED, 0, 1) : 0);
  } else {
    if (r.wasDown) {
      r.ink.end();
      r.lastStroke = { id: r.ink.strokeId, liftT: r.elapsed };
    }
    sound.setBrush(0);
  }
  r.wasDown = down;

  // 足
  for (const st of ev.steps) {
    const onPaper = r.ink.onPaper(st.x, st.z);
    sound.step(onPaper);
    if (stage.onMat(st.x, st.z)) {
      if (r.footInk > 0) toast('ふきふき…足がきれいになった');
      r.footInk = 0;
      continue;
    }
    const ignore = [];
    if (down) ignore.push(r.ink.strokeId);
    if (r.elapsed - r.lastStroke.liftT < C.FRESH_STROKE_GRACE) ignore.push(r.lastStroke.id);
    if (onPaper && r.ink.wetAt(st.x, st.z, ignore)) {
      if (r.footInk < 0.5) toast('墨を踏んだ！');
      r.footInk = 1;
    }
    if (r.footInk > 0 && onPaper) {
      r.ink.footprint(st.x, st.z, st.angle, r.footInk);
      r.footInk = Math.max(C.FOOT_INK_MIN, r.footInk - C.FOOT_INK_DECAY);
    }
  }

  // 硯
  const inPool = stage.inPool(player.x, player.z);
  if (inPool) {
    if (!r.inPool) { sound.chapu(); stage.ripple(); r.poolT = 0; if (r.inkLevel < 95) r.stats.refills++; }
    r.poolT += dt;
    if (r.poolT > 0.45) { r.poolT = 0; stage.ripple(); if (r.inkLevel < 99) sound.chapu(); }
    r.inkLevel = Math.min(100, r.inkLevel + (100 / C.REFILL_TIME) * dt);
    r.footInk = 1;
  }
  r.inPool = inPool;

  // 筆先の色（墨が減ると白っぽく）
  const dryness = 1 - r.inkLevel / 100;
  player.model.tipMat.color.setRGB(0.07 + dryness * 0.75, 0.07 + dryness * 0.72, 0.07 + dryness * 0.66);

  stage.update(dt, r.inkLevel, r.phase === 'go');
  updateHud();
}

let hudCache = {};
function updateHud() {
  const r = app.round;
  if (!r) return;
  const t = Math.ceil(r.timeLeft);
  if (hudCache.t !== t) {
    $('hud-time').textContent = String(t);
    $('hud-time').parentElement.classList.toggle('hurry', r.timeLeft <= C.HURRY_TIME && r.phase === 'go');
    hudCache.t = t;
  }
  const ink = Math.round(r.inkLevel);
  if (hudCache.ink !== ink) {
    $('gauge-fill').setAttribute('width', String(160 * (r.inkLevel / 100)));
    $('gauge-num').textContent = String(ink);
    $('gauge').classList.toggle('low', r.inkLevel < C.LOW_INK_MARKER);
    hudCache.ink = ink;
  }
  const dirty = r.footInk > 0;
  if (hudCache.dirty !== dirty) {
    $('foot').classList.toggle('dirty', dirty);
    $('foot-text').textContent = dirty ? '足の裏: 墨まみれ' : '足の裏: きれい';
    hudCache.dirty = dirty;
  }
}

// ---------------- 結果 ----------------

function goResult() {
  const r = app.round;
  if (!r) return;
  if (app.state === 'result') return;
  r.ended = true;
  r.ink.end();
  sound.setBrush(0);
  const sc = currentScore();
  const stats = {
    footprints: r.ink.stats.footprints,
    inkOuts: r.stats.inkOuts,
    refills: r.stats.refills,
    splatters: r.ink.stats.splatters,
    inkRatio: sc.inkRatio,
    offPaper: r.ink.stats.offPaperDist,
    elapsed: r.elapsed,
    timeLimit: r.timeLimit,
  };
  const { rank, comment } = makeComment(sc.score, stats, r.rng);
  app.lastResult = { score: sc.score, rank, comment, recall: sc.recall, precision: sc.precision, stats };
  app.shareCanvas = null;
  resultScene.build({ layout: r.layout, inkCanvas: r.ink.canvas, score: sc.score, rank, odai: r.odai });
  app.resultFlags = {};
  $('res-title').textContent = `題『${r.odai}』`;
  $('res-score').textContent = '0';
  $('res-rank').textContent = rank;
  $('res-comment').textContent = comment;
  $('res-rank').classList.remove('show');
  $('res-comment').classList.remove('show');
  $('result-panel').classList.remove('show');
  $('res-buttons').classList.add('locked');
  $('res-note').hidden = true;
  const scr = screens.result;
  scr.classList.remove('open');
  show('result');
  requestAnimationFrame(() => requestAnimationFrame(() => scr.classList.add('open')));
}

function updateResult(dt) {
  resultScene.update(dt);
  const t = resultScene.t;
  const f = app.resultFlags;
  const res = app.lastResult;
  if (!f.don && t > 0.9) { f.don = true; sound.taiko(0.9, 0, 0.8); }
  if (!f.panel && t > 1.4) { f.panel = true; $('result-panel').classList.add('show'); }
  if (!f.cheer && t > 3.3) { f.cheer = true; sound.cheer(3.2); }
  if (!f.roll && t > 3.4) { f.roll = true; sound.drumroll(1.5); }
  if (t > 3.4 && !f.counted) {
    const k = clamp((t - 3.4) / 1.5, 0, 1);
    $('res-score').textContent = String(Math.round(res.score * (1 - Math.pow(1 - k, 3))));
    if (k >= 1) f.counted = true;
  }
  if (!f.rank && t > 5.0) {
    f.rank = true;
    $('res-score').textContent = String(res.score);
    $('res-rank').classList.add('show');
    $('res-comment').classList.add('show');
    $('res-buttons').classList.remove('locked');
  }
}

function skipResult() {
  if (app.state !== 'result') return;
  if (resultScene.t < 5) resultScene.skip();
}

function getShareCanvas() {
  const r = app.round;
  const res = app.lastResult;
  if (!r || !res) return null;
  if (!app.shareCanvas) {
    app.shareCanvas = makeShareImage({ inkCanvas: r.ink.canvas, layout: r.layout, odai: r.odai, score: res.score, rank: res.rank, url: shareUrl(r.odai) });
  }
  return app.shareCanvas;
}

// ---------------- ループとリサイズ ----------------

let lastT = performance.now();
let lastPlayT = performance.now();
let prevResT = performance.now();
let titleT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (app.state !== 'play') lastPlayT = now;
  const lastResT = prevResT;
  prevResT = now;
  if (app.state === 'play' && app.round) {
    // 低フレームレートでも実時間どおり進むよう細かく刻む（最大 0.25 秒ぶん）
    let rest = Math.min(0.25, Math.max(0, (now - lastPlayT) / 1000));
    lastPlayT = now;
    while (rest > 1e-4 && app.state === 'play') {
      const step = Math.min(1 / 30, rest);
      updatePlay(step);
      rest -= step;
    }
    stage.uploadInk(renderer, app.round.ink);
    renderer.render(stage.scene, stage.camera);
  } else if (app.state === 'result') {
    // 演出は実時間で進める（重い端末でも間延びしないように）
    updateResult(Math.min(1, Math.max(0, (now - lastResT) / 1000)));
    renderer.render(resultScene.scene, resultScene.camera);
  } else {
    // タイトル / お題選択の背景: ふらふら歩く酔っ払い
    titleT += dt;
    const ev = player.update(dt, titleInput(titleT), 1, stage.bounds);
    if (ev.hiccup) sound.hiccup();
    stage.update(dt, 100, false);
    stage.fitTitle(innerWidth, innerHeight, player.x, player.z);
    renderer.render(stage.scene, stage.camera);
  }
}

function onResize() {
  const W = innerWidth;
  const H = innerHeight;
  renderer.setSize(W, H, false);
  if (app.state === 'play') {
    const top = $('hud-top').getBoundingClientRect().bottom + 4;
    document.documentElement.style.setProperty('--hud-h', `${Math.round(top)}px`);
    // タッチ端末では下側に筆ボタンとジョイスティックの余地を残す
    const bottom = document.body.classList.contains('touch') ? Math.min(120, H * 0.12) : 12;
    stage.fit(W, H, top, bottom);
  } else if (app.state === 'result' && resultScene.art) {
    const panel = $('result-panel');
    const ph = panel.getBoundingClientRect().height + 16;
    resultScene.fit(W, H, 8, ph);
  }
}

// ---------------- 起動 ----------------

function setupUi() {
  const mute = $('btn-mute');
  const syncMute = () => { mute.classList.toggle('muted', sound.muted); mute.textContent = '音'; };
  syncMute();
  mute.addEventListener('click', () => { sound.start(); sound.setMuted(!sound.muted); syncMute(); mute.blur(); });

  $('btn-start').addEventListener('click', () => {
    sound.start();
    sound.don();
    if (app.urlOdai) beginRound(app.urlOdai);
    else show('select');
  });
  $('btn-other').addEventListener('click', () => { sound.start(); show('select'); });
  $('btn-back').addEventListener('click', () => { buildTitleStage(); show('title'); });
  $('btn-omakase').addEventListener('click', () => {
    const list = ODAI[app.level];
    beginRound(list[Math.floor(Math.random() * list.length)]);
  });
  $('btn-done').addEventListener('click', () => { if (app.round?.phase === 'go') endRound('done'); });
  $('btn-retry').addEventListener('click', () => {
    app.round = null;
    buildTitleStage();
    show('title');
  });
  $('btn-share').addEventListener('click', async () => {
    const c = getShareCanvas();
    const r = app.round;
    const res = app.lastResult;
    const result = await shareResult({ canvas: c, text: shareText(r.odai, res.score, res.rank), url: shareUrl(r.odai) });
    if (result === 'intent') {
      const note = $('res-note');
      note.hidden = false;
      note.textContent = 'X の投稿画面を開きました。作品画像は「画像を保存」で保存して添付してください。';
    }
  });
  $('btn-save').addEventListener('click', () => {
    saveImage(getShareCanvas(), `deisui-shodo-${app.lastResult.score}pct.png`);
  });
  $('btn-again').addEventListener('click', () => startRound(app.round.odai, { guide: app.round.guide }));
  $('btn-change').addEventListener('click', () => { buildTitleStage(); show('select'); });
  screens.result.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) skipResult(); });

  input = new Input({
    zone: $('touch-zone'),
    joyBase: $('joy-base'),
    joyKnob: $('joy-knob'),
    brushBtn: $('btn-brush'),
    onFinish: () => { if (app.round?.phase === 'go') endRound('done'); },
  });
  const markTouch = () => document.body.classList.add('touch');
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || innerWidth < 700) markTouch();
  window.addEventListener('touchstart', markTouch, { once: true, passive: true });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  // 初回操作で音を開始
  const unlock = () => sound.start();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
}

function setupHooks() {
  window.__shodo = {
    get state() { return app.state; },
    get phase() { return app.round?.phase ?? null; },
    start(odaiText, opts = {}) { return startRound(odaiText, opts); },
    finish() {
      if (!app.round) return null;
      if (!app.round.ended) endRound('done');
      goResult();
      return app.lastResult;
    },
    getPlayer() {
      const r = app.round;
      const PW = r ? r.PW : C.CELL;
      const PH = r ? r.PH : C.CELL;
      const tip = player.tip();
      return {
        x: (player.x + PW / 2) / PW,
        y: (player.z + PH / 2) / PH,
        ink: r ? r.inkLevel : 100,
        footInk: r ? r.footInk : 0,
        brushDown: !!(r && r.wasDown),
        tipX: (tip.x + PW / 2) / PW,
        tipY: (tip.z + PH / 2) / PH,
        heading: player.heading,
      };
    },
    teleport(x, y) {
      const r = app.round;
      const PW = r ? r.PW : C.CELL;
      const PH = r ? r.PH : C.CELL;
      player.x = x * PW - PW / 2;
      player.z = y * PH - PH / 2;
      player.vx = 0;
      player.vz = 0;
      if (r) {
        r.ink.end();
        r.wasDown = false;
        r.lastTip = player.tip();
      }
      player.syncModel(0);
    },
    setInput(v) { input.override = v ? { ...v } : null; },
    drawTarget() {
      const r = app.round;
      if (!r) return;
      r.ink.drawTarget();
    },
    getScore() {
      const s = currentScore();
      return { score: s.score, recall: s.recall, precision: s.precision };
    },
    getResult() {
      const r = app.lastResult;
      return r ? { score: r.score, rank: r.rank, comment: r.comment } : null;
    },
    getStats() {
      const r = app.round;
      if (!r) return null;
      return { ...r.stats, footprints: r.ink.stats.footprints, splatters: r.ink.stats.splatters, timeLeft: r.timeLeft };
    },
    getShareImage() {
      const c = getShareCanvas();
      return c ? c.toDataURL('image/png') : null;
    },
    config: C,
  };
}

async function boot() {
  renderer = createRenderer($('gl'));
  stage = new Stage();
  player = new Player(titleRng);
  stage.scene.add(player.group);
  resultScene = new ResultScene(renderer);
  setupUi();
  setupHooks();
  // スプライトや看板に使う文字を先にロード
  const uiChars = '墨↓ヒック足ふきどやZzz…題一致率%『』０１２３４５６７８９0123456789泥酔書道パフォーマンス！'
    + Object.values(ODAI).flat().join('') + ['人間国宝（しらふ疑惑）', '師範代', '有段者', 'ほろ酔い書家', '千鳥足の新人', '前衛芸術家', 'ただの酔っ払い', '段位:'].join('');
  await loadFontFor(uiChars);
  player.makeHiccupSprite();
  buildTitleStage();
  buildSelect();

  try {
    const q = new URLSearchParams(location.search).get('odai');
    if (q && isKnownOdai(q)) {
      app.urlOdai = q;
      app.level = levelOf(q);
      renderSelect();
      const ch = $('challenge');
      ch.hidden = false;
      ch.textContent = `挑戦状が届いた！ お題「${q}」`;
      $('btn-other').hidden = false;
      $('btn-start').textContent = 'この題に挑む';
    }
  } catch (_) { /* noop */ }

  show('title');
  $('loading').classList.add('done');
  requestAnimationFrame(frame);
}

boot();

