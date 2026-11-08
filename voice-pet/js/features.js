// 声の特徴を取り出す（純粋。DOM も WebAudio も使わない。node の確かめ tools/check-voice.mjs からも読む）
// 入力: 1チャンネルの Float32Array と sampleRate。出力: 数の特徴（声そのものは返さない・残さない）
export const FS = 12000; // 調べる細かさ（フォルマントは 5kHz まで見れば足りる）
const C_SOUND = 35000; // 声の筒の中の音の速さ cm/s

// 低域通過（窓つき sinc）してから FS へ間引く
function resample(x, sr) {
  if (sr === FS) return Float32Array.from(x);
  const fc = 5200 / sr, N = 63, h = new Float32Array(N);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const m = i - (N - 1) / 2;
    const s = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    h[i] = s * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1)));
    sum += h[i];
  }
  for (let i = 0; i < N; i++) h[i] /= sum;
  const step = sr / FS, n = Math.floor(x.length / step), y = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const c = j * step, i0 = Math.floor(c);
    let acc = 0;
    for (let k = 0; k < N; k++) {
      const idx = i0 + k - (N >> 1);
      if (idx >= 0 && idx < x.length) acc += h[k] * x[idx];
    }
    y[j] = acc;
  }
  return y;
}

// YIN（de Cheveigné & Kawahara 2002）の簡略版。返すのは [周期, 非周期の度合い 0..1]
function yin(x, off, W, tMin, tMax, d) {
  for (let t = 1; t <= tMax; t++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[off + i] - x[off + i + t]; s += v * v; }
    d[t] = s;
  }
  let run = 0;
  d[0] = 1;
  for (let t = 1; t <= tMax; t++) { run += d[t]; d[t] = run > 0 ? d[t] * t / run : 1; }
  let best = -1;
  for (let t = tMin; t < tMax; t++) {
    if (d[t] < 0.18) { while (t + 1 < tMax && d[t + 1] < d[t]) t++; best = t; break; }
  }
  if (best < 0) { // 息まじり・かすれ声: しきいをゆるめて最初の谷。それもなければ最小の所
    for (let t = tMin; t < tMax; t++) {
      if (d[t] < 0.5 && d[t] <= d[t - 1] && d[t] <= d[t + 1]) { best = t; break; }
    }
  }
  if (best < 0) {
    let m = Infinity;
    for (let t = tMin; t < tMax; t++) if (d[t] < m) { m = d[t]; best = t; }
  }
  const a = d[best - 1], b = d[best], c = d[best + 1];
  const den = a - 2 * b + c, p = den > 1e-9 ? best + 0.5 * (a - c) / den : best;
  return [p, Math.max(0, Math.min(1, b))];
}

// LPC（自己相関法・レビンソン）→ 包絡の山＝フォルマント
function lpcPeaks(x, off, W, order) {
  const w = new Float64Array(W);
  for (let i = 0; i < W; i++) {
    const pre = x[off + i] - 0.97 * (off + i > 0 ? x[off + i - 1] : 0);
    w[i] = pre * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (W - 1)));
  }
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) { let s = 0; for (let i = k; i < W; i++) s += w[i] * w[i - k]; r[k] = s; }
  if (r[0] <= 0) return [];
  r[0] *= 1.0001;
  const a = new Float64Array(order + 1), tmp = new Float64Array(order + 1);
  a[0] = 1; let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / e;
    tmp.set(a);
    for (let j = 1; j < i; j++) a[j] = tmp[j] + k * tmp[i - j];
    a[i] = k; e *= 1 - k * k;
    if (e <= 0) return [];
  }
  const B = 360, fMax = 5400, env = new Float64Array(B);
  for (let b = 0; b < B; b++) {
    const om = 2 * Math.PI * (b + 0.5) * fMax / B / FS;
    let re = 0, im = 0;
    for (let k = 0; k <= order; k++) { re += a[k] * Math.cos(om * k); im -= a[k] * Math.sin(om * k); }
    env[b] = -Math.log(re * re + im * im);
  }
  const peaks = [];
  for (let b = 1; b < B - 1; b++) {
    if (env[b] > env[b - 1] && env[b] >= env[b + 1]) {
      const f = (b + 0.5 + 0.5 * (env[b - 1] - env[b + 1]) / (env[b - 1] - 2 * env[b] + env[b + 1])) * fMax / B;
      if (f > 220) peaks.push(f);
    }
  }
  return peaks.slice(0, 4);
}

