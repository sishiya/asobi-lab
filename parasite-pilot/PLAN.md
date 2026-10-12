# 宿主をあやつれ 企画書

2026-10-12。ユーザーの指示「まなびラボとあそびラボの IDEAS からおもしろそうな話題をピックアップしてゲームの試作。保管庫に入れておいて」で、Claude が題材を選んだ。フォルダ名 `parasite-pilot`。

## 題材
- まなびラボ `../../アプリ開発/IDEAS.md` の **11. 操られる生きもの**（「操られる側の一人称で『自分の意思のつもり』の行動をして、あとから寄生者側の視点で答え合わせ」）。
- 選んだわけ: 好みの傾向（生き物・本物のしくみ・ちょっと意外なもの）に合う。「しくみが遊びのルールになる」（あそびラボ IDEAS の好み）がそのままできる。ゲームにしやすい（ゴールがはっきり）。

## ひとことで
きみは寄生者。宿主（カタツムリ・ネズミ・カマドウマ）は自分の気持ちで動くが、きみは「あやつり力」を使って少しずつ引っぱる。宿主を次の宿主（鳥・ネコ）や川へ連れて行けばクリア。クリアのあとに「本物の話」で答え合わせ。

## 遊びのしくみ（3面に共通）
- 画面を押さえる（マウス・指・矢印キー）と、その方へ宿主を引っぱる。宿主の気持ちに逆らうほど、あやつり力（ゲージ）が早く減る。離すと少しずつ回復。
- 宿主の「気持ち」を画面の下に出す。引っぱられているときも、宿主は**自分で決めたつもり**（「なんとなく、こっちへ行ってみたい」）。これが題材の核。
- 面ごとに1つ、本物のしくみに合わせた**特別なあやつり**（ボタン／スペース）。
- 次の宿主ではない生き物に食べられたら失敗（その中では先へ進めない）。時間切れも失敗。
- クリアの速さで★1〜3。ブラウザに記録。

## 3つの面
| 面 | 寄生者 | 宿主 → 行き先 | 特別なあやつり | じゃま |
|---|---|---|---|---|
| 1 | ロイコクロリディウム（吸虫） | オカモノアラガイ → 鳥 | 触角をふくらませる（明るい所で鳥が気づく） | 日なたで乾く（殻にこもる）、マイマイカブリ（日かげにいる） |
| 2 | トキソプラズマ（原虫） | ネズミ → ネコ | こわさを鈍らせる（ネコのにおいがこわくなくなる） | ネズミは巣穴へ逃げる、ヘビ（ヘビへのこわさは消えない） |
| 3 | ハリガネムシ | カマドウマ → 川 | 光にひかれる（水面の光。でも街灯にもひかれる） | 街灯の下のヒキガエル、雲で月がかくれる、夜明け |

## 下敷きになる研究（画面の「本物の話」に出す）
- Wesołowska, W. & Wesołowski, T. (2014) Do Leucochloridium sporocysts manipulate the behaviour of their snail hosts? *J. Zool.* 292: 151–155.
- Berdoy, M., Webster, J.P. & Macdonald, D.W. (2000) Fatal attraction in rats infected with *Toxoplasma gondii*. *Proc. R. Soc. B* 267: 1591–1594.
- Vyas, A. et al. (2007) Behavioral changes induced by Toxoplasma infection of rodents are highly specific to aversion of cat odors. *PNAS* 104: 6442–6447.
- Thomas, F. et al. (2002) Do hairworms (Nematomorpha) manipulate the water seeking behaviour of their terrestrial hosts? *J. Evol. Biol.* 15: 356–361.
- Ponton, F. et al. (2006) Parasite survives predation on its host. *Nature* 440: 756.
- Ponton, F. et al. (2011) Water-seeking behavior in worm-infected crickets and reversibility of parasitic manipulation. *Behav. Ecol.* 22: 392–400.
- Sato, T. et al. (2011) Nematomorph parasites drive energy flow through a riparian ecosystem. *Ecology* 92: 201–207.

※ 出典は Claude の知識から書いた。段階Bで原文に当たって、数字や言い回しを確かめる。

## 段階
- **段階A（v001・この試作）**: 3面、共通の操作、本物の話、★の記録、保管庫に掲載。
- **段階B**: 出典の確認。ユーザーの感想で難しさを調整。面の追加の候補: エメラルドゴキブリバチ（ゴキブリを歩かせる）、タイワンアリタケ（アリを葉の裏へ）、ズクモ寄生バチ（クモに巣を作りかえさせる）。
- **段階C**: 「寄生者の目で見る」答え合わせのリプレイ（IDEAS 11 の「あとから寄生者側の視点で答え合わせ」）。生活環を1周つなげて遊ぶモード。

## 気をつけること
- 寄生虫の見た目はリアルにしない（記号的な絵）。こわがらせる演出はしない。
- 生殖の話は「おとなになる」「卵を産む」程度の言い方にする（CLAUDE.md の基本ルール）。
- トキソプラズマは人にも感染する。人への影響は確かでない話が多いので、言い切らない。
