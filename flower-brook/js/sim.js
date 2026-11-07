// 花の小川 段階A1 の決まり。DOM を使わない純粋な計算。node でも読める（tools/autoplay.mjs）。
// 決まりは PLAN.md の「しくみ」。数字はすべて RULE に。
// - 乱数はコースを作るときだけ（種つき）。固定の刻み（RULE.dt）で step(state, input) を進める。同じ種・同じ入力なら同じ結果。
// - 川は1本の道 s（0＝はじめ、RULE.len＝出口）と、川はばの中の左右 x（-1＝左岸、+1＝右岸）。
// - 玉は s の大きい順（0 が先頭）。となりどうしだけがつながる（links[i] は玉 i と i+1）。

export const RULE = {
  dt: 1 / 30,
  len: 3600,            // 川の長さ
  n: 12,                // 玉の数
  gap: 14,              // 玉のあいだ
  w0: 0.90,             // はじめの水
  wFloor: 0.55,         // 花が飲んでも、これより下には乾かない
  speed: { bank: 4, mid: 40, curve: 1.7, pull: 0.9, back: 0.85, ease: 1.6 },  // 流れ: まん中 mid・岸 bank（本物の川と同じく、まん中ほど速い）。指で引くと流れの ×(1＋pull)〜×(1−back)。速く下りたければ、まん中へ出るしかない。ease＝速さが目あてへ近づく速さ（1/秒。はなしても勢いが少し残る）
  steer: 3.0,           // 先頭の玉が指の左右へ寄る速さ（1/秒）
  drink: { k: 0.012, mid: 0.12, sun: 1.9 },  // 花が飲む速さ。岸から遠い（まん中）ほど mid に近づく。日なたは ×sun
  bond: { top: 1.15, peak: 0.73, width: 0.06, fiber: 0.28, fiberMax: 2, clump: 0.55 },  // つながりの強さ（いちばん強い top は、ふだんの締めつけ squeeze より強い。雷のときは負ける）
  wJoin: 0.83,          // これより湿った切れは、離れていても寄りあってまた混ざる（どろりとしたかたまり）
  wStick: 0.71,         // これより湿った切れは、ふれるとくっつく（アーチで詰まったときなど）
  wPellet: 0.68,        // これより乾いてちぎれた玉は、丸まって粒になる
  wMelt: 0.84,          // これより湿ると、玉の形がなくなる（7段）
  wMush: 0.805,         // これより湿ると、ふちがくずれる（6段）
  wSoft: 0.775,         // これより湿ると、やわらかい（5段）
  wSmooth: 0.70,        // 1本のままで、これより湿っていればなめらか（4段）。下ならひび（3段）
  arch: { n: 8, half: 22, squeeze: 0.9, slow: 0.75, periodMin: 3.2, periodMax: 5.5 },
  fiber: { n: 26, reach: 12, side: 0.28, hold: 0.55, spread: 0.25, speed: 0.06 },  // わら: hold＝飲まれにくさ、speed＝かさで速く
  patch: { every: 90, bloom: 0.010, rareBloom: 0.22, sun: 8 },  // 花の区画。咲くのに飲む水（玉の水の合計で）
  thunder: { n: 2, dur: 14, squeeze: 1.7, rush: 46 },
  wave: { n: 3, speed: 160, ride: 5, rideSpeed: 95, catchX: 0.45 },  // 先頭が |x|<catchX（まん中の流れ）にいると乗ってしまう
  pond: { len: 260, speed: 16, settle: 4 },  // 出口の前の池: 切れがここに集まって押しあう（直腸にたまるたとえ）。全部が入って settle 秒で花へ
  wHard: 0.64,          // これより乾いた粒は、池で押されてもかたまらない（ばらばらの粒のまま）
};

