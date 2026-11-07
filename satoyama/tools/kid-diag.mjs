// 声の子が立てるかを細かく見る: 体の高さ・関節の角度（ねらい 0）
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { pose } from '../js/hare.js';
import { kidGenes, kidBody, kidPlan } from '../js/kid.js';
await R.init();
const id = +(process.argv[2] || 3), g = kidGenes(id * 7919), B = kidBody(g), world = makeField(R), H = B.build(R, world, [0, 0, 0], height), q = B.decode(B.decode ? [] : []);
const K = kidPlan(g); console.log('plan', JSON.stringify(K, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
const show = lab => { const P = pose(H); console.log(lab, 'pelvis y', H.parts.pelvis.body.translation().y.toFixed(3), 'chest y', H.parts.chest.body.translation().y.toFixed(3), 'up', P.up.toFixed(2), H.list.filter(j => /hip|knee|ank|ab/.test(j.name)).slice(0, 8).map(j => `${j.name} ${j.jt.angle ? j.jt.angle().toFixed(2) : '?'}`).join(' ')); };
show('はじめ');
for (let i = 0; i < 240; i++) world.step(); show('1秒');
for (let i = 0; i < 480; i++) world.step(); show('3秒');
console.log('足の付け根の強さ', H.list.find(j => j.name.startsWith('hip')).k.toFixed(1), '重さ', H.mass.toFixed(2));
