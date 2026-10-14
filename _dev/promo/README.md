# 紹介動画づくり（あそびラボ・_dev/promo）

まなびラボの `../アプリ開発/_dev/promo/` のしくみを写したもの（2026-10-11）。くわしい決まり（ショートと説明動画のすみわけ、字幕、しし屋の目印、案内役のライオン、BGM、YouTube・X に出す手順）は、まなびラボの `_dev/promo/README.md` と `RULES.md` 8.4・8.5 にしたがう。

## まなびラボ版とのちがい
- `promo.js` は写したもので、ちがいは先頭の `BRAND`（目印の名前「あそびラボ」と URL `sishiya.github.io/asobi-lab`）だけ。まなびラボ側で `promo.js` を直したら、こちらにも写す（`BRAND` は残す）。
- ライオン（`../vtuber/index.html`）・アイコン（`../sns-icon/a-lion-glasses.svg`）・録画のスクリプト（`../tools/record-promo.ps1`・`cdp.ps1`）も写したもの。`record-promo.ps1` はポート 8780（サーバー `games`）・プロフィール `asobi-record`。
- 保存（`out/` への PUT）は `.claude/serve.ps1`（まなびラボと同じもの）。`out/` は Git に入れない。
- 2026-10-13 にまなびラボの最新の `promo.js` を写しなおし、音の `promo-audio.js`（音量を -20 LUFS にそろえる）・サムネイルの `short-thumb.html`・`short-thumbs.js`・`../tools/make-short-thumbs.ps1`・`../tools/check-loudness.ps1` も写した（台本は `promo-audio.js` も読む）。`record-promo.ps1` には `-Query`（台本のページに `?…` を足す）を足した。
- YouTube に上げる道具 `../tools/youtube-upload.ps1`・`../tools/make-upload.ps1` を 2026-10-14 に写した（`x-post.ps1` はまだ）。使い方はまなびラボの `_dev/promo/README.md`「YouTube に上げる」と同じ。ちがい:
  - `youtube-upload.ps1` は分類がゲーム（20）。チャンネルは同じしし屋なので許可（トークン）もまなびラボと同じ。秘密の置き場所を書いた `../tools/youtube-upload.local.txt`（Git に入れない）は**ユーザーがまなびラボから写す**（Claude は写さない）。API の使用量の記録（`-Quota`）はリポジトリごとに分かれるが、割り当ては同じ Google のプロジェクトで共通なので、まなびラボの記録と足して見る。
  - `make-upload.ps1` は入口の `GAMES` から下書きを作り、説明欄は「しし屋 あそびラボ（ほかのゲーム）」。出どころはあれば書く。`-Check` はネタバレになりそうな言葉と、まなびラボ・Zenn の 20:00〜20:15 に重なる予約を注意する（いつ出すかは RULES 8章「YouTube への出し方」: ときどきのサプライズ投稿）。
- 下書き: `edge-falls-guide.upload.json`・`edge-falls-short.upload.json`（2026-10-14。`_todo` の行に、録りなおしたあとにすることを書いてある。消すまで `-Check` は NG）。

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

## 果ての滝の箱庭（2026-10-13）
**ネタバレ厳禁**（`../../RULES.md` 8章）: ショート・説明動画・サムネイルにエンディングと世界がくずれる演出を出さない。終わりは第十の年「めぐる世界」までで、できた世界を回して見せる。ダイジェストは確認用なのでクリアまで録る（エンディングの演出がない版でも、十の年を通ったら止まる）。

