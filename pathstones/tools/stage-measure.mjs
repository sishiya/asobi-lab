// 検証: ステージ（levels/stage1.json など、灯りの群れ g つき）を js/sim.js で流して測る。sim.js は変えない。
// 使い方（ゲームのフォルダの1つ上で）: node pathstones/tools/stage-measure.mjs [levels/stage1.json] [--runs=30]
// ボットは「灯す順」を決めて動く。人のくせ（反応のおくれ・ねらいのずれ・置く時刻のずれ）は道具の中の種つき乱数（ゲームには乱数なし）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE, makeState, step, buildPath, pathAt, pathNearest, inSafe } from '../js/sim.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(a => a.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const levelFile = args.find(a => !a.startsWith('--')) || path.join(dir, '../levels/stage1.json');
const level = JSON.parse(fs.readFileSync(levelFile, 'utf8'));
const RUNS = Number(opt('runs', 30));
const DT = RULE.dt, hyp = Math.hypot;
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const fresh = () => makeState(level);
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const med = a => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN;
const q9 = a => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.9))] : NaN;
const say = (...a) => console.log(a.join(' '));
const NAME = {}; // 提灯の名前（stage1 の note の呼び名に合わせる）
const s00 = fresh();
const names = 'ABPEFG';
s00.lamps.forEach((l, i) => NAME[l.id] = level.lamps[i].name || names[i] || String(i));
const unlitIds = s00.lamps.filter(l => !l.lit).map(l => l.id);
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
const ORDERS = perms(unlitIds);
const oname = o => o.map(i => NAME[i]).join('→');

// ---------- 1. 灯す順ごとの道の形と、消えた提灯の中心から道までの近さ ----------
const pathsFor = lit => { const L = s00.lamps.map(l => ({ ...l, lit: l.lit || lit.has(l.id) })); const out = {}; for (const g of new Set(L.map(l => l.g))) out[g] = buildPath(L.filter(l => l.g === g)); return { L, out }; };
const minD = (P, x, y) => P ? Math.min(...P.pts.map(p => hyp(p.x - x, p.y - y))) : Infinity;
say('## 1 灯す順ごとの道と、消えた提灯の中心から道までの近さ（いちばん近い道。< 3.5 なら積んでいる輪の中を道が通る）');
say('| 灯す順 | 1つめを灯すとき | 2つめ | 3つめ | 東の道の長さ（各段） |'); say('|---|---|---|---|---|');
for (const o of ORDERS) {
  const lit = new Set(); const cells = []; const lens = [];
  for (const id of o) {
    const { L, out } = pathsFor(lit);
    const l = L[id]; const d = Math.min(...Object.values(out).filter(Boolean).map(P => minD(P, l.x, l.y)));
    cells.push(`${NAME[id]} ${d.toFixed(2)}`);
    lens.push(out[1] ? out[1].total.toFixed(0) : '-');
    lit.add(id);
  }
  lens.push(pathsFor(lit).out[1].total.toFixed(0));
  say(`| ${oname(o)} | ${cells.join(' | ')} | ${lens.join('→')} |`);
}
// 群れどうし: ほかの群れの道が、ともった輪（3.5）に入らないか、道どうしがいちばん近い所
{
  let worstIn = Infinity, worstPair = { d: Infinity };
  for (let m = 0; m < 8; m++) {
    const lit = new Set(unlitIds.filter((_, i) => m >> i & 1)); const { L, out } = pathsFor(lit);
    for (const [g, P] of Object.entries(out)) if (P) for (const l of L) if (l.lit && l.g !== Number(g)) worstIn = Math.min(worstIn, minD(P, l.x, l.y));
    const gs = Object.values(out);
    if (gs[0] && gs[1]) for (const a of gs[0].pts.filter((_, i) => i % 3 === 0)) for (const b of gs[1].pts.filter((_, i) => i % 3 === 0)) { const d = hyp(a.x - b.x, a.y - b.y); if (d < worstPair.d) worstPair = { d, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, lit: [...lit].map(i => NAME[i]).join('') || 'なし' }; }
  }
  say(`ほかの群れの道が、ともった提灯の中心にいちばん近づく距離: ${worstIn.toFixed(2)}（3.5 より大きければ輪に入らない）→ ${worstIn > RULE.safeR ? '合格' : '不合格'}`);
  say(`西と東の道がいちばん寄る所: ${worstPair.d.toFixed(2)}（${worstPair.x.toFixed(1)},${worstPair.y.toFixed(1)}、灯した提灯 ${worstPair.lit}）`);
}

