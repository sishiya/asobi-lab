// ムネエソの腹あかり を画面なしで遊ばせて、決まりの数を測る（パッドを押すだけ。RAM は読むだけ）。
//   node retro-32bit/tools/play-glow.mjs [--bot=none|match|dvm] [--shots=こま,...] [--tol=12]
//   none  = 何もしない（見つかるはず）
//   match = 目が上がってきたら腹の光を合わせる（深さはそのまま）
//   dvm   = 合わせる＋昼は深く・夜は浅く上がってプランクトンを追う（本物の日周鉛直移動）
//   --wav=ファイル（SPU の音を 44100Hz の WAV に書く。場面ごとの大きさも出す）
//   --react=こま（目が上がりはじめてから押しはじめるまで。人のおそさ）・--aim=段（これだけ合えばやめる。人のおおざっぱさ）
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';
import { ROOT, buildSoft } from './lib.mjs';
import { writePng } from './png.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const bot = opt('bot', 'dvm');
const shots = opt('shots', '').split(',').filter(Boolean).map(Number);
const out = join(ROOT, '..', '_dev', 'retro-32bit');
mkdirSync(out, { recursive: true });

const { exe, syms } = await buildSoft('glow-belly');
const m = new Console32(44100);
m.loadExe(exe);
const wav = opt('wav', ''), sndL = [], sndR = [], marks = [];
const NAMES = ['T', 'FD', 'VY', 'L16', 'E', 'PST', 'PT', 'SUS', 'TH', 'CNT', 'LIVES', 'STATE'];
const v = () => Object.fromEntries(NAMES.map((n, i) => [n, m.ram32[((syms.vars & 0x1fffff) >> 2) + i]]).concat([['I', m.ram32[((syms.vars & 0x1fffff) >> 2) + 16]], ['SKY', m.ram32[((syms.vars & 0x1fffff) >> 2) + 24]]]));
const plk = () => { const b = (syms.plk & 0x1fffff) >> 2, a = []; for (let k = 0; k < 24; k++) if (m.ram32[b + k * 3 + 2]) a.push({ x: m.ram32[b + k * 3] >> 4, d: m.ram32[b + k * 3 + 1] >> 4 }); return a; };

const stat = { looks: 0, caught: 0, minE: 1e9, lowLight: 0, sus: [] };
let lastPst = 0, lastLives = 3, frames = 0, maxSus = 0, since = 0, endAt = null;
const react = +opt('react', 0), aim = +opt('aim', 3);
const limit = +opt('frames', 13000);
for (let f = 1; f < limit; f++) {
  let b = 0;
  const s = v();
  if (f === 30) b |= 1 << BTN.START;
  if (s.STATE === 1 && bot !== 'none') {
    const L = s.L16 >> 4;
    const watching = s.PST === 1 || s.PST === 2;
    since = watching ? since + 1 : 0;
    if (watching && since > react) { if (L < s.I - aim) b |= 1 << BTN.A; else if (L > s.I + aim) b |= 1 << BTN.B; }
    else if (L > 0) b |= 1 << BTN.B; // 見られていなければ消してエネルギーを残す
    if (bot === 'dvm' && !watching) {
      // 昼（空が明るい）は 140 より深く、夜はいちばん近いプランクトンの深さへ
      const d = s.FD >> 8;
      let want = s.SKY >= 240 ? 140 : d;
      const near = plk().filter((p) => p.x > -60).sort((a, b2) => a.x - b2.x)[0];
      if (near && (s.SKY < 240 || Math.abs(near.d - d) < 30)) want = near.d;
      if (s.SKY >= 240 && want < 100) want = 100;
      if (want < d - 2) b |= 1 << BTN.UP; else if (want > d + 2) b |= 1 << BTN.DOWN;
    }
  }
  m.sio.buttons[0] = b;
  m.runFrame();
  if (wav) { const { L, R } = m.spu.take(); for (let i = 0; i < L.length; i++) { sndL.push(L[i]); sndR.push(R[i]); } } else m.spu.take();
  const t = v();
  if (wav) { const tag = t.PST === 4 ? '見つかった' : t.PST === 2 ? '見ている' : (t.L16 >> 4) > 3 ? '腹の光' : 'ふだん'; marks.push(tag); }
  if (t.STATE === 1) frames++;
  if (lastPst !== 2 && t.PST === 2) stat.looks++;
  if (t.PST === 2) maxSus = Math.max(maxSus, t.SUS);
  if (lastPst === 2 && t.PST !== 2) { stat.sus.push(maxSus); maxSus = 0; }
  if (t.LIVES < lastLives) stat.caught++;
  lastPst = t.PST; lastLives = t.LIVES;
  if (t.STATE === 1) stat.minE = Math.min(stat.minE, t.E);
  if (shots.includes(f)) {
    const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf);
    writePng(join(out, `glow-${f}.png`), w, h, (x, y) => { const o = (y * w + x) * 4; return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2]; }, 2);
    console.log(`こま ${f}: 時刻 ${(t.T / 60).toFixed(1)}秒 深さ ${(t.FD >> 8) * 4}m 光 I=${t.I} L=${t.L16 >> 4} 疑い ${t.SUS} 状態 ${t.PST} 食べた ${t.CNT}`);
  }
  if (f > 40 && t.STATE !== 1) { endAt ??= f; if (f - endAt > 60) break; } // おわりの画面も 1 秒撮れるように
}
if (wav) {
  const n = sndL.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(44100 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let peak = 0;
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sndL[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sndR[i])) * 32767), 46 + i * 4); peak = Math.max(peak, Math.abs(sndL[i]), Math.abs(sndR[i])); }
  writeFileSync(wav, buf);
  // 場面ごとの大きさ（RMS、dB）
  const per = n / marks.length, acc = {};
  marks.forEach((tag, f) => { const a = acc[tag] ||= { s: 0, c: 0 }; for (let i = Math.floor(f * per); i < Math.floor((f + 1) * per); i++) { a.s += sndL[i] * sndL[i]; a.c++; } });
  const db = (x) => (20 * Math.log10(x || 1e-9)).toFixed(1);
  console.log(`音: ${(n / 44100).toFixed(1)} 秒・ピーク ${db(peak)} dB・` + Object.entries(acc).map(([k, a]) => `${k} ${db(Math.sqrt(a.s / a.c))} dB`).join('・'));
}
const e = v();
console.log(`ボット ${bot}: ${(frames / 60).toFixed(0)} 秒遊んだ・見上げ ${stat.looks} 回・見つかった ${stat.caught} 回・食べた ${e.CNT}・エネルギーのいちばん低い所 ${stat.minE}・おわりの時刻 ${(e.T / 60).toFixed(0)} 秒`);
console.log(`見上げごとの疑いの最大: ${stat.sus.join(' ')}`);
