'use strict';
// セーブ（v006）: 世界をまるごと保存する。地形・水・草・水草・うるおい・木・生き物（遺伝子つき）・雲・泉・
//   太陽と月・暦・お題・グラフの記録・見え方。木の場所（tseed）は世界の種から newWorld で作り直す。
//   区画の値は丸めて（高さ 0.01・水 0.001・草など 256 段）バイト列 → base64、ほかの数は小数 3 けた。
//   全体の JSON を gzip（CompressionStream があれば）して base64 にする。最大でも 100KB ほど。
//   置き場所（v067。2026-10-14 ユーザー「セーブ・ロードを一から見直して、シンプルに」）: 遊び方ごとに世界は一つ。
//     localStorage の asobi-lab/edge-falls-2/save/story（十の年）と save/free（自由な箱庭）。手でセーブ・ロードはしない。
//     1日ごと・メニューを開いたとき・タイトルへ・ゲームを終える・ページを閉じるときに、いつも自動で書きとめる。
//     中身 { app, v, meta: {day, counts, ch, mode, at}, z: 'gzip'|'', data }。ファイルへの書き出しも同じ形。
//     v2（edge-falls-2）は置き場所を別にした。ファイルの読みこみでは、v1（app: 'edge-falls'）の世界も読める。

const SAVE_KEY = 'asobi-lab/edge-falls-2/save/';
const SAVE_V = 4;   // 4: v2 の v006（肥えの物さしを 0〜3 に）   // 2: 雪（v008）、3: 章・見つけたこと・去った命・世界のつまみ（v011）
const SLOTS = ['slot1', 'slot2', 'slot3'];

// ---- バイト列 ⇔ base64 ----
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }
async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}
async function gunzip(u8) {
  const ds = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(ds).text();
}

