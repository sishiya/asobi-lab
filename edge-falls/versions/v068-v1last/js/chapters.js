'use strict';
// 章（v011。DESIGN.md 3章）: 1つの章で新しいものが1つだけ、世界の出来事として来る。お題はいつも1つ。
//   ★の点数はやめた（急がせないため）。お題が進まないあいだは、世界がそっと助ける（ヒントのはしご: 3日でひとこと、8日で手助け）。
//   むずかしさは UI ではなく世界のつまみ（W.knob の冬の寒さ・潮の強さ）で上げる。
//   G.ch: いまの章（CHAPTERS.length ならエンディングのあとの自由な箱庭）。G.unlock: 手に持てるもの・つぼの中身。

const lakePct = () => { let n = 0; for (const i of INS) if (W.w[i] > 0.25 && !W.ice[i]) n++; return n / INS.length * 100; };
// 進化の章: 章に入ったときの平均（G.gbase）から、どれか1つの遺伝子の平均がどれだけ動いたか（上でも下でも。10 匹以上の種類だけ）
const geneBase = () => { const b = {}; for (const k of ['deer', 'wolf', 'fish', 'bird']) { const g = geneStats(k); if (g.n) { b[k] = {}; for (const [n] of GENES[k]) b[k][n] = g[n]; } } return b; };
function geneMove() {
  let best = 0, what = '';
  for (const k of ['deer', 'wolf', 'fish', 'bird']) {
    if (L.counts[k] < 10) continue;
    const g = geneStats(k), b = (G.gbase || {})[k];
    for (const [n, name] of GENES[k]) { const d = Math.abs(g[n] - (b && b[n] !== undefined ? b[n] : 0.5)); if (d > best) { best = d; what = TX(KINDS[k].name + 'の' + name + (g[n] > (b ? b[n] : 0.5) ? 'が上がった' : 'が下がった'), KINDS[k].name + ' ' + name.toLowerCase() + (g[n] > (b ? b[n] : 0.5) ? ' went up' : ' went down')); } }
  }
  G.gwhat = what;
  return best;
}
const springDays = () => {   // 冬の章: 次の春まで何日
  const p = seasonPhase(), left = (1 - p) % 1;
  return Math.ceil(left * YEAR);
};

