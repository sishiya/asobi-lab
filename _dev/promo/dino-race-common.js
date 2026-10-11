// 恐竜かけっこ牧場の台本（dino-race.html・dino-race-guide.html）で共通の部分。
// ゲームを iframe で開き、ゲームの物理（makeRace・stepRace）と絵（drawScene・drawPortrait）をそのまま使って、
// 場面ごとのかけっこを裏の canvas に描く。ゲームの画面（DOM）は使わない（カードや結果は promo.js の札で重ねる）。
// 恐竜の遺伝子は dino-genomes.json（2026-10-11 に dino-race/test.html で作った。値は丸めない。丸めると物理が変わる）:
//   kids: ラプトル × ティラノの子3匹（かけ合わせのシード 1。6.5m・7.5m・4.0m で転ぶ）
//   p1・p2・p3: kids[0] を練習させた1回目・2回目・3回目（39.4m で転ぶ → 転ばずに 85m → 100m 33.67秒）
//   fast: ラプトルどうしの子（シード 101 の1匹目。100m 8.83秒）
'use strict';
const DR = { w: null, G: null, cv: null, races: new Map(), por: new Map(), dpr: 4 };

async function drLoad() { DR.G = await (await fetch('dino-genomes.json')).json(); }
// ゲームの const（SPECIES・REFS など）は window に出ないので、iframe の中で名前を評価して取る
const drGet = (w, name) => { try { return w.eval(name); } catch (e) { return undefined; } };
const drReady = w => !!(DR.G && w && w.makeRace && w.drawScene && w.drawPortrait && w.readInk && drGet(w, 'REFS') && drGet(w, 'SPECIES'));

// はじめの3匹（ゲームと同じ遺伝子）
function drStarter(w, id) { const sp = drGet(w, 'SPECIES').find(s => s.id === id); return { ...sp.body, ...sp.gait, from: id }; }
const drM = (w, g) => w.bodyPlan(g).M;
const drMass = M => M >= 1000 ? (M / 1000).toFixed(1) + 't' : M >= 10 ? Math.round(M) + 'kg' : M.toFixed(1) + 'kg';

// 裏の canvas（css の大きさ cw×ch、devicePixelRatio = DR.dpr で描かせる。文字が動画で読める大きさになる）
function drCanvas(w, cw, ch) {
  const cv = w.document.createElement('canvas'); cv.width = cw * DR.dpr; cv.height = ch * DR.dpr;
  DR.cv = cv; DR.w = w;
  // 色はダークモードに決め打ち（見るブラウザの設定で、確かめたコマと録画の色が変わらないように）
  const st = w.document.createElement('style');
  st.textContent = ':root{--paper:#201b14;--paper-line:rgba(240,225,200,.06);--ink:#ece0cb;--ink-soft:rgba(236,224,203,.28);--bone:#2b241b;--accent:#f08a5a;--muted:#a8987f;--line:#3a3125}';
  w.document.head.append(st); w.readInk();
  return cv;
}

// かけっこを、その場面の時刻 simT まで進める（同じ場面が続くときは前のコマから続ける。戻ったら作り直す）
function drRace(key, genomes, simT) {
  const w = DR.w; let r = DR.races.get(key);
  if (!r || r.R.t > simT + 1e-9) { r = { R: w.makeRace(genomes) }; DR.races.set(key, r); }
  while (r.R.t < simT - 1e-9) w.stepRace(r.R);
  return r.R;
}
// レーンごとのカメラ（ゲームの updateCamera と同じ考え。追いかけは毎コマその場で決める）
function drCams(R, cw, ch, progressH) {
  const laneH = (ch - progressH) / R.dinos.length;
  return R.dinos.map(d => {
    const tall = Math.max(d.r.neckEnd[1], d.r.headEnd[1]) + d.p.thick.head, long = d.r.headEnd[0] - d.r.tailEnd[0];
    const scale = Math.min((laneH - 52) / (tall * 1.15), cw / (long * 2.4));
    return { scale, x: d.dist + d.x0 - (cw / scale) * 0.55 };
  });
}
// 場面の表 SC = [{ a, b, key, lanes: [[遺伝子, 名前], …], ghosts: ['human'], speed, from }] の、時刻 t の絵を描く
const drScAt = (SC, t) => SC.find(s => t < s.b) || SC[SC.length - 1];
function drRender(SC, t, cw, ch) {
  const w = DR.w, s = drScAt(SC, t);
  const simT = Math.max(0, (t - s.a) * (s.speed || 1) + (s.from || 0));
  const R = drRace(s.key, s.lanes.map(l => l[0]), simT);
  const progressH = s.lanes.length > 1 || s.ghosts ? 30 : 0;
  const ghosts = (s.ghosts || []).map(k => drGet(w, 'REFS')[k]);
  w.drawScene(DR.cv, R, drCams(R, cw, ch, progressH), { labels: s.lanes.map(l => l[1]), progressH, ghosts });
  return R;
}

// カードの絵（立った姿勢）。同じ遺伝子なら描きなおさない
function drPortrait(g, key, cw = 240, ch = 120) {
  let cv = DR.por.get(key);
  if (!cv) { cv = DR.w.document.createElement('canvas'); cv.width = cw * DR.dpr; cv.height = ch * DR.dpr; DR.w.drawPortrait(cv, g); DR.por.set(key, cv); }
  return cv;
}
// 恐竜のカード（ゲームのカードを写した札）: 絵・名前・行
function drCard(g, x, y, wd, img, name, lines, f, color) {
  if (f <= 0) return;
  const ih = wd / 2, h = 22 + ih + 54 + lines.length * 40;
  g.shadowBlur = 0; g.globalAlpha = f;
  g.fillStyle = 'rgba(14,16,24,0.9)'; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, y, wd, h, 16); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.roundRect(x + 12, y + 12, wd - 24, ih, 10); g.clip(); g.drawImage(img, x + 12, y + 12, wd - 24, ih); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'middle';
  setFont(g, 32, true); g.fillStyle = '#fff'; g.fillText(name, x + 20, y + 22 + ih + 26, wd - 40);
  lines.forEach((s, i) => { setFont(g, 27, true); g.fillStyle = (color && color[i]) || '#f2c79a'; g.fillText(s, x + 20, y + 22 + ih + 68 + i * 40, wd - 40); });
  g.globalAlpha = 1;
}

// 足あとから推定した速さ（ゲームの main.js と同じ Alexander 1976 の式）
function drAlexander(d) {
  const t = d.finishT, strides = t / d.T, lambda = 100 / strides;
  return { v: 0.25 * Math.sqrt(9.81) * Math.pow(lambda, 1.67) * Math.pow(d.hipY0, -1.17), lambda, h: d.hipY0 };
}
// 1匹を最後まで走らせた記録（setup で一度だけ）
function drResult(w, g) { const R = w.makeRace([g]); while (!w.raceOver(R)) w.stepRace(R); return R.dinos[0]; }
