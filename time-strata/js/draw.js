'use strict';
// 掘れば昔、積めば未来 — 絵（Canvas 2D）。世界は自分のいる年 E のすがただけを描く。
(function () {
  const Wd = window.World;
  const { clamp, smooth, mix } = Wd;

  // 0〜1 の決まった乱数（マスごとの模様）
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const rgb = (c, k = 1) => `rgb(${clamp(c[0] * k, 0, 255) | 0},${clamp(c[1] * k, 0, 255) | 0},${clamp(c[2] * k, 0, 255) | 0})`;
  const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  function ramp(keys, e) { // [[年, '#色'], …] をなめらかに
    if (e <= keys[0][0]) return hex(keys[0][1]);
    for (let i = 1; i < keys.length; i++) if (e <= keys[i][0]) return mixC(hex(keys[i - 1][1]), hex(keys[i][1]), smooth(keys[i - 1][0], keys[i][0], e));
    return hex(keys[keys.length - 1][1]);
  }
  const SKY_TOP = [[-12, '#8ea9c2'], [-5, '#7aa3c8'], [0, '#6d9bcb'], [8, '#5d9ad3'], [15, '#6c9cc4'], [25, '#5f91c0']];
  const SKY_BOT = [[-12, '#e3eaee'], [-5, '#ece6d6'], [0, '#f2dcc0'], [8, '#e5eed9'], [15, '#f1ddb2'], [25, '#efd8b2']];
  const FAR_HILL = [[-12, '#9aa9b6'], [0, '#8b9a8f'], [8, '#7f9a80'], [15, '#a59a7c'], [25, '#9a9479']];
  const MID_HILL = [[-12, '#a7a68c'], [-4, '#8a9265'], [0, '#6f8452'], [8, '#5f8248'], [15, '#8f8a55'], [25, '#857f52']];
  const MAT = { rock: '#5b5856', old: '#77654f', loess: '#c3a873', soil: '#5f4329', tell: '#94765a', clay: '#8a8e95', stone: '#d6bf95', brick: '#b0613b' };
  const iceOf = e => 1 - smooth(-7.5, -4.5, e);      // 氷期らしさ（雪・白い山）

  let cv, cx, TS = 32, vw = 0, vh = 0, dpr = 1;
  const cam = { x: 12, y: 2 };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    vw = r.width; vh = r.height;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    TS = Math.max(24, Math.round(Math.min(vh / 12.5, vw / 11)));
  }
  function init(canvas) { cv = canvas; cx = cv.getContext('2d'); resize(); window.addEventListener('resize', resize); }

  // 画面 ↔ マス
  const sx = x => (x - cam.x) * TS + vw / 2;
  const sy = y => vh / 2 - (y - cam.y) * TS;
  const toCell = (px, py) => ({ x: (px - vw / 2) / TS + cam.x, y: (vh / 2 - py) / TS + cam.y });

  function follow(P, dt, snap) {
    const tx = clamp(P.x, vw / TS / 2, Wd.W - vw / TS / 2), ty = P.y + 1;
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }

  // ---- 背景 ----
  function ridge(off, scale, amp, base, seed) { // なだらかな稜線（いくつかの sin の重ね合わせ）
    return x => base + amp * (Math.sin((x + off) * scale + seed) * 0.6 + Math.sin((x + off) * scale * 2.3 + seed * 2) * 0.28 + Math.sin((x + off) * scale * 5.1 + seed * 3) * 0.12);
  }
  const farR = ridge(0, 0.011, 70, 0, 1.3), midR = ridge(0, 0.025, 34, 0, 4.1);

  function sky(E) {
    const g = cx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, rgb(ramp(SKY_TOP, E))); g.addColorStop(1, rgb(ramp(SKY_BOT, E)));
    cx.fillStyle = g; cx.fillRect(0, 0, vw, vh);
    // 低い太陽
    const s = cx.createRadialGradient(vw * 0.78, vh * 0.28, 4, vw * 0.78, vh * 0.28, vh * 0.5);
    s.addColorStop(0, 'rgba(255,244,214,.75)'); s.addColorStop(0.08, 'rgba(255,236,200,.35)'); s.addColorStop(1, 'rgba(255,236,200,0)');
    cx.fillStyle = s; cx.fillRect(0, 0, vw, vh);
    const ice = iceOf(E), horizon = sy(cam.y - 1.2);   // 遠景は、いつも自分の足もとの高さのうしろに
    // 遠い山（氷期は雪をかぶる）
    layer(0.15, farR, horizon - vh * 0.10, ramp(FAR_HILL, E), ice, 0.9);
    layer(0.4, midR, horizon - vh * 0.02, ramp(MID_HILL, E), ice * 0.6, 1);
  }
  function layer(par, fn, base, col, snow, alpha) {
    const ox = cam.x * TS * par;
    cx.globalAlpha = alpha;
    cx.beginPath(); cx.moveTo(0, vh);
    for (let x = 0; x <= vw + 8; x += 8) cx.lineTo(x, base - fn(x + ox));
    cx.lineTo(vw, vh); cx.closePath();
    const g = cx.createLinearGradient(0, base - 90, 0, base + 60);
    g.addColorStop(0, rgb(col, 1.08)); g.addColorStop(1, rgb(col, 0.86));
    cx.fillStyle = g; cx.fill();
    if (snow > 0.02) { // 稜線の上のほうだけ白く
      cx.save(); cx.clip();
      cx.fillStyle = `rgba(246,249,252,${0.85 * snow})`;
      cx.beginPath(); cx.moveTo(0, 0);
      for (let x = 0; x <= vw + 8; x += 8) cx.lineTo(x, base - fn(x + ox) * 0.55 - 26 * snow);
      cx.lineTo(vw, 0); cx.closePath(); cx.fill();
      cx.restore();
    }
    cx.globalAlpha = 1;
  }

  // ---- 地面 ----
  function cellColor(c, j, mat, E) {
    let base = hex(MAT[mat] || MAT.soil);
    const d = Wd.depEra(c, j);
    let k = 1;
    if (mat !== 'rock' && mat !== 'stone' && d === d) k *= (Math.floor(d * 1.4) & 1) ? 0.93 : 1.04; // 地層のしま
    k *= 0.94 + hash(c, j) * 0.1;
    return { base, k };
  }
  function terrain(E) {
    const c0 = Math.max(0, Math.floor(cam.x - vw / TS / 2) - 1), c1 = Math.min(Wd.W - 1, Math.ceil(cam.x + vw / TS / 2) + 1);
    const j0 = Math.floor(cam.y - vh / TS / 2) - 1, j1 = Math.ceil(cam.y + vh / TS / 2) + 1;
    const ice = iceOf(E);
    const T = TS + 0.6;
    for (let c = c0; c <= c1; c++) {
      const top = Math.floor(Wd.H(c, E));
      const x = sx(c);
      // 水（川）
      if (Wd.isRiver(c)) {
        const wl = Wd.waterLevel(E);
        if (wl > top) {
          const y0 = sy(wl), y1 = sy(top);
          const g = cx.createLinearGradient(0, y0, 0, y1);
          g.addColorStop(0, ice > 0.5 ? 'rgba(170,200,214,.85)' : 'rgba(78,128,150,.82)');
          g.addColorStop(1, ice > 0.5 ? 'rgba(120,150,160,.9)' : 'rgba(38,70,88,.92)');
          cx.fillStyle = g; cx.fillRect(x, y0, T, y1 - y0);
          cx.fillStyle = 'rgba(255,255,255,.45)'; cx.fillRect(x, y0, T, 2);
        }
      }
      for (let j = j0; j <= j1; j++) {
        const m = Wd.mods.get(Wd.key(c, j));
        const y = sy(j + 1);
        if (m && m.t === 'put') { block(x, y, m.m, c, j); continue; }
        const nat = j < Wd.ROCK || j < top;
        if (!nat) continue;
        const mat = Wd.material(c, j);
        const { base, k } = cellColor(c, j, mat, E);
        const depth = Math.max(0, top - 1 - j);
        const shade = (1 - Math.min(0.42, depth * 0.045)) * k;
        if (m && m.t === 'dug') { // 掘った穴: 奥の壁
          cx.fillStyle = rgb(base, shade * 0.42); cx.fillRect(x, y, T, T);
          cx.fillStyle = 'rgba(0,0,0,.18)'; cx.fillRect(x, y, T, TS * 0.18);
          continue;
        }
        cx.fillStyle = rgb(base, shade); cx.fillRect(x, y, T, T);
        if (mat === 'stone') { cx.fillStyle = 'rgba(90,70,40,.35)'; cx.fillRect(x, y + TS - 2, T, 2); cx.fillRect(x + ((j & 1) ? TS * 0.5 : 0), y, 2, TS); }
        else if (mat === 'tell' && hash(c * 7, j) > 0.72) { cx.fillStyle = 'rgba(160,80,50,.7)'; cx.fillRect(x + TS * hash(c, j * 3) * 0.7, y + TS * 0.5, TS * 0.22, TS * 0.12); } // 土器のかけら
        else if (hash(c, j * 5) > 0.8) { cx.fillStyle = rgb(base, shade * 0.75); cx.fillRect(x + TS * hash(j, c) * 0.8, y + TS * hash(c + 3, j) * 0.8, TS * 0.12, TS * 0.1); } // 小石
        // 地表: 草か雪
        if (j === top - 1 && !Wd.solid(c, j + 1, E) && mat !== 'stone') {
          if (ice > 0.5) { cx.fillStyle = '#f1f4f6'; cx.fillRect(x, y - 2, T, TS * 0.2 + 2); }
          else if (!Wd.isRiver(c) || top > Wd.waterLevel(E)) {
            cx.fillStyle = E > 9 && c > 63 ? '#a28a5e' : '#6f8f3e'; cx.fillRect(x, y - 1, T, TS * 0.16 + 1);
            if (E <= 9 || c < 64) { cx.fillStyle = '#87a84b'; for (let i = 0; i < 3; i++) cx.fillRect(x + TS * (0.15 + i * 0.3 + hash(c, i) * 0.1), y - TS * 0.12, 2, TS * 0.14); }
          }
        }
      }
    }
  }
  function block(x, y, mat, c, j) { // 積んだマス
    const m = MAT[mat] ? mat : 'soil';
    const b = hex(MAT[m]);
    cx.fillStyle = rgb(b, 0.98); cx.fillRect(x, y, TS, TS);
    cx.fillStyle = rgb(b, 1.18); cx.fillRect(x, y, TS, 3);
    cx.fillStyle = rgb(b, 0.72); cx.fillRect(x, y + TS - 3, TS, 3);
    if (m === 'brick') { cx.fillStyle = 'rgba(235,215,190,.55)'; cx.fillRect(x, y + TS * 0.5, TS, 2); cx.fillRect(x + TS * 0.5, y, 2, TS * 0.5); cx.fillRect(x + TS * 0.2, y + TS * 0.5, 2, TS * 0.5); }
    else { cx.fillStyle = rgb(b, 0.8); cx.fillRect(x + TS * 0.25, y + TS * 0.4, TS * 0.14, TS * 0.12); cx.fillRect(x + TS * 0.62, y + TS * 0.66, TS * 0.12, TS * 0.1); }
  }

  // ---- 人と生き物 ----
  // 立っている人（足もと x, y はマス。h は背の高さ）
  function person(x, y, o) {
    const s = TS * (o.h || 1.6) / 1.6, px = sx(x), py = sy(y);
    const dir = o.dir || 1, t = o.walk || 0;
    cx.save(); cx.translate(px, py); cx.scale(dir * s / 32, s / 32);
    const sw = Math.sin(t * 9) * (o.moving ? 1 : 0);
    // 足
    cx.strokeStyle = o.skin; cx.lineWidth = 5; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(-3, -20); cx.lineTo(-3 + sw * 6, -2); cx.moveTo(4, -20); cx.lineTo(4 - sw * 6, -2); cx.stroke();
    // 背中の袋
    if (o.bag) { cx.fillStyle = o.bag; cx.beginPath(); cx.ellipse(-10, -30, 7, 9, 0.2, 0, Math.PI * 2); cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1.5; cx.stroke(); }
    // からだ（服）
    cx.fillStyle = o.cloth;
    cx.beginPath(); cx.moveTo(-8, -40); cx.lineTo(8, -40); cx.lineTo(11, -17);
    if (o.fur) { for (let i = 0; i < 5; i++) cx.lineTo(11 - (i + 0.5) * 4.4, i & 1 ? -17 : -13); }
    cx.lineTo(-11, -17); cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(0,0,0,.12)'; cx.fillRect(-8, -24, 19, 3);
    // 腕
    cx.strokeStyle = o.skin; cx.lineWidth = 4.5;
    const arm = o.arm != null ? o.arm : -sw * 0.6;
    cx.beginPath(); cx.moveTo(4, -37); cx.lineTo(8 + Math.sin(arm) * 8, -24 + Math.cos(arm) * -2); cx.stroke();
    // 頭
    cx.fillStyle = o.skin; cx.beginPath(); cx.arc(1, -47, 7.5, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = o.hair;
    cx.beginPath(); cx.arc(0, -49, 8.2, Math.PI * 0.95, Math.PI * 2.08); cx.lineTo(-7, -42); cx.closePath(); cx.fill();
    if (o.wild) { cx.beginPath(); cx.moveTo(-8, -50); cx.lineTo(-12, -46); cx.lineTo(-8, -44); cx.moveTo(-3, -56); cx.lineTo(-6, -60); cx.lineTo(1, -56); cx.fill(); }
    cx.fillStyle = '#1b130e'; cx.beginPath(); cx.arc(4.5, -47.5, 1.2, 0, Math.PI * 2); cx.fill();
    cx.restore();
  }

  function mammoth(x, y, dir, t) {
    const s = TS / 32, px = sx(x), py = sy(y);
    cx.save(); cx.translate(px, py); cx.scale(dir * s, s);
    const b = Math.sin(t * 2) * 1.5;
    cx.fillStyle = '#5a3b26';
    for (const lx of [-26, -12, 14, 26]) { cx.fillRect(lx - 5, -26, 10, 26 + (lx % 2 ? b : -b) * 0.4); }
    cx.beginPath(); cx.ellipse(0, -46, 40, 26, 0, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(34, -58, 17, 17, 0, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(18, -72, 18, 10, -0.2, 0, Math.PI * 2); cx.fill(); // 肩のこぶ
    cx.strokeStyle = '#5a3b26'; cx.lineWidth = 7; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(46, -54); cx.quadraticCurveTo(54, -30, 46 + b, -14); cx.stroke(); // 鼻
    cx.strokeStyle = '#efe6d2'; cx.lineWidth = 4;
    cx.beginPath(); cx.moveTo(42, -48); cx.quadraticCurveTo(64, -40, 58, -60); cx.stroke(); // きば
    cx.fillStyle = 'rgba(30,18,10,.35)'; // 長い毛
    for (let i = 0; i < 9; i++) cx.fillRect(-34 + i * 8, -30 + (i & 1) * 3, 3, 12);
    cx.fillStyle = '#140c07'; cx.beginPath(); cx.arc(38, -62, 1.8, 0, Math.PI * 2); cx.fill();
    cx.restore();
  }

  function hut(x, y) { // 葦の丸い小屋（新石器の村）
    const px = sx(x), py = sy(y), w = TS * 1.6, h = TS * 2.3;
    cx.fillStyle = '#b39a62';
    cx.beginPath(); cx.moveTo(px - w, py); cx.quadraticCurveTo(px - w, py - h * 1.1, px, py - h); cx.quadraticCurveTo(px + w, py - h * 1.1, px + w, py); cx.closePath(); cx.fill();
    cx.strokeStyle = 'rgba(80,60,30,.35)'; cx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { cx.beginPath(); cx.moveTo(px - w + i * w / 3, py); cx.quadraticCurveTo(px - w * 0.6 + i * w / 4, py - h * 0.6, px, py - h); cx.stroke(); }
    cx.fillStyle = '#3a2a18'; cx.beginPath(); cx.ellipse(px + w * 0.25, py, w * 0.25, h * 0.38, 0, Math.PI, 0); cx.fill();
  }
  function house(x, y, w2) { // 日干しれんがの家（都）
    const px = sx(x), py = sy(y), w = TS * w2, h = TS * 2.1;
    cx.fillStyle = '#c7986a'; cx.fillRect(px - w, py - h, w * 2, h);
    cx.fillStyle = '#d8ad80'; cx.fillRect(px - w - 3, py - h - 4, w * 2 + 6, 6);
    cx.fillStyle = 'rgba(120,80,50,.25)'; for (let r = 1; r < 5; r++) cx.fillRect(px - w, py - h + r * h / 5, w * 2, 1.5);
    cx.fillStyle = '#4a3020'; cx.fillRect(px - w * 0.2, py - h * 0.55, w * 0.4, h * 0.55);
    cx.fillRect(px + w * 0.45, py - h * 0.8, w * 0.22, h * 0.2);
  }
  function kiln(x, y, t, lit) {
    const px = sx(x), py = sy(y);
    cx.fillStyle = '#8f6a4a'; cx.beginPath(); cx.ellipse(px, py, TS * 0.8, TS * 1.0, 0, Math.PI, 0); cx.fill();
    if (lit) { cx.fillStyle = 'rgba(255,150,60,.9)'; cx.beginPath(); cx.ellipse(px, py, TS * 0.25, TS * 0.3, 0, Math.PI, 0); cx.fill(); }
    smoke(px, py - TS, t, 0.35);
  }
  function smoke(px, py, t, a) {
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.35 + i / 5) % 1);
      cx.fillStyle = `rgba(230,230,230,${a * (1 - k)})`;
      cx.beginPath(); cx.arc(px + Math.sin(k * 6 + i) * TS * 0.3 + k * TS * 0.6, py - k * TS * 2.4, TS * (0.15 + k * 0.4), 0, Math.PI * 2); cx.fill();
    }
  }
  function scaffold(x0, x1, y, h) { // ピラミッドの工事場
    cx.strokeStyle = '#8a6a44'; cx.lineWidth = 3;
    for (let x = x0; x <= x1; x += 2) { cx.beginPath(); cx.moveTo(sx(x), sy(y)); cx.lineTo(sx(x), sy(y + h)); cx.stroke(); }
    for (let k = 1; k <= h; k += 1.5) { cx.beginPath(); cx.moveTo(sx(x0), sy(y + k)); cx.lineTo(sx(x1), sy(y + k)); cx.stroke(); }
    cx.fillStyle = '#d6bf95'; for (let i = 0; i < 4; i++) cx.fillRect(sx(x0 + 1 + i * 1.3), sy(y + 1), TS * 0.9, TS * 0.9);
  }
  function wheat(c, y, t) {
    const px = sx(c), py = sy(y);
    cx.strokeStyle = '#c9a845'; cx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const bx = px + TS * (i + 0.5) / 6, sw = Math.sin(t * 1.5 + c + i) * 2;
      cx.beginPath(); cx.moveTo(bx, py); cx.lineTo(bx + sw, py - TS * 0.8); cx.stroke();
      cx.fillStyle = '#d8b450'; cx.fillRect(bx + sw - 1.5, py - TS * 0.95, 3, TS * 0.22);
    }
  }
  function caveMouth(E) { // 家のほら穴（丘の急なところ）
    const top = Wd.H(6, E);
    cx.fillStyle = 'rgba(28,20,16,.92)';
    cx.beginPath(); cx.ellipse(sx(6.6), sy(Wd.H(7, E)), TS * 1.4, TS * 1.9, -0.1, Math.PI, 0); cx.fill();
    cx.fillStyle = 'rgba(0,0,0,.2)'; cx.fillRect(sx(5), sy(top + 0.2), TS * 3, 3);
  }
  function firePit(x, y, t, lit) {
    const px = sx(x), py = sy(y);
    cx.fillStyle = '#6d6058'; for (let i = -2; i <= 2; i++) { cx.beginPath(); cx.ellipse(px + i * TS * 0.18, py - 2, TS * 0.12, TS * 0.08, 0, 0, Math.PI * 2); cx.fill(); }
    cx.strokeStyle = '#3a2618'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(px - TS * 0.3, py - 3); cx.lineTo(px + TS * 0.25, py - TS * 0.2); cx.moveTo(px + TS * 0.3, py - 3); cx.lineTo(px - TS * 0.2, py - TS * 0.22); cx.stroke();
    if (lit) {
      const f = 0.8 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7) * 0.1;
      const g = cx.createRadialGradient(px, py - TS * 0.3, 2, px, py - TS * 0.3, TS * 2.2);
      g.addColorStop(0, 'rgba(255,190,90,.45)'); g.addColorStop(1, 'rgba(255,190,90,0)');
      cx.fillStyle = g; cx.fillRect(px - TS * 2.2, py - TS * 2.5, TS * 4.4, TS * 4.4);
      cx.fillStyle = '#ffb347'; cx.beginPath(); cx.moveTo(px - TS * 0.22, py - 3); cx.quadraticCurveTo(px, py - TS * 0.9 * f, px + TS * 0.22, py - 3); cx.fill();
      cx.fillStyle = '#fff0b0'; cx.beginPath(); cx.moveTo(px - TS * 0.1, py - 3); cx.quadraticCurveTo(px, py - TS * 0.45 * f, px + TS * 0.1, py - 3); cx.fill();
    } else smoke(px, py - 4, t, 0.25);
  }

  function bubble(x, y, text) { // ふきだし
    const px = sx(x), py = sy(y);
    cx.font = `${Math.max(12, Math.round(TS * 0.42))}px "Hiragino Sans","Yu Gothic UI","Meiryo",sans-serif`;
    const maxW = Math.min(vw * 0.6, TS * 9);
    const lines = wrap(text, maxW);
    const lh = TS * 0.6, w = Math.max(...lines.map(l => cx.measureText(l).width)) + TS * 0.6, h = lines.length * lh + TS * 0.4;
    const bx = clamp(px - w / 2, 8, vw - w - 8), by = py - h - TS * 0.4;
    cx.fillStyle = 'rgba(255,252,244,.96)'; cx.strokeStyle = 'rgba(60,40,20,.35)'; cx.lineWidth = 1.5;
    roundRect(bx, by, w, h, 8); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(px - 6, by + h - 1); cx.lineTo(px, by + h + 8); cx.lineTo(px + 6, by + h - 1); cx.fill();
    cx.fillStyle = '#2a1f17'; cx.textBaseline = 'top';
    lines.forEach((l, i) => cx.fillText(l, bx + TS * 0.3, by + TS * 0.2 + i * lh));
  }
  function wrap(text, maxW) {
    const out = []; let cur = '';
    for (const ch of text) { if (ch === '\n') { out.push(cur); cur = ''; continue; } if (cx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch; }
    if (cur) out.push(cur); return out;
  }
  function roundRect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

  // 右はしの年のものさし（上下＝時間）
  function shortYear(e) {
    const y = Wd.yearAt(e);
    if (y >= 1) return Math.round(y / 10) * 10 + '';
    const n = -y;
    return n >= 10000 ? '前' + (n / 10000).toFixed(1) + '万' : '前' + Math.round(n / 100) * 100;
  }
  function ruler(E) {
    const x = vw - 8;
    cx.fillStyle = 'rgba(20,16,12,.28)'; cx.fillRect(x - 2, 0, 4, vh);
    cx.font = `11px "Hiragino Sans","Yu Gothic UI",sans-serif`; cx.textAlign = 'right'; cx.textBaseline = 'middle';
    const j0 = Math.floor(cam.y - vh / TS / 2), j1 = Math.ceil(cam.y + vh / TS / 2);
    for (let j = j0; j <= j1; j++) {
      const y = sy(j), big = j % 3 === 0;
      cx.fillStyle = 'rgba(20,16,12,.55)'; cx.fillRect(x - (big ? 10 : 5), y, big ? 10 : 5, 1.5);
      if (big) { cx.fillStyle = 'rgba(255,255,255,.85)'; cx.fillText(shortYear(j), x - 14, y + 1); cx.fillStyle = 'rgba(20,16,12,.8)'; cx.fillText(shortYear(j), x - 14.5, y); }
    }
    const py = sy(E);
    cx.fillStyle = '#d9480f'; cx.beginPath(); cx.moveTo(x - 14, py - 6); cx.lineTo(x - 2, py); cx.lineTo(x - 14, py + 6); cx.fill();
    cx.textAlign = 'left';
  }

  // ---- 年が変わるときの見せ方 ----
  // いっぺんに変わったとき: 前の画面をとっておき、0.35 秒で消していく
  let snap = null, snapA = 0;
  function snapshot() {
    if (!snap) snap = document.createElement('canvas');
    snap.width = cv.width; snap.height = cv.height;
    snap.getContext('2d').drawImage(cv, 0, 0);
    snapA = 1;
  }
  function fade(dt) {
    if (snapA <= 0 || !snap) return;
    snapA = Math.max(0, snapA - dt / 0.35);
    cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = snapA * snapA; cx.drawImage(snap, 0, 0); cx.restore();
  }
  // 続けて流れているとき（落ちる・押し上げられる）: 流れの向きに光の筋と、まわりを少し暗く
  function flow(speed, dE, t) {
    const a = clamp((speed - 2) / 10, 0, 1);
    if (a <= 0) return;
    const up = dE > 0;
    cx.save();
    const g = cx.createRadialGradient(vw / 2, vh / 2, vh * 0.25, vw / 2, vh / 2, vh * 0.85);
    g.addColorStop(0, 'rgba(40,24,10,0)'); g.addColorStop(1, `rgba(40,24,10,${0.45 * a})`);
    cx.fillStyle = g; cx.fillRect(0, 0, vw, vh);
    cx.strokeStyle = up ? `rgba(255,240,200,${0.35 * a})` : `rgba(200,225,255,${0.35 * a})`; cx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = (hash(i, 7) * vw), len = vh * (0.06 + hash(i, 3) * 0.12);
      const y = ((hash(i, 11) * vh + (up ? -1 : 1) * t * vh * (0.9 + hash(i, 5))) % (vh + len) + vh + len) % (vh + len) - len;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y + len); cx.stroke();
    }
    cx.restore();
  }
  // ねらいの枠（dig: 掘るマス / put: 積むマスの影）。label はキーの名前
  function target(c, j, kind, label) {
    const x = sx(c), y = sy(j + 1);
    cx.save();
    if (kind === 'put') { cx.fillStyle = 'rgba(255,240,210,.28)'; cx.fillRect(x + 2, y + 2, TS - 4, TS - 4); }
    cx.strokeStyle = kind === 'dig' ? 'rgba(255,170,60,.95)' : 'rgba(255,250,235,.9)';
    cx.lineWidth = 2; cx.setLineDash([5, 4]); cx.strokeRect(x + 1.5, y + 1.5, TS - 3, TS - 3); cx.setLineDash([]);
    if (label) {
      cx.font = `bold ${Math.max(10, Math.round(TS * 0.32))}px system-ui,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillStyle = 'rgba(30,20,10,.55)'; cx.beginPath(); cx.arc(x + TS / 2, y + TS / 2, TS * 0.22, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#fff4e0'; cx.fillText(label, x + TS / 2, y + TS / 2 + 1);
    }
    cx.restore();
  }
  function parts(list) {
    for (const q of list) { cx.fillStyle = rgb(hex(MAT[q.mat] || MAT.soil), 1.1); cx.globalAlpha = clamp(q.life * 2, 0, 1); cx.fillRect(sx(q.x) - 2, sy(q.y) - 2, 4, 4); }
    cx.globalAlpha = 1;
  }

  window.Draw = { init, resize, follow, toCell, sky, terrain, person, mammoth, hut, house, kiln, scaffold, wheat, caveMouth, firePit, bubble, ruler, smoke,
    snapshot, fade, flow, target, parts,
    get TS() { return TS; }, get vw() { return vw; }, get vh() { return vh; }, cam, sx, sy, ctx: () => cx, dpr: () => dpr };
})();
