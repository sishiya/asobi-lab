// みちいし 段階A（リアルタイム版、v002）の決まり。three も DOM も使わない純粋な計算。node でも読める。
// 決まりは PLAN.md 0章「2026-10-19 組み直し」と DISCUSSION.md の第3回。数字はすべて RULE に。
// - 乱数なし。固定の刻み（RULE.dt）で step(state, input) を進める。同じ入力なら同じ結果。
// - 座標はマス（1マス＝積み木1つ）。x は右、y は下（画面の下）。向きの角度は atan2(dy, dx)。
// - ムカデは「ともった灯りのまとまりの外まわり」を、灯りを右手に見て回る（画面で時計回り）。
//   外まわり＝ともった提灯の輪（半径 orbitR）をすべて包む凸の形のふち。灯りが近い所でとなりの輪へ移る、を単純にした形。

export const RULE = {
  dt: 1 / 60,
  field: { w: 30, h: 23 },
  safeR: 3.5,            // 灯りの輪（この中は安全。ムカデは入らない）
  orbitR: 4.0,           // ムカデが回る半径（輪のふち＋0.5）
  gap: 1.0,              // 体節のあいだ（自分も敵も同じ大きさ）
  enemy: {
    speed: 2.1, chase: 2.5, turn: 2.2,   // 回る速さ rad/秒（追う・戻るとき）
    fanLen: 5, fanHalf: Math.PI / 6,     // 前照灯の扇（長さ・半分の角度）
    windup: 0.9,                         // 気づいてから追い出すまでの「ため」
    stun: 1.0, blind: 3.0,               // かんだあと、ひるむ・気づかない時間
    biteR: 0.85,
    giveUp: 9.0,                         // 追いつけないまま長く追わない（見回りへ戻る）
  },
  me: { speed: 3.4, turn: 7.0, start: 3, max: 14, inv: 2.0, knock: 5.0 },
  trap: { arm: 0.6, r: 0.9 },
  pickR: 1.0,
  postR: 1.0,            // 提灯の柱のまわり（自分は入れない）
  light: { every: 0.3 },                 // 消えた提灯の輪で 0.3秒に1節ずつ積む（あと○が0になると止まる）
  lose: { fire: 3, rest: 3.0 },          // つかまりすぎ＝手提灯の火3つ。かまれると1つ消え、ともった輪に3秒いると1つ戻る。0で最初から（第3回）
  maxTraps: 3,                           // 4つ目を置くと、いちばん古いわなが積み木にもどる
  rescueEvery: 5.0,
};

// ---------- 小さな道具 ----------
const hyp = Math.hypot;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 灯りのまとまりの外まわり（凸の形のふち）を折れ線に ----------
export function buildPath(lamps, r = RULE.orbitR) {
  const pts = lamps.filter(l => l.lit).map(l => ({ x: l.x, y: l.y }));
  if (!pts.length) return null;
  // 凸包（画面の座標で時計回り＝ y 下向きの座標で角度が増える向き）
  let hull;
  if (pts.length === 1) hull = pts;
  else {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    hull = lo.slice(0, -1).concat(up.slice(0, -1)); // y 下向きの座標では、この並びが画面で時計回り
  }
  const out = [];
  const step = 0.05;
  const n = hull.length;
  if (n === 1) {
    const c = hull[0], m = Math.ceil(2 * Math.PI * r / step);
    for (let i = 0; i < m; i++) { const a = i / m * 2 * Math.PI; out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); }
  } else {
    for (let i = 0; i < n; i++) {
      const prev = hull[(i - 1 + n) % n], c = hull[i], next = hull[(i + 1) % n];
      // 入ってくる辺・出ていく辺の外向きの法線（時計回りに回るとき、外は進む向きの左＝(dy,-dx)）
      const nIn = Math.atan2(-(c.x - prev.x), (c.y - prev.y));
      const nOut = Math.atan2(-(next.x - c.x), (next.y - c.y));
      let a0 = nIn, a1 = nOut; while (a1 < a0) a1 += 2 * Math.PI;
      const m = Math.max(1, Math.ceil((a1 - a0) * r / step));
      for (let k = 0; k <= m; k++) { const a = a0 + (a1 - a0) * k / m; out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); }
      // 次の頂点までのまっすぐな辺
      const sx = c.x + Math.cos(nOut) * r, sy = c.y + Math.sin(nOut) * r;
      const ex = next.x + Math.cos(nOut) * r, ey = next.y + Math.sin(nOut) * r;
      const L = hyp(ex - sx, ey - sy), mm = Math.ceil(L / step);
      for (let k = 1; k < mm; k++) out.push({ x: sx + (ex - sx) * k / mm, y: sy + (ey - sy) * k / mm });
    }
  }
  // 長さの表
  const len = [0];
  for (let i = 1; i <= out.length; i++) { const a = out[i - 1], b = out[i % out.length]; len.push(len[i - 1] + hyp(b.x - a.x, b.y - a.y)); }
  return { pts: out, len, total: len[out.length] };
}
export function pathAt(path, s) {
  s = ((s % path.total) + path.total) % path.total;
  let lo = 0, hi = path.pts.length;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.len[mid] <= s) lo = mid; else hi = mid; }
  const a = path.pts[lo], b = path.pts[(lo + 1) % path.pts.length];
  const t = (s - path.len[lo]) / ((path.len[lo + 1] - path.len[lo]) || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: Math.atan2(b.y - a.y, b.x - a.x) };
}
export function pathNearest(path, x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < path.pts.length; i++) { const p = path.pts[i], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
  return { s: path.len[best], d: Math.sqrt(bd) };
}

