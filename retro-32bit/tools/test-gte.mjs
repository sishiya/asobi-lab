// GTE の確かめ: 浮動小数の答えとくらべる（固定小数点なので ±1 まで）・印（FLAG）・CPU から命令を出す道。
//   node retro-32bit/tools/test-gte.mjs
import { GTE } from '../js/gte.js';
import { assemble, makeExe } from './asm.mjs';
import { Console32 } from '../js/psx.js';

let bad = 0;
function check(name, ok, info = '') { if (!ok) bad++; console.log(`${ok ? 'ok ' : 'NG '} ${name}${info ? ': ' + info : ''}`); }
const lo = (v) => (v << 16) >> 16, hi = (v) => v >> 16;
const pk = (a, b) => ((b & 0xffff) << 16) | (a & 0xffff);

// 1) 割り算（表＋ニュートン法）: H/SZ3 × 65536 との差
{
  const g = new GTE(); let worst = 0;
  for (let k = 0; k < 20000; k++) {
    const z = 1 + Math.floor(Math.random() * 0xffff), h = Math.floor(Math.random() * Math.min(0xffff, z * 2 - 1));
    g.h = h; g.sz[3] = z;
    const got = g.divide(), want = Math.min(0x1ffff, h * 65536 / z);
    worst = Math.max(worst, Math.abs(got - want));
  }
  check('割り算のずれ（本物も表で近似するので 3 まで）', worst <= 3, worst.toFixed(2));
  g.h = 300; g.sz[3] = 100; g.flag = 0; g.divide();
  check('割り算のあふれの印（17 番）', (g.flag >> 17) & 1);
}

// 2) RTPS: 回してずらして画面へ（浮動小数の答えと）
{
  let worst = 0;
  for (let k = 0; k < 2000; k++) {
    const g = new GTE();
    const a = Math.random() * Math.PI * 2, c = Math.round(Math.cos(a) * 4096), s = Math.round(Math.sin(a) * 4096);
    const m = [c, 0, s, 0, 4096, 0, -s, 0, c]; // y のまわりに回す
    for (let i = 0; i < 4; i++) g.setCtrl(i, pk(m[i * 2], m[i * 2 + 1])); g.setCtrl(4, m[8]);
    const tz = 800 + Math.floor(Math.random() * 2000);
    g.setCtrl(5, 0); g.setCtrl(6, 0); g.setCtrl(7, tz);
    g.setCtrl(24, 160 << 16); g.setCtrl(25, 120 << 16); g.setCtrl(26, 240);
    const v = [-300 + Math.floor(Math.random() * 600), -300 + Math.floor(Math.random() * 600), -300 + Math.floor(Math.random() * 600)];
    g.setData(0, pk(v[0], v[1])); g.setData(1, v[2]);
    g.command(0x00080001); // RTPS sf=1
    const x = (m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) / 4096, y = v[1], z = (m[6] * v[0] + m[7] * v[1] + m[8] * v[2]) / 4096 + tz;
    const sx = 160 + x * 240 / z, sy = 120 + y * 240 / z;
    const p = g.getData(14);
    worst = Math.max(worst, Math.abs(lo(p) - sx), Math.abs(hi(p) - sy), Math.abs(g.getData(19) - z));
  }
  check('RTPS の画面の点と奥行き（2 まで）', worst <= 2, worst.toFixed(2));
}

// 3) NCLIP・AVSZ3・RTPT の FIFO
{
  const g = new GTE();
  g.sxy = [pk(0, 0), pk(10, 0), pk(0, 10)];
  g.command(0x06);
  check('NCLIP（左回りで正）', g.mac[0] === 100, String(g.mac[0]));
  g.sz.set([0, 100, 200, 300]); g.setCtrl(29, Math.round(4096 / 3));
  g.command(0x2d);
  check('AVSZ3（平均の奥行き）', Math.abs(g.otz - 200) <= 1, String(g.otz));
  g.setCtrl(0, 0x1000); g.setCtrl(2, 0x1000); g.setCtrl(4, 0x1000); g.setCtrl(7, 1000); g.setCtrl(26, 1000);
  g.setData(0, pk(1, 1)); g.setData(1, 0); g.setData(2, pk(2, 2)); g.setData(3, 0); g.setData(4, pk(3, 3)); g.setData(5, 0);
  g.command(0x00080030);
  check('RTPT の FIFO（3点が順に）', lo(g.sxy[0]) === 1 && lo(g.sxy[1]) === 2 && lo(g.sxy[2]) === 3, g.sxy.map(lo).join(','));
}

// 4) 光（NCDS）: 正面から白い光、面がまっすぐ向く → 頂点の色そのまま
{
  const g = new GTE();
  g.setCtrl(8, pk(0, 0)); g.setCtrl(9, pk(4096, 0)); // L13 = 1（光は z の向き）
  g.setCtrl(16, pk(4096, 0)); g.setCtrl(17, pk(0, 4096)); g.setCtrl(18, pk(0, 0)); g.setCtrl(19, pk(4096, 0)); g.setCtrl(20, 0); // 光1 の色 = 白（LR1・LG1・LB1）
  g.setData(0, pk(0, 0)); g.setData(1, 4096);   // 面の向き = z
  g.setData(6, 0x30804020);                     // 頂点の色 R=20 G=40 B=80
  g.setData(8, 0);                              // IR0 = 0（霞なし）
  g.command(0x00080413); // NCDS sf=1 lm=1
  const c = g.rgb[2];
  check('NCDS の色', (c & 255) === 0x20 && ((c >> 8) & 255) === 0x40 && ((c >> 16) & 255) === 0x80 && (c >>> 24) === 0x30, (c >>> 0).toString(16));
}

// 5) CPU から: ctc2・mtc2・cop2・mfc2（ロードの遅れつき）
{
  const src = `.org 0x80010000
start:
  li t0, 0x1000
  ctc2 t0, 0
  ctc2 zero, 1
  ctc2 t0, 2
  ctc2 zero, 3
  ctc2 t0, 4
  li t0, 500
  ctc2 t0, 7
  li t0, 250
  ctc2 t0, 26
  li t0, 0x00140028
  mtc2 t0, 0
  mtc2 zero, 1
  nop
  nop
  cop2 0x00080001
  mfc2 t1, 14
  nop
  mfc2 t2, 19
  nop
fin: b fin
  nop`;
  const m = new Console32(); m.loadExe(makeExe(assemble(src)));
  for (let i = 0; i < 60; i++) m.cpu.step();
  const p = m.cpu.r[9];
  check('CPU から RTPS（x=40×250/500=20, y=10）', lo(p) === 20 && hi(p) === 10, `${lo(p)},${hi(p)}`);
  check('mfc2 で SZ3', m.cpu.r[10] === 500, String(m.cpu.r[10]));
}

console.log(bad ? `\n${bad} こ ちがいます` : '\nぜんぶ ok');
process.exit(bad ? 1 : 0);
