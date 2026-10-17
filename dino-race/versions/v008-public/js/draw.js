// 絵: 図鑑の骨格図ふう。クリーム色の紙に、骨をインクの線で描く。
// 色は CSS の変数（--paper など）から読む。物理の体の位置と向きから、骨の絵を体ごとの座標で描く。

const INK = {};
function readInk() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['paper', 'paper-line', 'ink', 'ink-soft', 'bone', 'accent', 'muted', 'line']) INK[k] = cs.getPropertyValue('--' + k).trim();
}

// 体の座標 → 画面: ctx をその体の位置・向きに合わせる
function withBody(ctx, b, fn) {
  const p = b.getPosition();
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle()); fn(); ctx.restore();
}

// 骨1本（両端がふくらんだ形）。x0→x1 は体の座標の長さの向き
let SHADE = 0; // 0 より大きいとき（カードの絵）、骨の下側に細いハッチの陰をつける（値は線の間隔、体の座標で）
function bone(ctx, x0, x1, w) {
  const r = w * 0.5, s = w * 0.28;
  ctx.beginPath();
  ctx.moveTo(x0 + r * 0.6, -s); ctx.lineTo(x1 - r * 0.6, -s);
  ctx.arc(x1, 0, r, -Math.PI * 0.75, Math.PI * 0.75);
  ctx.lineTo(x0 + r * 0.6, s);
  ctx.arc(x0, 0, r, Math.PI * 0.25, Math.PI * 1.75);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (SHADE && w > SHADE * 2.2) shadeBelow(ctx, x0 - r, x1 + r, w); // 細い骨はつぶれて真っ黒に見えるので陰をつけない
}

// 骨の形（いまのパス）の中の、画面で下になる側にだけ斜めの細い線
function shadeBelow(ctx, a, b, w) {
  if (a > b) [a, b] = [b, a];
  const down = ctx.getTransform().d > 0 ? 1 : -1, lw = ctx.lineWidth;
  ctx.save(); ctx.clip();
  ctx.lineWidth = lw * 0.4; ctx.strokeStyle = rgba(INK.ink, 0.45); ctx.beginPath();
  for (let x = a; x < b + w; x += SHADE) { ctx.moveTo(x, down * w * 0.08); ctx.lineTo(x - w * 0.35, down * w * 0.6); }
  ctx.stroke(); ctx.restore();
}

function vertebrae(ctx, x0, x1, h0, h1, n, spine = true, chevron = false) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, h = h0 + (h1 - h0) * t, w = Math.abs(x1 - x0) / n * 0.78;
    ctx.beginPath(); ctx.rect(x - w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
    if (spine) { ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x - w * 0.25, h * 1.5); ctx.stroke(); }
    if (chevron) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x - w * 0.3, -h * 1.4); ctx.stroke(); }
  }
}

