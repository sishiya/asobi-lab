// ムカデの道（仮）のルール。ゲーム本体と node の道具（tools/solve.mjs）の両方から読む。
// 純粋な関数だけ: step(state, action) は新しい state を返し、もとの state は変えない。
// 決まりは PLAN.md の 1章（1-0〜1-6）。座標は x が右（東）、y が下（南）。

export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
const LEFT = { N: 'W', E: 'N', S: 'E', W: 'S' };

export const VOID = 0, GROUND = 1, BRIDGE = 2, CRACK = 3; // 床（下の層）。GROUND は切れない地面、CRACK は「ひび」の地面（切れる）
export const MAX_HOLD = 5; // 手に入る列の長さの上限

const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const add = (p, d) => [p[0] + d[0], p[1] + d[1]];
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const dirOf = (from, to) => {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  for (const k in DIRS) if (DIRS[k][0] === dx && DIRS[k][1] === dy) return k;
  return null;
};

// ---- 読みこみ ----
// beacons: 目的地（goal）は消えかけの灯台で r は 0（そのマスだけ、みちいしは入れない）。
// level: { floor: ["#%.", ...]（# 地面・% ひびの地面・. 奈落）, beacons: [{x,y,r,goal}], player: [x,y],
//          rows: [[[x,y],...], ...]（止まった列。頭の側から）,
//          centipedes: [{ body: [[x,y],...]（頭から）, dir: "E" }],
//          rules: { vibration: false, deadEnd: "stop", walls: true, cutLive: true } }
//          walls: 地面の上に置いて壁にできるか／cutLive: 生きた体を切れるか（使う部屋だけ true。検証の測定）
export function loadLevel(level) {
  const h = level.floor.length, w = level.floor[0].length;
  const floor = [];
  const code = { '#': GROUND, '%': CRACK };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) floor.push(code[level.floor[y][x]] ?? VOID);
  const s = {
    w, h, floor,
    beacons: level.beacons || [],
    rules: { vibration: false, deadEnd: 'stop', walls: true, cutLive: true, ...(level.rules || {}) },
    player: [...level.player],
    rows: (level.rows || []).map(r => r.map(p => [...p])),
    cents: (level.centipedes || []).map(c => ({ body: c.body.map(p => [...p]), dir: c.dir, mark: null, alive: true, stuck: false })),
    held: null, // 持っている形（頭の側からの、先頭に対する相対の位置）
    moved: false, // 直前の手で小人が動いたか（振動は1手おくれで効く）
    won: false, lost: false,
  };
  decideMarks(s);
  return s;
}

// ---- 盤を調べる ----
const inside = (s, p) => p[0] >= 0 && p[1] >= 0 && p[0] < s.w && p[1] < s.h;
const floorAt = (s, p) => s.floor[p[1] * s.w + p[0]];
const lit = (s, p) => s.beacons.some(b => dist([b.x, b.y], p) <= b.r); // 灯台の光（ムカデは入らない）
const isGround = v => v === GROUND || v === CRACK; // もとの地面（ひびも地面）
const goalAt = (s, p) => s.beacons.some(b => b.goal && b.x === p[0] && b.y === p[1]);
function rowAt(s, p) { // 止まった列・壁 → [列の番号, 節の番号]
  for (let i = 0; i < s.rows.length; i++) {
    const j = s.rows[i].findIndex(q => eq(q, p));
    if (j >= 0) return [i, j];
  }
  return null;
}
function centAt(s, p) { // 生きたムカデ → [ムカデの番号, 節の番号]
  for (let i = 0; i < s.cents.length; i++) {
    if (!s.cents[i].alive) continue;
    const j = s.cents[i].body.findIndex(q => eq(q, p));
    if (j >= 0) return [i, j];
  }
  return null;
}
const topEmpty = (s, p) => !rowAt(s, p) && !centAt(s, p) && !eq(s.player, p);

