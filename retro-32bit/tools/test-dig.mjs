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
console.log(fails ? `${fails} こ NG` : 'ぜんぶ ok');
process.exitCode = fails ? 1 : 0;
