// 1秒のページ（2D世界）の絵。空は透明にして、ページを重ねると地面が奥行きにのびて見えるようにする。
import { look, kindColor } from './look/index.js?v=99';
import { dizzyStars } from './look/ink.js?v=99';

export const S = 20; // 1マスのピクセル
// 未確定のうすれ方（v100。ユーザー「断面に触れてワンテンポおいてから薄くなりはじめ、ゆるやかに収束」）:
// ふれてから DRAFT_HOLD 秒はそのまま、そこから DRAFT_FADE 秒かけて、はじめも終わりもなめらかに（smoothstep）消えきる
export const DRAFT_HOLD = 1, DRAFT_FADE = 7;
export const draftK = (dt) => { const u = Math.max(0, Math.min(1, (dt - DRAFT_HOLD) / DRAFT_FADE)); return u * u * (3 - 2 * u); };

const cache = new Map();

// 動かない地形（どのページでも同じ）を見た目ごとに一度だけ描く
export function terrainCanvas(L) {
  const key = look().id + ':' + L.id;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = L.W * S; cv.height = L.H * S;
  look().drawTerrain(cv.getContext('2d'), L, S);
  cache.set(key, cv);
  return cv;
}

export function drawWalker(g, L, f, scale = 1, t = 0) {
  if (!f) return;
  // 高い所から落ちて気絶（v074）: 地面にのびて、目を回す。奈落へ落ちたときは見えない
  if (f.st === 'dead') { if (f.faint != null) (look().drawFaint || faintFallback)(g, L, f, S, Math.max(0, t - f.faint), scale); return; }
  look().drawWalker(g, L, f, S, scale);
}
// 気絶の絵がない住人: 歩く絵をたおして、頭の上に星
function faintFallback(g, L, f, S, since, scale) {
  g.save(); g.translate(f.x * S, (L.H - f.y) * S); g.rotate(-Math.PI / 2 * f.dir); g.translate(-f.x * S, -(L.H - f.y) * S);
  look().drawWalker(g, L, { ...f, st: 'idle' }, S, scale);
  g.restore();
  dizzyStars(g, f.x * S, (L.H - f.y) * S - 12 * scale, since, scale);
}

// スイッチと扉（v081）: 真鍮の板と、鉄の格子の扉。板が押されているあいだ、扉は上へ引き上げられている
const INK = '#3b2a1c', BRASS = '#c89a48';
function drawSwitch(g, L, sw, on) {
  const py = (y) => (L.H - y) * S;
  // 板
  const top = L.tops[Math.floor(sw.x)], x0 = (sw.x - sw.w / 2) * S, x1 = (sw.x + sw.w / 2) * S, y = py(top);
  const th = on ? 2 : sw.heavy ? 9 : 6;
  // 重いスイッチ（v082）: 鉄の板にびょうと、おもりの印
  g.fillStyle = sw.heavy ? '#6f675c' : BRASS; g.strokeStyle = INK; g.lineWidth = 1.2;
  g.fillRect(x0 + 2, y - th, x1 - x0 - 4, th); g.strokeRect(x0 + 2, y - th, x1 - x0 - 4, th);
  g.fillStyle = 'rgba(255,240,200,.6)'; g.fillRect(x0 + 4, y - th + 1, x1 - x0 - 8, 1);
  if (sw.heavy) {
    g.fillStyle = INK;
    for (const rx of [x0 + 6, x1 - 6]) { g.beginPath(); g.arc(rx, y - th / 2, 1.4, 0, 7); g.fill(); }
    if (!on) { // おもりの印（台形と輪）
      const cx = (x0 + x1) / 2, by = y - th - 3;
      g.fillStyle = '#6f675c'; g.beginPath(); g.moveTo(cx - 7, by); g.lineTo(cx + 7, by); g.lineTo(cx + 5, by - 9); g.lineTo(cx - 5, by - 9); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(cx, by - 11, 2.6, 0, 7); g.stroke();
    }
  }
  // 扉: 柱とまぐさ、格子（開いているときは上へ）
  const d = sw.door, gy = py(L.tops[Math.floor(d.x)]), dh = d.h * S, dx = d.x * S, hw = 0.42 * S;
  const lift = on ? dh * 0.82 : 0;
  g.save();
  g.beginPath(); g.rect(dx - hw - 2, gy - dh - 8, hw * 2 + 4, dh + 8); g.clip();
  g.strokeStyle = INK; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const bx = dx - hw * 0.66 + i * hw * 0.66; g.beginPath(); g.moveTo(bx, gy - dh - lift); g.lineTo(bx, gy - lift); g.stroke(); }
  g.lineWidth = 1.4;
  for (let j = 1; j < 4; j++) { const by = gy - lift - (dh * j) / 4; g.beginPath(); g.moveTo(dx - hw, by); g.lineTo(dx + hw, by); g.stroke(); }
  // 下のとがった先
  g.fillStyle = INK;
  for (let i = 0; i < 3; i++) { const bx = dx - hw * 0.66 + i * hw * 0.66; g.beginPath(); g.moveTo(bx - 2.5, gy - lift - 1); g.lineTo(bx + 2.5, gy - lift - 1); g.lineTo(bx, gy - lift + 4); g.fill(); }
  g.restore();
  // 柱とまぐさ（真鍮）
  g.fillStyle = BRASS; g.strokeStyle = INK; g.lineWidth = 1.2;
  for (const sx of [dx - hw - 4, dx + hw]) { g.fillRect(sx, gy - dh - 6, 4, dh + 6); g.strokeRect(sx, gy - dh - 6, 4, dh + 6); }
  g.fillRect(dx - hw - 6, gy - dh - 10, hw * 2 + 12, 5); g.strokeRect(dx - hw - 6, gy - dh - 10, hw * 2 + 12, 5);
}

