// マッパーの確かめ（画面なし）。自分で組んだ形だけの ROM（8KB の PRG・1KB の CHR を、それぞれの番号でうめる）に
// レジスタを書き、CPU・PPU から見える番号と、IRQ の出るタイミングを、資料の決まりとくらべる。市販のソフトは使わない。
//   node retro-8bit/tools/test-mappers.mjs
import { Cart, MAPPERS } from '../js/cart.js';

// prg: 16KB の数、chr: 8KB の数（0 なら CHR RAM）
function rom(mapper, prg = 16, chr = 16, { vert = false, sub = 0 } = {}) {
  const h = new Uint8Array(16);
  h.set([0x4e, 0x45, 0x53, 0x1a, prg, chr, ((mapper & 15) << 4) | (vert ? 1 : 0), (mapper & 0xf0) | (sub ? 8 : 0), sub << 4]);
  const P = new Uint8Array(prg * 16384), C = new Uint8Array(chr * 8192);
  for (let i = 0; i < P.length; i++) P[i] = i >> 13;
  for (let i = 0; i < C.length; i++) C[i] = i >> 10;
  const b = new Uint8Array(16 + P.length + C.length); b.set(h); b.set(P, 16); b.set(C, 16 + P.length);
  return new Cart(b);
}
let ok = 0, ng = 0;
const prgOf = (c) => [0x8000, 0xa000, 0xc000, 0xe000].map((a) => c.cpuRead(a));
const chrOf = (c) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => c.chrRead(i * 1024));
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) ok++; else { ng++; console.log(`NG  ${name}: ${g}（ほしいのは ${w}）`); }
}
const last = 31;   // 16 × 16KB = 32 × 8KB の最後

// 0 NROM
{ const c = rom(0, 2, 1); eq('0 PRG', prgOf(c), [0, 1, 2, 3]); eq('0 CHR', chrOf(c), [0, 1, 2, 3, 4, 5, 6, 7]); }
// 1 MMC1（512KB は CHR の 4 ビット目で後ろの 256KB）
{
  const c = rom(1, 32, 0), w = (a, v) => { for (let i = 0; i < 5; i++) c.cpuWrite(a, (v >> i) & 1); };
  eq('1 起動', prgOf(c), [0, 1, 62, 63].map((n) => n % 32 === n ? n : n));
  w(0x8000, 0x0c); w(0xe000, 3); eq('1 PRG', prgOf(c), [6, 7, 30, 31]);
  w(0xa000, 0x10); eq('1 512KB', prgOf(c), [38, 39, 62, 63]);
  w(0x8000, 0x02); eq('1 折り返し', c.mirror, 'vert');
}
// 2・3・7・11・66
{ const c = rom(2); c.cpuWrite(0x8000, 5); eq('2', prgOf(c), [10, 11, 30, 31]); }
{ const c = rom(3, 2, 4); c.cpuWrite(0x8000, 2); eq('3', chrOf(c), [16, 17, 18, 19, 20, 21, 22, 23]); }
{ const c = rom(7, 8, 0); c.cpuWrite(0x8000, 0x13); eq('7', [prgOf(c), c.mirror], [[12, 13, 14, 15], 'one1']); }
{ const c = rom(11, 8, 16); c.cpuWrite(0x8000, 0x52); eq('11', [prgOf(c), chrOf(c)[0]], [[8, 9, 10, 11], 40]); }
{ const c = rom(66, 8, 4); c.cpuWrite(0x8000, 0x21); eq('66', [prgOf(c), chrOf(c)[7]], [[8, 9, 10, 11], 15]); }
{ const c = rom(140, 8, 16); c.cpuWrite(0x6000, 0x13); eq('140', [prgOf(c), chrOf(c)[0]], [[4, 5, 6, 7], 24]); }
{ const c = rom(87, 2, 4); c.cpuWrite(0x6000, 1); eq('87', chrOf(c)[0], 16); }
{ const c = rom(71); c.cpuWrite(0xc000, 3); eq('71', prgOf(c), [6, 7, 30, 31]); }
{ const c = rom(34, 8, 0); c.cpuWrite(0x8000, 2); eq('34 BNROM', prgOf(c), [8, 9, 10, 11]); }
{ const c = rom(34, 4, 4); c.cpuWrite(0x7ffd, 1); c.cpuWrite(0x7ffe, 3); c.cpuWrite(0x7fff, 5); eq('34 NINA', [prgOf(c), chrOf(c)[0], chrOf(c)[4]], [[4, 5, 6, 7], 12, 20]); }
{ const c = rom(180, 8, 0); c.cpuWrite(0x8000, 5); eq('180', prgOf(c), [0, 1, 10, 11]); }
{ const c = rom(184, 2, 4); c.cpuWrite(0x6000, 0x12); eq('184', [chrOf(c)[0], chrOf(c)[4]], [8, 20]); }
{ const c = rom(89, 8, 16); c.cpuWrite(0x8000, 0xab); eq('89', [prgOf(c), chrOf(c)[0], c.mirror], [[4, 5, 14, 15], 88, 'one1']); }
{ const c = rom(93, 8, 0); c.cpuWrite(0x8000, 0x30); eq('93', prgOf(c), [6, 7, 14, 15]); }

