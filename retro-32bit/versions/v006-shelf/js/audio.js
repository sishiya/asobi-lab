// 音を鳴らす（8ビット互換機の main.js の setupAudio と同じ形: ためておく輪の入れ物から鳴らす。こちらは左右）
//   const a = createAudio(); a.push({ L, R }); a.setGain(0〜1); a.ctx.resume() / suspend()
export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const N = 16384, mask = N - 1, ringL = new Float32Array(N), ringR = new Float32Array(N);
  const a = { ctx, r: 0, w: 0, gain: ctx.createGain() };
  const node = ctx.createScriptProcessor(1024, 0, 2);
  node.onaudioprocess = (e) => {
    const L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1);
    for (let i = 0; i < L.length; i++) {
      if (a.r !== a.w) { L[i] = ringL[a.r]; R[i] = ringR[a.r]; a.r = (a.r + 1) & mask; } else { L[i] = 0; R[i] = 0; }
    }
  };
  a.push = ({ L, R }) => {
    if (((a.w - a.r) & mask) > 6000) return; // おくれすぎたら捨てる
    for (let i = 0; i < L.length; i++) {
      const n = (a.w + 1) & mask;
      if (n === a.r) break;
      ringL[a.w] = L[i] * 1.6; ringR[a.w] = R[i] * 1.6; a.w = n;
    }
  };
  a.setGain = (v) => { a.gain.gain.value = v; };
  node.connect(a.gain).connect(ctx.destination);
  return a;
}
