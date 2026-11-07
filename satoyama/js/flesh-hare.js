// ノウサギの肉づき（皮を作るための形。物理には入れない）。LOOKDEV.md 2章: ももは太く、すねから先は細い棒・腹は白・耳の先は黒
// H（buildHare の体）の生まれたときの位置から作る。太さは毛こみ（m）
const add = (a, b) => a.map((v, i) => v + b[i]);
export const HEAD_OFF = [-0.006, 0.016, 0]; // 皮の頭は物理の頭の玉より少し上・うしろ（跳んで体がのびても首が長く見えないように）。耳と目もこれに合わせる
export function hareShapes(H) {
  const P = H.parts, S = [];
  const cap = (part, a, b, ra, rb, k = 0.02, body = P[part].body) => S.push({ part, body, a, b, ra, rb, k });
  // 胴: 腰（尻は丸く大きく、いちばん高い）と胸（深い）。背は丸く、腹はなだらかに
  cap('pelvis', add(P.pelvis.a, [0.035, 0.016, 0]), add(P.pelvis.b, [0, -0.004, 0]), 0.078, 0.062, 0.035); // 物理の骨より少し短く（本物の頭胴長 45〜54cm）
  cap('chest', add(P.chest.a, [0, -0.01, 0]), add(P.chest.b, [-0.03, -0.012, 0]), 0.062, 0.052, 0.045); // 胸は深く、腰よりほっそり
  // 首と頭（頭は胸とまとめた体なら胸の骨につく）。物理の頭の玉より少し上に描く（伏せても頭が肩より上に出る）。鼻先は前へ細く
  const hc = add(P.head.c, HEAD_OFF), hb = P.head.body;
  cap('head', add(P.chest.b, [-0.035, 0.012, 0]), add(hc, [-0.02, -0.008, 0]), 0.054, 0.046, 0.045, hb); // 首は太く短く、肩にうまる
  cap('head', hc, add(hc, [0.05, -0.012, 0]), 0.045, 0.024, 0.02, hb);
  // 尾（短く、上が黒褐色で下が白）
  cap('tail', add(P.pelvis.a, [-0.035, 0.04, 0]), add(P.pelvis.a, [-0.05, 0.05, 0]), 0.022, 0.017, 0.012, P.pelvis.body);
  for (const L of ['L', 'R']) {
    // 後ろ足: ももは根もとが太く（尻の大きな筋）、すねから先は細い。足の裏は毛（肉球なし）
    cap('thigh' + L, add(P['thigh' + L].a, [0.005, 0.005, L === 'L' ? 0.006 : -0.006]), P['thigh' + L].b, 0.04, 0.022, 0.025); // もも（大きな筋は尻の丸みにうめる。太くしすぎると、足をのばしたとき袋のように垂れる）
    cap('shank' + L, P['shank' + L].a, P['shank' + L].b, 0.017, 0.011, 0.012);
    cap('hfoot' + L, P['hfoot' + L].a, P['hfoot' + L].b, 0.013, 0.012, 0.008);
    // 前足は細い
    cap('uarm' + L, P['uarm' + L].a, P['uarm' + L].b, 0.018, 0.012, 0.015);
    cap('farm' + L, P['farm' + L].a, P['farm' + L].b, 0.0105, 0.0095, 0.008);
    cap('ffoot' + L, P['ffoot' + L].a, P['ffoot' + L].b, 0.0095, 0.009, 0.006);
  }
  return S;
}
// 毛の色（夏毛）: 背は灰褐色、腹・あごの下・尾の裏・足の裏は白っぽい、尾の上は黒褐色。体の中の位置 p（生まれたときの、地面からの高さ y・前 x）と面の向き n から
export function hareFurColor(part, p, n, H) {
  const BACK = [0.34, 0.26, 0.18], SIDE = [0.46, 0.36, 0.25], BELLY = [0.84, 0.80, 0.72], DARK = [0.14, 0.11, 0.09], FOOT = [0.62, 0.55, 0.44];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
  let c = mix(SIDE, BACK, n[1] * 1.4); // 上を向いた所ほど背の色
  if (part === 'pelvis' || part === 'chest' || part === 'head') c = mix(c, BELLY, (-n[1] - 0.25) * 2.2); // 腹とあごの下
  if (part === 'tail') c = n[1] > -0.2 && n[0] > -0.6 ? mix(c, DARK, 1) : BELLY; // 尾: 上は黒褐色、下と後ろは白
  if (part.startsWith('hfoot') || part.startsWith('ffoot')) c = mix(c, FOOT, 0.6);
  const s = Math.sin(p[0] * 431 + p[1] * 277) * Math.sin(p[2] * 389 + p[0] * 151);
  return c.map(v => v * (0.88 + 0.18 * s)); // 差し毛（毛先の黒と黄土のまだら）
}
// 見た目の関節の範囲（rad、生まれたときの角度から。＋で先の骨が前・上へ。向きは tools/jointsign.mjs で測った）。axis 'x' は横へ開く向き
// ひざ −0.3 曲げ〜＋1.8 のばす、かかと −2.2 のばす〜＋0.3 曲げ、ひじ −0.1 のばす〜＋1.8 曲げ（前足を前へたたむ）、手首 −1.4 曲げ（足先をうしろへたたむ）〜＋0.15 そらす
export function hareBends(H) {
  const P = H.parts, out = [];
  for (const L of ['L', 'R']) out.push(
    // 横へ開くのは少しだけ（物理の横の反射は足を大きく開くことがあり、前足が横へ張り出して見えた）
    { parent: 'pelvis', child: 'thigh' + L, pivot: P['thigh' + L].a, axis: 'x', min: -0.12, max: 0.12, chain: ['shank' + L, 'hfoot' + L] },
    { parent: 'chest', child: 'uarm' + L, pivot: P['uarm' + L].a, axis: 'x', min: -0.12, max: 0.12, chain: ['farm' + L, 'ffoot' + L] },
    { parent: 'thigh' + L, child: 'shank' + L, pivot: P['shank' + L].a, min: -0.3, max: 1.8, chain: ['hfoot' + L] },
    { parent: 'shank' + L, child: 'hfoot' + L, pivot: P['hfoot' + L].a, min: -2.2, max: 0.3 },
    { parent: 'uarm' + L, child: 'farm' + L, pivot: P['farm' + L].a, min: -0.1, max: 1.8, chain: ['ffoot' + L] },
    { parent: 'farm' + L, child: 'ffoot' + L, pivot: P['ffoot' + L].a, min: -1.4, max: 0.15 });
  return out;
}