// 4 MMC3: バンクと IRQ（latch 20 → 21 回めの行で）
{
  const c = rom(4, 16, 16);
  c.cpuWrite(0x8000, 6); c.cpuWrite(0x8001, 3); c.cpuWrite(0x8000, 7); c.cpuWrite(0x8001, 4);
  eq('4 PRG', prgOf(c), [3, 4, 30, 31]);
  c.cpuWrite(0x8000, 0x46); eq('4 PRG 入れかえ', prgOf(c), [30, 4, 3, 31]);
  c.cpuWrite(0x8000, 0x80); c.cpuWrite(0x8001, 8); c.cpuWrite(0x8000, 0x82); c.cpuWrite(0x8001, 50);
  eq('4 CHR', chrOf(c).slice(0, 5), [50, 5, 6, 7, 8]);
  c.cpuWrite(0xc000, 20); c.cpuWrite(0xc001, 0); c.cpuWrite(0xe001, 0);
  let at = -1; for (let l = 0; l < 40 && at < 0; l++) { c.scanline(l); if (c.irqLine) at = l; }
  eq('4 IRQ の行', at, 20);
}
// 118 TxSROM: 画面の表も CHR の番号の 7 ビット目
{ const c = rom(118); c.cpuWrite(0x8000, 0); c.cpuWrite(0x8001, 0x80); eq('118 表', c.ntOff, [1024, 1024, 0, 0]); }
// 206・88・154
{ const c = rom(206, 8, 8); c.cpuWrite(0x8000, 6); c.cpuWrite(0x8001, 5); c.cpuWrite(0x8000, 2); c.cpuWrite(0x8001, 9); eq('206', [prgOf(c), chrOf(c)[4]], [[5, 1, 14, 15], 9]); }
{ const c = rom(88, 8, 16); c.cpuWrite(0x8000, 2); c.cpuWrite(0x8001, 1); c.cpuWrite(0x8000, 0); c.cpuWrite(0x8001, 4); eq('88', [chrOf(c)[0], chrOf(c)[4]], [4, 65]); }
{ const c = rom(154, 8, 16); c.cpuWrite(0x8000, 0x40); eq('154', c.mirror, 'one1'); }

