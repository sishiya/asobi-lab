// 2D世界の決まったルール。置いた3Dの形は、その秒の断面（長方形）として2D世界に現れる。
import { KINDS } from './level.js';

export const DT = 0.1;          // 1コマ＝0.1秒
const SPEED = 1.5;              // 2D人の歩く速さ（マス/秒）
const HALF = 0.15;              // 足もとの半分の幅
const BODY = 0.9;               // 背の高さ
const STEP = 1.05;              // のぼれる段
const SAFE_FALL = 3.5;          // これより高く落ちるとだめ
const G = 22;

// 3Dの形 p の、時刻 t のページでの断面
export function section(p, t) {
  const k = KINDS[p.kind];
  if (t < p.t0 - 1e-6 || t >= p.t0 + k.d - 1e-6) return null;
  const y = p.y0 + k.slope * (t - p.t0);
  return { x0: p.x0, x1: p.x0 + k.w, y0: y, y1: y + k.h, p };
}

export function sectionsAt(pieces, t) {
  const r = [];
  for (const p of pieces) { const s = section(p, t); if (s) r.push(s); }
  return r;
}

function terrTop(L, c) {
  if (c < 0 || c >= L.W) return Infinity; // 世界のはしは壁
  return L.tops[c];
}

// 足もとの、高さ lim 以下でいちばん高い面
function support(L, x, lim, secs) {
  let best = -Infinity;
  for (const c of [Math.floor(x - HALF), Math.floor(x + HALF)]) {
    const tp = terrTop(L, c);
    if (tp <= lim && tp > best) best = tp;
  }
  for (const s of secs) {
    if (x + HALF > s.x0 && x - HALF < s.x1 && s.y1 <= lim && s.y1 > best) best = s.y1;
  }
  return best;
}

// 進む先 fx で、体にぶつかるもののいちばん上
function blockTop(L, fx, y, secs) {
  let best = -Infinity;
  const tp = terrTop(L, Math.floor(fx));
  if (tp > y + 0.02) best = tp;
  for (const s of secs) {
    if (fx > s.x0 && fx < s.x1 && s.y1 > y + 0.02 && s.y0 < y + BODY && s.y1 > best) best = s.y1;
  }
  return best;
}

// はじめから終わりまで計算する。frames[k] は時刻 k*DT の2D人
export function simulate(L, pieces) {
  const N = Math.round(L.T / DT);
  const frames = new Array(N + 1);
  const events = [];
  const w = { x: L.start.x, y: L.tops[Math.floor(L.start.x)], dir: 1, vy: 0, st: 'walk', from: 0 };
  let end = null;
  for (let k = 0; k <= N; k++) {
    const t = k * DT;
    const secs = sectionsAt(pieces, t);
    if (w.st === 'walk' || w.st === 'fall') {
      // 断面が足もとに現れた・下から上がってきた → 押し上げられる
      for (const s of secs) {
        if (w.x + HALF > s.x0 && w.x - HALF < s.x1 && s.y0 < w.y + 0.6 && s.y1 > w.y + 1e-6) {
          w.y = s.y1;
          if (w.st === 'fall') { w.st = 'walk'; w.vy = 0; }
        }
      }
    }
    frames[k] = { x: w.x, y: w.y, dir: w.dir, st: w.st };
    if (w.st !== 'walk' && w.st !== 'fall') continue;

    const sup = support(L, w.x, w.y + 0.02, secs);
    if (w.st === 'walk') {
      if (w.y - sup > 0.2) { w.st = 'fall'; w.from = w.y; w.vy = 0; }
      else {
        w.y = sup;
        const nx = w.x + w.dir * SPEED * DT;
        const bt = blockTop(L, nx + w.dir * HALF, w.y, secs);
        if (bt > -Infinity) {
          if (bt - w.y <= STEP) { w.y = bt; w.x = nx; }
          else { w.dir = -w.dir; events.push({ t, type: 'turn', x: w.x, y: w.y }); }
        } else w.x = nx;
        if (w.x >= L.goal.x) {
          w.st = 'goal';
          end = { type: 'goal', t, x: w.x, y: w.y };
          events.push(end);
        }
      }
    }
    if (w.st === 'fall') {
      w.vy -= G * DT;
      const ny = w.y + w.vy * DT;
      if (ny <= sup) {
        w.y = sup; w.vy = 0;
        if (w.from - w.y > SAFE_FALL) { w.st = 'dead'; end = { type: 'fall', t, x: w.x, y: w.y }; events.push(end); }
        else w.st = 'walk';
      } else {
        w.y = ny;
        if (w.y < -3) { w.st = 'dead'; end = { type: 'abyss', t, x: w.x, y: w.y }; events.push(end); }
      }
    }
  }
  if (!end) end = { type: 'time', t: L.T, x: w.x, y: w.y };
  return { frames, events, end };
}

// 時刻 t の2D人（コマのあいだはなめらかに）
export function frameAt(frames, t) {
  const f = Math.max(0, Math.min(frames.length - 1, t / DT));
  const i = Math.floor(f), j = Math.min(frames.length - 1, i + 1), u = f - i;
  const a = frames[i], b = frames[j];
  if (a.st !== b.st) return a;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dir: a.dir, st: a.st };
}

// 置き場所: 下にある動かない地形でとまる高さ（底なしの上なら -Infinity）
export function restHeight(L, kind, x0) {
  const k = KINDS[kind];
  let best = -Infinity;
  for (let c = x0; c < x0 + k.w; c++) best = Math.max(best, terrTop(L, c));
  return best;
}

// 置けるか（理由つき）
export function canPlace(L, cand, pieces) {
  const k = KINDS[cand.kind];
  if (cand.y0 === -Infinity) return '下に地面がない（底のない崖）';
  if (cand.y0 + k.h + k.slope * k.d > L.H + 0.01) return '空の上につき出てしまう';
  for (const p of pieces) {
    const kp = KINDS[p.kind];
    const a = Math.max(cand.t0, p.t0), b = Math.min(cand.t0 + k.d, p.t0 + kp.d);
    for (let t = a; t < b; t += 0.25) {
      const s1 = section(cand, t), s2 = section(p, t);
      if (s1 && s2 && s1.x0 < s2.x1 && s2.x0 < s1.x1 && s1.y0 < s2.y1 && s2.y0 < s1.y1) return 'ほかの形とぶつかる';
    }
  }
  return '';
}
