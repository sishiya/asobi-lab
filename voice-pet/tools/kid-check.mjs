// 声の子の体の確かめ: いくつかの遺伝子で体を作り、立てるか（3秒）・手本の出発点で歩けるか（6秒）を見る
// node kid-check.mjs [数]
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { pose } from '../js/hare.js';
import { driveKid, KID_SEED, kidPlan, kidGenes as genesOf, kidBody } from '../js/kid.js';
await R.init();
const n = +(process.argv[2] || 8);
for (let i = 1; i <= n; i++) {
  const g = genesOf(i * 7919), K = kidPlan(g), B = kidBody(g);
  const st = trial(R, KID_SEED, { dur: 3, turn: () => 0, body: { ...B, drive: (H, q, t) => driveKid(H, q, t, 0, 0, pose) } }); st.world.free();
  const wk = trial(R, KID_SEED, { dur: 6, turn: () => 0, body: B }); wk.world.free();
  console.log(`#${i} 節${K.seg} 足${K.pairs}対 首${K.neck} 尾${K.tail} 大きさ${K.s.toFixed(2)} 太さ${K.girth.toFixed(2)} 足の長さ${(K.legL * 100).toFixed(1)}cm 重さ${st.H.mass.toFixed(2)}kg | 立つ ${st.fell ? '倒れる' : 'OK'} | 歩く ${wk.dist.toFixed(2)}m ${wk.fell ? '転ぶ' : ''} すべり${(wk.slip * 100).toFixed(0)}cm/s`);
}
