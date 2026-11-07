// 向きの指示（turn）に対して、どれだけ曲がるか（秒あたりの角度）を跳び方ごとに測る。＋で左＝yaw が増える
import fs from 'node:fs'; import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { pose } from '../js/hare.js';
await R.init();
for (const g of process.argv.slice(2).length ? process.argv.slice(2) : ['turn', 'steer']) {
  const v = JSON.parse(fs.readFileSync(new URL(`../js/gait-hare-${g}.json`, import.meta.url))).v, row = [];
  for (const tc of [-1, -0.5, 0, 0.5, 1]) {
    let rate = 0, fell = 0; const at = [[0, 0, 0], [3, 0, -2], [-4, 0, 3]];
    for (const a of at) {
      let y0 = null, y1 = 0, acc = 0, last = null;
      const r = trial(R, v, { dur: 5, at: a, turn: () => tc, onFrame: (t, H, P) => { if (t < 1) return; if (last != null) { let d = P.yaw - last; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; acc += d; } last = P.yaw; } });
      rate += acc / 4; fell += r.fell; r.world.free();
    }
    row.push(`${tc >= 0 ? '+' : ''}${tc}: ${(rate / 3).toFixed(2)}rad/秒${fell ? `(転${fell})` : ''}`);
  }
  console.log(g.padEnd(6), row.join('  '));
}
