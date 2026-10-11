# 紹介動画づくり（あそびラボ・_dev/promo）

まなびラボの `../アプリ開発/_dev/promo/` のしくみを写したもの（2026-10-11）。くわしい決まり（ショートと説明動画のすみわけ、字幕、しし屋の目印、案内役のライオン、BGM、YouTube・X に出す手順）は、まなびラボの `_dev/promo/README.md` と `RULES.md` 8.4・8.5 にしたがう。

## まなびラボ版とのちがい
- `promo.js` は写したもので、ちがいは先頭の `BRAND`（目印の名前「あそびラボ」と URL `sishiya.github.io/asobi-lab`）だけ。まなびラボ側で `promo.js` を直したら、こちらにも写す（`BRAND` は残す）。
- ライオン（`../vtuber/index.html`）・アイコン（`../sns-icon/a-lion-glasses.svg`）・録画のスクリプト（`../tools/record-promo.ps1`・`cdp.ps1`）も写したもの。`record-promo.ps1` はポート 8780（サーバー `games`）・プロフィール `asobi-record`。
- 保存（`out/` への PUT）は `.claude/serve.ps1`（まなびラボと同じもの）。`out/` は Git に入れない。
- YouTube・X に上げる道具（`youtube-upload.ps1`・`make-upload.ps1`・`x-post.ps1`）はまだ写していない。上げるときに写すか、まなびラボの道具で上げる（ユーザーの GO のあと）。

## 恐竜かけっこ牧場
| 台本 | 中身 | 出力 |
|---|---|---|
| `dino-race.html?short` | ショート（縦 2160×3840、本編 40秒＋締め 5秒）: はじめの3匹 → かけ合わせの子が転ぶ・練習で走りきる → 人の世界記録 9.58秒に勝つ | `out/dino-race-short.mp4`・`.ja.srt`・`.en.srt` |
| `dino-race-guide.html` | 説明動画（横 3840×2160、本編 150秒＋締め 5秒、案内役のライオン）。チャプター: 0:00 はじめに・0:28 かけ合わせ・0:52 練習・1:20 大きさと速さ・1:44 大会・2:08 足あとからの推定 | `out/dino-race-guide.mp4`・`.ja.srt`・`.en.srt` |

- 共通の部品は `dino-race-common.js`。ゲームを iframe で開き、ゲームの物理（`makeRace`・`stepRace`）と絵（`drawScene`・`drawPortrait`）をそのまま使う。ゲームの `const`（`SPECIES`・`REFS`）は window に出ないので `drGet(w, '名前')`（iframe の中で eval）で取る。色はダークモードに決め打ち（見るブラウザの設定で絵が変わらないように）。
- 見せる恐竜の遺伝子は `dino-genomes.json`（`dino-race/test.html` で作った。かけ合わせのシード 1・練習のシード 11・21・22、ラプトルどうしのシード 101）。**値は丸めない**: 有効数字 12 桁に丸めただけで、練習1回目の子が 39.4m で転ぶはずが 13.8m で転ぶようになった。ゲームの物理（`sim.js`）や遺伝子の範囲を変えたら、記録が変わるので作りなおす。
- 録画: サーバー `games` を起動して、リポジトリのルートで
  `powershell -NoProfile -ExecutionPolicy Bypass -File _dev/tools/record-promo.ps1 -Script dino-race -Short`
  `powershell -NoProfile -ExecutionPolicy Bypass -File _dev/tools/record-promo.ps1 -Script dino-race-guide`
  （2026-10-11: ショート 32 秒・108MB、説明動画 2分12秒・478MB）。
- BGM はコードで合成した音だけ（`journey`、レの和音）。音の大きさは、まなびラボの説明動画と同じくらい（平均 -37dB、いちばん大きいところ -13dB）。
