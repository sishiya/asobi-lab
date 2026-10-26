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

// ======== v2（2026-10-19）: あそびラボらしい予告編の部品 ========
// ユーザー「どうせならあそびラボならではで差別化してもいい」「まなびラボの中に姉妹サイトの紹介の形でだしたい」。
// ・本物のゲーム画面（_dev/promo/dino-race-shots.mjs で撮った out/dino-shots/*.png）をスマホの枠に入れて見せる
// ・ゲームと同じ足あと・ゴールの判子・転んだ土ぼこり（drawScene の fx）
// ・ミッションの札・大きな判子（WIN など）・「まなびラボの姉妹サイト」の札・ポンと出る字幕

// ゲームの足あと（view.js の trackFeet と同じ）・ゴールの判子・転んだ土ぼこり（view.js の listen と同じ形）
const drFx = R => R.dinos.map(() => ({ tracks: [], touch: [false, false], last: [null, null], dust: [], stamp: null, shake: null, goal: false, fell: false }));
function drTrack(R, fx) {
  R.dinos.forEach((d, i) => {
    const L = fx[i]; if (!L || d.fell || d.removed) return;
    d.legs.forEach((leg, j) => {
      let touch = false;
      for (let ce = leg.foot.getContactList(); ce; ce = ce.next) if (ce.contact.isTouching()) { touch = true; break; }
      if (touch && !L.touch[j]) {
        const x = leg.foot.getPosition().x;
        if (L.last[j] == null || Math.abs(x - L.last[j]) > leg.foot.len * 0.5) { L.tracks.push({ x, len: leg.foot.len, leg: j }); L.last[j] = x; if (L.tracks.length > 400) L.tracks.shift(); }
      }
      L.touch[j] = touch;
    });
  });
}
function drEvents(R, fx, clock) {
  R.dinos.forEach((d, i) => {
    const L = fx[i], rot = (i % 2 ? 1 : -1) * (0.08 + 0.06 * hash01(31, i)), seed = 1000 + i;
    if (d.finishT != null && !L.goal) { L.goal = true; L.goalAt = clock; L.stamp = { t0: clock + 0.04, small: 'ゴール', big: d.finishT.toFixed(2), foot: '秒', rot, seed }; }
    if (d.fell && !L.fell) {
      L.fell = true; L.fellAt = clock;
      const parts = [];
      for (let k = 0; k < 42; k++) { const side = hash01(7, k + i * 50) * 2 - 1; parts.push({ vx: side * 46 * (0.4 + 0.6 * hash01(8, k)), vy: hash01(9, k) * 46 * 0.45, r: 0.6 + 1.1 * hash01(10, k), o: 0.5 + 0.5 * hash01(11, k), up: hash01(12, k) }); }
      L.dust.push({ x: d.torso.getPosition().x, t0: clock, parts });
      if (d.finishT == null) { L.shake = clock; L.stamp = { t0: clock + 0.12, small: Math.max(0, d.dist).toFixed(1) + 'm', big: '転倒', foot: '', rot, seed }; }
    }
  });
}
// drRace / drRender の v2（足あと・判子つき）。clock は動画の時刻（判子の動きが動画の速さで出る）
function drRace2(key, genomes, simT) {
  const w = DR.w; let r = DR.races.get(key);
  if (!r || r.R.t > simT + 1e-9) { const R = w.makeRace(genomes); r = { R, fx: drFx(R) }; DR.races.set(key, r); }
  while (r.R.t < simT - 1e-9) { w.stepRace(r.R); drTrack(r.R, r.fx); }
  return r;
}
function drRender2(SC, t, cw, ch, cv = DR.cv) {
  const w = DR.w, s = drScAt(SC, t);
  const simT = Math.max(0, (t - s.a) * (s.speed || 1) + (s.from || 0));
  const r = drRace2(s.key, s.lanes.map(l => l[0]), simT), R = r.R;
  drEvents(R, r.fx, t);
  const progressH = s.lanes.length > 1 || s.ghosts ? 30 : 0;
  const ghosts = (s.ghosts || []).map(k => drGet(w, 'REFS')[k]);
  w.drawScene(cv, R, drCams(R, cw, ch, progressH), { labels: s.lanes.map(l => l[1]), progressH, ghosts, fx: r.fx, clock: t });
  return r;
}

