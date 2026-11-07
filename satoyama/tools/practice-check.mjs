// 練習（js/practice.js、段1〜3）の確かめ: 子の番号の体で 70 世代練習（90世代）し、曲がり方（指示 −1/0/+1 で rad/秒）と歩けた距離を見る
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { kidGenes, kidBody } from '../js/kid.js';
import { makePractice } from '../js/practice.js';
await R.init();
const id = +(process.argv[2] || 8), B = kidBody(kidGenes(id * 7919)), P = makePractice(R, B, { seed: 5 });
for (let g = 0; g < 90; g++) { const b = P.step(); if (g % 10 === 9 || g === 89) console.log(`世代 ${P.gen} 段${P.stage} 試し ${P.tries} 進む ${b.dist.toFixed(2)}m ${b.fell ? '転ぶ' : ''} 曲がる ${b.yaw.toFixed(2)} 転ばず1m ${P.firstWalk}`); }
const v = P.best.v, row = [];
for (const tc of [-1, 0, 1]) { let acc = 0, last = null; const r = trial(R, v, { dur: 5, turn: () => tc, body: B, onFrame: (t, H, Q) => { if (t < 1) return; if (last != null) { let d = Q.yaw - last; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; acc += d; } last = Q.yaw; } }); r.world.free(); row.push(`${tc}: ${(acc / 4).toFixed(2)}${r.fell ? '(転)' : ''}`); }
console.log('曲がり方 rad/秒', row.join('  '));
fs.writeFileSync(new URL(`../js/gait-kid-${id}-steer.json`, import.meta.url), JSON.stringify({ genes: kidGenes(id * 7919), v: v.map(x => +x.toFixed(4)), tries: P.tries }));
