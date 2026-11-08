// 声の数 → はじめの子の遺伝子（こえのこ voice-pet/evo/life.js の founder と rng を写したもの。あちらは作業中で公開されていないので、里山の中に持つ）
// 遺伝子はどれも 0..1。体（kid.js）が使うのは seg・neck・tail・legs・legLen・girth・stop・bold・vtl・f0・fluff
const GAIT0 = { gSw: 0.41, gBd: 0.74, gFq: 0.7, gPr: 0.5, gSd: 0.5, gBl: 0.1, gWv: 0.5 };
const cl = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const vtlG = v => cl((v - 9) / 10), f0G = f => cl(Math.log(f / 80) / Math.log(450 / 80));
export function rng(seed) { let s = (seed >>> 0) || 1; const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; r.gauss = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * r()); }; return r; }
let NEXT = 1;
export function founder(a, R) {
  const n = a.n, j = () => R.gauss() * 0.08;
  const g = {
    seg: cl(n.tempo * 0.7 + 0.15 + j()), neck: cl(0.15 + R() * 0.3), tail: cl(n.rough * 0.6 + 0.2 + j()),
    legs: cl(0.35 + (1 - n.breath) * 0.4 + j()), legLen: cl(n.pitch * 0.6 + 0.2 + j()), girth: cl(n.breath * 0.6 + 0.3 + j()),
    stop: cl(0.25 + R() * 0.25), eye: 0, bold: cl(0.15 + R() * 0.2), vtl: cl(lerp(0.5, vtlG(a.raw.vtl), 0.4) + j()), f0: cl(lerp(0.5, f0G(a.raw.f0), 0.4) + j()), fluff: cl(n.breath * 0.7 + j()),
  };
  // 歩き方ははじめ、てんでばらばら（話しかけて代を重ねるうちに、その体で歩ける歩き方が残っていく）
  for (const k of Object.keys(GAIT0)) g[k] = cl(0.5 + R.gauss() * 0.28);
  return { id: NEXT++, gen: 1, parent: 0, g, seed: (R() * 1e9) | 0 };
}