const CHAPTERS = [
  {
    key: 'water', name: TX('水', 'Water'), title: TX('湖をひとつ', 'One lake'), text: TX('泉をわかせて、くぼみに湖をつくる', 'Make a spring and fill a hollow to make a lake'), goal: 3, unit: '%', show: v => v.toFixed(1),
    gives: { water: 1 }, arrive: TX('深淵の水を汲む「水がめ」を手にした。大地のどこかを押すと、泉がわく', 'You got the “Water Jar”, which draws water from the Abyss. Press anywhere on the land to make a spring'),
    prog: () => lakePct(), knob: { winter: 0, tide: 0.35 },
    hint: TX('水は低いほうへ流れて、ふちから落ちていく。くぼみの上の高いところに泉をわかせると、水がたまって湖になる。', 'Water runs downhill and falls off the edge. Make a spring on high ground above a hollow, and it will pool into a lake.'),
    gift() { const p = W.lake; W.springs.push({ i: Math.round(C + p.y * RD * 0.6) * N + Math.round(C + p.x * RD * 0.6), on: true }); return TX('深淵が、ひとりでに湧きだした', 'The Abyss welled up on its own'); },
    truth: TX('本当の泉の水は、深淵からではなく、雨が地面にしみこんだ地下水。湖は、水が流れ出るより早く流れこむくぼみにできる。', 'Real spring water doesn’t come from an abyss. It is groundwater from rain that soaked into the ground. A lake forms in a hollow where water flows in faster than it flows out.'),
  },
  {
    key: 'soil', name: TX('土', 'Soil'), title: TX('湖を大きく', 'A bigger lake'), text: TX('ふちを盛って水をせき止め、湖を広げる', 'Pile up the edge to hold back the water and make the lake bigger'), goal: 8, rel: 4, unit: '%', show: v => v.toFixed(1),
    gives: { soil: 1 }, arrive: TX('「土ぶくろ」を手にした。削った土は、ふくろに入る。その土で、盛る', 'You got the “Soil Bag”. Soil you dig goes into the bag. Use that soil to pile up'),
    prog: () => lakePct(), knob: { winter: 0, tide: 0.35 },
    hint: TX('滝になって落ちる川の出口に土を盛ると、水がせき止められる。土は、どこかを削るとふくろにたまる。', 'Try piling soil where a river falls off the edge. It holds the water back. Dig anywhere to fill your bag.'),
    gift() { W.soil += 100; return TX('土ぶくろに、土が少しふえた', 'A little more soil came into the Soil Bag'); },
    truth: TX('本当の世界でも、川をせき止めると湖ができる（地すべりや溶岩でできた湖、人のつくったダム湖）。せきの下の川は水が少なくなる。', 'In the real world too, damming a river makes a lake (lakes made by landslides or lava, and reservoirs made by people). The river below the dam gets less water.'),
  },
  {
    key: 'grass', name: TX('草', 'Grass'), title: TX('草の原', 'A grassy plain'), text: TX('草が大地の 25% をおおうようにする', 'Cover 25% of the land with grass'), goal: 25, unit: '%',
    gives: { seed: 1 }, arrive: TX('「命のつぼ」に、草のたねが来た', 'Grass seeds came to the “Life Jar”'),
    prog: s => Math.round(s.grass * 100), knob: { winter: 0, tide: 0.35 },
    hint: TX('草は水のそばでよく育ち、となりへ広がる。水につかりすぎると枯れる。たねは、なぞるように広くまく。', 'Grass loves being near water and spreads to its neighbors, but too much water drowns it. Sow the seeds by sweeping your finger across the land.'),
    gift() { let n = 0; for (const i of INS) if (W.moist[i] > 0.6 && W.w[i] < 0.2 && W.veg[i] < 0.25 && n < 400 && Math.random() < 0.3) { W.veg[i] = 0.3; n++; } return TX('風が、たねを水辺へ運んできた', 'The wind carried seeds to the water’s edge'); },
    truth: TX('本当の地球でも、植物は水辺から陸へ広がった。陸に植物がふえてから、虫や、のちに四本足の動物が陸に上がった。', 'On the real Earth too, plants spread from the water’s edge onto land. After plants spread on land, insects, and later four-legged animals, came up onto land.'),
  },
  {
    key: 'deer', name: TX('シカ', 'Deer'), title: TX('シカのむれ', 'A herd of deer'), text: TX('シカを 30 頭にふやす', 'Grow the deer to 30'), goal: 30, unit: TX('頭', ''),
    gives: { deer: 1 }, arrive: TX('命のつぼに、シカが来た', 'Deer came to the Life Jar'),
    prog: () => L.counts.deer, knob: { winter: 0, tide: 0.35 },
    hint: TX('シカは草の多いところに放す。のどがかわくと水辺へ行く。おなかがいっぱいの大人は子を残す。', 'Release deer where the grass is thick. They walk to the water when thirsty, and well-fed adults have young.'),
    gift() { W.stock.deer = Math.min(STOCK_MAX.deer, W.stock.deer + 3); return TX('命のつぼに、シカが3頭帰ってきた', 'Three deer came back to the Life Jar'); },
    truth: TX('食べる者がいないと、シカはふえすぎて草や若い木を食べつくすことがある。日本の各地でも、シカがふえて森の下草がなくなる問題が起きている。', 'With nothing to eat them, deer can grow too many and eat all the grass and young trees. In many parts of Japan, deer have increased so much that forests are losing their undergrowth.'),
  },
  {
    key: 'winter', name: TX('冬', 'Winter'), title: TX('冬をこす', 'Through the winter'), text: TX('シカ 10 頭以上で、冬をこして春をむかえる', 'Get through the winter to spring with 10 or more deer'), goal: 1, unit: '',
    gives: {}, arrive: TX('季節がはっきりしてきた。この冬は、きびしくなる', 'The seasons are getting clearer. This winter will be harsh'),
    prog: () => G.winterOk ? 1 : 0, show: () => L.counts.deer >= 10 ? TX(`春まで ${springDays()} 日`, `${springDays()} days until spring`) : TX('シカが 10 頭より少ない', 'Fewer than 10 deer'), knob: { winter: 1, tide: 0.35 },
    hint: TX('冬は草が育たない。秋にシカが増えすぎると、冬に食べものが足りなくなる。低くて暖かい草地を残しておく（山の上や夜のがわは寒い）。', 'Grass doesn’t grow in winter. Too many deer in autumn means too little food in winter. Keep some low, warm grassland. Mountaintops and the night side are cold.'),
    gift() { W.knob.winter = 0.6; return TX('この冬は、少しやわらいだ', 'This winter got a little milder'); },
    truth: TX('本当のシカも、冬は動きをへらし、体の熱をむだにしないで過ごす。寒い所のなかまほど体が大きい傾向（ベルクマンの規則）も見られる。', 'Real deer also move less in winter to save their body heat. Animals of the same group also tend to be bigger in colder places (Bergmann’s rule).'),
  },
  {
    key: 'wolf', name: TX('オオカミ', 'Wolves'), title: TX('食べる・食べられる', 'Eat and be eaten'), text: TX('オオカミ 3 頭以上とシカ 10 頭以上が、いっしょに 5 日つづく', '3 or more wolves and 10 or more deer live together for 5 days'), goal: 5, unit: TX('日', ' days'),
    gives: { wolf: 1 }, arrive: TX('命のつぼに、オオカミが来た', 'Wolves came to the Life Jar'), streak: () => L.counts.wolf >= 3 && L.counts.deer >= 10,
    prog: () => Math.floor(G.streak), knob: { winter: 1, tide: 0.6 },
    hint: TX('オオカミが多すぎると、シカを食べつくして自分たちも飢える。シカの多いところに、少しずつ放す。', 'Too many wolves eat all the deer, and then they starve too. A few at a time, where the deer are.'),
    gift() { W.stock.deer = Math.min(STOCK_MAX.deer, W.stock.deer + 3); W.stock.wolf = Math.min(STOCK_MAX.wolf, W.stock.wolf + 1); return TX('命のつぼに、シカとオオカミが帰ってきた', 'Deer and wolves came back to the Life Jar'); },
    truth: TX('カナダのオオヤマネコとカンジキウサギの数は、およそ 10 年ごとに増えたり減ったりをくりかえした（毛皮の取り引きの記録から分かった）。食べる者の数は、食べられる者の数を少しおくれて追いかける。', 'In Canada, the numbers of lynx and snowshoe hares rose and fell about every 10 years (we know from fur trade records). The number of hunters follows the number of the hunted, a little behind.'),
  },
  {
    key: 'fish', name: TX('サカナ', 'Fish'), title: TX('湖のサカナ', 'Fish in the lake'), text: TX('サカナを 40 匹にふやす', 'Grow the fish to 40'), goal: 40, unit: TX('匹', ''),
    gives: { fish: 1 }, arrive: TX('命のつぼに、サカナが来た', 'Fish came to the Life Jar'), knob: { winter: 1, tide: 0.8 },
    prog: () => L.counts.fish,
    hint: TX('サカナは水草を食べる。流れの速い川では滝から落ちてしまう。せき止めた湖に放す。', 'Fish eat water plants. In a fast river they get swept over the falls. Release them in a dammed lake.'),
    gift() { W.stock.fish = Math.min(STOCK_MAX.fish, W.stock.fish + 6); return TX('命のつぼに、サカナが帰ってきた', 'Fish came back to the Life Jar'); },
    truth: TX('本当の滝でも、魚は上流へのぼれないことが多い。滝の上と下で、別々の魚がくらしていることもある。', 'At real waterfalls too, fish often can’t swim upstream. Sometimes different fish live above and below a waterfall.'),
  },
  {
    key: 'bird', name: TX('サギ', 'Herons'), title: TX('水辺の狩り', 'Hunting at the water’s edge'), text: TX('サギ 3 羽以上とサカナ 15 匹以上が、いっしょに 5 日つづく', '3 or more herons and 15 or more fish live together for 5 days'), goal: 5, unit: TX('日', ' days'),
    gives: { bird: 1 }, arrive: TX('命のつぼに、サギが来た。浅い水に立って、サカナをとる鳥', 'Herons came to the Life Jar. They are birds that stand in shallow water and catch fish'), streak: () => L.counts.bird >= 3 && L.counts.fish >= 15,
    prog: () => Math.floor(G.streak), knob: { winter: 1, tide: 1 },
    hint: TX('サギがとれるのは浅いところのサカナだけ。深い湖はサカナのかくれ場所、浅瀬はサギの狩り場。月を寄せると、潮で浅瀬が動く。', 'Herons can only catch fish in the shallows. Deep water hides the fish; the shallows are the herons’ hunting ground. Bring the Moon closer and the tide moves the shallows.'),
    gift() { W.stock.fish = Math.min(STOCK_MAX.fish, W.stock.fish + 6); W.stock.bird = Math.min(STOCK_MAX.bird, W.stock.bird + 1); return TX('命のつぼに、サカナとサギが帰ってきた', 'Fish and herons came back to the Life Jar'); },
    truth: TX('アオサギは、浅い水に何十分もじっと立って魚を待ち、くちばしで一気にとらえる。深い所の魚には届かない。', 'A grey heron can stand still in shallow water for many minutes waiting for a fish, then catch it with one quick strike of its beak. It can’t reach fish in deep water.'),
  },
  {
    key: 'genes', name: TX('進化', 'Evolution'), title: TX('体が変わる', 'Bodies change'), text: TX('生き物の遺伝子のどれか1つの平均を、いまより 0.08 動かす', 'Move the average of any one animal gene by 0.08 from where it is now'), goal: 8, unit: '', show: v => (v / 100).toFixed(2),
    gives: { genes: 1 }, arrive: TX('観察帳に「遺伝子」の頁がひらいた。生き物は、親から子へ体のつくりを伝える', 'The “Genes” page opened in the Field Notes. Living things pass the shape of their bodies from parents to young'), knob: { winter: 1, tide: 1 },
    prog: () => Math.round(geneMove() * 100),
    hint: TX('きびしさに合ったものが生き残って子を残す。追われるシカは足が速く、流れの中のサカナは泳ぎが強くなっていく。観察帳の「遺伝子」の頁で見られる。', 'Those that fit the hard times survive and have young. Chased deer get faster; fish in currents swim stronger. You can watch it on the “Genes” page of the Field Notes.'),
    gift() { W.stock.wolf = Math.min(STOCK_MAX.wolf, W.stock.wolf + 1); return TX('命のつぼに、オオカミが帰ってきた', 'A wolf came back to the Life Jar'); },
    truth: TX('生き残りやすい性質が子に伝わって積み重なり、生き物が変わっていく（自然選択。ダーウィンとウォレスが 1858 年に発表）。本当の進化はふつう何百〜何万世代もかかる。この箱庭ではずっと速くしている。', 'Traits that help survival are passed to young and add up, so living things change (natural selection, published by Darwin and Wallace in 1858). Real evolution usually takes hundreds to tens of thousands of generations. This garden makes it much faster.'),
  },
  {
    key: 'cycle', name: TX('めぐる世界', 'The Turning World'), title: TX('めぐる世界', 'The Turning World'), text: TX('草・シカ・オオカミ・サカナ・サギが、そろって1年（16 日）つづく', 'Grass, deer, wolves, fish and herons all last together for one year (16 days)'), goal: 16, unit: TX('日', ' days'),
    gives: {}, arrive: TX('もう、新しいものは来ない。あとは、きみの手かげんだけ', 'Nothing new will come now. All that’s left is your gentle touch'), knob: { winter: 1, tide: 1 },
    streak: s => s.grass >= 0.15 && L.counts.deer > 0 && L.counts.wolf > 0 && L.counts.fish > 0 && L.counts.bird > 0,
    prog: () => Math.floor(G.streak),
    hint: TX('何かが減ると、それを食べるものも、それに食べられるものも変わる。全部を止めようとせず、少し落としてやると、世界はまわりだす。', 'When one thing shrinks, what eats it and what it eats change too. Don’t try to stop everything. Let a little fall, and the world starts turning.'),
    gift() { for (const k in W.stock) W.stock[k] = Math.min(STOCK_MAX[k], W.stock[k] + 2); return TX('命のつぼに、命が少しずつ帰ってきた', 'A few of each life came back to the Life Jar'); },
    truth: TX('アメリカのイエローストーン国立公園では、1995 年にオオカミを戻してから、エルク（大きなシカ）の数や動き方が変わり、川辺の木が育った所があると言われる。どこまでがオオカミのおかげかは、研究者のあいだで今も話し合われている。', 'In Yellowstone National Park in the USA, after wolves were brought back in 1995, the number and movements of elk (large deer) changed, and trees by the rivers are said to have grown back in some places. Researchers are still discussing how much of that was really thanks to the wolves.'),
  },
];
const YEARNAME = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十'];
const YEAR_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const yearOf = n => TX(YEARNAME[n] + 'の年', 'Year ' + YEAR_EN[n]);   // 「第一の年」／Year One

