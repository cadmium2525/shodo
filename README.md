# 泥酔書道パフォーマンス！

ふらふらの酔っ払いを操作して巨大な紙にお題（四字熟語など）を書き、お手本との一致率を競うブラウザゲーム。
思い通りに動かない千鳥足と、墨を踏んだ足跡のせいで生まれる「作品」を、金屏風の前で厳粛に鑑賞して SNS に投稿しよう。

静的ファイルのみで動作します（ビルド工程・サーバー・外部 CDN なし）。

## 遊び方

1. 「はじめる」→ 難易度（初段 / 二段 / 師範 / 名言）とお題を選ぶ。「下書き」をオンにすると紙に薄いお手本が出ます。
2. 太鼓の「ドン！」で開始。制限時間内にお題を書きます。
3. 墨が減ったら紙の手前にある**硯**の墨池へ。ただし足に墨がつきます。硯の左右の**足ふきマット**を通ると足がきれいになります。
4. 書き終えたら「書き上げた！」（Enter）。金屏風の前に作品が飾られ、一致率と段位、講評が出ます。
5. 「SNSに投稿」「画像を保存」で作品画像（1200×1200 PNG）を共有できます。`?odai=一期一会` のような URL で同じお題に挑戦できます。

| 操作 | PC | スマホ |
|---|---|---|
| 移動 | WASD / 矢印キー | 画面を触った位置に出るジョイスティック |
| 筆を下ろす（押している間だけ書く） | Space 長押し | 右下の「筆」ボタン長押し |
| 書き上げた（早期終了） | Enter / 画面上のボタン | 画面上のボタン |

コツ: 筆先は体の少し前にあります。筆を下ろしている間は筆が重く体の向きがゆっくりしか変わらないので、
線の始点の手前から歩いて入り、向きを保ったまま横歩きで曲がると書きやすくなります。

## ローカルで起動

ES Modules を使うため、`file://` ではなく HTTP で配信してください。

```sh
# リポジトリのルートで
python3 -m http.server 8000
# → http://localhost:8000/ を開く
```

GitHub Pages のプロジェクトページと同じ `/shodo/` 配下で確かめる場合は、リポジトリの親ディレクトリで
`python3 -m http.server 8000` を実行して `http://localhost:8000/shodo/` を開きます（パスはすべて相対です）。

`?seed=123` を付けると乱数（ふらつき・よろけ）が固定されます。

### テスト

```sh
node --test        # tests/ の score.js 単体テスト（Node 22 以降）
```

自動テストプレイ用に `window.__shodo`（`start` / `finish` / `getPlayer` / `teleport` / `setInput` / `drawTarget` /
`getScore` / `getResult` / `config` など）を公開しています。仕様は `SPEC.md` §9 を参照。
`setInput({x, y, brush})` の `y` は画面基準で **+1 が手前（画面下）**、`getPlayer()` の `x, y` は紙座標（左上原点 0..1）です。

## デプロイ

`.github/workflows/pages.yml` が `main` と `claude/modest-ritchie-rbfyos` への push（および手動実行）で
GitHub Pages にデプロイします。リポジトリの Settings → Pages で Source を「GitHub Actions」にしてください。
既定ブランチ以外からデプロイする場合は、Settings → Environments → `github-pages` の
「Deployment branches」にそのブランチを許可する必要があります。

## 構成

```
index.html          画面の骨組み（importmap で three を解決）
css/style.css       UI のスタイル
js/main.js          起動・画面遷移・ゲームループ・テスト用フック
js/config.js        調整用の定数（速度・ふらつき・墨量・制限時間など）
js/odai.js          お題データ・レイアウト・お手本の描画
js/scene.js         プレイ用の three.js シーン（床・紙・硯・カメラ）
js/player.js        酔っ払いのモデルと千鳥足の物理
js/ink.js           墨キャンバス（筆跡・かすれ・足跡）と濡れ墨グリッド
js/input.js         キーボード・仮想ジョイスティック・筆ボタン
js/score.js         一致率の計算
js/result.js        金屏風の展示シーン・段位・講評
js/share.js         共有画像の合成と SNS 共有
js/audio.js         WebAudio による合成音
js/textures.js      和紙・金箔・裂地などのテクスチャ生成
js/util.js          乱数などの小物
vendor/three/       three.js r184（three.module.min.js / three.core.min.js）
vendor/fonts/       Yuji Syuku（weight 400 の woff2 と @font-face CSS）
tests/              Node のテスト
```

画像・音声ファイルは持たず、テクスチャも音もすべてコードで生成しています。

## ライセンス

- ゲームのコード: 作者に帰属します。
- [three.js](https://threejs.org/) — MIT License（`vendor/three/LICENSE`）
- [Yuji Syuku](https://github.com/Kinutafontfactory/Yuji)（Kinuta Font Factory、[@fontsource/yuji-syuku](https://fontsource.org/fonts/yuji-syuku) より）— SIL Open Font License 1.1（`vendor/fonts/OFL.txt`）
