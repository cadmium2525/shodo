// 結果画面: 金屏風の展示シーン、段位と講評。
import * as THREE from 'three';
import { config as C } from './config.js';
import { goldLeafCanvas, brocadeCanvas, feltCanvas, washiCanvas, labelCanvas } from './textures.js';
import { buildDrunkModel } from './player.js';
import { FONT_FAMILY, clamp, lerp, smooth } from './util.js';

// ---------------- 段位と講評 ----------------

export const RANKS = [
  { min: 90, name: '人間国宝（しらふ疑惑）' },
  { min: 75, name: '師範代' },
  { min: 60, name: '有段者' },
  { min: 45, name: 'ほろ酔い書家' },
  { min: 30, name: '千鳥足の新人' },
  { min: 15, name: '前衛芸術家' },
  { min: -1, name: 'ただの酔っ払い' },
];

export function rankOf(score) {
  return RANKS.find((r) => score >= r.min).name;
}

const COMMENTS = {
  '人間国宝（しらふ疑惑）': [
    '一点一画に一切の迷いなし。本当に飲んでいたのか、審査員一同いぶかしんでいる。',
    '泥酔の中にこそ真の静寂がある。千鳥足を完全に支配した、恐るべき筆致。',
    'お手本が本作を手本にすべきではないか、との声が上がっている。',
    '酒気帯びでこの完成度。もはや酒が本体で、書家はその器にすぎない。',
    '会場がどよめいた。いや、どよめいたのは本人の足元かもしれない。',
  ],
  師範代: [
    '揺れる体から放たれる筆線は、むしろ揺れを味方につけている。',
    '一升瓶の重みを感じさせる、堂々たる骨格。弟子入り志願者が列をなすだろう。',
    '時折のよろめきが、かえって画面に呼吸を与えている。',
    '酩酊と正気の境界を、筆一本で綱渡りした傑作である。',
  ],
  有段者: [
    '読める。それだけで本日いちばんの事件である。',
    '迷いの残る線にこそ、人間の温かみが宿る。熱燗のような作品だ。',
    'ところどころ別の字に見えるが、それもまた解釈の余地というものだ。',
    '酔いの波を三度乗りこなし、四度目で少しこぼした。その正直さを評価したい。',
  ],
  ほろ酔い書家: [
    '形は崩れども心は崩れず。いや、心も少し崩れている。',
    '字の輪郭がほろ酔いの夜の街灯のように滲む。郷愁を誘う一作。',
    'お題を知らずに見れば、きっと何かの字だと思うはずだ。',
    '筆が先か、足が先か。その葛藤が画面に刻まれている。',
  ],
  千鳥足の新人: [
    '千鳥が紙の上で舞ったかのような、自由奔放な線の群れ。',
    '本人は「書いた」と言い張っている。我々はその言葉を信じたい。',
    '文字であることを拒む勇気。新人離れした反骨精神である。',
    '紙の余白が雄弁に語る。「何があったのか」と。',
  ],
  前衛芸術家: [
    '既存の文字体系への痛烈な批評。美術館が放っておかないだろう。',
    'これはお題ではない、お題の「気配」である。',
    '書の常識を泥酔で踏み越えた、二十一世紀の問題作。',
    '見る角度によっては字に見える。たぶん、逆さにすれば。',
    '抽象表現主義の巨匠も、草葉の陰で酒を噴いている。',
  ],
  ただの酔っ払い: [
    '作者は「明日の自分が読める」と供述している。',
    '筆を持った酔っ払いが紙の上を歩いた。その事実だけが、厳かにここにある。',
    '評価不能。審査員も一緒に飲み始めた。',
    '書道というより、事件現場の記録として保存したい。',
    'この作品の前では、言葉も千鳥足になる。',
  ],
};

/**
 * @param {number} score
 * @param {object} stats {footprints, inkOuts, splatters, inkRatio, offPaper, elapsed, timeLimit, refills}
 */