// 章 n で、手に持てるもの・つぼの中身
function unlockedAt(n) {
  const u = {};
  for (let k = 0; k <= Math.min(n, CHAPTERS.length - 1); k++) Object.assign(u, CHAPTERS[k].gives);
  if (n >= CHAPTERS.length) Object.assign(u, { water: 1, soil: 1, seed: 1, deer: 1, wolf: 1, fish: 1, bird: 1, genes: 1 });
  return u;
}
const isFree = () => G.ch >= CHAPTERS.length;

// 少しあとで（画面の時間で数える。止めていても進む）
const LATER = [];
function later(sec, fn) { LATER.push({ t: sec, fn }); }
function stepLater(dt) { for (let k = LATER.length - 1; k >= 0; k--) { LATER[k].t -= dt; if (LATER[k].t <= 0) { const f = LATER[k].fn; LATER.splice(k, 1); f(); } } }

// 章に入る（つまみ・つぼの中身・ことば）。quiet=true は読みこんだとき
function enterChapter(n, quiet) {
  G.ch = n; G.chT = 0; G.streak = 0; G.helped = 0; G.spots = null; G.spotT = 0; G.winterOk = false; G.winterSeen = false;
  if (CHAPTERS[n] && CHAPTERS[n].key === 'genes' && !quiet) G.gbase = geneBase();
  const prevU = G.unlock || {};
  G.unlock = unlockedAt(n);
  const c = CHAPTERS[n];
  // rel: 章に入ったときより rel だけ先を目標に（前の章で先に進めていても、すぐ終わらないように）
  G.goal = c ? (c.rel ? Math.max(c.goal, Math.round(c.prog(waterStats()) + c.rel)) : c.goal) : 0;
  if (c) Object.assign(W.knob, c.knob);
  else W.knob = { winter: 1, tide: 1 };
  for (const k of ['deer', 'wolf', 'fish', 'bird']) if (G.unlock[k] && !prevU[k] && !quiet) W.stock[k] = STOCK_START[k];
  if (!quiet && c) {
    chapterLine(TX(`${yearOf(n)}　${c.name}`, `${yearOf(n)}: ${c.name}`), c.arrive);
    if (c.key === 'grass') toast(JAR_TALK, 6);         // 命のつぼとは（v034。ユーザーの家族「ツボってなに？」）
    Sound.play('spring');
    const newKey = Object.keys(c.gives)[0];
    if (newKey) glowHand(newKey);
  }
  syncHands();
}

