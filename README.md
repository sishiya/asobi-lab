# asobi-lab（遊びラボ）

ブラウザで遊べるゲームのシリーズ。Claude（Claude Code）と一緒に作っています。
姉妹プロジェクト: [manabi-lab（学びラボ）](https://github.com/sishiya/manabi-lab)

| フォルダ | ゲーム |
|---|---|
| `dino-race/` | 恐竜かけっこ牧場 — 恐竜をかけ合わせて育て、物理で走らせて 100m のかけっこ（ver. 1.2。入口に掲載。日本語・英語） |
| `parasite-pilot/` | 宿主をあやつれ — 寄生者になって、宿主を鳥・ネコ・川へ連れて行く3面。図鑑・エンディング・音つき（保管庫に掲載） |
| `heaven-spheres/` | 天をまわす箱庭 — 天動説の世界で月と太陽の天球を回し、潮の満ち引きで海の生き物を陸へ上げ、種を分けたり出会わせたりする（試作。保管庫に掲載） |
| `edge-falls/` | 果ての滝の箱庭 — 深淵に浮かぶ平らな大地に泉をわかせ、土を動かし、草と生き物を放して、水と命がめぐる世界をつくる十の年。生き物は遺伝子で進化する（入口に掲載。日本語・英語） |
| `flat-history/` | ぺらぺら世界の歴史係 — 1秒ずつのぺらぺらな世界のページのあいだを歩き、形を置くと断面だけが現れて歴史が書きかわる。住人を巣へ（入口に掲載。日本語・英語） |
| `resistance/` | 退治するほど手ごわくなる — 10夜で台所の虫を全滅させる。生き残りの子は退治のしかたに強く進化する。タイトル・つづきから・音つき（保管庫に掲載。まなびラボから移した） |

- **公開中**: https://sishiya.github.io/asobi-lab/ （GitHub Pages。push で更新）。作りかけ・試作は保管庫（`archive.html`、入口の下の注記から）
- 各ゲームの `index.html` が最新版、`launcher.html` から過去の版（`versions/`）。仕組みや確認のしかたは各フォルダの `DEVNOTES.md`、企画は `PLAN.md`。
- サムネイルは `thumbs/`。静止画 `<game>.jpg` と、マウスを乗せる（スマホはまんなかの1枚）と動く `<game>.mp4`（4秒・音なし）。どちらも `tools/make-motion-thumbs.ps1` で撮る（場面は `tools/thumb.html`、再生は `assets/motion-thumbs.js`）。動画のないゲームの静止画は `tools/make-thumbs.ps1`。

## ローカルで動かす（Windows）

ゲームは css/js に分かれていて Web Worker も使うので、file:// では動きません。小さなサーバーを使います。

いちばん簡単なのは、このフォルダの **`start.bat` をダブルクリック**すること（サーバーを起動して、入口のページをブラウザで開きます。サーバーは最小化したウィンドウで動き、閉じると止まります。8780 が使えないときは別のポートを使います）。`start.bat dino-race` のようにフォルダ名を付けると、そのゲームを直接開きます。手で起動するなら:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1 -Port 8780
```

## はじめてクローンしたとき

```
git config core.hooksPath .githooks
git config core.quotepath false
```

1行目で、コミットの前に公開前チェック（`tools/check-public.ps1`）が自動で走ります。

## ライセンス

- **プログラムのコード**: MIT（`LICENSE`）
- **ゲームの中身**（名前・文章・キャラクターやステージのデザイン・画像・音・企画書などの文書。コードの中に書かれていても）: CC BY-NC 4.0（`LICENSE-CONTENT`）。作者を表示すれば共有・改変してよく、営利目的には使えません。
- 実行時に読み込む Planck.js（MIT、恐竜かけっこ牧場の物理）や Google Fonts のフォント（SIL Open Font License。果ての滝の箱庭の DotGothic16 など）は、それぞれのライセンスに従います。
- 2026-10-13 より前のコミットは、すべて MIT で公開していました。
