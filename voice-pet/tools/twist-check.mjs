// 背骨のねじりの関節の硬さ（twistK）をかえて、ねじりなしで学んだ歩き方（gait-kid-*.json）がそのまま歩けるかを、8か所で数える
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { kidBody } from '../js/kid.js';
await R.init();
for (const f of ['gait-kid-3.json', 'gait-kid-6.json', 'gait-kid-8-steer.json']) {
  const j = JSON.parse(fs.readFileSync(new URL('../js/' + f, import.meta.url)));
  const row = [];
  for (const over of [{ twist: false }, { twist: true, twistK: 3, twistM: 0.3 }, { twist: true, twistK: 3, twistM: 0.6 }, { twist: true, twistK: 8, twistM: 0.6 }]) {
    const B = kidBody(j.genes, over); let ok = 0, d = 0;
    for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.3, r = trial(R, j.v, { dur: 6, turn: () => 0, body: B, at: [Math.cos(a) * 4, 0, Math.sin(a) * 4] }); r.world.free(); if (!r.fell && r.dist > 1) ok++; d += r.dist / 8; }
    row.push(`${over.twist ? 'ねじり×' + over.twistK + ' 重さ' + over.twistM : 'なし'} ${ok}/8 ${d.toFixed(2)}m`);
  }
  console.log(f, row.join(' | '));
}
