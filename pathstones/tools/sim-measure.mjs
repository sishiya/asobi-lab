// 検証: 段階A（js/sim.js）を node で流して、ずれの幅・逃げきり・ボットのクリア時間などを測る。
// 使い方（ゲームのフォルダの1つ上で）: node pathstones/tools/sim-measure.mjs [levels/field1.json] [--runs=100] [--only=A,D]
// sim.js は変えない。人のくせ（反応のおくれ・ねらいのずれ）は、この道具の中の種つき乱数で入れる（ゲームには乱数を入れない）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE, makeState, step, hashState, buildPath, pathAt, pathNearest, inSafe, enemyBody, meBody } from '../js/sim.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(a => a.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const levelFile = args.find(a => !a.startsWith('--')) || path.join(dir, '../levels/field1.json');
const level = JSON.parse(fs.readFileSync(levelFile, 'utf8'));
const RUNS = Number(opt('runs', 100));
const ONLY = opt('only', 'A,B,C,D,E,F,G,H,I').split(',');
const DT = RULE.dt;
const hyp = Math.hypot;
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const fresh = () => makeState(level);
const litLamps = s => s.lamps.filter(l => l.lit);
const nearestLit = (s, x, y) => litLamps(s).reduce((b, l) => (!b || hyp(l.x - x, l.y - y) < hyp(b.x - x, b.y - y)) ? l : b, null);
const pass = ok => ok ? '合格' : '不合格';
const out = [];
const say = (...a) => { const t = a.join(' '); out.push(t); console.log(t); };

// 自分をある所・向きに置きなおす（体はうしろにまっすぐ）
function placeMe(s, x, y, h, n = s.me.n) {
  const me = s.me; me.x = x; me.y = y; me.h = h; me.n = n; me.trail = [];
  for (let i = Math.ceil((n + 3) / 0.05); i > 0; i--) me.trail.push({ x: x - Math.cos(h) * i * 0.05, y: y - Math.sin(h) * i * 0.05 });
}
function placeEnemy(s, e, sAlong) {
  const at = pathAt(s.path, sAlong); e.s = sAlong; e.x = at.x; e.y = at.y; e.h = at.h; e.mode = 'patrol'; e.t = 0; e.blind = 0; e.trail = [];
  for (let i = 0; i < Math.ceil((e.n + 3) / 0.05); i++) { const p = pathAt(s.path, sAlong - (Math.ceil((e.n + 3) / 0.05) - i) * 0.05); e.trail.push({ x: p.x, y: p.y }); }
  e.trail.push({ x: at.x, y: at.y });
}
const toward = (s, x, y) => ({ dx: x - s.me.x, dy: y - s.me.y });
const fleeInput = s => { const l = nearestLit(s, s.me.x, s.me.y); return toward(s, l.x, l.y); };