function drawLeg(ctx, d, leg, far) {
  const th = d.p.thick;
  ctx.globalAlpha = far ? 0.42 : 1;
  withBody(ctx, leg.fem, () => bone(ctx, -leg.fem.len / 2, leg.fem.len / 2, th.fem));
  withBody(ctx, leg.tib, () => bone(ctx, -leg.tib.len / 2, leg.tib.len / 2, th.tib * 1.2));
  withBody(ctx, leg.meta, () => bone(ctx, -leg.meta.len / 2, leg.meta.len / 2, th.meta * 1.1));
  withBody(ctx, leg.foot, () => { // 指: 3つの節と爪
    const L = leg.foot.len, w = th.toe;
    for (let i = 0; i < 3; i++) { const a = -L / 2 + L * i / 3, b = a + L / 3; bone(ctx, a + w * 0.15, b - w * 0.15, w * (1 - i * 0.15)); }
    ctx.beginPath(); ctx.moveTo(L / 2, w * 0.2); ctx.quadraticCurveTo(L / 2 + w * 0.9, w * 0.1, L / 2 + w * 0.6, -w * 0.6); ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawTorso(ctx, d) {
  const p = d.p, tl = p.tl, th = p.th;
  withBody(ctx, d.torso, () => {
    // 肉付きの輪郭（点線）
    ctx.save(); ctx.setLineDash([th * 0.06, th * 0.06]); ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(0, 0, tl * 0.52, th * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const hip = [-0.25 * tl, -0.15 * th];
    // 背骨
    vertebrae(ctx, -0.5 * tl, 0.48 * tl, th * 0.09, th * 0.08, 11);
    // 肋骨
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const x = -0.05 * tl + i * 0.065 * tl, len = th * (0.7 - Math.abs(i - 3) * 0.06);
      ctx.moveTo(x, th * 0.05); ctx.quadraticCurveTo(x + tl * 0.05, th * 0.05 - len * 0.6, x - tl * 0.02, th * 0.05 - len);
    }
    ctx.stroke();
    // 腹肋骨
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const x = 0.0 * tl + i * 0.07 * tl; ctx.moveTo(x, -th * 0.42); ctx.lineTo(x + tl * 0.05, -th * 0.38); }
    ctx.stroke();
    // 骨盤: 腸骨（上の板）・恥骨（前下）・坐骨（後下）
    ctx.beginPath(); ctx.ellipse(hip[0], hip[1] + th * 0.22, tl * 0.2, th * 0.14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hip[0] + tl * 0.02, hip[1]); ctx.lineTo(hip[0] + tl * 0.08, hip[1] - th * 0.42); ctx.lineTo(hip[0] + tl * 0.16, hip[1] - th * 0.46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hip[0] - tl * 0.02, hip[1]); ctx.lineTo(hip[0] - tl * 0.14, hip[1] - th * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(hip[0], hip[1], th * 0.07, 0, Math.PI * 2); ctx.stroke();
    // 肩と小さな腕
    const sh = [0.40 * tl, 0.1 * th];
    ctx.beginPath(); ctx.moveTo(sh[0] - tl * 0.08, sh[1] + th * 0.12); ctx.lineTo(sh[0] + tl * 0.02, sh[1] - th * 0.2); ctx.stroke();
    ctx.save(); ctx.translate(sh[0] + tl * 0.02, sh[1] - th * 0.2); ctx.rotate(-1.2);
    const arm = p.L * 0.22; bone(ctx, 0, arm * 0.55, th * 0.05); ctx.translate(arm * 0.55, 0); ctx.rotate(1.0); bone(ctx, 0, arm * 0.45, th * 0.045);
    ctx.restore();
  });
}

function drawNeckHead(ctx, d) {
  const p = d.p, nl = d.neck.len;
  withBody(ctx, d.neck, () => {
    vertebrae(ctx, -nl / 2, nl / 2, p.thick.neck * 0.45, p.thick.neck * 0.35, 6, true);
    const h = d.headLocal, hl = p.head, hh = p.thick.head;
    ctx.save(); ctx.translate(h.c.x, h.c.y); ctx.rotate(h.a);
    // 頭骨: 横から見た形、目の穴と前眼窩窓、下あご、歯
    const x0 = -hl / 2, x1 = hl / 2;
    ctx.beginPath();
    ctx.moveTo(x0, hh * 0.15); ctx.quadraticCurveTo(x0 + hl * 0.25, hh * 0.62, x0 + hl * 0.55, hh * 0.45);
    ctx.quadraticCurveTo(x1 - hl * 0.05, hh * 0.3, x1, hh * 0.02); ctx.lineTo(x1, -hh * 0.12);
    ctx.lineTo(x0 + hl * 0.2, -hh * 0.2); ctx.lineTo(x0, -hh * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0 + hl * 0.24, hh * 0.18, hh * 0.13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x0 + hl * 0.5, hh * 0.12, hl * 0.12, hh * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + hl * 0.12, -hh * 0.18); ctx.quadraticCurveTo(x0 + hl * 0.5, -hh * 0.5, x1 - hl * 0.04, -hh * 0.28); ctx.lineTo(x1 - hl * 0.04, -hh * 0.16); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const x = x0 + hl * (0.45 + i * 0.075); ctx.moveTo(x, -hh * 0.13); ctx.lineTo(x + hl * 0.01, -hh * 0.24); } ctx.stroke();
    ctx.restore();
  });
}

function drawTail(ctx, d) {
  const th = d.p.thick;
  withBody(ctx, d.t1, () => vertebrae(ctx, d.t1.len / 2, -d.t1.len / 2, th.t1 * 0.3, th.t1 * 0.22, 7, true, true));
  withBody(ctx, d.t2, () => vertebrae(ctx, d.t2.len / 2, -d.t2.len / 2, th.t1 * 0.22, th.t2 * 0.12, 12, false, true));
}

function drawDino(ctx, d, px, minPx = 1.1) {
  ctx.lineWidth = Math.max(px * minPx, d.p.L * 0.006);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = INK.ink; ctx.fillStyle = INK.bone;
  const far = d.legs[1], near = d.legs[0];
  drawLeg(ctx, d, far, true);
  drawTail(ctx, d);
  drawTorso(ctx, d);
  drawNeckHead(ctx, d);
  drawLeg(ctx, d, near, false);
}

// 目盛りの間隔: 画面で min px 以上になるいちばん細かい値
const NICE = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const niceStep = (scale, minPx) => NICE.find(v => v * scale >= minPx) || 100;
const fmtLen = v => Math.abs(v) >= 1 || v === 0 ? v + 'm' : Math.round(v * 100) + 'cm';

// 地面（体の座標のまま描く）: 地面の線、目盛り、ゴールの測量ポール（poleH: ポールの高さ m）。地面の下の地層は drawStrata（画面の座標）
function drawGround(ctx, x0, x1, px, scale, poleH = px * 200) {
  ctx.strokeStyle = INK.ink; ctx.lineWidth = px * 1.5;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
  ctx.lineWidth = px;
  const minor = niceStep(scale, 10), major = niceStep(scale, 70);
  ctx.strokeStyle = INK.ink; ctx.beginPath();
  for (let m = Math.ceil(x0 / minor) * minor; m <= x1; m += minor) {
    const big = Math.abs(m / major - Math.round(m / major)) < 1e-6;
    ctx.moveTo(m, 0); ctx.lineTo(m, -px * (big ? 9 : 4));
  }
  ctx.stroke();
  if (FINISH >= x0 - px * 30 && FINISH <= x1 + px * 10) { // ゴール: 白黒のしまの測量ポールと小旗
    const w = px * 5, seg = px * 10, top = Math.max(px * 30, poleH - px * 26);
    ctx.save();
    for (let y = 0, k = 0; y < top; y += seg, k++) { ctx.fillStyle = k % 2 ? INK.bone : INK.ink; ctx.fillRect(FINISH - w / 2, y, w, Math.min(seg, top - y)); }
    ctx.strokeStyle = INK.ink; ctx.lineWidth = px; ctx.strokeRect(FINISH - w / 2, 0, w, top);
    ctx.fillStyle = INK.accent; ctx.beginPath();
    ctx.moveTo(FINISH + w / 2, top); ctx.lineTo(FINISH + w / 2 + px * 18, top - px * 6); ctx.lineTo(FINISH + w / 2, top - px * 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return major;
}

// ---------- 紙と背景（v004 演出） ----------
// 色の文字（#rrggbb・rgb()・rgba()）→ [r, g, b]
function rgbOf(c) {
  c = (c || '').trim();
  if (c[0] === '#') {
    let h = c.slice(1); if (h.length < 6) h = [...h.slice(0, 3)].map(x => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}
const rgba = (c, a) => { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; };
const isDarkPaper = () => { const [r, g, b] = rgbOf(INK.paper); return r + g + b < 330; };

// 種を決めた乱数（背景の形がいつも同じになるように）
function srng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// 背景の区間ごとの形（遠景・中景・近景）。作ったら覚えておく
const SEG = new Map();
function segment(layer, idx, make) {
  const k = layer * 1e6 + idx; let v = SEG.get(k);
  if (v === undefined) { if (SEG.size > 600) SEG.clear(); v = make(srng(idx * 7919 + layer * 104729 + 17)); SEG.set(k, v); }
  return v;
}

// 紙の地・細い横ハッチ・地層の模様（色か画面の倍率が変わったら作り直す。ふだんは1回だけ）
const TEX = {key: ''};
function textures(ctx) {
  const dpr = window.devicePixelRatio || 1, key = INK.ink + INK.paper + dpr;
  if (TEX.key === key) return TEX;
  TEX.key = key;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const fine = p => { try { p.setTransform(new DOMMatrix().scale(1 / dpr)); } catch (e) { /* 古いブラウザは少しぼやけるだけ */ } return p; };
  const dark = isDarkPaper(), [ir, ig, ib] = rgbOf(INK.ink);
  // 紙: 細かいざらつき・繊維・シミ
  const S = 320, pc = mk(S, S), g = pc.getContext('2d'), id = g.createImageData(S, S), rnd = srng(7);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = rnd(); id.data[i] = ir; id.data[i + 1] = ig; id.data[i + 2] = ib; id.data[i + 3] = v > 0.55 ? (v - 0.55) * (dark ? 20 : 30) : 0;
  }
  g.putImageData(id, 0, 0);
  g.strokeStyle = rgba(INK.ink, dark ? 0.045 : 0.06); g.lineWidth = 0.6;
  for (let i = 0; i < 80; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 6 + rnd() * 18;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < (dark ? 0 : 2); i++) { // シミ: 小さなにじみを重ねた形のそろわないもの。明るい紙だけ（暗い紙では泡のように見えるので）
    const x = 60 + rnd() * (S - 120), y = 60 + rnd() * (S - 120);
    for (let j = 0; j < 7; j++) {
      const bx = x + (rnd() - 0.5) * 40, by = y + (rnd() - 0.5) * 30, r = 8 + rnd() * 18, gr = g.createRadialGradient(bx, by, 0, bx, by, r);
      gr.addColorStop(0, rgba(INK.muted, 0.018)); gr.addColorStop(1, rgba(INK.muted, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
    }
  }
  TEX.paper = ctx.createPattern(pc, 'repeat');
  // 銅版画ふうの細い横ハッチ（1本 0.75 px、3 px おき）
  const hc = mk(Math.max(2, Math.round(4 * dpr)), Math.max(2, Math.round(3 * dpr))), hg = hc.getContext('2d');
  hg.fillStyle = INK.ink; hg.fillRect(0, 0, hc.width, Math.max(1, Math.round(0.75 * dpr)));
  TEX.hatch = fine(ctx.createPattern(hc, 'repeat'));
  // 地層: 点描の層・破線・まばらな点・斜線の層（幅 96、高さ 30）
  const sc = mk(Math.round(96 * dpr), Math.round(30 * dpr)), sg = sc.getContext('2d'), r2 = srng(11);
  sg.scale(sc.width / 96, sc.height / 30); sg.fillStyle = INK.ink; sg.strokeStyle = INK.ink;
  for (let i = 0; i < 170; i++) { sg.globalAlpha = 0.14 + r2() * 0.22; sg.fillRect(r2() * 96, 1.5 + Math.pow(r2(), 1.4) * 10.5, 0.9, 0.9); }
  sg.globalAlpha = 0.32; sg.lineWidth = 0.8; sg.setLineDash([5, 3]); sg.beginPath(); sg.moveTo(0, 13.5); sg.lineTo(96, 13.5); sg.stroke(); sg.setLineDash([]);
  for (let i = 0; i < 26; i++) { sg.globalAlpha = 0.12 + r2() * 0.15; sg.fillRect(r2() * 96, 15.5 + r2() * 7.5, 1.1, 1.1); }
  sg.globalAlpha = 0.26; sg.beginPath(); sg.moveTo(0, 24.5); sg.lineTo(96, 24.5);
  for (let x = -8; x < 104; x += 6) { sg.moveTo(x, 25); sg.lineTo(x - 5, 30); }
  sg.stroke();
  TEX.strata = fine(ctx.createPattern(sc, 'repeat'));
  return TEX;
}

// 四隅を少し暗く
function vignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, isDarkPaper() ? 'rgba(0,0,0,0.38)' : rgba(INK.muted, 0.17));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// 方眼（縦の線は off だけずらして、地面とともに流す）
function grid(ctx, y, W, h, off) {
  ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = INK['paper-line']; ctx.lineWidth = 1; ctx.beginPath();
  const o = ((off % 24) + 24) % 24;
  for (let x = -o; x < W; x += 24) { ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + h); }
  for (let gy = Math.ceil(y / 24) * 24; gy < y + h; gy += 24) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); }
  ctx.stroke(); ctx.restore();
}

// 遠景: 火山の稜線（x は遠景の px。高さは 0〜1 で、レーンの高さに合わせて描く）
const FAR_SEG = 700, MID_SEG = 420, NEAR_SEG = 260;
const volcano = k => segment(1, k, r => r() < 0.55 ? {c: k * FAR_SEG + 120 + r() * 460, w: 150 + r() * 130, h: 0.78 + r() * 0.2} : null);
function ridgeH(x) {
  let h = 0.36 + 0.09 * Math.sin(x / 190 + 1.3) + 0.06 * Math.sin(x / 83 + 0.4) + 0.03 * Math.sin(x / 29 + 2.1);
  const k = Math.floor(x / FAR_SEG);
  for (let j = k - 1; j <= k + 1; j++) {
    const v = volcano(j); if (!v) continue;
    const t = 1 - Math.abs(x - v.c) / v.w; if (t <= 0) continue;
    const hv = t > 0.88 ? v.h * Math.pow(0.88, 1.3) - (t - 0.88) * 0.25 : v.h * Math.pow(t, 1.3); // てっぺんは火口で少しへこむ
    h = Math.max(h, hv);
  }
  return h;
}
function drawFar(ctx, T, W, base, avail, off) {
  const k = avail * 0.82, path = close => {
    ctx.beginPath(); ctx.moveTo(0, base - ridgeH(off) * k);
    for (let x = 6; x <= W + 6; x += 6) ctx.lineTo(x, base - ridgeH(x + off) * k);
    if (close) { ctx.lineTo(W + 6, base); ctx.lineTo(0, base); ctx.closePath(); }
  };
  ctx.save();
  path(true); ctx.globalAlpha = 0.14; ctx.fillStyle = T.hatch; ctx.fill();
  ctx.globalAlpha = 1; path(false); ctx.strokeStyle = rgba(INK.ink, 0.22); ctx.lineWidth = 1; ctx.stroke();
  ctx.setLineDash([1.2, 2.6]); ctx.strokeStyle = rgba(INK.ink, 0.25); // 火山の煙（点線の丸）
  for (let j = Math.floor(off / FAR_SEG) - 1; j <= Math.floor((off + W) / FAR_SEG) + 1; j++) {
    const v = volcano(j); if (!v) continue;
    const cx = v.c - off; if (cx < -80 || cx > W + 80) continue;
    const cy = base - ridgeH(v.c) * k;
    for (let n = 0; n < 3; n++) { const r = avail * (0.05 + n * 0.03); ctx.beginPath(); ctx.arc(cx + n * r * 0.9, cy - r * (1.2 + n * 1.6), r, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

// 中景: ソテツとシダ
const plants = k => segment(2, k, r => {
  const a = [], n = 1 + Math.floor(r() * 2.6);
  for (let i = 0; i < n; i++) a.push({x: k * MID_SEG + (i + r() * 0.8) * MID_SEG / n, cycad: r() < 0.5, h: 0.42 + r() * 0.32, s: Math.floor(r() * 1e9)});
  return a;
});
// 葉1枚: 付け根から曲がる線と、左右の小葉
function frond(ctx, x, y, ang, len, droop, leaf) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len + droop, cx = x + Math.cos(ang) * len * 0.5, cy = y + Math.sin(ang) * len * 0.5 - droop * 0.2;
  ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, ex, ey);
  const m = Math.max(3, Math.min(8, Math.round(len / 6))); // 小葉の数（小さい葉は少なく。スマホで重くしない）
  for (let i = 1; i < m; i++) {
    const t = i / m, u = 1 - t, px = u * u * x + 2 * u * t * cx + t * t * ex, py = u * u * y + 2 * u * t * cy + t * t * ey;
    const tx = 2 * u * (cx - x) + 2 * t * (ex - cx), ty = 2 * u * (cy - y) + 2 * t * (ey - cy), tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl, l = leaf * (1 - t * 0.6);
    ctx.moveTo(px, py); ctx.lineTo(px + (-uy + ux * 0.6) * l, py + (ux + uy * 0.6) * l);
    ctx.moveTo(px, py); ctx.lineTo(px + (uy + ux * 0.6) * l, py + (-ux + uy * 0.6) * l);
  }
}
function cycad(ctx, T, x, base, h, seed) {
  const r = srng(seed), th = h * 0.5, w = h * 0.1, topY = base - th;
  ctx.beginPath(); ctx.moveTo(x - w * 0.6, base); ctx.lineTo(x - w * 0.45, topY); ctx.lineTo(x + w * 0.45, topY); ctx.lineTo(x + w * 0.6, base); ctx.closePath();
  ctx.globalAlpha = 0.8; ctx.fillStyle = INK.paper; ctx.fill();
  ctx.globalAlpha = 0.22; ctx.fillStyle = T.hatch; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(INK.ink, 0.3); ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath();
  for (let y = base - w * 0.5; y > topY + 2; y -= w * 0.55) { ctx.moveTo(x - w * 0.45, y); ctx.lineTo(x, y - w * 0.3); ctx.lineTo(x + w * 0.45, y); } // 幹のうろこ
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + 0.25 + (Math.PI - 0.5) * i / 6 + (r() - 0.5) * 0.15;
    frond(ctx, x, topY, a, h * (0.38 + r() * 0.12), h * 0.16 * Math.abs(Math.cos(a)), h * 0.06);
  }
  ctx.stroke();
}
function fern(ctx, x, base, h, seed) {
  const r = srng(seed), n = 5 + Math.floor(r() * 3);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + 0.35 + (Math.PI - 0.7) * i / (n - 1) + (r() - 0.5) * 0.2;
    frond(ctx, x + (r() - 0.5) * h * 0.1, base, a, h * (0.5 + r() * 0.35) * (1 - Math.abs(Math.cos(a)) * 0.35), h * 0.3 * Math.abs(Math.cos(a)), h * 0.05);
  }
  ctx.strokeStyle = rgba(INK.ink, 0.3); ctx.lineWidth = 1; ctx.stroke();
}
function drawMid(ctx, T, W, base, avail, off) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let j = Math.floor(off / MID_SEG) - 1; j <= Math.floor((off + W) / MID_SEG) + 1; j++)
    for (const p of plants(j)) {
      const x = p.x - off, h = p.h * avail; if (x < -h || x > W + h) continue;
      if (p.cycad) cycad(ctx, T, x, base, h, p.s); else fern(ctx, x, base, h, p.s);
    }
  ctx.restore();
}

// 近景: 地面ぎわの草と小石（地面と同じ速さ）
const tufts = k => segment(3, k, r => {
  const a = [], n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) a.push({x: k * NEAR_SEG + r() * NEAR_SEG, grass: r() < 0.6, s: 0.6 + r() * 0.6});
  return a;
});
function drawNear(ctx, W, base, avail, off) {
  const u = Math.min(1, avail / 90);
  ctx.save(); ctx.strokeStyle = rgba(INK.ink, 0.45); ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath();
  for (let j = Math.floor(off / NEAR_SEG) - 1; j <= Math.floor((off + W) / NEAR_SEG) + 1; j++)
    for (const t of tufts(j)) {
      const x = t.x - off; if (x < -20 || x > W + 20) continue;
      const sz = 9 * t.s * (0.6 + 0.4 * u);
      if (t.grass) for (let b = -2; b <= 2; b++) { ctx.moveTo(x + b * 1.5, base); ctx.quadraticCurveTo(x + b * 2.2, base - sz * 0.6, x + b * sz * 0.35, base - sz * (1 - Math.abs(b) * 0.18)); }
      else { ctx.moveTo(x + sz * 0.45, base - sz * 0.22); ctx.ellipse(x, base - sz * 0.22, sz * 0.45, sz * 0.24, 0, 0, Math.PI, true); }
    }
  ctx.stroke(); ctx.restore();
}

