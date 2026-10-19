// 音（WebAudio で作る。ファイルは使わない）。木のおもちゃ・拍子木・木魚の方向（アート・音、2026-10-19）。
// はじめの音量は小さめ（0.3）。?mute=1 で消して開く（テストは音を消して）。設定はこの端末だけに覚える。
let ctx = null, master = null;
const store = (() => { try { return localStorage; } catch { return null; } })();
const saved = store?.getItem('pathstones.sound');
const params = new URLSearchParams(location.search);

export const Sound = {
  on: params.get('mute') ? false : saved !== 'off',
  set(v) { this.on = v; try { store?.setItem('pathstones.sound', v ? 'on' : 'off'); } catch {} if (master) master.gain.value = v ? 0.3 : 0; },
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = this.on ? 0.3 : 0; master.connect(ctx.destination); } catch { ctx = null; }
  },
  // 木を打つ短い音
  _knock(freq, dur = 0.12, vol = 0.5, type = 'triangle', at = 0) {
    if (!ctx || !this.on) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  },
  _noise(dur = 0.08, vol = 0.3, hp = 2000, at = 0) {
    if (!ctx || !this.on) return;
    const t = ctx.currentTime + at, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * (1 - i / n);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  },
  pick(n) { this._knock(420 * Math.pow(2, Math.min(8, n) / 12), 0.1, 0.45, 'sine'); },   // 木魚「ぽく」
  trap() { this._knock(260, 0.08, 0.35); this._knock(520, 0.05, 0.2, 'square', 0.04); }, // ピンを抜く「かちり」
  cut() { this._knock(1400, 0.18, 0.5, 'square'); this._noise(0.12, 0.25, 3000, 0.02); }, // 拍子木「カン」＋紙を裂く
  spot() { this._knock(1800, 0.03, 0.25, 'square'); this._knock(90, 0.35, 0.5, 'sine', 0.05); }, // 「カチ」＋太鼓
  bite() { this._knock(150, 0.25, 0.5, 'sine'); },
  stack(k) { this._knock(330 * Math.pow(2, k / 12), 0.12, 0.4, 'triangle'); },
  lit() { [0, 4, 7, 12].forEach((s, i) => this._knock(392 * Math.pow(2, s / 12), 0.6, 0.3, 'sine', i * 0.09)); },
  fire() { this._knock(660, 0.2, 0.2, 'sine'); },
  won() { [0, 5, 9, 12, 17].forEach((s, i) => this._knock(330 * Math.pow(2, s / 12), 1.2, 0.25, 'sine', i * 0.18)); },
};
