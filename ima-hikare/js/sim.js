// いま光れ: 回路の決まり（純粋。画面も音も持たない。node とブラウザの両方で読む）
// 1こま＝本物の水晶÷2（約7.16MHz）の1刻み。横は 0〜454 の455こま、縦は 0〜261 の262行（1972年の本物どおり。PLAN 2章）。
// 組んだ回路（board）を compile で JS の関数に組み立てて、step で何こまでも進める。interpret は同じ決まりを素直に書いた基準。
// 刻み方（1こまずつ／一気に）がちがっても、同じこま数なら同じ状態・同じ絵になる（tools/sim-check.mjs で確かめる）。

export const T = {
  W: 455, H: 262,            // 1行のこま数・1画面の行数
  HB: 80, VB: 16,            // 横・縦の消す時間（最初の80こま・16行）
  CELL: 8,                   // くらべる部品が合わせるマス（カウンタの上のけた）＝8こま×8行
  BALL: 4,                   // 玉の大きさ（4こま×4行。本物どおり）
  HZ: 7159090,               // 1秒のこま数（本物）
};
T.VIS_W = T.W - T.HB;        // 見える横 375こま
T.VIS_H = T.H - T.VB;        // 見える縦 246行
T.PER_FRAME = T.W * T.H;     // 1画面 119,210こま
T.COLS = Math.ceil(T.W / T.CELL);  // マスの数（57×33。見えるのは約47×31）
T.ROWS = Math.ceil(T.H / T.CELL);

const BITS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

// 部品の種類。in/out はつなぎ口。bus はカウンタの数そのもの（くらべる部品だけがつなげる）。
// reg: 出口が「いまの状態」だけで決まる部品（時計で動く）。ぐるっと戻る線はこれを通るときだけ許す。
export const PARTS = {
  H:     { fixed: true, reg: true, in: [], out: ['count', ...BITS.map(b => 'H' + b), 'HBLANK'], bus: ['count'] },
  V:     { fixed: true, reg: true, in: [], out: ['count', ...BITS.map(b => 'V' + b), 'VBLANK'], bus: ['count'] },
  video: { fixed: true, in: ['in0', 'in1', 'in2', 'in3'], out: [] },
  cmp:   { in: ['in'], out: ['out'], busIn: ['in'], params: { n: 0, w: 2 } },   // くらべる: マス n から w マスのあいだ 1
  and:   { in: ['a', 'b'], out: ['out'] },
  or:    { in: ['a', 'b'], out: ['out'] },
  not:   { in: ['a'], out: ['out'] },
  ball:  { reg: true, in: ['dirH', 'dirV'], out: ['h', 'v', 'out'], params: { dh: 0, dv: 0 } }, // 玉のカウンタ: 1周の長さの差（こま／画面・行／画面）
  ff:    { reg: true, in: ['t', 'clk', 'set', 'reset'], out: ['q', 'nq'], params: { q: 0, edge: 1 } },  // 向きを覚える: clk が上がった瞬間に t なら反転（edge=1 は t がさわりはじめた1回だけ）／set・reset で決める
  timer: { reg: true, in: ['trig'], out: ['out'], params: { wait: 40, len: 15 } },         // つまみタイマー: trig が上がってから wait 行待ち、len 行のあいだ 1
};