// ---------- 列（頭の通った道を体がなぞる） ----------
function pushTrail(trail, x, y, maxLen) {
  const last = trail[trail.length - 1];
  if (!last || hyp(last.x - x, last.y - y) >= 0.05) trail.push({ x, y });
  // 体の長さより十分長い分だけ残す
  let acc = 0;
  for (let i = trail.length - 1; i > 0; i--) { acc += hyp(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y); if (acc > maxLen + 2) { trail.splice(0, i - 1); break; } }
}
// 頭から gap*(k+1) の所に体節 k を並べる
export function layoutBody(trail, hx, hy, count, gap = RULE.gap) {
  const out = [];
  let need = gap, acc = 0, px = hx, py = hy, i = trail.length - 1;
  for (let k = 0; k < count; k++) {
    while (i >= 0) {
      const t = trail[i], d = hyp(t.x - px, t.y - py);
      if (acc + d >= need) { const f = (need - acc) / (d || 1); px += (t.x - px) * f; py += (t.y - py) * f; acc = need; break; }
      acc += d; px = t.x; py = t.y; i--;
    }
    out.push({ x: px, y: py });
    need += gap;
  }
  // 向き（前の節の方を向く）
  for (let k = 0; k < out.length; k++) { const f = k === 0 ? { x: hx, y: hy } : out[k - 1]; out[k].h = Math.atan2(f.y - out[k].y, f.x - out[k].x); }
  return out;
}
function straightTrail(x, y, h, n, gap = RULE.gap) {
  const t = [];
  for (let i = Math.ceil(n * gap / 0.05) + 4; i > 0; i--) t.push({ x: x - Math.cos(h) * i * 0.05, y: y - Math.sin(h) * i * 0.05 });
  return t;
}

// ---------- はじめの状態 ----------
export function makeState(level) {
  const lamps = level.lamps.map((l, i) => ({ id: i, x: l.x, y: l.y, lit: !!l.lit, need: l.need || 0, have: 0 }));
  const path = buildPath(lamps);
  const enemies = level.enemies.map((e, i) => {
    const near = pathNearest(path, e.x, e.y);
    const at = pathAt(path, near.s);
    return {
      id: i, x: at.x, y: at.y, h: at.h, s: near.s, n: e.n,
      mode: 'patrol', t: 0, blind: 0,
      trail: straightTrail(at.x, at.y, at.h, e.n + 2),
      walk: 0,
    };
  });
  const me = level.me;
  return {
    tick: 0, time: 0,
    field: level.field || RULE.field,
    lamps, path, pathVer: 0,
    enemies,
    me: { x: me.x, y: me.y, h: me.h ?? Math.PI / 2, n: me.n ?? RULE.me.start, trail: straightTrail(me.x, me.y, me.h ?? Math.PI / 2, (me.n ?? RULE.me.start) + 2), inv: 0, kx: 0, ky: 0, fire: RULE.lose.fire, rest: 0, walk: 0, lightT: 0, rescueT: 0 },
    loose: (level.blocks || []).map((b, i) => ({ id: 'L' + i, x: b.x, y: b.y, h: b.h || 0, glow: !!b.glow, t: 99 })),
    traps: [],
    events: [],
    won: false, lost: false,
    nextId: 1,
  };
}

