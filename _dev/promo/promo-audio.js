// 紹介動画の音（promo.js から分けた。2026-10-12、promo.js が 800 行をこえたため）。台本ページで promo.js のあとに読みこむ。
// しし屋の音の目印・ライオンのしゃべり・BGM の合成・音量そろえ。

// 音の目印「ぽろろろんっ」: ハープ／カリンバのような音で、ド・ミ・ソ・ド と速く上がり（ぽろろろ）、ソ＋ドで止まる（んっ）
// 心地よさのために: 音の高さは 260〜800 Hz（高いほど耳ざわりになる）、倍音は短く（長い倍音は耳ざわり）、
// 2.5 kHz より上は切る（2〜4 kHz は耳がいちばん敏感で、耳ざわりのもと）。立ち上がりは 8 ミリ秒でやわらかく
function identJingle(ctx, out, t0) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500; lp.Q.value = 0.5; lp.connect(out);
  const C4 = 261.63, hz = s => C4 * Math.pow(2, s / 12);
  const pluck = (t, s, v, len, pan) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(lp);
    for (const [m, gv, dl] of [[1, 1, len], [2, 0.35, 0.12], [3, 0.12, 0.06]]) {   // 倍音ほど早く消える
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(s) * m;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * gv, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dl);
      o.connect(g); g.connect(p); o.start(t); o.stop(t + dl + 0.05);
    }
  };
  const s0 = t0 + 0.7;   // 本編が閉じてから
  [[0, 0], [4, 0.07], [7, 0.14], [12, 0.21]].forEach(([s, dt], i) => pluck(s0 + 0.05 + dt, s, 0.32, 0.9, -0.3 + i * 0.2));   // ぽろろろ
  pluck(s0 + 0.42, 7, 0.36, 1.8, -0.1); pluck(s0 + 0.43, 12, 0.3, 1.8, 0.15); pluck(s0 + 0.44, -12, 0.25, 1.6, 0);          // んっ
}

