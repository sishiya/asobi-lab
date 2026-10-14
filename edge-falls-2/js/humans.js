'use strict';
// ヒト（v2。EXPANSION.md 4章）: 十の年のあとの「その後の世界」（自由な箱庭）で、命のつぼに来る。プレイヤーと同じ手を持つ、最後の生き物。
//   ・村（W.village）のまわりで暮らす。昼は食べものを集め、夜は村へ帰って火のそばで休む。
//   ・遺伝子ではなく「知恵」（W.wisdom）で変わる。知恵はまねで、1世代のうちに村じゅうに広がる（ほかの生き物の遅い進化とくらべられる）。
//     火 → 狩り → 漁 → 畑 → 水路 → 堤 → 暦 → 丸い大地 の順に、条件がそろうと見つける。
//   ・畑（W.farm）: 草地を畑にする（シカの草がへる）。水路で水を引き、堤で川をせき止める（下流が干上がる）。どれもプレイヤーと同じ得と損。
//   ・ヒトが掘った土は、となりに盛る（土は消えも生まれもしない。プレイヤーの土ぶくろは使わない）。
//   ・最後に、空を見上げつづけたヒトが「この大地は丸いのでは」と気づく（ヒトの観察帳の札）。
//   死をむごく見せない（ほかの生き物と同じ小さなけむり）。オオカミはヒトをおそわない。

const WISDOM = [
  ['fire', TX('火', 'Fire'), TX('ヒトは火を使いはじめた。夜は村の火のまわりで、寒さをしのぐ', 'The humans began to use fire. At night they gather around the village fire and keep out the cold'), 1],
  ['hunt', TX('狩り', 'Hunting'), TX('ヒトは、むれで力を合わせてシカを狩ることを覚えた', 'The humans learned to hunt deer together as a group'), 2],
  ['fish', TX('漁', 'Fishing'), TX('ヒトは、浅瀬でサカナをとることを覚えた', 'The humans learned to catch fish in the shallows'), 2.5],
  ['farm', TX('畑', 'Farming'), TX('ヒトは、草地を耕して畑をつくりはじめた。草地はシカのものではなくなる', 'The humans began to plow grassland into fields. That grass is no longer the deer’s'), 3],
  ['canal', TX('水路', 'Canals'), TX('ヒトは、川から畑へ水路を掘りはじめた。掘った土は、水路の両わきに盛る', 'The humans began to dig canals from the river to their fields, piling the dug soil on both banks'), 2],
  ['dam', TX('堤', 'Dams'), TX('ヒトは、川をせき止めて堤をつくった。ため池ができたが、下流の水はへる', 'The humans dammed the river. A pond formed, but there is less water downstream'), 2],
  ['calendar', TX('暦', 'The calendar'), TX('ヒトは空を見上げて、太陽の道で季節を、月の満ち欠けで潮を読む暦をつくった。春にまけば畑はよく実り、大潮には漁がはかどる', 'The humans watched the sky and made a calendar: the Sun’s path tells the seasons, and the Moon’s phases tell the tides. Fields sown in spring bear more, and fishing goes well at spring tides'), 0],
  ['round', TX('丸い大地', 'A round land'), TX('空を見つづけたヒトが、ひとつの考えにたどりついた。「この大地は、本当は丸いのではないか」', 'The humans who kept watching the sky arrived at one idea: “Perhaps this land is really round.”'), 0],
];
const HUMAN_COL = { h: [58, 40, 30], f: [214, 168, 128], t: [188, 128, 64], T: [150, 98, 48], l: [74, 58, 44] };

function resetHumans() { W.village = null; W.farm = new Float32Array(N * N); W.wisdom = {}; W.wisP = 0; W.hSeasons = 0; W.hSeason = -1; W.wisT = 0; W.canal = null; W.dammed = 0; }
const humanCount = () => L.counts.human || 0;
const knows = k => !!(W.wisdom && W.wisdom[k]);

