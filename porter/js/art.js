// 絵: 切り絵の絵本（紙を重ねて、1枚ずつ影を落とす）。Canvas 2D
// 座標は「論理の単位」。main.js が S（論理→画面の倍率）をそろえる

export const A = { S: 1, t: 0 };   // S: 倍率（影のぼかしは画面の px なので掛ける）
const TAU = Math.PI * 2;

// ---------- 紙 ----------
export const INK = '#2b2118';
export const PAL = {
  paper: '#f4ead8', cream: '#fbf4e6',
  skin: '#f0c9a0', skinSick: '#cfd3a6', skinFlush: '#f2a98f', cheek: '#e88f78',
  cape: '#c8443a', capeDark: '#9e3129', tunic: '#3f6f8f', tunicDark: '#2e5670', steel: '#b9c0c4', steelDark: '#8a9397',
  trouser: '#5a4a3c', boot: '#6b4428',
  hood: '#e0a83a', hoodDark: '#b98420', jeans: '#4b6a9a', shoe: '#f7f3ea', pack: '#9b8a5e', packDark: '#76683f',
  fire1: '#ffd36b', fire2: '#ff9a3c', fire3: '#e5532f',
};

let shadowOn = true;
export function shadow(ctx, k = 1) {
  if (!shadowOn) return;
  ctx.shadowColor = 'rgba(46,28,10,0.30)';
  ctx.shadowBlur = 6 * k * A.S;
  ctx.shadowOffsetX = 1.2 * k * A.S;
  ctx.shadowOffsetY = 2.6 * k * A.S;
}
export function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
export function setShadows(on) { shadowOn = on; }

