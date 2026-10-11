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
function bone(ctx, x0, x1, w) {
  const r = w * 0.5, s = w * 0.28;
  ctx.beginPath();
  ctx.moveTo(x0 + r * 0.6, -s); ctx.lineTo(x1 - r * 0.6, -s);
  ctx.arc(x1, 0, r, -Math.PI * 0.75, Math.PI * 0.75);
  ctx.lineTo(x0 + r * 0.6, s);
  ctx.arc(x0, 0, r, Math.PI * 0.25, Math.PI * 1.75);
  ctx.closePath(); ctx.fill(); ctx.stroke();
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

function drawDino(ctx, d, px) {
  ctx.lineWidth = Math.max(px * 1.1, d.p.L * 0.006);
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

// 地面（体の座標のまま描く）: 地面の線、下の斜線、目盛り、ゴールの線
function drawGround(ctx, x0, x1, px, scale) {
  ctx.strokeStyle = INK.ink; ctx.lineWidth = px * 1.5;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
  ctx.lineWidth = px; ctx.strokeStyle = INK['ink-soft'];
  ctx.beginPath();
  const hatch = px * 14;
  for (let x = Math.floor(x0 / hatch) * hatch; x < x1; x += hatch) { ctx.moveTo(x, 0); ctx.lineTo(x - hatch * 0.7, -hatch * 0.7); }
  ctx.stroke();
  const minor = niceStep(scale, 10), major = niceStep(scale, 70);
  ctx.strokeStyle = INK.ink; ctx.beginPath();
  for (let m = Math.ceil(x0 / minor) * minor; m <= x1; m += minor) {
    const big = Math.abs(m / major - Math.round(m / major)) < 1e-6;
    ctx.moveTo(m, 0); ctx.lineTo(m, -px * (big ? 9 : 4));
  }
  ctx.stroke();
  if (FINISH >= x0 && FINISH <= x1) {
    ctx.save(); ctx.setLineDash([px * 6, px * 4]); ctx.strokeStyle = INK.accent; ctx.lineWidth = px * 2;
    ctx.beginPath(); ctx.moveTo(FINISH, 0); ctx.lineTo(FINISH, px * 2000); ctx.stroke(); ctx.restore();
  }
  return major;
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
function drawScene(canvas, R, cams, {labels = [], progressH = 0, ghosts = []} = {}) {
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr, dinos = R.dinos;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK['paper-line']; ctx.lineWidth = 1; ctx.beginPath(); // 方眼
  for (let x = 0; x < W; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += 24) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  if (progressH) drawProgress(ctx, R, W, progressH, ghosts);
  const n = Math.max(1, dinos.length), laneH = (H - progressH) / n;
  dinos.forEach((d, i) => {
    const cam = cams[i]; if (!cam) return;
    const top = progressH + laneH * i, s = cam.scale, px = 1 / s, base = top + laneH - 30;
    const x0 = cam.x, x1 = cam.x + W / s;
    if (i > 0 || progressH) { ctx.strokeStyle = INK.line || INK['ink-soft']; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(W, top + 0.5); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, laneH); ctx.clip();
    ctx.setTransform(dpr * s, 0, 0, -dpr * s, -cam.x * s * dpr, base * dpr);
    const major = drawGround(ctx, x0 - 1, x1 + 1, px, s);
    drawDino(ctx, d, px);
    ctx.restore();
    // 目盛りの数字・ゴール
    ctx.fillStyle = INK.muted; ctx.font = '11px ' + FONT(); ctx.textAlign = 'center';
    for (let m = Math.ceil(x0 / major) * major; m <= x1; m += major) if (m >= -1e-9 && m <= FINISH) ctx.fillText(fmtLen(+m.toFixed(2)), (m - cam.x) * s, base + 22);
    if (FINISH >= x0 && FINISH <= x1) { ctx.fillStyle = INK.accent; ctx.font = '700 12px ' + FONT(); ctx.fillText('ゴール', (FINISH - cam.x) * s, top + 16); }
    // ゴーストの線（このレーンの縮尺で、いまの位置に）
    for (const gh of ghosts) {
      const gx = (ghostAt(gh, R.t) - cam.x) * s; if (gx < 0 || gx > W) continue;
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = INK.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, top + 24); ctx.lineTo(gx, base); ctx.stroke(); ctx.restore();
      ctx.fillStyle = INK.accent; ctx.font = '11px ' + FONT(); ctx.textAlign = 'center'; ctx.fillText(gh.short || gh.name, gx, top + 34);
    }
    // 名前と物差し（この縮尺で何 m か）
    ctx.textAlign = 'left'; ctx.fillStyle = INK.ink; ctx.font = '600 13px ' + FONT();
    const status = d.finishT != null ? ` ゴール ${d.finishT.toFixed(2)}秒` : d.fell ? ' 転んだ' : '';
    ctx.fillText(`${i + 1}. ${labels[i] || ''}${status}`, 10, top + 18);
    const bar = niceStep(s, 50), bx = 10, by = top + 30;
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by); ctx.lineTo(bx + bar * s, by); ctx.lineTo(bx + bar * s, by - 4); ctx.stroke();
    ctx.fillStyle = INK.muted; ctx.font = '11px ' + FONT(); ctx.fillText(fmtLen(bar), bx + bar * s + 6, by + 3);
  });
}

// 牧場のカードの小さな絵（立った姿勢。物理の世界を作って0秒のまま描く）
function drawPortrait(canvas, g) {
  const R = makeRace([g]), d = R.dinos[0];
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, W, H);
  const r = d.r, left = r.tailEnd[0], right = Math.max(r.headEnd[0], r.tip[0]), top = Math.max(r.neckEnd[1], r.headEnd[1]) + d.p.thick.head;
  const s = Math.min((W - 16) / (right - left), (H - 22) / top);
  const ox = (W - (right - left) * s) / 2 - left * s, base = H - 12;
  ctx.save(); ctx.setTransform(dpr * s, 0, 0, -dpr * s, ox * dpr, base * dpr);
  ctx.strokeStyle = INK['ink-soft']; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(left - 1, 0); ctx.lineTo(right + 1, 0); ctx.stroke();
  drawDino(ctx, d, 1 / s);
  ctx.restore();
  return s;
}
