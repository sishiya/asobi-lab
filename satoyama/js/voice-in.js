// 声の入口（こえのこの部品をまとめて渡す）。ページの置き場所によらず、このファイルからの道で読む（ページから ../../voice-pet と書くと、ページの URL しだいで見つからない）
// 声は端末の中で数にしたら捨てる（送らない・保存しない）
export { analyze } from '../../voice-pet/js/features.js';
export * as A from '../../voice-pet/js/audio.js';
export { sampleVoice } from '../../voice-pet/js/synth.js';
export { founder, rng } from './voice-founder.js'; // こえのこの evo は作業中で公開されていないので、写しを使う