// ---------- ボット ----------
const BOTS = { ていねい: { react: 0.2, aim: 0.3, timing: 0.3 }, ふつう: { react: 0.4, aim: 0.7, timing: 0.8 }, はじめて: { react: 0.7, aim: 1.2, timing: 1.5 } };
const nearestLit = (s, x, y) => s.lamps.filter(l => l.lit).reduce((b, l) => (!b || hyp(l.x - x, l.y - y) < hyp(b.x - x, b.y - y)) ? l : b, null);
const toward = (s, x, y) => ({ dx: x - s.me.x, dy: y - s.me.y });
const pathOf = (s, e) => s.paths[e.g] || s.path;
const active = s => s.enemies.filter(e => e.mode !== 'down');

function play(order, cfg, seed, o = {}) {
  const R = mulberry(seed), u = () => R() * 2 - 1;
  const s = fresh(); const me = s.me;
  const st = { cuts: 0, traps: 0, bites: 0, rescue: 0, lit: {}, stackSpot: {}, stackBite: {}, stackT: {}, inRingEnemy: 0, otherStun: 0, pinch: 0, spots: [], firstSpot5: 0, lost: false, won: null };
  let flee = null, plan = null, waitDown = null;
  const limit = o.limit || 600;
  for (let k = 0; k < limit * 60; k++) {
    let inp = {};
    const tgt = order.map(i => s.lamps[i]).find(l => !l.lit);
    const danger = active(s).some(e => e.mode === 'windup' || e.mode === 'chase') && !inSafe(s, me.x, me.y);
    if (danger) { if (flee === null) flee = s.time + cfg.react * (0.6 + R() * 0.8); } else flee = null;
    if (flee !== null && s.time >= flee) { const l = nearestLit(s, me.x, me.y); inp = toward(s, l.x, l.y); plan = null; }
    else if (flee !== null) inp = {};
    else if (plan && plan.phase === 4) { const l = nearestLit(s, me.x, me.y); inp = toward(s, l.x, l.y); if (inSafe(s, me.x, me.y)) plan = null; }
    else if (tgt) {
      const need = tgt.need - tgt.have;
      const heads = active(s);
      const pick = s.loose.filter(b => b.t > 0.5 && heads.every(e => hyp(e.x - b.x, e.y - b.y) > 4)).sort((a, b) => hyp(a.x - me.x, a.y - me.y) - hyp(b.x - me.x, b.y - me.y))[0];
      const keep = RULE.light.keep || 0; const stacking = hyp(tgt.x - me.x, tgt.y - me.y) < RULE.safeR && me.n > keep; // 最後の keep 節は積めない
      if (stacking || me.n >= need + keep || (o.noTrap && me.n >= 2 && !pick)) {
        const a = Math.atan2(me.y - tgt.y, me.x - tgt.x); inp = toward(s, tgt.x + Math.cos(a) * 1.6, tgt.y + Math.sin(a) * 1.6);
        if (hyp(tgt.x + Math.cos(a) * 1.6 - me.x, tgt.y + Math.sin(a) * 1.6 - me.y) < 0.2) inp = {};
        plan = null;
      } else if (pick && (!plan || plan.phase < 2)) { inp = toward(s, pick.x, pick.y); plan = null; }
      else if (!o.noTrap && !s.traps.some(t => s.time - (t._at ?? 0) < 40) && heads.length && me.n >= 1) {
        if (!plan) {
          // 自分にいちばん近い道のムカデをねらう。その群れのともった輪のふちで待つ
          const e = heads.map(e => ({ e, d: pathNearest(pathOf(s, e), me.x, me.y).d })).sort((a, b) => a.d - b.d)[0].e;
          const L = s.lamps.filter(l => l.lit && l.g === e.g).sort((a, b) => hyp(a.x - me.x, a.y - me.y) - hyp(b.x - me.x, b.y - me.y))[0];
          const P = pathOf(s, e); const sn = pathNearest(P, me.x, me.y).s; const at = pathAt(P, sn);
          const a = Math.atan2(at.y - L.y, at.x - L.x);
          plan = { e, phase: 0, wx: L.x + Math.cos(a) * 3.0, wy: L.y + Math.sin(a) * 3.0, lag: 2 + R() * 2 + u() * cfg.timing * 2.1, aim: u() * cfg.aim, wait: Math.max(0, u() * cfg.timing) };
          plan.sn = pathNearest(P, plan.wx, plan.wy).s;
        }
        const P = pathOf(s, plan.e);
        if (plan.e.mode === 'down' || !s.enemies.includes(plan.e)) plan = null;
        else if (plan.phase === 0) { // 輪のふちで、頭が過ぎるのを待つ
          inp = toward(s, plan.wx, plan.wy); if (hyp(plan.wx - me.x, plan.wy - me.y) < 0.2) inp = {};
          const lag = ((pathNearest(P, plan.e.x, plan.e.y).s - plan.sn) % P.total + P.total) % P.total; // e.s は見回り中しか進まないので、いまの位置から
          plan.t0 ??= s.time; if (s.time - plan.t0 > 60) plan = null;
          else if ((plan.e.mode === 'patrol' || plan.e.mode === 'return') && lag > plan.lag && lag < plan.lag + 1.5 && hyp(plan.wx - me.x, plan.wy - me.y) < 0.6) plan.phase = 1;
        } else if (plan.phase === 1 || plan.phase === 2) { // 道へ出て、道にそって（体の長さ＋α）歩く
          if (plan.phase === 1) plan.walk = 0;
          const at = pathAt(P, plan.sn + (plan.walk || 0) + 1); const nx = Math.sin(at.h), ny = -Math.cos(at.h);
          inp = toward(s, at.x + nx * plan.aim, at.y + ny * plan.aim); plan.phase = 2;
          plan.walk += RULE.me.speed * DT;
          if (plan.walk > me.n + 2) plan.phase = 3; // 輪から道までの分も歩かないと、しっぽ（わな）が輪の中に落ちる
        } else if (plan.phase === 3) { if ((plan.wait -= DT) <= 0) { inp = { trap: true }; st.traps++; plan.at = s.time; plan.phase = 4; waitDown = s.time; } }
        else { const l = nearestLit(s, me.x, me.y); inp = toward(s, l.x, l.y); if (inSafe(s, me.x, me.y)) plan = null; }
      } else { const l = nearestLit(s, me.x, me.y); if (!inSafe(s, me.x, me.y)) inp = toward(s, l.x, l.y); }
    }
    const before = s.time;
    step(s, inp);
    if (inp.trap && s.traps.length) s.traps[s.traps.length - 1]._at = s.time; // 道具だけの印（sim は読まない）
    const tgt2 = order.map(i => s.lamps[i]).find(l => !l.lit);
    const stackingNow = tgt2 && hyp(tgt2.x - me.x, tgt2.y - me.y) < RULE.safeR;
    for (const ev of s.events) {
      if (ev.type === 'down') st.cuts++;
      if (ev.type === 'rescue') st.rescue++;
      if (ev.type === 'bite') { st.bites++; if (stackingNow) st.stackBite[tgt2.id] = (st.stackBite[tgt2.id] || 0) + 1; if (hyp(me.x - 20, me.y - 17) < 4) st.pinchBite = (st.pinchBite || 0) + 1; }
      if (ev.type === 'spot') { st.spots.push({ t: s.time, e: ev.enemy, x: me.x, y: me.y }); if (stackingNow) st.stackSpot[tgt2.id] = (st.stackSpot[tgt2.id] || 0) + 1; if (s.time <= 5) st.firstSpot5++; }
      if (ev.type === 'stack' && st.stackT[ev.lamp] === undefined) st.stackT[ev.lamp] = s.time;
      if (ev.type === 'lit') {
        st.lit[ev.lamp] = s.time; st.stackT[ev.lamp] = s.time - st.stackT[ev.lamp];
        const l = s.lamps[ev.lamp]; for (const e of s.enemies) if (e.mode === 'stun' && e.exit === l.id && e.g !== l.g) st.otherStun++;
      }
      if (ev.type === 'won') st.won = s.time;
      if (ev.type === 'lost') st.lost = true;
    }
    // ムカデがともった輪の中にいるか（すくんで外へ出ている途中は数えない）
    for (const e of s.enemies) if (e.mode !== 'down' && e.mode !== 'stun' && e.mode !== 'exit' && inSafe(s, e.x, e.y)) st.inRingEnemy++;
    // 見回りに戻れない（return のまま20秒以上）
    for (const e of s.enemies) { if (e.mode === 'return') { e._rt = (e._rt || 0) + DT; if (e._rt > 20 && !e._stuck) { e._stuck = true; st.stuckReturn = (st.stuckReturn || 0) + 1; } } else e._rt = 0; }
    // はさまれる: 2匹が同時に「ため／追う」
    if (active(s).filter(e => e.mode === 'windup' || e.mode === 'chase').length >= 2) st.pinch++;
    if (o.dbg && k % 300 === 0) console.log(s.time.toFixed(0), 'me', me.x.toFixed(1), me.y.toFixed(1), 'n', me.n, 'tgt', tgt && NAME[tgt.id], tgt && tgt.have, 'plan', plan && plan.phase, 'flee', flee !== null, 'traps', s.traps.map(t => t.x.toFixed(1) + ',' + t.y.toFixed(1) + (t.seen ? 'S' : '')).join(' '), 'loose', s.loose.map(b => b.x.toFixed(0) + ',' + b.y.toFixed(0)).join(' '), 'en', s.enemies.map(e => e.id + e.mode + e.n + '@' + e.x.toFixed(0) + ',' + e.y.toFixed(0)).join(' '));
    if (s.won || s.lost) break;
  }
  st.time = s.time;
  return st;
}

