// 花の小川: 音（Web Audio でその場で作る。録った音は使わない）。
// はじめて押したときに鳴らしはじめる（ブラウザの決まり）。音の大きさは設定の on/off だけ。
// ver. 0.6（ユーザー「気持ち良い音階に」「走っているだけで一曲が完成すると、なおよい」）:
// - 音の高さはすべてハ長調。和音は王道の進行 F△7 → G6 → Em7 → Am7 を1小節ずつ（92 BPM、8分音符が1刻み）。
// - 川を下った道のり（0〜1）が曲の進みになる: 前奏（和音）→ Aメロ（ベース・分散和音）→ Bメロ（旋律・シェイカー）
//   → サビ（旋律が1オクターブ上、細かい分散和音）→ 池で おわりのフレーズ。とどまれば同じところをくり返し、急げば先へ。
// - くっつく・花・ちぎれる音は、次の16分音符にそろえて、いまの和音の音で鳴る（遊んだ音が曲の一部になる）。
let ac = null, master = null, water = null, lp = null, verb = null, on = true;
const C4 = 261.63, hz = st => C4 * Math.pow(2, st / 12);
const BPM = 92, E8 = 60 / BPM / 2, BAR = E8 * 8;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const CHORDS = [[5, 9, 12, 16], [7, 11, 14, 16], [4, 7, 11, 14], [9, 12, 16, 19]];   // 半音の数（C4＝0）。低い順
const ROOT = [5, 7, 4, 9];
// 旋律（8小節。[8分の位置, 半音, 長さ]）
const MEL = [
  [[0, 9, 2], [2, 7, 1], [3, 9, 1], [4, 12, 3]],
  [[0, 11, 2], [2, 9, 1], [3, 7, 1], [4, 4, 3]],
  [[0, 7, 2], [2, 4, 1], [3, 7, 1], [4, 11, 2], [6, 9, 2]],
  [[0, 9, 6]],
  [[0, 9, 2], [2, 7, 1], [3, 9, 1], [4, 14, 3]],
  [[0, 14, 2], [2, 12, 1], [3, 11, 1], [4, 7, 3]],   // G6 の上: 頭は D（C だと B とぶつかる。C は裏の経過音に）
  [[0, 7, 2], [2, 9, 1], [3, 11, 1], [4, 11, 2], [6, 14, 2]],   // Em7 の上: 3拍めは B
  [[0, 16, 4], [4, 12, 4]],
];
const SECTIONS = [0.1, 0.32, 0.58, 0.93];   // ここをこえると Aメロ・Bメロ・サビ・おわり
let t0 = 0, nextStep = 0, stepN = 0, prog = 0, mode = 'title', outroBar = -1, lay = null, lastSec = -1, lastMode = '';
const chordAt = n => CHORDS[Math.floor(n / 8) % 4];
// その時刻 t（なければ いま）に鳴っている和音。拍にそろえて予約する音は、鳴る時刻の和音で（小節をまたいでも合う）
const chordNow = (t = ac?.currentTime || 0) => chordAt(Math.max(0, Math.floor((t - t0) / E8)));
const chordTone = (n, t) => { const c = chordNow(t), k = ((n % c.length) + c.length) % c.length; return c[k] + 12 * Math.floor(n / c.length); };