// ---------- 判定 ----------
export function inSafe(s, x, y, r = RULE.safeR) { return s.lamps.some(l => l.lit && hyp(l.x - x, l.y - y) < r); }
function nearestLit(s, x, y) { let best = null, bd = Infinity; for (const l of s.lamps) if (l.lit) { const d = hyp(l.x - x, l.y - y); if (d < bd) { bd = d; best = l; } } return best; }
export function enemyBody(e) { return layoutBody(e.trail, e.x, e.y, e.n); }
export function meBody(s) { return layoutBody(s.me.trail, s.me.x, s.me.y, s.me.n); }
// 自分の頭か、暗がりにある体の節が扇に入っているか（灯りの輪の中は数えない）。wide: ためのあいだは少し広く見る
function seesMe(s, e, wide = false) {
  const me = s.me;
  if (inSafe(s, me.x, me.y)) return false;
  const k = wide ? 1.4 : 1;
  if (sees(e, me.x, me.y, k)) return true;
  return meBody(s).some(b => !inSafe(s, b.x, b.y) && sees(e, b.x, b.y, k));
}
function sees(e, x, y, k = 1) {
  const dx = x - e.x, dy = y - e.y, d = hyp(dx, dy);
  if (d > RULE.enemy.fanLen * k) return false;
  return Math.abs(wrap(Math.atan2(dy, dx) - e.h)) <= RULE.enemy.fanHalf * k;
}

// ---------- 1刻み ----------
// input: { dx, dy }（進みたい向き。長さ0なら止まる）, trap: true（わなを置く。この刻みだけ）
export function step(s, input = {}) {
  const dt = RULE.dt, E = RULE.enemy, ME = RULE.me;
  s.events = [];
  if (s.won || s.lost) { s.tick++; s.time += dt; return s; }
  const me = s.me;

  // --- 自分 ---
  const il = hyp(input.dx || 0, input.dy || 0);
  if (il > 0.01) {
    const want = Math.atan2(input.dy, input.dx);
    const dh = wrap(want - me.h);
    me.h = wrap(me.h + clamp(dh, -ME.turn * dt, ME.turn * dt));
    // 向きがずれているあいだは少しゆっくり（その場でくるりと回れるように）
    const k = Math.max(0.25, Math.cos(Math.min(Math.abs(dh), Math.PI / 2)));
    me.x += Math.cos(me.h) * ME.speed * k * dt; me.y += Math.sin(me.h) * ME.speed * k * dt;
    me.walk += ME.speed * k * dt;
  }
  if (me.inv > 0) { me.inv -= dt; me.x += me.kx * dt; me.y += me.ky * dt; me.kx *= 0.9; me.ky *= 0.9; }
  me.x = clamp(me.x, 0.5, s.field.w - 0.5); me.y = clamp(me.y, 0.5, s.field.h - 0.5);
  // 提灯の柱には乗れない（押し出す）
  for (const l of s.lamps) { const dx = me.x - l.x, dy = me.y - l.y, d = hyp(dx, dy); if (d < RULE.postR) { me.x = l.x + dx / (d || 1) * RULE.postR; me.y = l.y + dy / (d || 1) * RULE.postR; } }
  pushTrail(me.trail, me.x, me.y, (me.n + 2) * RULE.gap);

  // わなを置く＝最後尾の節の連結ピンを抜いて、その場に置く
  if (input.trap && me.n > 0) {
    const body = meBody(s), last = body[body.length - 1];
    me.n--;
    s.traps.push({ id: 'T' + s.nextId++, x: last.x, y: last.y, h: last.h, t: 0, done: false });
    s.events.push({ type: 'trap', x: last.x, y: last.y });
    if (s.traps.length > RULE.maxTraps) { const old = s.traps.shift(); s.loose.push({ id: 'L' + s.nextId++, x: old.x, y: old.y, h: old.h, t: 0 }); s.events.push({ type: 'trapBack', x: old.x, y: old.y }); }
  }

  // --- 手提灯の火（つかまりすぎ） ---
  if (me.fire < RULE.lose.fire) {
    if (inSafe(s, me.x, me.y)) { me.rest += dt; if (me.rest >= RULE.lose.rest) { me.rest = 0; me.fire++; s.events.push({ type: 'fireBack' }); } }
    else me.rest = 0;
  }

  // --- 消えた提灯に積む ---
  for (const l of s.lamps) {
    if (l.lit) continue;
    if (hyp(l.x - me.x, l.y - me.y) < RULE.safeR) {
      me.lightT += dt;
      if (me.lightT >= RULE.light.every && me.n > 0 && l.have < l.need) {
        me.lightT = 0; me.n--; l.have++;
        s.events.push({ type: 'stack', lamp: l.id, have: l.have, need: l.need });
        if (l.have >= l.need) { l.lit = true; relight(s, l); s.events.push({ type: 'lit', lamp: l.id }); }
      }
    } else if (hyp(l.x - me.x, l.y - me.y) < RULE.safeR + 0.5) me.lightT = 0;
  }
  if (s.lamps.every(l => l.lit)) { s.won = true; s.events.push({ type: 'won' }); }

  // --- ムカデ ---
  for (const e of s.enemies) stepEnemy(s, e, dt);

  // --- わな ---
  for (const t of s.traps) {
    if (t.done) continue;
    t.t += dt;
    if (t.t < RULE.trap.arm) continue;
    for (const e of s.enemies) {
      if (t.done || e.n < 2) continue;
      const body = enemyBody(e);
      // 頭と1節目のあいだ（首）は段階Aでは切らない＝頭も1節目もまたぐ。2節目から先が踏むと、そこで切れる
      for (let k = 1; k < body.length; k++) {
        if (hyp(body[k].x - t.x, body[k].y - t.y) < RULE.trap.r) {
          const cut = body.slice(k);
          e.n = k;
          for (const b of cut) s.loose.push({ id: 'L' + s.nextId++, x: b.x, y: b.y, h: b.h, t: 0 });
          // わなに使った節も拾えるブロックにもどる
          s.loose.push({ id: 'L' + s.nextId++, x: t.x, y: t.y, h: t.h, t: 0 });
          t.done = true;
          s.events.push({ type: 'cut', enemy: e.id, at: k, got: cut.length, x: t.x, y: t.y });
          break;
        }
      }
    }
  }
  s.traps = s.traps.filter(t => !t.done);

  // --- 拾う ---
  for (const b of s.loose) b.t += dt;
  for (let i = s.loose.length - 1; i >= 0; i--) {
    const b = s.loose[i];
    if (b.t < 0.5 || me.n >= ME.max) continue;
    if (hyp(b.x - me.x, b.y - me.y) < RULE.pickR) { s.loose.splice(i, 1); me.n++; s.events.push({ type: 'pick', x: b.x, y: b.y, n: me.n }); }
  }

  // --- 救いの積み木: 体1節以下で、野に拾える積み木がないとき、近いともった輪の内側に1つ出す（2節になるまで5秒ごと） ---
  if (me.n <= 1 && !s.loose.length) {
    me.rescueT += dt;
    if (me.rescueT >= RULE.rescueEvery) {
      me.rescueT = 0;
      const l = nearestLit(s, me.x, me.y);
      if (l) { s.loose.push({ id: 'L' + s.nextId++, x: l.x + 1.5, y: l.y + 1.5, h: 0, t: 0, glow: true }); s.events.push({ type: 'rescue' }); }
    }
  } else me.rescueT = 0;

  s.tick++; s.time += dt;
  return s;
}

