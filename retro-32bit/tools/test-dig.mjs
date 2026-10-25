// ほって つんで 3D の決まりの確かめ（作る・たき火で朝まで・のろしで勝ち）。持ち物と場所は RAM に書いてはじめ、あとはボタンを押すだけ
//   node retro-32bit/tools/test-dig.mjs [--shots]（--shots: 作る帯・煙と船・夜のたき火の絵を _dev/retro-32bit/ に）
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';
import { buildSoft } from './lib.mjs';
import { writePng } from './png.mjs';

const SHOTS = process.argv.includes('--shots');
const { exe, syms } = await buildSoft('dig32');
const OFF = { TGT: 10, PLC: 12, YAW: 4, PIT: 5, DIRTY: 18, TIME: 26, LVL: 27, CRAFT: 37, BLADE: 39, DAY: 40, WIN: 41, WINP: 42, WINT: 43 };
let fails = 0;
const ok = (name, cond, info = '') => { console.log(`${cond ? 'ok  ' : 'NG  '} ${name}${info ? '  ' + info : ''}`); if (!cond) fails++; };

function boot() {
  const m = new Console32(); m.loadExe(exe);
  const vb = (syms.vars & 0x1fffff) >> 2, wb = syms.world & 0x1fffff, iv = syms.inv & 0x1fffff;
  const t = {
    m, V: (k) => m.ram32[vb + OFF[k]] | 0, set: (k, v) => { m.ram32[vb + OFF[k]] = v; },
    inv: (i) => m.ram[iv + i], setInv: (a) => a.forEach((v, i) => { m.ram[iv + i] = v; }),
    block: (i) => m.ram[wb + i], setBlock: (i, b) => { m.ram[wb + i] = b; m.ram32[vb + OFF.DIRTY] = 0xffff; },
    run: (n) => { for (let i = 0; i < n; i++) { m.runFrame(); m.spu.take(); } },
    press: (k) => { m.sio.buttons[0] = 1 << BTN[k]; t.run(2); m.sio.buttons[0] = 0; t.run(2); },
    shot: (n) => { if (!SHOTS) return; const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf); writePng(`${import.meta.dirname}/../../_dev/retro-32bit/${n}.png`, w, h, (x, y) => { const o = (y * w + x) * 4; return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2]; }, 2); },
  };
  t.run(30);
  return t;
}

