// sound.js — 音: Web Audio でその場で作る（音のファイルは使わない）。効果音 Sound.play(名前)、スプレーの音 Sound.setSpray(true/false)、
// 夜の台所の環境音 Sound.setAmbient(true/false)。オン・オフは localStorage に覚える。
// 虫が苦手な人への配慮: 虫がつぶれる音・鳴き声は出さない（道具と画面の音だけ）。
'use strict';

const Sound = (() => {
  const KEY = 'asobi-lab/resistance/sound';
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* 覚えられなくても鳴らせる */ }
  let ac = null, master = null, noiseBuf = null, spray = null, amb = null, ambWant = false;

  // 最初にさわったときに作る（ブラウザは、さわる前に音を出させない）
  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ambWant) setAmbient(true);
  }
  addEventListener('pointerdown', unlock, {capture: true});
  addEventListener('keydown', unlock, {capture: true});

  function setOn(v) {
    on = v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* なし */ }
    if (master) master.gain.setTargetAtTime(on ? 0.5 : 0, ac.currentTime, 0.05);
  }
  // 一時停止のあいだは全部の音を止める
  function suspend(v) { if (ac) { if (v) ac.suspend(); else ac.resume(); } }

  // 音ひとつ: 波の形・高さ（はじめ→おわり）・長さ・大きさ・遅れ
  function tone(type, f1, f2, dur, vol = 0.2, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq, q, vol = 0.2, delay = 0, type = 'bandpass') {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  const SFX = {
    click: () => tone('triangle', 660, 520, 0.07, 0.1),
    swing: () => noise(0.16, 900, 0.8, 0.07),                                      // スリッパを振る（ひゅっ）
    slap: () => { noise(0.07, 2200, 0.9, 0.28); tone('sine', 160, 90, 0.08, 0.14); },  // 床に当たる（ぱしっ。虫の音ではない）
    miss: () => noise(0.05, 1300, 1.5, 0.08),
    bait: () => { tone('sine', 520, 700, 0.08, 0.1); tone('sine', 880, 880, 0.06, 0.06, 0.07); },
    unbait: () => tone('sine', 700, 480, 0.1, 0.08),
    empty: () => tone('square', 200, 180, 0.12, 0.05),
    night: () => [392, 330, 262].forEach((f, i) => tone('sine', f, f, 0.5, 0.09, i * 0.18)),
    dawn: () => [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.35, 0.12, i * 0.1)),
    warn: () => { tone('square', 660, 660, 0.08, 0.05); tone('square', 520, 520, 0.12, 0.05, 0.1); },
    unlock: () => [659, 880, 1175].forEach((f, i) => tone('triangle', f, f, 0.18, 0.1, i * 0.08)),
    pick: () => { tone('triangle', 880, 880, 0.06, 0.1); tone('triangle', 1320, 1320, 0.1, 0.08, 0.05); },
    tick: () => tone('square', 1320, 1320, 0.04, 0.035),
    star: () => { tone('sine', 1568, 1568, 0.25, 0.11); tone('sine', 2093, 2093, 0.3, 0.05, 0.03); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.6 : 0.16, 0.16, i * 0.12)),
    lose: () => { tone('triangle', 392, 370, 0.25, 0.14); tone('triangle', 330, 311, 0.3, 0.14, 0.22); tone('triangle', 262, 220, 0.6, 0.14, 0.48); },
    wipe: () => [784, 988, 1175].forEach((f, i) => tone('triangle', f, f, 0.2, 0.12, i * 0.09)),
  };
  function play(name) { if (!ac || !on || !SFX[name]) return; try { SFX[name](); } catch (e) { /* 音で止めない */ } }

  // スプレー: 押している間のしゅーっという音
  function setSpray(v) {
    if (!ac) return;
    if (!spray) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = 3200; g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(master); s.start();
      spray = g;
    }
    spray.gain.setTargetAtTime(v && on ? 0.09 : 0, ac.currentTime, 0.03);
  }

  // 夜の台所: 冷蔵庫の低いうなり
  function setAmbient(v) {
    ambWant = v;
    if (!ac) return;
    if (!amb) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = 50; o2.type = 'sine'; o2.frequency.value = 100.6;
      f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
      amb = g;
    }
    amb.gain.setTargetAtTime(v ? 0.035 : 0, ac.currentTime, 0.6);
  }

  return {unlock, play, setSpray, setAmbient, suspend, get on() { return on; }, setOn};
})();