// 案内役のライオンの「しゃべり」（声の代わりの合成音）。cue = { t, type: 'babble', n: 音の数, seed, voice }
// 1音ずつの有り無し・大きさ・高さを決まった乱数で決めるので、口の動き（babbleMouth）と音がぴったり合う
// 声の種類 BABBLE_VOICES（2026-10-10 に見くらべ用に5つ。_dev/promo/babble-test.html）。どれもここで合成した音で、録音した声は使わない
// 心地よさのために: 音の高さはだいたい 200〜900 Hz、2.2 kHz より上は切る、立ち上がりはやわらかく（目印の音と同じ考え）
const BABBLE_RATE = 7.5;   // ぽこぽこ の 1秒あたりの音の数（声ごとの速さは BABBLE_VOICES の rate）
const hash01 = (s, i) => { const x = Math.sin(s * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
const env = (ctx, t, a, peak, d) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + a + d); return g; };
const BABBLE_VOICES = {
  // A ぽこぽこ: やわらかい三角波が少し下がる（最初の版）
  poko: { name: 'ぽこぽこ', rate: 7.5, gap: 0.13, sound(ctx, out, t, s) {
    const f = 330 * Math.pow(2, s.semi / 12), o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.09);
    const g = env(ctx, t, 0.012, 0.16 * s.amp, 0.1); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.13);
  } },
  // B ぴよぴよ: 高めの短い音が上へ跳ねる（小鳥のよう）
  piyo: { name: 'ぴよぴよ', rate: 9, gap: 0.15, sound(ctx, out, t, s) {
    const f = 600 * Math.pow(2, s.semi / 12), o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.05);
    const g = env(ctx, t, 0.008, 0.15 * s.amp, 0.07); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
  } },
  // C もごもご（標準。2026-10-10 にユーザーが選んだ）: のこぎり波を「あ・い・う・え・お」の響き（2つの山）に通す。ことばっぽいけれど意味はない
  mogo: { name: 'もごもご', rate: 8.5, gap: 0.12, sound(ctx, out, t, s, k, c) {
    const V = [[800, 1200], [320, 2000], [350, 900], [500, 1750], [450, 800]][Math.floor(hash01(c.seed + 11, k) * 5)];
    const f = 200 * Math.pow(2, s.semi / 24), o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.04, t); o.frequency.linearRampToValueAtTime(f * 0.97, t + 0.1);
    const g = env(ctx, t, 0.015, 0.5 * s.amp, 0.1);
    for (const [fq, q, v] of [[V[0], 5, 1], [V[1], 7, 0.5]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
      const gv = ctx.createGain(); gv.gain.value = v; o.connect(bp); bp.connect(gv); gv.connect(g);
    }
    g.connect(out); o.start(t); o.stop(t + 0.14);
  } },
  // D ぽんぽん: 木琴のような音。ド・レ・ミ・ソ・ラ（五音）だけなので、何を言っても調子はずれにならない
  pon: { name: 'ぽんぽん', rate: 6.5, gap: 0.1, sound(ctx, out, t, s, k, c) {
    const f = 294 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14][Math.floor(hash01(c.seed + 5, k) * 7)] / 12);
    for (const [m, v, d] of [[1, 0.14, 0.25], [3.9, 0.03, 0.03]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const g = env(ctx, t, 0.005, v * s.amp, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    }
  } },
  // E ピピピ: 文字が1字ずつ出るときの昔のゲームのような短い電子音（高さは一定）
  pipi: { name: 'ピピピ', rate: 13, gap: 0.05, sound(ctx, out, t, s, k, c) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 440 * Math.pow(2, ((c.seed % 3) - 1) / 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.004);
    g.gain.setValueAtTime(0.045, t + 0.035); g.gain.linearRampToValueAtTime(0, t + 0.045);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06);
  } },
};
const babbleVoice = c => BABBLE_VOICES[c.voice] || BABBLE_VOICES.mogo;   // 省くと標準の もごもご
function babbleSyl(c, k) {
  const r = hash01(c.seed || 1, k), v = babbleVoice(c);
  return { on: r > v.gap && (k + 1) % 9 !== 0, amp: 0.55 + 0.45 * hash01(c.seed + 7, k), semi: Math.round(hash01(c.seed + 3, k) * 7) - 2 };
}
// その時刻の口の開き（0〜1）
function babbleMouth(cues, t) {
  for (const c of cues) {
    if (c.type !== 'babble' || t < c.t) continue;
    const rate = babbleVoice(c).rate, u = (t - c.t) * rate, k = Math.floor(u);
    if (k >= c.n) continue;
    const s = babbleSyl(c, k); if (!s.on) return 0;
    return Math.pow(Math.sin(Math.PI * (u - k)), 0.6) * s.amp * (rate > 11 ? 0.6 : 1);
  }
  return 0;
}
function babbleSound(ctx, out, c) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(out);
  const v = babbleVoice(c);
  for (let k = 0; k < c.n; k++) { const s = babbleSyl(c, k); if (s.on) v.sound(ctx, lp, c.t + k / v.rate, s, k, c); }
}

