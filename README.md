# asobi-lab（遊びラボ）

ブラウザで遊べるゲームのシリーズ。Claude（Claude Code）と一緒に作っています。
姉妹プロジェクト: [manabi-lab（学びラボ）](https://github.com/sishiya/manabi-lab)

| フォルダ | ゲーム |
|---|---|
| `dino-race/` | 恐竜かけっこ牧場 — 恐竜をかけ合わせて育て、物理で走らせて 100m のかけっこ（試作。保管庫に掲載） |

- **公開中**: https://sishiya.github.io/asobi-lab/ （GitHub Pages。push で更新）。作りかけ・試作は保管庫（`archive.html`、入口の下の注記から）
- 各ゲームの `index.html` が最新版、`launcher.html` から過去の版（`versions/`）。仕組みや確認のしかたは各フォルダの `DEVNOTES.md`、企画は `PLAN.md`。
- サムネイルは `thumbs/`（`tools/make-thumbs.ps1` で撮り直し）。

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

MIT（`LICENSE`）。実行時に読み込む Planck.js（MIT、恐竜かけっこ牧場の物理）は、そのライセンスに従います。
