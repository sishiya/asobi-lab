// 関節を本物の向きだけにした体（ANAT）で、ノウサギが立てるか・どこで転ぶか
import R from '@dimforge/rapier3d-compat';
import fs from 'node:fs';
import { trial, makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { buildHare, pose, setAnatomical, PARAMS, decodeParams, drive } from '../js/hare.js';
await R.init();
for (const anat of [false, true]) {
  setAnatomical(anat);
  const world = makeField(R), H = buildHare(R, world, [0, 0, 0], height);
  let t = 0, upMin = 1, why = '';
  for (let i = 0; i < 720; i++) { world.step(); t += 1 / 240; const P = pose(H); upMin = Math.min(upMin, P.up); if (!why && (P.up < 0.35 || P.y - height(P.x, P.z) < 0.05)) why = `${t.toFixed(2)}秒 高さ ${(P.y - height(P.x, P.z)).toFixed(3)} 上向き ${P.up.toFixed(2)}`; }
  const ang = H.list.filter(j => /knee|ank|el|wr/.test(j.name) && j.name.endsWith('L')).map(j => `${j.name} ${(j.jt.angle?.() ?? NaN).toFixed?.(2)}`);
  console.log(anat ? '本物の向き' : 'これまで', '動かさない3秒:', why || '立てる', '最小の上向き', upMin.toFixed(2));
  world.free();
}
// 手本の出発点（learn.mjs の SEED）で6秒
const enc = o => PARAMS.map(([k, a, b]) => Math.max(0, Math.min(1, ((o[k] ?? (a + b) / 2) - a) / (b - a))));
const A0 = 0.5, SEED = enc({ freq: 3.5, spA: 0.3, spO: 0, spP: 0.5, hipA: A0, hipO: 0, kneeA: A0, kneeO: 0, kneeP: 0.5, ankA: A0, ankO: 0, ankP: 0, shA: A0 * 0.8, shO: 0, shP: 0.5, elA: A0 * 0.5, elO: 0, elP: 0.5, hLR: 0, fLR: 0.1, turn: 0, neck: 0, pK: 0, pD: 0, pKf: 0, rK: 0, aK: -0.7, aD: 0 });
for (const anat of [false, true]) {
  setAnatomical(anat);
  for (const v of [SEED, JSON.parse(fs.readFileSync(new URL('../js/gait-hare-turn2.json', import.meta.url))).v]) {
    let t1 = null; const r = trial(R, v, { dur: 6, turn: () => 0, onFrame: (t, H, P) => {} }); r.world.free();
    console.log(anat ? '本物の向き' : 'これまで', v === SEED ? '出発点' : 'turn2', '進む', r.dist.toFixed(2), '転ぶ', r.fell, '後ろ足が着いた', r.hindTD);
  }
}
