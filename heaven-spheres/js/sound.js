'use strict';
// 音: WebAudio でその場で作る（音のファイルは使わない）。
//   BGM: 天球の音楽。ゆっくりした和音のうなり（パッド）と、ときどき鳴る鐘のような音。調は昔の旋法ふう（ドリア）。
//        月と太陽の天球の回る速さで、パッドの明るさと鐘の数が少し変わる。
//   環境音: 波の音。潮の流れが速いほど大きく、津波のときは低い鳴り。
//   効果音: Sound.play(名前)。オン・オフは BGM と効果音べつべつに localStorage に覚える。

const Sound = (() => {
  const KEY = 'asobi-lab/heaven-spheres/sound';
  let pref = { bgm: true, sfx: true };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 覚えられなくても鳴らせる */ }
  let ac = null, out = null, bgmBus = null, sfxBus = null, noiseBuf = null, rev = null;
  let pad = [], waves = null, nextBell = 0, chordIx = 0, nextChord = 0;

  // D ドリアの音（Hz）。和音は 4 つを順にゆっくり
  const ROOT = 146.83;
  const st = n => ROOT * Math.pow(2, n / 12);
  const CHORDS = [[0, 7, 14, 17], [-2, 5, 12, 17], [3, 10, 15, 19], [-5, 2, 10, 14]];
  const SCALE = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19];

  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    out = ac.createDynamicsCompressor(); out.connect(ac.destination);
    bgmBus = ac.createGain(); bgmBus.gain.value = pref.bgm ? 0.5 : 0; bgmBus.connect(out);
    sfxBus = ac.createGain(); sfxBus.gain.value = pref.sfx ? 0.6 : 0; sfxBus.connect(out);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 残響（作った響き）: 鐘とパッドを広く
    rev = ac.createConvolver();
    const len = ac.sampleRate * 3.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir;
    const rg = ac.createGain(); rg.gain.value = 0.35; rev.connect(rg); rg.connect(bgmBus);
    startPad(); startWaves();
    nextBell = ac.currentTime + 1.5; nextChord = ac.currentTime;
  }
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });

  function save() { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* なし */ } }
  function set(kind, v) {
    pref[kind] = v; save();
    if (!ac) return;
    (kind === 'bgm' ? bgmBus : sfxBus).gain.setTargetAtTime(v ? (kind === 'bgm' ? 0.5 : 0.6) : 0, ac.currentTime, 0.3);
  }

  // パッド: 和音の各音に、少しずらした2つの波。低い通過フィルタでやわらかく
  function startPad() {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    const g = ac.createGain(); g.gain.value = 0.09;
    lp.connect(g); g.connect(bgmBus); g.connect(rev);
    for (let v = 0; v < 4; v++) {
      const vg = ac.createGain(); vg.gain.value = 0.25; vg.connect(lp);
      const os = [ac.createOscillator(), ac.createOscillator()];
      os[0].type = 'sine'; os[1].type = 'triangle'; os[1].detune.value = 7;
      os.forEach(o => { o.frequency.value = st(CHORDS[0][v]); o.connect(vg); o.start(); });
      // ゆっくり揺れる大きさ
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 0.05 + v * 0.017; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(vg.gain); lfo.start();
      pad.push({ os, vg });
    }
    pad.lp = lp;
  }

  function startWaves() {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ac.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    waves = { f, g };
  }

  function bell(freq, vol, t) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.76;   // 鐘らしい倍音
    const g2 = ac.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bgmBus); g.connect(rev);
    o.start(t); o2.start(t); o.stop(t + 3.6); o2.stop(t + 3.6);
  }

  // 毎フレーム: 天球の速さ（ふつう＝1）、潮の流れの速さ、潮の大きさ、止まっているか
  function update(spin, flow, spring, paused) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    if (t >= nextChord) {                    // 12 秒ごとに次の和音へ、ゆっくり移る
      chordIx = (chordIx + 1) % CHORDS.length;
      pad.forEach((p, v) => p.os.forEach(o => o.frequency.setTargetAtTime(st(CHORDS[chordIx][v]), t, 1.8)));
      nextChord = t + 12;
    }
    pad.lp.frequency.setTargetAtTime(700 + Math.min(1600, spin * 220) + spring * 300, t, 0.6);
    if (t >= nextBell && !paused) {
      const chord = CHORDS[chordIx];
      const n = SCALE[(Math.random() * SCALE.length) | 0] + 12;
      bell(st(Math.random() < 0.5 ? n : chord[(Math.random() * 4) | 0] + 12), 0.06, t);
      nextBell = t + Math.max(0.6, (2.6 + Math.random() * 2.4) / Math.min(3, Math.max(1, spin * 0.6)));
    }
    const w = paused ? 0 : Math.min(1, 0.12 + flow / 140);
    waves.g.gain.setTargetAtTime(w * 0.35, t, 0.4);
    waves.f.frequency.setTargetAtTime(flow > 110 ? 260 : 380 + flow * 4, t, 0.3);
  }

  function tone(type, f1, f2, dur, vol, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, freq, q, vol, delay = 0, type = 'bandpass') {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const SFX = {
    click: () => tone('triangle', 784, 660, 0.08, 0.08),
    grab: () => { tone('sine', 220, 330, 0.25, 0.08); noise(0.2, 900, 2, 0.03); },
    release: () => tone('sine', 330, 247, 0.3, 0.06),
    soil: () => noise(0.12, 300 + Math.random() * 200, 1.5, 0.05),
    spring: () => { bell(st(19), 0.07, ac.currentTime); bell(st(26), 0.05, ac.currentTime + 0.25); },
    tsunami: () => { noise(2.2, 120, 0.8, 0.4, 0, 'lowpass'); tone('sine', 70, 45, 2, 0.18); },
    lander: () => [0, 7, 12, 19].forEach((n, i) => bell(st(n + 12), 0.08, ac.currentTime + i * 0.18)),
    win: () => [0, 3, 7, 10, 12, 19].forEach((n, i) => bell(st(n + 12), 0.1, ac.currentTime + i * 0.22)),
    lose: () => { tone('sine', 294, 196, 1.2, 0.1); tone('sine', 220, 147, 1.4, 0.07, 0.3); },
  };
  function play(name) { if (ac && ac.state === 'running' && SFX[name]) SFX[name](); }

  return { play, update, set, get: k => pref[k], unlock };
})();
