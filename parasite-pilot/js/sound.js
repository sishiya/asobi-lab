'use strict';
// 音: WebAudio でその場で作る（音のファイルは使わない）。効果音 Sound.play(名前)、引っぱっている間のうなり Sound.setPull(0〜1)、
// 面ごとの環境音 Sound.setAmbient('snail' | 'mouse' | 'cricket' | null)。オン・オフは localStorage に覚える。

const Sound = (() => {
  const KEY = 'asobi-lab/parasite-pilot/sound';
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* 覚えられなくても鳴らせる */ }
  let ac = null, master = null, noiseBuf = null;
  let pull = null, amb = null, ambId = null, chirpT = 0;

  // 最初にさわったときに作る（ブラウザは、さわる前に音を出させない）
  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = on ? 0.55 : 0; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ambId) { const id = ambId; ambId = null; setAmbient(id); }
  }
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });

  function setOn(v) {
    on = v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* なし */ }
    if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.05);
  }

  // 音ひとつ: 波の形・高さ（はじめ→おわり）・長さ・大きさ・遅れ
  function tone(type, f1, f2, dur, vol = 0.2, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq, q, vol = 0.2, delay = 0) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  const SFX = {
    click: () => tone('triangle', 660, 520, 0.07, 0.12),
    start: () => { tone('triangle', 392, 392, 0.14, 0.18); tone('triangle', 587, 587, 0.22, 0.18, 0.12); },
    abilityOn: () => { tone('sine', 300, 700, 0.25, 0.16); tone('sine', 310, 720, 0.25, 0.08, 0.03); },
    abilityOff: () => tone('sine', 600, 280, 0.18, 0.12),
    alert: () => { tone('square', 880, 880, 0.07, 0.07); tone('square', 1175, 1175, 0.1, 0.07, 0.09); },
    toast: () => tone('sine', 740, 740, 0.08, 0.06),
    tired: () => tone('sawtooth', 220, 110, 0.4, 0.08),
    deny: () => tone('square', 180, 160, 0.12, 0.06),
    tick: () => tone('square', 1320, 1320, 0.04, 0.04),
    hop: () => noise(0.06, 2400, 3, 0.05),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.5 : 0.16, 0.18, i * 0.11)),
    lose: () => { tone('triangle', 392, 370, 0.25, 0.16); tone('triangle', 330, 311, 0.3, 0.16, 0.22); tone('triangle', 262, 220, 0.55, 0.16, 0.48); },
    star: () => { tone('sine', 1568, 1568, 0.25, 0.12); tone('sine', 2093, 2093, 0.3, 0.06, 0.03); },
    page: () => noise(0.09, 1800, 1.2, 0.05),
    ending: () => [392, 494, 587, 784, 740, 784, 988].forEach((f, i) => tone('triangle', f, f, i === 6 ? 0.9 : 0.24, 0.15, i * 0.2)),
  };
  function play(name) { if (!ac || !on || !SFX[name]) return; try { SFX[name](); } catch (e) { /* 音で止めない */ } }

  // 引っぱっている間の、低いうなり
  function setPull(v) {
    if (!ac) return;
    if (!pull) {
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = 92; lfo.frequency.value = 5; lg.gain.value = 4;
      lfo.connect(lg); lg.connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(master); o.start(); lfo.start();
      pull = g;
    }
    pull.gain.setTargetAtTime(on ? v * 0.05 : 0, ac.currentTime, 0.08);
  }

  // 環境音: 面ごとに、こすれる音（ノイズ）の色と、ときどき鳴く生きもの
  const AMB = {
    snail: { freq: 500, q: 0.4, vol: 0.018 },  // 昼の森の風
    mouse: { freq: 260, q: 0.6, vol: 0.016 },  // 夕方の納屋
    cricket: { freq: 900, q: 0.3, vol: 0.02 }, // 夜の川のせせらぎ
  };
  function setAmbient(id) {
    if (id === ambId) return;
    ambId = id;
    if (!ac) return;
    if (amb) { const old = amb; old.g.gain.setTargetAtTime(0, ac.currentTime, 0.3); setTimeout(() => { try { old.s.stop(); } catch (e) { /* なし */ } }, 1500); amb = null; }
    const a = AMB[id]; if (!a) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = a.freq; f.Q.value = a.q;
    g.gain.value = 0; g.gain.setTargetAtTime(a.vol, ac.currentTime, 0.5);
    s.connect(f); f.connect(g); g.connect(master); s.start();
    amb = { s, g }; chirpT = 1;
  }
  // ときどき鳴く声（ループから毎フレーム呼ぶ）
  function tick(dt) {
    if (!ac || !on || !amb || ac.state !== 'running') return;
    chirpT -= dt; if (chirpT > 0) return;
    if (ambId === 'snail') { // 遠くの小鳥
      const f = 2600 + Math.random() * 900; tone('sine', f, f * 1.25, 0.08, 0.025); tone('sine', f * 1.1, f * 0.9, 0.1, 0.02, 0.12);
      chirpT = 2 + Math.random() * 4;
    } else if (ambId === 'mouse') { // 風で納屋の板がきしむ音
      tone('triangle', 140 + Math.random() * 40, 120, 0.5, 0.015); chirpT = 4 + Math.random() * 5;
    } else if (ambId === 'cricket') { // 夜の虫
      for (let i = 0; i < 3; i++) tone('sine', 4200, 4200, 0.03, 0.015, i * 0.07);
      chirpT = 0.7 + Math.random() * 1.2;
    }
  }

  return { unlock, play, setPull, setAmbient, tick, get on() { return on; }, setOn };
})();