// ---- 音（ブラウザで合成。著作権の心配なし）----
// music = { style, root, cues, quiet }
//   style 'drone'   : 低い持続音（暗い・宇宙。root は低い音の Hz、既定 55）
//   style 'journey' : 明るい和音＋アルペジオ（旅・歴史。root は和音のいちばん下の Hz、既定 130.8 = ド）
//   cues  [{ t, type: 'boom' }] : その時刻に低い「ドン」
//         [{ t, type: 'babble', n, seed }] : 案内役のライオンのしゃべり（babbleSound）
//   quiet [[a, b]]             : その間はアルペジオを止め、和音を暗くする
async function makeAudio(dur, music = {}) {
  // BGM と、声・目印の音を別々に書き出す（4ch: 0-1 が BGM、2-3 が声など）。あとで BGM だけ音量をそろえて混ぜる（loudMix）
  const ctx = new OfflineAudioContext(4, SR * dur, SR);
  ctx.destination.channelInterpretation = 'discrete';
  const merger = ctx.createChannelMerger(4); merger.connect(ctx.destination);
  const stem = ch => {
    const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = 'explicit'; g.channelInterpretation = 'speakers';
    const sp = ctx.createChannelSplitter(2); g.connect(sp); sp.connect(merger, 0, ch); sp.connect(merger, 1, ch + 1);
    return g;
  };
  const bgmOut = stem(0), voiceOut = stem(2);
  const master = ctx.createGain(); master.connect(bgmOut);
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.22, 3);
  const stop = music.stopAt ?? dur;   // stopAt: 本編の終わり。ここで BGM を消す（締めの画面は目印の音だけ）
  master.gain.setValueAtTime(0.22, Math.max(3, stop - (music.stopAt ? 1 : 4)));
  master.gain.linearRampToValueAtTime(0, music.stopAt ? stop + 0.3 : dur - 0.2);
  // 残響（減衰する雑音をたたみこむ）
  const ir = ctx.createBuffer(2, SR * 2.5, SR);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
  const verb = ctx.createConvolver(); verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.5; verb.connect(wet); wet.connect(master);
  const bus = ctx.createGain(); bus.connect(master); bus.connect(verb);
  const noise = ctx.createBuffer(1, SR * 2, SR), nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const quiet = music.quiet || [], isQuiet = t => quiet.some(([a, b]) => t >= a && t < b);

  // しし屋の音の目印（cues の type: 'jingle'）。BGM の音量の山とは別に鳴らす（下の identJingle）
  const jbus = ctx.createGain(); jbus.gain.value = 0.35; jbus.connect(voiceOut);
  const jverb = ctx.createConvolver(); jverb.buffer = ir; const jwet = ctx.createGain(); jwet.gain.value = 0.35;   // BGM を消しても響きは残す
  jbus.connect(jverb); jverb.connect(jwet); jwet.connect(voiceOut);
  for (const c of music.cues || []) if (c.type === 'jingle') identJingle(ctx, jbus, c.t, c.kind);
  for (const c of music.cues || []) if (c.type === 'babble') babbleSound(ctx, jbus, c);   // 案内役のしゃべり（BGM の音量とは別）
  if (music.extra) await music.extra(ctx, voiceOut);   // 台本ごとの音（ピアノを弾く手のピアノの音など。BGM の音量とは別）
  for (const c of music.cues || []) if (SFX_CUES[c.type]) SFX_CUES[c.type](ctx, jbus, c.t, noise);   // 効果音（あそびラボ。BGM の音量とは別）
  if (music.style === 'none') {
    // BGM なし（目印の音だけ）
  } else if (music.style === 'romp') {
    rompMusic(ctx, bus, music, dur, noise, isQuiet);
  } else if ((music.style || 'drone') === 'drone') {
    const root = music.root || 55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7; lp.connect(bus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 500; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    // 根音・5度・オクターブを少しずらして重ね、左右に分ける
    [[1, -0.6], [1.005, 0.6], [1.498, -0.3], [1.503, 0.3], [2, 0.5], [2.007, -0.5], [2.996, 0]].forEach(([m, pan], i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = root * m;
      const gg = ctx.createGain(); gg.gain.value = m < 1.1 ? 0.5 : 0.22;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      o.connect(gg); gg.connect(p); p.connect(lp); o.start();
    });
    // 遠い風のような雑音
    const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    ns.connect(bp); bp.connect(ng); ng.connect(master); ns.start();
  } else {
    const root = music.root || 130.81, hz = s => root * Math.pow(2, s / 12);
    // ド→ラ→ファ→ソ（I–vi–IV–V）。暗い所はラ→ミ（vi–iii）
    const PROG = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], DARK = [[-3, 0, 3], [-8, -5, -1]];
    const beat = 60 / 84, bar = beat * 4, chordLen = bar * 2;
    const pad = ctx.createBiquadFilter(); pad.type = 'lowpass'; pad.frequency.value = 1100; pad.connect(bus);
    for (let k = 0, t = 0; t < dur; k++, t += chordLen) {
      const dark = isQuiet(t + chordLen / 2), ch = dark ? DARK[k % 2] : PROG[k % 4];
      // 和音（ゆっくりふくらむパッド）。いちばん下にオクターブ下の根音
      [...ch, ch[0] - 12].forEach((s, i) => {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(s); o.detune.value = det;
          const g = ctx.createGain(), v = (i === 3 ? 0.10 : 0.05) * (dark ? 0.8 : 1);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1.2);
          g.gain.setValueAtTime(v, t + chordLen - 0.4); g.gain.linearRampToValueAtTime(0, t + chordLen + 0.8);
          const p = ctx.createStereoPanner(); p.pan.value = det < 0 ? -0.4 : 0.4;
          o.connect(g); g.connect(p); p.connect(pad); o.start(t); o.stop(t + chordLen + 1);
        }
      });
      // アルペジオ（8分音符。和音の音を1オクターブ上で上下に）
      const pat = [0, 1, 2, 1, 0, 1, 2, 3];
      for (let n = 0; n < 16; n++) {
        const tn = t + n * beat / 2;
        if (tn >= dur - 3 || tn < 2.5 || isQuiet(tn)) continue;
        const s = pat[n % 8] === 3 ? ch[0] + 12 : ch[pat[n % 8]];
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(s + 12);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, tn); g.gain.linearRampToValueAtTime(0.09, tn + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, tn + 0.9);
        const p = ctx.createStereoPanner(); p.pan.value = (n % 2 ? 0.3 : -0.3);
        o.connect(g); g.connect(p); p.connect(bus); o.start(tn); o.stop(tn + 1);
      }
    }
  }
  // 「ドン」: 下がっていく低い音＋こもった雑音
  for (const c of music.cues || []) {
    if (c.type !== 'boom') continue;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, c.t); o.frequency.exponentialRampToValueAtTime(28, c.t + 2.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, c.t); g.gain.linearRampToValueAtTime(1.6, c.t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, c.t + 3.5);
    o.connect(g); g.connect(bus); o.start(c.t); o.stop(c.t + 3.6);
    const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, c.t); lp.frequency.exponentialRampToValueAtTime(120, c.t + 3);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0, c.t); ng.gain.linearRampToValueAtTime(0.9, c.t + 0.05); ng.gain.exponentialRampToValueAtTime(0.001, c.t + 4);
    ns.connect(lp); lp.connect(ng); ng.connect(bus); ns.start(c.t); ns.stop(c.t + 4.1);
  }
  return loudMix(await ctx.startRendering(), music.style !== 'none');
}

