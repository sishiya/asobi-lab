// サーバーの遺伝子の範囲と体重の計算が、ゲーム（dino-race/js/genome.js・sim.js）と同じかを確かめる。
// 使い方: server フォルダで `npm test`
import fs from 'node:fs';
import vm from 'node:vm';
import { GENES, massOf, cleanGenome, classOf } from '../src/dino.js';

const game = new URL('../../dino-race/js/', import.meta.url);
const ctx = vm.createContext({Math, console});
for (const f of ['genome.js', 'sim.js']) vm.runInContext(fs.readFileSync(new URL(f, game), 'utf8'), ctx, {filename: f});
const G = vm.runInContext('GENES', ctx), SPECIES = vm.runInContext('SPECIES', ctx), bodyPlan = vm.runInContext('bodyPlan', ctx);

let bad = 0;
const fail = msg => { bad++; console.log('NG', msg); };

// 範囲が同じか
if (G.length !== GENES.length) fail(`遺伝子の数 ${G.length} と ${GENES.length}`);
G.forEach((d, i) => { const s = GENES[i]; if (!s || s[0] !== d.k || s[1] !== d.min || s[2] !== d.max) fail(`遺伝子 ${d.k}: ゲーム [${d.min}, ${d.max}] サーバー ${JSON.stringify(s)}`); });

// 体重が同じか（はじめの種と、くじで作った 2000 匹）
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const list = SPECIES.map(sp => ({...sp.body, ...sp.gait}));
for (let i = 0; i < 2000; i++) list.push(Object.fromEntries(G.map(d => [d.k, d.min + (d.max - d.min) * rnd()])));
for (const g of list) {
  const a = bodyPlan(g).M, b = massOf(g);
  if (Math.abs(a - b) > 1e-9 * a) fail(`体重 ${a} と ${b}`);
  if (!cleanGenome(g)) fail('範囲の中の遺伝子を受けつけない');
}
// 範囲の外・形のちがうものは受けつけない
const ok = list[0];
for (const bad of [null, [], {}, {...ok, legLen: 9}, {...ok, kp: NaN}, {...ok, kp: '10'}, {...ok, split: undefined}]) if (cleanGenome(bad)) fail('おかしな遺伝子を受けつけた ' + JSON.stringify(bad));
console.log('はじめの種のクラス:', SPECIES.map(sp => `${sp.id} ${massOf({...sp.body}).toFixed(1)}kg → ${classOf(massOf({...sp.body}))}`).join(', '));
console.log(bad ? `NG ${bad} 件` : `OK（${list.length} 匹で体重が一致）`);
process.exit(bad ? 1 : 0);