// ヒントのはしごの 1 段目: 関係のある所がかすかに光る（2日目から6日目まで。半日ごとに選びなおす）
function pickSpots(key) {
  const out = [], pick = (test, n) => { const c = INS.filter(test); for (let k = 0; k < n && c.length; k++) { const i = c.splice((Math.random() * c.length) | 0, 1)[0]; out.push({ x: i % N, y: i / N | 0 }); } };
  if (key === 'water') { const p = W.lake; for (const f of [0.75, 0.6]) out.push({ x: C + p.x * RD * f, y: C + p.y * RD * f }); }
  else if (key === 'soil') { const e = INS.filter(i => edgeBin[i] >= 0 && W.w[i] > 0.05).sort((a, b) => W.w[b] - W.w[a]); for (const i of e.slice(0, 4)) out.push({ x: i % N, y: i / N | 0 }); }
  else if (key === 'grass') pick(i => W.moist[i] > 0.6 && W.w[i] < 0.2 && W.veg[i] < 0.2, 5);
  else if (key === 'deer' || key === 'winter') pick(i => W.veg[i] > 0.5 && W.w[i] < 0.1, 4);
  else if (key === 'wolf') { const d = L.list.filter(a => a.kind === 'deer'); for (let k = 0; k < 3 && d.length; k++) { const a = d[(Math.random() * d.length) | 0]; out.push({ x: a.x, y: a.y }); } }
  else if (key === 'fish') pick(i => W.w[i] > 0.9 && W.alg[i] > 0.2 && Math.hypot(W.fR[i] - W.fL[i], W.fD[i] - W.fU[i]) < 0.3, 4);
  else if (key === 'bird') pick(i => W.w[i] > 0.1 && W.w[i] < 0.7 && !W.ice[i], 4);
  return out;
}

