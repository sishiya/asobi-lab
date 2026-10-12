'use strict';
// セーブ（v006）: 世界をまるごと保存する。地形・水・草・水草・うるおい・木・生き物（遺伝子つき）・雲・泉・
//   太陽と月・暦・お題・グラフの記録・見え方。木の場所（tseed）は世界の種から newWorld で作り直す。
//   区画の値は丸めて（高さ 0.01・水 0.001・草など 256 段）バイト列 → base64、ほかの数は小数 3 けた。
//   全体の JSON を gzip（CompressionStream があれば）して base64 にする。最大でも 100KB ほど。
//   置き場所: localStorage の asobi-lab/edge-falls/save/{auto,slot1,slot2,slot3}。
//     中身 { app, v, meta: {day, counts, qi, at}, z: 'gzip'|'', data }。ファイルへの書き出しも同じ形。

const SAVE_KEY = 'asobi-lab/edge-falls/save/';
const SAVE_V = 3;   // 2: 雪（v008）、3: 章・見つけたこと・去った命・世界のつまみ（v011）
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
  const KI = { deer: 0, wolf: 1, fish: 2, bird: 3 };
  return {
    seed: W.seed, t: W.t, day: W.day, soil: W.soil, abyss: W.abyss, vapor: W.vapor, outRate: W.outRate,
    stock: W.stock, sun: { a: W.sun.a, stop: W.sun.stop }, moon: { a: W.moon.a, stop: W.moon.stop },
    springs: W.springs.map(s => [s.i, s.on ? 1 : 0]),
    clouds: W.clouds.map(c => [c.x, c.y, c.water, c.age, c.seed]),
    cells: {
      g: packCells(W.g, 100, Int16Array), w: packCells(W.w, 1000, Uint16Array),
      veg: packCells(W.veg, 255, Uint8Array), alg: packCells(W.alg, 255, Uint8Array),
      moist: packCells(W.moist, 255, Uint8Array), tree: packCells(W.tree, 255, Uint8Array),
      snow: packCells(W.snow, 1000, Uint16Array),
    },
    // [種類, x, y, おなか, のど, 年, 次の子まで, 向き, ぬれ, 世代, 遺伝子1〜3]
    animals: L.list.filter(a => !a.dead).map(a => [KI[a.kind], a.x, a.y, a.e, a.th, a.age, a.cd, a.dir, a.wet, a.gen, ...GENES[a.kind].map(([k]) => a.g[k])]),
    stats: { born: L.born, eaten: L.eaten, fell: L.fell },
    hist: HIST,
    quest: { ch: G.ch, chT: G.chT, streak: G.streak, helped: G.helped, goal: G.goal, gbase: G.gbase, winterOk: G.winterOk, winterSeen: G.winterSeen },
    story: { done: G.done, found: G.found, did: G.did, tipped: G.tipped, souls: W.souls, knob: W.knob, flags: W.flags },
    view: { yaw: V.yaw, tilt: V.tilt, zoom: V.zoom, panX: V.panX || 0, panY: V.panY || 0 },
  };
}

const localStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
async function encodeWorld() {
  const json = JSON.stringify(snapshot(), r3);
  const z = await gzip(json).catch(() => null);
  const meta = { day: W.day, counts: { ...L.counts }, ch: G.ch, at: localStamp() };
  return z ? { app: 'edge-falls', v: SAVE_V, meta, z: 'gzip', data: b64(z) } : { app: 'edge-falls', v: SAVE_V, meta, z: '', data: json };
}

async function decodeWorld(rec) {
  if (!rec || rec.app !== 'edge-falls' || typeof rec.data !== 'string') throw new Error('果ての滝の箱庭のセーブではない');
  if (rec.v > SAVE_V) throw new Error('新しい版のセーブなので読めない');
  let s;
  try { s = JSON.parse(rec.z === 'gzip' ? await gunzip(unb64(rec.data)) : rec.data); }
  catch (e) { throw new Error('セーブがこわれている'); }
  // 世界をさわる前に、形を確かめる（とちゅうで失敗して世界が半分こわれないように）
  const ok = s && s.cells && ['g', 'w', 'veg', 'alg', 'moist', 'tree'].every(k => typeof s.cells[k] === 'string') &&
    s.sun && s.moon && s.quest && Array.isArray(s.animals);
  if (!ok) throw new Error('セーブの中身が足りない');
  try { for (const k of ['g', 'w']) if (unb64(s.cells[k]).length < INS.length * 2) throw 0; for (const k of ['veg', 'alg', 'moist', 'tree']) if (unb64(s.cells[k]).length < INS.length) throw 0; }
  catch (e) { throw new Error('セーブの中身が足りない'); }
  return s;
}

