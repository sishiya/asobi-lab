// 果ての滝の箱庭の台本（edge-falls.html・edge-falls-guide.html・edge-falls-digest.html）で共通の部分。
// ゲームを iframe（srcdoc）で開き、ゲームの時計をこちらの時刻にする（requestAnimationFrame・setTimeout・performance.now を差しかえる）。
// ゲームのファイルは変えない。絵はゲームの canvas（#view）に、ゲームの画面の小物（手に持つもの・天の輪・お題・知らせ）を efDrawUI で写して重ねる。
//   efBot: 自動で遊ぶ（章ごとに、DEVNOTES「確認のしかた」と同じ手順: 湖のくぼみに泉 → ふちの出口を盛る → 水辺にたね → 草の多い所にシカ …）。
//          ゲームの道具の関数 useTool をそのまま使う（手に持つ・扇で選ぶ・大地を押す、と同じ道すじ）。
'use strict';
const EF = { w: null, vt: 0, log: [], acts: [], saves: {} };
// 開くゲーム。?game=out/game のように渡すと、そこにある edge-falls を開く（別の会話がゲームを書きかえている途中に、コミットずみの版で録るとき。
// 例: git archive HEAD edge-falls | tar -x -C _dev/promo/out/game）
const EF_SRC = (new URLSearchParams(location.search).get('game') || '../..') + '/edge-falls/index.html';

// ゲームより先に動く差しかえ（inject.pre）。時計はこちらの __efAdv(ミリ秒) で進む
const EF_PRE = `
(() => {
  try { for (let k = localStorage.length - 1; k >= 0; k--) { const n = localStorage.key(k); if (n && n.startsWith('asobi-lab/edge-falls/')) localStorage.removeItem(n); } } catch (e) {}
  try { localStorage.setItem('asobi-lab/edge-falls/sound', JSON.stringify({ bgm: false, sfx: false })); } catch (e) {}
  try { localStorage.setItem('manabi-lang', 'ja'); } catch (e) {}   // 動画は日本語で録る（英語は字幕。v019 でゲームが英語に切りかわるようになった。録る Chrome の言語は英語のことがある）
  let vt = 1000, seq = 0; const timers = new Map(); let raf = [];
  performance.now = () => vt;
  window.requestAnimationFrame = cb => { raf.push(cb); return raf.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms, ...a) => { const id = ++seq; timers.set(id, { at: vt + (+ms || 0), fn, a }); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.__efErrors = [];
  window.addEventListener('error', e => window.__efErrors.push(String(e.message || e)));
  window.addEventListener('unhandledrejection', e => window.__efErrors.push('promise: ' + String(e.reason && e.reason.message || e.reason)));
  // ms だけ進めて、来たタイマーを動かし、requestAnimationFrame を1回呼ぶ（1コマ）
  window.__efAdv = ms => {
    vt += ms;
    for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (t.at <= vt) { timers.delete(id); try { t.fn(...t.a); } catch (e) { window.__efErrors.push(String(e && e.stack || e)); } }
    const q = raf; raf = [];
    for (const cb of q) { try { cb(vt); } catch (e) { window.__efErrors.push(String(e && e.stack || e)); } }
  };
})();`;

const efGet = (w, name) => { try { return w.eval(name); } catch (e) { return undefined; } };
const efReady = w => !!(w && w.__ef && w.__efAdv && w.useTool && w.document.getElementById('view'));
// 1コマ（1/30 秒）進める。sim: そのコマのあいだに足して進めるゲームの秒（×16 より速く見せるとき）
function efFrame(w, sim = 0) {
  const G = w.__ef.G;
  if (sim > 0 && G.started && !efGet(w, 'COL')) { let s = sim; while (s > 1e-6) { const h = Math.min(1, s); s -= h; w.__ef.step(h); } }
  w.__efAdv(1000 / 30);
}

