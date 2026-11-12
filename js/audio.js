// WebAudio による合成サウンド（太鼓・筆の擦過音・歓声風ノイズ・足音・ちゃぷ・しゃっくり）。
// AudioContext は最初のユーザー操作で start() を呼んでから作る。
import { storageGet, storageSet } from './util.js';

class Sound {
  constructor() {
    this.ctx = null;
    this.muted = storageGet('shodo.muted', '0') === '1';
    this.brushGain = null;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (_) {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);
    // ノイズバッファ
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 筆の擦過音（常時ループ、ゲインで出し入れ）
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    this.brushFilter = bp;
    this.brushGain = ctx.createGain();
    this.brushGain.gain.value = 0;
    src.connect(bp).connect(this.brushGain).connect(this.master);
    src.start();
  }

  setMuted(m) {
    this.muted = m;
    storageSet('shodo.muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  get ok() { return !!this.ctx && !this.muted; }

  noiseBurst(t, dur, { freq = 1000, q = 1, type = 'bandpass', gain = 0.5, attack = 0.005 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return { src, f, g };
  }

  tone(t, dur, f0, f1, { type = 'sine', gain = 0.5, attack = 0.004 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** 太鼓。strength 0..1 */
  taiko(strength = 1, delay = 0, pitch = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    this.tone(t, 0.9 * strength + 0.2, 110 * pitch, 48 * pitch, { gain: 0.9 * strength });
    this.tone(t, 0.25, 220 * pitch, 90 * pitch, { gain: 0.25 * strength, type: 'triangle' });
    this.noiseBurst(t, 0.12, { freq: 700, q: 0.8, gain: 0.35 * strength });
  }

  /** 「ドン！」 */
  don() {
    this.taiko(1, 0, 0.95);
    this.taiko(0.5, 0.0, 1.5);
  }

  /** カッ（縁打ち） */
  ka(delay = 0) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    this.noiseBurst(t, 0.05, { freq: 3200, q: 3, gain: 0.25 });
    this.tone(t, 0.05, 1400, 900, { gain: 0.1, type: 'square' });
  }

  step(onPaper) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    if (onPaper) this.noiseBurst(t, 0.07, { freq: 1800, q: 1.2, gain: 0.05 });
    else this.tone(t, 0.08, 160, 70, { gain: 0.08 });
  }

  chapu() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone(t, 0.12, 380, 1100, { gain: 0.25 });
    this.tone(t + 0.07, 0.1, 600, 1500, { gain: 0.15 });
    this.noiseBurst(t, 0.18, { freq: 900, q: 2, gain: 0.12 });
  }

  hiccup() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.tone(t, 0.12, 500, 1100, { gain: 0.18, type: 'triangle' });
  }

  splash() {
    if (!this.ok) return;
    this.noiseBurst(this.ctx.currentTime, 0.1, { freq: 2600, q: 1.5, gain: 0.08 });
  }

  /** 筆の擦過音。level 0..1 */
  setBrush(level) {
    if (!this.brushGain) return;
    const t = this.ctx.currentTime;
    this.brushGain.gain.setTargetAtTime(this.muted ? 0 : level * 0.22, t, 0.04);
    this.brushFilter.frequency.setTargetAtTime(1600 + level * 2400, t, 0.05);
  }

  /** 歓声風ノイズ */
  cheer(dur = 3) {
    if (!this.ok) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 600 + i * 450;
      f.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
      g.gain.setValueAtTime(0.12, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      // ざわめきの揺らぎ
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 3 + i * 1.7;
      const lg = ctx.createGain();
      lg.gain.value = 0.05;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random());
      lfo.start(t);
      src.stop(t + dur + 0.1);
      lfo.stop(t + dur + 0.1);
    }
    // 拍手（パチパチ）
    for (let i = 0; i < 40; i++) {
      this.noiseBurst(t + Math.random() * dur * 0.8, 0.03, { freq: 2000 + Math.random() * 1500, q: 1, gain: 0.08 + Math.random() * 0.08 });
    }
  }

  /** ドラムロール */
  drumroll(dur = 1.6) {
    if (!this.ok) return;
    let tt = 0;
    while (tt < dur) {
      this.taiko(0.25 + (tt / dur) * 0.35, tt, 1.3);
      tt += 0.06;
    }
    this.taiko(1, dur, 0.9);
    this.ka(dur + 0.25);
  }
}

export const sound = new Sound();