// ================= A・B・C: わなの置き場所とタイミング（輪のまわり全部で） =================
if (ONLY.includes('A') || ONLY.includes('B') || ONLY.includes('C')) {
  const s0 = fresh(); const P = s0.path; const v = RULE.enemy.speed;
  say('\n## A 置き場所のずれ（通り道の外向きの法線方向。+＝外の暗がり、−＝灯り側）。12か所×タイミング12通り');
  const spots = Array.from({ length: 12 }, (_, i) => (i + 0.5) / 12 * P.total);
  const rowsA = []; const gotByTiming = {};
  for (let off = -1.5; off <= 1.501; off += 0.25) {
    let hit = 0, n = 0;
    for (const sp of spots) {
      const at = pathAt(P, sp); const nx = Math.sin(at.h), ny = -Math.cos(at.h); // 進む向きの左＝外（時計回りなので）
      const tx = at.x + nx * off, ty = at.y + ny * off;
      for (let k = 0; k < 12; k++) {
        const dtHead = -3 + k * 0.5; // 頭が通る時刻からのずれ（秒）。−＝頭が来る前に置く
        const s = fresh(); s.loose = []; s.me.x = 8; s.me.y = 14.5; s.me.trail = s.me.trail.map(() => ({ x: 8, y: 14.5 }));
        // 頭を sp から dtHead*v だけ進めた所に置く（dtHead<0 ならまだ来ていない）
        placeEnemy(s, s.enemies[0], sp + dtHead * v);
        s.traps.push({ id: 'X', x: tx, y: ty, h: 0, t: 0, done: false });
        let cut = null;
        for (let i = 0; i < 60 * 40 && !cut; i++) { step(s, {}); for (const e of s.events) if (e.type === 'cut') cut = { ...e, time: s.time }; }
        n++;
        if (cut) { hit++; if (Math.abs(off) < 0.01) { (gotByTiming[dtHead] ||= []).push({ got: cut.got, time: cut.time }); } }
      }
    }
    rowsA.push({ off, rate: hit / n });
  }
  say('| ずれ | 切れた割合 |'); say('|---|---|');
  for (const r of rowsA) say(`| ${r.off.toFixed(2)} | ${Math.round(r.rate * 100)}% |`);
  const okW = rowsA.filter(r => r.rate >= 0.5).map(r => r.off);
  const w = okW.length ? Math.max(...okW) - Math.min(...okW) : 0;
  say(`50%以上で切れる幅: ${okW.length ? Math.min(...okW).toFixed(2) + '〜' + Math.max(...okW).toFixed(2) : 'なし'}（幅 ${w.toFixed(2)}）→ ±0.6 で50%以上・幅1.0以上: ${pass(w >= 1.0 && rowsA.filter(r => Math.abs(r.off) <= 0.5).every(r => r.rate >= 0.5))}`);

  say('\n## B・C タイミング（通り道の真上に置く。頭が通る時刻からのずれ）と取れた節');
  say('| 頭からのずれ(秒) | 取れた節（12か所） | 切れるまで(秒) |'); say('|---|---|---|');
  const allGot = {};
  for (const k of Object.keys(gotByTiming).map(Number).sort((a, b) => a - b)) {
    const g = gotByTiming[k]; const c = {}; for (const x of g) { c[x.got] = (c[x.got] || 0) + 1; allGot[x.got] = (allGot[x.got] || 0) + 1; }
    const tm = g.map(x => x.time).sort((a, b) => a - b);
    say(`| ${k >= 0 ? '+' : ''}${k.toFixed(1)} | ${Object.entries(c).map(([a, b]) => a + '節×' + b).join(' ')} | ${tm[0].toFixed(1)}〜${tm[tm.length - 1].toFixed(1)} |`);
  }
  // 1周のどの時刻に置いても、の分布（一様に 0.25秒刻みで1周）
  const dist = {}; let N = 0; const sp = P.total * 0.3; const at = pathAt(P, sp);
  for (let t0 = 0; t0 < P.total / v; t0 += 0.25) {
    const s = fresh(); s.loose = []; placeEnemy(s, s.enemies[0], sp - t0 * v);
    s.traps.push({ id: 'X', x: at.x, y: at.y, h: 0, t: 0, done: false });
    let cut = null; for (let i = 0; i < 60 * 40 && !cut; i++) { step(s, {}); for (const e of s.events) if (e.type === 'cut') cut = e; }
    N++; if (cut) dist[cut.got] = (dist[cut.got] || 0) + 1;
  }
  const top = Math.max(...Object.values(dist));
  say(`1周のどの時刻に置いても（${N}通り）の取れた節: ${Object.entries(dist).map(([a, b]) => a + '節 ' + pct(b, N)).join(' / ')} → 1つの数に60%以上かたよらない: ${pass(top / N < 0.6)}`);
}

