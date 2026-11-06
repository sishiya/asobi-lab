// 花の小川: 水彩の花の絵（ルック案1「水彩の花畑」。2026-11-07 ユーザーが選んだ）。
// 土手の花は つぼみ・半分・満開 の3つの絵を前もって描き（sprite）、毎こまは drawImage だけ。
// 出口の7段の花（作る人の呼び名は段の番号。画面では花の名前だけ）も、ここで描く。

export const KINDS = {
  daisy:  { petals: 12, color: [255, 250, 238], eye: '#ffd75e' },
  cosmos: { petals: 8,  color: [243, 154, 192], eye: '#ffd75e' },
  bell:   { petals: 5,  color: [183, 166, 240], eye: '#fff4c0' },
  rare:   { petals: 10, color: [255, 93, 143],  eye: '#ffe27a' },
};
export const GRADE_NAME = ['', 'スズランの小さな鈴', 'アジサイの房', '枝咲きのフジ', '大輪のシャクヤク', '八重の花びら', 'タンポポの綿毛', '霧の虹'];

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 水彩の花びら: まん中が濃く、ふちへうすれ、ふちに少しだけ色がたまる（にじみのふち）
function petal(g, x, y, rx, ry, a, c, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rx);
  gr.addColorStop(0, rgba(c, 0.95 * alpha)); gr.addColorStop(0.7, rgba(c, 0.6 * alpha)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 6.3); g.fill();
  g.strokeStyle = rgba(c.map(v => v * 0.82), 0.22 * alpha); g.lineWidth = 1; g.stroke();
}
function eye(g, x, y, r, col) {
  g.fillStyle = col; g.globalAlpha = 0.9; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.globalAlpha = 1;
}

