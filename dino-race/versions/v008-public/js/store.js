// 保存（牧場・メダル・記録帳）、文字の形、しらせ（toast）、記録帳への記入。

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE_KEY = 'asobi-lab/dino-race/ranch-v1';    // 牧場・生まれた子（v001 の形に足していく）
const PROG_KEY = 'asobi-lab/dino-race/progress-v1'; // メダル・記録帳・あそびかたを見たか
const BASE_SLOTS = 8, MAX_RACE = 4; // 牧場の広さ（メダル1つで +1）。かけっこの長さ FINISH と打ち切り LIMIT は sim.js
// 系統の名前（子の名前のもと）。英語は子の名前で前半を3文字ずつつなぐ（Rap + com → Rapcom）
const LINE = TX({trex: 'ティラノ', raptor: 'ラプトル', compy: 'コンピー', struthio: 'ストルティオ'}, {trex: 'Tyranno', raptor: 'Raptor', compy: 'Compy', struthio: 'Struthio'});
const spName = sp => TX(sp.name, sp.name_en); // 種の名前（genome.js は Worker でも読むので TX を使わず name_en を持つ）

// ---------- 保存 ----------
let ranch = [], kids = [], serial = 1; // kids: 生まれた子（残すか決める前）
let prog = {medals: {}, best: null, classes: {}, born: 0, practiced: 0, evolved: 0, races: 0, maxGen: 0, tipDone: false, joined: {}, research: {}};
let selected = []; // 選んだ順の id

function starter(sp) {
  return {id: 's-' + sp.id, name: spName(sp), line: LINE[sp.id], g: {...sp.body, ...(sp.gait || baseGait()), from: sp.id}, rec: null, gen: 0, parents: []};
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && Array.isArray(s.ranch) && s.ranch.length) {
      ranch = s.ranch; kids = Array.isArray(s.kids) ? s.kids : []; serial = s.serial || ranch.length + 1;
    }
    const p = JSON.parse(localStorage.getItem(PROG_KEY) || 'null');
    if (p) prog = {...prog, ...p};
  } catch (e) { /* 保存が読めないときは、はじめから */ }
  if (!ranch.length) ranch = SPECIES.filter(sp => !sp.joins).map(starter);
  for (const x of [...ranch, ...kids]) { x.practice = null; delete x.isNew; delete x.hatching; } // 練習の途中は保存しない
  // はじめの種は、名前を変えていなければ、いまの言語の名前に（系統の名前も）
  for (const x of [...ranch, ...kids]) {
    const sp = x.id.startsWith('s-') && SPECIES.find(q => 's-' + q.id === x.id);
    if (sp && (x.name === sp.name || x.name === sp.name_en)) { x.name = spName(sp); x.line = LINE[sp.id]; }
  }
  // 研究の推定とくらべる表は、v007 までは名前（日本語）がかぎ → id に
  if (prog.research) for (const r of RESEARCH) if (prog.research[r.ja] && !prog.research[r.id]) { prog.research[r.id] = prog.research[r.ja]; delete prog.research[r.ja]; }
  for (const x of [...ranch, ...kids]) if (x.rec && (!x.rec.rb || x.rec.rb.n !== TRIES)) x.rec = null; // しっかり度がない（v003 まで）・はかった数がちがう（v004 は 6回）→ はかり直す
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ranch, kids, serial})); } catch (e) { /* 保存できなくても遊べる */ }
}
function saveProg() {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (e) { /* 同上 */ }
}
const slots = () => BASE_SLOTS + Object.keys(prog.medals).length;

// ---------- 文字 ----------
const fmtMass = M => M >= 1000 ? (M / 1000).toFixed(M >= 10000 ? 0 : 1) + 't' : M >= 10 ? Math.round(M) + 'kg' : M.toFixed(1) + 'kg';
const kmh = ms => (ms * 3.6).toFixed(1);
const fmtT = t => t.toFixed(2) + TX('秒', 's');
const SEP = TX(' ・ ', ' · '); // 区切り
const kmhText = ms => TX(`時速 ${kmh(ms)}km`, `${kmh(ms)} km/h`);
function recText(rec, short = false) {
  if (!rec) return TX('記録をはかっています…', 'Timing…');
  if (rec.finishT != null) return `100m <b>${fmtT(rec.finishT)}</b>${short ? '' : TX(`（${kmhText(FINISH / rec.finishT)}）`, ` (${kmhText(FINISH / rec.finishT)})`)}`;
  if (rec.fell) return TX(`<b>${Math.max(0, rec.dist).toFixed(1)}m</b> で転んだ`, `Fell at <b>${Math.max(0, rec.dist).toFixed(1)}m</b>`);
  return TX(`${LIMIT}秒で <b>${Math.max(0, rec.dist).toFixed(1)}m</b>`, `<b>${Math.max(0, rec.dist).toFixed(1)}m</b> in ${LIMIT}s`);
}
// しっかり度（v004）: 走り方を少しずらした10通りのうち、ゴールできた数とタイムの幅
function rbText(rec) {
  if (!rec || !rec.rb) return '';
  const {ok, n, lo, hi} = rec.rb;
  return TX(`${n}回中${ok}回ゴール${lo != null ? `（${lo.toFixed(1)}〜${hi.toFixed(1)}秒）` : ''}`, `Finished ${ok}/${n}${lo != null ? ` (${lo.toFixed(1)}–${hi.toFixed(1)}s)` : ''}`);
}
const rbClass = rec => !rec || !rec.rb ? '' : rec.rb.ok >= 0.8 * rec.rb.n ? 'rb-hi' : rec.rb.ok >= 0.5 * rec.rb.n ? 'rb-mid' : 'rb-lo';
const recShort = rec => !rec ? '…' : rec.finishT != null ? fmtT(rec.finishT) : rec.fell ? TX(`${Math.max(0, rec.dist).toFixed(0)}mで転倒`, `fell at ${Math.max(0, rec.dist).toFixed(0)}m`) : `${Math.max(0, rec.dist).toFixed(0)}m`;

let toastT = 0;
function toast(msg, ms = 2800) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------- 記録帳 ----------
function noteRecord(x) {
  if (!x.rec) return;
  prog.maxGen = Math.max(prog.maxGen, x.gen || 0);
  const t = x.rec.finishT; if (t == null) { saveProg(); return; }
  const M = bodyPlan(x.g).M, entry = {name: x.name, t, M, gen: x.gen || 0};
  const news = [];
  if (!prog.best || t < prog.best.t) { if (prog.best) news.push(TX('牧場の最速', 'fastest on the ranch')); prog.best = entry; }
  const c = classOf(M);
  if (!prog.classes[c.id] || t < prog.classes[c.id].t) { if (prog.classes[c.id] && !news.length) news.push(TX(`${c.name}の最速`, `fastest at ${c.name}`)); prog.classes[c.id] = entry; }
  // 研究の推定とくらべる（体重が半分〜2倍の最速。race.js の記録帳）
  prog.research = prog.research || {};
  for (const r of RESEARCH) if (M >= r.M / 2 && M <= r.M * 2 && (!prog.research[r.id] || t < prog.research[r.id].t)) prog.research[r.id] = entry;
  saveProg();
  // 記録更新の知らせ（卵がかえるのを待ってから）
  if (news.length && x.gen) setTimeout(() => { toast(TX(`新記録！ ${news[0]}: ${x.name} ${fmtT(t)}`, `New record! ${news[0]}: ${x.name} ${fmtT(t)}`), 3600); SFX.play('record'); }, x.hatching ? 3200 : 600);
}
