// 音: 標本室に合う古い楽器のBGM（5曲から選ぶ）と、紙・木・オルゴールの効果音。すべて WebAudio で作る（音の素材ファイルは使わない）
let ctx = null, master = null, bgmBus = null, seBus = null, verb = null;
let muted = false;
try { muted = localStorage.getItem('flat-history.mute') === '1'; } catch (e) { /* なし */ }
const BGM_VOL = 0.13;

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
  bgmBus = ctx.createGain(); bgmBus.gain.value = BGM_VOL;
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
// チェンバロ
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

// 鈴・オルゴール
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

// やわらかい弦（パッド）
function pad(t, ms, dur, vel) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + Math.min(1.2, dur * 0.35));
  g.gain.setValueAtTime(vel, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;
  lp.connect(g).connect(bgmBus);
  for (const m of ms) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    const og = ctx.createGain(); og.gain.value = 0.18 / ms.length;
    o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.7);
  }
}

// はじく弦（ピチカート）
function pluck(t, m, vel, len = 0.35) {
  const f = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + len);
  for (const [type, lv] of [['triangle', 0.8], ['sine', 0.5]]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = lv; o.connect(og).connect(lp);
    o.start(t); o.stop(t + len + 0.05);
  }
  lp.connect(g).connect(bgmBus);
}

// 木の笛（リコーダー）
function flute(t, m, dur, vel) {
  const f = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.06);
  g.gain.setValueAtTime(vel * 0.85, t + Math.max(0.08, dur - 0.08));
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.12);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.12;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
  const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.4);
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  o.connect(g); o2.connect(g2).connect(g); g.connect(bgmBus);
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.2); }
  noise(t, Math.min(0.12, dur), 'bandpass', f * 2, 2, vel * 0.08, bgmBus); // 息の音
}

// ---- BGM ----
const CH = {
  Am: [57, 60, 64], Dm: [50, 53, 57], G: [55, 59, 62], C: [48, 52, 55], F: [53, 57, 60], E: [52, 56, 59], Em: [52, 55, 59],
  Bb: [46, 50, 53], Gm: [55, 58, 62], A: [57, 61, 64],
};
// 旋律を鳴らす（null はひとつ前の音をのばす）
function melody(t, mel, step, play) {
  mel.forEach((m, k) => {
    if (m === null) return;
    let n = 1;
    while (mel[k + n] === null) n++;
    play(t + k * step, m, step * n);
  });
}

