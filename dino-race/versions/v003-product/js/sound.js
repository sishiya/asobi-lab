// 効果音: 音のファイルは使わず Web Audio で作る。SFX.play('go') のように鳴らす。
// オン／オフはブラウザに保存（SETTINGS_KEY）。ブラウザの決まりで、はじめて画面を押すまでは鳴らない（unlock）。

const SETTINGS_KEY = 'asobi-lab/dino-race/settings-v1';
const SFX = (() => {
  let ctx = null, master = null, on = true;
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (s && s.sound === false) on = false; } catch (e) { /* 読めなければ音あり */ }

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
  }
  addEventListener('pointerdown', unlock, {passive: true});
  addEventListener('keydown', unlock);

  // 1つの音: 周波数 f（終わりの周波数 f2）、長さ dur 秒、波の形、大きさ、鳴らしはじめ（いまから何秒後）
  function tone(f, dur, {type = 'triangle', vol = 1, at = 0, f2 = null, attack = 0.005} = {}) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // ざっという音（スタートの号砲など）
  function noise(dur, {vol = 1, at = 0, lp = 3000} = {}) {
    const t = ctx.currentTime + at, n = Math.round(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  const SOUNDS = {
    ready: () => tone(880, 0.12, {type: 'square', vol: 0.25}),                       // 位置について・よーい
    go: () => { noise(0.35, {vol: 0.9, lp: 2400}); tone(1320, 0.3, {type: 'square', vol: 0.22}); }, // ドン
    goal: () => { tone(1046.5, 0.18, {vol: 0.5}); tone(1568, 0.4, {vol: 0.5, at: 0.1}); },
    fall: () => { tone(160, 0.25, {type: 'sine', vol: 0.9, f2: 50}); noise(0.12, {vol: 0.4, lp: 600}); },
    hatch: () => [523, 659, 784].forEach((f, i) => tone(f, 0.16, {vol: 0.45, at: i * 0.07})),
    done: () => { tone(784, 0.14, {vol: 0.4}); tone(1175, 0.3, {vol: 0.4, at: 0.09}); },
    medal: () => {
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, 0.22, {vol: 0.5, at: i * 0.11}));
      [1046.5, 1318.5, 1568].forEach(f => tone(f, 0.9, {vol: 0.28, at: 0.5, attack: 0.02}));
    },
    ending: () => {
      [392, 523.3, 659.3, 784, 659.3, 784, 1046.5].forEach((f, i) => tone(f, 0.3, {vol: 0.45, at: i * 0.16}));
      [523.3, 659.3, 784, 1046.5].forEach(f => tone(f, 1.6, {vol: 0.22, at: 1.15, attack: 0.03}));
    },
  };

  return {
    play(name) {
      if (!on || !SOUNDS[name]) return;
      try { unlock(); if (ctx && ctx.state === 'running') SOUNDS[name](); } catch (e) { /* 音が出なくても遊べる */ }
    },
    get on() { return on; },
    set on(v) {
      on = !!v;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({sound: on})); } catch (e) { /* 保存できなくても */ }
    },
  };
})();