// 9 MMC2・10 MMC4: $FD・$FE の絵を読むと切りかわる
{
  const c = rom(9, 8, 16);
  c.cpuWrite(0xa000, 2); eq('9 PRG', prgOf(c), [2, 13, 14, 15]);
  c.cpuWrite(0xb000, 3); c.cpuWrite(0xc000, 5); c.cpuWrite(0xd000, 7); c.cpuWrite(0xe000, 9);
  eq('9 はじめ（FE）', [chrOf(c)[0], chrOf(c)[4]], [20, 36]);
  c.chrRead(0x0fd8); c.chrRead(0x1fdb); eq('9 FD', [chrOf(c)[0], chrOf(c)[4]], [12, 28]);
  c.chrRead(0x0fea); eq('9 MMC2 は $0FE8 ちょうどだけ', chrOf(c)[0], 12);
  c.chrRead(0x0fe8); eq('9 FE', chrOf(c)[0], 20);
  const d = rom(10, 8, 16); d.cpuWrite(0xa000, 2); d.cpuWrite(0xb000, 3); d.cpuWrite(0xc000, 5); d.chrRead(0x0fdd);
  eq('10', [prgOf(d), chrOf(d)[0]], [[4, 5, 14, 15], 12]);
}

// VRC2/4: どの配線の番地でも同じレジスタ
for (const [m, a1, a2] of [[21, 0x02, 0x04], [21, 0x40, 0x80], [23, 0x01, 0x02], [23, 0x04, 0x08], [25, 0x02, 0x01], [25, 0x08, 0x04]]) {
  const c = rom(m, 16, 16);
  c.cpuWrite(0x8000, 3); c.cpuWrite(0xa000, 4);
  c.cpuWrite(0xb000, 5); c.cpuWrite(0xb000 | a1, 1); c.cpuWrite(0xb000 | a2, 7);   // CHR0 = $15・CHR1 = 7
  c.cpuWrite(0x9000, 1);
  eq(`${m}（${a1.toString(16)}・${a2.toString(16)}）`, [prgOf(c), chrOf(c).slice(0, 2), c.mirror], [[3, 4, 30, 31], [21, 7], 'horz']);
  c.cpuWrite(0x9000 | a2, 2); eq(`${m} PRG 入れかえ`, prgOf(c), [30, 4, 3, 31]);
}
{ const c = rom(22, 16, 16); c.cpuWrite(0xb000, 6); eq('22 CHR は半分', chrOf(c)[0], 3); }
// VRC4 の IRQ: 行のモードで latch $F0 → 16 行（341×16/3 サイクル）
{
  const c = rom(21, 16, 16);
  c.cpuWrite(0xf000, 0x0); c.cpuWrite(0xf002, 0xf); c.cpuWrite(0xf004, 2);
  let cyc = 0; while (!c.irqLine && cyc < 100000) { c.clock(1); cyc++; }
  eq('21 IRQ の行', Math.round(cyc / (341 / 3)), 16);
}
// VRC6: バンクと音
{
  const c = rom(24, 16, 16);
  c.cpuWrite(0x8000, 3); c.cpuWrite(0xc000, 9); c.cpuWrite(0xd002, 40); c.cpuWrite(0xb003, 0x24);
  eq('24', [prgOf(c), chrOf(c)[2], c.mirror], [[6, 7, 9, 31], 40, 'horz']);
  const d = rom(26, 16, 16); d.cpuWrite(0xd001, 40); eq('26 は 0・1 が入れかわる', chrOf(d)[2], 40);
  c.cpuWrite(0x9000, 0x8f); c.cpuWrite(0x9002, 0x80); c.clock(10); eq('24 音', c.audio() > 0, true);
  c.cpuWrite(0xf000, 0xfe); c.cpuWrite(0xf001, 7); c.clock(1); c.clock(1); eq('24 IRQ（サイクル）', c.irqLine, true);
}
{ const c = rom(75, 8, 16); c.cpuWrite(0x8000, 2); c.cpuWrite(0x9000, 3); c.cpuWrite(0xe000, 1); eq('75', [prgOf(c), chrOf(c)[0], c.mirror], [[2, 1, 14, 15], 68, 'horz']); }

