'use strict';
// 背景（2026-10-13 ユーザー「背景もいろいろなパターンを用意して。宇宙・雲の上・部屋の中・手のひらのうえ・幻想的な世界の中など」）。
//   ルック（画風）とは別に選ぶ。「おまかせ」はルックの背景（ボクセルは画素の雲海、銅版画は羊皮紙、リアルは雲の上、サイバーは電脳）。
//   どれも見る向き・傾きで動く（drawDome。書き割りに見えないように）。手のひらだけは画面に固定して、大地が手の上で回る。
//   ほかの浮島は置かない（ユーザー「自分の浮島しかない孤独感」）。
//   back(ctx, t) は地形より先に、front(ctx, t) は地形のあとに描く。

const BACKS = {};
const gau = x => Math.exp(-x * x);
let backName = 'dark';          // はじめは暗い宇宙（2026-10-13 ユーザー）
const BACK_KEY = 'asobi-lab/edge-falls/back';
// 設定で選べる背景（v017。2026-10-13 ユーザー「暗い宇宙、宇宙、雲の上、幻想、ルックにおまかせ（名称変更）だけ残して」）。
//   auto＝ボクセルの画風が自分で描く画素の雲海。ほかの背景（部屋の中・手のひら・電脳）は ?back= で見られる（試し用）
const BACK_CHOICES = [['dark', TX('暗い宇宙', 'Dark space')], ['space', TX('宇宙', 'Space')], ['clouds', TX('雲の上', 'Above the clouds')], ['fantasy', TX('幻想', 'Fantasy')], ['auto', TX('画素の雲海', 'Pixel sea of clouds')]];
try {
  const q = new URLSearchParams(location.search).get('back'), m = localStorage.getItem(BACK_KEY);
  backName = q || (BACK_CHOICES.some(([k]) => k === m) ? m : 'dark');
} catch (e) { /* なし */ }
function setBack(n) {
  if (n !== 'auto' && !BACKS[n]) return;
  backName = n;
  try { localStorage.setItem(BACK_KEY, n); } catch (e) { /* なし */ }
}
const curBack = () => BACKS[backName === 'auto' ? style().back : backName] || null;
// 背景を描いたら true（false ならルックが自分の背景を描く）
function drawBackdrop(ctx, t) { const b = curBack(); if (!b) return false; b.back(ctx, t); return true; }
function drawBackFront(ctx, t) { const b = curBack(); if (b && b.front) b.front(ctx, t); }

