// 音: 標本室に合うチェンバロふうのメヌエット（BGM）と、紙・木・オルゴールの効果音。すべて WebAudio で作る（音の素材ファイルは使わない）
let ctx = null, master = null, bgmBus = null, seBus = null, verb = null;
let muted = false;
try { muted = localStorage.getItem('flat-history.mute') === '1'; } catch (e) { /* なし */ }

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function impulse(sec, decay) {
  const n = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return buf;
}

// 最初のクリック・キーのときに呼ぶ（ブラウザは操作のあとでないと音を出さない）
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 2.6);
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.28;
  verb.connect(verbGain).connect(master);
  bgmBus = ctx.createGain(); bgmBus.gain.value = 0.13;
  bgmBus.connect(master); bgmBus.connect(verb);
  seBus = ctx.createGain(); seBus.gain.value = 0.5;
  seBus.connect(master); seBus.connect(verb);
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('flat-history.mute', m ? '1' : '0'); } catch (e) { /* なし */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
}

// ---- 楽器 ----
function harpsichord(t, m, dur, vel, bus = bgmBus) {
  const f = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(vel * 0.25, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.3, dur));
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(4000, f * 3), t + 0.25);
  lp.Q.value = 0.7;
  for (const [type, mul, lv] of [['sawtooth', 1, 0.55], ['square', 2, 0.18], ['triangle', 1.003, 0.4]]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul;
    const og = ctx.createGain(); og.gain.value = lv;
    o.connect(og).connect(lp);
    o.start(t); o.stop(t + Math.max(0.35, dur) + 0.05);
  }
  lp.connect(g).connect(bus);
}

function bell(t, m, vel, len = 1.4, bus = seBus) {
  const f = mtof(m);
  for (const [mul, lv, dl] of [[1, 1, 1], [2.76, 0.35, 0.45], [5.4, 0.12, 0.25]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * lv, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len * dl);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + len * dl + 0.05);
  }
}

function noiseBuf() {
  if (noiseBuf.b) return noiseBuf.b;
  const n = ctx.sampleRate;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf.b = b);
}
function noise(t, dur, type, freq, q, vel, bus = seBus, sweepTo = null) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + Math.min(0.01, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

function tone(t, type, f0, f1, dur, vel, bus = seBus) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}

// ---- BGM: イ短調のメヌエット（3拍子・16小節でくりかえす） ----
const CH = {
  Am: [57, 60, 64], Dm: [50, 53, 57], G: [55, 59, 62], C: [48, 52, 55], F: [53, 57, 60], E: [52, 56, 59], Em: [52, 55, 59],
};
const BARS = [
  ['Am', [76, 74, 72]], ['Dm', [74, 72, 69]], ['G', [71, 74, 79]], ['C', [76, 72, null]],
  ['F', [77, 76, 74]], ['Dm', [72, 74, 77]], ['E', [76, 71, 68]], ['Am', [69, null, null]],
  ['C', [72, 76, 79]], ['G', [79, 77, 74]], ['Am', [76, 72, 69]], ['Em', [71, 67, 71]],
  ['F', [72, 77, 76]], ['C', [74, 72, 76]], ['E', [74, 72, 71]], ['Am', [69, null, null]],
];
const BEAT = 60 / 80;
let bgmOn = false, nextT = 0, bar = 0, timer = null;

function scheduleBar(t, i) {
  const [name, mel] = BARS[i % BARS.length];
  const tones = CH[name];
  const root = tones[0];
  // 低音: 1拍目に根音、3拍目に5度
  harpsichord(t, root - 12, BEAT * 2, 0.55);
  harpsichord(t + BEAT * 2, tones[2] - 12, BEAT, 0.35);
  // 分散和音（8分音符）
  const arp = [tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[1] + 12, tones[2] + 12, tones[1] + 12];
  arp.forEach((m, k) => harpsichord(t + k * BEAT / 2, m, BEAT / 2, k === 0 ? 0.22 : 0.16));
  // 旋律
  mel.forEach((m, k) => { if (m !== null) harpsichord(t + k * BEAT, m, BEAT * (mel[k + 1] === null ? 2.2 : 1), 0.42); });
}

export function startBgm() {
  if (!ctx || bgmOn) return;
  bgmOn = true;
  nextT = ctx.currentTime + 0.15;
  timer = setInterval(() => {
    while (nextT < ctx.currentTime + 0.6) { scheduleBar(nextT, bar++); nextT += BEAT * 3; }
  }, 120);
}
export function stopBgm() { bgmOn = false; clearInterval(timer); }

// ---- 効果音 ----
let lastPage = 0;
export const se = {
  page() { // ページをめくる紙の音（めくりすぎないよう間引く）
    if (!ctx || ctx.currentTime - lastPage < 0.045) return;
    lastPage = ctx.currentTime;
    noise(ctx.currentTime, 0.07, 'bandpass', 2600 + Math.random() * 1600, 1.4, 0.10);
  },
  place() { // 形を下ろす: 木のコトン
    if (!ctx) return;
    const t = ctx.currentTime + 0.28;
    tone(t, 'sine', 210, 95, 0.22, 0.5);
    noise(t, 0.05, 'bandpass', 1800, 2, 0.18);
    tone(t + 0.06, 'triangle', 420, 300, 0.12, 0.08);
  },
  pick() { // 持ち上げる
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 260, 520, 0.18, 0.18);
    noise(t, 0.12, 'highpass', 3000, 0.7, 0.05);
  },
  wave() { // 歴史が描きかわる: 紙がさらさら＋鈴
    if (!ctx) return;
    const t = ctx.currentTime + 0.32;
    noise(t, 1.4, 'bandpass', 1200, 0.8, 0.07, seBus, 6000);
    [88, 91, 95, 100].forEach((m, i) => bell(t + 0.08 + i * 0.09, m, 0.05, 0.9));
  },
  fall() { // 結末が「落ちる」に変わったとき
    if (!ctx) return;
    const t = ctx.currentTime + 1.2;
    tone(t, 'triangle', 660, 180, 0.7, 0.12);
  },
  goal() { // 正史ができた: オルゴールの分散和音
    if (!ctx) return;
    const t = ctx.currentTime + 0.1;
    [69, 72, 76, 81, 84, 88].forEach((m, i) => bell(t + i * 0.11, m, 0.2, 2.2));
    [57, 64, 69].forEach((m) => harpsichord(t + 0.7, m, 2, 0.3, seBus));
  },
  no() { // 置けない
    if (!ctx) return;
    tone(ctx.currentTime, 'square', 130, 110, 0.14, 0.05);
  },
  click() {
    if (!ctx) return;
    noise(ctx.currentTime, 0.03, 'bandpass', 3200, 3, 0.08);
  },
};