function stepEnemy(s, e, dt) {
  const E = RULE.enemy, me = s.me;
  e.t += dt;
  if (e.blind > 0) e.blind -= dt;
  const meSafe = inSafe(s, me.x, me.y);

  if (e.mode === 'patrol') {
    e.s += E.speed * dt;
    const at = pathAt(s.path, e.s);
    e.x = at.x; e.y = at.y; e.h = at.h; e.walk += E.speed * dt;
    // 前照灯の扇で気づく（自分の頭か体の節。灯りの輪の中にいれば気づかない）
    if (e.blind <= 0 && seesMe(s, e)) { e.mode = 'windup'; e.t = 0; e.wh = e.h; s.events.push({ type: 'spot', enemy: e.id }); }
  } else if (e.mode === 'windup') {
    // その場で止まって、前照灯をこちらへ向ける。扇に入りつづけているあいだだけ「ため」がたまる
    const want = Math.atan2(me.y - e.y, me.x - e.x);
    e.h = wrap(e.h + clamp(wrap(want - e.h), -4 * dt, 4 * dt));
    if (meSafe || !seesMe(s, e, true)) { e.mode = 'return'; e.t = 0; }
    else if (e.t >= E.windup) { e.mode = 'chase'; e.t = 0; s.events.push({ type: 'chase', enemy: e.id }); }
  } else if (e.mode === 'chase') {
    if (meSafe || e.t > E.giveUp) { e.mode = 'return'; e.t = 0; }
    else steer(s, e, me.x, me.y, E.chase, dt);
    if (e.mode === 'chase' && hyp(me.x - e.x, me.y - e.y) < E.biteR && me.inv <= 0) bite(s, e);
  } else if (e.mode === 'stun') {
    if (e.t >= E.stun) { e.mode = e.exit !== false && e.exit !== undefined ? 'exit' : 'return'; e.t = 0; e.blind = Math.max(e.blind, E.blind); }
  } else if (e.mode === 'exit') {
    // ともった輪の中から、まっすぐ外へ
    const l = s.lamps[e.exit];
    if (!l || hyp(l.x - e.x, l.y - e.y) >= RULE.orbitR - 0.05) { e.exit = false; e.mode = 'return'; e.t = 0; }
    else { e.h = Math.atan2(e.y - l.y, e.x - l.x); e.x += Math.cos(e.h) * E.speed * dt; e.y += Math.sin(e.h) * E.speed * dt; e.walk += E.speed * dt; }
  } else if (e.mode === 'return') {
    const near = pathNearest(s.path, e.x, e.y);
    // 道の少し先をめざして戻る
    const tgt = pathAt(s.path, near.s + 1.5);
    steer(s, e, tgt.x, tgt.y, E.speed, dt);
    if (near.d < 0.15) { e.mode = 'patrol'; e.s = near.s; }
  }
  pushTrail(e.trail, e.x, e.y, (e.n + 2) * RULE.gap);
}

