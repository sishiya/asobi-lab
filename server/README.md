# あそびラボのオンラインの部分（server/）

いまは恐竜かけっこ牧場の「みんなの記録」（体重クラスごとの 100m のランキング）だけ。決めごとは `../dino-race/PLAN.md` の v010、守りの決まりは `../RULES.md` 11章。

- **Cloudflare Workers ＋ Durable Objects（SQLite）の無料プラン**。上限（1日 10万リクエストなど）を超えると、その日（UTC 0時＝日本の朝9時まで）は止まるだけで、請求はされない。**カードは登録しない**。
- ゲームは今までどおり GitHub Pages。ゲームの送り先は `../dino-race/js/online.js` の `ONLINE_URL`（1か所のスイッチ。null にすると「みんな」のページが出ない）。

## ファイル
| ファイル | 中身 |
|---|---|
| `src/index.js` | 入口（出どころ CORS の確かめ・道の振り分け）と、物理の版ごとの表 `Board`（Durable Object、SQLite）。送られたものは全部確かめる。IP は回数の上限のためにメモリで数えるだけ |
| `src/dino.js` | 遺伝子の範囲 `GENES` と体重 `massOf()`（ゲームの genome.js・sim.js の写し）、体重クラス |
| `test/check.mjs` | `npm test`: 範囲と体重がゲームと同じか（はじめの種＋くじの 2000 匹） |
| `wrangler.toml` | 名前・Durable Object・送ってよい出どころ `ALLOW`・ログを残さない設定。**秘密は書かない** |

道: `GET /dino-race/board?v=sim1&farm=<番号>`（クラスごとの上位20と、その牧場の順位）、`POST /dino-race/submit?v=sim1`（`{farm, fname, line, t, ok, g}`）、`POST /dino-race/rename?v=sim1`（`{farm, fname}`。その牧場の行の名前をそろえる）、`POST /dino-race/withdraw?v=sim1`（`{farm, cls}`。そのクラスの自分の行を消す）。

## ローカルで試す（Claude もこれ）
```
cd server
npm install        # はじめてだけ（wrangler 4.145.0。node_modules と .wrangler は Git に入れない）
npm test
npm run dev        # http://127.0.0.1:8787 。ゲームは localhost:8780 で開くと、ここへ送る
```
ローカルの表は `server/.wrangler/` にたまる（消せばまっさら）。

## 公開する（はじめての1回はユーザーの手が要る）
**2026-10-19 に出した**: `https://asobi-lab-online.sishiya.workers.dev`（workers.dev の名前は `sishiya`）。直したら `cd server` → `npm test` → `npx.cmd wrangler deploy`（PowerShell では `npx` の ps1 が止められるので `.cmd`）。
1. **Cloudflare のアカウント**を作る（無料。メールで登録。カードは要らない）。**2段階認証を入れる**。
2. この PC で `cd server` → `npx wrangler login`（ブラウザで許可する。鍵はユーザーのホームフォルダにしまわれ、リポジトリには入らない）。
3. `npm run deploy` → 出てきた `https://asobi-lab-online.<名前>.workers.dev` を `../dino-race/js/online.js` の `ONLINE_URL`（`sishiya.github.io` の行）に書く → 公開前チェック → commit・push。

## 気をつけること
- API トークン・`.dev.vars` はリポジトリに入れない（`.gitignore` 済み、公開前チェックでも探す）。GitHub から自動で出すしかけ（Actions）は作らない。
- 物理（`sim.js`・planck の版）を変えて同じ遺伝子のタイムが変わるときは、`online.js` の `PHYS_VER` と `src/index.js` の `PHYS` に新しい版を足す（表が分かれる）。
- ゲームの `GENES`・`bodyPlan()` の重さ・牧場の名前の言葉の数を変えたら、`src/dino.js`・`FARM_WORDS` も直して `npm test`。
