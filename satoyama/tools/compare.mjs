// 体（頭あり・頭を胸とまとめた）と学習のしかたを、学習で使っていない場所もふくめた8か所で、まっすぐ6秒跳ばせてくらべる
import fs from 'node:fs'; import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { setHeadFused } from '../js/hare.js';
await R.init();
const at = [[0, 0, 0], [2, 0, 1], [-3, 0, -2], [4, 0, -3], [-5, 0, 4], [6, 0, 6], [-7, 0, -6], [1, 0, -8]];
for (const [name, file, fused] of [['頭あり・1か所で学習', 'gait-hare-head-straight.json', false], ['頭まとめ・1か所で学習', 'gait-hare-fused.json', true], ['頭まとめ・場所を変えて学習', 'gait-hare-straight.json', true]]) {
  setHeadFused(fused); const v = JSON.parse(fs.readFileSync(new URL('../js/' + file, import.meta.url))).v;
  let s = { slip: 0, dist: 0, fell: 0, y: 0, m: 0, ms: 0 };
  for (const a of at) { const r = trial(R, v, { dur: 6, at: a, turn: () => 0 }); s.slip += r.slip; s.dist += r.dist; s.fell += r.fell; s.y += r.yRatio; s.m += r.match; s.ms += r.msPerStep; r.world.free(); }
  const n = at.length; console.log(`${name}: 転ぶ ${s.fell}/${n} 進む ${(s.dist / n).toFixed(2)}m すべり ${(s.slip / n * 100).toFixed(1)}cm/秒 Y字 ${(s.y / n * 100).toFixed(0)}% 手本 ${(s.m / n * 100).toFixed(0)}% 1きざみ ${(s.ms / n).toFixed(3)}ms`);
}
