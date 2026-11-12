// 酔っ払いのモデル生成・アニメ・千鳥足の物理。
import * as THREE from 'three';
import { config as C } from './config.js';
import { clamp, angleDiff, lerp } from './util.js';
import { blobShadowCanvas, labelCanvas } from './textures.js';
import { FONT_FAMILY } from './util.js';

const HAND = new THREE.Vector3(0, 0.95, 0.3);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
}

/** 低ポリの酔っ払い人形。前方 = ローカル +Z */
export function buildDrunkModel() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 揺れ・傾き用
  root.add(body);

  const indigo = mat('#283a63');
  const kimono = mat('#efe8d6');
  const skin = mat('#f19a83', { roughness: 0.55 });
  const red = mat('#d0262f');
  const white = mat('#ffffff');

  // 袴
  const hakama = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.72, 10), indigo);
  hakama.position.y = 0.36;
  body.add(hakama);
  // 帯
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.12, 12), mat('#7a1b1b'));
  obi.position.y = 0.76;
  body.add(obi);
  // 上衣（作務衣）
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.55, 10), kimono);
  torso.position.y = 1.0;
  body.add(torso);
  // 襟（V 字の黒）
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.04), mat('#222'));
  collar.position.set(0.05, 1.08, 0.24);
  collar.rotation.z = 0.5;
  body.add(collar);
  const collar2 = collar.clone();
  collar2.position.x = -0.05;
  collar2.rotation.z = -0.5;
  body.add(collar2);

  // 頭（つるつる赤ら顔）
  const headG = new THREE.Group();
  headG.position.y = 1.45;
  body.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  headG.add(head);
  // ほっぺとハナ（真っ赤）
  const cheekMat = mat('#ff4a4a', { roughness: 0.5 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), cheekMat);
  nose.position.set(0, -0.02, 0.2);
  headG.add(nose);
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), cheekMat);
    cheek.scale.set(1, 0.6, 0.5);
    cheek.position.set(s * 0.11, -0.04, 0.16);
    headG.add(cheek);
    // 目（へにゃっとした線）
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), mat('#1a1a1a'));
    eye.position.set(s * 0.075, 0.04, 0.195);
    eye.rotation.z = s * 0.35;
    headG.add(eye);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), skin);
    ear.position.set(s * 0.205, 0, 0);
    headG.add(ear);
  }
  // ねじり鉢巻（紅白のねじり）
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.035, 6, 24), red);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.06;
  headG.add(band);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tw = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.075), white);
    tw.position.set(Math.cos(a) * 0.215, 0.06, Math.sin(a) * 0.215);
    tw.rotation.y = -a;
    tw.rotation.x = 0.6;
    headG.add(tw);
  }
  // 結び目と垂れ（後頭部）
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), red);
  knot.position.set(0, 0.06, -0.22);
  headG.add(knot);
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.2), red);
    tail.position.set(s * 0.05, 0.05, -0.32);
    tail.rotation.y = s * 0.4;
    headG.add(tail);
  }

  // 足（足袋＋草履）
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    const zori = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.3), mat('#c8a46a'));
    zori.position.y = 0.015;
    f.add(zori);
    const tabi = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.22), white);
    tabi.position.set(0, 0.07, 0.01);
    f.add(tabi);
    f.position.set(s * C.FOOT_SPACING, 0, 0);
    root.add(f);
    feet.push(f);
  }

  // 腕（肩→手）
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.27, 1.18, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 6), kimono);
    upper.position.y = -0.25;
    arm.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), skin);
    hand.position.y = -0.5;
    arm.add(hand);
    body.add(arm);
    arms.push(arm);
  }

  // 巨大な筆（ピボット = 手の位置、+Z 方向に伸びる）
  const brush = new THREE.Group();
  brush.position.copy(HAND);
  body.add(brush);
  const L = Math.hypot(C.TIP_OFFSET - HAND.z, HAND.y - 0.02);
  const handleLen = L + 0.45 - 0.36;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, handleLen, 8), mat('#b98a3e', { roughness: 0.5 }));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = -0.45 + handleLen / 2;
  brush.add(handle);
  // 竹の節
  for (const z of [-0.3, 0.1, 0.5]) {
    const node = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 4, 10), mat('#8a6328'));
    node.position.z = z;
    brush.add(node);
  }
  // 穂（根元は白、先は墨）
  const bristleWhite = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.18, 10), mat('#f2eee3'));
  bristleWhite.rotation.x = Math.PI / 2;
  bristleWhite.position.z = L - 0.27;
  brush.add(bristleWhite);
  const tipMat = mat('#111', { roughness: 0.25 });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 10), tipMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = L - 0.09;
  brush.add(tip);

  return { root, body, headG, feet, arms, brush, tipMat, brushLen: L };
}

