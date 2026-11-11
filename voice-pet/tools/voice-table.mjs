// 声のみほん → 声の数 → 型の点数 を一覧にする（VOICE.md の表のもと）。node tools/voice-table.mjs
import { sampleVoice, SAMPLES } from '../js/synth.js';
import { analyze } from '../js/features.js';
import { typeZ as typeScores, voiceType, VOICE_TYPES, rng } from '../js/voice-founder.js';
const f = v => v.toFixed(2).padStart(5), sr = 48000, KEYS = ['pitch', 'tempo', 'breath', 'rough', 'sharp', 'melody'];
console.log('見本'.padEnd(10), KEYS.map(k => k.padStart(6)).join(''), ' | ', VOICE_TYPES.map(t => t.padStart(7)).join(''), ' | 100回の結果');
for (const name of Object.keys(SAMPLES)) {
  const a = analyze(sampleVoice(name, sr), sr); if (!a.ok) { console.log(name, a.why); continue; }
  const S = typeScores(a.n), R = rng(name.length * 991), N = {};
  for (let i = 0; i < 100; i++) { const t = voiceType(a.n, R); N[t] = (N[t] || 0) + 1; }
  console.log(name.padEnd(10), KEYS.map(k => f(a.n[k]).padStart(6)).join(''), ' | ', VOICE_TYPES.map(t => f(S[t]).padStart(7)).join(''), ' | ', JSON.stringify(N));
}
