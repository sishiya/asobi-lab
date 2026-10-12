'use strict';
// 音: WebAudio でその場で作る（音のファイルは使わない）。
//   BGM: おだやかで眠くなるような音。ハ長調の五音音階（ド・レ・ミ・ソ・ラ）だけを使うので、どの音が重なってもにごらない。
//        やわらかい正弦波の和音（ゆっくり息をするように大きさが揺れる）と、ときどき鳴るオルゴールのような音。高い音・強い音は使わない。
//   環境音: 果ての滝の音（さらさら〜ごうごう）。落ちる水が多いほど大きく、低く。
//   heaven-spheres の sound.js を下じきにした（BGM は同じ）。
//   効果音: Sound.play(名前)。BGM と効果音はべつべつにオン・オフでき、localStorage に覚える。
//   ページが見えなくなったら（タブを替える・アプリを閉じる）音を止める。

const Sound = (() => {
  const KEY = 'asobi-lab/edge-falls/sound';
  let pref = { bgm: true, sfx: true };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 覚えられなくても鳴らせる */ }
  let ac = null, out = null, bgmBus = null, sfxBus = null, noiseBuf = null, rev = null;
  let pad = [], waves = null, nextNote = 0, chordIx = 0, nextChord = 0;
  const BGM_VOL = 0.32, SFX_VOL = 0.6;

  // ハ長調の五音音階。基準は C3（130.81Hz）。和音はゆっくり4つを回る（Cadd9・Am7・Fmaj7 ふう・G6sus ふう、五音音階の中だけで）
  const ROOT = 130.81;
  const st = n => ROOT * Math.pow(2, n / 12);
  const CHORDS = [[0, 7, 14, 16], [-3, 4, 7, 12], [-7, 0, 9, 16], [-5, 2, 9, 14]];
  const PENTA = [0, 2, 4, 7, 9];
  const melodyNote = () => { const o = Math.random() < 0.7 ? 12 : 24; return PENTA[(Math.random() * 5) | 0] + o; };

  function unlock() {
    if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    out = ac.createDynamicsCompressor(); out.connect(ac.destination);
    bgmBus = ac.createGain(); bgmBus.gain.value = pref.bgm ? BGM_VOL : 0; bgmBus.connect(out);
    sfxBus = ac.createGain(); sfxBus.gain.value = pref.sfx ? SFX_VOL : 0; sfxBus.connect(out);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 残響（作った響き）。長めにして、遠くで鳴っているように
    rev = ac.createConvolver();
    const len = ac.sampleRate * 4, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    rev.buffer = ir;
    const rlp = ac.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 2500;
    const rg = ac.createGain(); rg.gain.value = 0.45; rev.connect(rlp); rlp.connect(rg); rg.connect(bgmBus);
    startPad(); startWaves();
    nextNote = ac.currentTime + 2; nextChord = ac.currentTime + 16;
  }
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  // 見えないあいだは音を止める
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });
  addEventListener('pagehide', () => { if (ac) ac.suspend(); });

  function save() { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* なし */ } }
  function set(kind, v) {
    pref[kind] = v; save();
    if (!ac) return;
    (kind === 'bgm' ? bgmBus : sfxBus).gain.setTargetAtTime(v ? (kind === 'bgm' ? BGM_VOL : SFX_VOL) : 0, ac.currentTime, 0.4);
  }

  // パッド: 和音の各音に正弦波を2つ（ほんの少しずらして、ゆるやかなうなり）。低い通過フィルタでさらにやわらかく
  function startPad() {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.3;
    const g = ac.createGain(); g.gain.value = 0.07;
    lp.connect(g); g.connect(bgmBus); g.connect(rev);
    for (let v = 0; v < 4; v++) {
      const vg = ac.createGain(); vg.gain.value = 0.22; vg.connect(lp);
      const os = [ac.createOscillator(), ac.createOscillator()];
      os.forEach((o, k) => { o.type = 'sine'; o.detune.value = k ? 4 : -4; o.frequency.value = st(CHORDS[0][v]); o.connect(vg); o.start(); });
      // 息をするようにゆっくり揺れる大きさ（8〜12 秒で1回）
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 0.08 + v * 0.013; lg.gain.value = 0.09; lfo.connect(lg); lg.connect(vg.gain); lfo.start();
      pad.push({ os, vg });
    }
    pad.lp = lp;
  }

  function startWaves() {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.5;
    const g = ac.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    waves = { f, g };
  }

  // オルゴールのような音: 正弦波と、そのオクターブ上を少し。立ち上がりをやわらかく
  function chime(freq, vol, t, bus) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
    o.type = 'sine'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2;
    g2.gain.value = 0.12;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus || bgmBus); g.connect(rev);
    o.start(t); o2.start(t); o.stop(t + 3.1); o2.stop(t + 3.1);
  }

  // 毎フレーム: 滝に落ちる水の量（/秒）、止まっているか
  // near: 寄っているほど 1（引いて見ているときは滝の音を出さない。2026-10-12 ユーザー「騒がしいので近づいたときだけ」）
  function update(fall, paused, near = 0) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    if (t >= nextChord) {                    // 16 秒ごとに次の和音へ、とてもゆっくり移る
      chordIx = (chordIx + 1) % CHORDS.length;
      pad.forEach((p, v) => p.os.forEach(o => o.frequency.setTargetAtTime(st(CHORDS[chordIx][v]), t, 3)));
      nextChord = t + 16;
    }
    if (t >= nextNote && !paused) {
      chime(st(melodyNote()), 0.035, t);
      if (Math.random() < 0.3) chime(st(melodyNote()), 0.025, t + 0.6);
      nextNote = t + 3.5 + Math.random() * 4;
    }
    const w = paused ? 0 : near * Math.min(1, 0.15 + fall / 12);
    waves.g.gain.setTargetAtTime(w * 0.14, t, 0.8);
    waves.f.frequency.setTargetAtTime(700 - Math.min(1, fall / 15) * 350, t, 0.8);   // 低めのやわらかい水音
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
  const bell = (n, vol, dt) => chime(st(n), vol, ac.currentTime + dt, sfxBus);

  // 効果音（heaven-spheres と同じ手ざわり）。鐘は BGM と同じ五音音階に合わせる
  const SFX = {
    click: () => tone('triangle', 784, 660, 0.08, 0.08),
    grab: () => { tone('sine', 220, 330, 0.25, 0.08); noise(0.2, 900, 2, 0.03); },
    release: () => tone('sine', 330, 247, 0.3, 0.06),
    pin: () => { tone('triangle', 523, 523, 0.12, 0.08); tone('triangle', 392, 392, 0.2, 0.06, 0.08); },
    soil: () => noise(0.12, 300 + Math.random() * 200, 1.5, 0.05),
    sow: () => noise(0.18, 2400 + Math.random() * 800, 3, 0.03),
    spring: () => { bell(19, 0.07, 0); bell(26, 0.05, 0.25); },
    put: () => { bell(24, 0.06, 0); bell(28, 0.04, 0.12); },
    no: () => tone('sine', 220, 196, 0.2, 0.06),
    splash: () => noise(0.5, 700, 1, 0.05),
    extinct: () => { tone('sine', 294, 196, 1.2, 0.08); },
    win: () => [0, 4, 7, 12, 16, 19].forEach((n, i) => bell(n + 12, 0.1, i * 0.22)),
  };
  function play(name) { if (ac && ac.state === 'running' && SFX[name]) SFX[name](); }

  return { play, update, set, get: k => pref[k], unlock };
})();
