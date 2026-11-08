// 起き上がりの型をやめる上向き（0.85 と 0.7）で、8番の子が起きられる数をくらべる（左右×4か所）
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { kidGenes, kidBody } from '../js/kid.js';
import { tryGetup } from '../js/getup-practice.js';
await R.init();
const v = JSON.parse(fs.readFileSync(new URL('../js/getup-kid-8-tw.json', import.meta.url))).v, B = kidBody(kidGenes(8 * 7919));
for (const UP of [0.85, 0.7, 0.6]) { let ok = 0, n = 0, t = 0; for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4, at = [Math.cos(a) * 3, 0, Math.sin(a) * 3]; for (const d of [1, -1]) { const r = tryGetup(R, B, v, at, d, UP); if (r) { n++; if (r.ok) { ok++; t += r.tUp; } } } } console.log(`上向き ${UP} でやめる: 起きた ${ok}/${n}`); }
