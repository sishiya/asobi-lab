// 1回の試しの中身を時間ごとに見る（腰の高さ・傾き・足先の高さ・関節のねらいと実際）
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { PARAMS } from '../js/hare.js';
import { height } from '../js/ground.js';
await R.init();
const enc = o => PARAMS.map(([k, a, b]) => Math.max(0, Math.min(1, ((o[k] ?? (a + b) / 2) - a) / (b - a))));
const A = +(process.argv[2] || 0.7), f = +(process.argv[3] || 3);
const v = enc({ freq: f, spA: 0.3, spO: 0, spP: 0.5, hipA: A, hipO: 0, kneeA: A, kneeO: 0, kneeP: 0.5, ankA: A, ankO: 0, ankP: 0, shA: A * 0.8, shO: 0, shP: 0.5, elA: A * 0.5, elO: 0, elP: 0.5, hLR: 0, fLR: 0.1, turn: 0, neck: 0, pK: 0, pD: 0, pKf: 0, rK: 0 });
let n = 0;
const r = trial(R, v, { dur: 3, turn: () => 0, onFrame: (t, H, P) => {
  if (n++ % 6) return;
  const ft = k => { const b = H.parts[k].body.translation(); return ((b.y - height(b.x, b.z)) * 100).toFixed(1); };
  const ang = j => j.jt.angle ? j.jt.angle().toFixed(2) : '?';
  console.log(`${t.toFixed(2)} 腰 ${((P.y - height(P.x, P.z)) * 100).toFixed(1)}cm 傾き ${P.pitch.toFixed(2)} 上 ${P.up.toFixed(2)} | 後足 ${ft('hfootL')} 前足 ${ft('ffootL')} | 股 ${H.joints.hipL.target.toFixed(2)}/${ang(H.joints.hipL)} ひざ ${H.joints.kneeL.target.toFixed(2)}/${ang(H.joints.kneeL)} かかと ${H.joints.ankL.target.toFixed(2)}/${ang(H.joints.ankL)}`);
} });
console.log('転ぶ', r.fell, '進む', r.dist.toFixed(2));