// ---- 自動で遊ぶ ----
// 大地の座標（区画）→ 画面の点（css の画素）
function efScreen(w, x, y) { const z = w.heightAt(x, y, true); const p = w.proj(x, y, z); return { x: p.x, y: p.y }; }
// 手に持って、大地の点を押す（ゲームの useTool をそのまま）。押した所は EF.acts に残す（絵で印を出す）
function efUse(w, hand, sub, x, y, label) {
  const G = w.__ef.G;
  if (G.hand !== hand) w.setHand(hand);
  if (sub && G.sub[hand] !== sub) { G.sub[hand] = sub; w.setHand(hand); }
  w.useTool({ x, y, z: w.heightAt(x, y, true) }, true);
  EF.acts.push({ vt: EF.vt, x, y, hand, sub, label });
  if (EF.acts.length > 60) EF.acts.shift();
}
const efPick = (w, test, n) => {   // 条件に合う区画を n こ（ばらばらに）
  const INS = efGet(w, 'INS'), N = efGet(w, 'N'), c = INS.filter(test), out = [];
  for (let k = 0; k < n && c.length; k++) { const i = c.splice((Math.random() * c.length) | 0, 1)[0]; out.push({ x: i % N, y: i / N | 0 }); }
  return out;
};
const BOT = { cool: 0, ch: -1, n: 0 };
// ゲームの時間で 0.5 秒ごとに考える。章が変わったら、その章のはじめの手を打つ
function efBot(w) {
  const { W, L, G } = w.__ef;
  if (!G.started || efGet(w, 'COL') || G.ch % 1 || G.ch >= 10) return;
  if (W.t < BOT.cool) return;
  BOT.cool = W.t + 0.5;
  const C = efGet(w, 'C'), RD = efGet(w, 'RD'), N = efGet(w, 'N'), edgeBin = efGet(w, 'edgeBin');
  const key = efGet(w, 'CHAPTERS')[G.ch].key, fresh = BOT.ch !== G.ch;
  if (fresh) { BOT.ch = G.ch; BOT.n = 0; BOT.chT = W.t; }
  const since = W.t - BOT.chT;
  const rel = (kind, test, n, label) => { for (const p of efPick(w, test, n)) if (W.stock[kind] > 0) efUse(w, 'life', kind, p.x + 0.5, p.y + 0.5, label); };
  const lakeP = f => ({ x: C + W.lake.x * RD * f, y: C + W.lake.y * RD * f });
  if (key === 'water') {
    // 泉2つ。2.5 区画より近いと、前の泉を押して止めてしまう（ゲームのきまり）ので離す
    if (BOT.n < 2 && since > 1.5 + BOT.n * 3) { const p = lakeP([0.85, 0.55][BOT.n]); efUse(w, 'water', null, p.x, p.y, '泉をわかせる'); BOT.n++; }
  } else if (key === 'soil') {
    if (since < 2) return;
    // 水が落ちていくふちの出口を盛る。土が足りなければ、湖から遠い高い所を削る
    if (W.soil < 12) {
      const hi = efPick(w, i => W.g[i] > 7 && W.w[i] < 0.05 && Math.hypot((i % N - C) / RD - W.lake.x, ((i / N | 0) - C) / RD - W.lake.y) > 0.5, 1)[0];
      if (hi) efUse(w, 'soil', 'dig', hi.x, hi.y, '土をけずる');
    } else {
      const INS = efGet(w, 'INS'), e = INS.filter(i => edgeBin[i] >= 0 && W.w[i] > 0.05).sort((a, b) => W.w[b] - W.w[a]);
      if (e.length) { const i = e[0]; efUse(w, 'soil', 'raise', i % N, i / N | 0, '土を盛る'); }
    }
    if (since > 40 && W.springs.length < 3 && !BOT.extra) { BOT.extra = 1; const p = lakeP(1.05); efUse(w, 'water', null, p.x, p.y, '泉をわかせる'); }
  } else if (key === 'grass') {
    if (since > 1.5 && (BOT.n === 0 || (since > BOT.n * 30 && BOT.n < 10))) {
      BOT.n++;
      for (const p of efPick(w, i => W.moist[i] > 0.6 && W.w[i] < 0.2 && W.veg[i] < 0.2, 7)) efUse(w, 'life', 'seed', p.x, p.y, 'たねをまく');
    }
  } else if (key === 'deer' || key === 'winter' || key === 'wolf' || key === 'fish' || key === 'bird' || key === 'genes' || key === 'cycle') {
    if (since < 1.5) return;
    const grassy = i => W.veg[i] > 0.5 && W.w[i] < 0.1;
    const deep = i => W.w[i] > 0.9 && !W.ice[i];
    const shallow = i => W.w[i] > 0.1 && W.w[i] < 0.7 && !W.ice[i];
    // シカ: 章のはじめと、少ないとき
    if ((key === 'deer' && W.stock.deer > 0) || (L.counts.deer < 10 && W.stock.deer > 0)) rel('deer', grassy, 2, 'シカを放す');
    if (key !== 'deer' && key !== 'winter') {
      const wolfOk = L.counts.deer >= 14 || key === 'wolf' && L.counts.deer >= 10;
      if (G.unlock.wolf && L.counts.wolf < 3 && W.stock.wolf > 0 && wolfOk) {
        const d = L.list.filter(a => a.kind === 'deer'); if (d.length) { const a = d[(Math.random() * d.length) | 0]; efUse(w, 'life', 'wolf', a.x + 2, a.y + 2, 'オオカミを放す'); }
      }
      if (G.unlock.fish && L.counts.fish < 20 && W.stock.fish > 0) rel('fish', deep, 2, 'サカナを放す');
      if (G.unlock.bird && L.counts.bird < 3 && W.stock.bird > 0 && L.counts.fish >= 15) rel('bird', shallow, 1, 'サギを放す');
    }
  }
  if (G.hand && W.t - (BOT.lastHand || 0) > 3) { /* 手は持ったまま（見せるため） */ }
}