// 土手の花を1つ、(x, y) に半径 r で。stage 0 ねむっている（小さく、色がうすい）・1 ひらきかけ・2 満開（あざやか）
// ねむっている花もいつも花の形にする（つぼみの粒だらけだと、華やかにならない。ユーザー「とにかく華やかさを大事に」）
export function drawBankFlower(g, kind, stage, x, y, r, rot = 0) {
  const K = KINDS[kind];
  const pale = stage === 0 ? 0.62 : stage === 1 ? 0.3 : 0;
  const col = K.color.map(v => Math.round(v + (236 - v) * pale));
  const rr = r * (stage === 0 ? 0.55 : stage === 1 ? 0.78 : 1);
  for (let i = 0; i < K.petals; i++) {
    const a = rot + i * 6.283 / K.petals;
    petal(g, x + Math.cos(a) * rr * 0.72, y + Math.sin(a) * rr * 0.72, rr * 0.6, rr * 0.34, a, col, stage === 0 ? 0.7 : stage === 1 ? 0.85 : 1);
  }
  eye(g, x, y, rr * 0.26, stage === 0 ? '#e8dfb0' : K.eye);
  if (kind === 'rare' && stage === 2) {  // めずらしい花は、ほのかに光る
    const gl = g.createRadialGradient(x, y, 0, x, y, r * 2);
    gl.addColorStop(0, 'rgba(255,240,200,0.5)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gl; g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  }
}

// sprite（土手の花）: key = kind + stage。大きさ S（画面の px × dpr）で前もって描く
const SPR = new Map();
export function bankSprite(kind, stage, S) {
  const key = `${kind}${stage}${S}`;
  if (!SPR.has(key)) {
    const c = canvas(S * 2, S * 2), g = c.getContext('2d');
    drawBankFlower(g, kind, stage, S, S, S * 0.45, 0.4);
    SPR.set(key, c);
  }
  return SPR.get(key);
}

// ---------- 出口の7段の花 ----------
// (x, y) を根もと（花のまん中）に、大きさ r。t は咲きぐあい 0〜1（咲くときの動き）
export function drawGradeFlower(g, grade, x, y, r, t = 1, seed = grade) {
  const R = rng(seed * 97 + 3), e = Math.max(0, Math.min(1, t));
  g.save();
  switch (grade) {
    case 1: {  // スズラン: 弓なりの茎に白い小さな鈴
      g.strokeStyle = 'rgba(96,150,90,0.85)'; g.lineWidth = r * 0.05;
      g.beginPath(); g.moveTo(x - r * 0.6, y + r * 0.6); g.quadraticCurveTo(x - r * 0.1, y - r * 0.9, x + r * 0.6, y - r * 0.2); g.stroke();
      g.fillStyle = 'rgba(110,170,100,0.55)'; g.beginPath(); g.ellipse(x - r * 0.35, y + r * 0.25, r * 0.16, r * 0.6, -0.3, 0, 6.3); g.fill();
      for (let i = 0; i < 5; i++) {
        const u = 0.3 + i * 0.15, bx = x - r * 0.6 + u * r * 1.2, by = y - r * 0.55 + Math.pow(u - 0.5, 2) * r * 1.6 + r * 0.22;
        petal(g, bx, by, r * 0.16 * e, r * 0.19 * e, 0, [255, 255, 248]);
      }
      break;
    }
    case 2: {  // アジサイ: 小さな4枚の花が集まった丸い房
      for (let i = 0; i < 26; i++) {
        const a = R() * 6.283, d = Math.sqrt(R()) * r * 0.62 * e, fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.85;
        const c = [150 + R() * 40, 160 + R() * 30, 235];
        for (let k = 0; k < 4; k++) { const b = k * 1.571 + R(); petal(g, fx + Math.cos(b) * r * 0.08, fy + Math.sin(b) * r * 0.08, r * 0.11, r * 0.08, b, c, 0.9); }
      }
      break;
    }
    case 3: {  // フジ: 垂れ下がる房
      g.strokeStyle = 'rgba(110,140,90,0.8)'; g.lineWidth = r * 0.04;
      g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.7); g.quadraticCurveTo(x, y - r * 0.85, x + r * 0.7, y - r * 0.6); g.stroke();
      for (const ox of [-0.35, 0.05, 0.42]) for (let i = 0; i < 9; i++) {
        const u = i / 8, w = (1 - u) * 0.16 + 0.05;
        petal(g, x + ox * r + (R() - 0.5) * r * w, y - r * 0.6 + u * r * 1.3 * e, r * 0.1, r * 0.075, 0.3, [190 - u * 30, 160 - u * 20, 235], 0.95);
      }
      break;
    }
    case 4: {  // シャクヤク: 何重にも重なる大輪
      for (let ring = 0; ring < 4; ring++) {
        const n = 12 - ring * 2, rr = r * (0.7 - ring * 0.15) * (0.5 + 0.5 * e);
        for (let i = 0; i < n; i++) { const a = i * 6.283 / n + ring * 0.4; petal(g, x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, rr * 0.55, rr * 0.4, a, [250 - ring * 4, 150 + ring * 18, 180 + ring * 10]); }
      }
      eye(g, x, y, r * 0.1, '#ffe08a');
      break;
    }
    case 5: {  // 八重の花びら: ゆるく重なる、やわらかい桃色
      for (let ring = 0; ring < 2; ring++) {
        const n = 10, rr = r * (0.6 - ring * 0.2) * (0.5 + 0.5 * e);
        for (let i = 0; i < n; i++) { const a = i * 6.283 / n + ring * 0.3 + (R() - 0.5) * 0.3; petal(g, x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 0.7, rr * 0.5, rr * 0.3, a, [255, 200, 190], 0.85); }
      }
      eye(g, x, y, r * 0.09, '#ffe08a');
      break;
    }
    case 6: {  // タンポポの綿毛
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const a = R() * 6.283, d = r * (0.45 + R() * 0.15) * e;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.05, 0, 6.3); g.fill();
      }
      eye(g, x, y, r * 0.08, 'rgba(210,200,150,0.9)');
      break;
    }
    case 7: {  // 霧の虹
      const cols = [[255, 140, 160], [255, 200, 120], [255, 240, 140], [150, 220, 160], [140, 190, 240], [180, 150, 230]];
      g.lineWidth = r * 0.07; g.lineCap = 'round';
      cols.forEach((c, i) => { g.strokeStyle = rgba(c, 0.55); g.beginPath(); g.arc(x, y + r * 0.35, r * (0.75 - i * 0.075), Math.PI * (1 + 0.5 * (1 - e)), Math.PI * (2 - 0.5 * (1 - e))); g.stroke(); });
      for (let i = 0; i < 8; i++) { const mx = x + (R() - 0.5) * r * 1.6, my = y + r * (0.2 + R() * 0.3); const gr = g.createRadialGradient(mx, my, 0, mx, my, r * 0.3); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(mx - r * 0.3, my - r * 0.3, r * 0.6, r * 0.6); }
      break;
    }
  }
  g.restore();
}

// 7段の花の小さな sprite（つぼみの予想・庭の列に使う）
const GSPR = new Map();
export function gradeSprite(grade, S) {
  const key = `${grade}:${S}`;
  if (!GSPR.has(key)) {
    const c = canvas(S * 2, S * 2), g = c.getContext('2d');
    drawGradeFlower(g, grade, S, S, S * 0.85);
    GSPR.set(key, c);
  }
  return GSPR.get(key);
}