// ---- 組み立ての下ごしらえ（つながりの表・ぐるぐるの検出・並べる順番） ----
export function analyze(board) {
  const blocks = new Map(board.blocks.map(b => [b.id, b]));
  const src = new Map();           // "blk.port"（入口）→ "blk.port"（出口）
  const errors = [];
  for (const w of board.wires) {
    const [fb, fp] = w.from.split('.'), [tb, tp] = w.to.split('.');
    const F = blocks.get(fb), Tb = blocks.get(tb);
    if (!F || !Tb || !PARTS[F.type].out.includes(fp) || !PARTS[Tb.type].in.includes(tp)) { errors.push({ type: 'bad', wire: w }); continue; }
    const fBus = (PARTS[F.type].bus || []).includes(fp), tBus = (PARTS[Tb.type].busIn || []).includes(tp);
    if (fBus !== tBus) { errors.push({ type: 'kind', wire: w }); continue; }
    if (src.has(w.to)) { errors.push({ type: 'twice', wire: w }); continue; }
    src.set(w.to, w.from);
  }
  // 時計で動かない部品（くらべる・かつ・どちらか・ちがう）だけで、ぐるっと戻っていないか
  const comb = board.blocks.filter(b => !PARTS[b.type].reg && !PARTS[b.type].fixed);
  const deps = new Map(comb.map(b => [b.id, PARTS[b.type].in.map(p => src.get(b.id + '.' + p)).filter(Boolean).map(s => s.split('.')[0]).filter(id => comb.some(c => c.id === id))]));
  const order = [], mark = new Map(), loop = new Set();
  const visit = (id, stack) => {
    if (mark.get(id) === 2) return;
    if (mark.get(id) === 1) { for (const s of stack.slice(stack.indexOf(id))) loop.add(s); return; }
    mark.set(id, 1); stack.push(id);
    for (const d of deps.get(id)) visit(d, stack);
    stack.pop(); mark.set(id, 2); order.push(id);
  };
  for (const b of comb) visit(b.id, []);
  if (loop.size) errors.push({ type: 'loop', blocks: [...loop] });
  return { blocks, src, order, errors };
}

// ---- 状態 ----
export function makeState(board, init = {}) {
  const s = { tick: 0, h: 0, v: 0, frame: 0, blk: {} };
  for (const b of board.blocks) {
    const P = { ...(PARTS[b.type].params || {}), ...(b.params || {}) };
    if (b.type === 'ball') s.blk[b.id] = { hc: 0, vc: 0, pv: T.H, ...(init[b.id] || {}) };
    if (b.type === 'ff') s.blk[b.id] = { q: P.q, pclk: 0, pt: 0 };
    if (b.type === 'timer') s.blk[b.id] = { cnt: 0, act: 0, ptrig: 0 };
  }
  s.cur = new Uint8Array(T.VIS_W * T.VIS_H);       // いまの1画面で光ったか（見える所だけ）
  s.stamp = new Float64Array(T.VIS_W * T.VIS_H).fill(-1e12); // 最後に光ったこま（残光を描くのに使う）
  return s;
}

export function snapshot(s) {
  return { tick: s.tick, h: s.h, v: s.v, frame: s.frame, blk: JSON.parse(JSON.stringify(s.blk)), cur: s.cur.slice(), stamp: s.stamp.slice() };
}

export function hashState(s) {
  let x = 2166136261 >>> 0;
  const mix = n => { x = Math.imul(x ^ (n | 0), 16777619) >>> 0; };
  mix(s.tick % 4294967296); mix(s.h); mix(s.v); mix(s.frame);
  for (const id of Object.keys(s.blk).sort()) for (const k of Object.keys(s.blk[id]).sort()) mix(s.blk[id][k]);
  for (let i = 0; i < s.cur.length; i++) if (s.cur[i]) mix(i);
  return x.toString(16).padStart(8, '0');
}