export function makeComment(score, stats, rng = Math.random) {
  const rank = rankOf(score);
  const list = COMMENTS[rank];
  const base = list[Math.floor(rng() * list.length) % list.length];
  const extras = [];
  if (!stats.inkRatio || stats.inkRatio < 0.002) {
    return { rank, comment: '一滴の墨も落とさぬことで「書とは何か」を問うた。無の境地。' };
  }
  if (stats.footprints >= 25) extras.push(`足跡${stats.footprints}歩。足で書いたほうが早い。いや、もう足で書いている。`);
  else if (stats.footprints >= 8) extras.push('紙面を横切る足跡が、制作過程を雄弁に物語る。');
  if (stats.inkOuts >= 3) extras.push(`墨切れ${stats.inkOuts}回。渇筆の美を、身をもって体得している。`);
  else if (stats.inkOuts >= 1 && stats.refills === 0) extras.push('墨が尽きても筆を止めない。その執念に脱帽。');
  if (stats.offPaper > 3) extras.push('紙に収まりきらぬ器の大きさ。床にも作品が続いている。');
  if (stats.splatters >= 6) extras.push('飛び散る墨しぶきは、魂の叫びそのものだ。');
  if (stats.elapsed < stats.timeLimit * 0.3 && score >= 30) extras.push('迷いなき早筆。酔いが回る前に勝負を決めた。');
  const extra = extras.length ? extras[Math.floor(rng() * extras.length) % extras.length] : '';
  return { rank, comment: extra ? `${base}\n${extra}` : base };
}

// ---------------- 金屏風シーン ----------------

function srgbTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function placardCanvas(odai, score, rank) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 700;
  const g = c.getContext('2d');
  // 白木の板
  const grd = g.createLinearGradient(0, 0, 512, 0);
  grd.addColorStop(0, '#e9d2a6');
  grd.addColorStop(0.5, '#f4e2bf');
  grd.addColorStop(1, '#dcc093');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 700);
  g.strokeStyle = 'rgba(120,80,30,0.18)';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    const x = Math.random() * 512;
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 10, 230, x - 10, 470, x + 4, 700);
    g.stroke();
  }
  g.strokeStyle = '#5a3a1a';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 690);
  g.fillStyle = '#1a1410';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fit = (text, size, y, maxW = 440) => {
    let s = size;
    g.font = `400 ${s}px ${FONT_FAMILY}`;
    while (g.measureText(text).width > maxW && s > 20) {
      s -= 2;
      g.font = `400 ${s}px ${FONT_FAMILY}`;
    }
    g.fillText(text, 256, y);
  };
  fit('題', 60, 80);
  fit(`『${odai}』`, 92, 200);
  fit('一致率', 52, 330);
  fit(`${score}%`, 120, 440);
  g.fillStyle = '#b3142a';
  const m = rank.match(/^(.*?)(（.*）)?$/);
  fit(m[1], 72, 570);
  if (m[2]) fit(m[2], 44, 640);
  return c;
}

export class ResultScene {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0605');
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.t = 0;
    this.active = false;