// ---- 宇宙: 星雲と天の川、遠くの環のある惑星。下も宇宙（大地の下にも星） ----
BACKS.space = {
  label: '宇宙',
  back(ctx, t) {
    const ctex = cloudTex(), dt = detailTex();
    const g = drawDome(ctx, t, 3, o => {
      const u = ((o.az / (Math.PI * 2)) * 256) & 127, v = (Math.floor(o.alt * 70) + 4096) & 127;
      const n = ctex[(v << 7) | u], n2 = ctex[(((v * 2) & 127) << 7) | ((u * 2 + 31) & 127)];
      const bandC = 0.4 * Math.sin(o.az + 1.1);
      const band = gau((o.alt - bandC) * 3.2);
      const neb = Math.max(0, n - 0.45) * 2.2;
      const dust = dt[((Math.floor(o.alt * 300) & 255) << 8) | (Math.floor(o.az * 260) & 255)];
      let r = 4 + 70 * neb * n2 + 40 * band * dust, gg = 6 + 30 * neb + 38 * band * dust, b = 16 + 90 * neb * (1 - n2 * 0.5) + 52 * band * dust;
      r += 30 * band * neb; b += 20 * band;
      return rgba(r, gg, b);
    }, null, (st, t) => { const v = (110 + st.m * 145) * (0.8 + 0.2 * Math.sin(t * 1.7 + st.az * 60)); return st.m > 0.93 ? rgba(v, v * 0.9, v * 0.75) : rgba(v * 0.9, v * 0.95, v); });
    // 環のある惑星（太陽の向きから照らされる）
    const p = domePoint(g, 2.3, 0.22), r = p.r * 0.11;
    const sx = Math.cos(wrapAng(W.sun.a - 2.3)) > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(-0.35);
    ctx.strokeStyle = 'rgba(214,196,160,0.55)'; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 2.0, r * 0.5, 0, Math.PI, Math.PI * 2); ctx.stroke();
    const gr = ctx.createRadialGradient(-sx * r * 0.4, -r * 0.35, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#e8d2a8'); gr.addColorStop(0.6, '#a8865c'); gr.addColorStop(1, '#2a1e18');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,60,0.35)'; ctx.lineWidth = r * 0.08;
    for (const k of [-0.4, -0.1, 0.25]) { ctx.beginPath(); ctx.ellipse(0, r * k, r * Math.sqrt(1 - k * k) * 0.98, r * 0.06, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(232,214,176,0.75)'; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 2.0, r * 0.5, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
    // 遠くの渦巻き銀河
    const q = domePoint(g, 4.6, -0.3), qr = q.r * 0.06;
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, 0.45); ctx.rotate(t * 0.01);
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, qr);
    gg.addColorStop(0, 'rgba(255,240,220,0.8)'); gg.addColorStop(0.3, 'rgba(180,170,230,0.25)'); gg.addColorStop(1, 'rgba(120,120,200,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, qr, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(190,190,255,0.25)'; ctx.lineWidth = qr * 0.15;
    for (let a = 0; a < 2; a++) { ctx.beginPath(); for (let k = 0; k < 30; k++) { const th = k * 0.2 + a * Math.PI, rr = qr * k / 30; ctx.lineTo(Math.cos(th) * rr, Math.sin(th) * rr); } ctx.stroke(); }
    ctx.restore();
  },
};

// ---- 暗い宇宙: 星だけ（星雲のもや・銀河・惑星なし）。2026-10-13 ユーザー「紫色のモヤがなく周囲に銀河や惑星がない暗い宇宙」。はじめの背景 ----
BACKS.dark = {
  label: '暗い宇宙',
  back(ctx, t) {
    drawDome(ctx, t, 4, o => rgba(3, 4, 8), null, (st, t) => {
      const v = (60 + st.m * st.m * 195) * (0.85 + 0.15 * Math.sin(t * 1.3 + st.az * 60));
      return st.m > 0.95 ? rgba(v, v * 0.92, v * 0.8) : rgba(v * 0.92, v * 0.95, v);
    });
  },
};

// ---- 雲の上: 青い空と、はるか下の雲海（太陽の向きが暖かい） ----
BACKS.clouds = {
  label: '雲の上',
  back(ctx, t) {
    const wm = warmth();
    const HZ = [176 + 40 * wm, 196 + 24 * wm, 226], ZE = [44, 92, 168];
    drawDome(ctx, t, 3, o => {
      const k = Math.min(1, o.alt * 1.4);
      const glow = o.sg * Math.exp(-o.alt * 4) * (0.6 + 0.4 * wm);
      return rgba(mix(HZ[0], ZE[0], k) + 70 * glow, mix(HZ[1], ZE[1], k) + 44 * glow, mix(HZ[2], ZE[2], k) + 10 * glow);
    }, o => {
      const dens = Math.max(0, Math.min(1, (o.n - 0.36) / 0.24));
      const lt = 0.8 + 0.2 * o.sg;
      let r = mix(120, mix(196, 252, o.n) * lt, dens), g = mix(150, mix(204, 252, o.n) * lt, dens), b = mix(196, mix(224, 255, o.n) * lt, dens);
      r += 30 * o.sg * dens * wm; g += 14 * o.sg * dens * wm;
      const hz = Math.min(1, o.dist * 0.07);
      return rgba(mix(r, HZ[0], hz), mix(g, HZ[1], hz), mix(b, HZ[2], hz));
    }, null);
  },
};

// ---- 部屋の中: 机の上の箱庭。木の机、壁紙の壁、窓、スタンドの明かり ----
//   目の高さを 1 として、机は高さ 0、まわりの壁は半径 ROOM_R の円筒、天井は高さ ROOM_H。
//   下を向いた光線は机（近く）か床（遠く）か壁に当たる。傾けて上から見ても壁が見える。
const ROOM_R = 5, ROOM_H = 4.2;
BACKS.room = {
  label: '部屋の中',
  back(ctx, t) {
    const dt = detailTex();
    drawDome(ctx, t, 3, o => {
      const az = ((o.az % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const ta = Math.tan(Math.max(-1.5, Math.min(1.5, o.alt)));
      const light = 0.66 + 0.3 * gau(wrapAng(az - 0.9) * 1.6) + 0.3 * gau(wrapAng(az - 4.2) * 2);
      if (o.alt < 0) {
        const dist = 1 / -ta;
        if (dist < 2.6) {                                                 // 机（木目）
          const X = dist * Math.cos(az) * 3, Y = dist * Math.sin(az) * 3;
          const plank = Math.floor(Y * 0.8), j = hash2(plank, 3);
          const grain = dt[((Math.floor(Y * 30) & 255) << 8) | (Math.floor(X * 2 + j * 200) & 255)];
          const ring = 0.5 + 0.5 * Math.sin(X * 1.2 + grain * 6 + j * 10);
          let r = 150 + 30 * j + 22 * ring, g = 102 + 18 * j + 14 * ring, b = 62 + 8 * j + 8 * ring;
          if (((Y * 0.8) % 1 + 1) % 1 < 0.025) { r *= 0.6; g *= 0.6; b *= 0.6; }
          if (dist > 2.45) { r *= 0.7; g *= 0.7; b *= 0.7; }               // 机のふち
          return rgba(r * light, g * light, b * light);
        }
      }
      const wy = 1 + ROOM_R * ta;                                         // 壁に当たる高さ（机 0・目 1）
      if (o.alt < 0 && wy < -0.4) {                                       // 机の向こうの床（じゅうたん）
        const dist = 1.4 / -ta, X = dist * Math.cos(az), Y = dist * Math.sin(az);
        const rug = Math.hypot(X, Y) < 4.2 ? 1 : 0, st = (Math.floor(Math.hypot(X, Y) * 3) % 2) ? 1 : 0.93;
        const r = rug ? 132 * st : 92, g = rug ? 62 * st : 70, b = rug ? 58 * st : 52;
        return rgba(r * light * 0.8, g * light * 0.8, b * light * 0.8);
      }
      if (wy > ROOM_H) {                                                  // 天井
        const k = 0.75 + 0.1 * light; return rgba(226 * k, 220 * k, 206 * k);
      }
      // 窓（外は昼の空と遠くの緑）
      const wa = wrapAng(az - 0.9);
      if (Math.abs(wa) < 0.4 && wy > 1.3 && wy < 3.4) {
        if (Math.abs(wa) < 0.012 || Math.abs(wy - 2.35) < 0.04 || Math.abs(wa) > 0.38 || wy < 1.38 || wy > 3.32) return rgba(236, 232, 222);
        if (wy < 1.75) return rgba(110 + 40 * dt[(Math.floor(az * 600) & 255)], 150, 104);
        const k = (wy - 1.75) / 1.6; return rgba(mix(214, 132, k), mix(230, 182, k), mix(240, 232, k));
      }
      let r, g, b;
      if (wy < 0.9) {                                                     // 腰板
        const pl = (Math.floor(az * 30) % 2) ? 0.94 : 1;
        r = 132 * pl; g = 96 * pl; b = 66 * pl;
        if (wy > 0.82) { r = 168; g = 128; b = 90; }
      } else if (wy > ROOM_H - 0.2) { r = 236; g = 230; b = 216; }      // まわり縁
      else {                                                              // 壁紙（ストライプと小さな花）
        const st = (Math.floor(az * 40) % 2) ? 1 : 0.94;
        r = 206 * st; g = 192 * st; b = 164 * st;
        if (hash2(Math.floor(az * 40), Math.floor(wy * 4)) > 0.8 && (Math.floor(az * 120) % 3 === 1) && (Math.floor(wy * 12) % 3 === 1)) { r -= 30; g -= 26; b -= 8; }
      }
      // 額（壁の絵）
      const fa = wrapAng(az - 2.6);
      if (Math.abs(fa) < 0.16 && wy > 1.6 && wy < 2.6) {
        if (Math.abs(fa) > 0.145 || wy < 1.66 || wy > 2.54) { r = 120; g = 84; b = 44; }
        else { const k = (wy - 1.6); r = mix(90, 196, k); g = mix(120, 176, k); b = mix(80, 150, k); }
      }
      const lamp = gau(wrapAng(az - 4.2) * 2.2) * gau((wy - 1.6) * 0.8);
      const k = light - 0.05 * Math.max(0, wy - 2);
      return rgba(r * k + 30 * lamp, g * k + 18 * lamp, b * k);
    }, null, null);
    // 箱庭の足もとの影（机の上に、ぼんやり）
    const p = proj(C, C, 0), rr = RD * V.s * 1.1;
    const sy = p.y + (THICK + ROOT_D) * V.s * V.hf;
    ctx.save(); ctx.translate(p.x, sy); ctx.scale(1, Math.max(0.2, V.tilt) * 0.55);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    sg.addColorStop(0, 'rgba(30,18,10,0.35)'); sg.addColorStop(1, 'rgba(30,18,10,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); ctx.restore();
  },
};

// ---- 手のひらのうえ: 大きな手がすくい上げるように大地をのせる。まわりはぼけた暖かい光 ----
//   手のひらの奥がわと指は地形より先に、手前のふち・手首・親指は地形のあとに描く（岩の根が手の中に入って見える）。
function handGeom() {
  const R = RD * V.s, cx = V.cx;
  const near = V.cy + RD * V.s * V.tilt + THICK * V.s * V.hf;          // 大地の手前のふちの下
  const far = V.cy - RD * V.s * V.tilt;                                // 奥のふち
  const prx = R * 1.18, pry = R * (0.18 + 0.5 * V.tilt);
  const py = near + R * 0.12 + pry * 0.3;
  return { R, cx, py, prx, pry, far };
}
const SKIN = [[248, 208, 182], [222, 160, 132], [176, 112, 92]];
function skinGrad(ctx, x0, y0, x1, y1, k = 1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1), c = (n, a = 1) => `rgba(${SKIN[n][0] * k | 0},${SKIN[n][1] * k | 0},${SKIN[n][2] * k | 0},${a})`;
  g.addColorStop(0, c(0)); g.addColorStop(0.6, c(1)); g.addColorStop(1, c(2));
  return g;
}
function finger(ctx, x, y, ang, len, w, k) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = skinGrad(ctx, -w * 0.6, 0, w * 0.6, 0, k);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.46, -len + w / 2); ctx.arc(0, -len + w / 2, w * 0.46, Math.PI, 0); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(140,82,64,${0.45 * k})`; ctx.lineWidth = Math.max(1, w * 0.04); ctx.stroke();
  for (const f of [0.36, 0.66]) { ctx.beginPath(); ctx.moveTo(-w * 0.28, -len * f); ctx.quadraticCurveTo(0, -len * f + w * 0.1, w * 0.28, -len * f); ctx.stroke(); }
  ctx.fillStyle = `rgba(252,226,214,${0.6 * k})`;                       // つめ
  ctx.beginPath(); ctx.ellipse(0, -len + w * 0.55, w * 0.28, w * 0.34, 0, 0, 7); ctx.fill();
  ctx.restore();
}
BACKS.hand = {
  label: '手のひら',
  back(ctx, t) {
    drawDome(ctx, t, 4, o => {
      const k = Math.max(0, Math.min(1, 0.5 + o.alt * 0.8));
      return rgba(mix(70, 32, k) + 26 * o.sg, mix(52, 30, k) + 14 * o.sg, mix(56, 52, k));
    }, null, null);
    // ぼけた光の玉（向きで少しずれる）
    for (let k = 0; k < 26; k++) {
      const x = ((hash2(k, 1) * 1.4 - 0.2 + V.yaw * 0.05 * (0.5 + hash2(k, 4))) % 1.2 + 1.2) % 1.2 * V.cw - V.cw * 0.1, y = hash2(k, 2) * V.ch;
      const r = (0.03 + hash2(k, 3) * 0.07) * Math.max(V.cw, V.ch);
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
      const c = hash2(k, 5) > 0.5 ? '255,214,150' : '255,176,120';
      g.addColorStop(0, `rgba(${c},0.1)`); g.addColorStop(0.9, `rgba(${c},0.07)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    const { R, cx, py, prx, pry, far } = handGeom();
    // 奥の4本の指（大地のうしろで立ち上がり、奥のふちの上へ少し出る）
    const fw = R * 0.32, base = py - pry * 0.75;
    [[-0.66, -0.42, 0.9], [-0.23, -0.13, 1.04], [0.2, 0.12, 1.0], [0.62, 0.38, 0.84]].forEach(([fx, ang, l]) => {
      const len = Math.max(R * 0.5, (base - far) * l + R * 0.18);
      finger(ctx, cx + prx * fx, base, ang * 0.5, len, fw, 0.84);
    });
    // 手のひらのくぼみ（内がわは少し暗い）
    const g = ctx.createRadialGradient(cx, py - pry * 0.2, prx * 0.1, cx, py, prx * 1.05);
    g.addColorStop(0, 'rgb(200,140,116)'); g.addColorStop(0.75, 'rgb(226,166,138)'); g.addColorStop(1, 'rgb(240,190,160)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, py, prx, pry, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(150,92,72,0.35)'; ctx.lineWidth = Math.max(1, R * 0.012); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - prx * 0.7, py - pry * 0.3); ctx.quadraticCurveTo(cx - prx * 0.1, py - pry * 0.65, cx + prx * 0.72, py - pry * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - prx * 0.6, py); ctx.quadraticCurveTo(cx, py - pry * 0.15, cx + prx * 0.5, py + pry * 0.2); ctx.stroke();
  },
  front(ctx, t) {
    const { R, cx, py, prx, pry } = handGeom();
    // 手首（下へ）と、手のひらの手前のふち（岩の根の下を手が受ける）
    ctx.fillStyle = skinGrad(ctx, cx - prx, 0, cx + prx, 0, 0.95);
    ctx.beginPath();
    ctx.moveTo(cx - prx, py);
    ctx.ellipse(cx, py, prx, pry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + prx * 0.62, V.ch + 60); ctx.lineTo(cx - prx * 0.7, V.ch + 60); ctx.closePath();
    ctx.fill();
    // ふちのやわらかな光と影
    ctx.strokeStyle = 'rgba(255,230,210,0.55)'; ctx.lineWidth = Math.max(1.5, R * 0.025);
    ctx.beginPath(); ctx.ellipse(cx, py, prx * 0.98, pry * 0.96, 0, Math.PI * 1.05, Math.PI * 1.95, true); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,92,72,0.3)'; ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath(); ctx.moveTo(cx - prx * 0.25, py + pry * 1.1); ctx.quadraticCurveTo(cx - prx * 0.45, py + pry * 2, cx - prx * 0.3, V.ch); ctx.stroke();
    // 親指（左から内へ）
    finger(ctx, cx - prx * 0.92, py + pry * 0.1, -0.85, R * 0.62, R * 0.36, 1);
  },
};

