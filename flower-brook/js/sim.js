// 花の小川 段階A1 の決まり。DOM を使わない純粋な計算。node でも読める（tools/autoplay.mjs）。
// 決まりは PLAN.md の「しくみ」。数字はすべて RULE に。
// - 乱数はコースを作るときだけ（種つき）。固定の刻み（RULE.dt）で step(state, input) を進める。同じ種・同じ入力なら同じ結果。
// - 川は1本の道 s（0＝はじめ、RULE.len＝出口）と、川はばの中の左右 x（-1＝左岸、+1＝右岸）。
// - 玉は s の大きい順（0 が先頭）。となりどうしだけがつながる（links[i] は玉 i と i+1）。

export const RULE = {
  dt: 1 / 30,
  len: 3600,            // 川の長さ
  n: 28,                // 粒の数（段階A4。はじめはばらばら）
  r: 5.5,               // 粒の半径（ふれる＝2r）
  rest: 9.5,            // つながった粒のあいだ（2r より短い＝重なって、もちもちの1つの形に）
  W: 35,                // 左右 1 が、道の長さでいくつか（川はばの半分）
  mass: 12 / 28,        // 1粒の水の量（玉 12 個のころとそろえる。花が飲む量の計算に）
  scatter: { s0: 10, len: 320, x: 0.9 },   // はじめに散らばる範囲
  herd: { R: 55, k: 7, max: 130, back: -50, ease: 12, flingT: 1.4, flingEase: 0.35 },   // 指でつまむ（ver. 0.6）: つまめる半径・塊が指へ向かう速さ（距離×k）・前へ／うしろへの上限・放したあと勢いが残る秒
  crowd: { far: 150, k: 0.5 },
  tension: { s: 0.25, x: 1.4 },   // 表面の張り（1/秒）: 塊の粒が塊のまん中へ寄る速さ。横に強く、流れの向きに弱い＝流れにそって細長い形に              // 群れのまん中から far より離れた粒は、群れへ寄る
  w0: 0.90,             // はじめの水
  wFloor: 0.55,         // 花が飲んでも、これより下には乾かない
  speed: { bank: 4, mid: 40, curve: 1.7, ease: 1.6 },  // 流れ: まん中 mid・岸 bank（本物の川と同じく、まん中ほど速い）。指で引くと流れの ×(1＋pull)〜×(1−back)。速く下りたければ、まん中へ出るしかない。ease＝速さが目あてへ近づく速さ（1/秒。はなしても勢いが少し残る）
  drink: { k: 0.012, mid: 0.12, sun: 1.9 },  // 花が飲む速さ。岸から遠い（まん中）ほど mid に近づく。日なたは ×sun
  bond: { top: 1.15, peak: 0.73, width: 0.06, fiber: 0.28, fiberMax: 2, clump: 0.55 },  // つながりの強さ（いちばん強い top は、ふだんの締めつけ squeeze より強い。雷のときは負ける）
  wJoin: 0.83,          // これより湿った切れは、離れていても寄りあってまた混ざる（どろりとしたかたまり）
  wStick: 0.71,         // これより湿った切れは、ふれるとくっつく（アーチで詰まったときなど）
  wPellet: 0.68,        // これより乾いてちぎれた玉は、丸まって粒になる
  wMelt: 0.84,          // これより湿ると、玉の形がなくなる（7段）
  wMush: 0.805,         // これより湿ると、ふちがくずれる（6段）
  wSoft: 0.775,         // これより湿ると、やわらかい（5段）
  wSmooth: 0.70,        // 1本のままで、これより湿っていればなめらか（4段）。下ならひび（3段）
  arch: { n: 8, half: 22, squeeze: 0.9, slow: 0.75, pinch: 0.8, periodMin: 3.2, periodMax: 5.5 },
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
// しずくは小さな粒 RULE.n 個。はじめは川のはじめに広く散らばる（段階A4: なかまが集まる）。
// 粒: s（川の道）・x（左右 -1〜1）・vs・vx（速さ）・w（水）・f（わら）・pellet（かたい粒）・g（いまの塊の番号）
export function newState(seed) {
  const course = makeCourse(seed), R = rng(seed * 7 + 1), sc = RULE.scatter;
  const beads = [];
  for (let i = 0; i < RULE.n; i++) {
    beads.push({ s: sc.s0 + R() * sc.len, x: (R() * 2 - 1) * sc.x, vs: RULE.speed.mid * 0.5, vx: 0, w: RULE.w0 + (R() - 0.5) * 0.02, f: 0, pellet: false, out: false, g: i, ride: 0, fling: 0 });
  }
  return {
    t: 0, course, beads,
    links: new Map(),   // key＝i*64+j（i<j） → { clump }
    groups: RULE.n, center: 0, front: 0, main: { s: 0, x: 0, n: 1, g: 0 },
    thunder: null,
    log: [],
    done: false, grade: null,
  };
}

// つながりの強さ（2つの粒の平均の水 w とわら f から）
export function bondStrength(w, f) {
  const b = RULE.bond;
  return b.top * Math.exp(-(((w - b.peak) / b.width) ** 2)) + b.fiber * Math.min(f, b.fiberMax);
}

// 川の流れの速さ（左右の位置 x で。まん中ほど速い）
export function currentAt(x) {
  const sp = RULE.speed;
  return sp.bank + (sp.mid - sp.bank) * (1 - Math.min(1, Math.abs(x)) ** sp.curve);
}
// 川はばの倍率（出口の前の池でふくらむ）。3D の川と同じ形
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function riverWidth(s) {
  const L = RULE.len, p0 = L - RULE.pond.len;
  if (s < p0 - 80) return 1;
  const k = 1 + 1.5 * Math.sin(Math.PI * smooth(p0 - 80, L + 30, s));
  return s < L ? k : k * (1 - smooth(L, L + 60, s));
}

// ---------- 1刻み進める ----------
// input: { on: 指を置いているか, fs: 指の川の道 s, fx: 指の左右 x }。指は「つまむ」（ver. 0.6）: 指のそばの塊をつまむと、指をはなすまで
// 塊ごと指の下へついてくる（流れより指が勝つ。うしろへも運べる）。押したまま ほかの塊に近づけると、それもつまむ（集める）。
// はなすと、運んでいた勢いがしばらく残る（放る）。
export function step(S, input) {
  if (S.done) return S;
  const dt = RULE.dt, C = S.course, B = S.beads, N = B.length, W = RULE.W, L = RULE.len, pond0 = L - RULE.pond.len;
  S.t += dt;

  // 雷・大きな流れ
  for (const th of C.thunders) if (!th.on && S.t >= th.t) { th.on = true; S.thunder = { kind: th.kind, until: S.t + RULE.thunder.dur }; S.log.push({ t: S.t, ev: 'thunder', kind: th.kind }); }
  if (S.thunder && S.t > S.thunder.until) S.thunder = null;
  const squeezeMul = S.thunder?.kind === 'squeeze' ? RULE.thunder.squeeze : 1;
  for (const wv of C.waves) {
    if (wv.front === null && S.t >= wv.t) { wv.front = 0; wv.rode = 0; }
    if (wv.front === null || wv.used) continue;
    const f0 = wv.front; wv.front += RULE.wave.speed * dt;
    for (const b of B) if (b.s > f0 && b.s <= wv.front && b.s < pond0 && Math.abs(b.x) < RULE.wave.catchX) { b.ride = RULE.wave.ride; wv.rode++; }   // まん中の流れにいる粒は乗ってしまう
    if (wv.front > S.front + 10) { wv.used = true; S.log.push({ t: S.t, ev: wv.rode ? 'ride' : 'wave-miss', n: wv.rode }); }
  }

  // 群れのまん中（なかまから遠い粒は、群れへ寄る）
  let sc = 0; for (const b of B) sc += b.s; sc /= N;
  const sp = RULE.speed, hd = RULE.herd, cr = RULE.crowd;
  // 指（せき）がとどく強さは塊ごと: 塊のどれかの粒に指がとどけば、塊ごと寄ってくる
  // つまむ: 指のそばの粒の塊をつまみ、押しているあいだは はなさない（指が速く動いて離れても）。つまんだ塊にくっついた塊もいっしょに
  if (!S.cap) S.cap = new Array(N).fill(false);
  const gk = new Array(N).fill(0);
  if (input.on) {
    const R = S.wasOn ? hd.R : hd.R * 1.6;   // 押した瞬間は広めに（少しはずれても、いちばん近い塊をつまめる）
    for (let i = 0; i < N; i++) { const b = B[i]; if (S.cap[i] || Math.hypot(input.fs - b.s, (input.fx - b.x) * W) < R) gk[b.g] = 1; }
  } else for (let i = 0; i < N; i++) if (S.cap[i]) B[i].fling = hd.flingT;   // はなした: 運んでいた勢いが残る
  // 塊のまん中（つまんだ塊は、形をくずさず まん中が指へ向かう）
  const cs = new Array(N).fill(0), cx = new Array(N).fill(0), cn = new Array(N).fill(0);
  for (const b of B) { cs[b.g] += b.s; cx[b.g] += b.x; cn[b.g]++; }
  for (const b of B) {
    const k = gk[b.g];
    // ほしい速さ: 自分の左右の流れ（アーチがすぼまっていると、そこでおそい）
    let vs = currentAt(b.x) * (1 + RULE.fiber.speed * Math.min(b.f, 2)), vx = 0;
    if (S.thunder?.kind === 'rush') vs = Math.max(vs, RULE.thunder.rush);
    if (b.ride > 0) { b.ride -= dt; vs = RULE.wave.rideSpeed; }
    for (const a of C.arches) if (Math.abs(b.s - a.s) < RULE.arch.half) vs *= 1 - RULE.arch.slow * squeezeAt(a, S.t);
    const ms = S.main.n > 1 ? S.main.s : sc;   // なかま: いちばん大きな塊から離れた粒は、そちらへ寄る（左右にも）
    if (b.s < ms - cr.far) { vs += cr.k * (ms - cr.far - b.s); vx += (S.main.x - b.x) * 0.3; }
    if (b.s > ms + cr.far) vs -= cr.k * (b.s - ms - cr.far);
    if (b.s >= pond0) { vs = RULE.pond.speed; vx = -b.x * 0.15; }
    // 指（せき）: 近い粒ほど、指のほうへ向かう
    if (k > 0) { const n = cn[b.g], ds = input.fs - cs[b.g] / n, dx = (input.fx - cx[b.g] / n) * W; vs = clamp(ds * hd.k, hd.back, hd.max); vx = clamp(dx * hd.k, -hd.max, hd.max) / W; }   // つまんだ塊: 流れより指が勝つ
    if (b.fling > 0) b.fling -= dt;
    b.vs += (vs - b.vs) * Math.min(1, (k > 0 ? hd.ease : b.fling > 0 ? hd.flingEase : sp.ease) * dt);   // 指がとどいている塊は、すばやくついてくる。放った塊は勢いが長く残る
    b.vx += (vx - b.vx) * Math.min(1, (k > 0 ? hd.ease : 3) * dt);
  }
  // 放る: はなす直前に指がとどいていた塊へ、指の勢いを足す
  S.cap = B.map(b => gk[b.g] > 0); S.wasOn = !!input.on;   // 粒ごと（塊の番号はこの刻みの終わりで振り直されるので）
  S.held = S.cap;
  // つながった粒は、速さをわけあう（ひとつの塊として動く）
  for (const [key] of S.links) { const a = B[key >> 6], c = B[key & 63], m = (a.vs - c.vs) * 0.12, mx = (a.vx - c.vx) * 0.12; a.vs -= m; c.vs += m; a.vx -= mx; c.vx += mx; }
  // 進む。アーチがすぼまると、通れる幅がせまくなって、粒はまん中へ寄せられる
  for (const b of B) {
    b.s += b.vs * dt; b.x += b.vx * dt;
    let lim = riverWidth(b.s);
    for (const a of C.arches) if (Math.abs(b.s - a.s) < RULE.arch.half) lim = Math.min(lim, 1 - RULE.arch.pinch * Math.min(1, squeezeAt(a, S.t) * squeezeMul));
    b.x = clamp(b.x, -lim, lim);
    b.s = Math.min(b.s, L - RULE.r);
  }
  // つながり（ばね）・ぶつかり（重ならない）・湿った粒どうしは寄りあう。左右は W 倍して道と同じ長さで
  const two = RULE.r * 2;
  for (let it = 0; it < 3; it++) for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = B[i], c = B[j], ds = c.s - a.s, dx = (c.x - a.x) * W, d = Math.hypot(ds, dx) || 1e-3;
    if (d > two * 3) continue;
    const L1 = S.links.get(i * 64 + j);
    let e = 0;
    if (L1) e = (d - RULE.rest) * 0.25;
    else if (d < two) e = (d - two) * 0.5;
    else if (a.w > RULE.wJoin && c.w > RULE.wJoin && !a.pellet && !c.pellet) e = (d - two) * 0.03;
    if (!e) continue;
    const us = ds / d, ux = dx / d;
    a.s += us * e; c.s -= us * e; a.x += ux * e / W; c.x -= ux * e / W;
  }

  // 表面の張り: 塊の粒は、塊のまん中へ寄る（列にのびず、丸いもちになる。アーチで細くされても、また丸まる）
  const gs = new Array(N).fill(0), gx = new Array(N).fill(0), gn = new Array(N).fill(0);
  for (const b of B) { gs[b.g] += b.s; gx[b.g] += b.x; gn[b.g]++; }
  for (const b of B) { const n = gn[b.g]; if (n < 2 || b.pellet) continue; b.s += (gs[b.g] / n - b.s) * Math.min(1, RULE.tension.s * dt); b.x += (gx[b.g] / n - b.x) * Math.min(1, RULE.tension.x * dt); }

  // 花が飲む（1粒の水の量は、玉 12 個のころの RULE.mass 倍）
  const dk = RULE.drink;
  for (const b of B) {
    const hold = 1 / (1 + RULE.fiber.hold * Math.min(b.f, 3));
    for (const side of [-1, 1]) {
      const near = clamp(side * b.x, 0, 1), p = patchAt(C, side, b.s);
      if (!p) continue;
      const rate = dk.k * (dk.mid + (1 - dk.mid) * near * near) * (p.sun ? dk.sun : 1) * hold;
      const dw = rate * (b.w - RULE.wFloor) * dt;
      b.w -= dw; p.drunk += dw * RULE.mass;
    }
  }
  // わらを拾う・つながりで広がる
  for (const fb of C.fibers) {
    if (fb.taken) continue;
    for (const b of B) if (Math.abs(b.s - fb.s) < RULE.fiber.reach && Math.abs(b.x - fb.x) < RULE.fiber.side) { fb.taken = true; b.f += 1; S.log.push({ t: S.t, ev: 'fiber' }); break; }
  }
  for (const [key] of S.links) { const a = B[key >> 6], c = B[key & 63], m = (a.f - c.f) * RULE.fiber.spread * dt; a.f -= m; c.f += m; }

  const cuts = [];   // 切れたつながり。塊が本当に2つに分かれたときだけ、あとで「ちぎれた」と記す（塊の中のつなぎかえは数えない）
  // ちぎれる: アーチで締める力がつながりより強い・のびすぎ（水っぽいほど、のびにくい＝すぐちぎれる）
  for (const [key, Lk] of S.links) {
    const i = key >> 6, j = key & 63, a = B[i], c = B[j];
    const w = (a.w + c.w) / 2, f = (a.f + c.f) / 2, strength = Lk.clump ? RULE.bond.clump : bondStrength(w, f);
    const mid = (a.s + c.s) / 2;
    let cut = Math.hypot(c.s - a.s, (c.x - a.x) * W) > RULE.rest * (1.7 + 0.9 * Math.min(1, strength));
    for (const ar of C.arches) if (Math.abs(mid - ar.s) < RULE.arch.half * 0.5 && RULE.arch.squeeze * squeezeAt(ar, S.t) * squeezeMul > strength) cut = true;
    if (cut) { S.links.delete(key); cuts.push(i, j); }
  }
  // くっつく: やわらかい粒はふれると合わさる。乾いた粒も、締められたり池で押されたりすると房に
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const key = i * 64 + j; if (S.links.has(key)) continue;
    const a = B[i], c = B[j];
    if (Math.hypot(c.s - a.s, (c.x - a.x) * W) > two * 1.04) continue;
    if (a.w > RULE.wStick && c.w > RULE.wStick && !a.pellet && !c.pellet) { S.links.set(key, { clump: false }); if (a.g !== c.g) S.log.push({ t: S.t, ev: 'join', i, j }); continue; }
    if (Math.min(a.w, c.w) >= RULE.wHard) {
      const mid = (a.s + c.s) / 2; let pressed = mid >= pond0;
      for (const ar of C.arches) if (Math.abs(mid - ar.s) < RULE.arch.half && squeezeAt(ar, S.t) * squeezeMul > 0.5) pressed = true;
      if (pressed) { S.links.set(key, { clump: true }); S.log.push({ t: S.t, ev: 'clump', i, j }); }
    }
  }
  // 塊の番号（つながりをたどる）と、ひとりになった乾いた粒はかたい粒に
  const par = B.map((_, i) => i), find = i => (par[i] === i ? i : (par[i] = find(par[i])));
  const deg = new Array(N).fill(0);
  for (const [key] of S.links) { const i = key >> 6, j = key & 63; par[find(i)] = find(j); deg[i]++; deg[j]++; }
  const ids = new Map(); let fr = -1e9;
  B.forEach((b, i) => { const r = find(i); if (!ids.has(r)) ids.set(r, ids.size); b.g = ids.get(r); if (!deg[i] && b.w < RULE.wPellet) b.pellet = true; fr = Math.max(fr, b.s); });
  S.groups = ids.size; S.center = sc; S.front = fr;
  for (let k = 0; k < cuts.length; k += 2) if (B[cuts[k]].g !== B[cuts[k + 1]].g) S.log.push({ t: S.t, ev: 'break', i: cuts[k], j: cuts[k + 1] });
  // いちばん大きな塊（カメラと指の基準）
  const cnt = new Array(N).fill(0), ms = new Array(N).fill(0), mx = new Array(N).fill(0);
  for (const b of B) { cnt[b.g]++; ms[b.g] += b.s; mx[b.g] += b.x; }
  let gi = 0; for (let g = 1; g < S.groups; g++) if (cnt[g] > cnt[gi] || (cnt[g] === cnt[gi] && ms[g] / cnt[g] > ms[gi] / cnt[gi])) gi = g;
  S.main = { s: ms[gi] / cnt[gi], x: mx[gi] / cnt[gi], n: cnt[gi], g: gi };

  // 池: 全部が入ってしばらくしたら、花に吸いこまれて終わり
  if (B.every(b => b.s >= pond0)) {
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
  const inClump = new Set();
  for (const [key, L] of S.links) if (L.clump) { inClump.add(key >> 6); inClump.add(key & 63); }
  const pellets = B.filter((b, i) => b.pellet && !inClump.has(i)).length;
  // 小さな切れ（2粒まで）は数えない（大きな塊がいくつに分かれたか）
  const size = new Map(); for (const b of B) size.set(b.g, (size.get(b.g) || 0) + 1);
  const pieces = [...size.values()].filter(v => v >= 3).length || 1;
  return { meanW, pieces, clumps: inClump.size, pellets, groups: S.groups };
}
export function gradeOf(S) {
  const { meanW, pieces, clumps, pellets } = shapeOf(S), n = S.beads.length;
  if (meanW >= RULE.wMelt) return 7;
  if (meanW >= RULE.wMush) return 6;
  if (pellets + clumps >= n / 2) return clumps >= pellets ? 2 : 1;
  if (clumps >= n / 4) return 2;
  if (meanW >= RULE.wSoft) return 5;
  if (pieces === 1) return meanW >= RULE.wSmooth ? 4 : 3;
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