// ---- 印（次の1手）を決める: PLAN 1-2 ----
// 順: 灯台の光に入らない →（振動で気づいたら小人のほうへ）→ まっすぐ → 右 → 左。
// 選べない: 盤の外・奈落・上の層がふさがったマス（自分の体ぜんぶ＝尾が空けるマスも、ほかのムカデ、止まった列・壁）、先のムカデの印。
// 小人のマスは選べる（それがかまれる手）。
// 行き止まり（PLAN 1-2）: deadEnd "stop" は止まったまま（道が開けばまた進む）。
// "turn" は1手止まり（stuck）、次の手で尾の端を新しい頭にして後ずさりで折り返す（部屋4で「止まる」とくらべるための案）。
const OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };
function decideMarks(s) {
  const taken = [];
  for (const c of s.cents) {
    c.mark = null;
    if (!c.alive) continue;
    let pick = choose(s, c, taken);
    if (!pick && s.rules.deadEnd === 'turn') {
      if (c.stuck) {
        c.body = c.body.slice().reverse();
        c.dir = c.body.length > 1 ? dirOf(c.body[1], c.body[0]) : OPP[c.dir];
        c.stuck = false;
        pick = choose(s, c, taken);
      } else {
        c.stuck = true;
      }
    }
    if (pick) {
      c.stuck = false;
      c.mark = add(c.body[0], DIRS[pick]);
      taken.push(c.mark);
    }
  }
}

function choose(s, c, taken) {
  const head = c.body[0];
  const order = [c.dir, RIGHT[c.dir], LEFT[c.dir]];
  const ok = order.filter(d => {
    const p = add(head, DIRS[d]);
    if (!inside(s, p) || floorAt(s, p) === VOID || lit(s, p)) return false;
    if (rowAt(s, p) || centAt(s, p)) return false;
    if (taken.some(q => eq(q, p))) return false;
    return true;
  });
  let pick = ok[0];
  if (s.rules.vibration && s.moved && dist(head, s.player) <= 2) {
    const closer = ok.filter(d => dist(add(head, DIRS[d]), s.player) < dist(head, s.player));
    if (closer.length) pick = closer[0];
  }
  return pick;
}

// ---- 写す（step は state を変えない） ----
function clone(s) {
  return {
    ...s,
    floor: s.floor.slice(),
    player: [...s.player],
    rows: s.rows.map(r => r.slice()),
    cents: s.cents.map(c => ({ ...c, body: c.body.slice() })),
  };
}

// 切って離れた列（頭の側→尾の順）: 5マスまでなら持つ（前の形と入れ替え）、6マス以上なら止まった列として残す。
function takeOrLeave(s, cells) {
  if (cells.length <= MAX_HOLD) {
    const o = cells[0];
    s.held = cells.map(p => [p[0] - o[0], p[1] - o[1]]);
  } else {
    s.rows.push(cells);
  }
}

// 置く形のマス: end 0 ＝頭の側の端を、end 1 ＝尾の側の端を、anchor につける。
export function placeCells(held, anchor, end) {
  const base = end === 0 ? held[0] : held[held.length - 1];
  return held.map(o => [anchor[0] + o[0] - base[0], anchor[1] + o[1] - base[1]]);
}

// 置けるか → 'bridge'（奈落の上に床）/ 'wall'（地面の上に壁）/ null
function placeKind(s, cells) {
  if (!cells.every(p => inside(s, p) && topEmpty(s, p))) return null;
  const voids = cells.filter(p => floorAt(s, p) === VOID).length;
  if (voids === cells.length) {
    // 橋: 列の両端の節が「もとの地面」にとなり合うとき（置いた床を足がかりにしない）
    const touches = p => Object.values(DIRS).some(d => { const q = add(p, d); return inside(s, q) && isGround(floorAt(s, q)); });
    return touches(cells[0]) && touches(cells[cells.length - 1]) ? 'bridge' : null;
  }
  if (voids === 0) return s.rules.walls ? 'wall' : null;
  return null; // まぜて置けない
}

