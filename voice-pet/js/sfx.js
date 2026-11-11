// 効果音（ユーザー「音がなってほしいところに音がついてない」）: 羊毛の箱庭に合わせて、固い音にしない。短い合図は「ぽ」という木の音、うれしい場面はカリンバ、風は息のような音
// 水と雨だけ録った音に近いもの（snd/splash.ogg・rain.ogg。Stable Audio）。ctx・vol・ambVol・ready はあとから読む（音量のつまみ・さわったか）
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98]; // ドレミソラ（ペンタトニック）
export function makeSfx({ ctx, vol, ambVol, ready, base }) {
  let out = null, noise = null, S = null, rain = null, wantRain = false; const last = {};
  const bus = ac => { if (!out || out.context !== ac) { out = ac.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 5200; out.connect(ac.destination); } return out; };
  const amp = () => vol() * vol() * 1.4; // つまみは耳の感じに合わせて2乗
  const gate = (name, gap) => { if (!ready() || !vol() || document.hidden) return null; const now = performance.now() / 1000; if (now - (last[name] ?? -9) < gap) return null; last[name] = now; return ctx(); };
  const env = (ac, t, g, up, len) => { const n = ac.createGain(); n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(Math.max(0.0002, g * amp()), t + up); n.gain.exponentialRampToValueAtTime(0.0001, t + up + len); n.connect(bus(ac)); return n; };
  const osc = (ac, f, t, n, end, f1) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (end - t) * 0.6); o.connect(n); o.start(t); o.stop(end); };
  const pluck = (ac, f, t, g = 0.14, len = 0.9) => { osc(ac, f, t, env(ac, t, g, 0.006, len), t + len + 0.02); osc(ac, f * 4.02, t, env(ac, t, g * 0.16, 0.003, 0.09), t + 0.12); }; // カリンバ: 基の音と、はじく瞬間の高い音
  const wood = (ac, f0, f1, t, g, len, up = 0.005) => osc(ac, f0, t, env(ac, t, g, up, len), t + len + 0.02, f1); // 高さの下がる短い音（ぽ・ぽふ）
  const air = (ac, t, dur, f0, f1, g) => { // 息のような風: 雑音を帯域でしぼり、ふくらんで消える
    if (!noise || noise.ctx !== ac) { const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noise = { b, ctx: ac }; }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), n = ac.createGain(), end = t + dur; s.buffer = noise.b; s.loop = true; f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, end);
    n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(g * 2.2 * amp(), t + dur * 0.45); n.gain.exponentialRampToValueAtTime(0.0001, end); s.connect(f); f.connect(n); n.connect(bus(ac)); s.start(t); s.stop(end + 0.02);
  };
  const run = (ac, idx, step, g, len) => { const t = ac.currentTime + 0.01; idx.forEach((k, i) => pluck(ac, SCALE[k], t + i * step, g, len)); };
  const rainGain = () => 0.8 * ambVol() * ambVol();
  function rainNow() { if (!S?.rain) return; const ac = ctx(); if (wantRain && !rain) { const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = S.rain; s.loop = true; g.gain.value = 0; s.connect(g); g.connect(ac.destination); s.start(); rain = { s, g }; } if (rain) { rain.g.gain.setTargetAtTime(wantRain ? rainGain() : 0, ac.currentTime, wantRain ? 0.9 : 0.5); if (!wantRain) { const r = rain; rain = null; setTimeout(() => { try { r.s.stop(); } catch (e) { /* 止まっている */ } }, 3000); } } }
  return {
    async load() { if (S) return; S = {}; const ac = ctx(); for (const k of ['splash', 'rain']) try { S[k] = await ac.decodeAudioData(await (await fetch(new URL(`./snd/${k}.ogg`, base))).arrayBuffer()); } catch (e) { /* なければ鳴らさない */ } rainNow(); },
    shutter() { const ac = gate('shutter', 0.2); if (ac) { const t = ac.currentTime; wood(ac, 900, 500, t, 0.14, 0.03); wood(ac, 600, 360, t + 0.07, 0.12, 0.04); } }, /* 写真 */     tap() { const ac = gate('tap', 0.05); if (ac) wood(ac, 560, 300, ac.currentTime, 0.2, 0.07); }, // ボタン
    micOn() { const ac = gate('mic', 0.05); if (ac) run(ac, [2, 4], 0.07, 0.1, 0.25); }, // 聞きはじめ（上がる）
    micOff() { const ac = gate('mic', 0.05); if (ac) run(ac, [4, 2], 0.07, 0.1, 0.25); }, // 聞きおわり（下がる）
    no() { const ac = gate('no', 0.2); if (ac) wood(ac, 190, 125, ac.currentTime, 0.17, 0.055); }, // 声が短かった（短くくぐもった ぽす）
    cancel() { const ac = gate('no', 0.2); if (ac) wood(ac, 190, 125, ac.currentTime, 0.17, 0.055); }, // やめる・とじる
    swirl(dur = 1.2, g = 0.1) { const ac = gate('swirl', 0.2); if (ac) air(ac, ac.currentTime, dur, 420, 1500, g); }, // 毛のうず・風
    absorb(k = 0) { const ac = gate('absorb', 0.1); if (ac) { const t = ac.currentTime, f = 380 + k * 240; air(ac, t, 0.13, 800, 3200, 0.11); wood(ac, f, f * 2.1, t + 0.1, 0.24, 0.05, 0.003); } }, // 毛がたまごに吸いこまれる: ヒュッと息が走って、ポッと入る（たまるほど高く）
    beat(s = 1) { const ac = gate('beat', 0.3); if (ac) { const t = ac.currentTime; wood(ac, 112, 54, t, 0.56 * s, 0.19, 0.016); wood(ac, 90, 46, t + 0.17, 0.34 * s, 0.19, 0.016); } }, // たまごの拍（どくん）
    hatch() { const ac = gate('hatch', 1); if (ac) { const t = ac.currentTime; wood(ac, 260, 620, t, 0.32, 0.14); air(ac, t, 0.5, 2200, 700, 0.16); run(ac, [0, 2, 3, 4, 5, 7], 0.07, 0.11, 1.1); } }, // 殻がはじける
    thud(g = 0.28) { const ac = gate('thud', 0.25); if (ac) wood(ac, 165, 78, ac.currentTime, g, 0.13); }, // ぽふ（着地・ころぶ）
    step(n = 1) { const ac = gate('step', 0.3); if (ac) run(ac, n === 1 ? [0, 2, 4] : n === 2 ? [0, 2, 3, 5] : [0, 2, 3, 4, 5, 7, 8], 0.11, 0.12, 0.9); }, // 練習の節目
    ask() { const ac = gate('ask', 1); if (ac) run(ac, [3, 1], 0.17, 0.11, 0.6); }, // 問いかけ（「？」の下がる2音）
    morph() { const ac = gate('morph', 1); if (ac) { air(ac, ac.currentTime, 3.6, 900, 2400, 0.045); run(ac, [2, 4, 3, 5, 4, 7, 5], 0.46, 0.05, 1.4); } }, // 毛の色がかわっていく（4 秒）
    welcome() { const ac = gate('welcome', 1); if (ac) run(ac, [0, 3, 5], 0.13, 0.12, 1); }, // 子をむかえる
    out() { const ac = gate('out', 1); if (ac) air(ac, ac.currentTime, 0.9, 600, 1300, 0.07); }, // でかける
    home(bloom) { const ac = gate('home', 1); if (ac) bloom ? run(ac, [2, 3, 4, 5, 7, 8], 0.13, 0.12, 1.2) : run(ac, [5, 3], 0.16, 0.09, 0.6); }, // 帰ってきた（咲いたときは長く）
    fullBloom() { const ac = gate('full', 1); if (ac) { air(ac, ac.currentTime, 7.5, 500, 1700, 0.06); const t = ac.currentTime + 0.05; [0, 2, 3, 5, 4, 5, 7, 8, 7, 5, 7, 8].forEach((k, i) => pluck(ac, SCALE[k], t + i * 0.42, 0.11, 1.6)); [0, 3, 5].forEach(k => pluck(ac, SCALE[k], t + 5.2, 0.12, 2.6)); } }, // 5種そろった
    farewell() { const ac = gate('bye', 1); if (ac) run(ac, [5, 4, 3, 2, 0], 0.32, 0.08, 1.3); }, // 野にかえる
    mark() { const ac = gate('mark', 0.08); if (ac) { const t = ac.currentTime; air(ac, t, 0.1, 1500, 500, 0.05); wood(ac, 330, 210, t + 0.015, 0.2, 0.07, 0.004); } }, // でかける先に目じるしの毛玉を置く（ぽふ）
    burr() { const ac = gate('burr', 0.15); if (ac) { const t = ac.currentTime; wood(ac, 700, 420, t, 0.16, 0.05); wood(ac, 620, 360, t + 0.06, 0.12, 0.05); } }, // ひっつき虫がつく（ぴと）
    sprout() { const ac = gate('sprout', 0.25); if (ac) pluck(ac, SCALE[6 + Math.floor(Math.random() * 3)], ac.currentTime, 0.06, 0.35); }, // 芽が出る
    bubble() { const ac = gate('bubble', 0.3); if (ac) { const t = ac.currentTime; for (let i = 0; i < 4; i++) wood(ac, 260 + i * 90, 520 + i * 120, t + i * 0.12, 0.09, 0.09); } }, // 水玉がふくらむ（こぽこぽ）
    splash() { const ac = gate('splash', 0.3); if (!ac || !S?.splash) return; const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); s.buffer = S.splash; g.gain.value = 0.9 * amp(); f.type = 'lowpass'; f.frequency.value = 9000; s.connect(f); f.connect(g); g.connect(ac.destination); s.start(); },
    reset() { rain = null; rainNow(); }, // 音を作り直したとき
    plink() { const ac = gate('plink', 0.045); if (ac) { const t = ac.currentTime, f = 900 + Math.random() * 900; osc(ac, f, t, env(ac, t, 0.05, 0.003, 0.045), t + 0.06, f * 1.8); } }, // しずくが草に落ちる
    rain(on) { wantRain = on; rainNow(); }, rainVol() { if (rain) rain.g.gain.setTargetAtTime(rainGain(), ctx().currentTime, 0.15); },
  };
}
