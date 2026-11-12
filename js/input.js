// キーボード + 仮想ジョイスティック（タッチした位置に出現）+ 筆ボタン。
// get() は画面基準の {x, y, brush}（x+ 右、y+ 手前 = 画面下）を返す。

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

export class Input {
  constructor({ zone, joyBase, joyKnob, brushBtn, onFinish }) {
    this.keys = new Set();
    this.override = null;
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.brushTouch = false;
    this.enabled = false;
    this.onFinish = onFinish;
    this.zone = zone;
    this.joyBase = joyBase;
    this.joyKnob = joyKnob;
    this.radius = 56;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'Enter' && !e.repeat) {
        e.preventDefault();
        this.onFinish?.();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (this.enabled && (e.code === 'Space' || e.code === 'Enter')) e.preventDefault();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.brushTouch = false; this.endJoy(); });

    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joy.id !== null) return;
      e.preventDefault();
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX;
      this.joy.oy = e.clientY;
      this.joy.x = 0;
      this.joy.y = 0;
      try { zone.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      joyBase.style.left = `${e.clientX}px`;
      joyBase.style.top = `${e.clientY}px`;
      joyBase.classList.add('on');
      this.moveKnob();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joy.id) return;
      e.preventDefault();
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) { dx *= this.radius / d; dy *= this.radius / d; }
      this.joy.x = dx / this.radius;
      this.joy.y = dy / this.radius;
      this.moveKnob();
    });
    const end = (e) => { if (e.pointerId === this.joy.id) this.endJoy(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const down = (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      this.brushTouch = true;
      brushBtn.classList.add('on');
      try { brushBtn.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    };
    const up = () => { this.brushTouch = false; brushBtn.classList.remove('on'); };
    brushBtn.addEventListener('pointerdown', down);
    brushBtn.addEventListener('pointerup', up);
    brushBtn.addEventListener('pointercancel', up);
    brushBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  moveKnob() {
    this.joyKnob.style.transform = `translate(${this.joy.x * this.radius}px, ${this.joy.y * this.radius}px)`;
  }

  endJoy() {
    this.joy.id = null;
    this.joy.x = 0;
    this.joy.y = 0;
    this.joyBase.classList.remove('on');
  }

  reset() {
    this.keys.clear();
    this.brushTouch = false;
    this.endJoy();
  }

  has(list) { return list.some((k) => this.keys.has(k)); }

  get() {
    let x = 0;
    let y = 0;
    if (this.has(KEYS.left)) x -= 1;
    if (this.has(KEYS.right)) x += 1;
    if (this.has(KEYS.up)) y -= 1;
    if (this.has(KEYS.down)) y += 1;
    if (this.joy.id !== null) { x += this.joy.x; y += this.joy.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    let brush = this.keys.has('Space') || this.brushTouch;
    const o = this.override;
    if (o) {
      if (o.x !== null && o.x !== undefined) x = o.x;
      if (o.y !== null && o.y !== undefined) y = o.y;
      if (o.brush !== null && o.brush !== undefined) brush = !!o.brush;
    }
    return { x, y, brush };
  }
}