| 台本 | 中身 | 出力 |
|---|---|---|
| `edge-falls-digest.html` | **ダイジェスト**（あそびラボだけ。RULES 8章）: はじめの画面から自動で遊んでエンディングの札まで。1920×1080・音なし・長さは遊んだぶん（約2分半）。`?dry` は録らずに速く通す、`?seed=` は大地の種（はじめは 3）、`?max=秒` で途中で止める | `out/edge-falls-digest.mp4`・`.json`（章ごとの日・見つけたこと・エラー）、章のはじめのセーブ `out/edge-falls-save-ch0〜9.json` |
| `edge-falls.html?short` | ショート（縦、ゲームをスマホの大きさ 540×960 で）: できた世界 → 泉を2つ・湖と滝 → 草とシカ（時を速めて）→ 湖に寄って生き物 → できた世界を引いて回す（十の年で、どんな世界になる？） | `out/edge-falls-short.mp4`・`.ja.srt`・`.en.srt` |
| `edge-falls-guide.html` | 説明動画（横、1280×720 で開いて3倍、ライオンつき）。はじめの画面 → 水がめ・泉 → 土ぶくろで出口を盛る → たね → シカ → 冬と天の輪 → 食べる・食べられる・命が戻る → 遺伝子の平均 → 第十の年「めぐる世界」（エンディングは見せない） | `out/edge-falls-guide.mp4`・`.ja.srt`・`.en.srt` |

- 共通の部品は `edge-falls-common.js`。ゲームを srcdoc で開き、ゲームより先に時計を差しかえる（`EF_PRE`: requestAnimationFrame・setTimeout・performance.now をこちらの `__efAdv(ミリ秒)` で進める。知らせや章のことばも動画の時間で消える）。保存してある果ての滝のセーブ・設定は、録る iframe の中で消し、音は切る。
- 絵はゲームの `#view` に、**ゲームの画面の小物を写して重ねる**（`efDrawUI`: `#field` の中の見えている canvas・img・色の箱・ふち・文字を、画面での位置のとおりに。文字は1字ずつ Range の位置で）。台本ごとに写さないものを `skip` で選ぶ（説明動画は上が字幕なのでお題の1行を写さない、右下はライオン）。
- 自動で遊ぶ手 `efBot`: 章ごとに DEVNOTES の「確認のしかた」と同じ手（湖のくぼみに泉2つ → 水が落ちていくふちの出口を盛る、土が足りなければ高い所を削る → 水辺にたね → 草の多い所にシカ → シカの近くにオオカミ → 深い水にサカナ → 浅瀬にサギ。少なくなったらつぼから足す）。道具はゲームの `useTool` をそのまま（手に持つ・扇で選ぶ・大地を押すのと同じ道すじ）。泉は 2.5 区画より近いと前の泉を止めてしまうので離す。
- 紹介動画の場面（`efScenes`）は、ダイジェストが残した章のはじめのセーブから始める（**先にダイジェストを録る**）。セーブの中身はダイジェストのたびに変わる（乱数）ので、録りなおすときは3本まとめて。
- 録り方（サーバー `games-2`＝8781 などを起動して、リポジトリのルートで）:
  `powershell -NoProfile -ExecutionPolicy Bypass -File _dev/tools/record-promo.ps1 -Port 8781 -Script edge-falls-digest`
  `… -Script edge-falls -Short`、`… -Script edge-falls-guide`
- BGM はコードで合成した音だけ（`journey`、ハの和音）。
- **ver. 2.0（2026-10-15、作り直しをまとめた v069）で録りなおした**（ダイジェスト 143 秒・第 83 日でエンディング・エラー 0、ショート、説明動画）。2.0 の年の札（`yearcard`）と第九の年の「どのきびしさで」の札は時が止まるので、`efCards`（`efFrame` の中）がいちばん上のボタンを押して閉じ、札の前の速さにもどす。札を見せる長さは `EF.cardHold`（ダイジェスト 2500ms、ショート・説明動画は 0 で場面の時間をずらさない）。第九の年はオオカミを 8 頭まで放す。字幕は 1 のころのまま（太陽と月・命の光・ヒトなど 2.0 で足したものは、まだ字幕で話していない）。
- **サーバー `games`（8780）が止まって、録画が終わりで固まることがある**（2026-10-15。1 本のリクエストでふさがって、ふつうのページも返さなくなっていた）。そのときは `games-2`（8781）を起動して `-Port 8781` で録る。
- **別の会話がゲームを書きかえている途中**（コミットしていない変更で動かないなど）は、コミットずみの版を `out/game/` に出して、そちらで録る: `git archive HEAD edge-falls | tar -x -C _dev/promo/out/game`、録るときは `-Query game=out/game`（3本とも `?game=` で開くゲームを選べる）。