// 作る: 幹 2・石 2・葉 3・火山ガラス 1 → 板 4 × 2 → たき火（板 2・石 2）→ 刃（板 1・ガラス 1）→ のろし（板 3・葉 3）
{
  const t = boot();
  t.setInv([0, 0, 5, 2, 0, 2, 3, 0, 1]);
  t.press('SELECT'); ok('SELECT で作る帯が開く', t.V('CRAFT') === 1);
  t.press('A'); t.press('A'); ok('幹 1 → 板 4（2 回）', t.inv(5) === 0 && t.inv(7) === 8, `板 ${t.inv(7)}`);
  t.press('A'); ok('材料が足りないと作れない', t.inv(7) === 8);
  t.press('RIGHT'); t.press('A'); ok('たき火（板 2・石 2）', t.inv(11) === 1 && t.inv(3) === 0 && t.inv(7) === 6);
  t.press('RIGHT'); t.press('A'); ok('火山ガラスの刃（板 1・ガラス 1）', t.V('BLADE') === 1 && t.inv(8) === 0 && t.inv(7) === 5);
  t.press('RIGHT'); t.shot('craft-bar'); t.press('A'); ok('のろし（板 3・葉 3）', t.inv(12) === 1 && t.inv(6) === 0 && t.inv(7) === 2);
  const time = t.V('TIME'); t.run(30); ok('帯が開いている間は時刻が止まる', t.V('TIME') === time);
  t.press('SELECT'); ok('SELECT で閉じる', t.V('CRAFT') === 0);
}
// 夜にたき火をねらって X → 明け方へ。1 日が回ると何日目がふえる
{
  const t = boot();
  t.set('TIME', 250 * 64); t.run(3);
  t.setBlock(t.V('TGT'), 11); t.run(3);
  ok('夜（段 7）', t.V('LVL') === 7);
  t.press('X'); ok('子ガメが陸にいる間は休めない', (t.V('TIME') >> 6) < 316, `時刻 ${t.V('TIME') >> 6}`);
  for (let i = 0; i < 4; i++) t.m.ram32[((syms.crits & 0x1fffff) >> 2) + i * 8] = 0; // 子ガメが海へ帰ったあと
  t.press('X'); ok('たき火で明け方へ', (t.V('TIME') >> 6) === 316, `時刻 ${t.V('TIME') >> 6}`);
  t.shot('night-fire');
  t.run(22 * 64); ok('朝になって 2 日目', t.V('LVL') === 0 && t.V('DAY') === 2, `段 ${t.V('LVL')} 日 ${t.V('DAY')}`);
}
// のろし: 低い所では勝ちにならない。島のいちばん高い地面の高さ以上に置くと勝ち
{
  const t = boot();
  t.setInv([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]); t.run(2);
  const { m } = t; m.ram32[((syms.vars & 0x1fffff) >> 2) + 15] = 12; // V_SEL = のろし
  t.press('X'); ok('低い所に置いても勝ちにならない', t.V('WIN') === 0 && t.inv(12) === 1, `置ける所 ${t.V('PLC')} 高さ ${t.V('PLC') >> 10}`);
  // 島のいちばん高い地面（y = SUMMIT の草）の上へ立たせて、足もとに置く
  let top = -1;
  for (let i = 0; i < 32 * 32; i++) if (t.block(10 * 1024 + i) === 1 && t.block(11 * 1024 + i) === 0) { top = i; break; }
  ok('いちばん高い草が見つかる', top >= 0);
  const vb = (syms.vars & 0x1fffff) >> 2;
  m.ram32[vb + 0] = (top & 31) * 256 + 128; m.ram32[vb + 1] = 11 * 256; m.ram32[vb + 2] = (top >> 5) * 256 + 128 + 300;
  t.set('PIT', -40 << 8); t.run(4);
  t.press('X'); ok('頂上に置くと船を呼べる', t.V('WIN') === 1 && t.inv(12) === 0, `置いた高さ ${t.V('WINP') >> 10}`);
  t.set('WIN', 1); t.set('WINP', 11 * 1024 + 13 * 32 + 21); t.set('WINT', 1500); t.run(20);
  t.shot('win-smoke'); t.set('YAW', 196 << 8); t.run(4); t.shot('win-ship');
}
// 夜の生き物: 子ガメは海へ（たき火で迷い、壁で灯りをかくすと海へ）・ヤシガニは持っていき、つつくと落とす
{
  const crit = (t, i) => { const b = ((syms.crits & 0x1fffff) >> 2) + i * 8, r = t.m.ram32; return { type: r[b], x: r[b + 1] | 0, y: r[b + 2] | 0, z: r[b + 3] | 0, carry: r[b + 6], flee: r[b + 7] | 0 }; };
  const OFFX = { TSAVE: 48, TSPAWN: 50, CX: 0, CY: 1, CZ: 2, SEL: 15 };
  const night = (t) => { t.set('TIME', 231 * 64); t.run(4); };
  // そのまま
  let t = boot(); night(t);
  const types = [0, 1, 2, 3, 4, 5].map((i) => crit(t, i).type).join('');
  ok('はじめの夜は子ガメ 4 匹・ヤシガニ 1 匹', types === '111120', types);
  const nest = crit(t, 0);
  t.run(900);
  const r32 = (t, k) => t.m.ram32[((syms.vars & 0x1fffff) >> 2) + OFFX[k]] | 0;
  ok('たき火がなければ子ガメは海へ', r32(t, 'TSAVE') === 4, `守れた ${r32(t, 'TSAVE')}`);
  // 巣から内へ 4 ブロックの地面にたき火
  const sea = [nest.x >> 8, nest.z >> 8];
  const inland = (t) => { // 巣から島のまん中の向きへ 3〜6 ブロックの、草か砂の地面の上（木の上にしない）
    const dx = Math.sign(15.5 - sea[0]), dz = Math.sign(15.5 - sea[1]);
    for (let k = 3; k <= 6; k++) for (const [ax, az] of [[dx, dz], [dx, 0], [0, dz]]) {
      const fx = sea[0] + ax * k, fz = sea[1] + az * k;
      let y = 15; while (y > 0 && t.block(y * 1024 + fz * 32 + fx) === 0) y--;
      if ([1, 4].includes(t.block(y * 1024 + fz * 32 + fx))) return { fx, fz, y: y + 1, idx: (y + 1) * 1024 + fz * 32 + fx };
    }
    throw new Error('たき火を置く地面がない');
  };
  t = boot();
  const f = inland(t);
  t.setBlock(f.idx, 11);
  const fl = (syms.fires & 0x1fffff) >> 2; t.m.ram32[fl] = f.idx;
  night(t); t.run(900);
  const near = [0, 1, 2, 3].map((i) => crit(t, i)).filter((c) => c.type === 1).map((c) => Math.hypot((c.x >> 8) - f.fx, (c.z >> 8) - f.fz).toFixed(1));
  ok('たき火が見えると子ガメは陸へ迷う', r32(t, 'TSAVE') < 4, `守れた ${r32(t, 'TSAVE')}・たき火までの距離 ${near.join(' ')}`);
  t.shot('turtles-fire');
  // 壁でかくす: たき火のまわり 4 方に 2 段の壁
  t = boot();
  t.setBlock(f.idx, 11); t.m.ram32[fl] = f.idx;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) for (let k = 0; k < 2; k++) { const i = f.idx + k * 1024 + dz * 32 + dx; if (t.block(i) === 0) t.setBlock(i, 3); }
  night(t); t.run(900);
  ok('壁で灯りをかくすと海へ', r32(t, 'TSAVE') === 4, `守れた ${r32(t, 'TSAVE')}`);
  // ヤシガニ: 人をヤシガニの横へ。ふれると持っていく → つつくと落とす
  t = boot(); night(t);
  t.setInv([0, 0, 5]);
  const c0 = crit(t, 4), vb = (syms.vars & 0x1fffff) >> 2;
  const ux = Math.sign(15.5 * 256 - c0.x), uz = Math.sign(15.5 * 256 - c0.z); // 島の内がわ 2 ブロックに立つ
  t.m.ram32[vb + 0] = c0.x + ux * 512; t.m.ram32[vb + 2] = c0.z + uz * 512; t.m.ram32[vb + 1] = c0.y + 512; t.run(30);
  let k = 0; while (crit(t, 4).carry === 0 && k++ < 600) t.run(1);
  ok('ヤシガニがふれると 1 つ持っていく', crit(t, 4).carry === 2 && t.inv(2) === 4, `持っている ${crit(t, 4).carry}・土 ${t.inv(2)}・${k} こま`);
  const c1 = crit(t, 4); // 向きをヤシガニへ（歩く向き = sin・cos）
  const yaw = Math.round((Math.atan2(c1.x - (t.m.ram32[vb] | 0), c1.z - (t.m.ram32[vb + 2] | 0)) / (Math.PI * 2)) * 256) & 255;
  t.set('YAW', yaw << 8); t.set('PIT', (-20 * 256) >>> 0); t.run(1); t.shot('crab-near'); t.press('B');
  ok('B でつつくと落として逃げる', crit(t, 4).carry === 0 && t.inv(2) === 5 && crit(t, 4).flee > 0, `土 ${t.inv(2)}`);
  // 持っていかれたまま海へ → 朝に浜へ打ち上がってもどる
  t = boot(); night(t); t.setInv([0, 0, 5]);
  const c2 = crit(t, 4), u2x = Math.sign(15.5 * 256 - c2.x), u2z = Math.sign(15.5 * 256 - c2.z);
  t.m.ram32[vb + 0] = c2.x + u2x * 512; t.m.ram32[vb + 2] = c2.z + u2z * 512; t.m.ram32[vb + 1] = c2.y + 512; t.run(30);
  k = 0; while (crit(t, 4).carry === 0 && k++ < 600) t.run(1);
  t.m.ram32[vb + 0] = 16 * 256; t.m.ram32[vb + 2] = 16 * 256; t.m.ram32[vb + 1] = 15 * 256; // 人は島のまん中へ
  k = 0; while (crit(t, 4).type && k++ < 1500) t.run(1);
  ok('ヤシガニが海へ入る', crit(t, 4).type === 0 && t.inv(2) === 4, `${k} こま・土 ${t.inv(2)}`);
  t.set('TIME', 336 * 64 - 10); t.run(30);
  ok('朝に浜へ打ち上がってもどる', t.inv(2) === 5, `土 ${t.inv(2)}`);
  // 2 日目の夜はヤシガニ 2 匹
  t = boot(); t.set('DAY', 2); night(t);
  ok('2 日目の夜はヤシガニ 2 匹', crit(t, 4).type === 2 && crit(t, 5).type === 2);
}
console.log(fails ? `${fails} こ NG` : 'ぜんぶ ok');
process.exitCode = fails ? 1 : 0;
