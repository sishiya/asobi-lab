// 声の入口（声を数にする・録る・声のみほん の部品をまとめて渡す。もとは古いこえのこ voice-pet/js にあったものを写した＝2026-11-08）
// 声は端末の中で数にしたら捨てる（送らない・保存しない）
export { analyze } from './features.js';
export * as A from './audio.js';
export { sampleVoice } from './synth.js';
export { founder, rng } from './voice-founder.js'; // こえのこの evo は作業中で公開されていないので、写しを使う