if (process.env.DBG) { const [oi, bn, sd] = process.env.DBG.split(','); console.log(play(ORDERS[+oi], BOTS[bn], +sd, { dbg: true })); process.exit(); }
// ---------- 2〜5. 灯す順ごとのボット ----------
say(`\n## 2・3 灯す順×ボット（各 ${RUNS} 回、上限600秒）。かけた＝わなでムカデを止めた回数`);
say('| 灯す順 | ボット | 夜明け | 最初から | 夜明けまで 中央値／9割 | かけた 中央値（分布） | かまれた 平均 | 救いの積み木 平均 |'); say('|---|---|---|---|---|---|---|---|');
const all = [];
for (const o of ORDERS) for (const [bn, cfg] of Object.entries(BOTS)) {
  const rs = Array.from({ length: RUNS }, (_, i) => play(o, cfg, 100 + i));
  all.push({ o, bn, rs });
  const won = rs.filter(r => r.won !== null);
  const cd = {}; won.forEach(r => cd[r.cuts] = (cd[r.cuts] || 0) + 1);
  say(`| ${oname(o)} | ${bn} | ${pct(won.length, RUNS)} | ${pct(rs.filter(r => r.lost).length, RUNS)} | ${med(won.map(r => r.won)).toFixed(0)}秒／${q9(won.map(r => r.won)).toFixed(0)}秒 | ${med(won.map(r => r.cuts))}（${Object.entries(cd).map(([a, b]) => a + '回×' + b).join(' ')}） | ${(rs.reduce((a, r) => a + r.bites, 0) / RUNS).toFixed(2)} | ${(rs.reduce((a, r) => a + r.rescue, 0) / RUNS).toFixed(1)} |`);
}
say('\n## 1(続き) 積んでいるあいだ（ボット「ふつう」）: 提灯ごとの 見つかった割合／かまれた割合／積みはじめから灯るまで');
say('| 灯す順 | ' + unlitIds.map(i => NAME[i]).join(' | ') + ' |'); say('|---|' + unlitIds.map(() => '---').join('|') + '|');
for (const { o, bn, rs } of all.filter(x => x.bn === 'ふつう')) {
  say(`| ${oname(o)} | ` + unlitIds.map(i => { const sp = rs.filter(r => r.stackSpot[i]).length, bt = rs.filter(r => r.stackBite[i]).length; const t = med(rs.filter(r => r.lit[i] !== undefined).map(r => r.stackT[i])); return `${pct(sp, RUNS)}／${pct(bt, RUNS)}／${isNaN(t) ? '-' : t.toFixed(0) + '秒'}`; }).join(' | ') + ' |');
}
{
  const tot = all.flatMap(x => x.rs);
  say(`\n## 4 群れ: ムカデがともった輪の中にいた刻み ${tot.reduce((a, r) => a + r.inRingEnemy, 0)}（全 ${tot.length} 回）、灯したとき別の群れのムカデがすくんだ ${tot.reduce((a, r) => a + r.otherStun, 0)} 回 → ${tot.every(r => r.inRingEnemy === 0 && r.otherStun === 0) ? '合格' : '不合格'}`);
  say(`## 4b ムカデが return のまま20秒以上（見回りに戻れず、気づかない・わなをよけない）: ${pct(tot.filter(r => r.stuckReturn).length, tot.length)} の回で起きた`);
  say(`## 5 はさまれる: 2匹が同時に「ため／追う」になった刻みがあった回 ${pct(tot.filter(r => r.pinch > 0).length, tot.length)}、(20,17) から4以内でかまれた回 ${pct(tot.filter(r => r.pinchBite).length, tot.length)}`);
  say(`## 6 はじめの5秒で見つかった（ボット全部）: ${pct(tot.filter(r => r.firstSpot5 > 0).length, tot.length)}`);
}

