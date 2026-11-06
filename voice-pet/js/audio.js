// マイクと音。声は押しているあいだだけメモリにためて、数にしたら捨てる（送らない・保存しない）
let ac = null, stream = null, srcNode = null, proc = null, analyser = null;
let chunks = null, level = 0;
export let muted = false;
export function setMuted(m) { muted = m; }

export function ctx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

// マイクを開く（はじめて押したとき。許可のたずねはブラウザが出す）
export async function openMic() {
  ctx();
  if (stream) return true;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  srcNode = ac.createMediaStreamSource(stream);
  analyser = ac.createAnalyser(); analyser.fftSize = 1024;
  proc = ac.createScriptProcessor(2048, 1, 1);
  proc.onaudioprocess = e => {
    const d = e.inputBuffer.getChannelData(0);
    let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    level = Math.sqrt(s / d.length);
    if (chunks) chunks.push(new Float32Array(d));
  };
  const sink = ac.createGain(); sink.gain.value = 0; // 自分の声をスピーカーへ出さない
  srcNode.connect(analyser); srcNode.connect(proc); proc.connect(sink); sink.connect(ac.destination);
  return true;
}
export function micLevel() { return level; }
export function startRec() { chunks = []; }
export function stopRec() {
  const c = chunks || []; chunks = null;
  let n = 0; for (const a of c) n += a.length;
  const out = new Float32Array(n); let o = 0;
  for (const a of c) { out.set(a, o); o += a.length; }
  return { samples: out, sr: ac ? ac.sampleRate : 48000 };
}
// マイクを閉じる（タブを離れたときなど）
export function closeMic() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; if (proc) proc.disconnect(); if (srcNode) srcNode.disconnect();
  proc = srcNode = analyser = null; level = 0;
}

// 鳴き声を鳴らす（作った Float32Array を流す）
export function play(samples, sr, vol = 0.8) {
  if (muted) return;
  const a = ctx();
  const buf = a.createBuffer(1, samples.length, sr);
  buf.copyToChannel(samples, 0);
  const s = a.createBufferSource(); s.buffer = buf;
  const g = a.createGain(); g.gain.value = vol;
  // すこしだけ部屋の響き
  const d = a.createDelay(); d.delayTime.value = 0.045;
  const fb = a.createGain(); fb.gain.value = 0.18;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  s.connect(g); g.connect(a.destination);
  g.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); fb.connect(a.destination);
  s.start();
}

// 小さな効果音（たまごが割れる・ぽん）
export function blip(kind) {
  if (muted) return;
  const a = ctx(), t = a.currentTime;
  if (kind === 'crack') {
    const n = Math.floor(a.sampleRate * 0.12), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.2;
    const g = a.createGain(); g.gain.value = 0.5;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  } else {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(kind === 'pop' ? 520 : 380, t); o.frequency.exponentialRampToValueAtTime(kind === 'pop' ? 980 : 240, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.2);
  }
}