export function startAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ac.destination);
  // 残響: 減っていくノイズで作った部屋（左右で少しちがう）
  const n = Math.floor(ac.sampleRate * 2.4), ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
  verb = ac.createConvolver(); verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
  // 小川の水音: ゆらぐ茶色のノイズを低めにこす
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  water = ac.createGain(); water.gain.value = 0.18;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.17; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(water.gain); lfo.start();
  src.connect(lp); lp.connect(water); water.connect(master); src.start();
  // 曲の層（それぞれの大きさを、曲の進みでゆっくり上げ下げ）
  const bus = (v, cut) => { const g = ac.createGain(); g.gain.value = v; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; g.connect(f); f.connect(master); const w = ac.createGain(); w.gain.value = 0.5; f.connect(w); w.connect(verb); return g; };
  lay = { pad: bus(0.022, 1100), bass: bus(0, 600), arp: bus(0, 3000), mel: bus(0, 4000), shk: bus(0, 9000), fx: bus(1, 8000) };
  t0 = ac.currentTime + 0.05; nextStep = t0; stepN = 0;
  setInterval(schedule, 25);
}
// 曲の進み（川を下った道のり 0〜1）と、いまの場面（'title' | 'play' | 'end'）
export function setProgress(p, m = 'play') {
  if (!ac) { prog = p; mode = m; return; }
  if (m === 'play' && mode !== 'play') outroBar = -1;
  prog = p; mode = m;
  const sec0 = m === 'play' ? SECTIONS.filter(s => p >= s).length : m === 'end' ? 4 : 0;
  if (sec0 === lastSec && m === lastMode) return;   // 場面が変わったときだけ大きさを変える（毎こま積まない）
  lastSec = sec0; lastMode = m;
  const sec = sec0;
  const want = { bass: sec >= 1 ? 0.07 : 0, arp: sec >= 1 ? 0.035 : 0, mel: sec >= 2 ? 0.05 : 0, shk: sec >= 2 ? 0.02 : 0, pad: sec >= 3 ? 0.03 : 0.022 };
  if (sec >= 4) { want.bass = 0.05; want.shk = 0; want.arp = 0.02; }
  for (const k in want) lay[k].gain.setTargetAtTime(want[k], ac.currentTime, 0.8);
}
// 8分音符ごとに、少し先まで音を予約する
function schedule() {
  if (!ac) return;
  if (nextStep < ac.currentTime - 0.05) { stepN = Math.ceil((ac.currentTime - t0) / E8); nextStep = t0 + stepN * E8; }   // タブを隠して遅れた分は鳴らさず飛ばす
  while (nextStep < ac.currentTime + 0.12) { play(stepN, nextStep); stepN++; nextStep = t0 + stepN * E8; }
}
function play(n, t) {
  const pos = n % 8, bar = Math.floor(n / 8), c = chordAt(n), r = ROOT[bar % 4];
  const sec = mode === 'play' ? SECTIONS.filter(s => prog >= s).length : mode === 'end' ? 4 : 0;
  // おわり: 主和音（C△9）のあとは何も鳴らさない
  if (sec >= 4 && outroBar >= 0 && bar - outroBar >= 1 && !(bar - outroBar === 1 && pos === 0)) return;
  // 和音（小節のはじめに、のばす。おわりの小節は C△9）
  if (pos === 0 && sec >= 4 && outroBar >= 0 && bar - outroBar === 1) {
    for (const st of [-12, 0, 4, 7, 11, 14]) for (const det of [-5, 5]) voice(hz(st), t, BAR * 2, 'sine', 1, lay.pad, 1.0, det);
    voice(hz(-24), t, BAR * 1.5, 'triangle', 1, lay.bass, 0.02);
    [0, 7, 12, 14, 16, 19].forEach((st, i) => pluckTo(hz(st + 12), t + i * 0.09, 1, lay.fx, 2.6, 0.05));
    return;
  }
  else if (pos === 0) for (const st of [c[0] - 12, ...c]) for (const det of [-5, 5]) voice(hz(st), t, BAR + 0.8, 'sine', 1, lay.pad, 1.0, det);
  if (sec === 0) return;
  // ベース（1拍めと3拍め、その小節の根音）
  if (pos === 0 || pos === 4) voice(hz(r - 24), t, E8 * 3.5, 'triangle', 1, lay.bass, 0.02);
  if (pos === 7 && sec >= 2) voice(hz(r - 24 + 7), t, E8 * 0.9, 'triangle', 0.6, lay.bass, 0.02);
  // 分散和音（Aメロは8分の裏だけ、サビは毎8分）
  const ord = [0, 2, 1, 3, 2, 1, 3, 2];
  if (sec >= 3 || pos % 2 === 1) pluckTo(hz(c[ord[pos]] + 12), t, 1, lay.arp, sec >= 3 ? 0.6 : 0.9);
  // 旋律（Bメロから。サビは1オクターブ上）
  if (sec >= 2 && sec < 4) for (const [p, st, l] of MEL[bar % 8]) if (p === pos) pluckTo(hz(st + (sec >= 3 ? 12 : 0)), t, 1, lay.mel, E8 * l + 0.5);
  // シェイカー（2拍め・4拍めは強く）
  if (sec >= 2 && sec < 4) tick(t, pos % 4 === 2 ? 1 : 0.45);
  // おわり: 池に入ったら、つぎの小節から 2 小節だけ旋律の終わりの形を鳴らして、主和音（C△9）でとまる
  if (sec >= 4) {
    if (outroBar < 0 && pos === 0) outroBar = bar;
    const k = bar - outroBar;
    if (k === 0) for (const [p, st, l] of MEL[6]) if (p === pos) pluckTo(hz(st + 12), t, 1, lay.mel, E8 * l + 0.5);
  }
}
// 1つの声: 音の高さ・はじまり・長さ・波の形・大きさ・送り先。atk＝立ち上がり（秒）
function voice(f, t, dur, type, vol, dest, atk = 0.01, det = 0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = det;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.setTargetAtTime(0, t + Math.max(atk, dur - 0.6), 0.25);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 1.2);
}
function pluckTo(f, t, vol, dest, dur = 0.7, v2 = null) {
  const g = ac.createGain(); g.gain.value = v2 ?? 1; g.connect(dest);
  for (const [m, a, dd] of [[1, vol, dur], [2, vol * 0.3, dur * 0.35], [4.2, vol * 0.1, 0.06]]) {
    const o = ac.createOscillator(), e = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * m;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(a, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dd);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + dd + 0.05);
  }
}
let noiseBuf = null;
function tick(t, v) {
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.1, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
  const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  s.connect(f); f.connect(g); g.connect(lay.shk); s.start(t); s.stop(t + 0.1);
}
// つぎの16分音符の時刻（遊んだ音を、曲の拍にそろえる）
const q16 = () => { const now = ac.currentTime, k = Math.ceil((now - t0) / (E8 / 2) - 0.15); return Math.max(now, t0 + k * E8 / 2); };

