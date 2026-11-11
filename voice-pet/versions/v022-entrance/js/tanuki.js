// ホンドタヌキ（PLAN.md 2章の B の1種。のっそり歩くよつあしの型）: 声の子と同じ作り（kid.js）に、実在の寸法と毛の色をのせる
// 手本: 頭胴長 50〜60cm・尾 13〜18cm・3〜5kg（秋に太る）・足は短い・毛が長く体が丸く見える。顔は目のまわりが黒い（目の帯）・ほおは白っぽい・耳は小さく丸く縁が黒い・足は黒っぽい・肩に黒い帯
// 当たりの体は毛の下の体（細め）、皮は長い毛こみで太く
export const TANUKI = { s: 1, juv: 0, seg: 2, pairs: 2, neck: 1, tail: 2, girth: 1, r: 0.055, segL: 0.115, legL: 0.074, legR: 0.017, headR: 0.05, fluff: 1, fur: 0.018, snout: 0.9 };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
// 毛の色: 背は灰と黄土のまじった差し毛、肩に黒い帯、足は黒っぽい、腹は暗い灰褐色、尾は上が黒っぽい。顔は目の帯が黒く、ほおと鼻の上は白っぽい
export function tanukiFur(H) {
  const hc = H.parts.head.c, ch = H.parts.chest;
  return (part, p, n) => {
    const BACK = [0.50, 0.44, 0.34], DARK = [0.13, 0.11, 0.10], BELLY = [0.30, 0.26, 0.22], PALE = [0.80, 0.76, 0.66];
    let c = mix(BELLY, BACK, n[1] * 1.2 + 0.4);
    if (/up|lo|ft/.test(part)) c = mix(c, DARK, 0.85);                                   // 足
    if ((part === 'chest' || part.startsWith('neck')) && n[1] < 0.3) c = mix(c, DARK, 0.45); // 胸と首の下は黒っぽい
    if (part.startsWith('tail')) c = mix(c, DARK, n[1] > 0.3 ? 0.5 : 0.1); // 尾は上の筋が黒っぽい
    if (part === 'head') {
      // 目の帯: 目から後ろへのびる帯（線分からの近さでなめらかに）。ほおと鼻すじは白っぽく、鼻先は黒
      const e = TANUKI_FACE.eye, ex = hc[0] + e[0], ey = hc[1] + e[1], ez = e[2], dz = Math.abs(p[2] - hc[2]);
      const tx = Math.max(-0.03, Math.min(0.012, p[0] - ex)), d = Math.hypot(p[0] - ex - tx, p[1] - ey, dz - ez);
      const pale = Math.max(0, Math.min(1, (ey - 0.008 - p[1]) / 0.015)) * Math.max(0, Math.min(1, (p[0] - hc[0] + 0.01) / 0.02));
      c = mix(c, PALE, pale * 0.85 + Math.max(0, Math.min(1, (p[0] - ex - 0.015) / 0.02)) * 0.5);
      c = mix(c, DARK, Math.max(0, Math.min(1, (0.03 - d) / 0.012)) * 0.95);
      c = mix(c, DARK, Math.max(0, Math.min(1, (p[0] - hc[0] - 0.085) / 0.012)));
    }
    const s = Math.sin(p[0] * 431 + p[1] * 277) * Math.sin(p[2] * 389 + p[0] * 151);
    return c.map(v => v * (0.85 + 0.22 * s)); // 差し毛のまだら（毛先が黒と白の毛がまじる）
  };
}
// 顔: 目は小さく黒っぽい茶、耳は小さく丸く（はば 3.6cm・高さ 3.4cm）、縁が黒い
export const TANUKI_FACE = { eye: [0.031, 0.017, 0.052], eyeR: 0.0065, iris: 0x140d08, // 目と耳は長い毛の表から少し出る所に。目は黒っぽい ring: null,
  ear: { at: [-0.014, 0.05, 0.036], size: [0.02, 0.018, 0.006], out: 0.45, back: 0.2, tipAt: 1.5, tip: [0.12, 0.1, 0.09], inner: [0.72, 0.66, 0.56], outer: [0.16, 0.13, 0.11] } };
