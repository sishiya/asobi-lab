'use strict';
// 3つの面。どれも init(G)・update(G, dt)・draw(ctx, G) と、文（story・howto・win・lose・facts）を持つ。
// update は宿主の気持ち（will）を作って steer() にわたし、終わったら G.end('win' | 'lose', 理由) を呼ぶ。

const STAGES = [];

/* ───────── 1. ロイコクロリディウム: カタツムリを鳥へ ───────── */
STAGES.push({
  id: 'snail', title: 'カタツムリを鳥へ',
  parasite: 'ロイコクロリディウム', host: 'カタツムリ', next: '鳥',
  limit: 120, abilityName: '触角をふくらませる', abilityCost: 9,
  story: [
    'きみは<b>ロイコクロリディウム</b>。カタツムリの仲間（オカモノアラガイ）の体の中にすむ、小さな吸虫の幼生だ。',
    'おとなになれるのは<b>鳥のおなかの中</b>だけ。カタツムリごと鳥に食べてもらわないといけない。',
    'でもカタツムリは、鳥に見つかりにくい、しめった日かげが好きだ。',
  ],
  howto: [
    'カタツムリを<b>明るい日なた</b>に連れ出す。',
    '日なたで<b>「触角をふくらませる」</b>と、空の鳥が気づいて降りてくる。日かげに入ると見失う。',
    '日なたに長くいると、からだが乾いて殻にこもってしまう。',
    '日かげには<b>マイマイカブリ</b>（カタツムリを食べる甲虫）。食べられたら終わり。',
  ],
  win: '鳥がカタツムリの触角をついばんだ！ ロイコクロリディウムは鳥のおなかの中で、おとなになる。',
  lose: {
    beetle: 'マイマイカブリに食べられてしまった。カタツムリが大好物の甲虫だ。でも甲虫のおなかの中では、ロイコクロリディウムはおとなになれない。',
    time: '日がしずんで、鳥がねぐらに帰ってしまった。',
  },
  facts: {
    body: [
      'ロイコクロリディウムは、カタツムリの体の中で「胞子のう」というふくろをのばし、その先を<b>触角の中</b>まで入れる。ふくらんだ触角は緑や黄色のしまもようで、ぴくぴく動く。',
      '鳥がそれを<b>イモムシとまちがえて</b>ついばむ、と考えられている。ただし、野生の鳥がこの触角をねらうところを記録した研究はまだなく、飼われた鳥での古い観察（1874年）があるだけ。',
      'ポーランドの森で、同じ場所にすむカタツムリをくらべた研究では、寄生されたものは<b>よく動き、明るく開けた場所や、地面から高い所</b>にいることが多かった。それまで「寄生されたカタツムリは葉の上に出てくる」という話は、データのない1922年の論文がもとだった。',
      '鳥のおなかの中でおとなになり、卵がふんといっしょに外へ。それをカタツムリが食べて、また始まる（これを「生活環」という）。',
    ],
    src: [
      'Wesołowska, W. & Wesołowski, T. (2014) Do Leucochloridium sporocysts manipulate the behaviour of their snail hosts? J. Zool. 292: 151–155. doi:10.1111/jzo.12094',
    ],
  },
  init(G) {
    G.clear = [{ x: 255, y: 185, r: 125 }, { x: 735, y: 150, r: 115 }, { x: 560, y: 430, r: 115 }, { x: 165, y: 560, r: 95 }];
    G.host = { x: 930, y: 640, a: -2.5, m: 100, shell: 0, L: 0 };
    G.bird = { x: -100, y: 330, ph: 0, st: 'circle', spot: 0 };
    G.beetle = { x: 430, y: 320, a: 0.4 };
    const r = makeRng(11);
    G.deco = Array.from({ length: 320 }, () => ({ x: r() * W, y: r() * H, a: r() * TAU, s: 4 + r() * 8 }));
  },
  light(G, x, y) {
    let L = 0;
    for (const c of G.clear) L = Math.max(L, clamp((c.r - Math.hypot(x - c.x, y - c.y)) / (c.r * 0.4), 0, 1));
    return L;
  },
  update(G, dt) {
    const h = G.host;
    h.L = this.light(G, h.x, h.y);
    if (h.shell > 0) { // 殻にこもっている間は動けない
      h.shell -= dt; G.ability = false; G.will = null; G.pulled = false;
      G.thought = '（殻にこもって、ひと休み…）';
      if (h.shell <= 0) h.m = 40;
    } else {
      if (h.L > 0.45) h.m -= 8 * h.L * dt; else h.m = Math.min(100, h.m + 5 * dt);
      if (h.m <= 0) { h.m = 0; h.shell = 4; G.toast('乾きすぎて、殻にこもってしまった'); }
      // 気持ち: まわりでいちばん暗いほうへ
      let best = null, bv = 9;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, x = h.x + Math.cos(a) * 70, y = h.y + Math.sin(a) * 70;
        const v = this.light(G, x, y) + (x < 30 || x > W - 30 || y < 30 || y > H - 30 ? 2 : 0);
        if (v < bv) { bv = v; best = { x: Math.cos(a), y: Math.sin(a) }; }
      }
      const wv = wander(h, dt), e = edgePush(h);
      const want = h.L > 0.03 ? { x: best.x * 1.6 + wv.x * 0.3, y: best.y * 1.6 + wv.y * 0.3 } : { x: wv.x + e.x * 2, y: wv.y + e.y * 2 };
      const dir = steer(G, want, dt, 0.6 + h.L * 1.2);
      walk(h, dir, G.pulled ? 34 : 27, 2.2, dt);
      G.thought = G.ability ? '触角が、なんだかむずむずする…'
        : G.pulled ? (h.L > 0.4 ? 'なんだか、明るい所にいたい気分…' : 'なんとなく、こっちへ行ってみたい')
        : h.m < 40 ? 'からだが乾いてきた…日かげへ'
        : h.L > 0.3 ? 'まぶしい…日かげに行きたい' : 'しめった日かげは、おちつくなあ';
    }
    // 鳥: 空をまわって見張る。明るい所の触角に気づくと降りてくる
    const b = G.bird;
    let tx, ty, sp;
    if (b.st === 'circle') {
      b.ph += dt * 0.8;
      // 見まわりの中心は画面の外にも出る（鳥がいない時間がある）
      const cx = 500 + 600 * Math.sin(G.t * 0.09 + 3.6), cy = 340 + 200 * Math.sin(G.t * 0.13 + 1);
      tx = cx + 140 * Math.cos(b.ph); ty = cy + 140 * Math.sin(b.ph); sp = 200;
      if (h.L > 0.55 && h.shell <= 0 && dist(b, h) < 340) {
        b.spot += dt * (G.ability ? 1.0 : 0.05);
        if (b.spot >= 1) { b.st = 'swoop'; G.toast('鳥が気づいた！ 降りてくる'); }
      } else b.spot = Math.max(0, b.spot - dt * 0.5);
    } else {
      tx = h.x; ty = h.y; sp = 210;
      if (h.L < 0.3 || h.shell > 0) { b.st = 'circle'; b.spot = 0; G.toast('鳥は見失った'); }
      else if (dist(b, h) < 16) return G.end('win');
    }
    const bd = toward(b, { x: tx, y: ty }), bl = Math.hypot(tx - b.x, ty - b.y);
    b.x += bd.x * Math.min(bl, sp * dt); b.y += bd.y * Math.min(bl, sp * dt);
    b.dir = Math.atan2(bd.y, bd.x);
    // マイマイカブリ: 日かげを歩く。近くの日かげのカタツムリを追う
    const e = G.beetle, dh = dist(e, h), eL = this.light(G, e.x, e.y);
    let edir, esp = 22;
    if (dh < 150 && h.L < 0.5 && h.shell <= 0 || dh < 150 && h.shell > 0) { edir = toward(e, h); esp = 31; }
    else {
      const wv = wander(e, dt, 1.5), ep = edgePush(e);
      edir = { x: wv.x + ep.x * 2, y: wv.y + ep.y * 2 };
      if (eL > 0.2) { // 明るい所はきらい
        let c = G.clear.reduce((m, c) => Math.hypot(e.x - c.x, e.y - c.y) - c.r < Math.hypot(e.x - m.x, e.y - m.y) - m.r ? c : m);
        const aw = toward(c, e); edir = { x: aw.x * 3 + edir.x, y: aw.y * 3 + edir.y };
      }
    }
    walk(e, norm(edir.x, edir.y), esp, 3, dt);
    if (dh < 24) return G.end('lose', 'beetle');
    G.meter = { label: 'しめりけ', v: h.m / 100 };
    if (G.t >= this.limit) G.end('lose', 'time');
  },
  draw(ctx, G) {
    // 地面（日かげ）と日なた
    ctx.fillStyle = '#2d4a26'; ctx.fillRect(0, 0, W, H);
    for (const c of G.clear) {
      const g = ctx.createRadialGradient(c.x, c.y, c.r * 0.3, c.x, c.y, c.r * 1.05);
      g.addColorStop(0, 'rgba(232,240,160,.95)'); g.addColorStop(0.6, 'rgba(196,214,120,.8)'); g.addColorStop(1, 'rgba(196,214,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.05, 0, TAU); ctx.fill();
    }
    for (const d of G.deco) { // 草と落ち葉
      const L = this.light(G, d.x, d.y);
      ctx.strokeStyle = L > 0.3 ? 'rgba(90,120,40,.55)' : 'rgba(80,120,60,.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(d.a) * d.s, d.y + Math.sin(d.a) * d.s); ctx.stroke();
    }
    // マイマイカブリ（首の長い黒い甲虫）
    const e = G.beetle;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(1.3, 1.3);
    for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) line(ctx, i * 6, 0, i * 7 + 3, s * 13, '#140f18', 1.6);
    ellipse(ctx, -4, 0, 12, 7, 0, '#2a1d33', '#5b3f6e', 1);
    ellipse(ctx, 11, 0, 6, 3, 0, '#2a1d33');
    ellipse(ctx, 18, 0, 3.5, 3, 0, '#2a1d33');
    line(ctx, 20, -1, 28, -6, '#140f18', 1.2); line(ctx, 20, 1, 28, 6, '#140f18', 1.2);
    ctx.restore();
    // カタツムリ
    const h = G.host;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a); ctx.scale(1.5, 1.5);
    ellipse(ctx, 4, 0, 18, 6.5, 0, '#cdb894', '#8f7a58', 1);
    const tl = G.ability ? 15 : 9, tw = G.ability ? 4.5 : 1.6;
    for (const s of [-1, 1]) {
      const x2 = 20 + tl * 0.9, y2 = s * (4 + tl * 0.5);
      if (G.ability) { // ふくらんで、しまもようが動く触角
        ctx.save(); ctx.translate(20, s * 2); ctx.rotate(Math.atan2(y2 - s * 2, x2 - 20));
        const len = Math.hypot(x2 - 20, y2 - s * 2), pulse = 1 + 0.25 * Math.sin(G.t * 9);
        ellipse(ctx, len / 2, 0, len / 2 + 2, tw * pulse, 0, '#7cc23a');
        for (let k = 0; k < 4; k++) { const x = ((k * 5 + G.t * 14) % (len + 4)) - 2; line(ctx, x, -tw * pulse, x, tw * pulse, '#f2e85a', 1.6); }
        ctx.restore();
      } else line(ctx, 20, s * 2, x2, y2, '#8f7a58', tw);
    }
    ellipse(ctx, -3, 0, 11, 11, 0, h.shell > 0 ? '#9a6a34' : '#b98242', '#6e4a22', 1.4);
    ctx.beginPath(); for (let k = 0; k < 40; k++) { const t = k / 40 * 2.2 * TAU, r = 10 * (1 - k / 44); ctx.lineTo(-3 + Math.cos(t) * r, Math.sin(t) * r); }
    ctx.strokeStyle = '#6e4a22'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    drawIntent(ctx, G);
    // 鳥（地面の影と、空の鳥）
    const b = G.bird, high = b.st === 'swoop' ? clamp(dist(b, h) / 300, 0, 1) : 1;
    ellipse(ctx, b.x, b.y, 16, 7, b.dir || 0, 'rgba(0,0,0,.28)');
    const bx = b.x - 40 * high, by = b.y - 70 * high, flap = Math.sin(G.t * (b.st === 'swoop' ? 18 : 7));
    ctx.save(); ctx.translate(bx, by); ctx.rotate((b.dir || 0) + Math.PI / 2); const sc = 1.3 - 0.4 * high; ctx.scale(sc, sc);
    ctx.fillStyle = '#3c3a44';
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(-30, -6 + flap * 6, -34, 6 + flap * 8); ctx.quadraticCurveTo(-12, 2, 0, 10);
    ctx.quadraticCurveTo(12, 2, 34, 6 + flap * 8); ctx.quadraticCurveTo(30, -6 + flap * 6, 0, -14); ctx.fill();
    ellipse(ctx, 0, -14, 4, 5, 0, '#3c3a44'); ctx.fillStyle = '#e0a030'; ctx.beginPath(); ctx.moveTo(-2, -19); ctx.lineTo(0, -24); ctx.lineTo(2, -19); ctx.fill();
    ctx.restore();
    if (b.st === 'circle' && b.spot > 0.05) { ctx.fillStyle = '#ffe680'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('?', bx + 14, by - 14); }
  },
});