// 地面の下の地層（地面と同じ速さで流れる）
function drawStrata(ctx, T, W, base, off) {
  const o = ((off % 96) + 96) % 96;
  ctx.save(); ctx.translate(-o, base); ctx.fillStyle = T.strata; ctx.fillRect(0, 0, W + 96, 30); ctx.restore();
}

// 足あと: 地面のすぐ下に、上から見た三つ指のくぼみ（古いほど薄い）。tracks: [{x(m), len(m), leg}]
function drawTracks(ctx, tracks, cam, s, W, base) {
  const n = tracks.length; if (!n) return;
  ctx.save(); ctx.lineCap = 'round';
  tracks.forEach((p, i) => {
    const x = (p.x - cam.x) * s; if (x < -20 || x > W + 20) return;
    const L = Math.max(8, Math.min(16, p.len * s)), y = base + (p.leg ? 6 : 11), a = 0.2 + 0.65 * (i + 1) / n, hx = x - L * 0.3;
    // かかとと、はなれた3本の指のふくらみ（線でつなぐと矢印に見えるため、指ごとの楕円で）
    ctx.fillStyle = rgba(INK.ink, 0.7 * a); ctx.beginPath();
    ctx.ellipse(hx, y, L * 0.17, L * 0.15, 0, 0, Math.PI * 2);
    for (const th of [-0.6, 0, 0.6]) {
      const r = L * (th ? 0.5 : 0.56), cx = hx + Math.cos(th) * r, cy = y + Math.sin(th) * r, rx = L * (th ? 0.22 : 0.26);
      ctx.moveTo(cx + Math.cos(th) * rx, cy + Math.sin(th) * rx);
      ctx.ellipse(cx, cy, rx, Math.max(1.1, L * 0.1), th, 0, Math.PI * 2);
    }
    ctx.fill();
  });
  ctx.restore();
}

