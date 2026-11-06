// しぐさ: 遊ぶ人への反応と、ひとりのときの小さな動き。engrave.js の絵が読む数（tilt listen sniff mouth chin sway breath blinkNow earKick）を作る
// かわいさは形より、関わったときの反応で（ART.md）。首をかしげるのは研究でも効く（Mara & Appel 2015）
const lerp = (a, b, t) => a + (b - a) * t;

export function makeSt(seed = 1) {
  return { t: 0, tilt: 0, tiltT: 0, listen: 0, sniff: 0, mouth: 0, chin: 0, sway: 0, breath: 0, blinkNow: false, earKick: 0,
    hop: 0, hopV: 0, pet: 0, happy: 0, puzzled: 0, side: seed % 2 ? 1 : -1, blinkT: 2, blinkLeft: 0, idleT: 2.5, act: null, actT: 0 };
}

// inp: { listening（声を聞いている）, level（声の大きさ）, mouth（鳴いている口 0..1）, petting（なでている） }
export function step(st, dt, ph, inp = {}) {
  st.t += dt;
  const pace = lerp(0.8, 1.35, ph.legs);
  st.breath = Math.sin(st.t * Math.PI * 2 * 0.3 * pace);
  // まばたき（なでられているあいだは目を細めたまま）
  st.blinkT -= dt;
  if (st.blinkT < 0) { st.blinkLeft = 0.12; st.blinkT = 2 + Math.random() * 4; if (Math.random() < 0.25) st.blinkT = 0.25; }
  st.blinkLeft -= dt;
  st.pet = Math.max(0, st.pet - dt * 1.2);
  st.blinkNow = st.blinkLeft > 0 || st.pet > 0.35;
  // ひとりのときの小さな動き（耳ぴくっ・かしげ・かぐ・ゆれ）
  st.idleT -= dt * pace;
  if (!st.act && st.idleT < 0 && !inp.listening && inp.mouth < 0.05) {
    const r = Math.random();
    st.act = r < 0.3 ? 'ear' : r < 0.55 ? 'tilt' : r < 0.8 ? 'sniff' : 'sway';
    st.actT = 0; st.side = Math.random() < 0.5 ? -1 : 1;
  }
  let tiltT = 0, sniff = 0, sway = 0;
  if (st.act) {
    st.actT += dt * pace;
    const u = st.actT, env = Math.min(1, u / 0.3) * Math.min(1, Math.max(0, (dur(st.act) - u) / 0.3));
    if (st.act === 'ear' && (Math.abs(u - 0.1) < 0.05 || Math.abs(u - 0.45) < 0.05)) st.earKick = 1;
    if (st.act === 'tilt') tiltT = 0.28 * st.side * env;
    if (st.act === 'sniff') sniff = Math.sin(u * 24) * env;
    if (st.act === 'sway') sway = Math.sin(u * 2.6) * env;
    if (u > dur(st.act)) { st.act = null; st.idleT = 3 + Math.random() * 4; }
  }
  // 声を聞いているとき: 首をかしげて耳をすます（声の大きさで耳がぴくっと）
  if (inp.listening) { tiltT = 0.3 * st.side; st.listen = Math.min(1, st.listen + dt * 4); if (inp.level > 0.5 && Math.random() < dt * 3) st.earKick = 0.7; }
  else st.listen = Math.max(0, st.listen - dt * 3);
  // わからなかったとき: 反対へかしげる
  st.puzzled = Math.max(0, st.puzzled - dt);
  if (st.puzzled > 0) tiltT = -0.35 * st.side;
  // なでられているとき: ゆっくり体をゆらす
  if (st.pet > 0.35) sway = Math.sin(st.t * 3) * 0.6;
  st.tilt += (tiltT - st.tilt) * (1 - Math.exp(-dt * 7));
  st.sniff = sniff; st.sway = lerp(st.sway, sway, 1 - Math.exp(-dt * 6));
  st.earKick = Math.max(0, st.earKick - dt * 4);
  st.mouth = inp.mouth || 0;
  st.chin += ((st.mouth > 0.05 ? 1 : 0) - st.chin) * (1 - Math.exp(-dt * 8));
  // とびはね（ばね）
  st.hopV -= dt * 30; st.hop += st.hopV * dt;
  if (st.hop < 0) { st.hop = 0; st.hopV = st.hopV < -2 ? -st.hopV * 0.25 : 0; }
  st.happy = Math.max(0, st.happy - dt * 0.6);
}
const dur = a => ({ ear: 0.8, tilt: 1.8, sniff: 1.3, sway: 1.8 }[a] || 1);
export function hop(st, h = 5) { if (st.hop < 0.05) st.hopV = h; }