/* ───────── 2. トキソプラズマ: ネズミをネコへ ───────── */
STAGES.push({
  id: 'mouse', title: 'ネズミをネコへ',
  parasite: 'トキソプラズマ', host: 'ネズミ', next: 'ネコ',
  limit: 90, abilityName: 'こわさを鈍らせる', abilityCost: 10,
  story: [
    'きみは<b>トキソプラズマ</b>。ネズミの脳などにすむ、ひとつの細胞だけの小さな生きもの（原虫）だ。',
    'きみが次の世代のもと（卵のようなもの）を作れるのは、<b>ネコの仲間のおなかの中</b>だけ。',
    'ネズミがネコに食べられれば行ける。でもネズミは、ネコのにおいがするだけで逃げてしまう。',
  ],
  howto: [
    'ネズミを<b>ネコ</b>のところへ連れて行く。ネコはネズミを見つけると追いかける。眠っているネコ（Zz）は追ってこない。',
    '<b>「こわさを鈍らせる」</b>と、ネコのにおい（むらさきの輪）がこわくなくなり、追われても逃げない。',
    'こわいとき、ネズミは<b>巣穴</b>へにげこむ。こわがっている間は、引っぱるのに力がたくさんいる。',
    '草むらの<b>ヘビ</b>へのこわさは消えない。ヘビに食べられたら終わり。',
  ],
  win: 'ネコがネズミをつかまえた！ トキソプラズマはネコのおなかの中で、次の世代を作れる。',
  lose: {
    snake: 'ヘビに食べられてしまった。ヘビのおなかの中では、トキソプラズマは先へ進めない。',
    time: '夜が明けて、ネズミは巣穴で眠ってしまった。',
  },
  facts: {
    body: [
      'ふつうのラットは、ネコのおしっこのにおいがする場所をさける。トキソプラズマに感染したラットは<b>さけなくなり、むしろ近よる</b>ものもいた（イギリスの実験）。',
      'マウスとラットの実験では、ネコのにおいが<b>こわいものから、ひかれるものに</b>変わった。いっぽうで、不安の強さ、覚えたこわさ、においを感じる力などは変わらなかった。何でもこわくなくなるのではない、というのがおもしろいところ（ゲームでヘビをこわがるままにしたのはこのため）。',
      'トキソプラズマは<b>ネコの仲間のおなかの中</b>でだけ、次の世代のもと（オーシスト）を作れる。ネズミの中では、休むすがたで待っている。',
      '人を含め、ほかの多くの動物にも感染する。人ではふつう症状がほとんど出ないが、人の行動にも影響するという研究は、まだ確かなことがわかっていない。',
    ],
    src: [
      'Berdoy, M., Webster, J.P. & Macdonald, D.W. (2000) Fatal attraction in rats infected with Toxoplasma gondii. Proc. R. Soc. B 267: 1591–1594. doi:10.1098/rspb.2000.1182',
      'Vyas, A. et al. (2007) Behavioral changes induced by Toxoplasma infection of rodents are highly specific to aversion of cat odors. PNAS 104: 6442–6447. doi:10.1073/pnas.0608310104',
    ],
  },
  init(G) {
    G.patrol = [{ x: 790, y: 190 }, { x: 830, y: 520 }, { x: 520, y: 600 }];
    G.smells = G.patrol.concat([{ x: 900, y: 90 }]).map(p => ({ x: p.x, y: p.y, r: 150 }));
    G.holes = [{ x: 60, y: 70 }, { x: 60, y: 640 }, { x: 420, y: 40 }];
    G.grain = [{ x: 330, y: 220, r: 26 }, { x: 250, y: 400, r: 26 }, { x: 600, y: 340, r: 26 }];
    G.snake = { x: 330, y: 590, r: 70, a: 0, strike: 0 };
    G.host = { x: 90, y: 360, a: 0, hide: 0, fear: 0 };
    G.bed = { x: 900, y: 90 };
    G.cat = { x: 900, y: 90, a: 2.4, st: 'sleep', k: 0, wait: 14, chase: 0 };
    const r = makeRng(23);
    G.deco = Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 2.5 }));
  },
  smellAt(G, x, y) {
    let s = 0;
    for (const m of G.smells) s = Math.max(s, clamp(1 - Math.hypot(x - m.x, y - m.y) / m.r, 0, 1));
    return s;
  },
  update(G, dt) {
    const h = G.host, c = G.cat, sn = G.snake;
    // 巣穴にかくれている
    if (h.hide > 0) {
      h.hide -= dt; G.will = null; G.pulled = false; G.ability = false;
      G.thought = '（巣穴の中。ここなら安心…）';
      if (h.hide <= 0) { const hole = G.holes.reduce((m, o) => dist(o, h) < dist(m, h) ? o : m); h.a = Math.atan2(H / 2 - hole.y, W / 2 - hole.x); }
    } else {
      const sm = this.smellAt(G, h.x, h.y), dc = dist(h, c), dsn = dist(h, sn);
      const chased = c.st === 'chase';
      const brave = G.ability;
      // こわさ: ネコのにおい・追ってくるネコ（「こわさを鈍らせる」で消える）。ヘビは消えない
      const catFear = brave ? 0 : Math.max(sm, chased ? 1 : dc < 200 ? 0.7 : 0);
      const snakeFear = dsn < 115 ? 1 - dsn / 115 : 0;
      h.fear = Math.max(catFear, snakeFear);
      let want, sp = 80, thought;
      const wv = wander(h, dt), e = edgePush(h);
      if (snakeFear > 0.15) {
        const aw = toward(sn, h); want = { x: aw.x * 3 + wv.x * 0.3, y: aw.y * 3 + wv.y * 0.3 }; sp = 120; thought = 'ヘビだ！ 近づかないぞ';
      } else if (catFear > 0.35) {
        const hole = G.holes.reduce((m, o) => dist(o, h) < dist(m, h) ? o : m);
        const th = toward(h, hole), aw = toward(c, h);
        want = { x: th.x * 2 + aw.x, y: th.y * 2 + aw.y }; sp = chased ? 138 : 105;
        thought = chased ? 'ネコだ！ 巣穴へにげろ！' : 'ネコのにおいがする…こわい、巣穴へ';
        if (dist(h, hole) < 18) { h.hide = 4; G.toast('ネズミは巣穴ににげこんだ'); if (chased) { c.st = 'pause'; c.wait = 2; } }
      } else {
        const g = G.grain.reduce((m, o) => dist(o, h) < dist(m, h) ? o : m), tg = toward(h, g);
        const near = dist(h, g) < 40;
        want = near ? { x: wv.x + e.x * 2, y: wv.y + e.y * 2 } : { x: tg.x + wv.x * 0.6 + e.x * 2, y: tg.y + wv.y * 0.6 + e.y * 2 };
        if (brave && sm > 0.05) { const ts = toward(h, G.smells.reduce((m, o) => dist(o, h) < dist(m, h) ? o : m)); want = { x: want.x + ts.x * 1.2, y: want.y + ts.y * 1.2 }; }
        sp = near ? 40 : 80;
        thought = brave && (sm > 0.05 || dc < 220) ? 'このにおい…なんだか、いい感じ' : near ? 'もぐもぐ。おいしい種だ' : 'おいしそうなにおいがする';
      }
      const resist = brave ? 0.4 : 0.8 + h.fear * 2.2;
      const dir = steer(G, want, dt, resist);
      if (G.pulled && h.fear < 0.35) thought = 'なんとなく、こっちへ行ってみようかな';
      else if (G.pulled) thought += '（…でも足がそっちへ）';
      G.thought = thought;
      walk(h, dir, G.pulled ? Math.max(sp, 95) : sp, 6, dt);
      pushOut(h, G.grain.map(g => ({ x: g.x, y: g.y, r: 6 })));
      if (dsn < 42) { sn.strike = 0.4; return G.end('lose', 'snake'); }
    }
    // ネコ: 見まわり → 見つけたら追う（3.5 秒でつかれる）
    const dc = dist(h, c), seen = h.hide <= 0 && dc < 175;
    if (c.st === 'chase') {
      c.chase -= dt;
      walk(c, toward(c, h), 118, 7, dt);
      if (h.hide <= 0 && dist(h, c) < 20) return G.end('win');
      if (c.chase <= 0 || h.hide > 0) { c.st = 'pause'; c.wait = 2.5; if (c.chase <= 0) G.toast('ネコはつかれて、ひと休み'); }
    } else if (c.st === 'sleep') {
      c.wait -= dt; if (c.wait <= 0) { c.st = 'walk'; c.k = 0; G.toast('ネコが起きて、見まわりを始めた'); }
    } else if (c.st === 'home') { // ねどこへ帰る
      walk(c, toward(c, G.bed), 50, 2.5, dt);
      if (dist(c, G.bed) < 10) { c.st = 'sleep'; c.wait = 12; G.toast('ネコはねどこで眠った'); }
      if (seen) { c.st = 'chase'; c.chase = 3.5; G.toast('ネコが気づいた！'); }
    } else if (seen && (c.st !== 'pause' || c.wait < 2)) {
      c.st = 'chase'; c.chase = 3.5; G.toast('ネコが気づいた！');
    } else if (c.st === 'pause') {
      c.wait -= dt; if (c.wait <= 0) { c.k++; if (c.k >= G.patrol.length) { c.k = 0; c.st = 'home'; } else c.st = 'walk'; }
    } else {
      const p = G.patrol[c.k];
      walk(c, toward(c, p), 42, 2.5, dt);
      if (dist(c, p) < 10) { c.st = 'pause'; c.wait = 4; }
    }
    sn.a += dt * 0.6;
    G.meter = { label: 'こわさ', v: h.fear, warn: true };
    if (G.t >= this.limit) G.end('lose', 'time');
  },
  draw(ctx, G) {
    ctx.fillStyle = '#b9a47c'; ctx.fillRect(0, 0, W, H);
    for (const d of G.deco) ellipse(ctx, d.x, d.y, d.s, d.s * 0.7, 0, 'rgba(110,90,60,.35)');
    // 草むら（ヘビ）
    const sn = G.snake;
    ellipse(ctx, sn.x, sn.y, 110, 85, 0.3, '#7d9456');
    for (let i = 0; i < 40; i++) { const a = i * 2.4, r = (i * 37 % 90); line(ctx, sn.x + Math.cos(a) * r, sn.y + Math.sin(a) * r * 0.75, sn.x + Math.cos(a) * r + 3, sn.y + Math.sin(a) * r * 0.75 - 10, '#5b733a', 2); }
    // ネコのにおい
    for (const m of G.smells) {
      for (let k = 0; k < 3; k++) {
        const r = m.r * (0.35 + 0.3 * k) + 6 * Math.sin(G.t * 2 + k);
        ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, TAU); ctx.strokeStyle = `rgba(130,70,160,${0.35 - k * 0.09})`; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    // 種・巣穴
    for (const g of G.grain) for (let k = 0; k < 14; k++) { const a = k * 2.3, r = (k * 7) % 22; ellipse(ctx, g.x + Math.cos(a) * r, g.y + Math.sin(a) * r, 4.5, 3, a, '#f3d36a', '#8a6a1c', 1); }
    for (const o of G.holes) { ellipse(ctx, o.x, o.y, 20, 15, 0, '#3a2c1c'); ellipse(ctx, o.x, o.y + 2, 15, 10, 0, '#1a130b'); }
    // ヘビ（とぐろ）
    ctx.save(); ctx.translate(sn.x, sn.y);
    ctx.beginPath(); for (let k = 0; k < 60; k++) { const t = k / 60 * 2.5 * TAU, r = 6 + k * 0.4; ctx.lineTo(Math.cos(t + sn.a * 0.1) * r, Math.sin(t + sn.a * 0.1) * r); }
    ctx.strokeStyle = '#4e5d2a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
    const hx = Math.cos(2.5 * TAU + sn.a * 0.1) * 30, hy = Math.sin(2.5 * TAU + sn.a * 0.1) * 30;
    ellipse(ctx, hx, hy, 7, 5, 0, '#4e5d2a');
    ctx.restore();
    // ネズミ
    const h = G.host;
    if (h.hide <= 0) {
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a); ctx.scale(1.6, 1.6);
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-24, 6 * Math.sin(G.t * 8), -34, 2); ctx.strokeStyle = '#c99a8a'; ctx.lineWidth = 1.6; ctx.stroke();
      ellipse(ctx, 0, 0, 12, 7, 0, '#8a8580', '#5c5853', 1);
      ellipse(ctx, 10, 0, 5, 4, 0, '#8a8580');
      ellipse(ctx, 7, -5, 3.5, 3, 0, '#c7a5a0'); ellipse(ctx, 7, 5, 3.5, 3, 0, '#c7a5a0');
      ellipse(ctx, 15, 0, 1.4, 1.4, 0, '#2a2522');
      ctx.restore();
      drawIntent(ctx, G);
    }
    // ネコのねどこ（わらの山）
    ellipse(ctx, G.bed.x, G.bed.y, 46, 34, 0.2, '#d9c27a', '#a88d45', 2);
    // ネコ
    const c = G.cat;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-38, 14 * Math.sin(G.t * 3), -50, 6); ctx.strokeStyle = '#c87a34'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
    ellipse(ctx, 0, 0, 24, 14, 0, '#d98d44', '#8f5520', 1.2);
    for (const x of [-12, -4, 4]) line(ctx, x, -12, x + 2, 12, '#a8642a', 2.5);
    ellipse(ctx, 22, 0, 11, 10, 0, '#d98d44', '#8f5520', 1.2);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(20, s * 6); ctx.lineTo(16, s * 15); ctx.lineTo(27, s * 9); ctx.fillStyle = '#c87a34'; ctx.fill(); }
    ctx.restore();
    if (c.st === 'pause') { ctx.fillStyle = 'rgba(40,30,20,.7)'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('…', c.x + 16, c.y - 20); }
    if (c.st === 'sleep') { ctx.fillStyle = 'rgba(40,30,20,.75)'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('Zz', c.x + 18 + 3 * Math.sin(G.t * 2), c.y - 22); }
    if (c.st === 'chase') { ctx.fillStyle = '#7a1d10'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('!', c.x + 14, c.y - 18); }
  },
});

