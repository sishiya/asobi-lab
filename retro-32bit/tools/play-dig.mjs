// ほって つんで 3D を画面なしで動かし、ボタンを押す台本で確かめる（パッドを押すだけ。RAM は読むだけ）。
//   node retro-32bit/tools/play-dig.mjs [--shots=こま,...] [--wav=ファイル] [--time=単位]（--wav: SPU の音を 44100Hz の WAV に書き、印ごとの大きさを出す。--time: 1 日の中の時刻を 64 こま単位で決めてはじめる（夕方 210・夜 230〜。絵を撮るための確かめ用で、RAM に書く））
//   台本: 前へ歩く → 下を見る → B で掘る → X で置く → 跳ぶ → 向きを回す。こまごとの位置・持ち物・描いた面の数を出す
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';
import { ROOT, buildSoft } from './lib.mjs';
import { writePng } from './png.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const wav = opt('wav', ''), sndL = [], sndR = [], marks = [];
const time0 = Number(opt('time', '-1'));
const shots = opt('shots', '').split(',').filter(Boolean).map(Number);
const out = join(ROOT, '..', '_dev', 'retro-32bit');
mkdirSync(out, { recursive: true });

const { exe, syms } = await buildSoft('dig32');
const m = new Console32();
m.loadExe(exe);
const vb = (syms.vars & 0x1fffff) >> 2, V = (i) => m.ram32[vb + i];
const inv = () => [...m.ram.slice(syms.inv & 0x1fffff, (syms.inv & 0x1fffff) + 9)].slice(1).join(' ');
// [はじめのこま, おわりのこま, ボタン]
const SCRIPT = [
  [40, 100, 'UP'], [100, 125, 'R'], [130, 175, 'B'], [180, 182, 'X'], [190, 192, 'X'],
  [200, 201, 'A'], [230, 290, 'LEFT'], [290, 330, 'UP'], [330, 334, 'A'], [332, 360, 'UP'],
];
const last = Math.max(400, ...shots);
let blink0 = 0;
for (let f = 1; f <= last; f++) {
  let b = 0;
  for (const [a, z, k] of SCRIPT) if (f >= a && f < z) b |= 1 << BTN[k];
  m.sio.buttons[0] = b;
  if (f === 2 && time0 >= 0) m.ram32[vb + 26] = time0 * 64;
  const ev = V(23);
  m.runFrame();
  if (wav) { const { L, R } = m.spu.take(); for (let i = 0; i < L.length; i++) { sndL.push(L[i]); sndR.push(R[i]); } marks.push(ev); } else m.spu.take();
  if (f === 30) blink0 = V(16);
  if (shots.includes(f)) {
    const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf);
    writePng(join(out, `dig-${f}.png`), w, h, (x, y) => { const o = (y * w + x) * 4; return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2]; }, 2);
  }
  if (f % 50 === 0 || shots.includes(f)) console.log(`こま ${f}: 位置 ${(V(0) / 256).toFixed(1)},${(V(1) / 256).toFixed(2)},${(V(2) / 256).toFixed(1)} 地面 ${V(6)} ねらい ${V(10)} 持ち物 ${inv()} 選び ${V(15)} 面 ${V(21)} 掘り ${V(13)}/${V(14)} 段 ${V(27)}`);
}
console.log(`ゲームの1回 / こま = ${((V(16) - blink0) / (last - 30)).toFixed(2)}`);
if (wav) {
  const n = sndL.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(44100 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let peak = 0;
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sndL[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sndR[i])) * 32767), 46 + i * 4); peak = Math.max(peak, Math.abs(sndL[i])); }
  writeFileSync(wav, buf);
  // 印ごとの大きさ: 印が立ったこまから 6 こまの間の RMS（印なしのこまは環境音だけ）
  const per = n / marks.length, db = (x) => (20 * Math.log10(x || 1e-9)).toFixed(1);
  const NAMES = { 1: '掘る', 2: 'くずれた', 4: '置いた', 8: '足音', 16: '置けない', 32: '着地' }, acc = {};
  marks.forEach((e, f) => { const keys = e ? Object.keys(NAMES).filter((k) => e & k).map((k) => NAMES[k]) : (marks.slice(Math.max(0, f - 6), f).some(Boolean) ? [] : ['環境音だけ']);
    for (const tag of keys) { const a = acc[tag] ||= { s: 0, c: 0, n: 0 }; a.n++; for (let i = Math.floor(f * per); i < Math.floor((f + 6) * per) && i < n; i++) { a.s += sndL[i] * sndL[i]; a.c++; } } });
  console.log(`音: ${(n / 44100).toFixed(1)} 秒・ピーク ${db(peak)} dB・` + Object.entries(acc).map(([k, a]) => `${k} ${db(Math.sqrt(a.s / a.c))} dB（${a.n} 回）`).join('・'));
}
