// 音（Web Audio で作る。音のファイルは使わない）。?mute で開くと鳴らさない（テストプレイ用）
const MUTE_Q = new URLSearchParams(location.search).has('mute');
let ac = null, master = null, on = !MUTE_Q && localStorage.getItem('porter.sound') !== 'off';
let fireNode = null;

function ctx() {
  if (!on) return null;
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export const soundOn = () => on;
export function setSound(v) {
  on = v && !MUTE_Q;
  try { localStorage.setItem('porter.sound', v ? 'on' : 'off'); } catch {}
  if (!on) fireLoop(false);
}

function tone(f, d, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
}
function noise(d, vol = 0.2, freq = 1200, q = 0.8, delay = 0, type = 'bandpass') {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * d), a.sampleRate);
  const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  tap: () => tone(660, 0.07, 'triangle', 0.12),
  pack: () => { noise(0.12, 0.2, 500, 1); tone(220, 0.1, 'triangle', 0.1); },
  unpack: () => { noise(0.1, 0.15, 900, 1); },
  no: () => tone(180, 0.18, 'square', 0.06, -40),
  step: () => noise(0.05, 0.05, 300, 1.5),
  splash: () => { noise(0.4, 0.25, 1800, 0.6); noise(0.3, 0.15, 700, 0.6, 0.08); },
  gulp: () => { tone(320, 0.08, 'sine', 0.15, -120); tone(300, 0.08, 'sine', 0.15, -120, 0.12); },
  honey: () => { tone(880, 0.1, 'triangle', 0.12); tone(1175, 0.14, 'triangle', 0.1, 0, 0.08); },
  say: () => tone(520, 0.06, 'triangle', 0.08, 80),
  tell: () => tone(260, 0.25, 'sawtooth', 0.05, 120),
  hit: () => { noise(0.12, 0.35, 2500, 2); tone(1400, 0.2, 'triangle', 0.08, -600); },
  thud: () => { tone(110, 0.25, 'sine', 0.35, -60); noise(0.15, 0.2, 400, 1); },
  whiff: () => noise(0.18, 0.12, 1500, 0.5, 0, 'highpass'),
  fire: () => { noise(0.6, 0.3, 700, 0.5); tone(140, 0.5, 'sawtooth', 0.05, 200); },
  fizzle: () => noise(0.35, 0.12, 3000, 3),
  dodge: () => tone(500, 0.12, 'triangle', 0.08, 300),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.13, 0, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.45, 'triangle', 0.12, 0, i * 0.2)),
  page: () => noise(0.25, 0.12, 2500, 0.4),
};

// 野営のたき火の音（小さなぱちぱち）
export function fireLoop(start) {
  if (!start) { if (fireNode) { clearInterval(fireNode); fireNode = null; } return; }
  if (fireNode || !on) return;
  fireNode = setInterval(() => { if (Math.random() < 0.6) noise(0.03 + Math.random() * 0.05, 0.05 + Math.random() * 0.08, 2000 + Math.random() * 3000, 2); }, 140);
}
