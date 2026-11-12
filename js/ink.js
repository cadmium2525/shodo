// 墨キャンバス（筆跡・足跡・かすれ）と濡れ墨グリッド。
// 紙のワールド座標: x ∈ [-W/2, W/2]（右が +）、z ∈ [-H/2, H/2]（手前が +）。
// キャンバス座標: 左上原点（z = -H/2 が上端）。
import { config as C } from './config.js';
import { clamp, lerp } from './util.js';
import { makePaperCanvas, drawOdai } from './odai.js';

const INK = '13,11,10';
const BRISTLES = 22;

export class InkLayer {
  constructor(layout, paperW, paperH, rng) {
    this.layout = layout;
    this.W = paperW;
    this.H = paperH;
    this.rng = rng;
    this.canvas = makePaperCanvas(layout, C.INK_CANVAS_LONG);
    this.ctx = this.canvas.getContext('2d');
    this.ppu = this.canvas.width / paperW; // px / ワールド単位
    // 濡れ墨グリッド（どの一画の墨か。0 = 乾いた紙）
    const long = C.WET_GRID_LONG;
    if (layout.aspect >= 1) { this.gw = long; this.gh = Math.round(long / layout.aspect); }
    else { this.gh = long; this.gw = Math.round(long * layout.aspect); }
    this.wet = new Uint16Array(this.gw * this.gh);
    this.strokeId = 0;
    this.dirty = true;
    this.dirtyRect = null; // null = 全面
    this.dry = new Float32Array(BRISTLES);
    for (let i = 0; i < BRISTLES; i++) this.dry[i] = rng();
    this.r = C.BRUSH_RADIUS;
    this.nijimi = 1;
    this.last = null;
    this.stats = { stampDist: 0, footprints: 0, splatters: 0, offPaperDist: 0 };
  }

