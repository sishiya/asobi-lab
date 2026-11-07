// 花の小川: 音（Web Audio でその場で作る。録った音は使わない）。
// はじめて押したときに鳴らしはじめる（ブラウザの決まり）。音の大きさは設定の on/off だけ。
let ac = null, master = null, water = null, lp = null, on = true;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];   // 花が咲く音（ペンタトニック）

export function startAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ac.destination);
  // 小川の水音: ゆらぐ茶色のノイズを低めにこす
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  water = ac.createGain(); water.gain.value = 0.18;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.17; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(water.gain); lfo.start();
  src.connect(lp); lp.connect(water); water.connect(master); src.start();
}
export function setSound(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 0.8 : 0, ac.currentTime, 0.05); }
export function soundOn() { return on; }
// 流れの速さ（3D の単位で 0〜120）で、水音を明るく大きく。とどまると静かなせせらぎ
export function setFlow(v) {
  if (!ac) return; const k = Math.max(0, Math.min(1, v / 70));
  lp.frequency.setTargetAtTime(500 + 1900 * k, ac.currentTime, 0.3); water.gain.setTargetAtTime(0.1 + 0.2 * k, ac.currentTime, 0.3);
}

function tone(freq, t0, dur, type = 'sine', vol = 0.12, bend = 0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, freq, q, vol) {
  const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  return f;
}

let lastBloom = 0, step = 0;
// 花が咲いた（ふつう・めずらしい）。続けて咲くと音階をのぼる
export function sBloom(rare) {
  if (!ac) return;
  const t = ac.currentTime; if (t - lastBloom < 0.07) return;
  step = t - lastBloom < 0.6 ? (step + 1) % PENTA.length : 0; lastBloom = t;
  const f = 523.25 * Math.pow(2, PENTA[step] / 12);
  tone(f, t, 0.5, 'sine', 0.07); tone(f * 2, t, 0.25, 'triangle', 0.02);
  if (rare) { tone(f * 1.5, t + 0.06, 0.8, 'sine', 0.06); tone(f * 3, t + 0.12, 0.6, 'sine', 0.03); }
}
// 水面にさわった「ぽちゃ」: 岸の左右で少し音の高さがかわる（短く上がる水の音）
let lastTouch = 0;
export function sTouch(x = 0) {
  if (!ac) return; const t = ac.currentTime; if (t - lastTouch < 0.08) return; lastTouch = t;
  const f = 620 + 140 * x + Math.random() * 60;
  tone(f, t, 0.12, 'sine', 0.05, 1.9); tone(f * 1.5, t + 0.02, 0.08, 'sine', 0.015, 1.6);
}
// しずくどうしがくっついた「むにゅ」: 低めにふくらむ音（続けて鳴りすぎないように）
let lastJoin = 0;
export function sJoin(size = 0) { if (!ac) return; const t = ac.currentTime; if (t - lastJoin < 0.1) return; lastJoin = t; const f = 260 * Math.pow(2, Math.round(size * 12) * 2 / 12); tone(f, t, 0.16, 'sine', 0.05, 1.35); }   // size: 塊の大きさ 0〜1（大きいほど高い音）
let lastBreak = 0;
// 放った「ひゅっ」
export function sFling() { if (!ac) return; const t = ac.currentTime; const f = noise(t, 0.25, 900, 2, 0.08); f.frequency.exponentialRampToValueAtTime(2600, t + 0.2); }
export function sBreak() { if (ac) { const t = ac.currentTime; if (t - lastBreak < 0.08) return; lastBreak = t; tone(880, t, 0.09, 'sine', 0.06, 0.55); } }   // ちぎれる「ぷちっ」
export function sClump() { if (ac) { const t = ac.currentTime; tone(330, t, 0.07, 'triangle', 0.05, 0.8); } }
export function sFiber() { if (ac) { const t = ac.currentTime; noise(t, 0.12, 2400, 2, 0.05); } }
export function sThunder() {
  if (!ac) return; const t = ac.currentTime;
  noise(t, 0.25, 3000, 0.7, 0.18); noise(t + 0.05, 2.2, 120, 0.8, 0.5);
}
export function sWave(ride) {
  if (!ac) return; const t = ac.currentTime;
  const f = noise(t, 1.2, 500, 1.2, ride ? 0.25 : 0.1); f.frequency.exponentialRampToValueAtTime(2200, t + 1.0);
}
export function sFinish(grade) {
  if (!ac) return; const t = ac.currentTime;
  const base = 392 * Math.pow(2, (grade === 4 ? 0 : -2) / 12);
  [0, 4, 7, 12, 16].forEach((p, i) => tone(base * Math.pow(2, p / 12), t + i * 0.12, 1.4, 'sine', 0.07));
}
