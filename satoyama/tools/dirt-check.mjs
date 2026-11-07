// 汚れの確かめ: 8の字の跳び方でぬかるみ（1.6, 0.4）を通り、部位ごとの泥を見る。そのあと雨で落ちるか
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { height } from '../js/ground.js';
import { buildHare, drive, decodeParams, pose } from '../js/hare.js';
import { makeField } from '../js/trial.js';
import { makeDirt, stepDirt } from '../js/dirt.js';
await R.init();
const Q = decodeParams(JSON.parse(fs.readFileSync(new URL('../js/gait-hare-turn.json', import.meta.url))).v);
const world = makeField(R), H = buildHare(R, world, [0, 0, 0.4], height), S = makeDirt(H);
let t = 0, splashes = 0;
const show = lab => console.log(lab, Object.entries(S).map(([k, s]) => `${k} ${(s.mud * 100).toFixed(0)}`).join(' '));
const run = (sec, g, rain) => { for (let i = 0; i < sec * 240; i++) { const P = pose(H); drive(H, Q, t, g, g ? Math.max(-1, Math.min(1, -P.yaw * 1.5)) : 0); world.step(); t += 1 / 240; if (i % 4 === 0) stepDirt(S, H, 4 / 240, rain, () => splashes++); } };
run(4, 1, 0); let P = pose(H); show(`通る x=${P.x.toFixed(2)}:`); run(4, 1, 0); P = pose(H); show(`4秒 x=${P.x.toFixed(2)} z=${P.z.toFixed(2)} はね ${splashes}:`);
run(20, 0, 0); show('20秒やすむ:'); console.log('乾き', Object.values(S).map(s => s.dry.toFixed(2)).join(' '));
run(30, 0, 1); show('雨30秒:');
run(60, 0, 1); show('雨さらに60秒:');
