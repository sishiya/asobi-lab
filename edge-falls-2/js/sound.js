'use strict';
// 音: WebAudio でその場で作る（音のファイルは使わない）。
//   BGM: おだやかで眠くなるような音。ハ長調の五音音階（ド・レ・ミ・ソ・ラ）だけを使うので、どの音が重なってもにごらない。
//        やわらかい正弦波の和音（ゆっくり息をするように大きさが揺れる）と、ときどき鳴るオルゴールのような音。高い音・強い音は使わない。
//   環境音: 果ての滝の音（さらさら〜ごうごう）。落ちる水が多いほど大きく、低く。
//   heaven-spheres の sound.js を下じきにした（BGM は同じ）。
//   効果音: Sound.play(名前)。BGM と効果音はべつべつに音の大きさ（0〜5。0 は鳴らさない）を決められ、localStorage に覚える（v023）。
//   曲（試験。v023）: 「深淵の子守歌」（これまでの BGM）・「星の水面」（ハープのような分散和音）・「霧の笛」（低い持続音と笛）。
//     どれも同じ五音音階の中だけ。切りかえると、前の曲はゆっくり消え、次の曲がゆっくり来る。
//   ページが見えなくなったら（タブを替える・アプリを閉じる）音を止める。

const Sound = (() => {
  const KEY = 'asobi-lab/edge-falls-2/sound';
  let pref = { bgm: true, sfx: true, bgmV: 3, sfxV: 3, track: 'lull' };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 覚えられなくても鳴らせる */ }
  if (!pref.v) { if (pref.bgm === false) pref.bgmV = 0; if (pref.sfx === false) pref.sfxV = 0; pref.v = 2; }   // オン・オフだけだったころの「オフ」は 0 に
  let ac = null, out = null, bgmBus = null, sfxBus = null, noiseBuf = null, rev = null;
  let waves = null, cur = null;
  const BGM_VOL = 0.32, SFX_VOL = 0.6;
  const LEVEL = [0, 0.22, 0.5, 1, 1.45, 1.95];   // 3 がこれまでの大きさ
  const lv = k => Math.max(0, Math.min(5, Math.round(pref[k + 'V']) || 0));
  const busVol = k => (k === 'bgm' ? BGM_VOL : SFX_VOL) * LEVEL[lv(k)];

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
    bgmBus = ac.createGain(); bgmBus.gain.value = busVol('bgm'); bgmBus.connect(out);
    sfxBus = ac.createGain(); sfxBus.gain.value = busVol('sfx'); sfxBus.connect(out);
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
    startWaves(); startTrack(pref.track);
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
  function setLevel(kind, v) {
    pref[kind + 'V'] = Math.max(0, Math.min(5, v | 0)); pref[kind] = pref[kind + 'V'] > 0; save();
    if (ac) (kind === 'bgm' ? bgmBus : sfxBus).gain.setTargetAtTime(busVol(kind), ac.currentTime, 0.15);
  }
  function set(kind, v) { setLevel(kind, v ? (lv(kind) || 3) : 0); }   // 古い呼び方（オン・オフ）

  // ---- 曲（v023）。どれも { g: 曲の大きさ, tick(t, paused), stop() } ----
  function trackOut() {
    const g = ac.createGain(); g.gain.value = 0.0001; g.connect(bgmBus);
    g.gain.setTargetAtTime(1, ac.currentTime, 1.2);   // ゆっくり来る
    return g;
  }
  function startTrack(name) {
    if (cur) {
      const old = cur, t = ac.currentTime;
      old.g.gain.cancelScheduledValues(t); old.g.gain.setTargetAtTime(0.0001, t, 0.9);   // 前の曲はゆっくり消える
      setTimeout(() => { try { old.stop(); old.g.disconnect(); } catch (e) { /* なし */ } }, 5000);
    }
    cur = (TRACKS[name] || TRACKS.lull).make();
  }
  function setTrack(name) { pref.track = TRACKS[name] ? name : 'lull'; save(); if (ac) startTrack(pref.track); }

  // 深淵の子守歌（これまでの BGM）
  //   パッド: 和音の各音に正弦波を2つ（ほんの少しずらして、ゆるやかなうなり）。低い通過フィルタでさらにやわらかく。ときどきオルゴール
  function makeLull() {
    const g = trackOut(), oscs = [], pad = [];
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.3;
    const pg = ac.createGain(); pg.gain.value = 0.07;
    lp.connect(pg); pg.connect(g); pg.connect(rev);
    for (let v = 0; v < 4; v++) {
      const vg = ac.createGain(); vg.gain.value = 0.22; vg.connect(lp);
      const os = [ac.createOscillator(), ac.createOscillator()];
      os.forEach((o, k) => { o.type = 'sine'; o.detune.value = k ? 4 : -4; o.frequency.value = st(CHORDS[0][v]); o.connect(vg); o.start(); oscs.push(o); });
      // 息をするようにゆっくり揺れる大きさ（8〜12 秒で1回）
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 0.08 + v * 0.013; lg.gain.value = 0.09; lfo.connect(lg); lg.connect(vg.gain); lfo.start(); oscs.push(lfo);
      pad.push({ os, vg });
    }
    let nextNote = ac.currentTime + 2, chordIx = 0, nextChord = ac.currentTime + 16;
    return {
      g, stop: () => oscs.forEach(o => o.stop()),
      tick(t, paused) {
        if (t >= nextChord) {                    // 16 秒ごとに次の和音へ、とてもゆっくり移る
          chordIx = (chordIx + 1) % CHORDS.length;
          pad.forEach((p, v) => p.os.forEach(o => o.frequency.setTargetAtTime(st(CHORDS[chordIx][v]), t, 3)));
          nextChord = t + 16;
        }
        if (t >= nextNote && !paused) {
          chime(st(melodyNote()), 0.035, t, g);
          if (Math.random() < 0.3) chime(st(melodyNote()), 0.025, t + 0.6, g);
          nextNote = t + 3.5 + Math.random() * 4;
        }
      },
    };
  }

  // 星の水面: 水面に星がうつるような、ハープの分散和音。のぼって少しおりる。低い音が遠くで支える
  const ARPS = [[-3, 4, 9, 12, 16], [0, 7, 12, 14, 16], [-5, 2, 7, 9, 14], [2, 9, 14, 16, 21]];
  function pluck(freq, vol, t, dest) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), gg = ac.createGain(), g2 = ac.createGain();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(600, t + 1.5);
    g2.gain.value = 0.18;
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(vol, t + 0.006); gg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(gg); gg.connect(dest); gg.connect(rev);
    o.start(t); o2.start(t); o.stop(t + 2.7); o2.stop(t + 2.7);
  }
  function makeHarp() {
    const g = trackOut();
    let next = ac.currentTime + 1.5, ix = 0;
    return {
      g, stop() { /* 鳴っている音はひとりでに消える */ },
      tick(t, paused) {
        if (t < next || paused) return;
        const a = ARPS[ix]; ix = (ix + (Math.random() < 0.7 ? 1 : 2)) % ARPS.length;
        const step = 0.36 + Math.random() * 0.1, seq = [0, 1, 2, 3, 4, 3, 2];
        if (Math.random() < 0.4) seq.push(4, 3);
        seq.forEach((n, k) => pluck(st(a[n] + 12), 0.05 - k * 0.002, t + k * step + Math.random() * 0.03, g));
        pluck(st(a[0] - 12), 0.035, t, g);       // 低い音
        next = t + seq.length * step + 2.2 + Math.random() * 3;
      },
    };
  }

  // 霧の笛: 低い五度の持続音（とてもうすい）に、息のまじった笛がゆっくり歌う。となりの音へ動くことが多い
  const FLUTE = [12, 14, 16, 19, 21, 24, 26, 28];
  function blow(freq, t, dur, dest) {
    const o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), gg = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    vib.frequency.value = 4.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(freq * 0.005, t + dur * 0.6);   // 音の終わりに向けて、ゆれ（ビブラート）
    vib.connect(vg); vg.connect(o.frequency);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.045, t + 0.28); gg.gain.setTargetAtTime(0.0001, t + dur, 0.35);
    o.connect(gg); gg.connect(dest); gg.connect(rev);
    const s = ac.createBufferSource(), bf = ac.createBiquadFilter(), bg = ac.createGain();   // 息の音
    s.buffer = noiseBuf; bf.type = 'bandpass'; bf.frequency.value = freq * 2; bf.Q.value = 6;
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.02, t + 0.1); bg.gain.setTargetAtTime(0.0001, t + 0.35, 0.3);
    s.connect(bf); bf.connect(bg); bg.connect(dest);
    const end = t + dur + 2;
    o.start(t); vib.start(t); s.start(t, Math.random()); o.stop(end); vib.stop(end); s.stop(end);
  }
  function makeFlute() {
    const g = trackOut(), oscs = [];
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const dg = ac.createGain(); dg.gain.value = 0.05; lp.connect(dg); dg.connect(g); dg.connect(rev);
    for (const [n, dt] of [[-12, -3], [-5, 3], [0, 0]]) {      // ド・ソ・ド の低い持続音
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = st(n); o.detune.value = dt;
      const og = ac.createGain(); og.gain.value = n === 0 ? 0.25 : 0.5; o.connect(og); og.connect(lp); o.start(); oscs.push(o);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.05 + oscs.length * 0.017; lg.gain.value = 0.2; lfo.connect(lg); lg.connect(og.gain); lfo.start(); oscs.push(lfo);
    }
    let next = ac.currentTime + 3, pos = 3;
    return {
      g, stop: () => oscs.forEach(o => o.stop()),
      tick(t, paused) {
        if (t < next || paused) return;
        let at = t; const n = 3 + ((Math.random() * 4) | 0);
        for (let k = 0; k < n; k++) {
          pos = Math.max(0, Math.min(FLUTE.length - 1, pos + [-2, -1, -1, 1, 1, 2][(Math.random() * 6) | 0]));
          const dur = k === n - 1 ? 2.2 + Math.random() : 0.8 + Math.random() * 1.2;
          blow(st(FLUTE[pos]), at, dur, g); at += dur + 0.12;
        }
        if (Math.random() < 0.5) pos = 3;
        next = at + 5 + Math.random() * 6;
      },
    };
  }
  const TRACKS = {
    lull: { name: TX('深淵の子守歌', 'Lullaby of the Abyss'), make: makeLull },
    harp: { name: TX('星の水面', 'Stars on the Water'), make: makeHarp },
    flute: { name: TX('霧の笛', 'Flute in the Mist'), make: makeFlute },
  };

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
    if (cur) cur.tick(t, paused);
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
    rumble: () => { noise(2.6, 70, 0.8, 0.16, 0, 'lowpass'); noise(1.8, 140, 1, 0.08, 0.6, 'lowpass'); },
    crack: () => { noise(0.25, 1800 + Math.random() * 1500, 2, 0.05); noise(0.6, 120, 1, 0.07, 0.05, 'lowpass'); },
    reveal: () => [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => bell(n + 7, 0.07, i * 0.35)),
    win: () => [0, 4, 7, 12, 16, 19].forEach((n, i) => bell(n + 12, 0.1, i * 0.22)),
  };
  function play(name) { if (ac && ac.state === 'running' && SFX[name]) SFX[name](); }

  return {
    play, update, set, setLevel, level: lv, setTrack, track: () => pref.track, tracks: Object.keys(TRACKS),
    trackName: k => (TRACKS[k] || TRACKS.lull).name, get: k => (k === 'bgm' || k === 'sfx' ? lv(k) > 0 : pref[k]), unlock,
  };
})();
