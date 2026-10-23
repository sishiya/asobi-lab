// 遊びの決まり（数だけ。画面に依存しない。tools/sim-check.mjs からも読む）PLAN.md 2.5章
export const RULE = {
  night: 150,        // ひと晩の長さ（秒）
  fuel0: 14,         // はじめの燃料（秒ぶん）
  fuelMax: 40,
  burnBase: 0.3, burnK: 1 / 40, // 燃える速さ = burnBase + F*burnK（大きい火ほど早く減る）。v014 で 0.4+F/34 から（くべる手数を減らす。DEVNOTES）
  rMin: 0.9, rMax: 5.6,          // 光の輪の半径（v014 で 6.4 から。たき火だけでふちまで守れると、灯がいらなかった）
  emberR: 0.55,                  // 火が消えたあとの残り火の輪
  emberGrace: 10,                // 火が消えてから夜に呑まれるまで（秒）
  crumble: 1 / 20,               // 輪の外で外気に面した塊が崩れる速さ（1 で落ちる）
  recover: 1 / 14,               // 輪の中で持ち直す速さ
  edgeSoft: 1.6,                 // 輪のふちのぼかし（この幅で暗さが 0→1）
  rootHold: 0.4,                 // 木のある塊の崩れる速さの倍率
  rootShock: 0.3,                // 木をくべたとき、その塊が一度に失うしっかり度
  dropR: 1.3,                    // 火からこの距離の中で放すとくべる（1.0 では、火の近くに置いたつもりがくべられないことがあった）
  // 次の夜（光で拾う。PLAN.md 2.7章）: 2夜目から、落ちたかけらが闇を漂って浮かんでくる
  returns: 5,                    // ひと晩に浮かんでくるかけらの数（＋落ちている塊の数×catchUp）
  catchUp: 0.2,
  emberCost: 3,                  // 火種を分けると、たき火の燃料がこれだけ減る
  emberMin: 7,                   // たき火がこれより小さいと、火種は分けられない（炎がすくむ）。v014 で 10 から（大きい火を保たないと灯が置けず、灯が火の代わりにならなかった）
  driftLife: 24,                 // 浮かんでいる秒数（そのあいだに光がとどかなければ、また沈む）
  dockDark: 0.45,                // かけらの場所の暗さがこれより小さく、島のとなりなら、くっつく
  driftwood: 6,                  // くっついたかけらに乗ってくる流木の燃料（v014 で 10 から。後の夜ほど燃料があまって楽になっていた）
  washUp: [0, 8, 6, 5, 4],         // 夜のはじめに島に流れ着く流木の数（夜ごと）。燃やせる物が一夜で尽きないように。v014: 第1夜のあとの雨の夜で燃料が尽きていたので第2夜を多く、最後の夜は少なく
  washFuel: 8,
  // 火トカゲ（PLAN.md 2.9章）: つまんで置くと、たき火から火種をくわえて闇へ歩き、丸くなって小さく照らす。空の台にふれると灯をともす
  salR: 1.2,                     // 丸くなった火トカゲの光の輪
  salRest: 20,                   // 丸くなって照らす秒数（そのあと冷めて、自分で帰る）
  salSave: 8,                    // 火が消えかけると、ひと晩に1回だけ自分からおき火に入って、これだけ燃料をもたせる
};
// 五つの夜の空（PLAN.md 2.8章）。一夜に新しい決まりが1つずつ
export const WEATHER = [
  { id: 'ash', name: '灰の夜', line: '燃えるものを火にくべて、夜明けまで火を守れ' },
  { id: 'rain', name: '雨の夜', line: '外の薪はしけて、くすぶる。屋根の下の物はぬれない', burnMul: 1.15, wet: true },
  { id: 'wind', name: '風の夜', line: '光の輪が風下へずれる。夜のなかばで風が向きを変える', wind: 1.5 },
  { id: 'fog', name: '霧の夜', line: '光の輪がせまい。かけらが近くまで多く漂ってくる', rMul: 0.86, returnsMul: 1.4, near: 0.5 }, // v018: rMul 0.78・returnsMul 2 から（輪がせまく、灯と火トカゲの手数が1分に10回と忙しすぎた）
  { id: 'snow', name: '灰の雪の夜', line: '灰が火に積もって、火がすぐ弱る。夜が明けたら岸に着く', burnMul: 1.45 },
];
export const NIGHTS = WEATHER.length;
// 燃え方: 燃料を何秒かけて火に渡すか・けむり
export const BURN = {
  dry: { secs: 2, smoke: 0.2 },    // 乾いた板: ぱっと燃える
  beam: { secs: 10, smoke: 0.4 },  // 梁・荷車・薪: じっくり
  green: { secs: 20, smoke: 1.0 }, // 生木: くすぶる
};
export function lightRadius(F) { return F <= 0 ? RULE.emberR : RULE.rMin + (RULE.rMax - RULE.rMin) * Math.sqrt(Math.min(1, F / RULE.fuelMax)); }
export function burnRate(F) { return F <= 0 ? 0 : RULE.burnBase + F * RULE.burnK; }
// 輪の外の暗さ（0 = 光の中、1 = 闇）
export function darkness(dist, R) { const t = Math.min(1, Math.max(0, (dist - R) / RULE.edgeSoft)); return t * t * (3 - 2 * t); }

// 火の1こま: burning は [{ left, secs }]（くべた物の残りの燃料）
export function stepFire(st, dt) {
  for (const b of st.burning) { const give = Math.min(b.left, b.total / b.secs * dt); b.left -= give; st.F += give; }
  st.burning = st.burning.filter(b => b.left > 1e-6);
  st.F = Math.min(RULE.fuelMax, Math.max(0, st.F - burnRate(st.F) * (st.burnMul || 1) * dt));
  st.out = st.F <= 0 && !st.burning.length ? st.out + dt : 0;
}
// 塊の1こま: chunk = { s, exposed, dist, root, fixed, fallen }
export function stepChunk(c, R, dt, d = darkness(c.dist, R)) { // d: 灯もふくめた暗さ（いちばん守ってくれる光で）
  if (c.fixed || c.fallen) return false;
  if (c.exposed && d > 0) c.s -= RULE.crumble * d * (c.root ? RULE.rootHold : 1) * dt;
  else if (d === 0) c.s = Math.min(1, c.s + RULE.recover * dt);
  if (c.s <= 0) { c.fallen = true; return true; }
  return false;
}
