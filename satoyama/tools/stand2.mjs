import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { buildHare, pose, setNodeM } from '../js/hare.js';
import { height } from '../js/ground.js';
await R.init();
setNodeM(+(process.argv[2] ?? 0.02), 1e-4); const w = makeField(R);
const H = buildHare(R, w, [0, 0, 0], height);
// 2つの体の向きのちがい（b を a から見た回転の、x・y・z 成分の角度）
const rel = (a, b) => { const p = H.parts[a].body.rotation(), q = H.parts[b].body.rotation(); const w_ = p.w*q.w + p.x*q.x + p.y*q.y + p.z*q.z, x = p.w*q.x - p.x*q.w - p.y*q.z + p.z*q.y, y = p.w*q.y - p.y*q.w - p.z*q.x + p.x*q.z, z = p.w*q.z - p.z*q.w - p.x*q.y + p.y*q.x; return [x, y, z].map(v => (2 * v / w_).toFixed(2)).join(','); };
for (let k = 0; k <= 480; k++) { if (k % 80 === 0) { const P = pose(H); console.log(k, '腰', ((P.y - height(P.x, P.z)) * 100).toFixed(1), 'roll', P.roll.toFixed(2), '腰→もも', rel('pelvis', 'thighL'), '腰→すね', rel('thighL', 'shankL'), '胸→上腕', rel('chest', 'uarmL')); } w.step(); }
