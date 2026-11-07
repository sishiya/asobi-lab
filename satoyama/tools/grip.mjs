// 摩擦の強さを変えて、同じ跳び方のすべり・進み・転びを見る（地面と足の摩擦。Rapier はふつう2つの平均）
import fs from 'node:fs'; import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
await R.init();
const v = JSON.parse(fs.readFileSync(new URL('../js/' + (process.argv[2] || 'gait-hare-straight.json'), import.meta.url))).v;
for (const mu of [0.95, 1.3, 1.8]) {
  let slip = 0, dist = 0, fell = 0, y = 0; const at = [[0, 0, 0], [2, 0, 1], [-3, 0, -2], [4, 0, -3]];
  for (const a of at) {
    const r = trial(R, v, { dur: 6, at: a, turn: () => 0, setup: (world, H) => { world.forEachCollider(c => c.setFriction(mu)); } });
    slip += r.slip; dist += r.dist; fell += r.fell; y += r.yRatio; r.world.free();
  }
  console.log(`摩擦 ${mu}: すべり ${(slip / 4 * 100).toFixed(1)}cm/秒 進む ${(dist / 4).toFixed(2)}m Y字 ${(y / 4 * 100).toFixed(0)}% 転ぶ ${fell}/4`);
}