// ---- 基準: 素直に書いた1こまずつの計算 ----
export function interpret(board) {
  const A = analyze(board);
  if (A.errors.length) return { errors: A.errors };
  const P = id => ({ ...(PARTS[A.blocks.get(id).type].params || {}), ...(A.blocks.get(id).params || {}) });
  const params = Object.fromEntries(board.blocks.map(b => [b.id, P(b.id)]));
  const step = (s, n) => {
    const out = {};
    const val = key => { const f = A.src.get(key); return f ? out[f] : 0; };
    for (let i = 0; i < n; i++) {
      const { h, v } = s;
      // 1) 時計で動く部品の出口（いまの状態から）
      for (const b of board.blocks) {
        const id = b.id, st = s.blk[id], p = params[id];
        if (b.type === 'H') { out[id + '.count'] = h; for (const k of BITS) out[id + '.H' + k] = (h & k) ? 1 : 0; out[id + '.HBLANK'] = h < T.HB ? 1 : 0; }
        if (b.type === 'V') { out[id + '.count'] = v; for (const k of BITS) out[id + '.V' + k] = (v & k) ? 1 : 0; out[id + '.VBLANK'] = v < T.VB ? 1 : 0; }
        if (b.type === 'ball') {
          const wh = st.hc >= T.VIS_W - T.BALL ? 1 : 0, wv = (st.vc >= T.H - T.BALL && st.vc < st.pv) ? 1 : 0;
          out[id + '.h'] = wh; out[id + '.v'] = wv; out[id + '.out'] = wh & wv;
        }
        if (b.type === 'ff') { out[id + '.q'] = st.q; out[id + '.nq'] = st.q ? 0 : 1; }
        if (b.type === 'timer') out[id + '.out'] = st.act > 0 ? 1 : 0;
      }
      // 2) くらべる・かつ…（並べた順に）
      for (const id of A.order) {
        const b = A.blocks.get(id), p = params[id];
        if (b.type === 'cmp') {
          const f = A.src.get(id + '.in');
          if (!f) { out[id + '.out'] = 0; continue; }
          const c = Math.floor(out[f] / T.CELL);
          out[id + '.out'] = (c >= p.n && c < p.n + p.w) ? 1 : 0;
        }
        if (b.type === 'and') out[id + '.out'] = val(id + '.a') & val(id + '.b');
        if (b.type === 'or') out[id + '.out'] = val(id + '.a') | val(id + '.b');
        if (b.type === 'not') out[id + '.out'] = val(id + '.a') ? 0 : 1;
      }
      // 3) 画面
      if (h >= T.HB && v >= T.VB) {
        let lit = 0;
        for (const b of board.blocks) if (b.type === 'video') for (const p of PARTS.video.in) lit |= val(b.id + '.' + p);
        const idx = (v - T.VB) * T.VIS_W + (h - T.HB);
        s.cur[idx] = lit; if (lit) s.stamp[idx] = s.tick;
      }
      // 4) 時計で動く部品を進める
      for (const b of board.blocks) {
        const id = b.id, st = s.blk[id], p = params[id];
        if (b.type === 'ff') {
          const clk = val(id + '.clk');
          if (clk && !st.pclk) { const t = val(id + '.t'); if (t && !(p.edge && st.pt)) st.q = st.q ? 0 : 1; st.pt = t; }
          st.pclk = clk;
          if (val(id + '.set')) st.q = 1;
          if (val(id + '.reset')) st.q = 0;
        }
        if (b.type === 'timer') { const t = val(id + '.trig'); if (t && !st.ptrig) st.cnt = Math.max(1, p.wait); st.ptrig = t; }
        if (b.type === 'ball' && h >= T.HB) {
          const sh = A.src.has(id + '.dirH') ? Math.abs(p.dh) * (val(id + '.dirH') ? 1 : -1) : p.dh;
          const ph = v < Math.abs(sh) ? T.VIS_W - Math.sign(sh) : T.VIS_W;   // 1画面に1回、最初の |差| 行だけ1周を1こまずらす（本物の MOVE）
          if (++st.hc >= ph) st.hc = 0;
        }
      }
      // 5) こまを進める（行のはじめ・画面のはじめの仕事）
      s.h++; s.tick++;
      if (s.h === T.W) {
        s.h = 0; s.v++;
        if (s.v === T.H) { s.v = 0; s.frame++; }
        for (const b of board.blocks) {
          const id = b.id, st = s.blk[id], p = params[id];
          if (b.type === 'ball') {
            if (++st.vc >= st.pv) {
              st.vc = 0;
              const sv = A.src.has(id + '.dirV') ? Math.abs(p.dv) * (val(id + '.dirV') ? 1 : -1) : p.dv;
              st.pv = T.H - sv;
            }
          }
          if (b.type === 'timer') { if (st.cnt > 0) { if (--st.cnt === 0) st.act = p.len; } else if (st.act > 0) st.act--; }
        }
      }
    }
    return s;
  };
  return { step, errors: [] };
}