// ---- あそびラボの楽しげな BGM 'romp' と効果音（2026-10-19 ユーザー「BGM もたのしげなのがいいね」。あそびラボだけ。まなびラボの promo-audio.js にはない）----
// 'romp': 128 BPM の弾むリズム（キック・手びょうし・ハイハット）＋はねるベース＋ピコピコの旋律（8小節をくり返す）。
//   music.root は旋律のド（既定 261.6 Hz）。music.light: 説明動画用（旋律を小さく、16小節のうち後ろ8小節だけ。ライオンのしゃべりをじゃましない）
//   music.quiet の間は旋律とドラムを止め、和音だけにする
function rompMusic(ctx, bus, music, dur, noise, isQuiet) {
  const root = music.root || 261.63, hz = s => root * Math.pow(2, s / 12), light = !!music.light;
  const beat = 60 / 128, bar = beat * 4, e8 = beat / 2;
  const CH = [0, -3, 5, 7, 0, 5, 7, 0];   // ド・ラ・ファ・ソ・ド・ファ・ソ・ド（小節ごとの和音の根音）
  const MIN = new Set([1]);               // 2小節目はラの短和音
  const MEL = [[0, 4, 7, 4, 9, 7, 4, null], [0, null, 9, 7, 4, null, 2, null], [5, 9, 12, 9, 14, 12, 9, null], [7, null, 11, 14, 12, 11, 7, null],
    [0, 4, 7, 12, 11, 12, 7, null], [9, null, 5, 9, 12, null, 9, null], [11, null, 7, 11, 14, 12, 11, 7], [12, null, null, null, 7, null, 0, null]];
  const mk = (type, f, t, len, v, out, pan = 0, attack = 0.005) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    const p = ctx.createStereoPanner(); p.pan.value = pan; o.connect(g); g.connect(p); p.connect(out); o.start(t); o.stop(t + len + 0.05);
  };
  const noiseHit = (t, len, v, type, f, out) => {
    const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + len + 0.02);
  };
  const lead = ctx.createBiquadFilter(); lead.type = 'lowpass'; lead.frequency.value = 3200; lead.connect(bus);
  const bass = ctx.createBiquadFilter(); bass.type = 'lowpass'; bass.frequency.value = 700; bass.connect(bus);
  const drums = ctx.createGain(); drums.gain.value = light ? 0.6 : 1; drums.connect(bus);
  for (let k = 0, t = 0; t < dur; k++, t += bar) {
    const i = k % 8, r = CH[i], quiet = isQuiet(t + bar / 2);
    const chord = MIN.has(i) ? [r, r + 3, r + 7] : [r, r + 4, r + 7];
    // 和音（短く刻む。2拍目と4拍目のうら）
    for (const off of [1.5, 3.5]) for (const s of chord) mk('triangle', hz(s), t + off * beat, 0.22, 0.03, bus, 0.2);
    if (quiet) { for (const s of chord) mk('sine', hz(s - 12), t, bar, 0.05, bus, 0, 0.3); continue; }
    // ベース（8分で根音とオクターブをはねる）
    for (let n = 0; n < 8; n++) mk('square', hz(r - 24 + (n % 2 ? 12 : 0)), t + n * e8, 0.18, 0.07, bass);
    // ドラム: キック 1・3拍（4小節目は 4拍のうらも）、手びょうし 2・4拍、ハイハット 8分のうら
    for (const b of [0, 2, ...(i % 4 === 3 ? [3.5] : [])]) {
      const tb = t + b * beat, o = ctx.createOscillator(); o.frequency.setValueAtTime(150, tb); o.frequency.exponentialRampToValueAtTime(45, tb + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, tb); g.gain.exponentialRampToValueAtTime(0.001, tb + 0.25);
      o.connect(g); g.connect(drums); o.start(tb); o.stop(tb + 0.3);
    }
    for (const b of [1, 3]) noiseHit(t + b * beat, 0.14, 0.25, 'bandpass', 1500, drums);
    for (let n = 1; n < 8; n += 2) noiseHit(t + n * e8, 0.05, 0.12, 'highpass', 7000, drums);
    // 旋律（ピコピコ。説明動画は 16小節のうち後ろ 8小節だけ、小さく）
    if (t < 2 || (light && Math.floor(k / 8) % 2 === 0)) continue;
    MEL[i].forEach((s, n) => { if (s != null) mk('square', hz(s + 12), t + n * e8, 0.2, light ? 0.022 : 0.04, lead, n % 2 ? 0.25 : -0.25); });
  }
}
// 効果音（music.cues の type）。どれもその場で合成する
const SFX_CUES = {
  pop(ctx, out, t) {   // 札が出る「ポン」
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.07);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
  },
  whoosh(ctx, out, t, noise) {   // 画面がすべりこむ「シュッ」
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.4);
  },
  ready(ctx, out, t) {   // 「よーい」の短い音
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 660;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
  },
  go(ctx, out, t, noise) {   // 「ドン」（スタートのピストル）＋高い音
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.3);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1320;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.18, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g2); g2.connect(out); o.start(t); o.stop(t + 0.45);
  },
  stamp(ctx, out, t, noise) {   // 判子の「ドン」＋きらっ
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5);
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.5, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    s.connect(f); f.connect(gn); gn.connect(out); s.start(t); s.stop(t + 0.2);
    [1568, 2093, 2637].forEach((fr, i) => { const q = ctx.createOscillator(); q.type = 'sine'; q.frequency.value = fr; const gq = ctx.createGain(), tq = t + 0.06 + i * 0.04;
      gq.gain.setValueAtTime(0, tq); gq.gain.linearRampToValueAtTime(0.12, tq + 0.01); gq.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      q.connect(gq); gq.connect(out); q.start(tq); q.stop(t + 1); });
  },
  fanfare(ctx, out, t) {   // 勝ったときの「パパパパーン」
    for (const [f, d] of [[523.25, 0], [659.25, 0.11], [783.99, 0.22], [1046.5, 0.36]]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const g = ctx.createGain(), len = d > 0.3 ? 0.9 : 0.12;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.12, t + d + 0.01); g.gain.setValueAtTime(0.12, t + d + len * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + d + len);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; o.connect(g); g.connect(lp); lp.connect(out); o.start(t + d); o.stop(t + d + len + 0.05);
    }
    for (const f of [523.25, 659.25, 783.99]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + 0.36); g.gain.linearRampToValueAtTime(0.1, t + 0.4); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5); o.connect(g); g.connect(out); o.start(t + 0.36); o.stop(t + 1.6); }
  },
};