// 69 FME-7: $6000 の ROM と IRQ
{
  const c = rom(69, 16, 16), w = (k, v) => { c.cpuWrite(0x8000, k); c.cpuWrite(0xa000, v); };
  w(9, 3); w(10, 4); w(11, 5); w(0, 33); w(8, 7);
  eq('69', [prgOf(c), chrOf(c)[0], c.cpuRead(0x6000)], [[3, 4, 5, 31], 33, 7]);
  w(8, 0xc0); c.cpuWrite(0x6000, 0x55); eq('69 RAM', c.cpuRead(0x6000), 0x55);
  w(14, 100); w(15, 0); w(13, 0x81); c.clock(100); eq('69 IRQ まだ', c.irqLine, false); c.clock(1); eq('69 IRQ', c.irqLine, true);
}
// 19 ネームコ 163: CHR・表の割りあて・IRQ・音の RAM
{
  const c = rom(19, 16, 16);
  c.cpuWrite(0xe000, 3); c.cpuWrite(0x8000, 50); c.cpuWrite(0xc000, 0xe1); c.cpuWrite(0xc800, 10);
  eq('19', [prgOf(c), chrOf(c)[0], c.ntRead(0x2000) === c.ciram[1024], c.ntRead(0x2400)], [[3, 1, 30, 31], 50, true, 10]);
  c.cpuWrite(0x8000, 0xe0); c.chrWrite(0x10, 0x77); eq('19 CHR に本体の RAM', c.ciram[0x10], 0x77);
  c.cpuWrite(0x5000, 0xfd); c.cpuWrite(0x5800, 0xff); c.clock(1); eq('19 IRQ まだ', c.irqLine, false); c.clock(1); eq('19 IRQ', c.irqLine, true);
  c.cpuWrite(0xf800, 0x80 | 0x10); c.cpuWrite(0x4800, 1); c.cpuWrite(0x4800, 2); c.cpuWrite(0xf800, 0x90); eq('19 音の RAM', [c.cpuRead(0x4800), c.cpuRead(0x4800)], [1, 2]);
}
// 16 バンダイ・18 ジャレコ・65・32・33・48・67・68
{ const c = rom(16, 16, 16); c.cpuWrite(0x6008, 2); c.cpuWrite(0x8003, 9); eq('16', [prgOf(c), chrOf(c)[3]], [[4, 5, 30, 31], 9]);
  c.cpuWrite(0x800b, 10); c.cpuWrite(0x800c, 0); c.cpuWrite(0x800a, 1); c.clock(9); eq('16 IRQ まだ', c.irqLine, false); c.clock(1); eq('16 IRQ', c.irqLine, true); }
{ const c = rom(18, 16, 16); c.cpuWrite(0x8000, 5); c.cpuWrite(0x8001, 1); c.cpuWrite(0xa000, 3); c.cpuWrite(0xa001, 2); c.cpuWrite(0xf002, 1);
  eq('18', [prgOf(c), chrOf(c)[0], c.mirror], [[21, 1, 30, 31], 35, 'vert']);
  c.cpuWrite(0xe000, 5); c.cpuWrite(0xf000, 0); c.cpuWrite(0xf001, 9); c.clock(4); eq('18 IRQ まだ', c.irqLine, false); c.clock(1); eq('18 IRQ（4 ビット）', c.irqLine, true); }
{ const c = rom(65, 16, 16); c.cpuWrite(0x8000, 4); c.cpuWrite(0xb005, 9); c.cpuWrite(0x9005, 0); c.cpuWrite(0x9006, 50); c.cpuWrite(0x9004, 0); c.cpuWrite(0x9003, 0x80);
  eq('65', [prgOf(c), chrOf(c)[5]], [[4, 1, 30, 31], 9]); c.clock(49); eq('65 IRQ まだ', c.irqLine, false); c.clock(1); eq('65 IRQ', c.irqLine, true); }
{ const c = rom(32, 16, 16); c.cpuWrite(0x8000, 4); c.cpuWrite(0x9000, 2); eq('32', prgOf(c), [30, 1, 4, 31]); }
{ const c = rom(33, 16, 16); c.cpuWrite(0x8000, 0x45); c.cpuWrite(0x8002, 3); c.cpuWrite(0xa003, 9); eq('33', [prgOf(c), chrOf(c)[1], chrOf(c)[7], c.mirror], [[5, 1, 30, 31], 7, 9, 'horz']); }
{ const c = rom(48, 16, 16); c.cpuWrite(0xc000, 0xff ^ 3); c.cpuWrite(0xc001, 0); c.cpuWrite(0xc002, 0); let at = -1; for (let l = 0; l < 10 && at < 0; l++) { c.scanline(l); if (c.irqLine) at = l; } eq('48 IRQ', at, 3); }
{ const c = rom(67, 8, 16); c.cpuWrite(0xf800, 2); c.cpuWrite(0x9800, 5); eq('67', [prgOf(c), chrOf(c)[2]], [[4, 5, 14, 15], 10]);
  c.cpuWrite(0xc800, 0); c.cpuWrite(0xc800, 20); c.cpuWrite(0xd800, 0x10); c.clock(20); eq('67 IRQ まだ', c.irqLine, false); c.clock(1); eq('67 IRQ', c.irqLine, true); }
{ const c = rom(68, 8, 32); c.cpuWrite(0xc000, 5); c.cpuWrite(0xd000, 6); c.cpuWrite(0xe000, 0x11); eq('68 表に CHR', [c.ntRead(0x2000), c.ntRead(0x2800)], [0x85, 0x86]); }

