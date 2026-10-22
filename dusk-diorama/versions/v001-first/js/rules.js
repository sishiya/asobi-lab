// 遊びの決まり（数だけ。画面に依存しない。tools/sim-check.mjs からも読む）PLAN.md 2.5章
export const RULE = {
  night: 150,        // ひと晩の長さ（秒）
  fuel0: 14,         // はじめの燃料（秒ぶん）
  fuelMax: 40,
  burnBase: 0.4, burnK: 1 / 34, // 燃える速さ = burnBase + F*burnK（大きい火ほど早く減る）
  rMin: 0.9, rMax: 6.4,          // 光の輪の半径
  emberR: 0.55,                  // 火が消えたあとの残り火の輪
  emberGrace: 10,                // 火が消えてから夜に呑まれるまで（秒）
  crumble: 1 / 20,               // 輪の外で外気に面した塊が崩れる速さ（1 で落ちる）
  recover: 1 / 14,               // 輪の中で持ち直す速さ
  edgeSoft: 1.6,                 // 輪のふちのぼかし（この幅で暗さが 0→1）
  rootHold: 0.4,                 // 木のある塊の崩れる速さの倍率
  rootShock: 0.3,                // 木をくべたとき、その塊が一度に失うしっかり度
  dropR: 1.0,                    // 火からこの距離の中で放すとくべる
};
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
  st.F = Math.min(RULE.fuelMax, Math.max(0, st.F - burnRate(st.F) * dt));
  st.out = st.F <= 0 && !st.burning.length ? st.out + dt : 0;
}
// 塊の1こま: chunk = { s, exposed, dist, root, fixed, fallen }
export function stepChunk(c, R, dt) {
  if (c.fixed || c.fallen) return false;
  const d = darkness(c.dist, R);
  if (c.exposed && d > 0) c.s -= RULE.crumble * d * (c.root ? RULE.rootHold : 1) * dt;
  else if (d === 0) c.s = Math.min(1, c.s + RULE.recover * dt);
  if (c.s <= 0) { c.fallen = true; return true; }
  return false;
}