// ---- 本番: 組んだ回路を JS の関数に組み立てる ----
export function compile(board) {
  const A = analyze(board);
  if (A.errors.length) return { errors: A.errors };
  const P = b => ({ ...(PARTS[b.type].params || {}), ...(b.params || {}) });
  const vn = key => 'o_' + key.replace(/[^A-Za-z0-9]/g, '_');
  const val = key => { const f = A.src.get(key); return f ? vn(f) : '0'; };
  const L = [], pre = [], post = [], line = [], decl = new Set();
  const D = n => { decl.add(n); return n; };
  board.blocks.forEach((b, bi) => {
    const id = b.id, p = P(b), S = `B${bi}`;
    if (['ball', 'ff', 'timer'].includes(b.type)) { pre.push(`const ${S}=s.blk[${JSON.stringify(id)}];`); }
    if (b.type === 'H') {
      L.push(`${D(vn(id + '.count'))}=h;`); for (const k of BITS) L.push(`${D(vn(id + '.H' + k))}=(h>>${Math.log2(k)})&1;`); L.push(`${D(vn(id + '.HBLANK'))}=h<${T.HB}?1:0;`);
    }
    if (b.type === 'V') {
      L.push(`${D(vn(id + '.count'))}=v;`); for (const k of BITS) L.push(`${D(vn(id + '.V' + k))}=(v>>${Math.log2(k)})&1;`); L.push(`${D(vn(id + '.VBLANK'))}=v<${T.VB}?1:0;`);
    }
    if (b.type === 'ball') {
      L.push(`${D(vn(id + '.h'))}=${S}.hc>=${T.VIS_W - T.BALL}?1:0;`, `${D(vn(id + '.v'))}=(${S}.vc>=${T.H - T.BALL}&&${S}.vc<${S}.pv)?1:0;`, `${D(vn(id + '.out'))}=${vn(id + '.h')}&${vn(id + '.v')};`);
    }
    if (b.type === 'ff') L.push(`${D(vn(id + '.q'))}=${S}.q;`, `${D(vn(id + '.nq'))}=${S}.q?0:1;`);
    if (b.type === 'timer') L.push(`${D(vn(id + '.out'))}=${S}.act>0?1:0;`);
  });
  for (const id of A.order) {
    const b = A.blocks.get(id), p = P(b), o = D(vn(id + '.out'));
    if (b.type === 'cmp') L.push(A.src.has(id + '.in') ? `{const c=(${val(id + '.in')}>>3);${o}=(c>=${p.n}&&c<${p.n + p.w})?1:0;}` : `${o}=0;`);
    if (b.type === 'and') L.push(`${o}=${val(id + '.a')}&${val(id + '.b')};`);
    if (b.type === 'or') L.push(`${o}=${val(id + '.a')}|${val(id + '.b')};`);
    if (b.type === 'not') L.push(`${o}=${val(id + '.a')}?0:1;`);
  }
  const vids = board.blocks.filter(b => b.type === 'video').flatMap(b => PARTS.video.in.map(pn => val(b.id + '.' + pn))).filter(e => e !== '0');
  L.push(`if(h>=${T.HB}&&v>=${T.VB}){const idx=(v-${T.VB})*${T.VIS_W}+(h-${T.HB});const lit=${vids.length ? vids.join('|') : '0'};cur[idx]=lit;if(lit)stamp[idx]=tick;}`);
  board.blocks.forEach((b, bi) => {
    const id = b.id, p = P(b), S = `B${bi}`;
    if (b.type === 'ff') {
      const clk = val(id + '.clk');
      post.push(`if(${clk}&&!${S}.pclk){const t=${val(id + '.t')};if(t&&${p.edge ? `!${S}.pt` : '1'})${S}.q=${S}.q?0:1;${S}.pt=t;}${S}.pclk=${clk};`);
      if (A.src.has(id + '.set')) post.push(`if(${val(id + '.set')})${S}.q=1;`);
      if (A.src.has(id + '.reset')) post.push(`if(${val(id + '.reset')})${S}.q=0;`);
    }
    if (b.type === 'timer') post.push(`{const t=${val(id + '.trig')};if(t&&!${S}.ptrig)${S}.cnt=${Math.max(1, p.wait)};${S}.ptrig=t;}`);
    if (b.type === 'ball') {
      const sh = A.src.has(id + '.dirH') ? `(${val(id + '.dirH')}?${Math.abs(p.dh)}:${-Math.abs(p.dh)})` : `(${p.dh})`;
      post.push(`if(h>=${T.HB}){const sh=${sh};const ph=v<(sh<0?-sh:sh)?${T.VIS_W}-(sh>0?1:-1):${T.VIS_W};if(++${S}.hc>=ph)${S}.hc=0;}`);
      const sv = A.src.has(id + '.dirV') ? `(${val(id + '.dirV')}?${Math.abs(p.dv)}:${-Math.abs(p.dv)})` : `(${p.dv})`;
      line.push(`if(++${S}.vc>=${S}.pv){${S}.vc=0;${S}.pv=${T.H}-(${sv});}`);
    }
    if (b.type === 'timer') line.push(`if(${S}.cnt>0){if(--${S}.cnt===0)${S}.act=${p.len};}else if(${S}.act>0)${S}.act--;`);
  });
  const src = `
const cur=s.cur,stamp=s.stamp;${pre.join('')}
let h=s.h,v=s.v,tick=s.tick,frame=s.frame;
let ${[...decl].join('=0,')}=0;
for(let i=0;i<n;i++){
${L.join('\n')}
${post.join('\n')}
h++;tick++;
if(h===${T.W}){h=0;v++;if(v===${T.H}){v=0;frame++;}
${line.join('\n')}
}
}
s.h=h;s.v=v;s.tick=tick;s.frame=frame;return s;`;
  // 線のある入口の値は、行のはじめの仕事でも同じ式で読むので、そのこまの最後の値を使う（interpret と同じ）
  const step = new Function('s', 'n', src);
  return { step, errors: [], src };
}

