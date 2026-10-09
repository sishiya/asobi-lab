# ゲーム フォルダ（asobi-lab）

ブラウザで遊べるゲームのシリーズ。GitHub: `sishiya/asobi-lab`（Public）。姉妹プロジェクトは `../アプリ開発/`（manabi-lab）。

## 進め方の約束
- 進め方は manabi-lab の `../アプリ開発/RULES.md` を下敷きにする（企画書 `PLAN.md` を先に作る・段階に分ける・`versions/` にバックアップ・`DEVNOTES.md` を更新）。ゲーム用に変えたい点が出たら、このフォルダに `RULES.md` を作って書く。
- 1ゲーム1フォルダ（英小文字とハイフン）。
- **新しいゲームはまず保管庫（`archive.html`）に置く**。入口（`index.html` の `GAMES`）へ移すのはユーザーが指示したときだけ（2026-10-09 ユーザーが決めた。まなびラボの RULES 8.1 と同じ）。保管庫は入口の下の注記からだけリンクし、`noindex`。
- 動かし方: `.claude/launch.json` の `games`（http://localhost:8780/）。
- **git の commit／push の前には毎回、公開前チェック**: `tools/check-public.ps1` で個人情報・秘密情報を探し、結果をユーザーに伝える。見つかったら公開しない。Public リポジトリなので push＝公開。チェックで問題がなければ push まで進めてよい（2026-10-09 ユーザー）。
- **アクセス解析**: まなびラボと同じ GA4（`G-E2VPYKV2Y9`）。入口と各ゲームの `index.html` の、ファビコンの `<link rel="icon">` の次の行に、入口の `index.html` の `<script>/* アクセス解析 …` の1行をそのままコピーする（`content_group:'asobi-lab'` つき。GA の「コンテンツ グループ」でまなびラボと見分ける。まなびラボ側は未設定＝(not set)）。`sishiya.github.io` のときだけ読むので、ローカルでは何もしない。`versions/` には入れない。
- 返事は日本語で。

## ゲーム
- `dino-race/` — 「恐竜かけっこ牧場」（恐竜をかけ合わせて育て、Planck.js の物理で二足の骨格を走らせて 100m のかけっこ。図鑑の骨格図ふうの絵）。企画は `dino-race/PLAN.md`、仕組み・確認手順は `dino-race/DEVNOTES.md`。保管庫に掲載（2026-10-09）。
- `IDEAS.md` — まだ作っていないゲームのストックと好みの傾向。