// ---------- 小さな道具 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function rng(seed) {  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- コース（種から作る） ----------
export function makeCourse(seed) {
  const R = rng(seed), L = RULE.len;
  const arches = [];
  for (let i = 0; i < RULE.arch.n; i++) {
    const s = L * (i + 0.8 + R() * 0.4) / (RULE.arch.n + 1);
    arches.push({ s, period: RULE.arch.periodMin + R() * (RULE.arch.periodMax - RULE.arch.periodMin), phase: R() });
  }
  // 花の区画: 左右の岸にすきまなく並ぶ。日なたの帯（区画2つ）は、池の手前までにほぼ等間隔で RULE.patch.sun 本、岸はでたらめ。そこにめずらしい花
  const patches = [], E = RULE.patch.every, per = Math.ceil(L / E);
  for (const side of [-1, 1]) for (let k = 0; k < per; k++) patches.push({ side, s0: k * E, s1: (k + 1) * E, sun: false, rare: false, drunk: 0 });
  const sunN = RULE.patch.sun, runL = L - RULE.pond.len - 200;
  for (let j = 0; j < sunN; j++) {
    const k = Math.floor((200 + runL * (j + 0.3 + R() * 0.4) / sunN) / E);
    const base = R() < 0.5 ? 0 : per;
    for (const kk of [k, k + 1]) if (patches[base + kk]) { patches[base + kk].sun = true; patches[base + kk].rare = true; }
  }
  const fibers = [];
  for (let i = 0; i < RULE.fiber.n; i++) fibers.push({ s: 120 + R() * (L - 240), x: (R() * 2 - 1) * 0.9, taken: false });
  const thunders = [];
  for (let i = 0; i < RULE.thunder.n; i++) thunders.push({ t: 25 + R() * 80, kind: R() < 0.5 ? 'squeeze' : 'rush' });
  const waves = [];
  for (let i = 0; i < RULE.wave.n; i++) waves.push({ t: 15 + i * 40 + R() * 25, front: null, used: false });
  return { seed, arches, patches, fibers, thunders, waves };
}

// アーチのすぼまり 0〜1（時刻 t で）
export function squeezeAt(a, t) {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / a.period + a.phase));
}

// ---------- はじめの状態 ----------
export function newState(seed) {
  const course = makeCourse(seed);
  const beads = [];
  for (let i = 0; i < RULE.n; i++) {
    beads.push({ s: (RULE.n - 1 - i) * RULE.gap + 10, x: 0, w: RULE.w0, f: 0, pellet: false, out: false });
  }
  const links = [];
  for (let i = 0; i < RULE.n - 1; i++) links.push({ on: true, clump: false });
  return {
    t: 0, course, beads, links,
    lead: { x: 0, v: RULE.speed.mid },
    thunder: null,   // { kind, until }
    ride: 0,         // 大きな流れに乗っているのこり秒
    log: [],         // できごと（画面で使う）
    done: false, grade: null,
  };
}

// つながりの強さ（2つの玉の平均の水 w とわら f から）
export function bondStrength(w, f) {
  const b = RULE.bond;
  return b.top * Math.exp(-(((w - b.peak) / b.width) ** 2)) + b.fiber * Math.min(f, b.fiberMax);
}