// ---- 小人の手の一覧 ----
// 'mN' 動く／'cN' 切る／'pN0' 'pN1' 置く（向きと、頭の側0・尾の側1のどちらの端をつけるか）／'w' 待つ
// opts.noWait: 待つ手を外す。opts.noBridge: 橋を置く手を外す。かまれる手もここでは外さない（step の結果で lost になる）。
export function legalActions(s, opts = {}) {
  if (s.won || s.lost) return [];
  const out = [];
  for (const d in DIRS) {
    const p = add(s.player, DIRS[d]);
    if (!inside(s, p)) continue;
    // 動く: 床があり、上の層が空いている
    if (floorAt(s, p) !== VOID && !rowAt(s, p) && !centAt(s, p)) out.push('m' + d);
    // 切る: いちばん上の物。頭のマスは切れない。床で切れるのは「ひび」と橋だけ（PLAN 1-3）。
    const ci = centAt(s, p);
    if (ci) { if (ci[1] > 0 && s.rules.cutLive) out.push('c' + d); }
    else if (rowAt(s, p)) out.push('c' + d);
    else if ((floorAt(s, p) === CRACK || floorAt(s, p) === BRIDGE) && !goalAt(s, p)) out.push('c' + d);
    // 置く
    if (s.held) {
      for (const end of [0, 1]) {
        const kind = placeKind(s, placeCells(s.held, p, end));
        if (kind && !(opts.noBridge && kind === 'bridge')) out.push('p' + d + end);
      }
    }
  }
  if (!opts.noWait) out.push('w');
  return out;
}

// ---- 1手すすめる: PLAN 1-1 の順 ----
export function step(s0, action) {
  const s = clone(s0);
  const kind = action[0];
  const d = action[1];
  const target = d ? add(s.player, DIRS[d]) : null;

  // 1. 小人の手
  if (kind === 'm') {
    s.player = target;
  } else if (kind === 'c') {
    const ci = centAt(s, target);
    const ri = rowAt(s, target);
    if (ci) {
      const c = s.cents[ci[0]];
      const tail = c.body.slice(ci[1]);
      c.body = c.body.slice(0, ci[1]);
      takeOrLeave(s, tail);
    } else if (ri) {
      const row = s.rows[ri[0]];
      const tail = row.slice(ri[1]);
      const front = row.slice(0, ri[1]);
      if (front.length) s.rows[ri[0]] = front; else s.rows.splice(ri[0], 1);
      takeOrLeave(s, tail);
    } else {
      s.floor[target[1] * s.w + target[0]] = VOID; // ひび・橋を切ると穴になるだけ（地面は持てない）
    }
  } else if (kind === 'p') {
    const cells = placeCells(s.held, target, Number(action[2]));
    const k = placeKind(s, cells);
    if (k === 'bridge') for (const p of cells) s.floor[p[1] * s.w + p[0]] = BRIDGE;
    else s.rows.push(cells);
    s.held = null;
  }
  s.moved = kind === 'm';

  // 2. 灯台に着いたか → 着いたら勝ち（そのあとのムカデの手はない）
  if (goalAt(s, s.player)) { s.won = true; return s; }

  // 3. ムカデが印のマスへ進む（番号の順）
  for (const c of s.cents) {
    if (!c.alive || !c.mark) continue; // 印がない＝行き止まりで止まっている
    const m = c.mark;
    if (floorAt(s, m) === VOID) { // 印のマスが奈落 → 頭が落ちる。残りの体は止まった列に
      c.alive = false;
      if (c.body.length > 1) s.rows.push(c.body.slice(1));
      c.body = [];
      continue;
    }
    if (rowAt(s, m) || centAt(s, m)) continue; // ふさがれた → その手は止まる（印は約束のまま、選び直さない）
    if (eq(m, s.player)) { s.lost = true; return s; } // かまれる
    c.dir = dirOf(c.body[0], m);
    c.body = [m, ...c.body.slice(0, -1)];
  }

  // 4. 次の印を決める（振動はここで見る）
  decideMarks(s);
  return s;
}

// ---- 重複を省くキー ----
export function stateKey(s) {
  const rows = s.rows.map(r => r.map(p => p.join(',')).join(';')).sort().join('|');
  const cents = s.cents.map(c => c.alive ? (c.stuck ? '!' : '') + c.dir + c.body.map(p => p.join(',')).join(';') : 'x').join('|');
  const held = s.held ? s.held.map(p => p.join(',')).join(';') : '-';
  return [s.floor.join(''), s.player.join(','), rows, cents, held, s.moved && s.rules.vibration ? 1 : 0].join('/');
}
