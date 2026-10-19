// 段階Aの決まり（js/sim.js）を node で流して確かめる。使い方: node pathstones/tools/sim-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE, makeState, step, hashState, buildPath, enemyBody } from '../js/sim.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(fs.readFileSync(path.join(dir, '../levels/field1.json'), 'utf8'));

// 1) 通り道と1周の時間
const s0 = makeState(level);
console.log('通り道の長さ', s0.path.total.toFixed(1), '1周', (s0.path.total / RULE.enemy.speed).toFixed(1), '秒');
const lit = level.lamps.map(l => ({ ...l, lit: true }));
const p2 = buildPath(lit);
console.log('Cをともした後', p2.total.toFixed(1), '1周', (p2.total / RULE.enemy.speed).toFixed(1), '秒');

// 2) 同じ入力なら同じ結果
const run = (inputs, ticks) => { const s = makeState(level); for (let i = 0; i < ticks; i++) step(s, inputs(i, s)); return s; };
const idle = () => ({});
console.log('同じか', hashState(run(idle, 3600)) === hashState(run(idle, 3600)));

// 3) 台本: 南へ出て積み木を拾い、Aへ戻ってわなを置き、待つ → 切れるか
function script(delay = 0, side = 0) {
  const s = makeState(level); const log = [];
  let phase = 0, wait = 0;
  for (let i = 0; i < 60 * 60; i++) {
    let inp = {};
    const me = s.me;
    if (phase === 0) { const tx = 8 + side, ty = 18.2; const dx = tx - me.x, dy = ty - me.y; if (Math.hypot(dx, dy) < 0.2) phase = 1; else inp = { dx, dy }; }
    else if (phase === 1) { const dx = 8 - me.x, dy = 15.1 - me.y; if (Math.hypot(dx, dy) < 0.3) { phase = 2; wait = delay; } else inp = { dx, dy }; }
    else if (phase === 2) { if ((wait -= RULE.dt) <= 0) { inp = { trap: true }; phase = 3; } }
    step(s, inp);
    for (const e of s.events) if (e.type !== 'stack') log.push(`${s.time.toFixed(1)}s ${e.type}${e.got ? ' ' + e.got + '節' : ''}`);
    if (log.some(l => l.includes('cut'))) break;
  }
  return { s, log };
}
const r = script();
console.log('台本:', r.log.join(' / '));
// 置く時刻のずれ
let ok = 0, tot = 0;
for (let d = 0; d <= 30; d += 1) { const x = script(d); tot++; if (x.log.some(l => l.includes('cut'))) ok++; }
console.log('置く時刻を 0〜30秒おくらせて切れた割合', ok + '/' + tot);

// 4) わなの幅: 通り道（下の直線 y=18）から横にずらした所に、いろいろな時刻にわなを置く（自分は灯りの中で待つ）
const rows = [];
for (let off = -1.5; off <= 1.51; off += 0.25) {
  let hit = 0, n = 0; const got = {};
  for (let t0 = 0; t0 < 25; t0 += 0.5) {
    const s = makeState(level); s.loose = [];
    const T = Math.round(t0 / RULE.dt);
    let cut = null;
    for (let i = 0; i < T + 60 * 30 && !cut; i++) {
      if (i === T) s.traps.push({ id: 'X', x: 12, y: 18 + off, h: 0, t: 0, done: false });
      step(s, {});
      for (const e of s.events) if (e.type === 'cut') cut = e;
    }
    n++; if (cut) { hit++; got[cut.got] = (got[cut.got] || 0) + 1; }
  }
  rows.push(`ずれ ${off.toFixed(2).padStart(5)}: 切れた ${String(Math.round(hit / n * 100)).padStart(3)}%  取れた節 ${JSON.stringify(got)}`);
}
console.log(rows.join(String.fromCharCode(10)));
