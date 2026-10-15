'use strict';
// 掘れば昔、積めば未来 — 遊び（原始人・操作・お題・人びと・ループ）
(function () {
  const Wd = window.World, D = window.Draw;
  const $ = s => document.querySelector(s);
  const CAP0 = 10, CAP1 = 24, JUMP = 11.2;            // 袋（はじめ・土器のあと）、跳ぶ強さ（約2マス）

  // ---- 原始人 ----
  // P.era が「いまの年」（高さ）。跳んでいるあいだは跳んだときの年のまま（世界がちらつかない）。
  // 着地・押し上げ・跳んだ高さより下へ落ちるときだけ、足もとの高さに合わせて変わる。
  const P = { x: 12.5, y: 0, era: 0, vx: 0, vy: 0, dir: 1, ground: false, walk: 0, moving: false, bag: [], cap: CAP0, pushing: 0, act: 0 };
  const HW = 0.3, HH = 1.6;                         // からだの半分の幅・背の高さ（マス）
  const G = { t: 0, started: false, paused: true, flags: {}, said: {}, minE: 0, clear: false, toastT: 0, talk: null, ev: 0, flow: 0, hover: null };

  function bodyHits(x, y, e) {
    const c0 = Math.floor(x - HW), c1 = Math.floor(x + HW - 1e-6);
    const j0 = Math.floor(y + 1e-4), j1 = Math.floor(y + HH - 1e-4);
    for (let c = c0; c <= c1; c++) for (let j = j0; j <= j1; j++) if (Wd.solid(c, j, e)) return true;
    return false;
  }
  const inWater = () => Wd.isRiver(Math.floor(P.x)) && P.y < Wd.waterLevel(P.era) - 0.15;
  const waterDepth = () => Wd.waterLevel(P.era) - Math.floor(Wd.H(Math.floor(P.x), P.era));
  const solidNow = (c, j) => Wd.solid(c, j, P.era);

  // ---- 入力 ----
  const keys = {};
  const hold = { left: false, right: false };
  addEventListener('keydown', ev => {
    if (ev.target.closest && ev.target.closest('dialog')) return;
    const k = ev.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) ev.preventDefault();
    if (keys[k]) return; keys[k] = true;
    if (!G.started || G.paused) { if (k === 'Enter' || k === ' ') $('#overlay button')?.click(); return; }
    G.hover = null;                                   // キーをさわったら、ねらいはキーのほうに戻す
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') jump();
    if (k === 'ArrowDown' || k === 's' || k === 'S') digDown();
    if (k === 'x' || k === 'X') digFront();
    if (k === 'z' || k === 'Z') put();
    if (k === 'c' || k === 'C') putFront();
  });
  addEventListener('keyup', ev => { keys[ev.key] = false; });
  const axis = () => ((keys.ArrowRight || keys.d || keys.D || hold.right) ? 1 : 0) - ((keys.ArrowLeft || keys.a || keys.A || hold.left) ? 1 : 0);

  function jump() { if (P.ground && !P.pushing) { P.vy = JUMP; P.ground = false; } else if (inWater() && waterDepth() < 1.6) P.vy = 7; }

  // ねらうマス（画面に枠で出す）
  function frontDigCell() { // X で掘るマス: 前の足もと → 前の頭 → 前の下
    const c = Math.floor(P.x + P.dir * (HW + 0.45)), j = Math.round(P.y);
    for (const jj of [j, j + 1, j - 1]) if (solidNow(c, jj) && jj >= Wd.ROCK) return { c, j: jj };
    return null;
  }
  function frontPutCell() { // C で積むマス: 前の足もと（あいていれば）→ 前の下（穴うめ）
    const c = Math.floor(P.x + P.dir * (HW + 0.45)), j = Math.round(P.y);
    if (!solidNow(c, j)) return solidNow(c, j - 1) || j - 1 < Wd.ROCK ? { c, j } : { c, j: j - 1 };
    if (!solidNow(c, j + 1)) return { c, j: j + 1 };
    return null;
  }
  const footCell = () => ({ c: Math.floor(P.x), j: Math.round(P.y) - 1 });
  const inReach = (c, j) => Math.abs(c + 0.5 - P.x) <= 2.6 && Math.abs(j + 0.5 - (P.y + 0.8)) <= 2.8;

  function take(c, j) {
    if (!solidNow(c, j)) return false;
    if (j < Wd.ROCK || c < 0 || c >= Wd.W) { toast('固い岩。いまの道具では掘れない'); return false; }
    if (P.bag.length >= P.cap) { toast('袋がいっぱい。積んでから掘ろう'); return false; }
    const k = Wd.key(c, j), m = Wd.mods.get(k);
    const mat = m && m.t === 'put' ? m.m : Wd.material(c, j);
    if (mat === 'stone') { toast('ピラミッドの石は、けずれない'); return false; }
    Wd.mods.set(k, { t: 'dug', e: P.era });
    P.bag.push(mat === 'brick' ? 'soil' : mat);
    P.act = 0.18; G.flags.dug = true;
    fx(c, j, mat, 'dig');
    return true;
  }
  function place(c, j) {
    if (!P.bag.length) { toast('袋がからっぽ。まず掘ろう'); return false; }
    if (solidNow(c, j) || c < 0 || c >= Wd.W) return false;
    let mat = P.bag.pop();
    if (P.era > 11 && (mat === 'soil' || mat === 'clay' || mat === 'tell')) mat = 'brick';  // 都の時代は、積む土がれんがになる
    Wd.mods.set(Wd.key(c, j), { t: 'put', m: mat, e: P.era });
    P.act = 0.18; fx(c, j, mat, 'put');
    return true;
  }
  function digDown() { // マスのまん中に寄ってから掘る（となりの列に足がかかって落ちない、を防ぐ）
    if (!P.ground) return;
    const f = footCell(), cx = f.c + 0.5;
    if (!bodyHits(cx, P.y, P.era)) P.x = cx;
    take(f.c, f.j);
  }
  function digFront() { const t = frontDigCell(); if (t) take(t.c, t.j); }
  function put() { // 足もとに積んで乗る（1マス上へ＝未来へ）
    if (!P.bag.length) { toast('袋がからっぽ。まず掘ろう'); return; }
    if (!P.ground && !inWater()) return;
    const c = Math.floor(P.x), j = Math.round(P.y);
    if (bodyHits(c + 0.5, j + 1, P.era)) { toast('頭の上がつかえて積めない'); return; }
    P.x = c + 0.5;
    if (place(c, j)) { P.y = j + 1; P.vy = 0; }
  }
  function putFront() { // 前に積む（段をつくる・穴をうめる）
    const t = frontPutCell();
    if (!t) return;
    const hitsBody = Math.abs(t.c + 0.5 - P.x) < 0.5 + HW && t.j + 1 > P.y && t.j < P.y + HH;
    if (!hitsBody) place(t.c, t.j);
  }

  // マウス・指: 押したマスが土なら掘る、あいていれば積む（右クリックはいつも積む）
  function cellAt(ev) {
    const r = $('#view').getBoundingClientRect();
    const p = D.toCell(ev.clientX - r.left, ev.clientY - r.top);
    return { c: Math.floor(p.x), j: Math.floor(p.y) };
  }
  function pointer(ev) {
    if (!G.started || G.paused) return;
    const { c, j } = cellAt(ev);
    G.hover = { c, j, t: G.t };
    if (!inReach(c, j)) { P.dir = c + 0.5 > P.x ? 1 : -1; return; }
    if (c === Math.floor(P.x) && j === Math.round(P.y) && !solidNow(c, j)) { put(); return; }
    if (ev.button !== 2 && solidNow(c, j)) { P.dir = c + 0.5 >= P.x ? 1 : -1; take(c, j); return; }
    const hitsBody = Math.abs(c + 0.5 - P.x) < 0.5 + HW && j + 1 > P.y && j < P.y + HH;
    if (!hitsBody) place(c, j);
  }
  function hover(ev) { if (ev.pointerType === 'mouse') { const h = cellAt(ev); G.hover = { c: h.c, j: h.j, t: G.t }; } }

  // 掘る・積むの小さな手ごたえ（土のつぶ）
  const PARTS = [];
  function fx(c, j, mat, kind) {
    for (let i = 0; i < 8; i++) PARTS.push({ x: c + 0.5 + (Math.random() - 0.5) * 0.8, y: j + 0.5 + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4 + (kind === 'dig' ? 2 : 0), life: 0.5, mat });
  }

  // ---- 人びと（いる年の範囲 e0〜e1） ----
  const NPC = [
    { id: 'father', x: 8.6, e0: -1.5, e1: 2.5, look: { h: 1.75, cloth: '#7a5534', skin: '#c99068', hair: '#2a1c12', fur: true, wild: true }, dir: 1 },
    { id: 'mother', x: 9.6, e0: -1.5, e1: 2.5, look: { h: 1.6, cloth: '#8a6440', skin: '#d4a07a', hair: '#3a2416', fur: true }, dir: 1 },
    { id: 'sister', x: 11.0, e0: -1.5, e1: 2.5, look: { h: 1.05, cloth: '#9a7048', skin: '#d8a882', hair: '#3a2416', fur: true }, dir: -1 },
    { id: 'potter', x: 71.5, e0: 3.5, e1: 9.5, look: { h: 1.5, cloth: '#c9b089', skin: '#c48c62', hair: '#d9d2c4' }, dir: -1 },
    { id: 'farmer', x: 78, e0: 3.5, e1: 9.5, look: { h: 1.7, cloth: '#a89466', skin: '#b98059', hair: '#2e2014' }, dir: -1 },
    { id: 'builder', x: 82.5, e0: 11.5, e1: 14.95, look: { h: 1.7, cloth: '#efe7d4', skin: '#b5784f', hair: '#1d140d' }, dir: 1 },
    { id: 'citizen', x: 72, e0: 11.5, e1: 21, look: { h: 1.6, cloth: '#e6dcc4', skin: '#bd8358', hair: '#1d140d' }, dir: 1 },
  ];
  function npcLine(n) {
    if (n.id === 'father' || n.id === 'mother' || n.id === 'sister') return G.started ? ({ father: '……。', mother: '火の番も、まともにできないなんて。', sister: 'おにいちゃん、どこいくの？' })[n.id] : null;
    if (n.id === 'potter') {
      if (G.flags.pot) return 'その土器、だいじにね。たくさん運べるよ。';
      const clay = P.bag.filter(m => m === 'clay').length;
      if (clay >= 3) {
        for (let i = 0; i < 3; i++) P.bag.splice(P.bag.indexOf('clay'), 1);
        G.flags.pot = true; P.cap = CAP1; G.flags.kilnLit = G.t;
        toast('土器の袋をもらった！ 運べる土が ' + CAP0 + ' → ' + CAP1 + ' になった');
        return 'ほら、焼きあがった。土は火で焼くと、こんなに固くなるんだよ。';
      }
      return '見ない顔だね。川べりの灰色の粘土を3つ持ってきておくれ。土器を焼いてあげよう。（いま ' + clay + ' つ）';
    }
    if (n.id === 'farmer') return '家がくずれたら、その上にまた建てるのさ。だから村の地面は、だんだん高くなる。';
    if (n.id === 'builder') return '王さまのピラミッドを、ここに建てるところだ。できあがりを見たいなら、もう少し先の時代だな。（Z で1マス積んでごらん）';
    if (n.id === 'citizen') return P.era < 14.95 ? 'この町は、昔の村の上にできているんだよ。掘ると土器のかけらが出てくる。' : 'ピラミッドができた！ てっぺんからは都が見わたせるそうだ。';
    return null;
  }
  // マンモス（氷期の飾り。むこう岸を行き来する）
  const MAM = [{ x: 74, dir: 1, sp: 0.5 }, { x: 88, dir: -1, sp: 0.4 }, { x: 93, dir: 1, sp: 0.35 }];

  // ---- お題 ----
  const GOALS = [
    { id: 'out', text: '家を飛び出す（→）', done: () => P.x > 21 },
    { id: 'pop', text: '平野の土を掘ってみる（↓）', done: () => G.flags.popped },
    { id: 'cross', text: '川をわたって、むこう岸へ', done: () => P.x > 64.5 },
    { id: 'up', text: '土を積んで上へ＝未来へ（Z）', done: () => P.x > 63 && P.y > 3 },
    { id: 'pot', text: '土器づくりを手伝う（粘土を3つ）', done: () => G.flags.pot },
    { id: 'pyr', text: 'ピラミッドのてっぺんに立つ', done: () => P.y > 22 && Math.abs(P.x - Wd.PYR.c) < 1.6 && P.ground },
  ];
  function goalsUI() {
    let cur = -1;
    const html = GOALS.map((g, i) => {
      const d = G.flags['goal_' + g.id];
      if (!d && cur < 0) cur = i;
      const show = d || i === cur;
      return `<li class="${d ? 'done' : i === cur ? 'now' : ''}">${show ? g.text : '？？？'}</li>`;
    }).join('');
    const el = $('#goals'); if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  }
  function checkGoals() {
    for (const g of GOALS) if (!G.flags['goal_' + g.id] && g.done()) {
      G.flags['goal_' + g.id] = true;
      if (g.id !== 'pyr') toast('できた: ' + g.text.replace(/（.*）/, ''));
      if (g.id === 'pyr') finish();
    }
  }

  // ---- できごとのひとこと（1回だけ） ----
  function hints() {
    const c = Math.floor(P.x);
    const say = (id, text, cond) => { if (cond && !G.said[id]) { G.said[id] = true; toast(text, 6); } };
    if (c >= 27 && c < 52 && P.y < -6 && P.ground) G.flags.popped = true;
    say('pop', '穴の底から、外に出た……？ ここは2万年前の河原だ。下へ行くほど、昔になる。', G.flags.popped);
    say('deep', '川が深くて流れが速い。この時代では、わたれない。', inWater() && waterDepth() > 1.6);
    say('shallow', '氷期の川は浅い。歩いてわたれる。', Wd.isRiver(c) && P.y < -6 && P.ground);
    say('push', '地面に押し上げられる！ 土がどんどん積もった時代だ。', P.pushing > 0.4);
    say('stairs', '高いところは、Z で足もとに積んで登れる。C で前に積むと段になる。積むほど未来へ。', G.flags.goal_cross && !G.flags.goal_up && P.x > 64 && P.ground);
    say('cold', '寒い……。最終氷期。海も今よりずっと低い。', P.y < -8);
  }

  // ---- ふきだし・トースト ----
  let toastTimer = 0;
  function toast(text, sec = 3.5) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); toastTimer = sec; }

  // ---- 物理 ----
  function physics(dt) {
    const E = P.era;
    P.act = Math.max(0, P.act - dt);
    if (bodyHits(P.x, P.y, E)) { // 時代が変わって地面が上がってきた → 押し上げられる
      P.y += Math.min(14, 6 + P.pushing * 10) * dt; P.vy = 0; P.ground = true; P.pushing += dt; P.moving = false;
      if (P.pushing > 6) { while (bodyHits(P.x, P.y, P.y) && P.y < 60) P.y += 1; }
      P.era = P.y;
      return;
    }
    P.pushing = 0;
    const ax = axis(), water = inWater(), deep = water && waterDepth() > 1.6;
    const sp = water ? (deep ? 1.6 : 2.6) : 4.6;
    P.vx += (ax * sp - P.vx) * Math.min(1, dt * 14);
    if (ax) P.dir = ax;
    if (deep) { // 深い川: 浮かんで、近い岸へ流される
      P.vx += (P.x < 58 ? -3 : 3) * dt * 4;
      P.vy += ((Wd.waterLevel(E) - 1.0) - P.y) * dt * 8 - P.vy * dt * 3;
    } else {
      P.vy -= (water ? 12 : 30) * dt;
      P.vy = Math.max(P.vy, water ? -3 : -13);
    }
    // 横
    let nx = P.x + P.vx * dt;
    if (bodyHits(nx, P.y, E)) {
      // 1マスの段は、歩くだけでのぼる（のぼると、1マスぶん未来へ）
      const up = Math.round(P.y) + 1;
      if (P.ground && ax && !bodyHits(nx, up, E) && !bodyHits(P.x, up, E)) { P.y = up; P.x = nx; P.ground = false; return; }
      nx = P.vx > 0 ? Math.floor(nx + HW) - HW - 1e-4 : Math.floor(nx - HW) + 1 + HW + 1e-4;
      if (bodyHits(nx, P.y, E)) nx = P.x;
      P.vx = 0;
    }
    P.x = Wd.clamp(nx, HW, Wd.W - HW);
    // 縦
    let ny = P.y + P.vy * dt;
    P.ground = false;
    if (P.vy <= 0) {
      if (bodyHits(P.x, ny, E)) { ny = Math.floor(ny) + 1; if (bodyHits(P.x, ny, E)) ny = P.y; P.vy = 0; P.ground = true; }
    } else if (bodyHits(P.x, ny, E)) { ny = Math.floor(ny + HH) - HH - 1e-4; P.vy = 0; }
    P.y = ny;
    P.moving = Math.abs(P.vx) > 0.3 && P.ground;
    if (P.moving) P.walk += dt * Math.abs(P.vx) / 3;
    if (P.y < Wd.E_MIN) { P.y = Wd.E_MIN; P.vy = 0; }
    // いまの年: 立っている・水の中ならその高さ。跳んでいるあいだは、跳んだ高さより下へ落ちたときだけ追いかける
    if (P.ground || water || P.y < P.era) P.era = P.y;
    G.minE = Math.min(G.minE, P.era);
  }

  // ---- ループ ----
  function step(dt) {
    G.t += dt;
    if (G.started && !G.paused) {
      physics(dt);
      for (const m of MAM) { m.x += m.dir * m.sp * dt; if (m.x > 97 || m.x < 67) m.dir *= -1; }
      for (let i = PARTS.length - 1; i >= 0; i--) { const q = PARTS[i]; q.vy -= 18 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if ((q.life -= dt) <= 0) PARTS.splice(i, 1); }
      checkGoals(); hints();
    }
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('#toast').classList.remove('show');
  }

  // ねらっているマスを枠で見せる（マウスならマウスの下、キーなら X で掘るマス・↓ で掘るマス）
  function targets() {
    const h = G.hover;
    if (h && G.t - h.t < 4 && inReach(h.c, h.j)) {
      if (solidNow(h.c, h.j)) D.target(h.c, h.j, 'dig');
      else if (P.bag.length) D.target(h.c, h.j, 'put');
      return;
    }
    if (!P.ground) return;
    const f = frontDigCell(); if (f) D.target(f.c, f.j, 'dig', 'X');
    const d = footCell(); if (solidNow(d.c, d.j) && d.j >= Wd.ROCK) D.target(d.c, d.j, 'dig', '↓');
    if (!f && P.bag.length) { const p = frontPutCell(); if (p) D.target(p.c, p.j, 'put', 'C'); }
  }

  function render(dt) {
    const cx = D.ctx(), dpr = D.dpr();
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 年がいっぺんに変わったら（着地・段・積む）、前の画面を重ねて消していく（ぱっと切りかわらないように）
    const E = P.era, t = G.t, dE = E - G.lastE;
    if (Math.abs(dE) > 0.35 && G.lastE != null && dt > 0) D.snapshot();
    G.flow += ((dt > 0 ? Math.abs(dE) / dt : 0) - G.flow) * Math.min(1, dt * 8);  // 年の流れる速さ（マス/秒）
    G.lastE = E;
    D.follow(P, dt, false);
    D.sky(E);
    D.caveMouth(E);
    D.terrain(E);
    // 時代の飾り
    const surf = c => Math.floor(Wd.H(c, E));
    if (E > -1.5 && E < 2.5) D.firePit(10.4, surf(10), t, G.clear);
    if (E > 3.5 && E < 9.8) { D.hut(68, surf(68)); D.hut(75, surf(75)); D.hut(80, surf(80)); D.kiln(73.2, surf(73), t, G.flags.kilnLit && t - G.flags.kilnLit < 6); for (let c = 84; c < 97; c++) D.wheat(c, surf(c), t); }
    if (E > 11 && E < 22) { D.house(67, surf(67), 1.4); D.house(71, surf(71), 1.1); D.house(76, surf(76), 1.6); D.house(80, surf(80), 1.0); }
    if (E > 11.5 && E < Wd.PYR.e0) D.scaffold(86, 94, surf(90), 3);
    if (E < -6.5) for (const m of MAM) D.mammoth(m.x, surf(Math.floor(m.x)), m.dir, t);
    // 人
    let talk = null;
    for (const n of NPC) {
      if (E < n.e0 || E > n.e1) continue;
      const y = surf(Math.floor(n.x));
      D.person(n.x, y, Object.assign({ dir: n.x > P.x ? -1 : 1 }, n.look));
      if (G.started && Math.abs(n.x - P.x) < 1.6 && Math.abs(y - P.y) < 1.2) talk = n;
    }
    if (talk !== G.talk) { G.talk = talk; G.talkText = talk ? npcLine(talk) : null; }
    D.person(P.x, P.y, { dir: P.dir, walk: P.walk, moving: P.moving, h: 1.6, cloth: '#7d5530', skin: '#cf9a70', hair: '#2b1b10', fur: true, wild: true,
      bag: G.flags.pot ? '#b0703f' : '#8b6a45', arm: P.act > 0 ? -1.4 : null });
    D.parts(PARTS);
    targets();
    if (G.talk && G.talkText) D.bubble(G.talk.x, surf(Math.floor(G.talk.x)) + G.talk.look.h + 0.2, G.talkText);
    D.fade(dt);
    D.flow(G.flow, dE, t);
    D.ruler(E);
    hud(E);
  }

  // ---- 画面の文字 ----
  const MATNAME = { soil: '土', loess: '黄色い土', clay: '粘土', tell: '町の土', old: '古い土', brick: 'れんが' };
  const MATCOL = { soil: '#5f4329', loess: '#c3a873', clay: '#8a8e95', tell: '#94765a', old: '#77654f', brick: '#b0613b' };
  function hud(E) {
    const yl = Wd.yearLabel(E); if ($('#year').textContent !== yl) $('#year').textContent = yl;
    const en = Wd.eraName(E) + ' ・ 1マス ≒ ' + Math.round(Wd.perTile(E)).toLocaleString('ja-JP') + '年';
    if ($('#era').textContent !== en) $('#era').textContent = en;
    // 袋: 数と、材料ごとの数（色の丸）
    const cnt = {}; for (const m of P.bag) cnt[m] = (cnt[m] || 0) + 1;
    let bag = `<b class="${P.bag.length >= P.cap ? 'full' : ''}">${P.bag.length}<small>/${P.cap}</small></b>`;
    for (const m in cnt) bag += `<span class="chip"><i style="background:${MATCOL[m]}"></i>${MATNAME[m]} ${cnt[m]}</span>`;
    const el = $('#bag'); if (el.dataset.h !== bag) { el.innerHTML = bag; el.dataset.h = bag; }
    goalsUI();
  }

  // ---- 札（はじまり・おわり） ----
  function panel(html, btn, onclick) {
    const o = $('#overlay');
    o.innerHTML = `<div class="panel">${html}<button type="button" class="primary">${btn}</button></div>`;
    o.hidden = false; G.paused = true;
    o.querySelector('button').onclick = () => { o.hidden = true; G.paused = false; onclick && onclick(); };
  }
  function intro() {
    panel(`<p class="kicker">紀元前1万年</p><h2>家出</h2>
      <p>きょうは、ぼくが焚き火の番だった。<br>星を見ていたら、いつのまにか火が消えていた。</p>
      <p>「また？」「火の番も、まともにできないなんて」</p>
      <p>……もういい。こんな家、出ていってやる。</p>
      <ul class="keys"><li><b>← →</b> 歩く　<b>↑</b> 跳ぶ（2マスまで）</li><li><b>↓</b> 足もとを掘る　<b>X</b> 前を掘る（枠のマス）</li><li><b>Z</b> 足もとに積んで乗る　<b>C</b> 前に積む</li><li>マウス: 土のマスをクリックで掘る、あいたマスをクリックで積む</li><li>スマホは下のボタンか、マスをさわる</li></ul>
      <p class="small">下へ行くほど昔、上へ行くほど未来。画面の上に、いまの年が出る。</p>`, '飛び出す', () => { G.started = true; toast('→ で歩いて、家を出よう'); });
  }
  function finish() {
    G.clear = true;
    setTimeout(() => panel(`<p class="kicker">${Wd.yearLabel(P.era)}</p><h2>ピラミッドのてっぺん</h2>
      <p>2万年前の河原から、麦の村、町の上の町をへて、ピラミッドのてっぺんまで来た。</p>
      <p>いちばん昔に行ったのは <b>${Wd.yearLabel(G.minE)}</b>。</p>
      <p class="small">試作（段階A）はここまで。この先は、鉄と城、けむりの町、ゴミの山、育つビル……と続く予定です。</p>`, 'もう少し歩く'), 900);
  }

  // ---- スマホのボタン ----
  function pad() {
    const bind = (sel, down, up) => {
      const b = $(sel); if (!b) return;
      b.addEventListener('pointerdown', ev => { ev.preventDefault(); b.setPointerCapture(ev.pointerId); down(); });
      if (up) { b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); }
    };
    bind('#bL', () => hold.left = true, () => hold.left = false);
    bind('#bR', () => hold.right = true, () => hold.right = false);
    bind('#bJ', jump); bind('#bD', digDown); bind('#bF', digFront); bind('#bP', put); bind('#bC', putFront);
  }

  // ---- はじめる ----
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    step(dt); render(dt);
    requestAnimationFrame(frame);
  }
  addEventListener('DOMContentLoaded', () => {
    D.init($('#view'));
    D.follow(P, 0, true);
    $('#view').addEventListener('pointerdown', pointer);
    $('#view').addEventListener('pointermove', hover);
    $('#view').addEventListener('contextmenu', ev => ev.preventDefault());
    pad();
    $('#btnAbout').onclick = () => $('#about').showModal();
    $('#about').addEventListener('close', () => {});
    document.addEventListener('visibilitychange', () => { last = 0; });
    intro();
    requestAnimationFrame(frame);
  });

  // デバッグ用（DEVNOTES）
  window.__ts = { P, G, World: Wd, step: (sec = 1) => { for (let i = 0; i < sec * 60; i++) step(1 / 60); D.follow(P, 0, true); render(0); }, put, digDown, digFront, jump,
    go: (x, y) => { P.x = x; P.y = y; P.era = y; P.vy = 0; D.follow(P, 0, true); }, hold, keys };
})();