export function setSound(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 0.8 : 0, ac.currentTime, 0.05); }
export function soundOn() { return on; }
// 流れの速さ（3D の単位で 0〜120）で、水音を明るく大きく。とどまると静かなせせらぎ
export function setFlow(v) {
  if (!ac) return; const k = Math.max(0, Math.min(1, v / 70));
  lp.frequency.setTargetAtTime(500 + 1900 * k, ac.currentTime, 0.3); water.gain.setTargetAtTime(0.1 + 0.2 * k, ac.currentTime, 0.3);
}

// 効果の音の粒: from＝はじめの高さの倍率（そこから目の音へすべりこむ）
function tone(freq, t, dur, type = 'sine', vol = 0.12, from = 1) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq * from, t); if (from !== 1) o.frequency.exponentialRampToValueAtTime(freq, t + 0.045);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(lay.fx); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, freq, q, vol) {
  const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
  return f;
}

let lastBloom = 0, step = 0;
// 花が咲いた（ふつう・めずらしい）。続けて咲くとペンタトニックをのぼる。拍にそろえる
export function sBloom(rare) {
  if (!ac) return;
  const now = ac.currentTime; if (now - lastBloom < 0.07) return;
  step = now - lastBloom < 0.6 ? (step + 1) % PENTA.length : 0; lastBloom = now;
  const t = q16(), f = hz(12 + PENTA[step]);
  pluckTo(f, t, 0.055, lay.fx, 0.9);
  if (rare) { tone(f * 1.5, t + E8 / 2, 1.2, 'sine', 0.04); tone(f * 2, t + E8, 1.0, 'sine', 0.025); }
}
// 水面にさわった「ぽちゃ」: すぐ鳴らす（押した手ごたえ）。少し下から いまの和音の音へすべりこむ
let lastTouch = 0;
export function sTouch(x = 0) {
  if (!ac) return; const t = ac.currentTime; if (t - lastTouch < 0.08) return; lastTouch = t;
  tone(hz(12 + chordTone(Math.round((x + 1) * 1.5))), t, 0.22, 'sine', 0.05, 0.6);
}
// しずくどうしがくっついた「むにゅ」: 拍にそろえて、いまの和音の音。塊が大きいほど上、続けてくっつくと分散和音でのぼる
let lastJoin = 0, joinRun = 0;
export function sJoin(size = 0) {
  if (!ac) return; const now = ac.currentTime; if (now - lastJoin < 0.09) return;
  joinRun = now - lastJoin < 0.8 ? joinRun + 1 : 0; lastJoin = now;
  const t = q16(), f = hz(chordTone(Math.round(size * 6) + Math.min(joinRun, 3), t));
  tone(f, t, 0.5, 'sine', 0.06, 0.85); tone(f * 2, t, 0.18, 'sine', 0.012, 0.85);
}
let lastBreak = 0;
// 放った「ひゅっ」（音の高さのない風の音）
export function sFling() { if (!ac) return; const t = ac.currentTime; const f = noise(t, 0.25, 900, 2, 0.06); f.frequency.exponentialRampToValueAtTime(2600, t + 0.2); }
// ちぎれる「ぷちっ」: いまの和音の高い音から、その下の和音の音へ
export function sBreak() {
  if (!ac) return; const now = ac.currentTime; if (now - lastBreak < 0.08) return; lastBreak = now;
  const t = q16(), n = 8 + Math.floor(Math.random() * 2);
  tone(hz(chordTone(n, t)), t, 0.08, 'sine', 0.045); tone(hz(chordTone(n - 2, t)), t + E8 / 2, 0.25, 'sine', 0.04);
}
export function sClump() { if (!ac) return; const t = q16(); tone(hz(chordNow(t)[0] - 12), t, 0.2, 'triangle', 0.05, 1.15); }
export function sFiber() { if (ac) noise(ac.currentTime, 0.12, 2400, 2, 0.05); }
export function sThunder() {
  if (!ac) return; const t = ac.currentTime;
  noise(t, 0.25, 3000, 0.7, 0.18); noise(t + 0.05, 2.2, 120, 0.8, 0.5);
}
export function sWave(ride) {
  if (!ac) return; const t = ac.currentTime;
  const f = noise(t, 1.2, 500, 1.2, ride ? 0.25 : 0.1); f.frequency.exponentialRampToValueAtTime(2200, t + 1.0);
}
// おわり: 曲のおわり（池でのフレーズ → C△9）は setProgress の 'end' が鳴らす。ここは段の結果を小さく重ねる
export function sFinish(grade) {
  if (!ac) return; setProgress(1, 'end');
  const t = q16(), notes = grade === 4 ? [19, 24] : [16, 21];
  notes.forEach((p, i) => pluckTo(hz(p + 12), t + E8 * 4 + i * E8, 0.04, lay.fx, 1.6));
}