// ================= D: 気づかれてから灯りへ逃げきれる割合 =================
if (ONLY.includes('D')) {
  say('\n## D 気づかれてから逃げきる（ムカデの位置24×扇の中の点。自分は「最短で近い輪へ」、反応のおくれ 0/0.4/0.7 秒）');
  const s0 = fresh(); const P = s0.path; const E = RULE.enemy;
  const rows = [];
  for (const react of [0, 0.4, 0.7]) {
    const bins = { far: [0, 0], mid: [0, 0], near: [0, 0] }; const fails = [];
    for (let i = 0; i < 24; i++) {
      const sp = i / 24 * P.total;
      for (const dist of [1.5, 2.5, 3.5, 4.5]) for (const ang of [-0.4, 0, 0.4]) for (const fh of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const s = fresh(); s.loose = []; const e = s.enemies[0]; placeEnemy(s, e, sp);
        const a = e.h + ang * E.fanHalf / 0.5, x = e.x + Math.cos(a) * dist, y = e.y + Math.sin(a) * dist;
        if (x < 1 || y < 1 || x > s.field.w - 1 || y > s.field.h - 1 || inSafe(s, x, y)) continue;
        if (s.lamps.some(l => hyp(l.x - x, l.y - y) < RULE.postR + 0.2)) continue;
        placeMe(s, x, y, e.h + fh); s.me.fire = 99;
        let spotted = false, react0 = null, bit = false, safe = false;
        for (let k = 0; k < 60 * 20; k++) {
          let inp = {};
          if (spotted && s.time - react0 >= react) inp = fleeInput(s);
          step(s, inp);
          for (const ev of s.events) { if (ev.type === 'spot' && !spotted) { spotted = true; react0 = s.time; } if (ev.type === 'bite') bit = true; }
          if (!spotted && k > 2) break; // 扇に入っていない（体の向きで見えない）なら数えない
          if (bit) break;
          if (spotted && inSafe(s, s.me.x, s.me.y) && e.mode !== 'chase') { safe = true; break; }
        }
        if (!spotted) continue;
        const b = dist <= 2 ? 'near' : dist <= 3.5 ? 'mid' : 'far';
        bins[b][1]++; if (!bit) bins[b][0]++; else fails.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
    rows.push({ react, bins, fails });
  }
  say('| 反応のおくれ | 扇のはし(4〜5) | まん中(2.5〜3.5) | 近い(1.5) |'); say('|---|---|---|---|');
  for (const r of rows) say(`| ${r.react}秒 | ${pct(...r.bins.far)} (${r.bins.far[1]}) | ${pct(...r.bins.mid)} (${r.bins.mid[1]}) | ${pct(...r.bins.near)} (${r.bins.near[1]}) |`);
  const r4 = rows[1];
  say(`反応0.4秒で はし90%以上・まん中と近い70%以上: ${pass(r4.bins.far[0] / r4.bins.far[1] >= 0.9 && (r4.bins.mid[0] + r4.bins.near[0]) / (r4.bins.mid[1] + r4.bins.near[1]) >= 0.7)}`);
  if (rows[2].fails.length) say('反応0.7秒でかまれた所（例）: ' + rows[2].fails.slice(0, 12).join(' '));
}

// ================= E: 輪から出たとたんにかまれる割合 =================
if (ONLY.includes('E')) {
  say('\n## E 輪から出る（ともった輪のふち36方向×ムカデの1周を20に分けた時刻。外へ2秒歩いて、近い輪へ戻る。戻るのは気づかれたら0.4秒後）');
  const s0 = fresh(); const P = s0.path;
  const per = [];
  for (const L of litLamps(s0)) for (let a = 0; a < 36; a++) {
    const ang = a / 36 * 2 * Math.PI; const x = L.x + Math.cos(ang) * (RULE.safeR - 0.2), y = L.y + Math.sin(ang) * (RULE.safeR - 0.2);
    if (inSafe(s0, x + Math.cos(ang) * 1.5, y + Math.sin(ang) * 1.5)) continue; // ふちの外がまた灯り（AとBのあいだなど）は数えない
    let safeN = 0, tot = 0;
    for (let ph = 0; ph < 20; ph++) {
      const s = fresh(); s.loose = []; placeEnemy(s, s.enemies[0], ph / 20 * P.total); placeMe(s, x, y, ang); s.me.fire = 99;
      let bit = false, spotT = null;
      for (let k = 0; k < 60 * 12 && !bit; k++) {
        const t = s.time; let inp;
        if (spotT !== null && t - spotT >= 0.4) inp = fleeInput(s);
        else if (t < 2) inp = { dx: Math.cos(ang), dy: Math.sin(ang) };
        else inp = fleeInput(s);
        step(s, inp);
        for (const ev of s.events) { if (ev.type === 'spot' && spotT === null) spotT = s.time; if (ev.type === 'bite') bit = true; }
        if (t > 2.5 && inSafe(s, s.me.x, s.me.y) && s.enemies[0].mode !== 'chase') break;
      }
      tot++; if (!bit) safeN++;
    }
    per.push({ lamp: L.id, deg: a * 10, rate: safeN / tot });
  }
  const worst = per.slice().sort((a, b) => a.rate - b.rate);
  const avg = per.reduce((a, b) => a + b.rate, 0) / per.length;
  say(`出口 ${per.length} 方向、平均で安全 ${Math.round(avg * 100)}%。いちばん危ない出口: ${worst.slice(0, 5).map(w => `灯り${w.lamp}の${w.deg}°=${Math.round(w.rate * 100)}%`).join(' / ')}`);
  say(`どの出口も1周の60%以上は安全: ${pass(worst[0].rate >= 0.6)}（60%未満の出口 ${per.filter(p => p.rate < 0.6).length}）`);
}

// ================= F: ボット3種で1つ灯すまで・最初からになる割合 =================
const BOTS = { ていねい: { react: 0.2, aim: 0.3, timing: 0.3 }, ふつう: { react: 0.4, aim: 0.7, timing: 0.8 }, はじめて: { react: 0.7, aim: 1.2, timing: 1.5 } };
function playBot(cfg, seed, limit = 300) {
  const R = mulberry(seed); const u = () => R() * 2 - 1;
  const s = fresh(); const P = () => s.path; const e = s.enemies[0];
  const C = s.lamps.find(l => !l.lit);
  let plan = null, fleeT = null; const st = { bites: 0, traps: 0, cuts: [], firstCut: null, lit: null };
  for (let k = 0; k < 60 * limit; k++) {
    const me = s.me; let inp = {};
    const danger = (e.mode === 'windup' || e.mode === 'chase') && !inSafe(s, me.x, me.y);
    if (danger) { if (fleeT === null) fleeT = s.time + cfg.react * (0.6 + R() * 0.8); }
    else fleeT = null;
    if (fleeT !== null && s.time >= fleeT) { inp = fleeInput(s); plan = null; }
    else if (fleeT !== null) { inp = plan?.last || {}; }
    else {
      const need = C.need - C.have;
      const loose = s.loose.filter(b => b.t > 0.5 && !inSafe(s, b.x, b.y) ? true : b.t > 0.5);
      // 1) 拾える積み木があれば拾う（ムカデの頭から 4 以上はなれていれば）
      const pick = loose.filter(b => hyp(b.x - e.x, b.y - e.y) > 4).sort((a, b) => hyp(a.x - me.x, a.y - me.y) - hyp(b.x - me.x, b.y - me.y))[0];
      if (C.lit) break;
      if (me.n >= need && me.n > 0) inp = toward(s, C.x, C.y + 1.5);       // 2) 足りるなら灯しに行く
      else if (pick) inp = toward(s, pick.x, pick.y);
      else if (e.n >= 2 && me.n >= 1 && !s.traps.length) {                  // 3) わな: 頭が過ぎた所へ出て、道にそって歩き、置いて戻る
        if (!plan) {
          const near = pathNearest(P(), me.x, me.y);
          const lag = (pathNearest(P(), e.x, e.y).s - near.s + P().total) % P().total; // 頭が自分の前の道を過ぎてからの距離
          if (lag > 3 && lag < 9 + cfg.timing * 2 * R()) plan = { s: near.s - 1, aim: u() * cfg.aim, phase: 0, wait: Math.max(0, u() * cfg.timing) };
          else { const l = nearestLit(s, me.x, me.y); inp = toward(s, l.x + (me.x - l.x) * 0.9, l.y + (me.y - l.y) * 0.9 + 0.01); if (inSafe(s, me.x, me.y)) inp = {}; }
        }
        if (plan) {
          const at = pathAt(P(), plan.s); const nx = Math.sin(at.h), ny = -Math.cos(at.h);
          const tx = at.x + nx * plan.aim, ty = at.y + ny * plan.aim;
          if (plan.phase === 0) { inp = toward(s, tx, ty); if (hyp(tx - me.x, ty - me.y) < 0.3) plan.phase = 1; }
          else if (plan.phase === 1) { plan.s += RULE.me.speed * DT; inp = { dx: Math.cos(at.h) * 3 + nx * plan.aim * 0, dy: Math.sin(at.h) * 3 }; if ((plan.walk = (plan.walk || 0) + DT) > 1.2) plan.phase = 2; }
          else if (plan.phase === 2) { if ((plan.wait -= DT) <= 0) { inp = { trap: true }; st.traps++; plan.phase = 3; } }
          else { inp = fleeInput(s); if (inSafe(s, me.x, me.y)) plan = null; }
          if (plan) plan.last = inp.trap ? {} : inp;
        }
      } else { const l = nearestLit(s, me.x, me.y); if (!inSafe(s, me.x, me.y)) inp = toward(s, l.x, l.y); } // 4) 待つ（救いの積み木など）
    }
    step(s, inp);
    for (const ev of s.events) {
      if (ev.type === 'bite') st.bites++;
      if (ev.type === 'cut') { st.cuts.push(ev.got); if (st.firstCut === null) st.firstCut = s.time; }
      if (ev.type === 'lit') st.lit = s.time;
    }
    if (s.lost || st.lit !== null) break;
  }
  return { ...st, lost: s.lost, time: s.time };
}
if (ONLY.includes('F')) {
  say(`\n## F ボット3種 × ${RUNS} 回（上限300秒。台本の野のはじめから。「灯す」＝消えた提灯Cがともって夜明け）`);
  say('| ボット | 灯せた | 最初から | 灯すまで 中央値／9割 | はじめて切るまで 中央値 | かまれた回数 平均 | 取れた節 |'); say('|---|---|---|---|---|---|---|');
  const verdict = [];
  for (const [name, cfg] of Object.entries(BOTS)) {
    const rs = Array.from({ length: RUNS }, (_, i) => playBot(cfg, 1000 + i));
    const ok = rs.filter(r => r.lit !== null), lost = rs.filter(r => r.lost);
    const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(0) : '-';
    const got = {}; rs.forEach(r => r.cuts.forEach(g => got[g] = (got[g] || 0) + 1));
    say(`| ${name} | ${pct(ok.length, RUNS)} | ${pct(lost.length, RUNS)} | ${q(ok.map(r => r.lit), 0.5)}秒／${q(ok.map(r => r.lit), 0.9)}秒 | ${q(rs.filter(r => r.firstCut !== null).map(r => r.firstCut), 0.5)}秒 | ${(rs.reduce((a, r) => a + r.bites, 0) / RUNS).toFixed(2)} | ${Object.entries(got).map(([a, b]) => a + '×' + b).join(' ')} |`);
    verdict.push({ name, lostRate: lost.length / RUNS, med: Number(q(ok.map(r => r.lit), 0.5)), okRate: ok.length / RUNS });
  }
  const lim = { ていねい: 0, ふつう: 0.05, はじめて: 0.2 };
  for (const v of verdict) say(`- ${v.name}: 最初から ${Math.round(v.lostRate * 100)}%（目安 ${lim[v.name] * 100}%以下）${pass(v.lostRate <= lim[v.name])}、灯すまで中央値 ${v.med}秒（目安 60〜180秒）${pass(v.med >= 60 && v.med <= 180)}`);
}

// ================= G: 詰み =================
if (ONLY.includes('G')) {
  say('\n## G 詰み（節が足りなくなる所）');
  const s0 = fresh(); const C = s0.lamps.find(l => !l.lit);
  const total = s0.me.n + s0.loose.length + s0.enemies.reduce((a, e) => a + (e.n - 1), 0);
  say(`はじめに手に入る節の合計: 自分 ${s0.me.n} + 野 ${s0.loose.length} + ムカデから最大 ${s0.enemies.reduce((a, e) => a + (e.n - 1), 0)}（首は切れない）= ${total}。必要 ${C.need}。わなの節は効くと野にもどり、かまれて落ちた節も拾い直せるので、節は減らない（減るのは提灯に積んだときだけ）。`);
  // いちばん悪い場合: ムカデが1節（もう切れない）・自分0節・野に何もない → 救いの積み木だけで灯せるか
  const s = fresh(); s.loose = []; s.enemies[0].n = 1; placeMe(s, 8, 14.8, 0, 0);
  let t0 = null;
  for (let k = 0; k < 60 * 600; k++) {
    let inp = {}; const me = s.me;
    const b = s.loose.find(b => b.t > 0.5);
    if (b) inp = toward(s, b.x, b.y);
    else if (me.n >= 1 && (me.n >= 2 || C.need - C.have <= me.n)) inp = toward(s, C.x, C.y + 1.5);
    else { const l = nearestLit(s, me.x, me.y); if (!inSafe(s, me.x, me.y)) inp = toward(s, l.x, l.y); }
    step(s, inp);
    if (s.lamps[C.id].lit) { t0 = s.time; break; }
    if (s.lost) break;
  }
  say(`いちばん悪い場合（ムカデ1節・自分0節・野は空）から救いの積み木だけで灯す: ${t0 !== null ? t0.toFixed(0) + '秒（かまれずに）' : (s.lost ? '最初からになった' : '600秒で灯せない')}、かまれた火 ${3 - s.me.fire}`);
  say(`→ 本当の詰み（どうやっても灯せない）: ${t0 !== null ? 'なし' : 'あり'}。ただし長い待ちになるかは上の秒数で判断`);
}

// ================= H: 灯した後の道の変わり方 =================
if (ONLY.includes('H')) {
  say('\n## H 灯した後の通り道');
  const s0 = fresh(); const before = s0.path;
  const after = buildPath(s0.lamps.map(l => ({ ...l, lit: true })));
  const near = (P, x, y) => Math.min(...P.pts.map(p => hyp(p.x - x, p.y - y)));
  const keep = after.pts.filter((p, i) => i % 4 === 0).map(p => near(before, p.x, p.y) < 0.5);
  const kept = keep.filter(Boolean).length / keep.length;
  const v = RULE.enemy.speed;
  say(`| | 長さ | 1周 |`); say('|---|---|---|');
  say(`| 灯す前 | ${before.total.toFixed(1)} | ${(before.total / v).toFixed(1)}秒 |`);
  say(`| 灯した後 | ${after.total.toFixed(1)} | ${(after.total / v).toFixed(1)}秒 |`);
  say(`灯した後の道のうち、前の道と重なる（0.5以内）所: ${Math.round(kept * 100)}% → 50%以下: ${pass(kept <= 0.5)}。1周20〜40秒: ${pass(before.total / v >= 20 && before.total / v <= 40 && after.total / v >= 20 && after.total / v <= 40)}`);
  // 灯したとき、ムカデが新しい輪の中にいる割合（すくんで外へ）と、そのとき自分（Cの輪のふち）へかみつくか
  let inside = 0, bites = 0, N = 0;
  for (let i = 0; i < 40; i++) {
    const s = fresh(); s.loose = []; placeEnemy(s, s.enemies[0], i / 40 * before.total);
    const C = s.lamps.find(l => !l.lit); placeMe(s, C.x, C.y + 1.5, -Math.PI / 2, 6); s.me.fire = 99;
    let lit = false;
    for (let k = 0; k < 60 * 15; k++) { step(s, {}); for (const ev of s.events) { if (ev.type === 'lit') { lit = true; if (s.enemies[0].exit) inside++; } if (ev.type === 'bite') bites++; } }
    N++;
  }
  say(`Cの輪の中で積んでいるあいだ（積む前のCは灯りでない）にかまれた回数: ${bites}/${N}通り、灯したときムカデが新しい輪の中にいた: ${inside}/${N}`);
}

// ================= I: 刻みと同じ結果 =================
if (ONLY.includes('I')) {
  say('\n## I 刻み・くり返し');
  const run = (cfg, seed) => { const r = playBot(cfg, seed); return JSON.stringify(r); };
  const same = [1, 2, 3, 4, 5].every(i => run(BOTS['ふつう'], 77 + i) === run(BOTS['ふつう'], 77 + i));
  say(`同じ種のボットを2回流して結果が同じ: ${same ? 'はい' : 'いいえ'}`);
  const hs = () => { const s = fresh(); for (let i = 0; i < 3600; i++) step(s, i % 120 < 60 ? { dx: 1, dy: 0.3 } : { dx: -1, dy: -0.2 }); return hashState(s); };
  say(`同じ入力で60秒後のハッシュ: ${hs()} / ${hs()} → ${pass(hs() === hs())}`);
  // 入力の粒の粗さ（画面が 30fps・20fps で、1フレームの入力が2〜3刻み続く）で結果が変わるか
  const coarse = (hold) => {
    let got = {}, lost = 0, lit = 0;
    for (let i = 0; i < 30; i++) { const r = playBotHold(BOTS['ふつう'], 500 + i, hold); if (r.lost) lost++; if (r.lit !== null) lit++; r.cuts.forEach(g => got[g] = (got[g] || 0) + 1); }
    return `灯せた ${lit}/30・最初から ${lost}/30`;
  };
  say(`入力を1刻みごと: ${coarse(1)} ／ 2刻みまとめ(30fps): ${coarse(2)} ／ 3刻みまとめ(20fps): ${coarse(3)}`);
  // 刻みそのものを 1/30 にしたら（sim.js の RULE.dt を道具の中だけで書きかえ。決まりが刻みに敏感かを見る）
  const keep = RULE.dt; RULE.dt = 1 / 30;
  const s = fresh(); let cut = null; s.loose = []; const P = s.path; const at = pathAt(P, P.total * 0.3);
  placeEnemy(s, s.enemies[0], P.total * 0.3 - 10); s.traps.push({ id: 'X', x: at.x, y: at.y, h: 0, t: 0, done: false });
  for (let i = 0; i < 30 * 40 && !cut; i++) { step(s, {}); for (const e of s.events) if (e.type === 'cut') cut = { ...e, t: s.time }; }
  RULE.dt = keep;
  const s2 = fresh(); let cut2 = null; s2.loose = []; placeEnemy(s2, s2.enemies[0], P.total * 0.3 - 10); s2.traps.push({ id: 'X', x: at.x, y: at.y, h: 0, t: 0, done: false });
  for (let i = 0; i < 60 * 40 && !cut2; i++) { step(s2, {}); for (const e of s2.events) if (e.type === 'cut') cut2 = { ...e, t: s2.time }; }
  say(`刻み 1/60 と 1/30 で同じわな: 1/60＝${cut2 ? cut2.got + '節・' + cut2.t.toFixed(2) + '秒' : 'なし'}、1/30＝${cut ? cut.got + '節・' + cut.t.toFixed(2) + '秒' : 'なし'}`);
}
function playBotHold(cfg, seed, hold) {
  // playBot と同じだが、入力を hold 刻みごとにしか読まない（画面のフレームが遅いとき）
  const orig = step; let held = {}, c = 0;
  return playBotWith(cfg, seed, (s, inp) => { if (c % hold === 0) held = { dx: inp.dx, dy: inp.dy }; c++; orig(s, { ...held, trap: !!inp.trap }); });
}
function playBotWith(cfg, seed, stepper) {
  // playBot の step を差しかえるための薄い包み
  return playBotCore(cfg, seed, stepper);
}
function playBotCore(cfg, seed, stepper) {
  const saved = globalThis.__stepper; globalThis.__stepper = stepper;
  try { return playBotStep(cfg, seed); } finally { globalThis.__stepper = saved; }
}
function playBotStep(cfg, seed) {
  // playBot をそのまま使えないので、step を差しかえた写し（中身は playBot と同じ。差しかえは入力の間引きだけ）
  const src = playBot.toString().replace('step(s, inp);', 'globalThis.__stepper(s, inp);');
  const f = new Function('RULE', 'makeState', 'pathAt', 'pathNearest', 'inSafe', 'fresh', 'mulberry', 'nearestLit', 'toward', 'fleeInput', 'hyp', 'DT', 'return ' + src)(RULE, makeState, pathAt, pathNearest, inSafe, fresh, mulberry, nearestLit, toward, fleeInput, hyp, DT);
  return f(cfg, seed);
}