const TRACKS = [
  {
    id: 'minuet', name: 'チェンバロのメヌエット', beat: 60 / 80, beats: 3,
    bars: [
      ['Am', [76, 74, 72]], ['Dm', [74, 72, 69]], ['G', [71, 74, 79]], ['C', [76, 72, null]],
      ['F', [77, 76, 74]], ['Dm', [72, 74, 77]], ['E', [76, 71, 68]], ['Am', [69, null, null]],
      ['C', [72, 76, 79]], ['G', [79, 77, 74]], ['Am', [76, 72, 69]], ['Em', [71, 67, 71]],
      ['F', [72, 77, 76]], ['C', [74, 72, 76]], ['E', [74, 72, 71]], ['Am', [69, null, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      harpsichord(t, c[0] - 12, B * 2, 0.55);
      harpsichord(t + B * 2, c[2] - 12, B, 0.35);
      [c[0], c[1], c[2], c[1], c[2], c[1]].forEach((m, k) => harpsichord(t + k * B / 2, m + 12, B / 2, k === 0 ? 0.22 : 0.16));
      melody(t, mel, B, (tt, m, d) => harpsichord(tt, m, d * 1.1, 0.42));
    },
  },
  {
    id: 'musicbox', name: '夜のオルゴール', beat: 60 / 66, beats: 3,
    bars: [
      ['Dm', [74, 77, 81]], ['Bb', [79, 77, 74]], ['F', [72, 77, 81]], ['C', [79, 76, 72]],
      ['Gm', [74, 79, 82]], ['Dm', [81, 77, 74]], ['A', [76, 73, 69]], ['Dm', [74, null, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      pad(t, [c[0], c[1], c[2]], B * 3, 0.35);
      [c[0] + 12, c[2] + 12, c[1] + 24].forEach((m, k) => bell(t + k * B, m, 0.06, 1.6, bgmBus));
      melody(t, mel, B, (tt, m) => bell(tt, m + 12, 0.11, 2.4, bgmBus));
    },
  },
  {
    id: 'pavane', name: '古時計のパヴァーヌ', beat: 60 / 62, beats: 4,
    bars: [
      ['Am', [76, null, 74, 72]], ['G', [74, null, 71, 67]], ['F', [72, 69, 72, 77]], ['G', [74, null, null, null]],
      ['Am', [72, 74, 76, 79]], ['Em', [79, 77, 76, 74]], ['F', [72, null, 74, 72]], ['E', [71, null, 68, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      pad(t, [c[0] - 12, c[2] - 12], B * 4, 0.5);
      for (let k = 0; k < 8; k++) harpsichord(t + k * B / 2, [c[0], c[1], c[2], c[1] + 12][k % 4] + 12, B / 2, 0.12);
      melody(t, mel, B, (tt, m, d) => flute(tt, m, d * 0.95, 0.22));
    },
  },
  {
    id: 'stroll', name: '標本室のおさんぽ', beat: 60 / 104, beats: 2,
    bars: [
      ['C', [72, 76, 79, 76]], ['Am', [72, 76, 81, 79]], ['F', [77, 76, 74, 72]], ['G', [74, null, 71, 74]],
      ['C', [76, 79, 84, 79]], ['F', [81, 77, 74, 77]], ['G', [79, 77, 74, 71]], ['C', [72, null, null, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      pluck(t, c[0] - 12, 0.5); pluck(t + B, c[2] - 12, 0.4);
      pluck(t + B / 2, c[1] + 12, 0.18, 0.2); pluck(t + B * 1.5, c[2] + 12, 0.18, 0.2);
      melody(t, mel, B / 2, (tt, m, d) => flute(tt, m, Math.min(d, B) * 0.8, 0.2));
    },
  },
  {
    id: 'fog', name: '霧のなかの図版', beat: 60 / 52, beats: 4,
    bars: [['Am', 0], ['Am', 1], ['F', 2], ['F', 3], ['C', 4], ['C', 5], ['G', 6], ['Em', 7]],
    play(t, [name, seed], B) {
      const c = CH[name];
      if (seed % 2 === 0) pad(t, [c[0], c[1], c[2], c[0] + 12], B * 8, 0.42);
      const penta = [69, 72, 74, 76, 79, 81, 84];
      for (let i = 0; i < 2; i++) {
        const r = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
        const u = r - Math.floor(r);
        bell(t + (i * 2 + u * 1.5) * B, penta[Math.floor(u * penta.length)], 0.07, 3, bgmBus);
      }
    },
  },
];
export const BGM_LIST = TRACKS.map((tr) => ({ id: tr.id, name: tr.name }));
let trackId = 'minuet';
try { const v = localStorage.getItem('flat-history.bgm'); if (TRACKS.some((tr) => tr.id === v)) trackId = v; } catch (e) { /* なし */ }
export const bgmId = () => trackId;

let bgmOn = false, nextT = 0, bar = 0, timer = null, playing = null;
function scheduler() {
  while (nextT < ctx.currentTime + 0.6) {
    playing.play(nextT, playing.bars[bar % playing.bars.length], playing.beat);
    bar++;
    nextT += playing.beat * playing.beats;
  }
}
export function startBgm() {
  if (!ctx || bgmOn) return;
  bgmOn = true;
  playing = TRACKS.find((tr) => tr.id === trackId);
  bar = 0;
  nextT = ctx.currentTime + 0.15;
  timer = setInterval(scheduler, 120);
}
export function stopBgm() { bgmOn = false; clearInterval(timer); }
// 曲をかえる（前の曲は小さくして、はじめから新しい曲）
export function setBgm(id) {
  if (!TRACKS.some((tr) => tr.id === id)) return;
  trackId = id;
  try { localStorage.setItem('flat-history.bgm', id); } catch (e) { /* なし */ }
  if (!ctx) return;
  const was = bgmOn;
  stopBgm();
  const old = bgmBus;
  old.gain.cancelScheduledValues(ctx.currentTime);
  old.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  setTimeout(() => old.disconnect(), 2000);
  bgmBus = ctx.createGain(); bgmBus.gain.value = BGM_VOL;
  bgmBus.connect(master); bgmBus.connect(verb);
  if (was) startBgm();
}

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
    tone(ctx.currentTime + 1.2, 'triangle', 660, 180, 0.7, 0.12);
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
