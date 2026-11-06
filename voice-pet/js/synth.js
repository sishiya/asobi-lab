// 声を作る（純粋）。源（声帯のパルス＋息の雑音）→ 声の筒（フォルマント）。
// 確かめ用の「声の見本」と、生き物の鳴き声の両方に使う。返すのは Float32Array（と口のあき具合）
const C_SOUND = 35000;

// 母音ごとの、筒の長さ 17.5cm のときのフォルマント（ずれの割合で持つ。一様管は 500,1500,2500,3500）
const VOWEL = {
  a: [1.6, 0.8, 1.0, 1.0], i: [0.56, 1.5, 1.2, 1.05], u: [0.64, 0.6, 0.94, 1.0],
  e: [0.9, 1.25, 1.04, 1.0], o: [1.1, 0.55, 1.0, 1.0], n: [0.5, 0.9, 1.0, 1.0],
};

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

// p: { sr, dur, f0, vtl, breath(0..1), rough(0..1), syl:[{v,t0,t1,semi}], contour:[半音...], seed, gain }
export function synthVoice(p) {
  const sr = p.sr || 48000, n = Math.floor(sr * p.dur), out = new Float32Array(n), mouth = new Float32Array(Math.ceil(p.dur * 60));
  const R = rng(p.seed || 7);
  const base = C_SOUND / (4 * p.vtl); // 一様管の F1
  const res = [0, 1, 2, 3].map(() => ({ y1: 0, y2: 0 }));
  let phase = 0, jit = 0, shim = 1, prevY = 0;
  const syl = p.syl || [{ v: 'a', t0: 0, t1: p.dur }];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // 今の音節と、つぎの母音へのわたり
    let s = syl[syl.length - 1], k = syl.length - 1;
    for (let j = 0; j < syl.length; j++) if (t < syl[j].t1) { s = syl[j]; k = j; break; }
    const inS = t >= s.t0 && t < s.t1;
    const env = inS ? Math.min(1, (t - s.t0) / 0.03, (s.t1 - t) / 0.05) : 0;
    const nx = syl[Math.min(k + 1, syl.length - 1)];
    const mix = Math.max(0, Math.min(1, (t - (s.t1 - 0.06)) / 0.06));
    const va = VOWEL[s.v] || VOWEL.a, vb = VOWEL[nx.v] || VOWEL.a;
    // 高さ: 節まわし（contour は全体の時間で引く）＋音節ごと
    let semi = s.semi || 0;
    if (p.contour && p.contour.length) {
      const c = p.contour, u = Math.min(c.length - 1.001, t / p.dur * (c.length - 1)), a = Math.floor(u);
      semi += c[a] + (c[a + 1] - c[a]) * (u - a);
    }
    const f0 = p.f0 * Math.pow(2, semi / 12) * (1 + jit);
    phase += f0 / sr;
    if (phase >= 1) { // 1周ごとに、ふるえ（周期）とかすれ（大きさ）を少しずつ変える
      phase -= 1;
      jit = (R() - 0.5) * 2 * (p.rough || 0) * 0.025; shim = 1 + (R() - 0.5) * 2 * (p.rough || 0) * 0.3;
    }
    // ローゼンバーグのパルスの微分に近い形（開いて、閉じるときに強く）
    const op = 0.6, g = phase < op ? 0.5 - 0.5 * Math.cos(Math.PI * phase / op) : Math.cos(Math.PI * (phase - op) / (2 * (1 - op)));
    const src = g; // 声門の流れ（微分は口の放射でかかる）
    const noise = (R() * 2 - 1);
    const br = p.breath || 0;
    let ex = (src * (1 - br * 0.7) + noise * br * 0.35 * (0.5 + 0.5 * g)) * env * shim;
    // クラット式の直列のフォルマント（1つずつ DC で利得 1。高いほど自然に弱まる）
    let y = ex;
    for (let f = 0; f < 4; f++) {
      const fr = base * (2 * f + 1) * (va[f] * (1 - mix) + vb[f] * mix);
      if (fr > sr * 0.45) continue;
      const bw = 50 + fr * 0.05, C = -Math.exp(-2 * Math.PI * bw / sr), B = 2 * Math.exp(-Math.PI * bw / sr) * Math.cos(2 * Math.PI * fr / sr), A = 1 - B - C;
      const st = res[f];
      const v = A * y + B * st.y1 + C * st.y2;
      st.y2 = st.y1; st.y1 = v; y = v;
    }
    // 口から出る音（放射）: 1次の差分で高域を持ち上げる
    const rad = y - prevY; prevY = y; y = rad;
    out[i] = y;
    const m = Math.floor(t * 60); mouth[m] = Math.max(mouth[m], env * (s.v === 'n' ? 0.15 : s.v === 'a' ? 1 : 0.6));
  }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
  const gain = (p.gain || 0.7) / (pk || 1);
  for (let i = 0; i < n; i++) out[i] *= gain;
  return { samples: out, mouth };
}

// 音節の並びを作る（はやさ＝音節／秒）
export function sylls(text, rate, dur, semis) {
  const v = [...text], out = [];
  const step = 1 / rate, len = step * 0.78;
  for (let i = 0, t = 0.1; i < v.length && t + len < dur; i++, t += step) out.push({ v: v[i], t0: t, t1: t + len, semi: semis ? semis[i % semis.length] : 0 });
  return out;
}

// 確かめ用の声の見本（マイクのかわり。?test=<名前>）
export const SAMPLES = {
  low:    { f0: 105, vtl: 17.5, breath: 0.05, rough: 0.15, rate: 4.2, text: 'aiueoaiu', semis: [0, 1, -1, 2, 0] },
  high:   { f0: 230, vtl: 14.2, breath: 0.12, rough: 0.1, rate: 4.8, text: 'aiueoaiu', semis: [0, 2, 3, 1, 4] },
  child:  { f0: 310, vtl: 11.2, breath: 0.1, rough: 0.05, rate: 5.5, text: 'aaiioo', semis: [0, 4, 7, 2, 5] },
  breathy:{ f0: 170, vtl: 15.5, breath: 0.65, rough: 0.2, rate: 3.0, text: 'aooa', semis: [0, -1, 0, -2] },
  rough:  { f0: 120, vtl: 17, breath: 0.25, rough: 0.9, rate: 3.5, text: 'aoaoe', semis: [0, 0, 1, 0] },
  sing:   { f0: 200, vtl: 15, breath: 0.05, rough: 0.05, rate: 1.6, text: 'aaoo', semis: [0, 5, 9, 4] },
  quick:  { f0: 160, vtl: 15.8, breath: 0.1, rough: 0.2, rate: 7.5, text: 'aiueoaieoua', semis: [0, 1, 0, -1] },
};
export function sampleVoice(name, sr = 48000) {
  const s = SAMPLES[name] || SAMPLES.low, dur = 2.6;
  const { samples } = synthVoice({ sr, dur, f0: s.f0, vtl: s.vtl, breath: s.breath, rough: s.rough, syl: sylls(s.text, s.rate, dur, s.semis), seed: name.length * 97 });
  // マイクの雑音を少し
  const R = rng(3); for (let i = 0; i < samples.length; i++) samples[i] += (R() - 0.5) * 0.004;
  return samples;
}