// 実数の FFT（2 のべき）。パワーを返す
function powerSpectrum(x, off, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (x[off + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const cr = Math.cos(ang * k), ci = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
  const p = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}

const median = a => { if (!a.length) return NaN; const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const clamp01 = v => Math.max(0, Math.min(1, v));
const norm = (v, lo, hi) => clamp01((v - lo) / (hi - lo));

// 声 → 特徴。声が足りなければ { ok:false, why }
export function analyze(input, sr) {
  const x = resample(input, sr);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 1e-4) return { ok: false, why: 'quiet' };
  for (let i = 0; i < x.length; i++) x[i] /= peak;

  // 高さを読む用に 1kHz より上をけずった写し（息の雑音とフォルマントの響きで周期をまちがえないように）
  const xl = new Float32Array(x.length);
  { const a = Math.exp(-2 * Math.PI * 1000 / FS); let y1 = 0, y2 = 0, y3 = 0;
    for (let i = 0; i < x.length; i++) { y1 = (1 - a) * x[i] + a * y1; y2 = (1 - a) * y1 + a * y2; y3 = (1 - a) * y2 + a * y3; xl[i] = y3; } }
  const W = Math.round(0.03 * FS), H = Math.round(0.01 * FS);
  const tMin = Math.floor(FS / 700), tMax = Math.ceil(FS / 65);
  const nF = Math.floor((x.length - W - tMax - 1) / H);
  if (nF < 20) return { ok: false, why: 'short' };

  const rms = new Float64Array(nF);
  for (let f = 0; f < nF; f++) {
    let s = 0; const o = f * H;
    for (let i = 0; i < W; i++) s += x[o + i] * x[o + i];
    rms[f] = Math.sqrt(s / W);
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(nF * 0.1)], top = sorted[Math.floor(nF * 0.98)];
  const thr = Math.max(top * 0.1, floor * 2.5);

  const d = new Float64Array(tMax + 2);
  const f0 = [], aper = [], df = [], f1 = [], f2 = [], f3 = [], f4 = [], fmt = [], cent = [], hfr = [], vRms = [];
  const ltas = new Float64Array(24); // 声の平均のスペクトル（100〜5000Hz を対数で 24 に）
  const voiced = new Uint8Array(nF), track = new Float64Array(nF);
  let active = 0;
  for (let f = 0; f < nF; f++) {
    if (rms[f] < thr) continue;
    active++;
    const o = f * H;
    const [tau, ap] = yin(xl, o, W, tMin, tMax, d);
    const sp = powerSpectrum(x, o, 512);
    let num = 0, den = 0, hi = 0;
    for (let b = 2; b < 256; b++) { const fr = b * FS / 512; num += fr * sp[b]; den += sp[b]; if (fr > 3000) hi += sp[b]; }
    if (den > 0) { cent.push(num / den); hfr.push(hi / den); }
    if (ap < 0.6) {
      voiced[f] = 1;
      for (let b = 2; b < 256; b++) { const k = Math.floor(Math.log(b * FS / 512 / 100) / Math.log(50) * 24); if (k >= 0 && k < 24) ltas[k] += sp[b]; }
      const hz = FS / tau;
      track[f] = hz; f0.push(hz); aper.push(ap); vRms.push(rms[f]);
      const pk = lpcPeaks(x, o, W, FS / tau > 250 ? 10 : 14); // 高い声は次数を下げて倍音を拾わない
      if (pk.length >= 3) {
        // 声の筒を一様な管とみる: F_i = (2i-1) c / 4L → ΔF の最小二乗（Reby & McComb 2003）
        let sn = 0, sd = 0;
        pk.forEach((F, i) => { const k = i + 0.5; sn += F * k; sd += k * k; });
        df.push(sn / sd);
        f1.push(pk[0]); f2.push(pk[1]); f3.push(pk[2]); if (pk[3]) f4.push(pk[3]);
        fmt.push([f, pk[0], pk[1]]);
      }
    }
  }
  // オクターブのとびを直す: 全体の高さから 0.6 オクターブ以上はなれたこまは、その近くの谷で読みなおす
  if (f0.length > 5) {
    const ref = median(f0);
    let j = 0;
    for (let f = 0; f < nF; f++) {
      if (!voiced[f]) continue;
      const r = track[f] / ref;
      if (r > 1.5 || r < 0.66) {
        const t0 = FS / ref;
        yin(xl, f * H, W, tMin, tMax, d);
        let bt = Math.round(t0), m = Infinity;
        for (let t = Math.max(tMin, Math.floor(t0 * 0.8)); t <= Math.min(tMax - 1, Math.ceil(t0 * 1.25)); t++) if (d[t] < m) { m = d[t]; bt = t; }
        track[f] = FS / bt; f0[j] = track[f];
      }
      j++;
    }
  }
  const vDur = f0.length * H / FS;
  if (vDur < 0.35) return { ok: false, why: f0.length ? 'short' : 'unvoiced' };

  // 高さ・抑揚（半音でのばらつき）
  const fMed = median(f0);
  const semis = f0.map(v => 12 * Math.log2(v / fMed));
  const sMed = median(semis);
  const melody = median(semis.map(s => Math.abs(s - sMed))) * 1.4826;
  // 声の筒の長さ
  const dF = Math.max(650, Math.min(1700, median(df)));
  const vtl = C_SOUND / (2 * dF);
  // 息まじり（HNR のかわりに YIN の非周期の度合い）
  const breath = median(aper);
  // 音節の数: なめらかにした大きさの山
  const sm = new Float64Array(nF);
  for (let f = 0; f < nF; f++) { let s = 0, n = 0; for (let k = -3; k <= 3; k++) if (rms[f + k] !== undefined) { s += rms[f + k]; n++; } sm[f] = s / n; }
  // ゆらぎ（かすれ）: なめらかにした大きさの線からの、10ms ごとのはずれ（音節の出入りは数えない）
  const jit = [];
  for (let f = 3; f < nF - 3; f++) if (voiced[f] && voiced[f - 3] && voiced[f + 3]) jit.push(Math.abs(Math.log(rms[f] / sm[f])));
  const shimmer = median(jit) || 0;
  const pj = [];
  for (let f = 2; f < nF; f++) if (voiced[f] && voiced[f - 1] && voiced[f - 2]) {
    const a = track[f - 2], b = track[f - 1], c = track[f];
    pj.push(Math.abs(b - (a + c) / 2) / b); // 上がり下がりの線からのはずれ＝ふるえ
  }
  const jitter = median(pj);
  let syl = 0, last = -99, minSince = Infinity;
  for (let f = 1; f < nF - 1; f++) {
    minSince = Math.min(minSince, sm[f]);
    if (sm[f] > thr * 1.5 && sm[f] >= sm[f - 1] && sm[f] > sm[f + 1] && f - last > 9 && sm[f] > minSince * 1.35) { syl++; last = f; minSince = Infinity; }
  }
  const rate = syl / Math.max(0.3, active * H / FS);
  // 立ち上がりの鋭さ: 20ms で 2倍以上になる所の数／秒
  let onsets = 0;
  for (let f = 2; f < nF; f++) if (rms[f] > thr && rms[f] > rms[f - 2] * 2.2 && rms[f - 1] <= rms[f - 2] * 2.2) onsets++;
  const onsetRate = onsets / Math.max(0.3, active * H / FS);

  const centroid = median(cent), hf = median(hfr);
  const F1 = median(f1), F2 = median(f2), F3 = median(f3), F4 = f4.length ? median(f4) : F3 * 1.35;
  // 母音の道すじ（F1・F2 を時間で 12 に分けた中央値）。何をどう言ったかで、その人だけの形になる
  const vpath = [];
  for (let i = 0; i < 12 && fmt.length; i++) {
    const seg = fmt.slice(Math.floor(i * fmt.length / 12), Math.max(Math.floor(i * fmt.length / 12) + 1, Math.floor((i + 1) * fmt.length / 12)));
    vpath.push([Math.round(median(seg.map(q => q[1]))), Math.round(median(seg.map(q => q[2])))]);
  }
  // 平均のスペクトルを dB で 0..1 に（いちばん強い帯を 1、40dB 下を 0）
  const lmax = Math.max(...ltas) || 1, spec = [...ltas].map(v => Math.round(clamp01(1 + 10 * Math.log10((v || 1e-12) / lmax) / 40) * 100) / 100);
  // 高さの節まわし（16 点。まねっこの鳴き声に使う）
  const idx = []; for (let f = 0; f < nF; f++) if (voiced[f]) idx.push(f);
  const contour = [];
  for (let i = 0; i < 16; i++) {
    const a = idx[Math.floor(i * idx.length / 16)], b = idx[Math.min(idx.length - 1, Math.floor((i + 1) * idx.length / 16))];
    const seg = []; for (let f = a; f <= b; f++) if (voiced[f]) seg.push(12 * Math.log2(track[f] / fMed));
    contour.push(Math.round((median(seg) || 0) * 10) / 10);
  }

  return {
    ok: true,
    raw: { f0: fMed, vtl, breath, shimmer, jitter, melody, rate, onsetRate, centroid, hf, F1, F2, F3, F4, vDur, syl },
    contour, vpath, spec,
    // 0..1 にそろえた値（遺伝子の材料）
    n: {
      size: norm(vtl, 10, 19),
      pitch: norm(Math.log2(fMed), Math.log2(85), Math.log2(420)),
      bright: norm(Math.log2(centroid), Math.log2(260), Math.log2(1500)),
      breath: norm(breath, 0.04, 0.4),
      rough: clamp01(norm(shimmer, 0.03, 0.12) * 0.3 + norm(jitter, 0.001, 0.008) * 0.7),
      melody: norm(melody, 0.4, 4.5),
      tempo: norm(rate, 2, 8.5),
      sharp: clamp01(norm(hf, 0.02, 0.18) * 0.6 + norm(onsetRate, 1, 8) * 0.4),
      open: norm(F1, 330, 850),
      front: norm(F2 - F1, 500, 1900),
    },
  };
}