// ---------- 1刻み進める ----------
// input: { x: -1〜1（先頭が寄っていく左右）, pull: -1〜1（指で引く向き。前へ＋、うしろへ−、はなすと 0） }
// 川の流れの速さ（左右の位置 x で。まん中ほど速い）
export function currentAt(x) {
  const sp = RULE.speed;
  return sp.bank + (sp.mid - sp.bank) * (1 - Math.min(1, Math.abs(x)) ** sp.curve);
}
export function step(S, input) {
  if (S.done) return S;
  const dt = RULE.dt, C = S.course, B = S.beads;
  S.t += dt;

  // 雷・大きな流れの始まり
  for (const th of C.thunders) if (!th.on && S.t >= th.t) { th.on = true; S.thunder = { kind: th.kind, until: S.t + RULE.thunder.dur }; S.log.push({ t: S.t, ev: 'thunder', kind: th.kind }); }
  if (S.thunder && S.t > S.thunder.until) S.thunder = null;
  const squeezeMul = S.thunder?.kind === 'squeeze' ? RULE.thunder.squeeze : 1;
  const lead = B.find(b => !b.out);
  for (const wv of C.waves) {
    if (wv.front === null && S.t >= wv.t) wv.front = 0;
    if (wv.front !== null && !wv.used) {
      wv.front += RULE.wave.speed * dt;
      if (lead && wv.front >= lead.s) {
        wv.used = true;
        if (Math.abs(lead.x) < RULE.wave.catchX) { S.ride = RULE.wave.ride; S.log.push({ t: S.t, ev: 'ride' }); }
        else S.log.push({ t: S.t, ev: 'wave-miss' });
      }
    }
  }
  if (S.ride > 0) S.ride -= dt;

  // 流れの速さ
  const sp = RULE.speed, pull = clamp(input.pull || 0, -1, 1);
  const want = currentAt(S.lead.x) * (pull < 0 ? 1 + pull * sp.back : 1 + pull * sp.pull);
  S.lead.v += (want - S.lead.v) * Math.min(1, sp.ease * dt);   // しずくの勢い
  let base = S.lead.v;
  if (S.thunder?.kind === 'rush') base = Math.max(base, RULE.thunder.rush);
  if (S.ride > 0) base = RULE.wave.rideSpeed;

  // 左右: 先頭は指へ、うしろは前の玉を追う（川の道すじをなぞる）
  S.lead.x += (clamp(input.x, -1, 1) - S.lead.x) * Math.min(1, RULE.steer * dt);
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; if (b.out) continue;
    const tx = i === 0 || B[i - 1].out ? S.lead.x : B[i - 1].x;
    b.x += (tx - b.x) * Math.min(1, dt * (base / RULE.gap * 0.6 + 0.5));   // 流れがおそくても、うしろの玉は少しずつ同じ岸へ寄る
  }

  // 進む（アーチがすぼまっていると、そこでおそくなる）
  const pond0 = RULE.len - RULE.pond.len;
  for (const b of B) {
    if (b.out) continue;
    let v = base * (1 + RULE.fiber.speed * Math.min(b.f, 2));
    if (S.ride <= 0) for (const a of C.arches) if (Math.abs(b.s - a.s) < RULE.arch.half) v *= 1 - RULE.arch.slow * squeezeAt(a, S.t);
    if (b.s >= pond0) v = RULE.pond.speed;               // 池の中は指に関係なく、ゆっくり奥へ
    b.s = Math.min(b.s + v * dt, RULE.len);              // 池の奥は行き止まり
  }
  // つながり（ばね）と、ぶつかり（重ならない）
  for (let it = 0; it < 3; it++) {
    for (let i = 0; i < B.length - 1; i++) {
      const a = B[i], c = B[i + 1]; if (a.out || c.out) continue;
      const d = a.s - c.s;
      if (S.links[i].on) { const e = (d - RULE.gap) * 0.25; a.s -= e; c.s += e; }
      else if (d < RULE.gap * 0.9) { const e = (d - RULE.gap * 0.9) * 0.5; a.s -= e; c.s += e; }
      else if (a.w > RULE.wJoin && c.w > RULE.wJoin && d < RULE.gap * 1.6) { const e = (d - RULE.gap * 0.9) * 0.08; a.s -= e; c.s += e; }  // 湿った切れは寄りあう
    }
  }
  // 池の奥の行き止まりから、うしろへ押しもどす（重ならない）
  B[0].s = Math.min(B[0].s, RULE.len);
  for (let i = 1; i < B.length; i++) {
    const min = S.links[i - 1].on ? RULE.gap * 0.97 : RULE.gap * 0.9;
    if (B[i].s > B[i - 1].s - min) B[i].s = B[i - 1].s - min;
  }

  // 花が飲む
  const dk = RULE.drink;
  for (const b of B) {
    if (b.out) continue;
    const hold = 1 / (1 + RULE.fiber.hold * Math.min(b.f, 3));
    for (const side of [-1, 1]) {
      const near = clamp(side * b.x, 0, 1);              // その岸へどれだけ寄っているか
      const p = patchAt(C, side, b.s);
      if (!p) continue;
      const rate = dk.k * (dk.mid + (1 - dk.mid) * near * near) * (p.sun ? dk.sun : 1) * hold;
      const dw = rate * (b.w - RULE.wFloor) * dt;
      b.w -= dw; p.drunk += dw;
    }
  }

  // わらを拾う・となりへ広がる
  for (const fb of C.fibers) {
    if (fb.taken) continue;
    for (const b of B) if (!b.out && Math.abs(b.s - fb.s) < RULE.fiber.reach && Math.abs(b.x - fb.x) < RULE.fiber.side) { fb.taken = true; b.f += 1; S.log.push({ t: S.t, ev: 'fiber' }); break; }
  }
  for (let i = 0; i < B.length - 1; i++) {
    if (!S.links[i].on) continue;
    const a = B[i], c = B[i + 1], m = (a.f - c.f) * RULE.fiber.spread * dt;
    a.f -= m; c.f += m;
  }

  // アーチで締める: つながりの強さより締める力が大きいと、ちぎれる
  if (S.ride <= 0) for (let i = 0; i < B.length - 1; i++) {
    const L = S.links[i], a = B[i], c = B[i + 1];
    if (!L.on || a.out || c.out) continue;
    const mid = (a.s + c.s) / 2;
    for (const ar of C.arches) {
      if (Math.abs(mid - ar.s) > RULE.arch.half * 0.5) continue;
      const force = RULE.arch.squeeze * squeezeAt(ar, S.t) * squeezeMul;
      const w = (a.w + c.w) / 2, f = (a.f + c.f) / 2;
      const strength = L.clump ? RULE.bond.clump : bondStrength(w, f);
      if (force > strength) { L.on = false; L.clump = false; S.log.push({ t: S.t, ev: 'break', i }); }
    }
  }
  // ちぎれたままの乾いた玉は丸まって粒に。湿った玉はふれるとまたくっつく。乾いた粒もアーチで詰まると房にかたまる
  for (let i = 0; i < B.length - 1; i++) {
    const L = S.links[i], a = B[i], c = B[i + 1];
    if (L.on || a.out || c.out) continue;
    const touching = a.s - c.s < RULE.gap * 0.95;
    if (touching && a.w > RULE.wStick && c.w > RULE.wStick) { L.on = true; continue; }  // やわらかい切れは、ふれるとくっつく
    if (touching && Math.min(a.w, c.w) >= RULE.wHard) {  // 乾いた粒も、締められたり池で押されたりすると、かたまって房に
      const mid = (a.s + c.s) / 2;
      let pressed = mid >= pond0;
      for (const ar of C.arches) if (Math.abs(mid - ar.s) < RULE.arch.half && squeezeAt(ar, S.t) * squeezeMul > 0.5) pressed = true;
      if (pressed) { L.on = true; L.clump = true; S.log.push({ t: S.t, ev: 'clump', i }); }
    }
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const free = (i === 0 || !S.links[i - 1].on) && (i === B.length - 1 || !S.links[i].on);
    if (free && b.w < RULE.wPellet) b.pellet = true;
  }

  // 池: 全部が入ってしばらくしたら、花に吸いこまれて終わり
  if (B[B.length - 1].s >= pond0) {
    S.inPond = (S.inPond || 0) + dt;
    if (S.inPond >= RULE.pond.settle) { S.done = true; S.grade = gradeOf(S); }
  }
  return S;
}