// 区画の値（大地の中だけ）を丸めて並べる
function packCells(arr, scale, Type) {
  const out = new Type(INS.length), max = Type === Uint8Array ? 255 : Type === Int16Array ? 32767 : 65535;
  INS.forEach((i, n) => { out[n] = Math.max(Type === Int16Array ? -32768 : 0, Math.min(max, Math.round(arr[i] * scale))); });
  return b64(new Uint8Array(out.buffer));
}
function unpackCells(str, scale, Type, arr) {
  const u8 = unb64(str), v = new Type(u8.buffer, 0, INS.length);
  INS.forEach((i, n) => { arr[i] = v[n] / scale; });
}
const r3 = (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;

function snapshot() {
  const KI = { deer: 0, wolf: 1, fish: 2, bird: 3, human: 4 };
  return {
    fv: SAVE_V, seed: W.seed, t: W.t, day: W.day, soil: W.soil, abyss: W.abyss, vapor: W.vapor, outRate: W.outRate,
    stock: W.stock, sun: { a: W.sun.a, stop: W.sun.stop }, moon: { a: W.moon.a, stop: W.moon.stop },
    springs: W.springs.map(s => [s.i, s.on ? 1 : 0]),
    clouds: W.clouds.map(c => [c.x, c.y, c.water, c.age, c.seed]),
    cells: {
      g: packCells(W.g, 100, Int16Array), w: packCells(W.w, 1000, Uint16Array),
      veg: packCells(W.veg, 255, Uint8Array), alg: packCells(W.alg, 255, Uint8Array),
      moist: packCells(W.moist, 255, Uint8Array), tree: packCells(W.tree, 255, Uint8Array),
      snow: packCells(W.snow, 1000, Uint16Array), fert: packCells(W.fert, 85, Uint8Array), farm: packCells(W.farm, 255, Uint8Array), litter: packCells(W.litter, 120, Uint8Array),
    },
    // [種類, x, y, おなか, のど, 年, 次の子まで, 向き, ぬれ, 世代, 遺伝子1〜3]
    animals: L.list.filter(a => !a.dead).map(a => [KI[a.kind], a.x, a.y, a.e, a.th, a.age, a.cd, a.dir, a.wet, a.gen, ...GENES[a.kind].map(([k]) => a.g[k]), a.sp || 0]),
    stats: { born: L.born, eaten: L.eaten, fell: L.fell },
    hist: HIST,
    quest: { ch: G.ch, chT: G.chT, streak: G.streak, helped: G.helped, goal: G.goal, gbase: G.gbase, gpick: G.gpick, winterOk: G.winterOk, winterSeen: G.winterSeen },
    story: { mode: G.mode, unread: G.unread, done: G.done, found: G.found, did: G.did, tipped: G.tipped, souls: W.souls, lives: livesForSave(), genes: genesForSave(), abyssFert: W.abyssFert, species: W.species, sepDays: W.sepDays, humans: { huts: W.huts, village: W.village, wisdom: W.wisdom, wisP: W.wisT, seasons: W.hSeasons, season: W.hSeason, dammed: W.dammed }, knob: W.knob, flags: W.flags },
    view: { yaw: V.yaw, tilt: V.tilt, zoom: V.zoom, panX: V.panX || 0, panY: V.panY || 0 },
  };
}

const localStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
async function encodeWorld() {
  const json = JSON.stringify(snapshot(), r3);
  const z = await gzip(json).catch(() => null);
  const meta = { day: W.day, counts: { ...L.counts }, ch: G.ch, mode: G.mode, at: localStamp() };
  return z ? { app: 'edge-falls-2', v: SAVE_V, meta, z: 'gzip', data: b64(z) } : { app: 'edge-falls-2', v: SAVE_V, meta, z: '', data: json };
}

async function decodeWorld(rec) {
  if (!rec || !/^edge-falls(-2)?$/.test(rec.app) || typeof rec.data !== 'string') throw new Error(TX('果ての滝の箱庭の世界ではない', 'This is not an Edge Falls Garden world'));
  if (rec.v > SAVE_V) throw new Error(TX('新しい版の世界なので読めない', 'This world is from a newer version and can’t be read'));
  let s;
  try { s = JSON.parse(rec.z === 'gzip' ? await gunzip(unb64(rec.data)) : rec.data); }
  catch (e) { throw new Error(TX('記録がこわれている', 'The record is broken')); }
  // 世界をさわる前に、形を確かめる（とちゅうで失敗して世界が半分こわれないように）
  const ok = s && s.cells && ['g', 'w', 'veg', 'alg', 'moist', 'tree'].every(k => typeof s.cells[k] === 'string') &&
    s.sun && s.moon && s.quest && Array.isArray(s.animals);
  if (!ok) throw new Error(TX('記録の中身が足りない', 'The record is missing data'));
  try { for (const k of ['g', 'w']) if (unb64(s.cells[k]).length < INS.length * 2) throw 0; for (const k of ['veg', 'alg', 'moist', 'tree']) if (unb64(s.cells[k]).length < INS.length) throw 0; }
  catch (e) { throw new Error(TX('記録の中身が足りない', 'The record is missing data')); }
  return s;
}

function applyWorld(s) {
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  LATER.length = 0; if (ENDING) { ENDING = null; document.body.classList.remove('ending'); }   // 前の世界の「少しあとで」を持ちこさない（v018）
  newWorld(num(s.seed, 1) | 0);                       // 区画の入れ物と木の場所を作り直してから、上書き
  for (const k of ['fL', 'fR', 'fU', 'fD']) W[k].fill(0);
  unpackCells(s.cells.g, 100, Int16Array, W.g); unpackCells(s.cells.w, 1000, Uint16Array, W.w);
  unpackCells(s.cells.veg, 255, Uint8Array, W.veg); unpackCells(s.cells.alg, 255, Uint8Array, W.alg); W.sown.fill(0);   // まきかけのたねは残さない
  unpackCells(s.cells.moist, 255, Uint8Array, W.moist); unpackCells(s.cells.tree, 255, Uint8Array, W.tree);
  if (typeof s.cells.snow === 'string' && unb64(s.cells.snow).length >= INS.length * 2) unpackCells(s.cells.snow, 1000, Uint16Array, W.snow);
  if (typeof s.cells.fert === 'string' && unb64(s.cells.fert).length >= INS.length) unpackCells(s.cells.fert, s.fv >= 4 ? 85 : 170, Uint8Array, W.fert);   // v2（v1 の世界にはないので 0.5 のまま）
  W.t = num(s.t, 0); W.day = num(s.day, 1); W.soil = num(s.soil, 120); W.abyss = num(s.abyss, 900);
  W.vapor = num(s.vapor, 0); W.outRate = num(s.outRate, 0);
  for (const k of ['deer', 'wolf', 'fish', 'bird', 'human', 'seed']) W.stock[k] = Math.max(0, Math.min(STOCK_MAX[k], num(s.stock && s.stock[k], k === 'seed' ? STOCK_MAX.seed : 0)));   // たね（v014）のない古い記録は、いっぱいで
  if (typeof s.cells.litter === 'string' && unb64(s.cells.litter).length >= INS.length) unpackCells(s.cells.litter, 120, Uint8Array, W.litter);
  if (typeof s.cells.farm === 'string' && unb64(s.cells.farm).length >= INS.length) unpackCells(s.cells.farm, 255, Uint8Array, W.farm);
  W.sun.a = num(s.sun.a, 0); W.sun.stop = !!s.sun.stop; W.moon.a = num(s.moon.a, 0); W.moon.stop = !!s.moon.stop;
  W.springs = (s.springs || []).filter(p => inside[p[0]]).slice(0, SPRING_MAX).map(p => ({ i: p[0], on: !!p[1] }));
  W.clouds = (s.clouds || []).slice(0, 24).map(c => ({ x: c[0], y: c[1], water: c[2], age: c[3], seed: c[4], rain: 0 }));
  resetLife();
  const KN = ['deer', 'wolf', 'fish', 'bird', 'human'];
  for (const r of s.animals || []) {
    const kind = KN[r[0]]; if (!kind) continue;
    const g = {}; GENES[kind].forEach(([k], n) => { g[k] = clamp01(num(r[10 + n], 0.5)); });
    const a = spawn(kind, num(r[1], C), num(r[2], C), num(r[3], 5), g);
    if (!a) continue;
    if (kind === 'bird') a.alt = 0;
    a.th = num(r[4], 0); a.age = num(r[5], 0); a.cd = num(r[6], 0); a.dir = num(r[7], 0); a.wet = num(r[8], 0); a.gen = num(r[9], 1) | 0; a.sp = num(r[10 + GENES[kind].length], 0) | 0;
  }
  if (s.stats) { L.born = num(s.stats.born, 0); L.eaten = num(s.stats.eaten, 0); L.fell = num(s.stats.fell, 0); }
  HIST.length = 0; if (Array.isArray(s.hist)) HIST.push(...s.hist.slice(-240));
  // 章（v011）。それより前のセーブは、自由な箱庭として読む
  const st = s.story || {}, q = s.quest;
  G.mode = st.mode === 'free' || st.mode === 'story' ? st.mode : modeOfCh(q.ch);
  if (typeof q.ch === 'number') {
    const ch = Math.max(0, Math.min(CHAPTERS.length, Math.floor(num(q.ch, 0))));
    G.done = Array.isArray(st.done) ? st.done : []; G.found = st.found && typeof st.found === 'object' ? st.found : {};
    G.did = st.did || {}; G.tipped = st.tipped || {}; G.unread = st.unread && typeof st.unread === 'object' ? st.unread : {};
    enterChapter(ch, true);
    G.chT = num(q.chT, 0); G.streak = num(q.streak, 0); G.helped = num(q.helped, 0) | 0; if (typeof q.goal === 'number') G.goal = q.goal; if (q.gbase && typeof q.gbase === 'object') G.gbase = q.gbase; G.gpick = typeof q.gpick === 'string' && GPICK[q.gpick] ? q.gpick : null; G.winterOk = !!q.winterOk; G.winterSeen = !!q.winterSeen;
    if (st.knob) W.knob = { winter: num(st.knob.winter, 1), tide: num(st.knob.tide, 1) };
    if (st.souls) for (const k of ['deer', 'wolf', 'fish', 'bird', 'human']) W.souls[k] = num(st.souls[k], 0);
    resetCycle(); if (st.lives) for (const k of ['deer', 'wolf', 'fish', 'bird', 'human']) W.abyssLives[k] = Math.max(0, num(st.lives[k], 0) | 0);
    if (st.genes) genesFromSave(st.genes, num);   // 深淵とつぼの命の型（v022。ない記録は、型なし）
    W.abyssFert = num(st.abyssFert, 60);
    if (Array.isArray(st.species)) W.species = st.species.filter(r => r && SP_KINDS.includes(r.kind) && typeof r.id === 'number').map(r => ({ kind: r.kind, id: r.id | 0, name: String(r.name || '').slice(0, 14), day: num(r.day, 1), from: num(r.from, 0) })); if (st.sepDays && typeof st.sepDays === 'object') W.sepDays = { ...st.sepDays };
    const hu = st.humans; if (hu) { W.village = hu.village && typeof hu.village.x === 'number' ? { x: hu.village.x, y: hu.village.y } : null; W.wisdom = hu.wisdom && typeof hu.wisdom === 'object' ? { ...hu.wisdom } : {}; W.wisT = num(hu.wisP, 0); W.hSeasons = num(hu.seasons, 0) | 0; W.hSeason = num(hu.season, -1) | 0; W.dammed = hu.dammed ? 1 : 0; W.huts = Array.isArray(hu.huts) ? hu.huts.slice(0, 5).map(h => ({ x: num(h.x, C), y: num(h.y, C), b: Math.max(0, Math.min(1, num(h.b, 1))) })) : []; }
    if (st.flags) W.flags = { ...st.flags };
  } else { G.done = []; G.found = {}; G.did = {}; G.tipped = {}; G.unread = {}; enterChapter(CHAPTERS.length, true); }
  G.streak = num(q.streak, 0);
  G.sel = null;
  // 読みこんだら、見る向き（回した向き）だけ残して、寄り・平行移動・傾きははじめのカメラに（v034。2026-10-13 ユーザー「ロード直後にすごい寄ったカメラになってる」）
  if (s.view) V.yaw = num(s.view.yaw, V.yaw);
  V.tilt = 0.56; V.zoom = 1; V.panX = 0; V.panY = 0;
  updateLight(); stepClimate(0, true); stepMoist(0.25);
  prevCounts = { ...L.counts };
  layout(V.cw, V.ch);
}

async function loadRecord(rec) { applyWorld(await decodeWorld(rec)); }

// ---- 置き場所（遊び方ごとに世界は一つ） ----
const MODES = ['story', 'free'];
const modeOfCh = ch => (typeof ch === 'number' && ch >= CHAPTERS.length ? 'free' : 'story');   // 遊び方の書いていない古い記録（十の年を終えたものも自由な箱庭に）
const modeOf = rec => (rec && rec.meta && MODES.includes(rec.meta.mode) ? rec.meta.mode : modeOfCh(rec && rec.meta && rec.meta.ch));
function readKey(name) { try { const s = localStorage.getItem(SAVE_KEY + name); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
const readWorld = mode => readKey(mode);

// 書きとめる（いまの世界を、その遊び方の置き場所へ）。quiet でなければ右下に「第 ◯ 日を書きとめた」（25 秒に一度まで。×16 でもうるさくないように）
let savingP = null, notedShown = 0;
async function noteWorld(quiet) {
  if (!G.started || THUMB) return false;
  while (savingP) await savingP;                // 書きとめている最中なら、終わってから（同時に二つ書かない）
  let ok = false;
  savingP = encodeWorld().then(rec => { localStorage.setItem(SAVE_KEY + G.mode, JSON.stringify(rec)); ok = true; }).catch(() => { ok = false; });
  await savingP; savingP = null;
  if (ok) { G.notedDay = W.day; G.notedAt = Date.now(); }
  if (!ok) showNoted(TX('書きとめられなかった（ブラウザの保存の場所がいっぱいかもしれない）', 'Couldn’t note it down (the browser’s storage may be full)'), true);
  else if (!quiet && Date.now() - notedShown > 25000) showNoted(TX(`第 ${W.day} 日を書きとめた`, `Day ${W.day} noted down`));
  return ok;
}
function showNoted(text, bad) {
  const el = $('noted'); if (!el) return;
  notedShown = Date.now();
  el.textContent = text; el.classList.toggle('bad', !!bad);
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
addEventListener('DOMContentLoaded', () => {
  const el = document.createElement('div'); el.className = 'noted'; el.id = 'noted'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  $('corner').before(el);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) noteWorld(true); });
addEventListener('pagehide', () => noteWorld(true));

// どこまで遊んだか（タイトルのボタンの下・はじめからの確かめ）: 「第三の年・第 24 日」「十の年のあと・第 40 日」「第 40 日」
function worldWhere(rec) {
  if (!rec || !rec.meta) return '';
  const m = rec.meta, day = TX(`第 ${m.day} 日`, `Day ${m.day}`), sep = TX('・', ' · ');
  if (modeOf(rec) === 'free') return day;
  if (typeof m.ch !== 'number') return day;
  return (m.ch >= CHAPTERS.length ? TX('十の年のあと', 'After the Ten Years') : yearOf(Math.floor(m.ch))) + sep + day;
}

// 世界を読みこんで遊びはじめる（タイトルから）。読めなかったら、タイトルにもどる（記録は消さない）
async function playWorld(mode) {
  try {
    await loadRecord(readWorld(mode));
    G.mode = mode; G.started = true; document.body.classList.remove('titling'); syncHands();
    toast(TX(`第 ${W.day} 日から`, `From day ${W.day}`)); Sound.play('spring');
  } catch (e) { toast(TX('読みこめなかった: ', 'Couldn’t open it: ') + e.message, 5); Sound.play('no'); start(); }
}

// ファイル（設定のいちばん下。ほかの端末・ブラウザへ持っていく、とっておく）
function openFilePanel(back) {
  showPanel(TX(`<p class="mtitle">ファイル</p><p class="small center">いまの世界をファイルにして、ほかの端末やブラウザへ持っていける。<br>読みこんだ世界は、同じ遊び方（十の年／自由な箱庭）の世界と入れかわる。</p>`,
    `<p class="mtitle">File</p><p class="small center">Save the current world as a file to take it to another device or browser.<br>A world you open replaces your world of the same kind (Ten Years / Free Garden).</p>`), [
    { label: TX('ファイルにする', 'Save as a file'), fn: async () => {
      await noteWorld(true);
      const url = URL.createObjectURL(new Blob([JSON.stringify(await encodeWorld())], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `edge-falls-${G.mode}-day${W.day}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(TX('ファイルにした', 'Saved as a file')); openFilePanel(back);
    } },
    { label: TX('ファイルを読みこむ', 'Open a file'), fn: () => { openFilePanel(back); $('fileImport').click(); } },
    { label: TX('もどる', 'Back'), main: true, fn: back },
  ]);
  $('panel').classList.add('menu', 'world');
  $('panel').insertAdjacentHTML('beforeend', '<input type="file" id="fileImport" accept=".json,application/json" hidden>');
  G.panelBack = back;
  $('fileImport').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5e6) { toast(TX('大きすぎるファイル', 'The file is too big')); Sound.play('no'); return; }
    try {
      let rec; try { rec = JSON.parse(await f.text()); } catch (e2) { throw new Error(TX('果ての滝の箱庭の世界ではない', 'This is not an Edge Falls Garden world')); }
      await decodeWorld(rec);                    // 先に確かめる（読めないファイルで、いまの世界を書きとめなおさない）
      await noteWorld(true);                     // いまの世界は、その置き場所に書きとめてから
      await loadRecord(rec);
      G.started = true; $('overlay').hidden = true; G.menuOpen = false;
      if (menuSpeed !== null) { setSpeed(menuSpeed); menuSpeed = null; }
      await noteWorld(true);
      toast(TX(`読みこんだ: 第 ${W.day} 日`, `Opened: day ${W.day}`)); Sound.play('spring');
    } catch (err) { toast(TX('読みこめなかった: ', 'Couldn’t open it: ') + (err.message || ''), 5); Sound.play('no'); }
  };
}
