// 調整用の定数はすべてここに集める。テストからは window.__shodo.config で書き換えられる。
// 距離の単位はワールド座標（1 = 酔っ払いの肩幅くらい）。紙 1 マスの一辺は CELL。

export const config = {
  // ---- 紙と舞台 ----
  CELL: 6,                 // 1 文字ぶんのマスの一辺（ワールド単位）
  INK_CANVAS_LONG: 1536,   // 墨キャンバスの長辺 px
  MASK_CANVAS_LONG: 512,   // 採点用お題マスクを描くキャンバスの長辺 px
  WET_GRID_LONG: 128,      // 濡れ墨グリッドの長辺セル数
  STAGE_MARGIN_SIDE: 0.9,  // 紙の外で歩ける幅（左右）
  STAGE_MARGIN_TOP: 0.9,   // 紙の外で歩ける幅（奥）
  STAGE_MARGIN_BOTTOM: 1.0,// 硯より手前に歩ける幅
  CAMERA_TILT_DEG: 10,     // 真上からの傾き
  CAMERA_FOV: 40,
  GUIDE_OPACITY: 0.12,     // 下書きの不透明度

  // ---- 硯と足ふきマット ----
  SUZURI_GAP: 0.5,         // 紙の下端から硯の上端まで
  SUZURI_W: 2.8,
  SUZURI_D: 1.9,
  POOL_RX: 1.0,            // 墨池（楕円）の半径
  POOL_RZ: 0.5,
  MAT_SIZE: 1.3,
  MAT_OFFSET_X: 2.5,       // 硯の中心からマット中心までの横距離
  REFILL_TIME: 1.0,        // 空から満タンまでの秒数
  LOW_INK_MARKER: 35,      // これ以下で「墨↓」を点滅

  // ---- 酔っ払いの動き（千鳥足） ----
  MAX_SPEED: 2.4,          // 入力最大時の速さ（単位/秒）
  ACCEL: 3.0,              // 速度追従の速さ（大きいほどキビキビ）。慣性ラグを作る
  TURN_RATE: 5.5,          // 体の向きが進行方向へ向く速さ（rad/秒 の係数）
  TURN_RATE_BRUSH: 0.9,    // 筆を下ろしている間の向きの変わる速さ（筆が重いので体はあまり回らない）
  WOBBLE_AMP_DEG: 32,      // ふらつき角度の最大（酔い度 1.0 のとき）
  WOBBLE_FREQS: [0.31, 0.67, 1.19],
  WOBBLE_WEIGHTS: [0.5, 0.32, 0.18],
  SPEED_WOBBLE: 0.25,      // 速さのムラ（0..1）
  IDLE_DRIFT_SPEED: 0.32,  // 立ち止まっても流される速さ
  IDLE_DRIFT_FREQ: 0.42,   // 円を描く周波数（Hz）
  STAGGER_INTERVAL: [3.0, 6.5], // よろけの間隔（秒、酔い度で割る）
  STAGGER_WARN: 0.5,       // よろけ前の予兆（体が傾く）秒数
  STAGGER_DURATION: [0.3, 0.6],
  STAGGER_SPEED: 2.6,
  STAGGER_INPUT_WEIGHT: 0.12, // よろけ中に入力が効く割合
  HICCUP_INTERVAL: [6, 13],
  HICCUP_JOLT: 0.9,        // しゃっくりで跳ねる勢い
  DRUNK_BY_LEVEL: { shodan: 0.7, nidan: 0.85, shihan: 1.0, meigen: 1.0 },

  // ---- 筆と墨 ----
  TIP_OFFSET: 0.95,        // 体の中心から筆先まで（進行方向の前方）
  BRUSH_RADIUS: 0.15,      // 基本の筆の半径
  BRUSH_SLOW_GAIN: 1.25,   // 止まりかけのときの太さ倍率
  BRUSH_FAST_GAIN: 0.62,   // 最高速のときの太さ倍率
  INK_PER_UNIT: 3.6,       // 基本太さで 1 単位描くと減る墨（満タン 100）
  INK_THIN_START: 30,      // これ以下で細くなり始める
  KASURE_START: 42,        // これ以下でかすれ始める
  POOLING_GAIN: 1.25,      // 入りの墨だまりの大きさ
  NIJIMI_MAX: 1.6,         // 止まってにじんだときの最大倍率
  NIJIMI_RATE: 0.55,       // にじみの成長速度（/秒）
  NIJIMI_INK_PER_SEC: 6,   // にじんでいる間の墨消費
  SPLATTER_CHANCE: 0.05,   // 1 単位描くごとの飛沫確率（速いほど増える）

  // ---- 足跡 ----
  STRIDE: 0.42,            // 歩幅
  FOOT_SPACING: 0.13,      // 左右の足の間隔（片側）
  FOOT_LEN: 0.3,
  FOOT_WIDTH: 0.13,
  FOOT_INK_DECAY: 0.05,    // 一歩ごとの減衰
  FOOT_INK_MIN: 0.35,      // 下限（これ以上は薄くならない）
  FRESH_STROKE_GRACE: 1.2, // 筆を上げた直後、その一画は踏んでも墨がつかない秒数

  // ---- 制限時間（秒） ----
  TIME_BY_LEVEL: { shodan: 75, nidan: 120, shihan: 150, meigen: 150 },
  HURRY_TIME: 10,
};

export const LEVELS = [
  { id: 'shodan', name: '初段', desc: '1文字' },
  { id: 'nidan', name: '二段', desc: '2文字' },
  { id: 'shihan', name: '師範', desc: '四字熟語' },
  { id: 'meigen', name: '名言', desc: '名言' },
];
