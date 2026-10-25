// ムネエソの腹あかり を画面なしで遊ばせて、決まりの数を測る（パッドを押すだけ。RAM は読むだけ）。
//   node retro-32bit/tools/play-glow.mjs [--bot=none|match|dvm] [--shots=こま,...] [--tol=12]
//   none  = 何もしない（見つかるはず）
//   match = 目が上がってきたら腹の光を合わせる（深さはそのまま）
//   dvm   = 合わせる＋昼は深く・夜は浅く上がってプランクトンを追う（本物の日周鉛直移動）
//   --react=こま（目が上がりはじめてから押しはじめるまで。人のおそさ）・--aim=段（これだけ合えばやめる。人のおおざっぱさ）
import { mkdirSync } from 'node:fs';
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
const m = new Console32();
m.loadExe(exe);
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
  const t = v();
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
const e = v();
console.log(`ボット ${bot}: ${(frames / 60).toFixed(0)} 秒遊んだ・見上げ ${stat.looks} 回・見つかった ${stat.caught} 回・食べた ${e.CNT}・エネルギーのいちばん低い所 ${stat.minE}・おわりの時刻 ${(e.T / 60).toFixed(0)} 秒`);
console.log(`見上げごとの疑いの最大: ${stat.sus.join(' ')}`);
