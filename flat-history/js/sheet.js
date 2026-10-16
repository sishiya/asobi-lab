// 1秒のページ（2D世界）の絵。空は透明にして、ページを重ねると地面が奥行きにのびて見えるようにする。
import { look, kindColor } from './look/index.js?v=17';

export const S = 20; // 1マスのピクセル

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

export function drawWalker(g, L, f, scale = 1) {
  if (!f || f.st === 'dead') return;
  look().drawWalker(g, L, f, S, scale);
}

// ページを描く。opt.paper: 紙の地を敷く、opt.label: 秒の札
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
  // 巣に着いてからの時間（よろこぶ・卵がかえる）
  const since = frame && frame.st === 'goal' && opt.goalT != null ? t - opt.goalT : null;
  if (since !== null && look().drawGoalJoy) look().drawGoalJoy(g, L, S, since);
  for (const s of secs) look().drawSection(g, L, s, S, kindColor(s.p.kind));
  drawWalker(g, L, since !== null ? { ...frame, since } : frame);
  if (opt.label) {
    g.font = 'bold 15px system-ui, sans-serif';
    g.fillStyle = look().labelColor || 'rgba(40,50,70,.75)';
    g.fillText(opt.label, 8, 20);
  }
}