/* ───────── 3. ハリガネムシ: カマドウマを川へ ───────── */
STAGES.push({
  id: 'cricket', title: 'カマドウマを川へ',
  parasite: 'ハリガネムシ', host: 'カマドウマ', next: '川',
  limit: 100, abilityName: '光にひかれる', abilityCost: 8,
  story: [
    'きみは<b>ハリガネムシ</b>。カマドウマのおなかの中で、細長い針金のように育った。',
    'おとなになって卵を産めるのは<b>水の中</b>だけ。でもカマドウマは陸の虫で、水にはふつう入らない。',
    '夜のうちに、カマドウマを<b>川に飛びこませよう</b>。',
  ],
  howto: [
    'カマドウマはぴょんぴょん跳ねて進む。<b>川（画面の下）</b>に着地させればクリア。',
    '<b>「光にひかれる」</b>と、明るい光のほうへ跳ぶ。水面の月の光にもひかれるが、<b>街灯</b>のほうが明るいと、そっちへ行ってしまう。',
    '雲で月がかくれると、水面は暗くなる。',
    '街灯の下や岸には<b>ヒキガエル</b>。食べられたら終わり。夜が明けても終わり。',
  ],
  win: 'カマドウマが川に飛びこんだ！ ハリガネムシは体の外へ泳ぎ出た。水の中でおとなになり、卵を産む。',
  lose: {
    toad: 'ヒキガエルに食べられてしまった。陸の上では、ハリガネムシは生きていけない。',
    time: '夜が明けてしまった。カマドウマは石の下にもぐって、出てこない。',
  },
  facts: {
    body: [
      'ハリガネムシに寄生されたカマドウマやコオロギは、<b>自分から水に飛びこむ</b>。水に入ると、ハリガネムシがおしりから泳ぎ出る。フランスの研究では、寄生された虫は遠くから水を見つけるのではなく、まず<b>あてもなくうろうろ</b>して、水の近くに来ると飛びこむのでは、と考えられている。',
      '実験で、寄生されたコオロギは<b>光のほうへ歩く</b>ようになった（寄生されていないものは、半分ほどが光に近よらなかった）。夜の水面に映る光をたよりに水辺へ行くのでは、と考えられている（ゲームの「光にひかれる」はこれ）。ただし、水そのものを使って確かめたわけではない。ハリガネムシが出ていくと、コオロギは1日もたたずにふつうにもどった。',
      'カエルや魚に宿主ごと食べられても、ハリガネムシは相手の口やえらから<b>にげ出す</b>ことがある。',
      '日本の研究: 紀伊半島の渓流で、ハリガネムシに寄生されたカマドウマやキリギリスの仲間は、寄生されていないものの<b>約20倍</b>、川に入りやすかった。そこにすむキリクチ（絶滅が心配されているイワナの仲間）が1年にとるエネルギーの<b>約6割</b>が、こうした虫だった。小さな寄生虫が、森と川の食べものの流れを変えている。',
    ],
    src: [
      'Thomas, F. et al. (2002) Do hairworms (Nematomorpha) manipulate the water seeking behaviour of their terrestrial hosts? J. Evol. Biol. 15: 356–361.',
      'Ponton, F. et al. (2006) Parasite survives predation on its host. Nature 440: 756. doi:10.1038/440756a',
      'Ponton, F. et al. (2011) Water-seeking behavior in worm-infected crickets and reversibility of parasitic manipulation. Behav. Ecol. 22: 392–400. doi:10.1093/beheco/arq215',
      'Sato, T. et al. (2011) Nematomorph parasites drive energy flow through a riparian ecosystem. Ecology 92: 201–207. doi:10.1890/09-1565.1',
    ],
  },
  init(G) {
    G.lamp = { x: 560, y: 290, b: 1.0 };
    G.rocks = [{ x: 210, y: 170, r: 30 }, { x: 300, y: 330, r: 30 }, { x: 800, y: 420, r: 30 }, { x: 860, y: 150, r: 34 }];
    G.toads = [
      { x: 520, y: 360, hx: 520, hy: 360, a: 0, range: 60, tongue: 0 },
      { x: 620, y: 230, hx: 620, hy: 230, a: 0, range: 50, tongue: 0 },
      { x: 300, y: 545, a: 0, tongue: 0, patrol: [120, 520], dir: 1 },
      { x: 800, y: 545, a: 0, tongue: 0, patrol: [560, 940], dir: -1 },
    ];
    G.host = { x: 100, y: 80, a: 0.6, hop: 0.8, air: 0, fx: 0, fy: 0, tx: 0, ty: 0 };
    G.moon = 1; G.cloud = 0;
    const r = makeRng(37);
    G.deco = Array.from({ length: 120 }, () => ({ x: r() * W, y: r() * 540, s: 2 + r() * 4, a: r() * TAU }));
    G.glints = Array.from({ length: 70 }, () => ({ x: r() * W, y: 600 + r() * 90, p: r() * TAU }));
  },
  waterY(x) { return 575 + 10 * Math.sin(x / 90); },
  update(G, dt) {
    const h = G.host;
    // 月と雲（ときどき雲がかかって水面が暗くなる）
    G.cloud = Math.max(0, Math.sin(G.t * 0.21 + 2.2)) ** 3;
    G.moon = 1 - 0.85 * G.cloud;
    // 光: 街灯は近いほど強い。水面の光は月しだい
    const lampPull = G.lamp.b / Math.max(1, dist(h, G.lamp) / 100) ** 1.3;
    const wy = this.waterY(h.x);
    const waterPull = 0.9 * G.moon / Math.max(1, (wy - h.y) / 100) ** 1.3;
    // 気持ち: 暗い石かげへ。水辺はさける
    const rock = G.rocks.reduce((m, o) => dist(o, h) < dist(m, h) ? o : m);
    const wv = wander(h, dt, 2), e = edgePush(h);
    let want = dist(h, rock) > 50 ? toward(h, rock) : wv;
    want = { x: want.x + wv.x * 0.6 + e.x * 2, y: want.y + wv.y * 0.6 + e.y * 2 + (h.y > 470 ? -2.5 : 0) };
    let thought = h.y > 470 ? '水のにおい…水はきらいだ' : dist(h, rock) < 60 ? '石のかげは、くらくておちつく' : 'くらい所へ、くらい所へ';
    if (G.ability) {
      const tl = toward(h, G.lamp);
      want = { x: tl.x * lampPull, y: tl.y * lampPull + waterPull };
      thought = lampPull > waterPull ? 'あの明かり、きれいだなあ…' : '下のほうがきらきら光ってる…';
    }
    const dir = steer(G, want, dt, G.ability ? 0.5 : 1.3 + (h.y > 470 ? 0.5 : 0));
    if (G.pulled && !G.ability) thought = 'なんとなく、こっちへ跳んでみよう';
    G.thought = thought;
    // 跳ぶ: 着地して少し休み、また跳ぶ
    if (h.air > 0) {
      h.air -= dt;
      const k = 1 - clamp(h.air / 0.28, 0, 1);
      h.x = h.fx + (h.tx - h.fx) * k; h.y = h.fy + (h.ty - h.fy) * k; h.z = Math.sin(k * Math.PI) * 18;
      if (h.air <= 0) {
        h.z = 0;
        if (h.y > this.waterY(h.x) + 4) return G.end('win');
      }
    } else {
      h.a += clamp(angDiff(h.a, Math.atan2(dir.y, dir.x)), -5 * dt, 5 * dt);
      h.hop -= dt;
      if (h.hop <= 0) {
        const len = G.pulled || G.ability ? 60 : 50;
        h.fx = h.x; h.fy = h.y;
        h.tx = clamp(h.x + Math.cos(h.a) * len, 15, W - 15); h.ty = clamp(h.y + Math.sin(h.a) * len, 15, H - 15);
        // 引っぱっていないと、水ぎわで止まる
        if (!G.pulled && !G.ability && h.ty > this.waterY(h.tx) - 6) h.ty = this.waterY(h.tx) - 20;
        for (const r of G.rocks) { const d = Math.hypot(h.tx - r.x, h.ty - r.y); if (d < r.r) { h.tx = r.x + (h.tx - r.x) / d * r.r; h.ty = r.y + (h.ty - r.y) / d * r.r; } }
        h.air = 0.28; h.hop = 0.6 + rnd(0, 0.25);
      }
    }
    // ヒキガエル
    for (const t of G.toads) {
      if (t.patrol) { t.x += t.dir * 22 * dt; if (t.x > t.patrol[1] || t.x < t.patrol[0]) t.dir *= -1; t.y = this.waterY(t.x) - 30; t.a = t.dir > 0 ? 0 : Math.PI; }
      else { t.x = t.hx + Math.sin(G.t * 0.5 + t.hx) * t.range * 0.5; t.y = t.hy + Math.cos(G.t * 0.37 + t.hy) * t.range * 0.4; }
      t.tongue = Math.max(0, t.tongue - dt * 3);
      const d = dist(t, h);
      if (d < 140) t.a = Math.atan2(h.y - t.y, h.x - t.x);
      if (d < 52 && h.air <= 0) { t.tongue = 1; t.tx = h.x; t.ty = h.y; return G.end('lose', 'toad'); }
    }
    G.meter = { label: '月あかり', v: G.moon };
    if (G.t >= this.limit) G.end('lose', 'time');
  },
  draw(ctx, G) {
    ctx.fillStyle = '#1b2620'; ctx.fillRect(0, 0, W, H);
    for (const d of G.deco) line(ctx, d.x, d.y, d.x + Math.cos(d.a) * d.s, d.y + Math.sin(d.a) * d.s, 'rgba(90,120,90,.35)', 1.5);
    // 夜明けが近づくと空気が明るくなる
    const dawn = clamp((G.t - this.limit + 25) / 25, 0, 1);
    // 川
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, this.waterY(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = '#10283c'; ctx.fill();
    ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, this.waterY(x)); ctx.strokeStyle = 'rgba(160,190,200,.35)'; ctx.lineWidth = 2; ctx.stroke();
    for (const g of G.glints) {
      const a = G.moon * (0.4 + 0.6 * Math.sin(G.t * 3 + g.p)) ** 2;
      if (g.y > this.waterY(g.x) + 6) line(ctx, g.x - 5, g.y, g.x + 5, g.y, `rgba(235,240,210,${a})`, 2);
    }
    // 石
    for (const r of G.rocks) { ellipse(ctx, r.x + 4, r.y + 5, r.r, r.r * 0.8, 0, 'rgba(0,0,0,.35)'); ellipse(ctx, r.x, r.y, r.r, r.r * 0.8, 0, '#4a4f4a', '#2e322e', 1.5); }
    // 街灯の光
    const lp = G.lamp, gl = ctx.createRadialGradient(lp.x, lp.y, 5, lp.x, lp.y, 230);
    gl.addColorStop(0, 'rgba(255,230,150,.75)'); gl.addColorStop(0.35, 'rgba(255,210,120,.25)'); gl.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lp.x, lp.y, 230, 0, TAU); ctx.fill();
    ellipse(ctx, lp.x, lp.y, 10, 10, 0, '#fff4c8', '#bfa760', 2);
    for (let i = 0; i < 5; i++) { const a = G.t * (2 + i * 0.3) + i * 1.3; ellipse(ctx, lp.x + Math.cos(a) * (20 + i * 5), lp.y + Math.sin(a * 1.3) * (16 + i * 4), 1.6, 1.6, 0, 'rgba(255,255,220,.8)'); }
    // ヒキガエル
    for (const t of G.toads) {
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a);
      for (const s of [-1, 1]) ellipse(ctx, -8, s * 12, 9, 5, s * 0.6, '#6b5a35');
      ellipse(ctx, 0, 0, 17, 14, 0, '#7d6a3e', '#4d4024', 1.4);
      for (let k = 0; k < 6; k++) ellipse(ctx, -8 + (k % 3) * 6, -5 + Math.floor(k / 3) * 9, 1.8, 1.8, 0, '#5b4b2c');
      for (const s of [-1, 1]) { ellipse(ctx, 9, s * 7, 3.6, 3.6, 0, '#d8c070'); ellipse(ctx, 9.5, s * 7, 1.6, 1.6, 0, '#111'); }
      ctx.restore();
      if (t.tongue > 0) line(ctx, t.x, t.y, t.tx, t.ty, '#d9707a', 3);
    }
    // カマドウマ（背中の丸い、脚と触角の長い虫）
    const h = G.host, z = h.z || 0;
    ellipse(ctx, h.x, h.y + 3, 9, 4, h.a, 'rgba(0,0,0,.35)');
    ctx.save(); ctx.translate(h.x, h.y - z); ctx.rotate(h.a); ctx.scale(1.4, 1.4);
    for (const s of [-1, 1]) {
      line(ctx, -2, s * 4, -10, s * 15, '#7a5a38', 2.4); line(ctx, -10, s * 15, -22, s * 9, '#7a5a38', 1.6);
      line(ctx, 4, s * 3, 8, s * 9, '#7a5a38', 1.2); line(ctx, 0, s * 3, 0, s * 9, '#7a5a38', 1.2);
      ctx.beginPath(); ctx.moveTo(9, s * 2); ctx.quadraticCurveTo(30, s * 14, 46, s * (6 + 4 * Math.sin(G.t * 4 + s))); ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 0.9; ctx.stroke();
    }
    ellipse(ctx, 0, 0, 11, 6.5, 0, '#a07a4c', '#6b4f30', 1);
    for (const x of [-6, -2, 2]) line(ctx, x, -6, x, 6, 'rgba(90,64,38,.7)', 1);
    ellipse(ctx, 10, 0, 4, 3.6, 0, '#a07a4c');
    ctx.restore();
    drawIntent(ctx, G);
    // 雲・夜明け
    if (G.cloud > 0.02) { ctx.fillStyle = `rgba(20,24,30,${G.cloud * 0.35})`; ctx.fillRect(0, 0, W, H); }
    if (dawn > 0) { ctx.fillStyle = `rgba(250,200,150,${dawn * 0.25})`; ctx.fillRect(0, 0, W, H); }
  },
});