// 向きを少しずつ変えて進む。ともった輪の中には入らない（押し出す）
function steer(s, e, tx, ty, speed, dt) {
  const E = RULE.enemy;
  let want = Math.atan2(ty - e.y, tx - e.x);
  e.h = wrap(e.h + clamp(wrap(want - e.h), -E.turn * dt, E.turn * dt));
  e.x += Math.cos(e.h) * speed * dt; e.y += Math.sin(e.h) * speed * dt; e.walk += speed * dt;
  for (const l of s.lamps) {
    if (!l.lit) continue;
    const dx = e.x - l.x, dy = e.y - l.y, d = hyp(dx, dy), min = RULE.safeR + 0.3;
    if (d < min) { e.x = l.x + dx / (d || 1) * min; e.y = l.y + dy / (d || 1) * min; }
  }
  e.x = clamp(e.x, 0.5, s.field.w - 0.5); e.y = clamp(e.y, 0.5, s.field.h - 0.5);
}

function bite(s, e) {
  const me = s.me, ME = RULE.me;
  const dx = me.x - e.x, dy = me.y - e.y, d = hyp(dx, dy) || 1;
  me.inv = ME.inv; me.kx = dx / d * ME.knock; me.ky = dy / d * ME.knock;
  e.mode = 'stun'; e.t = 0;
  // 最後尾の節を1つ落とす（拾い直せる）
  if (me.n > 0) {
    const body = meBody(s), last = body[body.length - 1];
    me.n--; s.loose.push({ id: 'L' + s.nextId++, x: last.x, y: last.y, h: last.h, t: -1.0 });
  }
  s.events.push({ type: 'bite', enemy: e.id, x: me.x, y: me.y });
  me.fire--; me.rest = 0;
  if (me.fire <= 0) { s.lost = true; s.events.push({ type: 'lost' }); }
}

// 提灯がともったら、まとまりの外まわりを作り直す。見回り中のムカデは新しい道へ戻る
function relight(s, lit) {
  s.path = buildPath(s.lamps); s.pathVer++;
  for (const e of s.enemies) {
    // 新しい輪の中にいたら、1秒すくんでから外へまっすぐ出る（そのあいだは気づかない）
    // 判定は、いまともった灯りだけ（ほかの輪のふちを回っているムカデが、誤差で「中」にならないように。検証が見つけた）
    const inside = hyp(lit.x - e.x, lit.y - e.y) < RULE.orbitR - 0.05;
    if (inside) { e.mode = 'stun'; e.t = 0; e.exit = lit.id; e.blind = RULE.enemy.stun + 3; }
    else if (e.mode === 'patrol' || e.mode === 'windup' || e.mode === 'chase') { e.mode = 'return'; e.t = 0; }
  }
}

// 状態のハッシュ（同じ入力なら同じになるかを確かめる）
export function hashState(s) {
  const r = v => Math.round(v * 1000);
  const parts = [s.tick, r(s.me.x), r(s.me.y), s.me.n, s.me.fire, s.loose.length, s.traps.length, ...s.enemies.flatMap(e => [r(e.x), r(e.y), e.n, e.mode]), ...s.lamps.map(l => (l.lit ? 1 : 0) + ':' + l.have)];
  let h = 2166136261;
  for (const c of parts.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