// 1人ずつ（life.js の stepAnimal から）
function stepHuman(a, dt) {
  const K = KINDS.human, T = a.tr, i = cellOf(a.x, a.y);
  if (!inside[i]) { die(a, 'fall'); return; }
  if (!W.village) { W.village = { x: a.x, y: a.y }; W.flags.village = 1; }
  const V0 = W.village, dv = Math.hypot(a.x - V0.x, a.y - V0.y), night = isNight(i), w = deepAt(i);
  a.age += dt; a.cd -= dt; a.phase += dt; a.work = (a.work || 0) - dt;
  a.e -= T.cost * climateMul(a, W.T[i]) * dt;
  if (W.moist[i] > 0.9) a.th = 0; else a.th += dt;
  let sp = T.walk, vx = 0, vy = 0;
  const toward = (x, y) => { a.dir = Math.atan2(y - a.y, x - a.x); };
  const avoid = j => (deepAt(j) > 0.4 ? -4 : 0) - (Math.hypot(j % N - V0.x, (j / N | 0) - V0.y) > 14 ? 2 : 0);
  if (w > 0.45) {                                   // 深い水: 近い岸へ
    a.wet += dt; const f = flowAt(i); vx += f.vx * 0.7; vy += f.vy * 0.7; sp = 0.9;
    a.dir = pickDir(a, j => -W.w[j] * 2 - (inside[j] ? 0 : 9), 8, 2);
    if (a.wet > 20) { die(a, 'drown'); return; }
  } else {
    a.wet = 0;
    const hungry = a.e < T.eMax * 0.7;
    if (night && !(hungry && a.e < T.eMax * 0.3)) {                    // 夜は村へ帰って休む
      if (dv > 1.5) toward(V0.x, V0.y); else sp = 0;
      if (dv < 2 && knows('fire')) a.e = Math.min(T.eMax, a.e + 0.01 * dt);
    } else if (a.th > 30) a.dir = pickDir(a, j => W.moist[j] + avoid(j), 7, 3);
    else if (hungry) { if (!seekFood(a, dt)) sp *= 0.8; else sp = a.spd || sp; }
    else if (a.work <= 0 && doWork(a, dt)) sp = a.spd || sp;
    else { a.wander = (a.wander || 0) - dt; if (a.wander < 0 || dv > 7) { a.dir = dv > 7 ? Math.atan2(V0.y - a.y, V0.x - a.x) : pickDir(a, j => avoid(j) + Math.random() * 0.5, 4, 2); a.wander = 2 + Math.random() * 3; } sp *= 0.5; }
    if (a.th > 100) { die(a, 'thirst'); return; }
  }
  a.spd = 0;
  vx += Math.cos(a.dir) * sp; vy += Math.sin(a.dir) * sp;
  const nx = a.x + vx * dt, ny = a.y + vy * dt;
  if (inside[cellOf(nx, ny)] && onDisk(nx, ny) && (deepAt(cellOf(nx, ny)) < 0.5 || w > 0.45)) { a.x = nx; a.y = ny; }
  else a.dir += Math.PI * (0.5 + Math.random());
  if (Math.abs(vx) > 0.05) a.flip = vx > 0 ? 1 : -1;
  if (a.e <= 0) { die(a, 'hunger'); return; }
  if (a.age > K.life * (0.8 + 0.4 * ((a.phase * 7) % 1))) { die(a, 'old'); return; }
  if (seasonOf() !== 3) reproduce(a);
}

