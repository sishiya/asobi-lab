// 恐竜かけっこ牧場 8bit の難しさの見積もり: ROM と同じ決まり（derive・転び・かけ合わせ）を JS でまねて、
// いちばん速い2頭をかけ合わせていちばんよい子を残すだけの手で、何世代で3杯をとれるか。
//   node retro-8bit/tools/dino-sim.mjs [たね]
// ライバルの表は data.mjs の RIVAL_KMH をそのまま使う。
import { derive, RIVAL_KMH as RIV } from "../src/dino-ranch/data.mjs";
let seed = +process.argv[2] || 1; const R = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
// レース（game.s と同じ刻み）: 1 頭が 1280 ドットに着くまでのフレーム
function raceT(g) { const d = derive(...g); const top = d.kmh * 15; let x = 0, sp = 0, down = 0, t = 0;
  while (x < 1280 * 256 && t < 5000) { t++; if (down) { down--; sp = 0; } else { sp = Math.min(top, sp + d.acc); if (t % 32 === 0 && d.fall && Math.floor(R() * 64) < d.fall) down = 45; } x += sp; } return t; }
// ライバルの時間は kmh だけで（転ばない・加速は中くらい）
// ライバルの時間は km/h だけで見積もる（転ばない。加速のぶん 40 フレーム足す）
const rivalT = (k) => Math.ceil(1280 * 256 / (k * 15)) + 40;
function winP(g, race) { let w = 0; for (let i = 0; i < 200; i++) { const t = raceT(g); if (RIV[race].every((k) => t < rivalT(k))) w++; } return w / 200; }
let ranch = [[5, 6, 6, 6, 5], [9, 8, 5, 3, 7]];
let race = 0, gens = 0, tries = 0; const log = [];
const score = (g) => { const d = derive(...g); return d.kmh - d.fall / 4; };
while (race < 9 && gens < 200) {
  ranch.sort((a, b) => score(b) - score(a));
  const best = ranch[0];
  tries++;
  if (R() < winP(best, race)) { log.push(`race${race + 1}: gen${gens} ${derive(...best).kmh}km/h`); race++; continue; }
  // 2 頭をかけ合わせて 3 頭、いちばんよい子を残す（4 頭まで。いっぱいなら一番わるいのを逃がす）
  const [a, b] = [ranch[0], ranch[Math.min(1, ranch.length - 1)]];
  const kids = [0, 1, 2].map(() => a.map((_, i) => { let v = R() < 0.5 ? a[i] : b[i]; if (R() < 0.5) { v += (R() < 0.5 ? -1 : 1) * (R() < 0.5 ? 2 : 1); } return Math.max(0, Math.min(15, v)); }));
  kids.sort((x, y) => score(y) - score(x));
  if (ranch.length >= 4) ranch.pop();
  ranch.push(kids[0]); gens++;
}
console.log(log.join('\n'), `\n世代 ${gens}・レースの回数 ${tries}`);