// 毎フレーム: 進み・ヒントのはしご・章のおわり
function stepChapter(s, dt) {
  if (!G.started || isFree() || COL || G.ch % 1) return;
  const c = CHAPTERS[G.ch];
  G.chT += dt;
  const days = G.chT / DAY;
  if (days > 2 && days < 6 && c.prog(s) < G.goal * 0.8) { if (!G.spots || G.chT - (G.spotT || 0) > DAY / 2) { G.spots = pickSpots(c.key); G.spotT = G.chT; } } else G.spots = null;
  if (!G.helped && days > 3) { G.helped = 1; toast(c.hint, 9); }
  else if (G.helped === 1 && days > 8 && c.prog(s) < G.goal * 0.8) { G.helped = 2; const msg = c.gift(); toast(msg, 5); Sound.play('put'); }
  if (c.prog(s) >= G.goal) finishChapter();
}
// 時を進めるあいだ（つづく日数・冬をこす）
function tickChapter(h, s) {
  if (isFree() || !s || G.ch % 1) return;
  const c = CHAPTERS[G.ch];
  if (c.streak) { if (c.streak(s)) G.streak += h / DAY; else G.streak = 0; }
  if (c.key === 'winter') {
    const se = seasonOf();
    if (se === 3) G.winterSeen = true;
    if (G.winterSeen && se === 0 && L.counts.deer >= 10) G.winterOk = true;
    if (G.winterSeen && se === 0 && L.counts.deer < 10) G.winterSeen = false;   // もう一度、次の冬を
  }
}

