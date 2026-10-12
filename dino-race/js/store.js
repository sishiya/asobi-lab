// 保存（牧場・メダル・記録帳）、文字の形、しらせ（toast）、記録帳への記入。

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE_KEY = 'asobi-lab/dino-race/ranch-v1';    // 牧場・生まれた子（v001 の形に足していく）
const PROG_KEY = 'asobi-lab/dino-race/progress-v1'; // メダル・記録帳・あそびかたを見たか
const BASE_SLOTS = 8, MAX_RACE = 4; // 牧場の広さ（メダル1つで +1）。かけっこの長さ FINISH と打ち切り LIMIT は sim.js
const LINE = {trex: 'ティラノ', raptor: 'ラプトル', compy: 'コンピー'};

// ---------- 保存 ----------
let ranch = [], kids = [], serial = 1; // kids: 生まれた子（残すか決める前）
let prog = {medals: {}, best: null, classes: {}, born: 0, practiced: 0, evolved: 0, races: 0, maxGen: 0, tipDone: false};
let selected = []; // 選んだ順の id

function starter(sp) {
  return {id: 's-' + sp.id, name: sp.name, line: LINE[sp.id], g: {...sp.body, ...(sp.gait || baseGait()), from: sp.id}, rec: null, gen: 0, parents: []};
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
  if (!ranch.length) ranch = SPECIES.map(starter);
  for (const x of [...ranch, ...kids]) { x.practice = null; delete x.isNew; } // 練習の途中は保存しない
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
const fmtT = t => t.toFixed(2) + '秒';
function recText(rec, short = false) {
  if (!rec) return '記録をはかっています…';
  if (rec.finishT != null) return `100m <b>${fmtT(rec.finishT)}</b>${short ? '' : `（時速 ${kmh(FINISH / rec.finishT)}km）`}`;
  if (rec.fell) return `<b>${Math.max(0, rec.dist).toFixed(1)}m</b> で転んだ`;
  return `${LIMIT}秒で <b>${Math.max(0, rec.dist).toFixed(1)}m</b>`;
}
const recShort = rec => !rec ? '…' : rec.finishT != null ? fmtT(rec.finishT) : rec.fell ? `${Math.max(0, rec.dist).toFixed(0)}mで転倒` : `${Math.max(0, rec.dist).toFixed(0)}m`;

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
  if (!prog.best || t < prog.best.t) prog.best = entry;
  const c = classOf(M).id;
  if (!prog.classes[c] || t < prog.classes[c].t) prog.classes[c] = entry;
  saveProg();
}
