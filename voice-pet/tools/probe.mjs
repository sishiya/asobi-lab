// 学習の出発点さがし: 数を広く（一様に）ばらまいて1回ずつ試し、動けたものを並べる
// node probe.mjs [数] [秒]  → logs/probe.json（上位）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import R from '@dimforge/rapier3d-compat';
import { trial, score } from '../js/trial.js';
import { PARAMS } from '../js/hare.js';
await R.init();
const here = path.dirname(fileURLToPath(import.meta.url));
const N = +(process.argv[2] || 300), dur = +(process.argv[3] || 6);
let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const res = [];
for (let i = 0; i < N; i++) {
  const v = PARAMS.map(() => rnd());
  const r = trial(R, v, { dur, turn: () => 0 }); r.world.free();
  res.push({ v: v.map(x => +x.toFixed(4)), s: score(r, dur, 1.5, 1), dist: r.dist, fell: r.fell, hindTD: r.hindTD, match: r.match, slip: r.slip, freq: r.freq || 0 });
}
res.sort((a, b) => b.s - a.s);
const moved = res.filter(x => !x.fell && x.dist > 0.5).length, td = res.filter(x => x.hindTD >= 8).length;
console.log(`試し ${N}: 転ばず0.5m以上 ${moved}、後ろ足が8回以上着いた ${td}`);
for (const x of res.slice(0, 10)) console.log(`点 ${x.s.toFixed(2)} 進む ${x.dist.toFixed(2)}m 転ぶ ${x.fell ? 'はい' : 'いいえ'} 後ろ着く ${x.hindTD} 手本 ${(x.match * 100).toFixed(0)}% ${x.freq.toFixed(1)}回/秒 すべり ${(x.slip * 100).toFixed(1)}cm/秒`);
fs.writeFileSync(path.join(here, 'logs/probe.json'), JSON.stringify(res.slice(0, 32)));