// 転んだときの土ぼこり（点描で広がって消える）。list: [{x(m), t0, parts:[{vx, vy, r, o, up}]}]（px）
const DUST_LIFE = 1.1;
function drawDust(ctx, list, cam, s, base, clock) {
  ctx.save(); ctx.fillStyle = INK.ink;
  for (const D of list) {
    const a = clock - D.t0; if (a < 0 || a > DUST_LIFE) continue;
    const x0 = (D.x - cam.x) * s, k = 1 - Math.exp(-a * 3.2), fade = Math.pow(1 - a / DUST_LIFE, 1.5);
    for (const p of D.parts) {
      ctx.globalAlpha = 0.55 * fade * p.o; ctx.beginPath();
      ctx.arc(x0 + p.vx * k, base - p.vy * k - a * 6 * p.up, p.r * (1 + a * 0.8), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// そのレーンだけ揺らす（転んだとき 0.25 秒、だんだん小さく）
function shakeOf(L, clock) {
  if (L.shake == null) return 0;
  const a = clock - L.shake; if (a < 0 || a > 0.25) return 0;
  return 5 * Math.pow(1 - a / 0.25, 2) * Math.sin(a * 75);
}

// 判子: 朱の二重枠の丸、少し傾けて、1.4 倍から 1 倍へ押す。st: {t0, small, big, foot, rot, seed}
function drawStamp(ctx, st, W, top, laneH, clock) {
  const a = clock - st.t0; if (a < 0) return;
  const k = Math.min(1, a / 0.16), sc = 1.4 - 0.4 * (1 - Math.pow(1 - k, 3)), R = Math.max(18, Math.min(44, laneH * 0.32));
  const cx = Math.min(W - R - 12, W * 0.8), cy = top + Math.max(R + 6, laneH * 0.46), f = FONT();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.rot); ctx.scale(sc, sc);
  ctx.globalAlpha = 0.9 * Math.min(1, a / 0.05); ctx.strokeStyle = ctx.fillStyle = INK.accent;
  ctx.lineWidth = R * 0.08; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = R * 0.035; ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(R * 0.24)}px ${f}`; ctx.fillText(st.small, 0, -R * 0.45);
  ctx.font = `800 ${Math.round(R * (st.big.length > 3 ? 0.4 : 0.5))}px ${f}`; ctx.fillText(st.big, 0, R * 0.04);
  if (st.foot) { ctx.font = `700 ${Math.round(R * 0.22)}px ${f}`; ctx.fillText(st.foot, 0, R * 0.47); }
  const r = srng(st.seed); ctx.fillStyle = INK.paper; // インクのかすれ
  for (let i = 0; i < 26; i++) {
    const ang = r() * Math.PI * 2, d = R * (0.3 + r() * 0.75);
    ctx.globalAlpha = 0.5 * r(); ctx.beginPath(); ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d, 0.5 + r() * 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 文字のまわりを紙の色でふちどる（背景の絵の上でも読めるように）
function haloText(ctx, text, x, y) {
  ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(INK.paper, 0.85); ctx.strokeText(text, x, y); ctx.restore();
  ctx.fillText(text, x, y);
}

const FONT = () => getComputedStyle(document.body).fontFamily;

// ゴースト（決まった速さで走る目安。人の世界記録など）がいまどこにいるか
const ghostAt = (gh, t) => Math.min(FINISH, FINISH * t / gh.t);

// 上の帯: 0〜100m のコースに、それぞれの恐竜の位置とゴースト
function drawProgress(ctx, R, W, h, ghosts = []) {
  const l = 28, r = W - 44, y = h / 2 + 2, X = m => l + (r - l) * Math.max(0, Math.min(1, m / FINISH));
  ctx.strokeStyle = INK['ink-soft']; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y); ctx.stroke();
  ctx.fillStyle = INK.muted; ctx.font = '11px ' + FONT(); ctx.textAlign = 'right'; ctx.fillText('0', l - 6, y + 4);
  ctx.textAlign = 'left'; ctx.fillStyle = INK.accent; ctx.fillText(FINISH + 'm', r + 6, y + 4);
  for (const gh of ghosts) { // ゴーストは線の上の小さな旗
    const x = X(ghostAt(gh, R.t));
    ctx.strokeStyle = INK.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 11); ctx.stroke();
    ctx.fillStyle = INK.accent; ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 8, y - 8); ctx.lineTo(x, y - 5); ctx.fill();
  }
  R.dinos.forEach((d, i) => {
    const x = X(d.finishT != null ? FINISH : d.dist);
    ctx.fillStyle = d.fell ? INK.paper : INK.ink; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = d.fell ? INK.ink : INK.paper; ctx.font = '700 10px ' + FONT(); ctx.textAlign = 'center'; ctx.fillText(i + 1, x, y + 3.5);
  });
}

// 場面全体: 上に進みぐあいの帯、その下にレーン。cams[i] = {x: 左端の m, scale: px/m}
// fx[i]（view.js の VIEW.fx）: {tracks 足あと, dust 土ぼこり, stamp 判子, shake 揺れの始まり}。clock はその時計（本当の時間の秒）
// title: タイトルの背景（1匹を大きく、地面は画面の下のほう。名前・物差し・目盛りの数字・ゴールの文字は出さない）
function drawScene(canvas, R, cams, {labels = [], progressH = 0, ghosts = [], fx = null, clock = 0, title = false} = {}) {
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr, dinos = R.dinos;
  if (!W || !H) return;
  const T = textures(ctx), f = FONT();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = T.paper; ctx.fillRect(0, 0, W, H); // 紙のざらつき・シミ
  vignette(ctx, W, H);
  if (progressH) { grid(ctx, 0, W, progressH, 0); drawProgress(ctx, R, W, progressH, ghosts); }
  const n = Math.max(1, dinos.length), laneH = (H - progressH) / n;
  dinos.forEach((d, i) => {
    const cam = cams[i]; if (!cam) return;
    const top = progressH + laneH * i, s = cam.scale, px = 1 / s, base = title ? Math.round(H * 0.9) : top + laneH - 30;
    const x0 = cam.x, x1 = cam.x + W / s, camPx = cam.x * s, L = fx && fx[i];
    if (i > 0 || progressH) { ctx.strokeStyle = INK.line || INK['ink-soft']; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(W, top + 0.5); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, laneH); ctx.clip();
    const sh = L ? shakeOf(L, clock) : 0, shy = sh * 0.35;
    if (sh) ctx.translate(sh, shy);
    // 背景: 画面の見た目で、遠景 0.1・中景 0.35・近景 1.0 の速さで流す（レーンの縮尺によらない）
    const avail = Math.max(16, base - top - 6);
    grid(ctx, top, W, laneH, camPx);
    drawFar(ctx, T, W, base, avail, camPx * 0.1);
    drawMid(ctx, T, W, base, avail, camPx * 0.35);
    drawStrata(ctx, T, W, base, camPx);
    drawNear(ctx, W, base, avail, camPx);
    if (L) drawTracks(ctx, L.tracks, cam, s, W, base);
    ctx.save();
    ctx.setTransform(dpr * s, 0, 0, -dpr * s, (-camPx + sh) * dpr, (base + shy) * dpr);
    const major = drawGround(ctx, x0 - 1, x1 + 1, px, s, (base - top) * px);
    drawDino(ctx, d, px);
    ctx.restore();
    if (L) drawDust(ctx, L.dust, cam, s, base, clock);
    ctx.restore();
    if (title) return;
    // 目盛りの数字・ゴール
    ctx.fillStyle = INK.muted; ctx.font = '11px ' + f; ctx.textAlign = 'center';
    for (let m = Math.ceil(x0 / major) * major; m <= x1; m += major) if (m >= -1e-9 && m <= FINISH) haloText(ctx, fmtLen(+m.toFixed(2)), (m - cam.x) * s, base + 22);
    if (FINISH >= x0 && FINISH <= x1) { ctx.fillStyle = INK.accent; ctx.font = '700 12px ' + f; haloText(ctx, TX('ゴール', 'Finish'), (FINISH - cam.x) * s, top + 16); }
    // ゴーストの線（このレーンの縮尺で、いまの位置に）
    for (const gh of ghosts) {
      const gx = (ghostAt(gh, R.t) - cam.x) * s; if (gx < 0 || gx > W) continue;
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = INK.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, top + 24); ctx.lineTo(gx, base); ctx.stroke(); ctx.restore();
      ctx.fillStyle = INK.accent; ctx.font = '11px ' + f; ctx.textAlign = 'center'; haloText(ctx, gh.short || gh.name, gx, top + 34);
    }
    // 名前と物差し（この縮尺で何 m か）
    ctx.textAlign = 'left'; ctx.fillStyle = INK.ink; ctx.font = '600 13px ' + f;
    const status = d.finishT != null ? TX(` ゴール ${fmtT(d.finishT)}`, ` Finished ${fmtT(d.finishT)}`) : d.fell ? TX(' 転んだ', ' Fell') : '';
    haloText(ctx, `${i + 1}. ${labels[i] || ''}${status}`, 10, top + 18);
    const bar = niceStep(s, 50), bx = 10, by = top + 30;
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by); ctx.lineTo(bx + bar * s, by); ctx.lineTo(bx + bar * s, by - 4); ctx.stroke();
    ctx.fillStyle = INK.muted; ctx.font = '11px ' + f; haloText(ctx, fmtLen(bar), bx + bar * s + 6, by + 3);
    if (L && L.stamp) drawStamp(ctx, L.stamp, W, top, laneH, clock);
  });
}

// 牧場のカードの小さな絵（立った姿勢。物理の世界を作って0秒のまま描く）
function drawPortrait(canvas, g) {
  const R = makeRace([g]), d = R.dinos[0];
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = textures(ctx).paper; ctx.fillRect(0, 0, W, H);
  const r = d.r, left = r.tailEnd[0], right = Math.max(r.headEnd[0], r.tip[0]), top = Math.max(r.neckEnd[1], r.headEnd[1]) + d.p.thick.head;
  const s = Math.min((W - 16) / (right - left), (H - 22) / top);
  const ox = (W - (right - left) * s) / 2 - left * s, base = H - 12;
  ctx.save(); ctx.setTransform(dpr * s, 0, 0, -dpr * s, ox * dpr, base * dpr);
  ctx.strokeStyle = INK['ink-soft']; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(left - 1, 0); ctx.lineTo(right + 1, 0); ctx.stroke();
  SHADE = 2.4 / s; // 骨の下側に細いハッチの陰（カードの絵だけ）
  try { drawDino(ctx, d, 1 / s, 1.4); } finally { SHADE = 0; }
  ctx.restore();
  return s;
}