// 食べもの: 実った畑 → 狩り → 漁 → 草の実を集める
function seekFood(a, dt) {
  const V0 = W.village, F = W.farm;
  if (knows('farm')) {
    let best = -1, bd = 81;
    for (let y = Math.round(V0.y) - 8; y <= V0.y + 8; y++) for (let x = Math.round(V0.x) - 8; x <= V0.x + 8; x++) {
      const j = y * N + x; if (x < 0 || y < 0 || x >= N || y >= N || !inside[j] || F[j] < 0.6) continue;
      const d = (x - a.x) ** 2 + (y - a.y) ** 2; if (d < bd) { bd = d; best = j; }
    }
    if (best >= 0) {
      a.dir = Math.atan2((best / N | 0) - a.y, best % N - a.x);
      if (bd < 0.8) { a.e = Math.min(a.tr.eMax, a.e + F[best] * 7); F[best] = 0.05; W.flags.harvest = 1; }   // 刈りとって、またまく
      return true;
    }
  }
  if (knows('hunt') && L.counts.deer > 3) {
    if (!a.prey || a.prey.dead || Math.hypot(a.prey.x - V0.x, a.prey.y - V0.y) > 16) a.prey = nearest(a, 'deer', 9);
    const d = a.prey;
    if (d) {
      a.dir = Math.atan2(d.y - a.y, d.x - a.x); a.spd = 2.3;
      if ((d.x - a.x) ** 2 + (d.y - a.y) ** 2 < 0.6) {
        if (Math.random() < 0.5 - d.tr.escape) { a.e = Math.min(a.tr.eMax, a.e + 7); die(d, 'hunted'); W.flags.hhunt = 1; }
        a.prey = null;
      }
      return true;
    }
  }
  if (knows('fish') && L.counts.fish > 3) {
    const f = nearest(a, 'fish', 7, b => W.w[cellOf(b.x, b.y)] < 0.9);
    if (f) {
      a.dir = Math.atan2(f.y - a.y, f.x - a.x);
      if ((f.x - a.x) ** 2 + (f.y - a.y) ** 2 < 2.2 && Math.random() < 0.6 * dt * (knows('calendar') && springTide() ? 2 : 1)) { a.e = Math.min(a.tr.eMax, a.e + 3.5); die(f, 'fished'); W.flags.hfish = 1; }
      return true;
    }
  }
  const i = cellOf(a.x, a.y);
  a.dir = pickDir(a, j => W.veg[j] - (deepAt(j) > 0.4 ? 4 : 0) - (Math.hypot(j % N - V0.x, (j / N | 0) - V0.y) > 12 ? 2 : 0), 6, 2.5);
  const take = Math.max(0, Math.min(W.veg[i] - 0.1, 0.25 * W.veg[i] * dt));
  W.veg[i] -= take; a.e = Math.min(a.tr.eMax, a.e + take * 4);
  return true;
}

// 仕事: 畑をひらく → 水路を掘る → 堤をつくる
function doWork(a, dt) {
  const V0 = W.village, F = W.farm;
  if (knows('farm')) {
    let n = 0; for (let y = Math.round(V0.y) - 7; y <= V0.y + 7; y++) for (let x = Math.round(V0.x) - 7; x <= V0.x + 7; x++) { const j = y * N + x; if (inside[j] && F[j] > 0) n++; }
    if (n < humanCount() * 5 && n < 60) {
      if (a.plot === undefined || F[a.plot] > 0 || !goodPlot(a.plot)) a.plot = findPlot();
      if (a.plot >= 0) {
        const px = a.plot % N, py = a.plot / N | 0; a.dir = Math.atan2(py - a.y, px - a.x);
        if ((px - a.x) ** 2 + (py - a.y) ** 2 < 0.8) { F[a.plot] = 0.08; W.veg[a.plot] = 0; W.tree[a.plot] = 0; a.plot = undefined; a.work = 2; }
        return true;
      }
    }
  }
  if (knows('canal') && digCanal(a)) return true;
  if (knows('dam') && !W.dammed) buildDam();
  a.work = 4;
  return false;
}
const goodPlot = j => j >= 0 && inside[j] && W.w[j] < 0.06 && W.g[j] < 12 && Math.hypot(j % N - W.village.x, (j / N | 0) - W.village.y) < 7.5;
function findPlot() {
  const V0 = W.village;
  for (let k = 0; k < 30; k++) {
    const an = Math.random() * 6.283, r = 1.5 + Math.random() * 5.5, j = Math.round(V0.y + Math.sin(an) * r) * N + Math.round(V0.x + Math.cos(an) * r);
    if (goodPlot(j) && W.farm[j] <= 0 && W.moist[j] > 0.25) return j;
  }
  return -1;
}

