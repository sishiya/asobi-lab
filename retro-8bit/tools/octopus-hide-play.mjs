// タコの かくれんぼ を画面なしで遊ぶボット。node retro-8bit/tools/octopus-hide-play.mjs <bot|none|mash|hold> [絵のフォルダ] [たね] [en]
//   bot = サメが近づいたら止まって 足もとの底の色に合わせ、いないあいだにカニ・エビへ歩く（RAM を読む。人のように 12 フレームおくれて気づく）
//   none = 何もしない・mash = A を連打して でたらめに歩く・hold = → と A を おしっぱなし
//   絵のフォルダをわたすと、タイトル・あそぶ画面いくつか・！・サメが通る所・見つかった所・おわりを PNG に
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const mode = process.argv[2] || 'bot', out = process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
if (out) mkdirSync(out, { recursive: true });
const nes = new Console8(readFileSync(G + 'roms/octopus-hide.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0;
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
const tap = (b, k = 2) => { nes.setButton(0, BTN[b], true); run(k); nes.setButton(0, BTN[b], false); run(4); };
let r = seed * 7919;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
run(150 + seed * 13); shot('title');
tap('START');
const score = () => +R().slice(0x1c, 0x20).join('');
const btn = { A: false, LEFT: false, RIGHT: false };
const set = (b, v) => { if (btn[b] !== v) { nes.setButton(0, BTN[b], v); btn[b] = v; } };
let warnShot = false, passShot = false, foundShot = false, lastLives = 3, found = 0;
const shotsAt = new Set([30, 600, 1500, 3000]);
const s16 = (lo, hi) => ((hi << 8 | lo) << 16) >> 16;
const seenAt = [0, 0];
for (let g = 0; g < 60 * 600 && R()[7] === 1; g++) {
  const m = R();
  const ox = m[0x10], sx = m[0x18], ocol = m[0x13] ? -1 : m[0x12];
  const floorAt = (x) => m[0x400 + (((sx + x) & 255) >> 3)];
  let want = { A: false, LEFT: false, RIGHT: false };
  if (mode === 'hold') want = { A: true, LEFT: false, RIGHT: true };
  else if (mode === 'mash') want = { A: g % 4 < 2, LEFT: rnd() < 0.3, RIGHT: rnd() < 0.5 };
  else if (mode === 'bot') {
    // 近づいているサメ（気づくのは ！が出て 12 フレームあと）
    let danger = false;
    for (let i = 0; i < 2; i++) {
      if (!m[0x40 + i] || m[0x54 + i]) { seenAt[i] = 0; continue; }
      if (!seenAt[i]) seenAt[i] = g;
      if (g - seenAt[i] < 12) continue;
      if (!m[0x42 + i]) { if (m[0x44 + i] < 40) danger = true; continue; }
      const d = s16(m[0x46 + i], m[0x48 + i]) + 4 - ox;
      const v = m[0x52 + i] + m[0x50 + i] / 256;
      const dist = m[0x4e + i] ? d - 12 : -d - 12; // まだ来ていない きょり
      if (dist < 34 + v * 12) danger = true;
    }
    const here = floorAt(ox + 12);
    if (danger) {
      if (ocol !== here && m[0x13] === 0 && !btn.A) want.A = true;
    } else {
      // カニ・エビが前にいれば歩く。左のはしに近ければ右へ
      let target = -1;
      for (let i = 0; i < 2; i++) if (m[0x58 + i] && m[0x5c + i] === 0 && m[0x5a + i] + 8 > ox + 12) { const x = m[0x5a + i] + 8; if (target < 0 || x < target) target = x; }
      if (target > 0 || ox < 80) want.RIGHT = true;
      // 歩きながら、つぎに止まる所の色に合わせておく
      const next = floorAt(ox + 12 + (want.RIGHT ? 6 : 0));
      if (m[0x12] !== next && m[0x13] === 0 && !btn.A && g % 3 === 0) want.A = true;
    }
  }
  for (const b of ['A', 'LEFT', 'RIGHT']) set(b, want[b]);
  run(1);
  const n = R();
  if (n[0x24] < lastLives) { found++; lastLives = n[0x24]; if (!foundShot && g > 200) { run(6); shot('found'); foundShot = true; } if (process.env.DBG) console.log('見つかった', g, 'sx', n[0x18], 'サメ', [0,1].map(i=>[n[0x40+i],n[0x42+i],s16(n[0x46+i],n[0x48+i]),n[0x4e+i],n[0x54+i]].join(':')).join(' '), 'ox', n[0x10], 'col', n[0x12], 'chg', n[0x13], 'mv', n[0x14], 'floor', n[0x400 + (((n[0x18] + n[0x10] + 12) & 255) >> 3)]); }
  if (shotsAt.has(g)) shot('play' + g);
  if (!warnShot && g > 100 && Array.from({ length: 64 }, (_, i) => n.length && nes.ram[0x200 + i * 4 + 2] === 3 && [12, 236].includes(nes.ram[0x203 + i * 4])).some(Boolean)) { warnShot = true; run(2); shot('warn'); } // ！が出ている（画面は 1 フレームおくれ）
  if (!passShot && g > 300 && [0, 1].some((i) => n[0x40 + i] && n[0x42 + i] && Math.abs(s16(n[0x46 + i], n[0x48 + i]) + 4 - n[0x10]) < 10) && n[0x25] === 0) { passShot = true; shot('pass'); }
}
for (const b of ['A', 'LEFT', 'RIGHT']) set(b, false);
const st = R(), fr = f;
const level = st[0x27], eaten = st[0x78], hidden = st[0x79];
run(30); shot('end0');
run(100); shot('end');
console.log(`mode ${mode} たね ${seed}: 点 ${score()}・食べた ${eaten}・かくれた ${hidden}・見つかった ${found}・段 ${level}・${(fr / 60).toFixed(0)} 秒・state ${st[7]}`);
