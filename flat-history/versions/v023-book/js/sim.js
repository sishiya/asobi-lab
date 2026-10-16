// 2D世界の決まったルール。置いた3Dの形は、その秒の断面（長方形）として2D世界に現れる。
import { KINDS } from './level.js?v=32';

export const DT = 0.1;          // 1コマ＝0.1秒
const SPEED = 1.5;              // 2D人の歩く速さ（マス/秒）
const HALF = 0.15;              // 足もとの半分の幅
const BODY = 0.9;               // 背の高さ
const STEP = 1.05;              // のぼれる段
const SAFE_FALL = 3.5;          // これより高く落ちるとだめ
const G = 22;

// 3Dの形 p の大きさ。rot=1 なら横と奥行きを入れかえる（ななめの板は、横の方向に上がる坂になる）
export function pieceDims(p) {
  const k = KINDS[p.kind];
  // 平行四辺形の板: 回すと、すべる向きが反対になる（横の広がり wx は、すべる道のりもふくむ）
  if (k.shear) return { wx: k.w + k.shear * k.d, dz: k.d, h: k.h, slope: 0, along: 'z', wbase: k.w, vx: p.rot ? -k.shear : k.shear };
  return p.rot
    ? { wx: k.d, dz: k.w, h: k.h, slope: k.slope, along: 'x' }
    : { wx: k.w, dz: k.d, h: k.h, slope: k.slope, along: 'z' };
}

// 3Dの形 p の、時刻 t のページでの断面（長方形の並び。坂は半マスずつの段で表す）
export function sectionRects(p, t) {
  const d = pieceDims(p);
  if (t < p.t0 - 1e-6 || t >= p.t0 + d.dz - 1e-6) return [];
  if (d.vx) {
    // すべる足場: その秒の位置
    const u = t - p.t0;
    const xs = d.vx > 0 ? p.x0 + d.vx * u : p.x0 + (d.wx - d.wbase) + d.vx * u;
    return [{ x0: xs, x1: xs + d.wbase, y0: p.y0, y1: p.y0 + d.h, p, vx: d.vx }];
  }
  if (d.along === 'z') {
    const y = p.y0 + d.slope * (t - p.t0);
    return [{ x0: p.x0, x1: p.x0 + d.wx, y0: y, y1: y + d.h, p }];
  }
  if (!d.slope) return [{ x0: p.x0, x1: p.x0 + d.wx, y0: p.y0, y1: p.y0 + d.h, p }];
  const r = [];
  for (let i = 0; i < d.wx * 2; i++) {
    const y = p.y0 + d.slope * (i / 2 + 0.25);
    r.push({ x0: p.x0 + i / 2, x1: p.x0 + i / 2 + 0.5, y0: y, y1: y + d.h, p });
  }
  return r;
}