function finishChapter() {
  const n = G.ch, c = CHAPTERS[n];
  G.done = G.done || [];
  G.done[n] = { day: W.day };
  if (c.key === 'genes' && G.gwhat) G.done[n].what = G.gwhat;
  Sound.play('win');
  addPage('ch' + n);
  if (n + 1 < CHAPTERS.length) {
    toast(TX(`「${c.title}」ができた。観察帳に、本当のことが一つ書きこまれた`, `“${c.title}” is done. A true fact was written in the Field Notes`), 6);
    later(4.5, () => { if (G.ch === n + 0.5) enterChapter(n + 1); });
    G.ch = n + 0.5; G.spots = null;   // 次の章を待つあいだ（お題を数えない）
  } else {
    G.ch = CHAPTERS.length; G.unlock = unlockedAt(G.ch); W.knob = { winter: 1, tide: 1 }; syncHands();
    later(2.5, startEnding);
  }
  noteWorld(true);   // 年ができたところも書きとめる（v067）
}

// エンディング（v017）: 殻がはがれる演出（collapse.js）はやめた（2026-10-13 ユーザー）。
//   世界はそのまま。手に持つものなどを隠して、ゆっくり大地を一回りながめ、ことばのあとに年表と世界の版画の札。
//   ENDING: 0 のあいだはまだ（ながめ中）。札のあとは自由な箱庭
let ENDING = null;
function startEnding() {
  setHand(null); closeBook(); G.sel = null; updateCard();
  ENDING = { t: 0, panel: false };
  document.body.classList.add('ending');
  chapterLine(TX('めぐる世界', 'The Turning World'), TX('十の年が、めぐった。水も土も命も、何ひとつ消えずに。', 'The Ten Years have turned. Water, soil and life, with nothing lost.'), 9);
  Sound.play('reveal');
}
// 毎フレーム（main.js の frame）: 大地がゆっくり回り、少し引いて全体を見せる
function stepEnding(dt) {
  if (!ENDING) return;
  ENDING.t += dt;
  V.yaw += dt * 0.12;
  V.zoom += (0.9 - V.zoom) * Math.min(1, dt * 0.6); V.panX *= 1 - Math.min(1, dt); V.panY *= 1 - Math.min(1, dt);
  layout(V.cw, V.ch);
  if (!ENDING.panel && ENDING.t > 10) { ENDING.panel = true; endingPanel(); }
}
function endingPanel() {
  const rows = (G.done || []).map((d, n) => d && CHAPTERS[n] ? TX(`<li>第 ${d.day} 日　${CHAPTERS[n].title}</li>`, `<li>Day ${d.day}: ${CHAPTERS[n].title}</li>`) : '').join('');
  const found = Object.keys(G.found || {}).length;
  chapterLine('', '');
  const newest = Math.max(...['deer', 'wolf', 'fish', 'bird'].map(k => geneStats(k).gen));
  showPanel(TX(`<h2>めぐる世界</h2>
    <p>果ての滝は落ちつづけ、深淵の水は泉からまたわき出る。草はシカに、シカはオオカミに、去った命はつぼへ。この平らな大地では、何も生まれず、何も消えない。ただ、めぐっていた。</p>
    <p class="truth"><b>本当は</b>　大地は丸い球（地球）。重さはどこでも球の中心へ向かってはたらくので、海の水は果てから落ちていかない。水は海から雲へ、雲から雨へ、川から海へとめぐっている。落ちていくものは、どこかで、めぐっている。</p>
    <p class="small">きみの世界の年表</p><ul class="chron">${rows}</ul>
    <p class="small">見つけたこと ${found} ／ ${FINDS.length}。いちばん新しい世代 ${newest}。</p>`,
    `<h2>The Turning World</h2>
    <p>The falls keep falling, and the water of the Abyss wells up again from the springs. Grass goes to the deer, deer go to the wolves, and lives that pass away go back to the jar. On this flat land, nothing is made and nothing is lost. It just keeps turning.</p>
    <p class="truth"><b>What is really true:</b> the land is a round ball (the Earth). Weight always pulls toward the center of the ball, so the sea never falls off an edge. Water goes from the sea to the clouds, from the clouds to the rain, and from the rivers back to the sea. What falls away is, somewhere, turning around again.</p>
    <p class="small">Timeline of your world</p><ul class="chron">${rows}</ul>
    <p class="small">Discoveries: ${found} / ${FINDS.length}. Newest generation: ${newest}.</p>`),
  [{ label: TX('世界の版画をのこす', 'Make a World Print'), fn: () => openPrints(endingPanel) }, { label: TX('自由な箱庭へ', 'On to the Free Garden'), main: true, fn: endEnding }]);
  $('panel').classList.add('world', 'ending');
}
function endEnding() {
  ENDING = null; document.body.classList.remove('ending');
  noteWorld(true);
  toast(TX('ここからは自由な箱庭。命のつぼの中身は、ぜんぶ使える', 'From here on, it’s a Free Garden. Everything in the Life Jar is yours to use'), 6);
}

