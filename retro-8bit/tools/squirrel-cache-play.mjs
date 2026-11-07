// リスの かくしごと を画面なしで遊ぶボット。node retro-8bit/tools/squirrel-cache-play.mjs <mode> [絵のフォルダ] [たね] [en]
//   bot   = 見はりが いないときに うめ、冬は うめた所を おぼえていて掘る（ときどき となりと まちがえる）
//   sharp = bot と同じで まちがえない（うまい人）
//   blind = 見はりを気にせず うめる（見られても うめる）
//   none  = 何もしない・mash = でたらめに走って A を連打・hold = A を おしっぱなしで走る
//   絵のフォルダをわたすと、タイトル・季節のはじめ・秋・冬・春・おわりを PNG に
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const mode = process.argv[2] || 'bot', out = process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
if (out) mkdirSync(out, { recursive: true });
const nes = new Console8(readFileSync(G + 'roms/squirrel-cache.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0;
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
// 近よって見る（リスのまわり 96×64 を 4 倍）
const zoom = (name) => { if (!out) return; const fb = nes.ppu.frame, m = R(); const x0 = Math.max(0, Math.min(160, m[0x15] - 40)), y0 = Math.max(0, Math.min(176, m[0x16] - 24)); writePng(`${out}/${name}.png`, 96, 64, (x, y) => { const c = fb[(y0 + y) * 256 + x0 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 4); };
const press = new Set();
const set = (names) => { for (const b of Object.keys(BTN)) { const on = names.includes(b); if (on !== press.has(b)) { nes.setButton(0, BTN[b], on); on ? press.add(b) : press.delete(b); } } };
const tap = (b, k = 2) => { set([b]); run(k); set([]); run(4); };
let r = seed * 7919 + 17;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// RAM の場所（game.s と同じ）
const A = { state: 0x07, phase: 0x10, year: 0x12, cx: 0x13, cy: 0x14, mv: 0x18, act: 0x19, carry: 0x1a, count: 0x1b, goal: 0x1c, bar: 0x1d, season: 0x20, trees: 0x24, score: 0x40, acSt: 0x48, acCell: 0x4b, wSt: 0x51 };
const MAP = 0x400;
const walk = (v) => (v & 15) === 0 || (v & 15) === 5;
// 地図の上で いちばん近い道（はばひろく）→ 最初の一歩の向き
function stepTo(from, goals) {
  const m = R();
  const prev = new Map([[from, -1]]), q = [from];
  let hit = -1;
  while (q.length) {
    const c = q.shift();
    if (goals.has(c)) { hit = c; break; }
    for (const d of [-16, 16, -1, 1]) { const n = c + d; if (n < 0 || n > 255 || prev.has(n) || !walk(m[MAP + n])) continue; prev.set(n, c); q.push(n); }
  }
  if (hit < 0) return null;
  if (hit === from) return 'here';
  let c = hit; while (prev.get(c) !== from) c = prev.get(c);
  return { [-16]: 'UP', 16: 'DOWN', [-1]: 'LEFT', 1: 'RIGHT' }[c - from];
}

run(100 + seed * 7); shot('title');
tap('START');
const score = () => +Array.from(R().slice(A.score, A.score + 4)).join('');
const shots = new Set();
const shotOnce = (k) => { if (!shots.has(k)) { shots.add(k); shot(k); if (k === 'watched' || k === 'autumn' || k === 'winter') zoom('zoom-' + k); } };
const memory = new Map(); // ボットが おぼえた うめた所（とられたかは しらない）
let years = 0, seen = 0, buried = 0, misses = 0, lastPhase = -1, lastCnt = 0, waitT = 0;
for (let g = 0; g < 60 * 60 * 12 && R()[A.state] === 1; g++) {
  const m = R(), ph = m[A.phase], here = m[A.cy] * 16 + m[A.cx], idle = !m[A.mv] && !m[A.act];
  if (ph !== lastPhase) {
    if (ph === 0) { memory.clear(); }

    if (ph === 6) years++;
    if (process.env.DBG && (ph === 2 || ph === 3 || ph === 6)) console.log('ph', ph, 'おぼえ', [...memory.keys()].map((c) => c.toString(16)).join(' '), '地図', Array.from({ length: 256 }, (_, c) => (m[MAP + c] & 0xe0 ? c.toString(16) + ':' + m[MAP + c].toString(16) : '')).filter((x) => x).join(' '), 'count', m[A.count]);
    lastPhase = ph;
  }
  let want = [];
  if (ph === 0 || ph === 3) { if (m[0x11] > 60 && mode !== 'none') want = g % 4 < 2 ? ['A'] : []; }
  else if (mode === 'none') want = [];
  else if (mode === 'mash') { const d = ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(rnd() * 4)]; want = rnd() < 0.5 ? [d] : []; if (g % 2) want.push('A'); }
  else if (mode === 'hold') { want = ['A', ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(g / 40) % 4]]; }
  else if (ph === 1 && idle) {
    const watched = (m[A.wSt] && m[A.wSt] < 3) || (m[A.wSt + 1] && m[A.wSt + 1] < 3); // 来るとちゅうも
    if (!m[A.carry]) {
      const goals = new Set(); for (let i = 0; i < 3; i++) if (m[A.acSt + i]) goals.add(m[A.acCell + i]);
      const s = goals.size ? stepTo(here, goals) : null;
      if (s && s !== 'here') want = [s];
    } else {
      // うめる所: いまの ます が あいていて、うめた所と となりあわなければ
      const free = (c) => m[MAP + c] === 0 && ![...Array(3).keys()].some((i) => m[A.acSt + i] && m[A.acCell + i] === c);
      const nearCache = (c) => [...memory.keys()].some((k) => Math.abs((k & 15) - (c & 15)) + Math.abs((k >> 4) - (c >> 4)) < 2);
      if (free(here) && !nearCache(here) && (!watched || mode === 'blind' || m[A.bar] < 6)) { want = g % 2 ? ['A'] : []; if (want.length) { let t = here; if (mode === 'bot' && rnd() < 0.2) { const nb = [here - 16, here + 16, here - 1, here + 1].filter((c) => m[MAP + c] === 0); if (nb.length) t = nb[Math.floor(rnd() * nb.length)]; } memory.set(here, t); buried++; if (watched) seen++; } }
      else if (!free(here) || nearCache(here)) { const goals = new Set(); for (let c = 0; c < 256; c++) if (free(c) && !nearCache(c) && (c & 15) > 0 && (c & 15) < 15 && c >> 4 >= 2 && c >> 4 <= 13) goals.add(c); const s = stepTo(here, goals); if (s && s !== 'here') want = [s]; }
    }
  } else if (ph === 4 && idle) {
    // おぼえた所（bot は 5 つに 1 つ、となりと おぼえちがえている）を掘る
    const left = new Set([...memory.values()].filter((c) => !(m[MAP + c] & 0x20) && (m[MAP + c] & 15) === 0));
    if (left.size) {
      const s = stepTo(here, left);
      if (s === 'here') { want = g % 2 ? ['A'] : []; if (want.length && !(m[MAP + here] & 0x80)) misses++; }
      else if (s) want = [s];
    }
  }
  set(want);
  run(1);
  if ((R()[A.phase] === 0 || R()[A.phase] === 3) && R()[0x11] === 30) shotOnce(`intro${R()[A.phase]}-y${R()[A.year]}`);
  if (R()[A.phase] === 1 && R()[A.count] >= 2) shotOnce('autumn');
  if (R()[A.phase] === 1 && R()[A.wSt] === 2 && R()[A.carry]) shotOnce('watched');
  if (R()[A.phase] === 4 && R()[A.count] >= 1) shotOnce('winter');
  if (R()[A.phase] === 6 && R()[0x5e] >= 1) shotOnce('spring');
  if (R()[A.phase] === 7 && R()[0x11] === 60) shotOnce(`springplate-y${R()[A.year]}`);
}
set([]);
run(100); shot('end');
console.log(`mode ${mode} たね ${seed}: みつけた ${score()}・${years} 年（${R()[A.year]} 年め）・芽 ${R()[A.trees]}・うめた ${buried}（見られた ${seen}）・はずれ ${misses}・${(f / 60).toFixed(0)} 秒・state ${R()[A.state]}`);