// 決まった乱れ（紙のふちのゆらぎ）
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// 紙のざらつき（1回だけ作る）
let grain = null;
export function grainPattern(ctx) {
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.25; g.strokeStyle = '#000'; g.lineWidth = 0.6;
  for (let i = 0; i < 90; i++) { // 紙の繊維
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * TAU, l = 6 + Math.random() * 16;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}
export function drawGrain(ctx, w, h) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); noShadow(ctx);
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.55;
  ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // ふちを少し暗く（絵本のページ）
  const r = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  r.addColorStop(0, 'rgba(60,30,10,0)'); r.addColorStop(1, 'rgba(60,30,10,0.22)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------- 空と遠景 ----------
const SKIES = {
  morning: ['#f6d9b5', '#f9ead2', '#e9efe2'],
  noon:    ['#bcd8e3', '#dfece8', '#f3eedf'],
  evening: ['#e3a07a', '#f0c49a', '#f6dfc0'],
  night:   ['#16203a', '#26324f', '#3b4361'],
};
const LANDS = [
  // 1日目 森: 遠い山・丘・森・地面
  { far: '#c9d3c3', mid: '#9fb38e', near: '#6f8f5c', trees: '#4f7448', ground: '#b9a679', grass: '#7b9a55', rocks: false, snow: false },
  // 2日目 岩場
  { far: '#d4cbbd', mid: '#b5a58c', near: '#8f7f66', trees: '#6c7a52', ground: '#c2ae86', grass: '#97945f', rocks: true, snow: false },
  // 3日目 峠
  { far: '#d9d3e3', mid: '#a9a3c1', near: '#7e7a9c', trees: '#4f5b6e', ground: '#cdbfa6', grass: '#8f9a7a', rocks: true, snow: true },
];

export function sky(ctx, W, H, kind) {
  const c = SKIES[kind] || SKIES.noon;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// くり返す山なみ（period ごとにつながる）
function ridge(ctx, scroll, W, base, amp, period, seed, color, k = 1, opts = {}) {
  const step = 14;
  const off = ((scroll % period) + period) % period;
  ctx.save(); shadow(ctx, k); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-20, base + 400);
  for (let x = -20; x <= W + 20; x += step) {
    const u = (x + off) / period * TAU;
    let y = base - amp * (0.55 * Math.sin(u * 1 + seed) + 0.3 * Math.sin(u * 3 + seed * 2) + 0.15 * Math.sin(u * 7 + seed * 3));
    y += (hash(Math.floor((x + off) / step) + seed * 99) - 0.5) * 2.2;
    if (opts.peaks) y -= Math.max(0, Math.sin(u * 2 + seed)) ** 6 * amp * 0.9;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 20, base + 400); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (opts.snow) { // 雪の帽子
    ctx.save(); ctx.fillStyle = '#f7f5fb'; ctx.beginPath();
    for (let x = -20; x <= W + 20; x += step) {
      const u = (x + off) / period * TAU;
      const pk = Math.max(0, Math.sin(u * 2 + seed)) ** 6;
      if (pk < 0.55) continue;
      const y = base - amp * (0.55 * Math.sin(u + seed) + 0.3 * Math.sin(u * 3 + seed * 2) + 0.15 * Math.sin(u * 7 + seed * 3)) - pk * amp * 0.9;
      ctx.moveTo(x - 10, y + 22); ctx.lineTo(x, y - 1); ctx.lineTo(x + 10, y + 22); ctx.lineTo(x, y + 16);
    }
    ctx.fill(); ctx.restore();
  }
}

function tree(ctx, x, y, h, color, kind) {
  ctx.fillStyle = color;
  if (kind === 0) { // とんがり
    ctx.beginPath(); ctx.moveTo(x, y - h);
    for (let i = 0; i < 3; i++) { const yy = y - h + (i + 1) * h * 0.3; const ww = h * (0.18 + i * 0.09); ctx.lineTo(x + ww, yy); ctx.lineTo(x + ww * 0.45, yy - h * 0.04); }
    ctx.lineTo(x + h * 0.05, y); ctx.lineTo(x - h * 0.05, y);
    for (let i = 2; i >= 0; i--) { const yy = y - h + (i + 1) * h * 0.3; const ww = h * (0.18 + i * 0.09); ctx.lineTo(x - ww * 0.45, yy - h * 0.04); ctx.lineTo(x - ww, yy); }
    ctx.closePath(); ctx.fill();
  } else { // まる
    ctx.fillRect(x - h * 0.04, y - h * 0.45, h * 0.08, h * 0.45);
    ctx.beginPath(); ctx.arc(x, y - h * 0.62, h * 0.3, 0, TAU); ctx.arc(x - h * 0.17, y - h * 0.5, h * 0.2, 0, TAU); ctx.arc(x + h * 0.18, y - h * 0.52, h * 0.21, 0, TAU); ctx.fill();
  }
}

function treeRow(ctx, scroll, W, base, period, n, hMin, hMax, color, seed, k) {
  const off = ((scroll % period) + period) % period;
  ctx.save(); shadow(ctx, k);
  for (let rep = -1; rep <= Math.ceil(W / period) + 1; rep++) {
    for (let i = 0; i < n; i++) {
      const x = rep * period + hash(i + seed) * period - off;
      if (x < -80 || x > W + 80) continue;
      const h = hMin + hash(i * 3.1 + seed) * (hMax - hMin);
      tree(ctx, x, base + hash(i * 7.7 + seed) * 10, h, color, hash(i * 5.3 + seed) < 0.6 ? 0 : 1);
    }
  }
  ctx.restore();
}

export function rock(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; const rr = r * (0.75 + hash(x * 0.1 + i) * 0.35); ctx.lineTo(x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// 旅の景色。scroll は歩いた距離（論理の単位）。gy は地面の高さ
export function landscape(ctx, W, H, gy, scroll, day, skyKind, opts = {}) {
  const L = LANDS[Math.min(day, 2)];
  sky(ctx, W, H, skyKind);
  if (skyKind !== 'night') sun(ctx, W, gy, skyKind);
  if (opts.onSky) opts.onSky();
  const dim = skyKind === 'night';
  const col = c => dim ? mix(c, '#1a2340', 0.62) : c;
  ridge(ctx, scroll * 0.08, W, gy - 150, 70, 1900, 1.3, col(L.far), 0.6, { peaks: L.snow, snow: L.snow && !dim });
  ridge(ctx, scroll * 0.2, W, gy - 85, 45, 1300, 2.7, col(L.mid), 0.8);
  treeRow(ctx, scroll * 0.2, W, gy - 70, 1300, 9, 50, 80, col(mix(L.mid, L.trees, 0.5)), 4, 0.6);
  ridge(ctx, scroll * 0.45, W, gy - 35, 26, 1100, 4.1, col(L.near), 1);
  treeRow(ctx, scroll * 0.45, W, gy - 25, 1100, 7, 70, 120, col(L.trees), 9, 1);
  // 地面
  ctx.save(); shadow(ctx, 1.2);
  ctx.fillStyle = col(L.grass);
  ctx.beginPath(); ctx.moveTo(-10, gy - 6);
  for (let x = -10; x <= W + 10; x += 9) ctx.lineTo(x, gy - 6 - (hash(Math.floor((x + scroll) / 9)) * 7));
  ctx.lineTo(W + 10, H + 10); ctx.lineTo(-10, H + 10); ctx.fill();
  ctx.fillStyle = col(L.ground);
  ctx.beginPath(); ctx.moveTo(-10, gy + 8);
  for (let x = -10; x <= W + 10; x += 16) ctx.lineTo(x, gy + 8 + (hash(Math.floor((x + scroll) / 16) + 50) - 0.5) * 3);
  ctx.lineTo(W + 10, H + 10); ctx.lineTo(-10, H + 10); ctx.fill();
  ctx.restore();
  // 道ばたの石・草（手前）
  ctx.save(); shadow(ctx, 0.8);
  const P = 700, off = ((scroll % P) + P) % P;
  for (let rep = -1; rep <= Math.ceil(W / P) + 1; rep++) for (let i = 0; i < 6; i++) {
    const x = rep * P + hash(i + 20) * P - off; if (x < -40 || x > W + 40) continue;
    const y = gy + 30 + hash(i + 40) * (H - gy - 40) * 0.6;
    if (L.rocks || i % 2) rock(ctx, x, y, 8 + hash(i + 3) * 10, col(mix(L.ground, '#5a4a3a', 0.35)));
    else { ctx.fillStyle = col(L.grass); for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(x + j * 5, y); ctx.lineTo(x + j * 5 + 2, y - 14 - j % 2 * 6); ctx.lineTo(x + j * 5 + 4, y); ctx.fill(); } }
  }
  ctx.restore();
  if (opts.creekX != null) creek(ctx, opts.creekX, gy, H, dim);
}

function sun(ctx, W, gy, kind) {
  const x = kind === 'morning' ? W * 0.18 : kind === 'evening' ? W * 0.8 : W * 0.62;
  const y = kind === 'noon' ? gy - 300 : gy - 190;
  ctx.save(); shadow(ctx, 0.5);
  ctx.fillStyle = kind === 'evening' ? '#f6b26b' : '#fbe7a7';
  ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
  ctx.restore();
}

// 沢（道を横切る水の帯）
export function creek(ctx, x, gy, H, dim) {
  ctx.save(); shadow(ctx, 0.7);
  ctx.fillStyle = dim ? '#33476a' : '#7fb3c9';
  ctx.beginPath(); ctx.moveTo(x - 30, gy - 8); ctx.bezierCurveTo(x - 10, gy + 40, x - 70, gy + 90, x - 40, H + 10);
  ctx.lineTo(x + 70, H + 10); ctx.bezierCurveTo(x + 40, gy + 90, x + 80, gy + 40, x + 40, gy - 8); ctx.closePath(); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const yy = gy + 10 + i * 22 + ((A.t * 18) % 22); const xx = x - 18 + Math.sin(i * 2.1) * 14;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 8, yy - 4, xx + 16, yy); ctx.stroke();
  }
  ctx.restore();
}