// ---- ゲームの画面の小物を写す ----
// 世界（#view）は台本が描く。ここでは #field の中の、見えている canvas・img・文字・色つきの箱・お題の帯などを、
// 画面での位置（getBoundingClientRect）のとおりに描く。k: css の画素 → 描く座標の倍率
const EF_GLOW = ['quest', 'dial', 'line', 'toast', 'hand', 'bookbtn', 'menubtn'];
function efDrawUI(g, w, k, opt = {}) {
  const d = w.document, field = d.getElementById('field'), skip = new Set(opt.skip || []);
  const op = el => { let o = 1; for (let e = el; e && e !== d.body; e = e.parentElement) { const cs = w.getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || e.hidden) return 0; o *= +cs.opacity; } return o; };
  g.save(); g.textBaseline = 'middle'; g.textAlign = 'center'; g.shadowBlur = 0;
  const walk = el => {
    if (el.id === 'view' || skip.has(el.id) || el.hidden) return;
    if (el.id === 'book' || el.id === 'card') return;
    const a = op(el); if (a <= 0.01) return;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
    const cs = w.getComputedStyle(el), cls = el.classList;
    // うしろのぼかしの帯（::before の放射グラデーション）。見えている小物のまわりを暗く
    if (EF_GLOW.some(c => cls.contains(c) || el.id === c)) {
      const isHand = cls.contains('hand') || cls.contains('bookbtn') || cls.contains('menubtn');
      const pad = isHand ? 0 : cls.contains('line') ? 40 : 30, cx = (r.left + r.width / 2) * k, cy = (r.top + r.height / 2) * k;
      const rx = (r.width / 2 + pad + (cls.contains('quest') ? 40 : 0)) * k, ry = (r.height / 2 + pad * 0.6) * k;
      g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(6,8,16,${isHand ? 0.6 : 0.72})`); gr.addColorStop(0.62, 'rgba(6,8,16,0.38)'); gr.addColorStop(1, 'rgba(6,8,16,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    const clear = c => !c || c === 'transparent' || /rgba\(.*, 0\)$/.test(c);
    if (cls.contains('panel') && clear(cs.backgroundColor)) {   // 世界になじむ札（メニュー・セーブ。放射グラデーション）: 深淵の色の箱
      if (!cls.contains('titlecard')) {   // はじめの画面は箱を出さない（ゲームと同じ）
        g.save(); g.globalAlpha = a * 0.9; g.fillStyle = 'rgb(12,15,28)'; rr(g, r.left * k, r.top * k, r.width * k, r.height * k, 16 * k); g.fill();
        g.globalAlpha = a * 0.3; g.strokeStyle = 'rgb(239,227,196)'; g.lineWidth = k; g.stroke(); g.restore();
      }
    }
    // 色つきの箱（お題の線・土と水の線・ボタンのふち）
    const bg = cs.backgroundColor;
    if (!clear(bg) && !cls.contains('hand') && !cls.contains('menubtn') && !cls.contains('bookbtn')) {
      g.save(); g.globalAlpha = a; g.fillStyle = bg; rr(g, r.left * k, r.top * k, r.width * k, r.height * k, (parseFloat(cs.borderTopLeftRadius) || 0) * k); g.fill(); g.restore();
    }
    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (bw > 0 && cs.borderTopStyle !== 'none' && !/rgba\(.*, 0\)$/.test(cs.borderTopColor)) {
      g.save(); g.globalAlpha = a; g.strokeStyle = cs.borderTopColor; g.lineWidth = bw * k; rr(g, r.left * k, r.top * k, r.width * k, r.height * k, (parseFloat(cs.borderTopLeftRadius) || 0) * k); g.stroke(); g.restore();
    }
    if (el.tagName === 'CANVAS' || el.tagName === 'IMG') {
      if (el.tagName === 'IMG' && !el.complete) return;
      g.save(); g.globalAlpha = a; g.imageSmoothingEnabled = cs.imageRendering !== 'pixelated';
      if (cls.length === 0 && el.closest('.dialbtn')) { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6 * k; g.shadowOffsetY = 2 * k; }
      try { g.drawImage(el, r.left * k, r.top * k, r.width * k, r.height * k); } catch (e) { /* 描けないものは飛ばす */ }
      g.restore(); return;
    }
    // 文字: 1字ずつ、画面での位置に（字間・折り返しもそのまま）
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.data.trim()) continue;
      g.save(); g.globalAlpha = a; g.fillStyle = cs.color;
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
      g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 4 * k; g.shadowOffsetY = 1 * k;
      const rg = d.createRange();
      for (let i = 0; i < n.data.length; i++) {
        const ch = n.data[i]; if (!ch.trim()) continue;
        rg.setStart(n, i); rg.setEnd(n, i + 1); const b = rg.getBoundingClientRect(); if (!b.width) continue;
        const ls = parseFloat(cs.letterSpacing) || 0;
        g.fillText(ch, (b.left + (b.width - ls) / 2) * k, (b.top + b.height / 2) * k);
      }
      g.restore();
    }
    for (const c of el.children) walk(c);
  };
  for (const c of field.children) walk(c);
  g.restore();
}
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// 押した所の印（自動で遊んだ手。digest 用）: 光る輪がひろがる
function efDrawActs(g, w, k, life = 1.2) {
  for (const a of EF.acts) {
    const age = (EF.vt - a.vt) / 1000; if (age < 0 || age > life) continue;
    const p = efScreen(w, a.x, a.y), s = age / life;
    g.save(); g.globalAlpha = 1 - s; g.strokeStyle = '#ffd27a'; g.lineWidth = 3 * k;
    g.beginPath(); g.arc(p.x * k, p.y * k, (6 + 26 * s) * k, 0, Math.PI * 2); g.stroke(); g.restore();
  }
}

// ゲームのセーブ（encodeWorld）を out/edge-falls-saves/<名前>.json に（台本の場面の始まりに使う）
async function efSaveTo(w, name) {
  const rec = await w.encodeWorld();
  EF.saves[name] = rec;
  try { await fetch(`out/edge-falls-save-${name}.json`, { method: 'PUT', body: JSON.stringify(rec) }); } catch (e) { /* 保存できなくても続ける */ }
}
async function efLoadSave(name) { return EF.saves[name] || (EF.saves[name] = await (await fetch(`out/edge-falls-save-${name}.json`)).json()); }

// ---- 場面（紹介動画）----
// SC = [{ a, b, save: 'ch3' | null（新しい岩と土の大地）, seed, title: true（はじめの画面のまま）, speed: ×（ゲームの速さの札。絵の動きの速さ）,
//         rate(lt) → 1秒あたりに進めるゲームの秒（省くと speed）, view(V, lt, w) → 見え方, ev: [{ t: 場面の中の秒, run(w) }], pre(w) }]
// renderAt は 1コマずつ順に呼ばれる。場面が変わったとき・時刻が戻ったとき（確かめ用のコマ）は、場面のはじめからやり直す
const SCR = { k: -1, t: 0 };
async function efEnter(w, s) {
  const E = w.__ef, d = w.document;
  if (efGet(w, 'COL')) w.endCollapse();
  d.getElementById('overlay').hidden = true;
  if (s.save) { await w.loadRecord(await efLoadSave(s.save)); E.G.started = true; }
  else { E.newGame(s.seed || 3); E.G.started = !s.title; if (!s.title) w.enterChapter(0, true); }
  if (s.title) { try { for (const k of ['auto', 'story', 'free']) w.localStorage.removeItem('asobi-lab/edge-falls/save/' + k); } catch (e) { /* なし */ } /* v067 から世界の置き場所は story・free */ E.G.started = false; w.start(); }   // 前の場面の自動セーブで「つづきから」が出ないように
  else d.body.classList.remove('titling');
  for (const id of ['toast', 'line']) d.getElementById(id).classList.remove('on');
  w.closeBook && w.closeBook();
  E.setHand(null); E.G.sel = null; w.updateCard && w.updateCard();
  E.setSpeed(s.title ? 1 : (s.speed ?? 4));
  E.V.panX = E.V.panY = 0;
  if (s.pre) await s.pre(w);
  BOT.ch = -1; BOT.cool = 0; EF.acts.length = 0;
  for (let i = 0; i < 3; i++) w.__efAdv(1000 / 30);
}
async function efScenes(w, SC, t) {
  let k = SC.findIndex(s => t >= s.a && t < s.b); if (k < 0) k = SC.length - 1;
  const s = SC[k];
  if (SCR.k !== k || t < SCR.t - 1e-6) { await efEnter(w, s); SCR.k = k; SCR.t = s.a; s.done = new Set(); }
  while (SCR.t <= t + 1e-6) {
    const lt = SCR.t - s.a, E = w.__ef;
    EF.vt = w.performance.now();
    for (const [i, e] of (s.ev || []).entries()) if (!s.done.has(i) && lt >= e.t) { s.done.add(i); e.run(w); }
    if (s.view) { s.view(E.V, lt, w); w.layout(E.V.cw, E.V.ch); }
    if (s.bot) efBot(w);
    const spd = E.G.speed || 0, r = s.rate ? s.rate(lt) : spd;
    efFrame(w, Math.max(0, (r - spd) / 30));
    SCR.t += 1 / 30;
  }
}
// 手に持つものの札（DOM）の、画面での中心（css の画素）
function efHandPos(w, sel) { const e = w.document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
