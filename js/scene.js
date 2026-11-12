// three.js の舞台（床・紙・下書き・墨・硯・足ふきマット・ライト・カメラ）。
import * as THREE from 'three';
import { config as C } from './config.js';
import { washiCanvas, woodFloorCanvas, matCanvas, labelCanvas } from './textures.js';
import { FONT_FAMILY } from './util.js';

const _box = new THREE.Box2();
const _pos = new THREE.Vector2();

export function createRenderer(canvasEl) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function tex(canvas, { repeat = null, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/**
 * 見下ろしカメラを、box（ワールド XZ の矩形）が HUD を避けた領域に収まるよう合わせる。
 * setViewOffset で HUD のぶん画面上の中心をずらす。
 */
export function fitCamera(cam, box, W, H, insetTop, insetBottom, tiltDeg, { margin = 0.94, front = false, height = 0 } = {}) {
  const Havail = Math.max(120, H - insetTop - insetBottom);
  cam.aspect = W / Havail;
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
  const tilt = (tiltDeg * Math.PI) / 180;
  const cx = (box.minX + box.maxX) / 2;
  let cz = (box.minZ + box.maxZ) / 2;
  const corners = [];
  for (const x of [box.minX, box.maxX]) {
    for (const z of [box.minZ, box.maxZ]) {
      for (const y of [0, height]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  const v = new THREE.Vector3();
  const place = (d, tz) => {
    if (front) {
      // 正面から少し見上げ/見下ろし（結果画面用）
      cam.position.set(cx, (box.camY ?? 1.5) + Math.sin(tilt) * d, tz + Math.cos(tilt) * d);
      cam.lookAt(cx, (box.camY ?? 1.5), tz);
    } else {
      cam.position.set(cx, Math.cos(tilt) * d, tz + Math.sin(tilt) * d);
      cam.lookAt(cx, 0, tz);
    }
    cam.updateMatrixWorld(true);
  };
  const extents = () => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const c of corners) {
      v.copy(c).project(cam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { x0, x1, y0, y1 };
  };
  let d = 10;
  for (let iter = 0; iter < 4; iter++) {
    let lo = 0.5;
    let hi = 400;
    for (let i = 0; i < 30; i++) {
      d = (lo + hi) / 2;
      place(d, cz);
      const e = extents();
      const fits = e.x0 >= -margin && e.x1 <= margin && e.y0 >= -margin && e.y1 <= margin && (e.y1 - e.y0) < 2 * margin && (e.x1 - e.x0) < 2 * margin;
      if (fits) hi = d; else lo = d;
    }
    d = hi;
    place(d, cz);
    const e = extents();
    const yc = (e.y0 + e.y1) / 2;
    const worldPerNdc = d * Math.tan((cam.fov * Math.PI) / 360);
    if (front) cz += 0; else cz -= yc * worldPerNdc;
  }
  place(d, cz);
  cam.setViewOffset(W, Havail, 0, -insetTop, W, H);
  cam.updateProjectionMatrix();
  return d;
}

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b1310');
    this.scene.fog = new THREE.Fog('#1b1310', 30, 70);
    this.camera = new THREE.PerspectiveCamera(C.CAMERA_FOV, 1, 0.1, 200);
    this.round = new THREE.Group();
    this.scene.add(this.round);

    // ライト
    this.scene.add(new THREE.HemisphereLight('#fff6e8', '#5a3a20', 1.3));
    const key = new THREE.DirectionalLight('#fff1dc', 1.6);
    key.position.set(-4, 12, 6);
    this.scene.add(key);

    // 床
    const floorTex = tex(woodFloorCanvas(512), { repeat: [10, 10] });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.washi = washiCanvas(1024, 1024);
    this.ripples = [];
    this.marker = null;
    this.markerT = 0;
  }

  /**
   * 1 ラウンドぶんの紙・硯などを作り直す
   * @param layout odai のレイアウト
   * @param inkCanvas 墨キャンバス
   * @param guideCanvas 下書きキャンバス（null 可）
   */
  build(layout, inkCanvas, guideCanvas) {
    // 古いものを破棄
    for (const ch of [...this.round.children]) {
      this.round.remove(ch);
      ch.traverse?.((o) => {
        o.geometry?.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
        }
      });
    }
    this.ripples = [];
    const PW = layout.cols * C.CELL;
    const PH = layout.rows * C.CELL;
    this.PW = PW;
    this.PH = PH;

    // 紙（少し厚みを持たせる）
    const paperTex = tex(this.washi);
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(PW, 0.02, PH),
      new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.92 }),
    );
    paper.position.y = 0.01;
    this.round.add(paper);
    // 紙の下の毛氈（下敷き）
    const shitajiki = new THREE.Mesh(
      new THREE.BoxGeometry(PW + 0.5, 0.012, PH + 0.5),
      new THREE.MeshStandardMaterial({ color: '#2a2a33', roughness: 0.95 }),
    );
    shitajiki.position.y = 0.006;
    this.round.add(shitajiki);
    // 文鎮
    for (const s of [-1, 1]) {
      const bunchin = new THREE.Mesh(
        new THREE.BoxGeometry(PW * 0.38, 0.12, 0.22),
        new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.35, metalness: 0.4 }),
      );
      bunchin.position.set(s * PW * 0.27, 0.08, -PH / 2 - 0.05);
      this.round.add(bunchin);
    }

    const plane = new THREE.PlaneGeometry(PW, PH);
    plane.rotateX(-Math.PI / 2);
    // 下書き（表示専用レイヤー）
    this.guideMesh = null;
    if (guideCanvas) {
      const gTex = tex(guideCanvas);
      this.guideMesh = new THREE.Mesh(
        plane.clone(),
        new THREE.MeshBasicMaterial({ map: gTex, transparent: true, opacity: C.GUIDE_OPACITY, depthWrite: false }),
      );
      this.guideMesh.position.y = 0.022;
      this.guideMesh.renderOrder = 1;
      this.round.add(this.guideMesh);
    }
    // 墨（flipY なしで部分更新できるようにし、代わりに UV を上下反転）
    this.inkTex = tex(inkCanvas);
    this.inkTex.flipY = false;
    this.inkTex.anisotropy = 8;
    this.inkSrc = new THREE.Texture(inkCanvas); // 部分コピーの転送元（描画には使わない）
    this.inkFirst = true;
    const inkPlane = plane.clone();
    const uv = inkPlane.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const inkMesh = new THREE.Mesh(
      inkPlane,
      new THREE.MeshStandardMaterial({ map: this.inkTex, transparent: true, roughness: 0.35, metalness: 0.05, depthWrite: false }),
    );
    inkMesh.position.y = 0.024;
    inkMesh.renderOrder = 2;
    this.round.add(inkMesh);

    // 硯
    const sz = PH / 2 + C.SUZURI_GAP + C.SUZURI_D / 2;
    this.suzuri = { x: 0, z: sz, poolZ: sz - C.SUZURI_D / 2 + 0.2 + C.POOL_RZ };
    const shape = new THREE.Shape();
    const w = C.SUZURI_W / 2;
    const h = C.SUZURI_D / 2;
    const r = 0.3;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    const stone = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({ color: '#2a2826', roughness: 0.6, metalness: 0.1 }),
    );
    stone.rotation.x = -Math.PI / 2;
    stone.position.set(0, 0, sz);
    this.round.add(stone);
    // 陸（墨をする平らな面）
    const oka = new THREE.Mesh(
      new THREE.PlaneGeometry(C.SUZURI_W * 0.7, C.SUZURI_D * 0.38),
      new THREE.MeshStandardMaterial({ color: '#3b3835', roughness: 0.4 }),
    );
    oka.rotation.x = -Math.PI / 2;
    oka.position.set(0, 0.205, sz + C.SUZURI_D * 0.22);
    this.round.add(oka);
    // 墨池（海）
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshStandardMaterial({ color: '#030303', roughness: 0.05, metalness: 0.3 }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(C.POOL_RX, C.POOL_RZ, 1);
    pool.position.set(0, 0.206, this.suzuri.poolZ);
    this.round.add(pool);
    this.poolMesh = pool;
    // 墨池のつや（ぼんやりした映り込み）
    const shine = document.createElement('canvas');
    shine.width = 128;
    shine.height = 64;
    const sg = shine.getContext('2d');
    const grd = sg.createRadialGradient(44, 22, 2, 44, 22, 40);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = grd;
    sg.fillRect(0, 0, 128, 64);
    const gloss = new THREE.Mesh(
      new THREE.PlaneGeometry(C.POOL_RX * 1.7, C.POOL_RZ * 1.6),
      new THREE.MeshBasicMaterial({ map: tex(shine), transparent: true, depthWrite: false, opacity: 0.5 }),
    );
    gloss.rotation.x = -Math.PI / 2;
    gloss.position.set(0, 0.208, this.suzuri.poolZ);
    gloss.renderOrder = 2;
    this.round.add(gloss);
    // 墨（固形墨）
    const sumi = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.9),
      new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.4 }),
    );
    sumi.position.set(C.SUZURI_W / 2 + 0.25, 0.06, sz + 0.2);
    sumi.rotation.y = 0.3;
    this.round.add(sumi);
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.225, 0.125, 0.3),
      new THREE.MeshStandardMaterial({ color: '#c9a23a', roughness: 0.3, metalness: 0.8 }),
    );
    label.position.copy(sumi.position);
    label.rotation.y = 0.3;
    this.round.add(label);

    // 足ふきマット（硯の左右）
    const matTex = tex(matCanvas(256, '足ふき', FONT_FAMILY));
    this.mats = [];
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(C.MAT_SIZE, 0.04, C.MAT_SIZE),
        new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.95 }),
      );
      m.position.set(s * C.MAT_OFFSET_X, 0.02, sz);
      this.round.add(m);
      this.mats.push({ x: s * C.MAT_OFFSET_X, z: sz });
    }

    // 「墨↓」マーカー
    const mTex = tex(labelCanvas('墨↓', { size: 96, color: '#fff', stroke: '#b3142a', fontFamily: FONT_FAMILY }));
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: mTex, transparent: true, depthTest: false }));
    this.marker.scale.set(1.8, 0.9, 1);
    this.marker.position.set(0, 1.2, this.suzuri.poolZ);
    this.marker.renderOrder = 30;
    this.marker.visible = false;
    this.round.add(this.marker);

    // 歩ける範囲と、カメラに収める範囲
    const halfMatX = C.MAT_OFFSET_X + C.MAT_SIZE / 2;
    this.bounds = {
      minX: Math.min(-PW / 2 - C.STAGE_MARGIN_SIDE, -halfMatX - 0.2),
      maxX: Math.max(PW / 2 + C.STAGE_MARGIN_SIDE, halfMatX + 0.2),
      minZ: -PH / 2 - C.STAGE_MARGIN_TOP,
      maxZ: sz + C.SUZURI_D / 2 + C.STAGE_MARGIN_BOTTOM,
    };
    this.viewBox = {
      minX: this.bounds.minX - 0.15,
      maxX: this.bounds.maxX + 0.15,
      minZ: this.bounds.minZ - 0.3,
      maxZ: this.bounds.maxZ + 0.15,
    };
  }

  /** 墨キャンバスの変更をテクスチャへ。変わった矩形だけを転送する */
  uploadInk(renderer, ink) {
    if (!ink.dirty) return;
    const r = ink.dirtyRect;
    if (this.inkFirst || !r) {
      this.inkTex.needsUpdate = true;
      this.inkFirst = false;
    } else {
      _box.min.set(r.x0, r.y0);
      _box.max.set(r.x1, r.y1);
      _pos.set(r.x0, r.y0);
      renderer.copyTextureToTexture(this.inkSrc, this.inkTex, _box, _pos);
    }
    ink.dirty = false;
    ink.dirtyRect = null;
  }

  inPool(x, z) {
    const dx = (x - this.suzuri.x) / (C.POOL_RX + 0.2);
    const dz = (z - this.suzuri.poolZ) / (C.POOL_RZ + 0.25);
    return dx * dx + dz * dz <= 1;
  }

  onMat(x, z) {
    const h = C.MAT_SIZE / 2 + 0.05;
    return this.mats.some((m) => Math.abs(x - m.x) <= h && Math.abs(z - m.z) <= h);
  }

  ripple() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({ color: '#8a8a8a', transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.21, this.suzuri.poolZ);
    ring.renderOrder = 3;
    this.round.add(ring);
    this.ripples.push({ mesh: ring, t: 0 });
  }

  update(dt, ink, playing) {
    for (const r of this.ripples) {
      r.t += dt;
      const s = 0.15 + r.t * 0.9;
      r.mesh.scale.set(s * C.POOL_RX, s * C.POOL_RZ * 1.6, 1);
      r.mesh.material.opacity = Math.max(0, 0.8 - r.t * 0.9);
    }
    this.ripples = this.ripples.filter((r) => {
      if (r.t > 0.9) {
        this.round.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        return false;
      }
      return true;
    });
    if (this.marker) {
      this.markerT += dt;
      const show = playing && ink < C.LOW_INK_MARKER;
      this.marker.visible = show && Math.sin(this.markerT * 8) > -0.3;
      this.marker.position.y = 1.3 + Math.abs(Math.sin(this.markerT * 4)) * 0.35;
    }
  }

  fit(W, H, insetTop, insetBottom) {
    fitCamera(this.camera, this.viewBox, W, H, insetTop, insetBottom, C.CAMERA_TILT_DEG, { height: 0.4 });
  }

  /** タイトル背景用: 酔っ払いに寄ったカメラ */
  fitTitle(W, H, px, pz) {
    const box = { minX: px - 3.2, maxX: px + 3.2, minZ: pz - 3.2, maxZ: pz + 3.2 };
    fitCamera(this.camera, box, W, H, 0, 0, 28, { height: 1.6 });
  }
}
