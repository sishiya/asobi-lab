// 学習したリズムで1回試し、転ぶまでの体のようす（高さ・前後の傾き・左右の傾き・上向き）を見る
import fs from 'node:fs'; import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { pose } from '../js/hare.js';
import { height } from '../js/ground.js';
await R.init();
const v = JSON.parse(fs.readFileSync(new URL('../js/' + (process.argv[2] || 'gait-hare.json'), import.meta.url))).v;
for (const at of [[0, 0, 0], [2, 0, 1], [-3, 0, -2]]) {
  const log = []; let n = 0;
  const r = trial(R, v, { dur: 6, at, turn: () => 0, onFrame: (t, H, P) => { if (n++ % 3 === 0) log.push(`${t.toFixed(2)} 高 ${((P.y - height(P.x, P.z)) * 100).toFixed(0)} 前後 ${P.pitch.toFixed(2)} 左右 ${P.roll.toFixed(2)} 上 ${P.up.toFixed(2)}`); } });
  console.log(`場所 ${at}: 転ぶ ${r.fell} 進む ${r.dist.toFixed(2)}m`); console.log(log.slice(-8).join('\n'));
}