// ヒトが土を掘る: 掘った土は両わきに盛る（土は消えない）
function humanDig(x, y, amt, ax, ay) {
  const i = Math.round(y) * N + Math.round(x); if (!inside[i]) return;
  const d = Math.min(amt, W.g[i] - 0.4); if (d <= 0) return;
  W.g[i] -= d;
  for (const s of [1, -1]) { const j = Math.round(y + ay * s * 1.2) * N + Math.round(x + ax * s * 1.2); if (inside[j]) W.g[j] += d / 2; else W.g[i] += d / 2; }
}
// 水路: いちばん近い水から、乾いた畑へ、1マスずつ掘る
function digCanal(a) {
  const F = W.farm;
  if (!W.canal) {
    let dry = -1; for (const i of INS) if (F[i] > 0 && W.moist[i] < 0.45) { dry = i; break; }
    if (dry < 0) return false;
    let best = -1, bd = 18 * 18;
    for (const i of INS) if (W.w[i] > 0.3 && !W.ice[i]) { const d = (i % N - dry % N) ** 2 + ((i / N | 0) - (dry / N | 0)) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best < 0) return false;
    W.canal = { x0: best % N, y0: best / N | 0, x1: dry % N, y1: dry / N | 0, k: 0 };
  }
  const c = W.canal, len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0) || 1, ux = (c.x1 - c.x0) / len, uy = (c.y1 - c.y0) / len;
  if (c.k > len) { W.canal = null; W.flags.canal = 1; return false; }
  const x = c.x0 + ux * c.k, y = c.y0 + uy * c.k;
  a.dir = Math.atan2(y - a.y, x - a.x);
  if ((x - a.x) ** 2 + (y - a.y) ** 2 < 1.2) {
    const lvl = W.g[cellOf(c.x0, c.y0)] + W.w[cellOf(c.x0, c.y0)] - 0.5, i = cellOf(x, y);
    humanDig(x, y, Math.max(0.2, W.g[i] - lvl), -uy, ux); c.k += 1; a.work = 1.5;
    if (Math.random() < 0.3) burst('dig', x, y, 2, 0.8);
  }
  return true;
}
// 堤: 村から 14 マスの中の、いちばん流れの速い川を、流れと直角にせき止める（一度だけ）
function buildDam() {
  const V0 = W.village; let best = -1, bf = 0.4;
  for (const i of INS) {
    if (W.w[i] < 0.1 || Math.hypot(i % N - V0.x, (i / N | 0) - V0.y) > 14) continue;
    const f = flowAt(i), s = Math.hypot(f.vx, f.vy); if (s > bf) { bf = s; best = i; }
  }
  if (best < 0) return;
  const f = flowAt(best), s = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / s, uy = f.vy / s, x = best % N, y = best / N | 0;
  for (let k = -3; k <= 3; k++) {                    // 流れと直角に盛る。土は上流がわを掘って持ってくる
    const bx = x - uy * k, by = y + ux * k, bi = cellOf(bx, by), si = cellOf(bx - ux * 2, by - uy * 2);
    if (!inside[bi] || !inside[si]) continue;
    const m = Math.min(1.6, W.g[si] - 0.4); if (m <= 0) continue;
    W.g[si] -= m; W.g[bi] += m;
  }
  W.dammed = 1; W.flags.dam = 1; burst('raise', x, y, 8, 3);
}

// 畑の実り（0.25 秒ごと）
function stepFarm(dt) {
  if (!W.farm) return;
  const F = W.farm, cal = knows('calendar') && seasonOf() === 0 ? 1.5 : 1;
  for (const i of INS) {
    if (F[i] <= 0) continue;
    if (W.w[i] > 0.35) { F[i] = Math.max(0, F[i] - 0.1 * dt); if (F[i] <= 0.001) F[i] = 0; continue; }   // 水につかると流される
    const g = W.moist[i] * W.light[i] * tempGrow(W.T[i]) * fertGrow(i) * cal * 0.012;
    F[i] = Math.min(1, F[i] + g * dt);
    W.fert[i] = Math.max(0, W.fert[i] - g * 0.06 * dt);
    if (W.moist[i] < 0.12) F[i] = Math.max(0.02, F[i] - 0.004 * dt);
  }
}