// ---- のぞき見: いまのこまで、どのつなぎ口が 1 か（状態は変えない。画面で線を光らせるのに使う） ----
// at を渡すと、時計で動く部品はいまの状態のまま、横と縦だけその位置にしたときの値（1画面の中の「1の割合」を数えるのに使う）
export function peek(board, s, at) {
  const A = board._A || (board._A = analyze(board));
  const out = {};
  const h = at ? at.h : s.h, v = at ? at.v : s.v;
  const val = key => { const f = A.src.get(key); return f ? out[f] : 0; };
  for (const b of board.blocks) {
    const id = b.id, st = s.blk[id];
    if (b.type === 'H') { out[id + '.count'] = h; for (const k of BITS) out[id + '.H' + k] = (h & k) ? 1 : 0; out[id + '.HBLANK'] = h < T.HB ? 1 : 0; }
    if (b.type === 'V') { out[id + '.count'] = v; for (const k of BITS) out[id + '.V' + k] = (v & k) ? 1 : 0; out[id + '.VBLANK'] = v < T.VB ? 1 : 0; }
    if (b.type === 'ball' && st) { const wh = st.hc >= T.VIS_W - T.BALL ? 1 : 0, wv = (st.vc >= T.H - T.BALL && st.vc < st.pv) ? 1 : 0; out[id + '.h'] = wh; out[id + '.v'] = wv; out[id + '.out'] = wh & wv; }
    if (b.type === 'ff' && st) { out[id + '.q'] = st.q; out[id + '.nq'] = st.q ? 0 : 1; }
    if (b.type === 'timer' && st) out[id + '.out'] = st.act > 0 ? 1 : 0;
  }
  for (const id of A.order) {
    const b = A.blocks.get(id), p = { ...(PARTS[b.type].params || {}), ...(b.params || {}) };
    if (b.type === 'cmp') { const f = A.src.get(id + '.in'); const c = f ? Math.floor(out[f] / T.CELL) : -1; out[id + '.out'] = f && c >= p.n && c < p.n + p.w ? 1 : 0; }
    if (b.type === 'and') out[id + '.out'] = val(id + '.a') & val(id + '.b');
    if (b.type === 'or') out[id + '.out'] = val(id + '.a') | val(id + '.b');
    if (b.type === 'not') out[id + '.out'] = val(id + '.a') ? 0 : 1;
  }
  let lit = 0;
  for (const b of board.blocks) if (b.type === 'video') for (const p of PARTS.video.in) lit |= val(b.id + '.' + p);
  out['scr.lit'] = lit;
  return out;
}

// ---- 便利: 1画面ぶんの絵をマスの単位で数える（段の合格の型に使う） ----
export function litCells(s) {
  const m = new Uint16Array(T.COLS * T.ROWS);
  for (let y = 0; y < T.VIS_H; y++) for (let x = 0; x < T.VIS_W; x++) if (s.cur[y * T.VIS_W + x]) {
    const cx = (x + T.HB) >> 3, cy = (y + T.VB) >> 3; m[cy * T.COLS + cx]++;
  }
  return m;
}