// 章とお題の1行（上のまんなか）
function questLine(s) {
  const el = $('quest');
  if (!G.started || COL) { el.hidden = true; return; }
  el.hidden = false;
  if (isFree()) { $('qTitle').textContent = TX('自由な箱庭', 'Free Garden'); $('qText').textContent = ''; $('qBar').style.width = '0'; el.classList.add('free'); return; }
  el.classList.remove('free');
  const c = CHAPTERS[Math.floor(G.ch)];
  if (c && c.key === 'genes' && G.gwhat && !(G.ch % 1)) $('quest').title = G.gwhat;
  if (G.ch % 1) { $('qTitle').textContent = yearOf(Math.floor(G.ch)); $('qText').textContent = c.title + TX(' — できた', ' — done'); $('qBar').style.width = '100%'; return; }
  const v = c.prog(s), fmt = c.show || (x => x);
  $('qTitle').textContent = TX(`${yearOf(G.ch)}　${c.title}`, `${yearOf(G.ch)}: ${c.title}`);
  $('qText').textContent = c.key === 'winter' ? TX(`${c.text}（${fmt(v)}）`, `${c.text} (${fmt(v)})`) : TX(`${c.text}（${fmt(v)}${c.unit} ／ ${fmt(G.goal)}${c.unit}）`, `${c.text} (${fmt(v)}${c.unit} / ${fmt(G.goal)}${c.unit})`);
  $('qBar').style.width = Math.min(100, c.key === 'winter' ? (G.winterSeen ? 60 : L.counts.deer >= 10 ? 25 : 0) : v / G.goal * 100) + '%';
}
