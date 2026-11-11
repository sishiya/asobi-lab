// 鳴き声（遺伝子の声の筒の長さと高さから作る＝声をかけた人の声に少し似る）。型ごとの口（声の筒の長さ vk・高さ f・長さ len・母音・節まわし c）は本物の鳴き方に寄せる: ヘビは息の音、鳥は高いさえずり、クマは低い
import { synthVoice, sylls } from './synth.js';
export const CRY = { snake: { f: 0.7, breath: 0.92, rough: 0.02, text: 'uu', len: 0.9, c: [0, 0, -1, -1, -2] }, bird: { f: 2.1, vk: 0.55, breath: 0.05, text: 'ii', len: 0.7, c: [0, 7, 2, 9, 4] }, donkey: { f: 0.55, vk: 1.35, rough: 0.3, text: 'oa', len: 1.2, c: [0, 1, 0, -3, -5] }, hop: { f: 1.3, vk: 0.75, breath: 0.2, text: 'i', len: 0.55, c: [0, 5, 3] }, bound: { f: 1.15, vk: 0.85, text: 'iai', len: 0.8, c: [0, 4, 0, 4, 0] } };
export function cryVoice(g, sr, dur = 0.5) {
  const C = CRY[g.type] ?? {}, vtl = (9 + 10 * g.vtl) * (C.vk ?? 1), f0 = 80 * Math.pow(450 / 80, g.f0) * (1.2 + 0.25 * Math.random()) * (C.f ?? 1), text = C.text ?? ['ui', 'ai', 'oi', 'ue'][Math.floor(g.vtl * 37 + g.f0 * 53) % 4]; dur *= C.len ?? 1; // 子なので、もとの声より少し高く
  return synthVoice({ sr, dur: dur + 0.2, f0, vtl, breath: C.breath ?? 0.15 + 0.4 * (g.fluff ?? 0.3), rough: C.rough ?? 0.08, syl: sylls(text, text.length / dur, dur + 0.1), contour: C.c ?? [0, 3, 4, 1, -2], seed: (Math.random() * 1e6) | 0, gain: 0.5 }).samples;
}