// 知恵（0.25 秒ごと）。いまの段の条件がそろっているあいだ、ヒトの数が多いほど早く進む。見つけたら村じゅうに広がる
function stepWisdom(dt) {
  const H = humanCount(); if (!H || !W.wisdom) return;
  const se = seasonOf(); if (se !== W.hSeason) { if (W.hSeason >= 0) W.hSeasons++; W.hSeason = se; }
  const next = WISDOM.find(([k]) => !W.wisdom[k]); if (!next) return;
  const [k, name, text, days] = next;
  const ok = { fire: () => true, hunt: () => L.counts.deer > 0, fish: () => L.counts.fish > 0, farm: () => H >= 3,
    canal: () => { let n = 0, dry = 0; for (const i of INS) if (W.farm[i] > 0) { n++; if (W.moist[i] < 0.45) dry++; } return n >= 6 && dry > 0; },
    dam: () => INS.some(i => W.w[i] > 0.1 && Math.hypot(i % N - W.village.x, (i / N | 0) - W.village.y) < 14 && Math.hypot(flowAt(i).vx, flowAt(i).vy) > 0.4),
    calendar: () => W.hSeasons >= 4, round: () => W.hSeasons >= 10 || (W.hSeasons >= 6 && eclipseK() > 0.6) }[k];   // 暦は1年見てから、丸い大地は2年半（日食を見れば1年半）
  if (!ok || !ok()) { W.wisT = Math.max(0, W.wisT - dt * 0.3); return; }   // 条件が切れても、すぐには忘れない
  W.wisT += dt * Math.sqrt(H);
  if (W.wisT < (days || 0.2) * DAY) return;
  W.wisdom[k] = W.day; W.wisT = 0;
  if (!(typeof THUMB !== 'undefined' && THUMB)) {
    toast(TX(`知恵　${name}　— ${text}`, `Wisdom: ${name} — ${text}`), 8); Sound.play('win');
    if (k === 'round') later(3, roundPanel);
  }
}
const wisdomList = () => WISDOM.filter(([k]) => knows(k)).map(([, n]) => n).join(TX('・', ' · '));

// 最後の知恵: ヒトの観察帳（本当は、昔の人はこうして大地が丸いと知った）
function roundPanel() {
  if (typeof ENDING !== 'undefined' && ENDING) return;
  showPanel(TX(`<h2>ヒトの観察帳</h2>
    <p>火を囲み、畑をたがやし、空を見上げつづけたヒトは、ある考えにたどりついた。この大地は、本当は丸いのではないか、と。</p>
    <p class="truth"><b>本当は</b>　昔の人も、空を見て大地が丸いと気づいていた。アリストテレス（紀元前4世紀）は、月食のとき月にうつる大地の影がいつも丸いこと、南へ旅すると見える星が変わることを理由にあげた。エラトステネス（紀元前3世紀）は、二つの町で同じ日の正午の影の長さがちがうことから、地球の大きさを測った。</p>
    <p class="small">ヒトの知恵: ${wisdomList()}</p>`, `<h2>The Humans’ Field Notes</h2>
    <p>Gathering around their fire, plowing their fields and watching the sky, the humans arrived at an idea: perhaps this land is really round.</p>
    <p class="truth"><b>What is really true:</b> people long ago also learned from the sky that the Earth is round. Aristotle (4th century BCE) pointed out that the Earth’s shadow on the Moon during a lunar eclipse is always round, and that the stars you can see change as you travel south. Eratosthenes (3rd century BCE) measured the size of the Earth from the different lengths of noon shadows in two cities on the same day.</p>
    <p class="small">The humans’ wisdom: ${wisdomList()}</p>`),
  [{ label: TX('世界の版画をのこす', 'Make a World Print'), fn: () => openPrints(roundPanel) }, { label: TX('箱庭へもどる', 'Back to the garden'), main: true }]);
  $('panel').classList.add('world', 'ending');
}

// 村の家（ヒト 3 人に 1 軒。村のまわりの決まった所）と、夜の火
function hutSpots() {
  if (!W.village) return [];
  const n = Math.min(5, Math.ceil(humanCount() / 3)), out = [];
  for (let k = 0; k < n; k++) { const an = k * 2.4 + 0.6, r = k ? 2.2 + (k % 2) * 0.8 : 0.9; out.push({ x: W.village.x + Math.cos(an) * r, y: W.village.y + Math.sin(an) * r }); }
  return out;
}