// 5 MMC5
{
  const c = rom(5, 32, 32);
  eq('5 起動（8KB ×4・最後）', prgOf(c)[3], 63);
  c.cpuWrite(0x5100, 3); c.cpuWrite(0x5114, 0x81); c.cpuWrite(0x5115, 0x82); c.cpuWrite(0x5116, 0x83); c.cpuWrite(0x5117, 0x84);
  eq('5 PRG モード 3', prgOf(c), [1, 2, 3, 4]);
  c.cpuWrite(0x5100, 1); c.cpuWrite(0x5115, 0x86); eq('5 PRG モード 1', prgOf(c), [6, 7, 4, 5]);
  c.cpuWrite(0x5115, 0x01); c.cpuWrite(0x8000, 0x99); c.cpuWrite(0x5113, 0); eq('5 PRG RAM を $8000 に', c.cpuRead(0x6000), 0x99);
  c.cpuWrite(0x5101, 3); for (let i = 0; i < 8; i++) c.cpuWrite(0x5120 + i, 10 + i); eq('5 CHR モード 3', chrOf(c), [10, 11, 12, 13, 14, 15, 16, 17]);
  c.cpuWrite(0x5205, 12); c.cpuWrite(0x5206, 34); eq('5 かけ算', c.cpuRead(0x5205) | (c.cpuRead(0x5206) << 8), 408);
  c.cpuWrite(0x5105, 0xe4); c.cpuWrite(0x5106, 0x42); c.cpuWrite(0x5107, 2); c.cpuWrite(0x5c00, 9);
  eq('5 表（A・B・拡張・うめ）', [c.ntOff[1], c.ntRead(0x2800), c.ntRead(0x2c00), c.ntRead(0x2fc0)], [1024, 9, 0x42, 0xaa]);
  c.cpuWrite(0x5203, 30); c.cpuWrite(0x5204, 0x80);
  let at = -1; c.scanline(261); for (let l = 0; l < 240 && at < 0; l++) { c.scanline(l); if (c.irqLine) at = l + 1; }
  eq('5 IRQ の行', at, 30); eq('5 $5204', c.cpuRead(0x5204), 0xc0); eq('5 読むと消える', c.irqLine, false);
}

// 対応の一覧と、開けるかだけ
for (const m of MAPPERS) { try { rom(m); ok++; } catch (e) { ng++; console.log(`NG  ${m} 開けない: ${e.message}`); } }
console.log(`\n合格 ${ok}・ちがう ${ng}（マッパー ${MAPPERS.length} 種）`);
process.exit(ng ? 1 : 0);
