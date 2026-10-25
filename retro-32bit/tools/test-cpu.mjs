// CPU とアセンブラの確かめ: 小さなプログラムを組み立てて動かし、答えをくらべる。
//   node retro-32bit/tools/test-cpu.mjs
import { assemble, makeExe } from './asm.mjs';
import { Console32 } from '../js/psx.js';

function run(body, steps = 2000) {
  const exe = makeExe(assemble(`.org 0x80010000\nstart:\n${body}\nfin: b fin\n nop\n`));
  const m = new Console32(); m.loadExe(exe);
  for (let i = 0; i < steps; i++) m.cpu.step();
  return m;
}
const hex = (v) => '0x' + (v >>> 0).toString(16).padStart(8, '0');
let bad = 0;
function check(name, got, want) {
  const ok = (got >>> 0) === (want >>> 0);
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'NG '} ${name}: ${hex(got)}${ok ? '' : ' （正しくは ' + hex(want) + '）'}`);
}
const R = (m, n) => m.cpu.r[{ t0: 8, t1: 9, t2: 10, t3: 11, t4: 12, t5: 13, v0: 2, v1: 3, ra: 31 }[n]];

{ // 足し算・li・la・論理
  const m = run(`
  li t0, 0x12345678
  li t1, -2
  addu t2, t0, t1
  li t3, 0xffff
  nor t4, zero, zero
  la t5, start`);
  check('li 2語', R(m, 't0'), 0x12345678);
  check('li 負', R(m, 't1'), -2);
  check('addu', R(m, 't2'), 0x12345676);
  check('li ori', R(m, 't3'), 0xffff);
  check('nor', R(m, 't4'), 0xffffffff);
  check('la', R(m, 't5'), 0x80010000);
}
{ // 遅延スロット: とぶ命令のつぎは、とぶ前に動く
  const m = run(`
  li t0, 1
  b @skip
  li t1, 5
  li t0, 99
@skip:
  addiu t0, t0, 1`);
  check('遅延スロット', R(m, 't1'), 5);
  check('とんだ先', R(m, 't0'), 2);
}
{ // ロードの遅れ: 読んだすぐあとの命令には、まだ前の値
  const m = run(`
  li t0, 7
  li t2, 42
  la t3, data
  sw t2, 0(t3)
  lw t0, 0(t3)
  move t1, t0
  move t4, t0
  b fin
  nop
.align 4
data: .word 0`);
  check('すぐあと（前の値）', R(m, 't1'), 7);
  check('つぎのつぎ', R(m, 't4'), 42);
}
{ // かけ算・割り算
  const m = run(`
  li t0, -3
  li t1, 0x40000000
  mult t0, t1
  mfhi t2
  mflo t3
  multu t0, t1
  mfhi t4
  li t5, 0
  div t1, t5
  mflo v0
  mfhi v1`);
  check('mult hi', R(m, 't2'), 0xffffffff);
  check('mult lo', R(m, 't3'), 0x40000000);
  check('multu hi', R(m, 't4'), 0x3fffffff);
  check('0で割る lo', R(m, 'v0'), 0xffffffff);
  check('0で割る hi', R(m, 'v1'), 0x40000000);
}
{ // そろっていない読み書き（lwl・lwr・swl・swr）
  const m = run(`
  la t3, data
  lwr t0, 1(t3)
  lwl t0, 4(t3)
  li t1, 0xaabbccdd
  swr t1, 9(t3)
  swl t1, 12(t3)
  lw t2, 8(t3)
  lw t4, 12(t3)
  nop
  b fin
  nop
.align 4
data: .word 0x44332211, 0x88776655, 0, 0`);
  check('lwr+lwl', R(m, 't0'), 0x55443322);
  check('swr', R(m, 't2'), 0xbbccdd00);
  check('swl', R(m, 't4'), 0x000000aa);
}
{ // jal・jalr・シフト・比べる
  const m = run(`
  jal @f
  nop
  move t1, ra
  li t2, -16
  sra t3, t2, 2
  srl t4, t2, 28
  sltiu t5, zero, -1
  b fin
  nop
@f:
  jr ra
  nop`);
  check('jal の ra', R(m, 't1'), 0x80010008);
  check('sra', R(m, 't3'), -4);
  check('srl', R(m, 't4'), 0xf);
  check('sltiu（符号を広げてから符号なしで比べる）', R(m, 't5'), 1);
}
{ // あふれの例外
  const exe = makeExe(assemble(`.org 0x80010000\nstart:\n li t0, 0x7fffffff\n addi t1, t0, 1\n nop\n`));
  const m = new Console32(); m.loadExe(exe);
  for (let i = 0; i < 3; i++) m.cpu.step();
  check('例外の原因（12＝あふれ）', (m.cpu.cop0[13] >> 2) & 31, 12);
  check('EPC', m.cpu.cop0[14], 0x80010008);
  check('t1 は書かれない', R(m, 't1'), 0);
}
console.log(bad ? `\n${bad} こ ちがいます` : '\nぜんぶ ok');
process.exit(bad ? 1 : 0);
