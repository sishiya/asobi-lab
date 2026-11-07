// 関節の角度の向きを確かめる: 体を空中に固定して、1つの関節のねらいを ± に動かし、先の骨がどちらを向くか
import R from '@dimforge/rapier3d-compat';
import { buildHare } from '../js/hare.js';
await R.init();
for (const [jn, part] of [['elL', 'farmL'], ['wrL', 'ffootL'], ['kneeL', 'shankL'], ['ankL', 'hfootL'], ['hipL', 'thighL'], ['shL', 'uarmL']]) {
  const out = [];
  for (const v of [-0.6, 0.6]) {
    const world = new R.World({ x: 0, y: 0, z: 0 }); world.timestep = 1 / 240;
    const H = buildHare(R, world, [0, 1, 0], () => 1);
    for (const p of Object.values(H.parts)) p.body.setBodyType(R.RigidBodyType.Dynamic, true);
    H.parts.pelvis.body.setBodyType(R.RigidBodyType.Fixed, true); H.parts.chest.body.setBodyType(R.RigidBodyType.Fixed, true);
    for (const j of H.list) j.jt.configureMotorPosition(j.name === jn ? v : 0, j.k * 3, j.d);
    for (let i = 0; i < 480; i++) world.step();
    const p = H.parts[part], q = p.body.rotation(), a = p.a, b = p.b, d = [b[0] - a[0], b[1] - a[1]];
    // 骨の向き（a→b）を回す（z まわりだけ見る）
    const ang = Math.atan2(d[1], d[0]), rz = 2 * Math.atan2(q.z, q.w);
    out.push(`${v > 0 ? '+' : '-'}: 向き ${((ang + rz) * 180 / Math.PI).toFixed(0)}°`);
    world.free();
  }
  const p0 = (() => { const w = new R.World({ x: 0, y: 0, z: 0 }); const H = buildHare(R, w, [0, 1, 0], () => 1); const p = H.parts[part]; const r = Math.atan2(p.b[1] - p.a[1], p.b[0] - p.a[0]) * 180 / Math.PI; w.free(); return r.toFixed(0); })();
  console.log(jn, '生まれたとき', p0 + '°', out.join('  '));
}
