// 音: 標本室に合う古い楽器のBGM（5曲から選ぶ）と、紙・木・オルゴールの効果音。すべて WebAudio で作る（音の素材ファイルは使わない）
// 言語（index.html の TX(日本語, 英語)。ノードでの試験のときは日本語）
const TX = globalThis.TX || ((ja) => ja);
let ctx = null, master = null, bgmBus = null, seBus = null, verb = null;
// 音量（設定画面のスライダー 0〜1）。BGM は 0.26 倍、効果音は 0.8 倍をいちばん大きい音にする
let bgmVol = 0.6, seVol = 0.7;
const BGM_MAX = 0.26, SE_MAX = 0.8;

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
  master = ctx.createGain(); master.gain.value = 1;
  master.connect(ctx.destination);
  verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 2.6);
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.28;
  verb.connect(verbGain).connect(master);
  bgmBus = ctx.createGain(); bgmBus.gain.value = BGM_MAX * bgmVol;
  bgmBus.connect(master); bgmBus.connect(verb);
  seBus = ctx.createGain(); seBus.gain.value = SE_MAX * seVol;
  const seVerb = ctx.createGain(); seVerb.gain.value = 0.35;
  seBus.connect(master); seBus.connect(seVerb).connect(verb);
}

export function setVolumes(b, e) {
  bgmVol = b; seVol = e;
  if (!ctx) return;
  bgmBus.gain.setTargetAtTime(BGM_MAX * bgmVol, ctx.currentTime, 0.05);
  seBus.gain.setTargetAtTime(SE_MAX * seVol, ctx.currentTime, 0.05);
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
  noise(t, 0.018, 'highpass', 3500, 0.7, vel * 0.18, bus); // 弦をはじく音
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

// やわらかい鈴: 立ち上がりをゆっくりにして（アタックを弱く）、余韻だけをきらきらと
function softBell(t, m, vel, len = 1, bus = seBus) {
  const f = mtof(m);
  for (const [mul, lv] of [[1, 1], [2.01, 0.3], [3.98, 0.12]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * lv, t + 0.045);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len * (mul > 1 ? 0.6 : 1));
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + len + 0.05);
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
  Bb: [46, 50, 53], Gm: [55, 58, 62], A: [57, 61, 64], D: [50, 54, 57],
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
    id: 'minuet', name: TX('チェンバロのメヌエット', 'Harpsichord Minuet'), beat: 60 / 80, beats: 3, key: [57, 'minor'],
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
    id: 'musicbox', name: TX('夜のオルゴール', 'Night Music Box'), beat: 60 / 66, beats: 3, key: [62, 'minor'],
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
    id: 'pavane', name: TX('古時計のパヴァーヌ', 'Pavane of the Old Clock'), beat: 60 / 62, beats: 4, key: [57, 'minor'],
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
    id: 'stroll', name: TX('標本室のおさんぽ', 'A Stroll in the Specimen Room'), beat: 60 / 104, beats: 2, key: [60, 'major'],
    bars: [
      ['C', [72, 76, 79, 76]], ['Am', [72, 76, 81, 79]], ['F', [77, 76, 74, 72]], ['G', [74, null, 71, 74]],
      ['C', [76, 79, 84, 79]], ['F', [81, 77, 74, 77]], ['G', [79, 77, 74, 71]], ['C', [72, null, null, null]],
      ['Am', [76, 72, 69, 72]], ['Em', [71, 74, 79, 76]], ['F', [77, 81, 77, 74]], ['C', [76, null, 72, 76]],
      ['Dm', [74, 77, 81, 77]], ['G', [79, 74, 71, 74]], ['F', [72, 76, 74, 71]], ['C', [72, null, null, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      pluck(t, c[0] - 12, 0.5); pluck(t + B, c[2] - 12, 0.4);
      pluck(t + B / 2, c[1] + 12, 0.18, 0.2); pluck(t + B * 1.5, c[2] + 12, 0.18, 0.2);
      melody(t, mel, B / 2, (tt, m, d) => flute(tt, m, Math.min(d, B) * 0.8, 0.2));
    },
  },
  {
    id: 'fog', name: TX('霧のなかの図版', 'Plates in the Fog'), beat: 60 / 52, beats: 4, key: [57, 'minor'],
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
  // v034: おさんぽの曲を2つ（明るめで、少しおとなしめ。ユーザー）
  {
    id: 'meadow', name: TX('野原のおさんぽ道', 'A Walk Through the Meadow'), beat: 60 / 92, beats: 2, key: [67, 'major'],
    bars: [
      ['G', [71, 74, 79, 74]], ['D', [78, 76, 74, null]], ['Em', [76, 79, 83, 79]], ['C', [76, 74, 72, null]],
      ['G', [71, 72, 74, 79]], ['C', [76, 74, 72, 76]], ['D', [74, null, 72, 69]], ['G', [67, null, null, null]],
      ['C', [72, 76, 79, 76]], ['G', [74, 71, 67, 71]], ['Am', [72, 74, 76, 72]], ['D', [74, null, 78, 81]],
      ['G', [79, 76, 74, 71]], ['Em', [71, 74, 76, null]], ['D', [74, 72, 69, 66]], ['G', [67, null, null, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      pluck(t, c[0] - 12, 0.32); pluck(t + B, c[2] - 12, 0.24);
      pad(t, [c[0], c[1], c[2]], B * 2, 0.14);
      melody(t, mel, B / 2, (tt, m) => bell(tt, m, 0.07, 1.4, bgmBus));
    },
  },
  {
    id: 'path', name: TX('午後の小径', 'An Afternoon Path'), beat: 60 / 84, beats: 3, key: [65, 'major'],
    bars: [
      ['F', [72, 74, 76]], ['C', [77, null, 72]], ['Dm', [74, 77, 81]], ['Bb', [79, null, 77]],
      ['F', [76, 77, 79]], ['Gm', [81, 79, 77]], ['C', [76, 74, 72]], ['F', [77, null, null]],
      ['Bb', [74, 77, 79]], ['F', [81, null, 77]], ['Gm', [79, 77, 74]], ['C', [72, null, 76]],
      ['Dm', [77, 76, 74]], ['Bb', [74, 77, 74]], ['C', [72, 74, 76]], ['F', [77, null, null]],
    ],
    play(t, [name, mel], B) {
      const c = CH[name];
      pluck(t, c[0] - 12, 0.3, 0.5);
      for (const k of [1, 2]) [c[0], c[1], c[2]].forEach((m) => harpsichord(t + k * B, m + 12, B * 0.6, 0.07));
      melody(t, mel, B, (tt, m, d) => flute(tt, m, d * 0.9, 0.15));
    },
  },
];
export const BGM_LIST = TRACKS.map((tr) => ({ id: tr.id, name: tr.name }));
let trackId = 'fog'; // はじめは「霧のなかの図版」（2026-10-17 ユーザー。前は「チェンバロのメヌエット」）。選んだ曲は設定（main.js）が覚える
export const bgmId = () => trackId;

let bgmOn = false, nextT = 0, bar = 0, timer = null, playing = null;
function scheduler() {
  while (nextT < ctx.currentTime + 0.6) {
    playing.play(nextT, playing.bars[bar % playing.bars.length], playing.beat);
    bar++;
    nextT += playing.beat * playing.beats;
  }
}
export const audioRunning = () => !!ctx && ctx.state === 'running' && bgmOn;
export function startBgm() {
  if (!ctx || bgmOn) return;
  bgmOn = true;
  playing = TRACKS.find((tr) => tr.id === trackId);
  bar = 0;
  nextT = ctx.currentTime + 0.15;
  timer = setInterval(scheduler, 120);
}
export function stopBgm() { bgmOn = false; clearInterval(timer); }
// 判定のあいだは BGM を小さく（duck=true）。結果のあとにもどす
export function duckBgm(on) {
  if (!ctx || !bgmBus) return;
  bgmBus.gain.setTargetAtTime(BGM_MAX * bgmVol * (on ? 0.25 : 1), ctx.currentTime, on ? 0.08 : 0.6);
}
const keyOf = () => (TRACKS.find((tr) => tr.id === trackId) || TRACKS[0]).key;
// 曲をかえる（前の曲は小さくして、はじめから新しい曲）
export function setBgm(id) {
  if (!TRACKS.some((tr) => tr.id === id)) return;
  trackId = id;
  if (!ctx) return;
  const was = bgmOn;
  stopBgm();
  const old = bgmBus;
  old.gain.cancelScheduledValues(ctx.currentTime);
  old.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  setTimeout(() => old.disconnect(), 2000);
  bgmBus = ctx.createGain(); bgmBus.gain.value = BGM_MAX * bgmVol;
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
  goal() { // 正史: いまの曲の調で、属和音から主和音へ解決し、上でオルゴールが鳴る
    if (!ctx) return;
    const [r, mode] = keyOf(), t = ctx.currentTime + 0.05;
    const third = mode === 'minor' ? 3 : 4;
    [r - 5, r - 1, r + 2, r + 7].forEach((m) => harpsichord(t, m, 0.6, 0.22, seBus)); // 属和音（V7）
    [r - 12, r, r + third, r + 7, r + 12].forEach((m) => harpsichord(t + 0.55, m, 2.4, 0.28, seBus)); // 主和音
    [r + 12, r + 12 + third, r + 19, r + 24].forEach((m, i) => bell(t + 0.6 + i * 0.12, m, 0.16, 2.4));
  },
  notyet() { // まだ: 解決しないまま止まる
    if (!ctx) return;
    const [r] = keyOf(), t = ctx.currentTime + 0.05;
    [r - 5, r - 1, r + 2, r + 5].forEach((m) => harpsichord(t, m, 1.6, 0.22, seBus));
    tone(t + 0.4, 'triangle', 330, 220, 0.6, 0.06);
  },
  stamp() { // 判を押す音（紙に木の判）
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 140, 60, 0.18, 0.6);
    noise(t, 0.08, 'lowpass', 900, 0.8, 0.35);
    noise(t + 0.01, 0.05, 'bandpass', 2400, 2, 0.12);
  },
  // ---- 住人（2D世界）の音。回答の再生・はじめの歴史でも鳴る ----
  kiwiStep(res) {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.035, 'bandpass', 900 + Math.random() * 300, 3, 0.07); // 草をふむ小さな足音
  },
  kiwiTurn(res) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (res === 'penguin') { tone(t, 'sawtooth', 520, 680, 0.09, 0.04); tone(t + 0.1, 'sawtooth', 600, 480, 0.1, 0.035); } // ペンギンのガーガー声
    else if (res === 'snail') { tone(t, 'sine', 1200, 1000, 0.04, 0.03); } // 貝は鳴かない（小さな向きかえの音だけ）
    else { tone(t, 'sine', 1900, 2600, 0.07, 0.08); tone(t + 0.09, 'sine', 2300, 1800, 0.08, 0.06); } // キーウィの短い鳴き声
  },
  // 住人が形の断面にふれたとき: うまくいきそう、と小さく匂わせる。すぐ立ち上がる短い2つの粒（v066: 速く・短く・控えめに）
  kiwiTouch() {
    if (!ctx) return;
    const [r] = keyOf(), t = ctx.currentTime;
    bell(t, r + 24, 0.032, 0.28);
    bell(t + 0.045, r + 31, 0.026, 0.24);
  },
  kiwiFall() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 1400, 300, 0.7, 0.09);
    noise(t + 0.5, 0.25, 'lowpass', 500, 0.7, 0.08);
  },
  kiwiHome() {
    if (!ctx) return;
    const [r] = keyOf(), t = ctx.currentTime;
    [r + 12, r + 19, r + 24].forEach((m, i) => bell(t + i * 0.08, m, 0.1, 1.4));
  },
  // ---- 主人公の足音（姿ごとに音色を変える） ----
  step(kind) {
    if (!ctx) return;
    const t = ctx.currentTime, v = 0.05 + Math.random() * 0.02;
    if (kind === 'sparkle') { // 幾何学の主人公: やわらかく立ち上がる、高いきらめきと、さらさらした息（v039: アタックを弱く）
      const base = [93, 95, 98, 100, 102][Math.floor(Math.random() * 5)];
      [[0, 1], [0.05, 0.55], [0.11, 0.35]].forEach(([dl, k], i) => softBell(t + dl, base + i * 5 + (Math.random() < 0.5 ? 0 : 2), v * 0.32 * k, 0.9));
      noise(t, 0.35, 'highpass', 6500, 0.5, v * 0.18, seBus, 9000);
    }
    else if (kind === 'chime') bell(t, 88 + Math.floor(Math.random() * 3) * 2, v * 0.6, 0.5);
    else if (kind === 'chimeSoft') { // もとの鈴（chime）をやわらかく: 立ち上がりを少しゆるめ、かたい倍音をけずり、小さく短く（v040）
      const f = mtof(88 + Math.floor(Math.random() * 3) * 2);
      for (const [mul, lv, len] of [[1, 1, 0.42], [2.76, 0.16, 0.18]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.38 * lv, t + 0.014);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(seBus); o.start(t); o.stop(t + len + 0.05);
      }
    }
    else if (kind === 'puff') noise(t, 0.12, 'lowpass', 600, 0.7, v * 1.4);
    else if (kind === 'paper') noise(t, 0.05, 'highpass', 2600, 0.8, v);
    else if (kind === 'stone') { tone(t, 'sine', 180, 120, 0.08, v * 2); noise(t, 0.03, 'bandpass', 1200, 2, v); }
    else { tone(t, 'sine', 240, 160, 0.06, v * 1.6); noise(t, 0.03, 'bandpass', 1800, 2, v * 0.8); } // 木の床
  },
  land() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 160, 70, 0.14, 0.18);
    noise(t, 0.06, 'lowpass', 700, 0.7, 0.1);
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