// 未確定の住人を描く下じき（1枚を使いまわす）
let lay = null;
function layer(W, H) {
  if (!lay) lay = document.createElement('canvas').getContext('2d');
  if (lay.canvas.width !== W || lay.canvas.height !== H) { lay.canvas.width = W; lay.canvas.height = H; } else lay.clearRect(0, 0, W, H);
  return lay;
}
// 小窓など 2D の絵の中の未確定: ぼかし、色を抜き、金の光のにじみをまとわせて、うすれる（3D のページでは stage3d.js のシェーダーで描く）
function unsure(g, src, W, H, t, k) {
  g.save();
  g.globalAlpha = 1 - k; // 底で消えきる（v098）
  g.filter = `blur(${(0.9 * k).toFixed(2)}px) grayscale(${(0.85 * k).toFixed(2)}) sepia(${(0.3 * k).toFixed(2)})`;
  g.shadowColor = `rgba(255,214,140,${(0.85 * Math.sin(Math.PI * k)).toFixed(2)})`; g.shadowBlur = 9 * k;
  g.drawImage(src, 0, 0);
  g.restore();
}

// ページを描く。opt.paper: 紙の地を敷く、opt.label: 秒の札
// opt.draftFrom: この秒より先は「未確定」（住人・石がゆがんで消えていく。刷りそこないも出さない）、opt.noJoy: 巣に着いても、よろこぶ・卵がかえるを描かない
// （v095。正史にする前に、3D の未来で巣の喜びが見えて答えがわかってしまうのをふせぐ。ユーザー「正史にする前に答えがわかっちゃう」）
export function drawSheet(g, L, t, frame, secs, opt = {}) {
  const W = L.W * S, H = L.H * S;
  g.clearRect(0, 0, W, H);
  if (opt.paper) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, look().paper[0]); gr.addColorStop(1, look().paper[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (look().drawBackdrop) look().drawBackdrop(g, L, S);
  }
  g.drawImage(terrainCanvas(L), 0, 0);
  // 巣に着いてからの時間（よろこぶ・卵がかえる）。住人が二羽いれば、それぞれ自分が着いた時刻から（v081）
  const since = !opt.noJoy && frame && frame.st === 'goal' && (frame.gt != null || opt.goalT != null) ? t - (frame.gt != null ? frame.gt : opt.goalT) : null;
  // 時刻の窓のあいだは、ゴールが光る（まだ着いていなければ）
  if (since === null && L.window && t >= L.window[0] && t <= L.window[1] && look().drawGoalReady) look().drawGoalReady(g, L, S, t);
  if (since !== null && look().drawGoalJoy) look().drawGoalJoy(g, L, S, since);
  const others = (frame && frame.others) || [];
  if (!opt.noJoy) others.forEach((o, n) => { const m = L.more && L.more[n]; if (m && o.st === 'goal' && o.gt != null && look().drawGoalJoy) look().drawGoalJoy(g, { ...L, start: m.start, goal: m.goal }, S, t - o.gt); });
  if (L.switches) L.switches.forEach((sw, n) => drawSwitch(g, L, sw, !!(frame && frame.sw && frame.sw[n])));
  for (const s of secs) look().drawSection(g, L, s, S, kindColor(s.p.kind));
  // 未確定（v096・v097）: 形にふれて歴史が分かれた秒から先は、住人と石がうすれていく（DRAFT_FADE 秒で底まで）
  const draft = opt.draftFrom != null && t > opt.draftFrom ? draftK(t - opt.draftFrom) : 0;
  // opt.ghost: 3D のページ。未確定の住人と石はページに描かず、3D の幽霊（stage3d.js）にまかせる
  const lg = draft ? (opt.ghost ? null : layer(W, H)) : g;
  if (lg) {
  if (frame && frame.stones) for (const st of frame.stones) if (st.st !== 'gone') look().drawStone(lg, L, st, S);
  drawWalker(lg, L, since !== null ? { ...frame, since } : frame, 1, t);
  others.forEach((o) => drawWalker(lg, L, !opt.noJoy && o.st === 'goal' && o.gt != null ? { ...o, since: t - o.gt } : o, 1, t));
  if (draft) unsure(g, lg.canvas, W, H, t, draft);
  }
  // 刷りそこない（だめな歴史の、つまずいたあとのページ）: 紙の色をかぶせてかすれさせる。下書きの先でつまずくなら出さない
  if (opt.misprintAfter != null && t > opt.misprintAfter && !(opt.draftFrom != null && opt.misprintAfter > opt.draftFrom)) {
    const u = Math.min(1, (t - opt.misprintAfter) / 1.5);
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(244,234,210,${0.62 * u})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(120,90,55,${0.18 * u})`;
    for (let i = 0; i < 60; i++) { const x = (i * 97) % W, y = (i * 53) % H; g.fillRect(x, y, 14 + (i % 5) * 6, 1); }
    g.restore();
  }
  if (opt.label) {
    g.font = 'bold 15px system-ui, sans-serif';
    g.fillStyle = look().labelColor || 'rgba(40,50,70,.75)';
    g.fillText(opt.label, 8, 20);
  }
}