export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bb = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bb).toString(16).slice(1);
}

// ---------- 部品 ----------
function limb(ctx, x, y, len, w, ang, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-w / 2, -w / 2, w, len + w / 2, w / 2); ctx.fill();
  ctx.restore();
  return [x - Math.sin(ang) * len, y + Math.cos(ang) * len];
}
function legPair(ctx, hipX, hipY, phase, amp, thigh, shin, w, color, shoe, limp, back) {
  // back: 奥の足を描く（true）か手前（false）
  const ph = back ? phase + Math.PI : phase;
  let a1 = Math.sin(ph) * amp;
  if (limp && !back) a1 *= 0.45;                // 痛い足は小さくふみ出す
  const knee = Math.max(0, -Math.cos(ph)) * amp * 1.1;
  const [kx, ky] = limb(ctx, hipX, hipY, thigh, w, a1, color);
  const [fx, fy] = limb(ctx, kx, ky, shin, w * 0.9, a1 - knee, color);
  ctx.fillStyle = shoe; ctx.beginPath(); ctx.roundRect(fx - w * 0.45, fy - w * 0.35, w * 1.5, w * 0.75, w * 0.3); ctx.fill();
}

// ---------- 勇者 ----------
// p: { phase, act, look:{sick,thirst,sleepy,burn,shaky,limp,tired}, face:1|-1, lunge(0..1), crouch(0..1), cast(0..1), hurt(0..1) }
export function hero(ctx, x, gy, p = {}) {
  const lk = p.look || {};
  const s = 1;
  ctx.save(); ctx.translate(x, gy); ctx.scale((p.face || 1) * s, s);
  const phase = p.phase || 0;
  const walking = p.act === 'walk';
  const bob = walking ? Math.abs(Math.sin(phase)) * -4 + (lk.limp ? Math.max(0, Math.sin(phase)) * 5 : 0) : 0;
  const crouch = p.crouch || 0, lunge = p.lunge || 0, hurt = p.hurt || 0;
  ctx.translate(lunge * 46 - hurt * 18, bob + crouch * 26);
  const lean = (lk.tired ? 0.08 : 0) + crouch * 0.5 + lunge * 0.18 - hurt * 0.2;
  shadow(ctx, 1);
  const hipY = -66, shY = -118;
  const amp = walking ? 0.55 * (lk.tired ? 0.7 : 1) : lunge > 0 ? 0.6 : 0.08;
  const lph = walking ? phase : lunge > 0 ? -1.2 * lunge : 0;
  const sit = p.act === 'sit';
  if (sit) ctx.translate(0, 34);
  // 奥の足・奥の腕
  if (sit) { // すわる: ももを前に、すねを下に
    for (const [dx, c, b] of [[-3, mix(PAL.trouser, '#000', 0.2), mix(PAL.boot, '#000', 0.2)], [2, PAL.trouser, PAL.boot]]) {
      const [kx, ky] = limb(ctx, dx, hipY, 32, 13, -Math.PI / 2, c);
      const [fx, fy] = limb(ctx, kx, ky, 30, 12, 0.15, c);
      ctx.fillStyle = b; ctx.beginPath(); ctx.roundRect(fx - 6, fy - 4, 20, 9, 4); ctx.fill();
    }
  } else
  legPair(ctx, 0, hipY, lph, amp, 34, 32, 13, mix(PAL.trouser, '#000', 0.2), mix(PAL.boot, '#000', 0.2), lk.limp, true);
  // マント
  ctx.save(); ctx.rotate(lean);
  ctx.fillStyle = PAL.capeDark;
  const flut = Math.sin(A.t * 4 + phase) * 4;
  ctx.beginPath(); ctx.moveTo(-6, shY + 2); ctx.quadraticCurveTo(-34 - flut, -70, -30 - flut * 1.5, -40 + crouch * 10); ctx.lineTo(-4, -44); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (!sit) legPair(ctx, 2, hipY, lph, amp, 34, 32, 13, PAL.trouser, PAL.boot, lk.limp, false);
  // 体
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
  ctx.fillStyle = PAL.tunic;
  ctx.beginPath(); ctx.moveTo(-15, shY); ctx.lineTo(15, shY); ctx.lineTo(19, hipY + 8); ctx.lineTo(-17, hipY + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.trouser; ctx.fillRect(-17, hipY - 4, 36, 8); // ベルト
  ctx.fillStyle = '#d8b04a'; ctx.fillRect(-2, hipY - 4, 7, 8);
  // 頭
  const headY = shY - 24;
  const skin = lk.sick ? PAL.skinSick : lk.thirst > 0.6 ? PAL.skinFlush : PAL.skin;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(3, headY, 15, 17, 0, 0, TAU); ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(10, headY + 1, 2, 0, TAU); ctx.fill();
  if (lk.sleepy) { ctx.fillStyle = 'rgba(80,60,90,0.45)'; ctx.beginPath(); ctx.ellipse(10, headY + 5, 4, 2, 0, 0, TAU); ctx.fill(); }
  shadow(ctx, 0.6);
  ctx.fillStyle = PAL.steel; // かぶと
  ctx.beginPath(); ctx.arc(2, headY - 3, 17, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(19, headY - 1); ctx.lineTo(-15, headY - 1); ctx.fill();
  ctx.fillStyle = PAL.cape; ctx.beginPath(); ctx.moveTo(-2, headY - 19); ctx.quadraticCurveTo(-18, headY - 32, -24, headY - 18); ctx.quadraticCurveTo(-12, headY - 24, -2, headY - 15); ctx.fill();
  // 手前の腕と剣
  const swing = walking ? Math.sin(phase + Math.PI) * 0.5 : 0;
  let armA = swing + (p.stance ? -0.75 : 0) - crouch * 0.9 + (lunge > 0 ? -1.9 * lunge : 0) + (p.cast ? -2.2 * p.cast : 0);
  if (lk.sick && !lunge && !p.cast) armA = -0.35; // おなかを押さえる
  ctx.save();
  if (lk.shaky) ctx.translate(Math.sin(A.t * 40) * 0.8, 0);
  const [hx, hy] = limb(ctx, 4, shY + 6, 44, 11, armA, PAL.tunicDark);
  // 手（やけどで赤い）
  ctx.fillStyle = lk.burn > 0.45 ? '#e2553b' : lk.burn > 0.2 ? '#ec8c6c' : skin;
  ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, TAU); ctx.fill();
  if (!lk.sick || lunge) { // 剣
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(armA + (lunge > 0 ? 0.3 : 0.25) - Math.PI / 2 + 1.4);
    ctx.fillStyle = '#7a5a34'; ctx.fillRect(-2.5, -4, 5, 12);
    ctx.fillStyle = '#c9a54a'; ctx.fillRect(-9, -6, 18, 4);
    ctx.fillStyle = p.sharp ? '#eef3f6' : PAL.steel; ctx.beginPath(); ctx.moveTo(-3.5, -6); ctx.lineTo(3.5, -6); ctx.lineTo(2.5, -62); ctx.lineTo(0, -68); ctx.lineTo(-2.5, -62); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.restore(); // 体の傾き
  ctx.restore();
}

// ---------- お供（現代の服） ----------
// p: { phase, act:'walk'|'idle'|'sit'|'hide', load(kg), bag:{id:true}, face }
export function porter(ctx, x, gy, p = {}) {
  ctx.save(); ctx.translate(x, gy); ctx.scale(p.face || 1, 1);
  const phase = p.phase || 0, walking = p.act === 'walk';
  const load = p.load || 0;
  const hide = p.act === 'hide';
  const lean = 0.03 + Math.max(0, load - 3) * 0.045 + (hide ? 0.12 : 0);
  const bob = walking ? Math.abs(Math.sin(phase)) * -3 : 0;
  ctx.translate(0, bob + (hide ? 30 : 0));
  shadow(ctx, 1);
  const hipY = -54, shY = -96;
  const amp = walking ? 0.5 - Math.max(0, load - 5) * 0.06 : 0.05;
  if (hide) { // しゃがむ: ひざを前に
    ctx.fillStyle = mix(PAL.jeans, '#000', 0.2); ctx.beginPath(); ctx.roundRect(-6, hipY - 6, 34, 12, 6); ctx.fill();
    ctx.fillStyle = PAL.jeans; ctx.beginPath(); ctx.roundRect(-4, hipY - 2, 32, 12, 6); ctx.fill(); ctx.beginPath(); ctx.roundRect(20, hipY, 11, 30, 5); ctx.fill();
    ctx.fillStyle = PAL.shoe; ctx.beginPath(); ctx.roundRect(18, hipY + 26, 20, 9, 4); ctx.fill();
  } else {
  legPair(ctx, 0, hipY, phase, amp, 28, 26, 12, mix(PAL.jeans, '#000', 0.2), '#e4ddd0', false, true);
  legPair(ctx, 2, hipY, phase, amp, 28, 26, 12, PAL.jeans, PAL.shoe, false, false);
  }
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
  // 背負い袋（中身で形が変わる）
  const bag = p.bag || {};
  const bw = 20 + Math.min(16, load * 2.2), bh = 30 + Math.min(18, load * 2.4);
  if (load > 0) {
    ctx.fillStyle = PAL.pack; ctx.beginPath(); ctx.roundRect(-14 - bw, shY - 2, bw, bh, 7); ctx.fill();
    ctx.fillStyle = PAL.packDark; ctx.fillRect(-14 - bw + 4, shY + 8, bw - 8, 4);
    if (bag.wood) { ctx.fillStyle = '#8a5a32'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect(-14 - bw - 4 + i * 3, shY - 12 - i * 5, bw + 8, 6, 3); ctx.fill(); } }
    if (bag.pot) { ctx.fillStyle = '#3a3633'; ctx.beginPath(); ctx.arc(-14 - bw - 2, shY + bh * 0.6, 9, 0, TAU); ctx.fill(); }
    if (bag.water) { ctx.fillStyle = '#9a6a3e'; ctx.beginPath(); ctx.ellipse(-10, shY + bh - 6, 6, 10, 0.2, 0, TAU); ctx.fill(); }
  }
  // パーカー
  ctx.fillStyle = PAL.hood;
  ctx.beginPath(); ctx.moveTo(-14, shY); ctx.lineTo(14, shY); ctx.lineTo(16, hipY + 6); ctx.lineTo(-15, hipY + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.hoodDark; ctx.fillRect(-8, hipY - 10, 18, 7); // ポケット
  // 頭
  const headY = shY - 20;
  ctx.fillStyle = PAL.hoodDark; ctx.beginPath(); ctx.arc(-3, headY + 4, 15, 0, TAU); ctx.fill(); // フード
  ctx.fillStyle = PAL.skin; ctx.beginPath(); ctx.ellipse(2, headY, 13, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b2b22'; ctx.beginPath(); ctx.arc(0, headY - 6, 13, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); // 髪
  noShadow(ctx);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(9, headY + 1, 1.8, 0, TAU); ctx.fill();
  if (load > 6) { ctx.fillStyle = '#7fc1e0'; ctx.beginPath(); ctx.ellipse(14, headY - 8, 2, 3, 0, 0, TAU); ctx.fill(); } // 汗
  shadow(ctx, 0.8);
  // 腕（肩ひもをにぎる）
  const sw = walking ? Math.sin(phase + Math.PI) * 0.35 : 0;
  const [hx, hy] = limb(ctx, 3, shY + 6, 34, 10, load > 0 ? -0.5 + sw * 0.3 : sw, PAL.hoodDark);
  ctx.fillStyle = PAL.skin; ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ---------- 魔物 ----------
// p: { tell(0..1 ため), atk(0..1 とびかかる), hurt(0..1), down(0..1) }
export function foe(ctx, kind, x, gy, p = {}) {
  const sc = { wolf: 1.3, lizard: 1.55, boss: 1.35 }[kind] || 1;
  ctx.save(); ctx.translate(x - (p.atk || 0) * 70 + (p.hurt || 0) * 14, gy); ctx.scale(-sc, sc); // 左向き
  const tell = p.tell || 0;
  ctx.translate(0, tell * 8);
  if (p.down) { ctx.globalAlpha = 1 - p.down; ctx.translate(0, p.down * 30); }
  shadow(ctx, 1.1);
  const br = Math.sin(A.t * 3) * 1.5;
  if (kind === 'wolf') {
    ctx.fillStyle = '#6d7a8c';
    ctx.beginPath(); ctx.moveTo(-50, -50); ctx.lineTo(-74, -66 - br); ctx.lineTo(-60, -44); ctx.closePath(); ctx.fill(); // しっぽ
    for (const [lx, d] of [[-34, 1], [22, 1], [-26, 0], [30, 0]]) { ctx.fillStyle = d ? '#56627a' : '#6d7a8c'; ctx.beginPath(); ctx.roundRect(lx, -30, 9, 30, 4); ctx.fill(); }
    ctx.fillStyle = '#6d7a8c';
    ctx.beginPath(); ctx.moveTo(-52, -58 + br); ctx.lineTo(30, -66); ctx.lineTo(44, -42); ctx.lineTo(-44, -28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(28, -70); ctx.lineTo(42, -96 + tell * 6); ctx.lineTo(48, -76); ctx.lineTo(74, -64 + tell * 8); ctx.lineTo(70, -54); ctx.lineTo(40, -44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9e2cf'; ctx.beginPath(); ctx.moveTo(56, -58); ctx.lineTo(72, -56); ctx.lineTo(60, -50); ctx.fill();
    noShadow(ctx); ctx.fillStyle = tell > 0.3 ? '#f0c43a' : '#f4ead8'; ctx.beginPath(); ctx.arc(52, -70, 3, 0, TAU); ctx.fill();
  } else if (kind === 'lizard') {
    ctx.fillStyle = '#7a8458';
    ctx.beginPath(); ctx.moveTo(-110, -10); ctx.quadraticCurveTo(-60, -20, -40, -34); ctx.lineTo(30, -40); ctx.quadraticCurveTo(70, -42, 86, -28 - tell * 6); ctx.lineTo(80, -16); ctx.lineTo(30, -12); ctx.lineTo(-40, -12); ctx.closePath(); ctx.fill();
    for (const lx of [-30, 20]) { ctx.beginPath(); ctx.roundRect(lx, -18, 12, 18, 5); ctx.fill(); }
    ctx.fillStyle = '#9b9a8a'; // 岩の背
    for (let i = 0; i < 5; i++) { const xx = -36 + i * 16; ctx.beginPath(); ctx.moveTo(xx - 9, -36); ctx.lineTo(xx, -50 - (i % 2) * 6); ctx.lineTo(xx + 9, -37); ctx.fill(); }
    noShadow(ctx); ctx.fillStyle = tell > 0.3 ? '#f08a3a' : '#2b2118'; ctx.beginPath(); ctx.arc(70, -32, 3, 0, TAU); ctx.fill();
  } else {
    // 峠の主（大きな角の獣）
    ctx.fillStyle = '#5b4636';
    for (const [lx, d] of [[-50, 1], [30, 1], [-40, 0], [40, 0]]) { ctx.fillStyle = d ? '#46362a' : '#5b4636'; ctx.beginPath(); ctx.roundRect(lx, -44, 18, 44, 6); ctx.fill(); }
    ctx.fillStyle = '#5b4636';
    ctx.beginPath(); ctx.ellipse(0, -80 + br, 72, 46, -0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6e5642'; ctx.beginPath(); ctx.ellipse(-10, -100 + br, 50, 24, -0.1, 0, TAU); ctx.fill(); // こぶの毛
    ctx.fillStyle = '#5b4636'; ctx.beginPath(); ctx.ellipse(72, -82 + tell * 10, 30, 24, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8dcc0'; // 角
    ctx.beginPath(); ctx.moveTo(60, -100 + tell * 10); ctx.quadraticCurveTo(40, -150, 84, -146 + tell * 6); ctx.quadraticCurveTo(58, -132, 72, -98 + tell * 10); ctx.fill();
    noShadow(ctx); ctx.fillStyle = tell > 0.3 ? '#ff7a3a' : '#f4ead8'; ctx.beginPath(); ctx.arc(86, -88 + tell * 10, 3.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- 勇者の顔の窓 ----------
// 体のようすを数でなく顔で見せる（PLAN.md 柱2）
export function portrait(ctx, cx, cy, r, h, t) {
  ctx.save();
  shadow(ctx, 1.4);
  ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, TAU); ctx.fill();
  noShadow(ctx);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  const bg = ctx.createLinearGradient(cx, cy - r, cx, cy + r); bg.addColorStop(0, '#e7dcc6'); bg.addColorStop(1, '#d4c6a8');
  ctx.fillStyle = bg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const k = r / 70;
  ctx.translate(cx, cy + 10 * k); ctx.scale(k, k);
  const shake = h.sugar < 0.25 ? Math.sin(t * 38) * 1.4 : 0;
  const droop = h.sleep < 6 ? Math.min(1, (6 - h.sleep) / 3) : 0;
  const tiredY = h.fatigue * 6;
  ctx.translate(shake, tiredY);
  shadow(ctx, 0.8);
  // 肩
  ctx.fillStyle = PAL.capeDark; ctx.beginPath(); ctx.ellipse(0, 78, 70, 34, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.tunic; ctx.beginPath(); ctx.ellipse(0, 82, 52, 30, 0, 0, TAU); ctx.fill();
  // 顔
  const thirstFlush = Math.max(0, (h.thirst - 0.4) / 0.5);
  let skin = mix(PAL.skin, PAL.skinFlush, Math.min(1, thirstFlush));
  if (h.sick) skin = mix(skin, PAL.skinSick, 0.8);
  if (h.sugar < 0.25) skin = mix(skin, '#ece6d6', 0.4); // 魔力切れ: 血の気が引く
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, 4, 34, 40, 0, 0, TAU); ctx.fill();
  noShadow(ctx);
  // ほお
  ctx.fillStyle = h.sick ? 'rgba(150,170,110,0.35)' : `rgba(232,120,100,${0.18 + thirstFlush * 0.35})`;
  ctx.beginPath(); ctx.ellipse(-20, 16, 8, 5, 0, 0, TAU); ctx.ellipse(20, 16, 8, 5, 0, 0, TAU); ctx.fill();
  // 目の下のくま
  if (droop > 0) { ctx.fillStyle = `rgba(90,70,110,${0.2 + droop * 0.35})`; ctx.beginPath(); ctx.ellipse(-13, 8, 9, 4, 0, 0, TAU); ctx.ellipse(13, 8, 9, 4, 0, 0, TAU); ctx.fill(); }
  // 目
  const blink = (t % 3.3) < 0.12 ? 1 : 0;
  const yawn = droop > 0.3 && (t % 6) > 5 ? Math.sin(((t % 6) - 5) * Math.PI) : 0;
  for (const ex of [-13, 13]) {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, 0, 3.6, 4.4 * (1 - blink) * (1 - yawn * 0.7) + 0.3, 0, 0, TAU); ctx.fill();
    if (droop > 0) { ctx.fillStyle = skin; ctx.fillRect(ex - 6, -7, 12, 5 + droop * 4); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; // まゆ
    const worry = h.blister > 0.3 || h.sick ? 3 : 0;
    ctx.beginPath(); ctx.moveTo(ex - 7, -12 + (ex < 0 ? worry : -worry) * 0.3); ctx.lineTo(ex + 7, -12 - (ex < 0 ? worry : -worry) * 0.6); ctx.stroke();
  }
  // 口
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  if (yawn > 0.05) { ctx.fillStyle = '#7a3a32'; ctx.beginPath(); ctx.ellipse(0, 24, 7, 9 * yawn, 0, 0, TAU); ctx.fill(); }
  else if (h.sick || h.blister > 0.45) { ctx.beginPath(); ctx.moveTo(-8, 26); ctx.lineTo(-3, 23); ctx.lineTo(2, 26); ctx.lineTo(8, 23); ctx.stroke(); }
  else if (h.thirst > 0.6) { ctx.beginPath(); ctx.moveTo(-6, 25); ctx.lineTo(6, 25); ctx.stroke(); ctx.fillStyle = '#d9b0a0'; ctx.fillRect(-5, 26, 10, 2); }
  else { ctx.beginPath(); ctx.arc(0, 20, 8, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  // 汗
  if (h.thirst > 0.3 || h.fatigue > 0.5) {
    const n = h.thirst > 0.55 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const sy = ((t * 18 + i * 13) % 26) - 10, sx = 30 - i * 4;
      ctx.fillStyle = '#86c3e6'; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.quadraticCurveTo(sx + 5, sy + 3, sx, sy + 4); ctx.quadraticCurveTo(sx - 5, sy + 3, sx, sy - 6); ctx.fill();
    }
  }
  // かぶと
  shadow(ctx, 0.6);
  ctx.fillStyle = PAL.steel; ctx.beginPath(); ctx.arc(0, -8, 38, Math.PI * 1.03, Math.PI * 1.97); ctx.lineTo(38, -4); ctx.lineTo(-38, -4); ctx.fill();
  ctx.fillStyle = PAL.steelDark; ctx.fillRect(-38, -10, 76, 6);
  ctx.fillStyle = PAL.cape; ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(-24, -70, -40, -50); ctx.quadraticCurveTo(-20, -56, -2, -40); ctx.fill();
  // 魔力切れ: 頭のまわりを小さな星がまわる（めまい）
  if (h.sugar < 0.25) {
    noShadow(ctx); ctx.fillStyle = '#e5a12e';
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3; const sx = Math.cos(a) * 30, sy = -52 + Math.sin(a) * 7; ctx.beginPath(); for (let j = 0; j < 10; j++) { const rr = j % 2 ? 2.2 : 5; ctx.lineTo(sx + Math.cos(j / 10 * TAU) * rr, sy + Math.sin(j / 10 * TAU) * rr); } ctx.fill(); }
    shadow(ctx, 0.6);
  }
  // 手（顔の右）。やけど・ふるえ。おなかのときは見せない
  const handX = 42, handY = 40;
  if (!h.sick) {
  ctx.save(); ctx.translate(handX + (h.sugar < 0.25 ? Math.sin(t * 50) * 1.5 : 0), handY);
  ctx.fillStyle = h.burn > 0.45 ? '#e2553b' : h.burn > 0.2 ? '#ec8c6c' : skin;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, -0.3, 0, TAU); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-10 + i * 6, -16, 5, 10, 2.5); ctx.fill(); }
  if (h.burn > 0.45) { noShadow(ctx); ctx.strokeStyle = 'rgba(120,40,20,0.75)'; ctx.lineWidth = 1.6; for (let i = 0; i < 2; i++) { const o = (t * 20) % 8; ctx.beginPath(); ctx.moveTo(-4 + i * 8, -20 - o); ctx.quadraticCurveTo(0 + i * 8, -26 - o, -4 + i * 8, -31 - o); ctx.stroke(); } }
  ctx.restore();
  }
  ctx.restore();
  // 枠
  ctx.save(); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.restore();
}

// ---------- 道具の絵 ----------
export function item(ctx, id, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); shadow(ctx, 0.7);
  switch (id) {
    case 'water':
      ctx.fillStyle = '#9a6a3e'; ctx.beginPath(); ctx.moveTo(-4, -20); ctx.quadraticCurveTo(-22, -6, -16, 14); ctx.quadraticCurveTo(0, 24, 16, 14); ctx.quadraticCurveTo(22, -6, 4, -20); ctx.fill();
      ctx.fillStyle = '#c9a36a'; ctx.fillRect(-4, -26, 8, 8); ctx.fillStyle = '#6e4a2a'; ctx.fillRect(-16, 0, 32, 3); break;
    case 'honey':
      ctx.fillStyle = '#e5a12e'; ctx.beginPath(); ctx.roundRect(-14, -12, 28, 28, 8); ctx.fill();
      ctx.fillStyle = '#f4ead8'; ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(16, -12); ctx.lineTo(12, -22); ctx.lineTo(-12, -22); ctx.fill();
      ctx.fillStyle = '#c44'; ctx.fillRect(-15, -14, 30, 3); break;
    case 'food':
      ctx.fillStyle = '#8f3f2c'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect(-18 + i * 4, -14 + i * 9, 30, 8, 3); ctx.fill(); }
      ctx.fillStyle = '#e9e4da'; ctx.beginPath(); ctx.arc(14, 12, 8, 0, TAU); ctx.fill(); break;
    case 'socks':
      for (const [dx, c] of [[-6, '#d9cfb8'], [6, '#e9dfc8']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(dx - 6, -20); ctx.lineTo(dx + 6, -20); ctx.lineTo(dx + 6, 6); ctx.quadraticCurveTo(dx + 16, 8, dx + 14, 18); ctx.lineTo(dx - 6, 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c8443a'; ctx.fillRect(dx - 6, -16, 12, 3); ctx.fillRect(dx - 6, -10, 12, 3); }
      break;
    case 'wood':
      ctx.fillStyle = '#8a5a32'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-22, -14 + i * 8, 44, 7, 3.5); ctx.fill(); }
      ctx.fillStyle = '#c9a26a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(22, -10.5 + i * 8, 3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#5a4030'; ctx.fillRect(-4, -16, 4, 34); break;
    case 'pot':
      ctx.fillStyle = '#3a3633'; ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(20, -8); ctx.quadraticCurveTo(22, 18, 0, 18); ctx.quadraticCurveTo(-22, 18, -20, -8); ctx.fill();
      ctx.strokeStyle = '#3a3633'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -8, 18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); break;
    case 'bandage':
      ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.arc(-4, 0, 14, 0, TAU); ctx.fill(); ctx.fillRect(-4, 8, 24, 6);
      ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.arc(-4, 0, 5, 0, TAU); ctx.fill(); break;
    case 'rest': // 切り株
      ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(-14, -8); ctx.lineTo(14, -8); ctx.lineTo(18, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9b07a'; ctx.beginPath(); ctx.ellipse(0, -8, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a77a48'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, -8, 7, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7b9a55'; ctx.beginPath(); ctx.moveTo(10, 16); ctx.lineTo(14, 4); ctx.lineTo(16, 16); ctx.fill(); break;
    case 'stone':
      ctx.fillStyle = '#8d8f8c'; ctx.beginPath(); ctx.moveTo(-22, 6); ctx.lineTo(-16, -8); ctx.lineTo(20, -10); ctx.lineTo(22, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a9aba7'; ctx.fillRect(-15, -8, 34, 3); break;
  }
  ctx.restore();
}

// 答え合わせの印
export function icon(ctx, kind, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); shadow(ctx, 0.5);
  const c = { foot: '#6b4428', sleep: '#5d5a8f', gut: '#8aa04a', thirst: '#3f8fb8', sugar: '#e5a12e', burn: '#e2553b', fire: '#ff9a3c', sword: '#8a9397' }[kind] || '#888';
  ctx.fillStyle = c;
  if (kind === 'foot') { ctx.beginPath(); ctx.roundRect(-6, -14, 12, 20, 4); ctx.roundRect(-6, 2, 20, 10, 4); ctx.fill(); }
  else if (kind === 'sleep') { ctx.beginPath(); ctx.arc(0, 0, 13, 0.6, Math.PI * 2 - 0.6); ctx.arc(7, -4, 10, Math.PI * 2 - 0.9, 0.9, true); ctx.fill(); }
  else if (kind === 'gut') { ctx.beginPath(); ctx.ellipse(0, 0, 12, 14, 0, 0, TAU); ctx.fill(); noShadow(ctx); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 1.5); ctx.stroke(); }
  else if (kind === 'thirst') { ctx.beginPath(); ctx.moveTo(0, -15); ctx.quadraticCurveTo(13, 4, 0, 13); ctx.quadraticCurveTo(-13, 4, 0, -15); ctx.fill(); }
  else if (kind === 'sugar') { ctx.beginPath(); ctx.roundRect(-11, -9, 22, 22, 6); ctx.fill(); ctx.fillStyle = '#f4ead8'; ctx.fillRect(-12, -14, 24, 6); }
  else if (kind === 'burn' || kind === 'fire') { ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(14, 0, 8, 12); ctx.quadraticCurveTo(0, 16, -8, 12); ctx.quadraticCurveTo(-14, 0, 0, -16); ctx.fill(); ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(0, 6, 4, 6, 0, 0, TAU); ctx.fill(); }
  else if (kind === 'sword') { ctx.beginPath(); ctx.moveTo(-2.5, 10); ctx.lineTo(2.5, 10); ctx.lineTo(2, -14); ctx.lineTo(0, -18); ctx.lineTo(-2, -14); ctx.fill(); ctx.fillStyle = '#c9a54a'; ctx.fillRect(-8, 8, 16, 4); }
  ctx.restore();
}

// ---------- たき火 ----------
export function campfire(ctx, x, y, strength, t) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 240 * (0.5 + strength * 0.5));
  glow.addColorStop(0, `rgba(255,170,80,${0.35 * strength + 0.1})`); glow.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 260, y - 280, 520, 380);
  shadow(ctx, 0.8);
  ctx.fillStyle = '#6e4a2a';
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.25); ctx.beginPath(); ctx.roundRect(-34, -5, 68, 10, 5); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25); ctx.beginPath(); ctx.roundRect(-34, -5, 68, 10, 5); ctx.fill(); ctx.restore();
  noShadow(ctx);
  if (strength > 0) {
    const fl = [[PAL.fire3, 1], [PAL.fire2, 0.72], [PAL.fire1, 0.45]];
    for (const [c, k] of fl) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 24 * k, y);
      for (let i = 0; i <= 6; i++) {
        const xx = x - 24 * k + (48 * k) * i / 6;
        const hgt = (i % 2 ? 40 : 18) * k * (0.6 + strength * 0.5) * (0.85 + 0.25 * Math.sin(t * 9 + i * 1.7));
        ctx.lineTo(xx, y - 6 - hgt);
      }
      ctx.lineTo(x + 24 * k, y); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

export function stars(ctx, W, H) {
  ctx.save(); noShadow(ctx); ctx.fillStyle = '#f4ead8';
  for (let i = 0; i < 70; i++) { const x = hash(i) * W, y = hash(i + 300) * H * 0.55; const tw = 0.5 + 0.5 * Math.sin(A.t * 2 + i); ctx.globalAlpha = 0.35 + tw * 0.5; ctx.beginPath(); ctx.arc(x, y, 1 + hash(i + 9) * 1.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function moon(ctx, x, y, r) {
  ctx.save(); shadow(ctx, 0.6); ctx.fillStyle = '#f6efd9'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  noShadow(ctx); ctx.fillStyle = 'rgba(180,170,140,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.15, 0, TAU); ctx.fill();
  ctx.restore();
}

// ふきだし（短いひとこと）
export function bubble(ctx, x, y, text, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = '600 17px "Zen Maru Gothic", sans-serif';
  const w = ctx.measureText(text).width + 24;
  shadow(ctx, 0.7); ctx.fillStyle = PAL.cream;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 40, w, 32, 14); ctx.moveTo(x - 6, y - 9); ctx.lineTo(x, y); ctx.lineTo(x + 6, y - 9); ctx.fill();
  noShadow(ctx); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - 24);
  ctx.restore();
}

// 戦いの合図などの小さな絵
export function fx(ctx, kind, x, y, k) {
  ctx.save(); noShadow(ctx);
  const a = 1 - k;
  if (kind === 'dust') { ctx.fillStyle = `rgba(200,180,140,${a * 0.8})`; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (i - 1.5) * 12 * (1 + k), y - k * 10 - i % 2 * 6, 7 * (1 + k), 0, TAU); ctx.fill(); } }
  else if (kind === 'star') { ctx.translate(x, y - k * 20); ctx.rotate(k * 2); ctx.fillStyle = `rgba(255,214,90,${a})`; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 16; ctx.lineTo(Math.cos(i / 10 * TAU) * r, Math.sin(i / 10 * TAU) * r); } ctx.fill(); }
  else if (kind === 'fire') { for (let i = 0; i < 9; i++) { const ang = i / 9 * TAU; const r = k * 50; ctx.fillStyle = [PAL.fire1, PAL.fire2, PAL.fire3][i % 3]; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.6, 14 * a + 3, 0, TAU); ctx.fill(); } }
  else if (kind === 'smoke') { ctx.fillStyle = `rgba(120,115,110,${a * 0.7})`; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i * 8 - 8, y - k * 30 - i * 4, 6 + k * 8, 0, TAU); ctx.fill(); } }
  else if (kind === 'splash') { ctx.fillStyle = `rgba(130,190,230,${a})`; for (let i = 0; i < 7; i++) { const ang = -Math.PI * (0.15 + 0.7 * i / 6); ctx.beginPath(); ctx.arc(x + Math.cos(ang) * k * 30, y + Math.sin(ang) * k * 30, 4, 0, TAU); ctx.fill(); } }
  else if (kind === 'swirl') { ctx.strokeStyle = `rgba(140,160,90,${a})`; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 30; i++) { const ang = i * 0.5 + k * 6, r = i * 0.6; ctx.lineTo(x + Math.cos(ang) * r, y - 10 + Math.sin(ang) * r); } ctx.stroke(); }
  else if (kind === 'bang') { ctx.font = '700 30px "Zen Maru Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(200,60,40,${a})`; ctx.fillText('!', x, y - k * 8); }
  ctx.restore();
}