export function sectionsAt(pieces, t) {
  const r = [];
  for (const p of pieces) for (const s of sectionRects(p, t)) r.push(s);
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

// ---- ころがる石（2D世界の物。決まった時刻にころがりだす） ----
// 1マスの石。壁や形にぶつかると止まる。足もとがなければ落ちる。幅1マスの割れ目に落ちると、はさまって「ふた」になる
const STONE_V = 2;
function stoneRect(s) { return { x0: s.x - 0.5, x1: s.x + 0.5, y0: s.y, y1: s.y + 1, stone: true }; }
function stepStone(L, s, t, secs) {
  if (s.st === 'gone' || s.st === 'plug' || s.st === 'stop') return null;
  if (s.st === 'wait') { if (t >= s.t0) s.st = 'roll'; else return null; }
  const colTop = (c) => (c < 0 || c >= L.W ? Infinity : L.tops[c]);
  const supAt = (x) => {
    let g = colTop(Math.floor(x));
    for (const r of secs) if (x > r.x0 && x < r.x1 && r.y1 <= s.y + 0.05 && r.y1 > g) g = r.y1;
    return g;
  };
  if (s.st === 'roll') {
    const nx = s.x + s.dir * STONE_V * DT, fx = nx + s.dir * 0.5;
    let blocked = colTop(Math.floor(fx)) > s.y + 0.05;
    for (const r of secs) if (fx > r.x0 && fx < r.x1 && r.y0 < s.y + 0.9 && r.y1 > s.y + 0.05) blocked = true;
    if (blocked) { s.st = 'stop'; return { type: 'stoneStop', t, x: s.x }; }
    s.x = nx;
    const c = Math.floor(s.x);
    if (supAt(s.x) < s.y - 0.05 && Math.abs(s.x - (c + 0.5)) < 0.2) {
      // 幅1マスの割れ目なら、はさまってふたになる
      if (colTop(c) < s.y - 1 && colTop(c - 1) >= s.y && colTop(c + 1) >= s.y) {
        s.x = c + 0.5; s.y -= 1; s.st = 'plug';
        return { type: 'plug', t, x: s.x };
      }
      s.st = 'fall'; s.vy = 0;
    }
  }
  if (s.st === 'fall') {
    s.vy -= G * DT; const ny = s.y + s.vy * DT;
    const g = supAt(s.x);
    if (ny <= g) { s.y = g; s.st = 'roll'; } else { s.y = ny; if (s.y < -3) { s.st = 'gone'; return { type: 'stoneGone', t, x: s.x }; } }
  }
  return null;
}

// はじめから終わりまで計算する。frames[k] は時刻 k*DT の2D人
export function simulate(L, pieces) {
  const N = Math.round(L.T / DT);
  const frames = new Array(N + 1);
  const events = [];
  const w = { x: L.start.x, y: L.tops[Math.floor(L.start.x)], dir: L.start.dir || 1, vy: 0, st: 'walk', from: 0 };
  let end = null, overlap = null, nestPass = null;
  const stones = (L.stones || []).map((s) => ({ x: s.x, y: L.tops[Math.floor(s.x)], dir: s.dir, t0: s.t, st: 'wait', vy: 0 }));
  for (let k = 0; k <= N; k++) {
    const t = k * DT;
    const pieceSecs = sectionsAt(pieces, t);
    for (const s of stones) { const ev = stepStone(L, s, t, pieceSecs); if (ev) events.push(ev); }
    // 住人には、石も固い物
    const secs = pieceSecs.concat(stones.filter((s) => s.st !== 'gone').map(stoneRect));
    if (w.st === 'walk' || w.st === 'fall') {
      // 断面が体に重なって現れた・下から上がってきた
      for (const s of secs) {
        if (w.x + HALF > s.x0 && w.x - HALF < s.x1 && s.y0 < w.y + BODY && s.y1 > w.y + 1e-6) {
          if (s.y1 - s.y0 <= STEP && s.y1 - w.y <= STEP && s.y0 < w.y + 0.6) {
            // 低い・下から → 押し上げられる
            w.y = s.y1;
            if (w.st === 'fall') { w.st = 'walk'; w.vy = 0; }
          } else {
            // 背より高い形が、住人のいる所に現れた → そういう置き方は置けない（canPlace が見る）
            if (!overlap) overlap = { t, x: w.x };
            const toL = w.x - s.x0, toR = s.x1 - w.x;
            w.x = toL < toR ? s.x0 - HALF - 0.01 : s.x1 + HALF + 0.01;
          }
        }
      }
    }
    frames[k] = { x: w.x, y: w.y, dir: w.dir, st: w.st, stones: stones.length ? stones.map((s) => ({ x: s.x, y: s.y, st: s.st })) : null };
    if (w.st !== 'walk' && w.st !== 'fall') continue;

    const sup = support(L, w.x, w.y + 0.02, secs);
    if (w.st === 'walk') {
      if (w.y - sup > 0.2) { w.st = 'fall'; w.from = w.y; w.vy = 0; }
      else {
        w.y = sup;
        // すべる足場の上なら、足場といっしょに横へ運ばれる（行く手が壁ならそこで止まる）
        const ride = secs.find((s) => s.vx && Math.abs(s.y1 - sup) < 1e-6 && w.x + HALF > s.x0 && w.x - HALF < s.x1);
        if (ride) {
          const cx = w.x + ride.vx * DT;
          const bt = blockTop(L, cx + Math.sign(ride.vx) * HALF, w.y, secs.filter((s) => s !== ride));
          if (bt === -Infinity || bt - w.y <= 0.02) w.x = cx;
        }
        const nx = w.x + w.dir * SPEED * DT;
        const bt = blockTop(L, nx + w.dir * HALF, w.y, secs);
        if (bt > -Infinity) {
          if (bt - w.y <= STEP) { w.y = bt; w.x = nx; }
          else { w.dir = -w.dir; events.push({ t, type: 'turn', x: w.x, y: w.y }); }
        } else w.x = nx;
        if (Math.abs(w.x - L.goal.x) < 0.3 && w.y >= L.tops[Math.floor(L.goal.x)] - 0.01) {
          // 時刻の窓（卵が光っているあいだ）があるなら、そのあいだに着いたときだけ巣に入る。外れたら通りすぎる
          if (!L.window || (t >= L.window[0] && t <= L.window[1])) {
            w.st = 'goal';
            end = { type: 'goal', t, x: w.x, y: w.y };
            events.push(end);
          } else if (!nestPass || t - nestPass.t > 1) {
            nestPass = { t, early: t < L.window[0] };
            events.push({ type: 'nest', t, x: w.x, early: nestPass.early });
          }
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
  return { frames, events, end, overlap, nestPass };
}

// 時刻 t の2D人（コマのあいだはなめらかに）
export function frameAt(frames, t) {
  const f = Math.max(0, Math.min(frames.length - 1, t / DT));
  const i = Math.floor(f), j = Math.min(frames.length - 1, i + 1), u = f - i;
  const a = frames[i], b = frames[j];
  if (a.st !== b.st) return a;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dir: a.dir, st: a.st, stones: a.stones };
}

// 置き場所: 下にある地形（標本台もふくむ）でとまる高さ（底なしの上だけなら -Infinity）
export function restHeight(L, cand, tableY) {
  const d = pieceDims(cand);
  let best = -Infinity;
  for (let c = cand.x0; c < cand.x0 + d.wx; c++) {
    if (c < 0) { if (c >= -7) best = Math.max(best, tableY); }
    else if (c < L.W) best = Math.max(best, L.tops[c]);
  }
  return best;
}

// 置けるか（理由つき）。3Dの形どうしは重ならない
export function canPlace(L, cand, pieces) {
  const d = pieceDims(cand);
  if (cand.y0 === -Infinity) return '下に支えがない';
  if (cand.x0 + d.wx > L.W || cand.x0 < -7) return 'ここには置けない';
  const top = cand.y0 + d.h + (d.along === 'z' ? d.slope * d.dz : d.slope * d.wx);
  if (top > L.H + 0.01) return '空の上につき出てしまう';
  // 2D世界（ページ）にかかる形は、0〜60秒の外へはみ出せない
  if (cand.x0 + d.wx > 0 && (cand.t0 < 0 || cand.t0 + d.dz > L.T)) return 'ページの外へはみ出してしまう';
  for (const p of pieces) {
    const dp = pieceDims(p);
    const a = Math.max(cand.t0, p.t0), b = Math.min(cand.t0 + d.dz, p.t0 + dp.dz);
    for (let t = a; t < b; t += 0.25) {
      for (const s1 of sectionRects(cand, t)) for (const s2 of sectionRects(p, t)) {
        if (s1.x0 < s2.x1 - 1e-6 && s2.x0 < s1.x1 - 1e-6 && s1.y0 < s2.y1 - 1e-6 && s2.y0 < s1.y1 - 1e-6) return 'ほかの形とぶつかる';
      }
    }
  }
  // 住人のいる所に、背より高い形が現れる置き方はできない
  if (cand.x0 + d.wx > 0) {
    const key = JSON.stringify([L.id, cand, pieces.map((p) => [p.kind, p.rot, p.x0, p.t0, p.y0])]);
    if (key !== canPlace.key) { canPlace.key = key; canPlace.hit = !!simulate(L, [...pieces, cand]).overlap; }
    if (canPlace.hit) return '住人のいる所には置けない';
  }
  return '';
}