function applyWorld(s) {
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  newWorld(num(s.seed, 1) | 0);                       // 区画の入れ物と木の場所を作り直してから、上書き
  for (const k of ['fL', 'fR', 'fU', 'fD']) W[k].fill(0);
  unpackCells(s.cells.g, 100, Int16Array, W.g); unpackCells(s.cells.w, 1000, Uint16Array, W.w);
  unpackCells(s.cells.veg, 255, Uint8Array, W.veg); unpackCells(s.cells.alg, 255, Uint8Array, W.alg);
  unpackCells(s.cells.moist, 255, Uint8Array, W.moist); unpackCells(s.cells.tree, 255, Uint8Array, W.tree);
  if (typeof s.cells.snow === 'string' && unb64(s.cells.snow).length >= INS.length * 2) unpackCells(s.cells.snow, 1000, Uint16Array, W.snow);
  W.t = num(s.t, 0); W.day = num(s.day, 1); W.soil = num(s.soil, 120); W.abyss = num(s.abyss, 900);
  W.vapor = num(s.vapor, 0); W.outRate = num(s.outRate, 0);
  for (const k of ['deer', 'wolf', 'fish', 'bird']) W.stock[k] = Math.max(0, Math.min(STOCK_MAX[k], num(s.stock && s.stock[k], 0)));
  W.sun.a = num(s.sun.a, 0); W.sun.stop = !!s.sun.stop; W.moon.a = num(s.moon.a, 0); W.moon.stop = !!s.moon.stop;
  W.springs = (s.springs || []).filter(p => inside[p[0]]).slice(0, SPRING_MAX).map(p => ({ i: p[0], on: !!p[1] }));
  W.clouds = (s.clouds || []).slice(0, 24).map(c => ({ x: c[0], y: c[1], water: c[2], age: c[3], seed: c[4], rain: 0 }));
  resetLife();
  const KN = ['deer', 'wolf', 'fish', 'bird'];
  for (const r of s.animals || []) {
    const kind = KN[r[0]]; if (!kind) continue;
    const g = {}; GENES[kind].forEach(([k], n) => { g[k] = clamp01(num(r[10 + n], 0.5)); });
    const a = spawn(kind, num(r[1], C), num(r[2], C), num(r[3], 5), g);
    if (!a) continue;
    if (kind === 'bird') a.alt = 0;
    a.th = num(r[4], 0); a.age = num(r[5], 0); a.cd = num(r[6], 0); a.dir = num(r[7], 0); a.wet = num(r[8], 0); a.gen = num(r[9], 1) | 0;
  }
  if (s.stats) { L.born = num(s.stats.born, 0); L.eaten = num(s.stats.eaten, 0); L.fell = num(s.stats.fell, 0); }
  HIST.length = 0; if (Array.isArray(s.hist)) HIST.push(...s.hist.slice(-240));
  // 章（v011）。それより前のセーブは、自由な箱庭として読む
  const st = s.story || {}, q = s.quest;
  if (typeof q.ch === 'number') {
    const ch = Math.max(0, Math.min(CHAPTERS.length, Math.floor(num(q.ch, 0))));
    G.done = Array.isArray(st.done) ? st.done : []; G.found = st.found && typeof st.found === 'object' ? st.found : {};
    G.did = st.did || {}; G.tipped = st.tipped || {};
    enterChapter(ch, true);
    G.chT = num(q.chT, 0); G.streak = num(q.streak, 0); G.helped = num(q.helped, 0) | 0; if (typeof q.goal === 'number') G.goal = q.goal; if (q.gbase && typeof q.gbase === 'object') G.gbase = q.gbase; G.winterOk = !!q.winterOk; G.winterSeen = !!q.winterSeen;
    if (st.knob) W.knob = { winter: num(st.knob.winter, 1), tide: num(st.knob.tide, 1) };
    if (st.souls) for (const k of ['deer', 'wolf', 'fish', 'bird']) W.souls[k] = num(st.souls[k], 0);
    if (st.flags) W.flags = { ...st.flags };
  } else { G.done = []; G.found = {}; G.did = {}; G.tipped = {}; enterChapter(CHAPTERS.length, true); }
  G.streak = num(q.streak, 0);
  G.sel = null;
  if (s.view) { V.yaw = num(s.view.yaw, V.yaw); V.tilt = Math.max(0.32, Math.min(0.92, num(s.view.tilt, V.tilt))); V.zoom = Math.max(0.6, Math.min(3, num(s.view.zoom, 1))); V.panX = num(s.view.panX, 0); V.panY = num(s.view.panY, 0); }
  updateLight(); stepClimate(0, true); stepMoist(0.25);
  prevCounts = { ...L.counts };
  layout(V.cw, V.ch);
}