const DOWN_ANGLE = Math.atan2(HAND.y - 0.02, C.TIP_OFFSET - HAND.z);

export class Player {
  constructor(rng) {
    this.rng = rng;
    this.model = buildDrunkModel();
    this.group = new THREE.Group();
    this.group.add(this.model.root);
    // ブロブシャドウ
    const shTex = new THREE.CanvasTexture(blobShadowCanvas());
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 5;
    this.shadow = shadow;
    this.group.add(shadow);
    // 「ヒック」吹き出し
    this.hicTex = null;
    this.hic = null;
    this.reset(0, 0);
  }

  makeHiccupSprite() {
    if (this.hic) return;
    this.hicTex = new THREE.CanvasTexture(labelCanvas('ヒック', { size: 84, color: '#fff', stroke: '#b3142a', fontFamily: FONT_FAMILY }));
    this.hicTex.colorSpace = THREE.SRGBColorSpace;
    this.hic = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.hicTex, transparent: true, depthTest: false }));
    this.hic.scale.set(1.4, 0.7, 1);
    this.hic.renderOrder = 20;
    this.hic.visible = false;
    this.group.add(this.hic);
  }

  reset(x, z) {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.heading = -Math.PI / 2; // 画面奥向き
    this.t = 0;
    this.phases = [0, 1, 2, 3, 4].map(() => this.rng() * Math.PI * 2);
    this.stagger = { state: 'idle', timer: this.nextStagger(1), dir: 0, dur: 0, lean: 0 };
    this.hiccupTimer = lerp(C.HICCUP_INTERVAL[0], C.HICCUP_INTERVAL[1], this.rng());
    this.hiccupAnim = 0;
    this.stepAcc = 0;
    this.side = 1;
    this.walkPhase = 0;
    this.brushDown = false;
    this.brushLift = 1; // 1 = 上がっている
    this.banzai = 0;
    this.banzaiOn = false;
    this.lastSpeed = 0;
    this.syncModel(0);
  }

  nextStagger(drunk) {
    const d = Math.max(0.2, drunk);
    return lerp(C.STAGGER_INTERVAL[0], C.STAGGER_INTERVAL[1], this.rng()) / d;
  }

  tip() {
    return {
      x: this.x + Math.cos(this.heading) * C.TIP_OFFSET,
      z: this.z + Math.sin(this.heading) * C.TIP_OFFSET,
    };
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,brush:boolean}} inp 画面基準（y+ が手前）
   * @param {number} drunk 酔い度
   * @param {{minX,maxX,minZ,maxZ}} bounds
   * @returns {{steps:Array, hiccup:boolean, staggerStart:boolean}}
   */
  update(dt, inp, drunk, bounds, frozen = false) {
    const ev = { steps: [], hiccup: false, staggerStart: false };
    this.t += dt;
    const t = this.t;
    const P = this.phases;
    let ix = frozen ? 0 : inp.x;
    let iy = frozen ? 0 : inp.y;
    const len = Math.hypot(ix, iy);
    const mag = Math.min(1, len);
    if (len > 1e-3) { ix /= len; iy /= len; } else { ix = 0; iy = 0; }

    // ふらつき: 低周波の sin の重ね合わせで進行方向を回す
    let n = 0;
    let wsum = 0;
    C.WOBBLE_FREQS.forEach((f, i) => {
      const w = C.WOBBLE_WEIGHTS[i] ?? 0;
      n += w * Math.sin(Math.PI * 2 * f * t + P[i]);
      wsum += w;
    });
    n /= wsum || 1;
    const wob = drunk * (C.WOBBLE_AMP_DEG * Math.PI / 180) * clamp(n * 1.35, -1, 1);
    const cw = Math.cos(wob);
    const sw = Math.sin(wob);
    const speedMul = 1 + C.SPEED_WOBBLE * drunk * Math.sin(Math.PI * 2 * 0.83 * t + P[3]);
    let dvx = (ix * cw - iy * sw) * C.MAX_SPEED * mag * speedMul;
    let dvz = (ix * sw + iy * cw) * C.MAX_SPEED * mag * speedMul;
    let accel = C.ACCEL;

    // よろけ
    const st = this.stagger;
    if (drunk > 0.01 && !frozen) {
      st.timer -= dt;
      if (st.state === 'idle' && st.timer <= 0) {
        st.state = 'warn';
        st.timer = C.STAGGER_WARN;
        const side = this.rng.sign();
        st.dir = this.heading + side * (Math.PI / 2 + (this.rng() - 0.5) * 1.0);
        st.dur = lerp(C.STAGGER_DURATION[0], C.STAGGER_DURATION[1], this.rng());
      } else if (st.state === 'warn' && st.timer <= 0) {
        st.state = 'go';
        st.timer = st.dur;
        ev.staggerStart = true;
      } else if (st.state === 'go') {
        const sp = C.STAGGER_SPEED * drunk;
        const wIn = C.STAGGER_INPUT_WEIGHT;
        dvx = dvx * wIn + Math.cos(st.dir) * sp;
        dvz = dvz * wIn + Math.sin(st.dir) * sp;
        accel = 9;
        if (st.timer <= 0) {
          st.state = 'idle';
          st.timer = this.nextStagger(drunk);
        }
      }
    } else {
      st.state = 'idle';
    }
    const leanTarget = st.state === 'warn' ? 0.22 * (1 - st.timer / C.STAGGER_WARN) : st.state === 'go' ? 0.32 : 0;
    st.lean = lerp(st.lean, leanTarget, 1 - Math.exp(-10 * dt));

    // しゃっくり
    if (drunk > 0.01 && !frozen) {
      this.hiccupTimer -= dt;
      if (this.hiccupTimer <= 0) {
        this.hiccupTimer = lerp(C.HICCUP_INTERVAL[0], C.HICCUP_INTERVAL[1], this.rng());
        const a = this.rng() * Math.PI * 2;
        this.vx += Math.cos(a) * C.HICCUP_JOLT * drunk;
        this.vz += Math.sin(a) * C.HICCUP_JOLT * drunk;
        this.hiccupAnim = 1;
        ev.hiccup = true;
      }
    }
    this.hiccupAnim = Math.max(0, this.hiccupAnim - dt * 1.1);

    // 慣性つき追従
    const k = 1 - Math.exp(-accel * dt);
    this.vx += (dvx - this.vx) * k;
    this.vz += (dvz - this.vz) * k;

    // 立ち止まっても円を描くように流される
    const fd = C.IDLE_DRIFT_FREQ;
    const da = Math.PI * 2 * fd * t + 0.8 * Math.sin(0.37 * t + P[4]);
    const drift = frozen ? 0 : drunk * C.IDLE_DRIFT_SPEED;
    const ddx = Math.cos(da) * drift;
    const ddz = Math.sin(da) * drift;

    const ox = this.x;
    const oz = this.z;
    this.x += (this.vx + ddx) * dt;
    this.z += (this.vz + ddz) * dt;
    // 舞台の端で止まる
    if (this.x < bounds.minX) { this.x = bounds.minX; this.vx = Math.max(0, this.vx); }
    if (this.x > bounds.maxX) { this.x = bounds.maxX; this.vx = Math.min(0, this.vx); }
    if (this.z < bounds.minZ) { this.z = bounds.minZ; this.vz = Math.max(0, this.vz); }
    if (this.z > bounds.maxZ) { this.z = bounds.maxZ; this.vz = Math.min(0, this.vz); }
    const moved = Math.hypot(this.x - ox, this.z - oz);
    const speed = moved / Math.max(dt, 1e-4);
    this.lastSpeed = speed;

    // 向き: 自分の足で進んでいる方向へ（流されている分は少しだけ）
    // 筆を下ろしている間は筆が重く、体の向きはゆっくりしか変わらない（横歩きで線が引ける）
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.25) {
      const target = Math.atan2(this.vz, this.vx);
      const rate = inp.brush && !frozen ? C.TURN_RATE_BRUSH : C.TURN_RATE;
      this.heading += angleDiff(this.heading, target) * Math.min(1, rate * dt * clamp(sp / 1.2, 0.3, 1));
    }

    // 一歩ごとのイベント（立ち止まりの流されは半分の重み）
    this.stepAcc += Math.hypot(this.vx, this.vz) * dt + drift * dt * 0.5;
    this.walkPhase += moved * 7.5;
    if (this.stepAcc >= C.STRIDE) {
      this.stepAcc -= C.STRIDE;
      this.side = -this.side;
      const px = -Math.sin(this.heading);
      const pz = Math.cos(this.heading);
      ev.steps.push({
        x: this.x + px * C.FOOT_SPACING * this.side + Math.cos(this.heading) * 0.08,
        z: this.z + pz * C.FOOT_SPACING * this.side + Math.sin(this.heading) * 0.08,
        angle: this.heading + (this.rng() - 0.5) * 0.3 * drunk,
        side: this.side,
      });
    }

    this.brushDown = !!inp.brush && !frozen;
    this.syncModel(dt);
    return ev;
  }

  setBanzai(on) { this.banzaiOn = on; }

  syncModel(dt) {
    const m = this.model;
    this.group.position.set(this.x, 0, this.z);
    m.root.rotation.y = Math.PI / 2 - this.heading;
    // 歩行の揺れ・よろけの傾き
    const sway = Math.sin(this.walkPhase) * 0.1 + Math.sin(this.t * 1.7) * 0.05;
    m.body.rotation.z = sway + this.stagger.lean * Math.sign(Math.sin(this.stagger.dir - this.heading) || 1) * -1;
    m.body.rotation.x = Math.sin(this.t * 1.1) * 0.04;
    const hop = Math.sin(this.hiccupAnim * Math.PI) * 0.25;
    m.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05 + hop;
    m.headG.rotation.z = Math.sin(this.t * 2.3) * 0.15;
    // 足の前後運動
    const fs = Math.sin(this.walkPhase);
    m.feet[0].position.z = fs * 0.14;
    m.feet[1].position.z = -fs * 0.14;
    m.feet[0].position.y = Math.max(0, -fs) * 0.06;
    m.feet[1].position.y = Math.max(0, fs) * 0.06;
    // 筆の上げ下げ
    const target = this.brushDown ? 0 : 1;
    this.brushLift = lerp(this.brushLift, target, 1 - Math.exp(-14 * (dt || 0.016)));
    this.banzai = lerp(this.banzai, this.banzaiOn ? 1 : 0, 1 - Math.exp(-6 * (dt || 0.016)));
    const down = DOWN_ANGLE;
    const up = 0.25;
    m.brush.rotation.x = lerp(lerp(down, up, this.brushLift), -1.2, this.banzai);
    m.brush.position.y = HAND.y + this.banzai * 0.8;
    m.brush.position.z = HAND.z - this.banzai * 0.2;
    // 腕は筆を抱える → 万歳で上へ
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const arm = m.arms[i];
      arm.rotation.x = lerp(-0.9 - (1 - this.brushLift) * 0.3, -3.0, this.banzai);
      arm.rotation.z = lerp(s * -0.35, s * 0.25, this.banzai);
    }
    if (this.hic) {
      this.hic.visible = this.hiccupAnim > 0;
      this.hic.position.set(0.4, 2.2 + (1 - this.hiccupAnim) * 0.4, -0.2);
      this.hic.material.opacity = clamp(this.hiccupAnim * 2, 0, 1);
    }
  }
}