    // 金属的な反射のための環境マップ（コード生成）
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color('#2a1a10');
    const panelMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', side: THREE.DoubleSide });
    const warmMat = new THREE.MeshBasicMaterial({ color: '#ffb36a', side: THREE.DoubleSide });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), panelMat);
    p1.position.set(0, 6, 4);
    p1.lookAt(0, 0, 0);
    env.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), warmMat);
    p2.position.set(-6, 2, 2);
    p2.lookAt(0, 0, 0);
    env.add(p2);
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), warmMat);
    p3.position.set(6, 2, 2);
    p3.lookAt(0, 0, 0);
    env.add(p3);
    const floorG = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#5a0a12', side: THREE.DoubleSide }));
    floorG.rotation.x = -Math.PI / 2;
    floorG.position.y = -2;
    env.add(floorG);
    this.envMap = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0;

    // ライト
    this.ambient = new THREE.HemisphereLight('#ffe7c2', '#3a0a0a', 0);
    this.scene.add(this.ambient);
    this.spot = new THREE.SpotLight('#fff2d8', 0, 30, Math.PI / 7, 0.45, 1.2);
    this.spot.position.set(0, 7.5, 5);
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);
    this.fill = new THREE.DirectionalLight('#ffd9a0', 0);
    this.fill.position.set(-3, 4, 6);
    this.scene.add(this.fill);

    this.buildStatic();
  }

  buildStatic() {
    // 赤い毛氈
    const felt = srgbTex(feltCanvas());
    felt.wrapS = felt.wrapT = THREE.RepeatWrapping;
    felt.repeat.set(8, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 2;
    this.scene.add(floor);
    // 奥の畳床
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 1 }));
    back.position.set(0, 6, -4);
    this.scene.add(back);

    // 六曲一隻の金屏風
    const byobu = new THREE.Group();
    const N = 6;
    const pw = 1.36;
    const bh = 3.5;
    const a = (24 * Math.PI) / 180;
    const lacquer = new THREE.MeshStandardMaterial({ color: '#0b0706', roughness: 0.18, metalness: 0.2 });
    const fitting = new THREE.MeshStandardMaterial({ color: '#e2bb55', roughness: 0.25, metalness: 1 });
    const total = N * pw * Math.cos(a);
    let x = -total / 2;
    for (let i = 0; i < N; i++) {
      const ang = i % 2 === 0 ? a : -a; // ジグザグ
      const dx = pw * Math.cos(a);
      const z0 = i % 2 === 0 ? 0 : -pw * Math.sin(a);
      const panel = new THREE.Group();
      panel.position.set(x + dx / 2, 0.08, z0 - (i % 2 === 0 ? 1 : -1) * (pw * Math.sin(a)) / 2);
      panel.rotation.y = ang;
      const goldTex = srgbTex(goldLeafCanvas(256, 660, 31 + i * 7, 44));
      const gold = new THREE.MeshStandardMaterial({ map: goldTex, metalness: 0.9, roughness: 0.3, color: '#ffffff' });
      const face = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.08, bh - 0.1, 0.03), [lacquer, lacquer, lacquer, lacquer, gold, lacquer]);
      face.position.y = bh / 2;
      panel.add(face);
      // 黒漆の縁
      const fw = 0.06;
      const top = new THREE.Mesh(new THREE.BoxGeometry(pw, fw, 0.06), lacquer);
      top.position.y = bh - fw / 2;
      panel.add(top);
      const bot = top.clone();
      bot.position.y = fw / 2;
      panel.add(bot);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(fw, bh, 0.06), lacquer);
        side.position.set((s * (pw - fw)) / 2, bh / 2, 0);
        panel.add(side);
        for (const yy of [fw / 2, bh - fw / 2]) {
          const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.07), fitting);
          f.position.set((s * (pw - 0.1)) / 2, yy, 0.005);
          panel.add(f);
        }
      }
      byobu.add(panel);
      x += dx;
    }
    byobu.position.z = -1.4;
    this.scene.add(byobu);
    this.byobuWidth = total;
    this.byobuHeight = bh;
  }

  clearRound() {
    for (const ch of [...this.group.children]) {
      this.group.remove(ch);
      ch.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
  }

  /**
   * @param {object} d {layout, inkCanvas, score, rank, odai}
   */
  build(d) {
    this.clearRound();
    this.t = 0;
    this.active = true;
    this.data = d;
    const aspect = d.layout.aspect;
    // 作品の大きさ
    let ph = aspect >= 1 ? 1.75 : 2.15;
    let pw = ph * aspect;
    if (pw > 1.9) { pw = 1.9; ph = pw / aspect; }
    const side = 0.2;
    const ten = 0.55;
    const chi = 0.35;
    const mw = pw + side * 2;
    const mh = ph + ten + chi;
    this.mountW = mw;

    const art = new THREE.Group();
    // 裂地
    const bro = srgbTex(brocadeCanvas(256, Math.round((256 * mh) / mw), '#24384f', '#cfae55'));
    const mount = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 0.02), new THREE.MeshStandardMaterial({ map: bro, roughness: 0.6, metalness: 0.15 }));
    mount.position.y = mh / 2;
    art.add(mount);
    // 中廻し（明るい裂）
    const naka = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.16, ph + 0.3), new THREE.MeshStandardMaterial({ color: '#d8cba4', roughness: 0.8 }));
    naka.position.set(0, chi + ph / 2, 0.012);
    art.add(naka);
    // 一文字（金）
    for (const yy of [chi + ph + 0.06, chi - 0.06]) {
      const ichi = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.16, 0.08), new THREE.MeshStandardMaterial({ color: '#d9b45a', metalness: 0.8, roughness: 0.35 }));
      ichi.position.set(0, yy, 0.014);
      art.add(ichi);
    }
    // 本紙と墨
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: srgbTex(washiCanvas(512, Math.round(512 / aspect), 21)), roughness: 0.9 }));
    paper.position.set(0, chi + ph / 2, 0.016);
    art.add(paper);
    this.inkTex = srgbTex(d.inkCanvas);
    const ink = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: this.inkTex, transparent: true, roughness: 0.5 }));
    ink.position.set(0, chi + ph / 2, 0.018);
    art.add(ink);
    // 軸（下）と八双（上）
    const rodMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.4 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#f1ead8', roughness: 0.3 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, mw + 0.1, 12), rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.y = 0.0;
    art.add(rod);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), capMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(s * (mw / 2 + 0.12), 0, 0);
      art.add(cap);
    }
    const hasso = new THREE.Mesh(new THREE.BoxGeometry(mw, 0.04, 0.04), rodMat);
    hasso.position.y = mh;
    art.add(hasso);
    // 掛け紐
    const cordMat = new THREE.MeshStandardMaterial({ color: '#7a5a20' });
    for (const s of [-1, 1]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 4), cordMat);
      cord.position.set(s * mw * 0.2, mh + 0.18, 0);
      cord.rotation.z = s * 0.6;
      art.add(cord);
    }
    this.artBaseY = 0.55;
    this.artTopY = this.artBaseY + mh + 0.4;
    art.position.set(0, this.artBaseY + 6, -0.2);
    this.art = art;
    this.group.add(art);

    // 掛け軸スタンド（黒漆）
    const stand = new THREE.Group();
    const lac = new THREE.MeshStandardMaterial({ color: '#0d0907', roughness: 0.2, metalness: 0.2 });
    const sh = this.artTopY;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, sh, 0.07), lac);
      post.position.set(s * (mw / 2 + 0.32), sh / 2, -0.25);
      stand.add(post);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.7), lac);
      foot.position.set(s * (mw / 2 + 0.32), 0.03, -0.2);
      stand.add(foot);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(mw + 0.8, 0.07, 0.07), lac);
    bar.position.set(0, sh, -0.25);
    stand.add(bar);
    this.group.add(stand);

    // 立て札
    const pc = placardCanvas(d.odai, d.score, d.rank);
    const placard = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.16, 0.05), [
      new THREE.MeshStandardMaterial({ color: '#c9a878' }), new THREE.MeshStandardMaterial({ color: '#c9a878' }),
      new THREE.MeshStandardMaterial({ color: '#c9a878' }), new THREE.MeshStandardMaterial({ color: '#c9a878' }),
      new THREE.MeshStandardMaterial({ map: srgbTex(pc), roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#c9a878' }),
    ]);
    board.position.y = 1.2;
    placard.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: '#b08a58' }));
    post.position.y = 0.35;
    placard.add(post);
    this.placardX = mw / 2 + 0.85;
    placard.position.set(this.placardX, -2, 0.5);
    placard.rotation.y = -0.25;
    this.placard = placard;
    this.group.add(placard);

    // 本人
    const m = buildDrunkModel();
    const proud = d.score >= 30;
    const body = m.root;
    body.scale.setScalar(0.9);
    this.drunk = m;
    this.proud = proud;
    if (proud) {
      body.position.set(-(mw / 2 + 0.8), 0, 0.6);
      body.rotation.y = 0.35;
      // 万歳ポーズ
      m.arms.forEach((arm, i) => { arm.rotation.x = -3.0; arm.rotation.z = (i === 0 ? -1 : 1) * 0.3; });
      m.brush.rotation.x = -1.2;
      m.brush.position.y += 0.8;
    } else {
      // 寝転がっている
      body.rotation.set(0, 0, Math.PI / 2 - 0.05);
      body.position.set(-mw / 2 + 0.75, 0.28, 1.15);
      m.brush.rotation.x = 0.3;
    }
    this.group.add(body);
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
      map: srgbTex(labelCanvas(proud ? 'どや' : 'Zzz…', { size: 80, color: '#fff', stroke: '#3a2a10', fontFamily: FONT_FAMILY })),
      transparent: true,
    }));
    bubble.scale.set(0.9, 0.45, 1);
    bubble.position.set(proud ? -(mw / 2 + 0.6) : -mw / 2 - 0.2, proud ? 2.15 : 0.95, proud ? 0.7 : 1.2);
    bubble.material.opacity = 0;
    this.bubble = bubble;
    this.group.add(bubble);

    // 紙吹雪
    const n = 260;
    const geo = new THREE.PlaneGeometry(0.06, 0.09);
    const cm = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 });
    this.confetti = new THREE.InstancedMesh(geo, cm, n);
    this.confetti.frustumCulled = false;
    const colors = ['#f2c94c', '#e8b13a', '#d0262f', '#ffffff', '#f7e3a1'];
    this.cf = [];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      col.set(colors[i % colors.length]);
      this.confetti.setColorAt(i, col);
      this.cf.push({
        x: (Math.random() - 0.5) * 7,
        y: 5 + Math.random() * 4,
        z: -0.5 + Math.random() * 2.5,
        vy: 0.5 + Math.random() * 0.7,
        rx: Math.random() * 6, ry: Math.random() * 6,
        sx: (Math.random() - 0.5) * 8, sy: (Math.random() - 0.5) * 8,
        ph: Math.random() * 6,
      });
    }
    this.confetti.visible = false;
    this.group.add(this.confetti);

    this.spot.target.position.set(0, this.artBaseY + mh / 2, -0.2);
    this.spot.intensity = 0;
    this.ambient.intensity = 0;
    this.fill.intensity = 0;
    this.scene.environmentIntensity = 0;
    this.confettiOn = false;
  }

  /** 演出をすぐ最後まで進める */
  skip() { this.t = Math.max(this.t, 6); }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    // 暗転 → スポットライト
    const light = smooth(clamp((t - 0.9) / 0.5, 0, 1));
    this.spot.intensity = light * 70;
    const amb = smooth(clamp((t - 1.6) / 1.4, 0, 1));
    this.ambient.intensity = amb * 0.9;
    this.fill.intensity = amb * 1.1;
    this.scene.environmentIntensity = 0.15 + amb * 0.85;
    // 作品がスルスル降りる
    const k = smooth(clamp((t - 1.3) / 2.0, 0, 1));
    this.art.position.y = lerp(this.artBaseY + 6, this.artBaseY, 1 - Math.pow(1 - k, 2));
    this.art.rotation.z = Math.sin(t * 2.2) * 0.02 * (1 - k) + Math.sin(t * 1.3) * 0.004;
    // 立て札が出てくる
    const pk = smooth(clamp((t - 5.0) / 0.6, 0, 1));
    this.placard.position.y = lerp(-2, 0, pk);
    this.bubble.material.opacity = clamp((t - 5.4) / 0.4, 0, 1);
    if (this.drunk) {
      const r = this.drunk.root;
      if (this.proud) r.position.y = Math.abs(Math.sin(t * 3)) * 0.06;
      else r.rotation.x = Math.sin(t * 1.4) * 0.03;
    }
    // 紙吹雪
    if (t > 3.3) {
      this.confetti.visible = true;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const p = new THREE.Vector3();
      const s = new THREE.Vector3(1, 1, 1);
      this.cf.forEach((c, i) => {
        c.y -= c.vy * dt;
        c.rx += c.sx * dt;
        c.ry += c.sy * dt;
        if (c.y < 0.02) { c.y = 0.02; c.sx = 0; c.sy = 0; c.rx = Math.PI / 2; }
        p.set(c.x + Math.sin(t * 1.5 + c.ph) * 0.2, c.y, c.z);
        e.set(c.rx, c.ry, 0);
        q.setFromEuler(e);
        m.compose(p, q, s);
        this.confetti.setMatrixAt(i, m);
      });
      this.confetti.instanceMatrix.needsUpdate = true;
    }
  }

  fit(W, H, insetTop, insetBottom) {
    const portrait = W / Math.max(1, H - insetBottom - insetTop) < 1.1;
    const wNeed = portrait ? this.mountW + 2.9 : this.byobuWidth + 0.6;
    const hNeed = this.byobuHeight + 1.2; // 手前の床（寝転がった本人）も入れる
    const Havail = Math.max(120, H - insetTop - insetBottom);
    const cam = this.camera;
    cam.aspect = W / Havail;
    const tan = Math.tan((cam.fov * Math.PI) / 360);
    const dist = Math.max(hNeed / 2 / tan, wNeed / 2 / (tan * cam.aspect)) + 0.6;
    const cy = this.byobuHeight / 2 - 0.35;
    cam.position.set(0, cy + dist * 0.16, dist);
    cam.lookAt(0, cy, -0.4);
    cam.setViewOffset(W, Havail, 0, -insetTop, W, H);
    cam.updateProjectionMatrix();
  }
}