export function patchAt(C, side, s) {
  const k = Math.floor(s / RULE.patch.every);
  const p = C.patches[(side < 0 ? 0 : 1) * Math.ceil(RULE.len / RULE.patch.every) + k];
  return p && s >= p.s0 && s < p.s1 ? p : null;
}

// ---------- 形の7段（作る人の呼び名。画面では花の名前） ----------
export function shapeOf(S) {
  const B = S.beads, n = B.length;
  const meanW = B.reduce((a, b) => a + b.w, 0) / n;
  let pieces = 1, clumps = 0;
  for (const L of S.links) { if (!L.on) pieces++; else if (L.clump) clumps++; }
  const pellets = B.filter(b => b.pellet).length;
  return { meanW, pieces, clumps, pellets };
}
export function gradeOf(S) {
  const { meanW, pieces, clumps, pellets } = shapeOf(S);
  if (meanW >= RULE.wMelt) return 7;
  if (meanW >= RULE.wMush) return 6;
  if (pellets + clumps >= S.beads.length / 2) return clumps >= pellets / 2 ? 2 : 1;
  if (clumps >= 2) return 2;
  if (meanW >= RULE.wSoft) return 5;
  if (pieces === 1 && clumps < 2) return meanW >= RULE.wSmooth ? 4 : 3;
  if (clumps >= 2) return 2;
  return pieces <= 3 ? 3 : 1;
}

// 咲いた花（めずらしい花の数・ふつうの花の数）
export function bloomOf(S) {
  let rare = 0, normal = 0, rareAll = 0;
  for (const p of S.course.patches) {
    if (p.rare) { rareAll++; if (p.drunk >= RULE.patch.rareBloom) rare++; }
    else if (p.drunk >= RULE.patch.bloom) normal++;
  }
  return { rare, rareAll, normal, normalAll: S.course.patches.length - rareAll };
}