// ---- 音量をそろえる（2026-10-12 ユーザー「音量をあわせて」。RULES 8.6）----
// 大きさは ITU-R BS.1770（YouTube などと同じ LUFS）。BGM の種類（drone・journey）で音の大きさがちがい、journey が 14 dB ほど小さかったので、
// BGM だけを LOUD.bgm にそろえてから、声・目印の音（どの動画でも同じ大きさ）を足す。最後に全体のピークが LOUD.peak をこえないようにする。
// 書き出した mp4 は _dev/tools/check-loudness.ps1 で確かめる（全体が LOUD.min〜LOUD.max LUFS に入っているか）
const LOUD = { bgm: -20, peak: -1.5, min: -21.5, max: -18.5 };   // peak はサンプルの値。AAC にするとトゥルーピークが少し上がるので -1 dBTP より下に
function kWeight(x, fs) {   // BS.1770 の K 特性（高域を持ち上げる棚＋低域を切る）。係数は fs から計算
  const biq = (b, a) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], o = b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; } return y; };
  let K = Math.tan(Math.PI * 1681.974450955533 / fs), Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416), Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan(Math.PI * 38.13547087602444 / fs); Q = 0.5003270373238773; a0 = 1 + K / Q + K * K;
  const b2 = [1, -2, 1], a2 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  x = biq(b1, a1); return biq(b2, a2);
}
function lufs(chs, fs) {   // 積分ラウドネス（400 ms の窓・75% 重ね、-70 LUFS と相対 -10 LU のゲート）
  const w = chs.map(c => kWeight(c, fs)), n = Math.round(0.4 * fs), hop = Math.round(0.1 * fs), z = [];
  for (let s = 0; s + n <= w[0].length; s += hop) { let m = 0; for (const c of w) { let a = 0; for (let i = s; i < s + n; i++) a += c[i] * c[i]; m += a / n; } z.push(m); }
  const L = m => -0.691 + 10 * Math.log10(m);
  const g1 = z.filter(m => L(m) > -70); if (!g1.length) return -Infinity;
  const r = L(g1.reduce((a, b) => a + b, 0) / g1.length) - 10, g2 = g1.filter(m => L(m) > r);
  return L(g2.reduce((a, b) => a + b, 0) / g2.length);
}
function loudMix(b4, hasBgm) {
  const len = b4.length, B = [b4.getChannelData(0), b4.getChannelData(1)], V = [b4.getChannelData(2), b4.getChannelData(3)];
  const lb = hasBgm ? lufs(B, SR) : -Infinity;
  let gb = isFinite(lb) ? Math.pow(10, (LOUD.bgm - lb) / 20) : 1, gall = 1;
  if (!hasBgm) { const lv = lufs(V, SR); if (isFinite(lv)) gall = Math.pow(10, (LOUD.bgm - lv) / 20); }   // BGM のない台本（ピアノの音など）は全体をそろえる
  const out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR }), O = [out.getChannelData(0), out.getChannelData(1)];
  let gp = 1, total = -Infinity;
  // 「ドン」などのピークを下げると全体も少し下がるので、足りなければ1回だけ BGM（BGM なしは全体）を上げて混ぜなおす
  for (let pass = 0; pass < 2; pass++) {
    for (let c = 0; c < 2; c++) for (let i = 0; i < len; i++) O[c][i] = (B[c][i] * gb + V[c][i]) * gall;
    gp = limitPeaks(O, Math.pow(10, LOUD.peak / 20));
    total = lufs(O, SR);
    if (total >= LOUD.bgm - 0.7) break;
    const up = Math.pow(10, (LOUD.bgm - 0.3 - total) / 20);
    if (hasBgm && isFinite(lb)) gb *= up; else gall *= up;
  }
  out.loud = { bgmBefore: lb, bgmGain: 20 * Math.log10(gb * gall), peakGain: 20 * Math.log10(gp), total };
  return out;
}
// ピークだけを下げる（先読み 5 ms で下げはじめ、0.15 秒でもどる）。全体を下げると「ドン」1つで動画ぜんぶが小さくなるため。いちばん下げた量を返す
function limitPeaks(O, lim) {
  const n = O[0].length, la = Math.round(0.005 * SR), rel = 1 - Math.exp(-1 / (0.15 * SR));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(O[0][i]), Math.abs(O[1][i])); req[i] = a > lim ? lim / a : 1; }
  // 先の la サンプルのうちいちばん小さい値（単調な列で）
  const ahead = new Float32Array(n), q = new Int32Array(n); let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && req[q[t - 1]] >= req[i]) t--;
    q[t++] = i;
    while (q[h] > i + la) h++;
    ahead[i] = req[q[h]];
  }
  // 下げるのは先読みのあいだに直線で、もどすのはゆっくり
  const g = new Float32Array(n);
  for (let i = n - 1, nxt = 1; i >= 0; i--) { nxt = Math.min(ahead[i], nxt + 1 / la); g[i] = nxt; }
  let cur = 1, min = 1;
  for (let i = 0; i < n; i++) { cur = Math.min(g[i], cur + (1 - cur) * rel); O[0][i] *= cur; O[1][i] *= cur; if (cur < min) min = cur; }
  return min;
}
// WAV（16bit）。録画しなおさずに音だけ作りなおすとき（__promoAudio → _dev/tools/remix-audio.ps1）
function wavBytes(buf) {
  const n = buf.length, ch = buf.numberOfChannels, d = new DataView(new ArrayBuffer(44 + n * ch * 2)), C = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  const str = (o, s) => [...s].forEach((k, i) => d.setUint8(o + i, k.charCodeAt(0)));
  str(0, 'RIFF'); d.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, ch, true);
  d.setUint32(24, SR, true); d.setUint32(28, SR * ch * 2, true); d.setUint16(32, ch * 2, true); d.setUint16(34, 16, true); str(36, 'data'); d.setUint32(40, n * ch * 2, true);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) d.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(C[c][i] * 32767))), true);
  return d.buffer;
}
