// CPU とアセンブラの確かめ: 小さなプログラムを組み立てて動かし、答えをくらべる。
//   node retro-8bit/tools/test-cpu.mjs
import { assemble } from './asm.mjs';
import { CPU } from '../js/cpu.js';

const mem = new Uint8Array(65536);
const bus = { cpuRead: (a) => mem[a], cpuWrite: (a, v) => { mem[a] = v; } };

function run(src, steps = 10000) {
  const { bytes, syms } = assemble(src + '\n.pad $FFFC\n.word start\n.word 0', { origin: 0x8000, size: 0x8000 });
  mem.fill(0); mem.set(bytes, 0x8000);
  const cpu = new CPU(bus); cpu.reset();
  for (let i = 0; i < steps && mem[0xff] === 0; i++) cpu.step();
  return { cpu, syms };
}

let bad = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'NG '} ${name}: ${got}${ok ? '' : ' （正しくは ' + want + '）'}`);
}

// 1) 足し算・引き算とフラグ
{
  const { cpu } = run(`
.org $8000
start:
  clc
  lda #$50
  adc #$50      ; $A0、オーバーフローあり
  sta $10
  php
  pla
  sta $11
  sec
  lda #$50
  sbc #$f0      ; $60、借りあり
  sta $12
  php
  pla
  sta $13
  lda #1
  sta $ff
@w: jmp @w`);
  check('ADC 50+50', mem[0x10], 0xa0);
  check('ADC のフラグ N V', mem[0x11] & 0xc1, 0xc0);
  check('SBC 50-F0', mem[0x12], 0x60);
  check('SBC のフラグ C', mem[0x13] & 0x01, 0);
}

// 2) ループ・(zp),y・JSR/RTS・シフト
{
  run(`
ptr = $20
.org $8000
start:
  lda #<buf
  sta ptr
  lda #>buf
  sta ptr+1
  ldy #0
@loop:
  tya
  jsr dbl
  sta (ptr),y
  iny
  cpy #10
  bne @loop
  ldx #$ff
  txs
  lda #$81
  lsr a
  ror $30       ; キャリー1 が上に
  lda #1
  sta $ff
@w: jmp @w
dbl:
  asl a
  rts
buf = $0300`);
  check('(zp),y で書いた9番目', mem[0x0309], 18);
  check('ROR でキャリーが上へ', mem[0x30], 0x80);
}

// 3) 16ビットの足し算と比べる・分かれ道
{
  run(`
.org $8000
start:
  lda #$ff
  sta $40
  lda #$00
  sta $41
  ldx #3
@add:
  clc
  lda $40
  adc #1
  sta $40
  lda $41
  adc #0
  sta $41
  dex
  bne @add
  lda #5
  cmp #7
  bcs @no
  lda #$aa
  sta $42
@no:
  lda #1
  sta $ff
@w: jmp @w`);
  check('16ビット $00FF+3', mem[0x40] | (mem[0x41] << 8), 0x0102);
  check('CMP 5<7 で BCS しない', mem[0x42], 0xaa);
}

console.log(bad ? `\n${bad} こ ちがう` : '\nぜんぶ正しい');
process.exit(bad ? 1 : 0);
