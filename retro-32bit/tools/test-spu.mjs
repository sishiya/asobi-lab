// SPU の確かめ: ADPCM の変換と戻し・高さ・くり返し・ADSR・残響。
//   node retro-32bit/tools/test-spu.mjs
import { SPU } from '../js/spu.js';
import { encode } from './adpcm.mjs';

let bad = 0;
function check(name, ok, info = '') { if (!ok) bad++; console.log(`${ok ? 'ok ' : 'NG '} ${name}${info ? ': ' + info : ''}`); }

const sine = (n, period, amp = 12000) => Int16Array.from({ length: n }, (_, i) => Math.round(Math.sin((i / period) * Math.PI * 2) * amp));
function setup(spu, voice, addr, { pitch = 0x1000, adsr1 = 0x00ff, adsr2 = 0x0000, vol = 0x3fff } = {}) {
  const b = voice * 16;
  spu.write16(0x1aa, 0xc000);         // 動かす・音を出す
  spu.write16(0x180, 0x3fff); spu.write16(0x182, 0x3fff);
  spu.write16(b + 0, vol); spu.write16(b + 2, vol);
  spu.write16(b + 4, pitch); spu.write16(b + 6, addr / 8);
  spu.write16(b + 8, adsr1); spu.write16(b + 0xa, adsr2);
}
const upload = (spu, addr, bytes) => spu.ram.set(bytes, addr);
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
function render(spu, n) { const L = []; for (let i = 0; i < n; i++) L.push(spu.sample()[0]); return L; }

// 1) 変換して戻すと、ほぼ同じ波
{
  const pcm = sine(28 * 64, 100);
  const enc = encode(pcm, { loop: true });
  const spu = new SPU(44100);
  upload(spu, 0x1000, enc);
  setup(spu, 0, 0x1000, { adsr1: 0x007f });   // 立ち上がりはすぐ、保つ
  spu.write16(0x188, 1);
  const out = render(spu, 28 * 64 + 200).slice(200);
  const want = Array.from({ length: out.length }, (_, i) => pcm[(i + 200) % pcm.length] * (0x3fff * 2 / 32768) * (0x3fff * 2 / 16384) * (0x7fff / 32768));
  // 2 点でつなぐぶん少しおくれるので、いちばん合うずらし（0〜3 サンプル）で比べる
  const errRms = Math.min(...[0, 1, 2, 3].map((d) => rms(out.slice(d).map((v, i) => v - want[i]))));
  check('ADPCM の行き帰り（ずれの大きさ）', errRms < rms(want) * 0.06, `${(errRms / rms(want) * 100).toFixed(1)}%`);
}
// 2) 高さ 0x0800 で 1 オクターブ下（ゼロをまたぐ数が半分）
{
  const enc = encode(sine(28 * 32, 112), { loop: true });
  const count = (pitch) => {
    const spu = new SPU(44100); upload(spu, 0x1000, enc); setup(spu, 0, 0x1000, { pitch, adsr1: 0x007f });
    spu.write16(0x188, 1);
    const out = render(spu, 44100).slice(2000);
    let z = 0; for (let i = 1; i < out.length; i++) if ((out[i - 1] < 0) !== (out[i] < 0)) z++;
    return z;
  };
  const a = count(0x1000), b = count(0x0800);
  check('高さ（0x1000 → 0x0800 で半分）', Math.abs(a / b - 2) < 0.05, `${a} / ${b}`);
  check('くり返し（1 秒鳴りつづける）', a > 700, `ゼロをまたぐ ${a} 回（正しくは 44100/112×2 ≒ 787）`);
}
// 3) くり返さない音は、終わりで止まる
{
  const enc = encode(sine(28 * 10, 50), { loop: false });
  const spu = new SPU(44100); upload(spu, 0x1000, enc); setup(spu, 0, 0x1000, { adsr1: 0x007f });
  spu.write16(0x188, 1);
  render(spu, 28 * 12);
  check('くり返さない音は止まる', spu.v[0].phase === 0 && (spu.endx & 1) === 1);
}
// 4) ADSR: 立ち上がり → 減り → 保つ（保つ高さ）→ 手をはなすと消える
{
  const enc = encode(sine(28 * 32, 100), { loop: true });
  const spu = new SPU(44100); upload(spu, 0x1000, enc);
  // 立ち上がり シフト 10・減り 6・保つ高さ 7（0x4000）・保つ（動かない）・消える 10
  setup(spu, 0, 0x1000, { adsr1: (10 << 10) | (6 << 4) | 7, adsr2: (0x1f << 8) | 10 });
  spu.write16(0x188, 1);
  let peak = 0, t = 0;
  for (; t < 44100 && spu.v[0].phase !== 3; t++) { spu.sample(); peak = Math.max(peak, spu.v[0].level); }
  check('立ち上がって 0x7fff まで', peak === 0x7fff);
  check('保つ高さ ≒ 0x4000', Math.abs(spu.v[0].level - 0x4000) < 0x400, spu.v[0].level.toString(16));
  render(spu, 4410);
  const held = spu.v[0].level;
  spu.write16(0x18c, 1);
  render(spu, 44100);
  check('手をはなすと消える', held > 0x3000 && spu.v[0].level === 0 && spu.v[0].phase === 0);
}
// 5) 残響: 音を止めたあとも、しばらく音が残る
{
  const enc = encode(sine(28 * 8, 40), { loop: false });
  const spu = new SPU(44100); upload(spu, 0x1000, enc); setup(spu, 0, 0x1000, { adsr1: 0x007f });
  spu.write16(0x1a2, (0x80000 - 0x10000) / 8);  // 残響の作業場所（64KB）
  const R = [0x0400, 0x0300, 0x5000, 0x5000, 0x4000, 0x3000, 0x2000, 0x4000, 0x6000, 0x5000,
    0x0c00, 0x0d00, 0x0a00, 0x0b00, 0x0800, 0x0900, 0x0b00, 0x0c00, 0x0e00, 0x0f00, 0x0600, 0x0700, 0x0400, 0x0500, 0x0d00, 0x0c00,
    0x1000, 0x1100, 0x0f00, 0x0e00, 0x6000, 0x6000];
  R.forEach((v, i) => spu.write16(0x1c0 + i * 2, v));
  spu.write16(0x184, 0x4000); spu.write16(0x186, 0x4000);
  spu.write16(0x198, 1);                      // 声 0 を残響へ
  spu.write16(0x1aa, 0xc080);                 // 残響を入れる
  spu.write16(0x188, 1);
  render(spu, 28 * 9);
  const tail = render(spu, 8000);
  check('残響が残る（音が止まったあと）', rms(tail.slice(2000)) > 30, `rms ${rms(tail.slice(2000)).toFixed(0)}`);
}
console.log(bad ? `\n${bad} こ ちがいます` : '\nぜんぶ ok');
process.exit(bad ? 1 : 0);