// ---- 幻想: 紫の空にオーロラ、大きな月がふたつ、下は光る霧の海、ただよう光の粒 ----
BACKS.fantasy = {
  label: '幻想',
  back(ctx, t) {
    const g = drawDome(ctx, t, 3, o => {
      const k = Math.min(1, o.alt * 1.3);
      let r = mix(238, 34, k), gg = mix(170, 22, k), b = mix(196, 78, k);
      r = mix(r, 120, Math.exp(-o.alt * 3) * 0.4 * (1 - o.sg)); gg = mix(gg, 214, Math.exp(-o.alt * 3) * 0.35 * (1 - o.sg));
      const c = 0.3 + 0.07 * Math.sin(o.az * 3 + t * 0.15) + 0.04 * Math.sin(o.az * 7 - t * 0.1);
      const cur = gau((o.alt - c) * 7) * (0.45 + 0.55 * Math.sin(o.az * 26 + Math.sin(o.az * 5 + t * 0.4) * 3) ** 2);
      const hue = 0.5 + 0.5 * Math.sin(o.az * 2 + t * 0.05);
      r += cur * mix(60, 200, hue); gg += cur * mix(220, 90, hue); b += cur * mix(150, 220, hue);
      return rgba(r, gg, b);
    }, o => {
      const glow = Math.max(0, o.n - 0.35) * 1.6;
      let r = mix(70, 250, glow), gg = mix(50, 196, glow), b = mix(120, 236, glow);
      const sh = 0.5 + 0.5 * Math.sin(o.wx * 0.8 + o.wy * 0.5 + t * 0.3);
      gg += 30 * sh * glow; b += 20 * sh * glow;
      const hz = Math.min(1, o.dist * 0.07);
      return rgba(mix(r, 236, hz), mix(gg, 176, hz), mix(b, 200, hz));
    }, (st, t) => { if (st.m < 0.5) return 0; const v = (160 + st.m * 95) * (0.7 + 0.3 * Math.sin(t * 2.4 + st.az * 70)); return rgba(v, v * 0.92, v); });
    // 大きな月ふたつ
    for (const [az, alt, rr, c1, c2] of [[3.5, 0.42, 0.2, '#fdf2e4', '#e6b9d4'], [5.1, 0.24, 0.07, '#e4f4ff', '#9ec4e8']]) {
      const p = domePoint(g, az, alt), r = p.r * rr;
      const gl = ctx.createRadialGradient(p.x, p.y, r * 0.8, p.x, p.y, r * 2.6);
      gl.addColorStop(0, 'rgba(255,230,250,0.35)'); gl.addColorStop(1, 'rgba(255,230,250,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, 7); ctx.fill();
      const gm = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
      gm.addColorStop(0, c1); gm.addColorStop(1, c2);
      ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,160,200,0.25)';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(p.x + (hash2(k, az) - 0.5) * r * 1.1, p.y + (hash2(az, k) - 0.5) * r * 1.1, r * (0.08 + hash2(k, 9) * 0.14), 0, 7); ctx.fill(); }
    }
  },
  front(ctx, t) {
    // ただよう光の粒（ゆっくり上へ。見る向きで少しずれる）
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 40; k++) {
      const sp = 0.01 + hash2(k, 2) * 0.02, x = (((hash2(k, 1) + V.yaw * 0.08 * (0.5 + hash2(k, 6)) + Math.sin(t * 0.3 + k) * 0.01) % 1) + 1) % 1 * V.cw;
      const y = (1 - ((hash2(k, 3) + t * sp) % 1)) * V.ch, r = 1.5 + hash2(k, 4) * 3;
      const a = 0.35 + 0.35 * Math.sin(t * 1.3 + k * 2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      const c = k % 3 ? '255,236,180' : '190,240,255';
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  },
};

// ---- 電脳: 暗い空に地平線の光、下はどこまでも続く光の格子 ----
BACKS.neon = {
  label: '電脳',
  back(ctx, t) {
    drawDome(ctx, t, 3, o => {
      const k = Math.min(1, o.alt * 1.6), hz = Math.exp(-o.alt * 9);
      return rgba(mix(26, 4, k) + 120 * hz + 10 * o.sg, mix(8, 4, k) + 26 * hz + 60 * o.sg * hz, mix(48, 18, k) + 110 * hz + 50 * o.sg * hz);
    }, o => {
      const s = 0.5, fx = Math.abs(((o.wx * s) % 1 + 1) % 1 - 0.5), fy = Math.abs((((o.wy * s - t * 0.15) % 1) + 1) % 1 - 0.5);
      const lw = 0.008 + o.dist * 0.003, fade = Math.exp(-o.dist * 0.05) * 0.7;
      const lx = fx > 0.5 - lw ? 1 : 0, ly = fy > 0.5 - lw ? 1 : 0;
      let r = 6 + 30 * o.n * fade, g = 4 + 10 * o.n * fade, b = 20 + 40 * o.n * fade;
      r += (lx * 255 + ly * 40) * fade; g += (lx * 60 + ly * 220) * fade; b += (lx * 210 + ly * 255) * fade;
      const hz = Math.min(1, o.dist * 0.05);
      return rgba(mix(r, 130, hz), mix(g, 30, hz), mix(b, 150, hz));
    }, (st, t) => { if (st.m < 0.4) return 0; const v = (90 + st.m * 140) * (Math.sin(t * 3 + st.az * 80) > 0.6 ? 0.4 : 1); return rgba(v * 0.6, v, v); });
  },
};

