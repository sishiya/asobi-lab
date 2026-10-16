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
    master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
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
  // ざっという音（土ぼこり・ひびの音など）。filter: lowpass / highpass / bandpass、freq: その周波数
  function noise(dur, {vol = 1, at = 0, lp = 3000, filter = 'lowpass', freq = null} = {}) {
    const t = ctx.currentTime + at, n = Math.max(1, Math.round(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = filter; f.frequency.value = freq || lp; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  // 楽器（v004: 矩形波をやめ、正弦波＋短い減衰＋少しの倍音で、木と金属の落ち着いた音に）
  // parts: [周波数の倍率, 大きさの割合, 長さの割合]
  function partials(f, dur, parts, {vol = 1, at = 0, attack = 0.003} = {}) {
    for (const [r, v, d] of parts) tone(f * r, dur * d, {type: 'sine', vol: vol * v, at, attack});
  }
  const mallet = (f, o = {}) => partials(f, o.dur || 0.42, [[1, 1, 1], [3.98, 0.22, 0.28], [9.9, 0.05, 0.1]], o);           // 木琴
  const box = (f, o = {}) => partials(f, o.dur || 0.9, [[1, 1, 1], [2, 0.3, 0.6], [3, 0.1, 0.4], [5.4, 0.04, 0.2]], {attack: 0.002, ...o}); // オルゴール
  const wood = (f, {vol = 1, at = 0} = {}) => {                                                                                 // ウッドブロック
    tone(f, 0.07, {type: 'sine', vol, at, attack: 0.001});
    tone(f * 2.7, 0.035, {type: 'sine', vol: vol * 0.3, at, attack: 0.001});
    noise(0.018, {vol: vol * 0.25, at, filter: 'bandpass', freq: f * 2});
  };

  const SOUNDS = {
    ready: () => wood(880, {vol: 0.8}),                                                // 位置について・よーい
    go: () => { wood(1320, {vol: 0.7}); tone(120, 0.28, {type: 'sine', vol: 0.6, f2: 70}); noise(0.22, {vol: 0.3, lp: 1500}); mallet(784, {vol: 0.5, at: 0.04}); mallet(1175, {vol: 0.45, at: 0.1}); }, // ドン
    goal: () => [784, 1046.5, 1568].forEach((f, i) => mallet(f, {vol: 0.55, at: i * 0.07})),
    fall: () => { tone(180, 0.32, {type: 'sine', vol: 0.8, f2: 60}); noise(0.18, {vol: 0.45, lp: 500}); mallet(196, {vol: 0.3, dur: 0.3}); },
    hatch: () => [659.3, 784, 1046.5].forEach((f, i) => box(f, {vol: 0.5, at: i * 0.09})),
    done: () => { mallet(784, {vol: 0.5}); mallet(1175, {vol: 0.5, at: 0.09}); },
    medal: () => {
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => box(f, {vol: 0.5, at: i * 0.12}));
      [1046.5, 1318.5, 1568].forEach(f => box(f, {vol: 0.3, at: 0.55, dur: 1.5}));
    },
    ending: () => {
      [392, 523.3, 659.3, 784, 659.3, 784, 1046.5].forEach((f, i) => box(f, {vol: 0.5, at: i * 0.18}));
      [523.3, 659.3, 784, 1046.5].forEach(f => box(f, {vol: 0.25, at: 1.3, dur: 2.2}));
    },
    crack: () => { noise(0.03, {vol: 0.55, filter: 'highpass', freq: 2500}); wood(2600, {vol: 0.22}); noise(0.02, {vol: 0.3, at: 0.06, filter: 'highpass', freq: 3200}); }, // 卵にひび
    record: () => { [659.3, 880, 1174.7].forEach((f, i) => mallet(f, {vol: 0.45, at: i * 0.06, dur: 0.3})); box(1760, {vol: 0.22, at: 0.2, dur: 0.6}); }, // 記録更新
    stamp: () => { tone(260, 0.13, {type: 'sine', vol: 0.7, f2: 140, at: 0.04}); noise(0.04, {vol: 0.3, lp: 900, at: 0.04}); wood(520, {vol: 0.2, at: 0.04}); }, // 判子のぽん
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