// 6 はじめの5秒: 8方向へ5秒歩いたら（初めての人が、とりあえず歩いてみる）
{
  const rows = [];
  for (let a = 0; a < 8; a++) {
    const s = fresh(); let spot = null; const ang = a / 8 * 2 * Math.PI;
    for (let k = 0; k < 5 * 60 && !spot; k++) { step(s, { dx: Math.cos(ang), dy: Math.sin(ang) }); for (const ev of s.events) if (ev.type === 'spot') spot = `${s.time.toFixed(1)}秒にムカデ${ev.enemy}`; }
    rows.push(`${['東', '南東', '南', '南西', '西', '北西', '北', '北東'][a]}: ${spot || 'なし'}`);
  }
  const s = fresh(); let idle = null; for (let k = 0; k < 5 * 60 && !idle; k++) { step(s, {}); for (const ev of s.events) if (ev.type === 'spot') idle = s.time; }
  say(`はじめの5秒、動かない: ${idle === null ? '見つからない' : idle.toFixed(1) + '秒で見つかる'}。8方向へまっすぐ歩く: ${rows.join(' / ')}`);
}

// 7 近道: わな2回以下で夜明け／わななしで救いの積み木だけ
{
  say('\n## 7 近道');
  const tot = all.flatMap(x => x.rs.map(r => ({ ...r, o: x.o })));
  const two = tot.filter(r => r.won !== null && r.cuts <= 2);
  say(`ボットで、かけ2回以下の夜明け: ${pct(two.length, tot.filter(r => r.won !== null).length)}（灯す順: ${[...new Set(two.map(r => oname(r.o)))].join(', ') || 'なし'}）`);
  const nt = ORDERS.map(o => ({ o, r: play(o, BOTS['ていねい'], 7, { noTrap: true, limit: 900 }) }));
  for (const x of nt) say(`わなを置かず、救いの積み木だけ（${oname(x.o)}）: ${x.r.won !== null ? x.r.won.toFixed(0) + '秒で夜明け' : '900秒で終わらない'}、救い ${x.r.rescue} 個、かまれた ${x.r.bites}`);
}