// 本物のゲーム画面（out/dino-shots/<名前>.png。390×844 の3倍）
const SHOTS = {};
function drShots(names) {
  return Promise.all(names.map(n => new Promise((ok, ng) => {
    const im = new Image(); im.onload = () => { SHOTS[n] = im; ok(); };
    im.onerror = () => ng(new Error('画面の絵がない: out/dino-shots/' + n + '.png（node _dev/promo/dino-race-shots.mjs で撮る）'));
    im.src = 'out/dino-shots/' + n + '.png';
  })));
}
// スマホの枠。cx, cy: 真ん中、h: 画面の高さ、f: 0→1 で下からはねて出る。
// o.from: 前の画面（o.slide 0→1 で横にすべって替わる）、o.tilt: 傾き、o.tap = { x, y: 画面の 0〜1、u: 0〜1 }: 押した所の輪
function drPhone(g, cx, cy, h, f, img, o = {}) {
  if (f <= 0 || !img) return;
  const sw = h * 390 / 844, sh = h, wd = sw + h * 0.05, ht = h * 1.04, k = backOut(f);
  g.save(); g.shadowBlur = 0; g.globalAlpha = clamp(f * 3, 0, 1);
  g.translate(cx, cy + (1 - k) * PH * 0.2); g.rotate(o.tilt || 0); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40;
  g.fillStyle = '#0c0b0a'; g.beginPath(); g.roundRect(-wd / 2, -ht / 2, wd, ht, wd * 0.12); g.fill();
  g.shadowBlur = 0; g.strokeStyle = '#4a4134'; g.lineWidth = 3; g.stroke();
  g.save(); g.beginPath(); g.roundRect(-sw / 2, -sh / 2, sw, sh, sw * 0.09); g.clip();
  const sl = o.from && o.slide != null ? ease(o.slide) : 1;
  if (o.from && sl < 1) g.drawImage(o.from, -sw / 2 - sw * sl, -sh / 2, sw, sh);
  g.drawImage(img, -sw / 2 + sw * (1 - sl), -sh / 2, sw, sh);
  if (o.tap && o.tap.u > 0 && o.tap.u < 1) {
    const u = o.tap.u, tx = -sw / 2 + sw * o.tap.x, ty = -sh / 2 + sh * o.tap.y;
    g.strokeStyle = `rgba(255,214,120,${1 - u})`; g.lineWidth = 6; g.beginPath(); g.arc(tx, ty, h * 0.02 + h * 0.05 * u, 0, Math.PI * 2); g.stroke();
    g.fillStyle = `rgba(255,214,120,${0.55 * (1 - u)})`; g.beginPath(); g.arc(tx, ty, h * 0.02, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.restore();
}
// 大きな判子（WIN! など）。u = 動画の時刻 − 押す時刻。ドンと押されて少しゆれる。o.until: 消える時刻（u で）
function drBigStamp(g, u, x, y, big, small, o = {}) {
  if (u < 0) return;
  const fo = o.until != null ? clamp((o.until - u) / 0.3, 0, 1) : 1; if (fo <= 0) return;
  const k = u < 0.12 ? 2.2 - 1.2 * (u / 0.12) : 1 + 0.06 * Math.exp(-(u - 0.12) * 8) * Math.cos((u - 0.12) * 30);
  const size = o.size || 180, col = o.color || '#ff6b3d';
  g.save(); g.shadowBlur = 0; g.globalAlpha = fo * clamp(u / 0.06, 0, 1);
  g.translate(x, y); g.rotate(o.rot ?? -0.12); g.scale(k, k);
  setFont(g, size, true); const tw = g.measureText(big).width;
  setFont(g, size * 0.3, true); const smw = small ? g.measureText(small).width : 0;
  const bw = Math.max(tw, smw) + size * 0.6, bh = size * (small ? 1.6 : 1.2);
  g.fillStyle = 'rgba(20,14,10,0.6)'; g.strokeStyle = col; g.lineWidth = size * 0.07;
  g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, size * 0.18); g.fill(); g.stroke();
  g.lineWidth = size * 0.025; g.beginPath(); g.roundRect(-bw / 2 + size * 0.09, -bh / 2 + size * 0.09, bw - size * 0.18, bh - size * 0.18, size * 0.12); g.stroke();
  g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (small) { setFont(g, size * 0.3, true); g.fillText(small, 0, -bh / 2 + size * 0.38); }
  setFont(g, size, true); g.fillText(big, 0, small ? size * 0.22 : size * 0.04);
  g.restore();
}
// ミッションの札（上からはねておりる）。f: 0→1→0
function drMission(g, f, y, label, line1, line2) {
  if (f <= 0) return;
  const k = backOut(clamp(f * 1.4, 0, 1));
  g.save(); g.shadowBlur = 0; g.globalAlpha = clamp(f * 2, 0, 1);
  const bw = Math.min(PW - 80, 1300), bh = line2 ? 300 : 210, x = (PW - bw) / 2, yy = y - (1 - k) * 120;
  g.fillStyle = 'rgba(16,12,9,0.88)'; g.strokeStyle = '#f08a5a'; g.lineWidth = 5;
  g.beginPath(); g.roundRect(x, yy, bw, bh, 26); g.fill(); g.stroke();
  setFont(g, 36, true); const lw = g.measureText(label).width + 56;
  g.fillStyle = '#f08a5a'; g.beginPath(); g.roundRect(PW / 2 - lw / 2, yy - 28, lw, 56, 28); g.fill();
  g.fillStyle = '#1a120c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, PW / 2, yy + 1);
  g.fillStyle = '#fff'; setFont(g, 58, true); g.fillText(line1, PW / 2, yy + 100, bw - 60);
  if (line2) { g.fillStyle = '#ffd27a'; setFont(g, 76, true); g.fillText(line2, PW / 2, yy + 205, bw - 60); }
  g.restore();
}
// 「まなびラボの姉妹サイト」の札（左上のしし屋の目印の下に。a は目印の始まり）
function drSister(g, t, a, x = 48, y = 196) {
  // 左上の目印（drawIdentMini）のアイコンがはけるのといっしょに消す（2026-10-27 ユーザー「姉妹サイトだけがしばらくとどまり続けるのが気になる」。前は 5.4 秒まで）
  const u = t - a, f = ease((u - 0.7) / 0.4) * (1 - ease((u - 2.6) / 0.5)); if (f <= 0) return;
  g.save(); g.shadowBlur = 0; g.globalAlpha = f;
  setFont(g, 30, true); const s = 'まなびラボの姉妹サイト', w = g.measureText(s).width + 44;
  g.fillStyle = 'rgba(255,241,220,0.93)'; g.beginPath(); g.roundRect(x, y - 26, w, 52, 26); g.fill();
  g.fillStyle = '#2B3A55'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(s, x + 22, y + 1);
  g.restore();
}
// 字幕をポンと出す（止まった字より、はねて出るほうがゲームの予告らしい）。anchor: 'center' | 'top'
function drPopCaps(g, t, caps, y, anchor = 'center') {
  for (const c of caps) {
    const f = fade(t, c.a, c.b, 0.25); if (f <= 0) continue;
    const k = backOut(clamp((t - c.a) / 0.3, 0, 1));
    prep(g); g.save(); g.globalAlpha = f; g.translate(PW / 2, y); g.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); g.translate(-PW / 2, -y);
    drawBlock(g, [{ s: c.main, size: c.size || 66, color: c.color || '#fff', bold: true }, { s: c.sub, size: 38, color: '#f2c79a', gap: 10 }], y, anchor);
    g.restore();
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
}
// 締め（drawIdent）の URL の下に「しし屋 まなびラボの姉妹サイト」（drawIdent と同じ位置の計算）
function drSisterClose(g, t, a) {
  const b = t - a - 0.7, f = ease((b - 1.9) / 0.4); if (f <= 0 || t - a > IDENT_CLOSE) return;
  const K = Math.min(PW, PH) / 1080, V = isVert(), NH = 150 * K, D = 460 * K, GAP = 40 * K;
  setFont(g, NH, true); const TW = g.measureText(BRAND.name).width;
  const cx0 = PW / 2, cy0 = V ? PH * 0.42 : PH / 2 - 20 * K, ecx = V ? cx0 : cx0 - (GAP + TW) / 2;
  g.save(); g.shadowBlur = 0; g.globalAlpha = f; setFont(g, 38 * K, true); g.fillStyle = '#2B3A55'; g.textBaseline = 'middle';
  g.textAlign = V ? 'center' : 'left';
  g.fillText('しし屋 まなびラボの姉妹サイト', V ? cx0 : ecx + D / 2 + GAP + 4 * K, V ? cy0 + 480 * K : cy0 + 190 * K);
  g.restore();
}