  /** 描き換えた範囲を記録（テクスチャの部分更新用） */
  touch(px, py, r) {
    if (this.dirty && this.dirtyRect === null) return;
    const x0 = Math.max(0, Math.floor(px - r - 2));
    const y0 = Math.max(0, Math.floor(py - r - 2));
    const x1 = Math.min(this.canvas.width, Math.ceil(px + r + 2));
    const y1 = Math.min(this.canvas.height, Math.ceil(py + r + 2));
    if (x1 <= x0 || y1 <= y0) return;
    if (!this.dirty) {
      this.dirtyRect = { x0, y0, x1, y1 };
    } else {
      const d = this.dirtyRect;
      d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0);
      d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1);
    }
    this.dirty = true;
  }

  markAllDirty() {
    this.dirty = true;
    this.dirtyRect = null;
  }

  toPx(x, z) {
    return [(x + this.W / 2) * this.ppu, (z + this.H / 2) * this.ppu];
  }

  onPaper(x, z, pad = 0) {
    return x >= -this.W / 2 - pad && x <= this.W / 2 + pad && z >= -this.H / 2 - pad && z <= this.H / 2 + pad;
  }

  /** 紙座標 0..1 */
  toUV(x, z) {
    return [(x + this.W / 2) / this.W, (z + this.H / 2) / this.H];
  }

  markWet(x, z, r, id) {
    const [u, v] = this.toUV(x, z);
    const cx = u * this.gw;
    const cy = v * this.gh;
    const rc = (r / this.W) * this.gw;
    const x0 = Math.max(0, Math.floor(cx - rc));
    const x1 = Math.min(this.gw - 1, Math.ceil(cx + rc));
    const y0 = Math.max(0, Math.floor(cy - rc));
    const y1 = Math.min(this.gh - 1, Math.ceil(cy + rc));
    const r2 = rc * rc;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.wet[y * this.gw + x] = id;
      }
    }
  }

  /** 足元のセル（周囲 1 セル含む）に乾いていない墨があれば、その一画の id を返す（複数なら最大） */
  wetAt(x, z, ignore = []) {
    const [u, v] = this.toUV(x, z);
    const cx = Math.floor(u * this.gw);
    const cy = Math.floor(v * this.gh);
    for (let y = cy - 1; y <= cy + 1; y++) {
      if (y < 0 || y >= this.gh) continue;
      for (let x2 = cx - 1; x2 <= cx + 1; x2++) {
        if (x2 < 0 || x2 >= this.gw) continue;
        const id = this.wet[y * this.gw + x2];
        if (id && !ignore.includes(id)) return id;
      }
    }
    return 0;
  }

  /** 1 回のスタンプ。kasure 0..1（1 でほぼ何も出ない） */
  stamp(x, z, r, angle, kasure, alpha = 0.93) {
    const g = this.ctx;
    const [px, py] = this.toPx(x, z);
    const rp = r * this.ppu;
    if (kasure <= 0.02) {
      g.fillStyle = `rgba(${INK},${alpha})`;
      g.beginPath();
      g.arc(px, py, rp, 0, Math.PI * 2);
      g.fill();
    } else {
      // 穂先を BRISTLES 本の毛に分け、乾いた毛は描かない → 筋状のかすれ
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      const br = Math.max(0.6, rp * 0.13);
      g.fillStyle = `rgba(${INK},${alpha * (1 - kasure * 0.35)})`;
      for (let i = 0; i < BRISTLES; i++) {
        if (this.dry[i] < kasure) continue;
        const t = (i / (BRISTLES - 1)) * 2 - 1;
        g.beginPath();
        g.arc(px + nx * t * rp, py + ny * t * rp, br, 0, Math.PI * 2);
        g.fill();
      }
      // 毛の乾き具合はゆっくり変わる
      for (let i = 0; i < BRISTLES; i++) {
        this.dry[i] = clamp(this.dry[i] + (this.rng() - 0.5) * 0.06, 0, 1);
      }
    }
    if (kasure < 0.85) this.markWet(x, z, r * 0.9, this.strokeId);
    this.touch(px, py, rp);
  }

  kasureFor(ink) {
    if (ink <= 0) return 1;
    return clamp((C.KASURE_START - ink) / C.KASURE_START, 0, 1) * 0.92;
  }

  radiusFor(speed, ink) {
    const s = clamp(speed / C.MAX_SPEED, 0, 1);
    let r = C.BRUSH_RADIUS * lerp(C.BRUSH_SLOW_GAIN, C.BRUSH_FAST_GAIN, s);
    if (ink < C.INK_THIN_START) r *= 0.45 + 0.55 * (ink / C.INK_THIN_START);
    return r;
  }

  /** 筆を下ろした瞬間。新しい一画を開始し、墨だまりを作る。消費した墨量を返す */
  begin(x, z, ink) {
    this.strokeId = (this.strokeId % 65000) + 1;
    this.last = { x, z };
    this.nijimi = 1;
    if (ink <= 0) return 0;
    const r = this.radiusFor(0, ink) * C.POOLING_GAIN;
    this.r = this.radiusFor(0, ink);
    const k = this.kasureFor(ink);
    // 少しいびつな墨だまり
    for (let i = 0; i < 5; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = this.rng() * r * 0.25;
      this.stamp(x + Math.cos(a) * d, z + Math.sin(a) * d, r * (0.75 + this.rng() * 0.25), a, k);
    }
    return 2.5;
  }

  /** 筆先が (x,z) まで動いた。消費した墨量を返す */
  move(x, z, speed, ink, dt) {
    if (!this.last) return this.begin(x, z, ink);
    const lx = this.last.x;
    const lz = this.last.z;
    const dx = x - lx;
    const dz = z - lz;
    const dist = Math.hypot(dx, dz);
    let used = 0;
    if (ink <= 0) {
      this.last = { x, z };
      this.nijimi = 1;
      return 0;
    }
    if (speed < 0.18) {
      // 止まっている → にじんで太る
      this.nijimi = Math.min(C.NIJIMI_MAX, this.nijimi + C.NIJIMI_RATE * dt);
      if (this.nijimi > 1.05) {
        const g = this.ctx;
        const [px, py] = this.toPx(x, z);
        const rr = this.r * this.nijimi * this.ppu;
        const grd = g.createRadialGradient(px, py, rr * 0.4, px, py, rr);
        grd.addColorStop(0, `rgba(${INK},0.16)`);
        grd.addColorStop(1, `rgba(${INK},0)`);
        g.fillStyle = grd;
        g.beginPath();
        g.arc(px, py, rr, 0, Math.PI * 2);
        g.fill();
        this.touch(px, py, rr);
        this.stamp(x, z, this.r * (1 + (this.nijimi - 1) * 0.75), 0, this.kasureFor(ink), 0.25);
        this.markWet(x, z, this.r * this.nijimi * 0.8, this.strokeId);
        used += C.NIJIMI_INK_PER_SEC * dt;
      }
    } else {
      this.nijimi = Math.max(1, this.nijimi - dt * 3);
    }
    if (dist < 1e-4) return used;
    const targetR = this.radiusFor(speed, ink) * this.nijimi;
    const angle = Math.atan2(dz, dx);
    const k = this.kasureFor(ink);
    const r0 = this.r;
    const spacing = Math.max(0.006, Math.min(r0, targetR) * (k > 0.02 ? 0.12 : 0.22));
    const n = Math.max(1, Math.ceil(dist / spacing));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const r = lerp(r0, targetR, t);
      this.stamp(lx + dx * t, lz + dz * t, r, angle, k);
    }
    this.r = targetR;
    used += dist * (targetR / C.BRUSH_RADIUS) * C.INK_PER_UNIT;
    this.stats.stampDist += dist;
    if (!this.onPaper(x, z)) this.stats.offPaperDist += dist;
    // 飛沫: 速いほど起きやすい
    const sf = clamp(speed / C.MAX_SPEED, 0, 1);
    if (k < 0.6 && this.rng() < C.SPLATTER_CHANCE * dist * (1 + 4 * sf * sf)) {
      this.splatter(x, z, angle);
    }
    this.last = { x, z };
    return used;
  }

  splatter(x, z, angle) {
    const n = 3 + Math.floor(this.rng() * 6);
    const g = this.ctx;
    for (let i = 0; i < n; i++) {
      const a = angle + (this.rng() - 0.5) * 1.6;
      const d = 0.25 + this.rng() * 0.7;
      const [px, py] = this.toPx(x + Math.cos(a) * d, z + Math.sin(a) * d);
      g.fillStyle = `rgba(${INK},0.9)`;
      g.beginPath();
      g.arc(px, py, (0.015 + this.rng() * 0.045) * this.ppu, 0, Math.PI * 2);
      g.fill();
      this.touch(px, py, 0.07 * this.ppu);
    }
    this.stats.splatters++;
  }

  end() {
    this.last = null;
    this.nijimi = 1;
  }

  /** 草履型の足跡（濡れ墨グリッドには登録しない） */
  footprint(x, z, angle, footInk) {
    if (!this.onPaper(x, z, 0.1)) return false;
    const g = this.ctx;
    const [px, py] = this.toPx(x, z);
    const L = C.FOOT_LEN * this.ppu;
    const Wd = C.FOOT_WIDTH * this.ppu;
    g.save();
    g.translate(px, py);
    g.rotate(angle);
    const a = 0.25 + 0.65 * clamp(footInk, 0, 1);
    g.fillStyle = `rgba(${INK},${a})`;
    // つま先側（鼻緒の隙間を挟んで 2 つの楕円）
    g.beginPath();
    g.ellipse(L * 0.2, 0, L * 0.3, Wd * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-L * 0.27, 0, L * 0.22, Wd * 0.44, 0, 0, Math.PI * 2);
    g.fill();
    // ざらつき
    g.fillStyle = 'rgba(0,0,0,0)';
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(0,0,0,${0.3 + this.rng() * 0.4})`;
      g.beginPath();
      g.arc((this.rng() - 0.5) * L * 0.9, (this.rng() - 0.5) * Wd * 0.8, Wd * (0.06 + this.rng() * 0.1), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    this.touch(px, py, L);
    this.stats.footprints++;
    return true;
  }

  /** お題どおりの墨を描く（テスト用） */
  drawTarget() {
    drawOdai(this.ctx, this.canvas.width, this.canvas.height, this.layout, `rgb(${INK})`);
    // 濡れ墨グリッドにも登録
    const s = document.createElement('canvas');
    s.width = this.gw;
    s.height = this.gh;
    const sg = s.getContext('2d', { willReadFrequently: true });
    sg.drawImage(this.canvas, 0, 0, this.gw, this.gh);
    const d = sg.getImageData(0, 0, this.gw, this.gh).data;
    for (let i = 0; i < this.wet.length; i++) if (d[i * 4 + 3] > 60) this.wet[i] = 65001;
    this.markAllDirty();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.wet.fill(0);
    this.markAllDirty();
  }
}