// ---- localStorage ----
function readSlot(name) { try { const s = localStorage.getItem(SAVE_KEY + name); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
let saving = false;
async function saveSlot(name) {
  if (saving) return false;
  saving = true;
  try { localStorage.setItem(SAVE_KEY + name, JSON.stringify(await encodeWorld())); return true; }
  catch (e) { return false; }
  finally { saving = false; }
}
async function loadRecord(rec) { applyWorld(await decodeWorld(rec)); }
const autoSave = () => G.started && saveSlot('auto');
document.addEventListener('visibilitychange', () => { if (document.hidden) autoSave(); });
addEventListener('pagehide', autoSave);

// ---- 画面 ----
const KNAME = { deer: 'シカ', wolf: 'オオカミ', fish: 'サカナ', bird: 'サギ' };
function metaText(rec) {
  if (!rec || !rec.meta) return 'からっぽ';
  const m = rec.meta, c = m.counts || {};
  const ch = typeof m.ch === 'number' ? (m.ch >= CHAPTERS.length ? '自由な箱庭・' : YEARNAME[Math.floor(m.ch)] + 'の年・') : '';
  return `${ch}第 ${m.day} 日・${['deer', 'wolf', 'fish', 'bird'].map(k => KNAME[k] + ' ' + (c[k] || 0)).join('・')}<br><small>${m.at || ''}</small>`;
}

function openSavePanel() {
  const rows = [['auto', '自動セーブ'], ...SLOTS.map((s, n) => [s, 'スロット ' + (n + 1)])].map(([k, label]) => {
    const rec = readSlot(k);
    return `<div class="slot"><div><b>${label}</b><p>${metaText(rec)}</p></div><div class="sbtn">` +
      (k === 'auto' ? '' : `<button type="button" class="tbtn" data-save="${k}">ここにセーブ</button>`) +
      (rec ? `<button type="button" class="tbtn" data-load="${k}">読みこむ</button>` : '') + '</div></div>';
  }).join('');
  showPanel(`<h2>セーブ</h2><p class="small">地形・水・草・生き物（遺伝子も）・お題まで、世界をまるごと残す。1日ごとと、ページを閉じるときに自動セーブ。</p>${rows}
    <div class="slot"><div><b>ファイル</b><p>ほかのブラウザへ持っていく・とっておく</p></div><div class="sbtn"><button type="button" class="tbtn" id="btnExport">書き出す</button><button type="button" class="tbtn" id="btnImport">読みこむ</button></div></div>
    <input type="file" id="fileImport" accept=".json,application/json" hidden>`, [{ label: 'とじる', main: true }]);
  const panel = $('panel');
  panel.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
    const ok = await saveSlot(b.dataset.save);
    toast(ok ? 'セーブした' : 'セーブできなかった（ブラウザの保存の場所がいっぱいかもしれない）'); Sound.play(ok ? 'put' : 'no'); openSavePanel();
  });
  panel.querySelectorAll('[data-load]').forEach(b => b.onclick = async () => {
    const rec = readSlot(b.dataset.load);
    if (b.dataset.load !== 'auto') await saveSlot('auto');          // いまの世界は自動セーブに残してから
    try { await loadRecord(rec); $('overlay').hidden = true; G.started = true; toast('読みこんだ: 第 ' + W.day + ' 日'); Sound.play('spring'); }
    catch (e) { toast('読みこめなかった: ' + e.message); Sound.play('no'); }
  });
  $('btnExport').onclick = async () => {
    const rec = await encodeWorld();
    const url = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `edge-falls-day${W.day}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('書き出した');
  };
  $('btnImport').onclick = () => $('fileImport').click();
  $('fileImport').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5e6) { toast('大きすぎるファイル'); return; }
    try {
      const rec = JSON.parse(await f.text());
      await saveSlot('auto'); await loadRecord(rec);
      $('overlay').hidden = true; G.started = true; toast('読みこんだ: 第 ' + W.day + ' 日'); Sound.play('spring');
    } catch (err) { toast('読みこめなかった: ' + err.message); Sound.play('no'); }
  };
}
