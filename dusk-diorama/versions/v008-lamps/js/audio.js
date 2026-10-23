// 音: BGM・環境音・足音・たき火を、それぞれ選んで重ねる（右上の「♪ 音」）＋くべる・崩れる・つまむの効果音
// 音の元は Stable Audio 3（手元）で作り、ffmpeg でつなぎ目のない輪と音量をそろえた（audio/）。鳴らす物だけ読む
const ROWS = [
  { id: 'bgm', name: 'BGM', vol: 0.6, on: true, items: [['bgm-celtic-woodflute', 'ケルト・木の笛'], ['bgm-celtic-tinwhistle', 'ケルト・ティンホイッスル'], ['bgm-celtic-lowwhistle', 'ケルト・ローホイッスル'], ['bgm-celtic-pipes', 'ケルト・パイプ'], ['bgm-cello', 'チェロと鐘'], ['bgm-hurdy', 'ハーディ・ガーディ'], ['bgm-musicbox', 'オルゴール']] },
  { id: 'amb', name: '環境音', vol: 0.7, on: true, items: [['amb-wind', '廃村の風'], ['amb-ash', '降る灰と地鳴り'], ['amb-night', '夜の虫とフクロウ']] },
  { id: 'fire', name: 'たき火', vol: 0.8, on: true, items: [['fire-crackle', '小枝のぱちぱち'], ['fire-roar', '大きな炎'], ['fire-embers', '残り火']] },
  { id: 'step', name: '足音', vol: 0.7, on: false, items: [['step-dirt', '土と枯れ草'], ['step-gravel', '砂利と灰'], ['step-stone', '石だたみ']] },
  { id: 'sfx', name: '効果音', vol: 0.8, on: true, items: [['sfx', 'くべる・崩れる・つまむ']] },
];
const KEY = 'dusk-diorama-audio';
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
for (const r of ROWS) state[r.id] = Object.assign({ on: r.on, pick: r.items[0][0], vol: r.vol }, state[r.id]);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } };

let ctx = null, master = null, started = false;
const buffers = new Map(), live = {};
function ensureCtx() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.connect(ctx.destination);
  for (const r of ROWS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); live[r.id] = { bus: g, src: null, srcGain: null, pick: null }; }
  return ctx;
}
function load(name) {
  if (!buffers.has(name)) buffers.set(name, fetch(`../../audio/${name}.ogg`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null));
  return buffers.get(name);
}
async function play(id) {
  if (!started || id === 'sfx') return;
  const S = state[id], L = live[id];
  if (!S.on) { if (L.src) fadeOut(L, ctx.currentTime); L.pick = null; return; }
  if (L.pick === S.pick && L.src) return;
  L.pick = S.pick;
  const buf = await load(S.pick);
  if (!buf || L.pick !== S.pick || !state[id].on) return;
  if (L.src) fadeOut(L, ctx.currentTime);
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.loop = true; src.connect(g); g.connect(L.bus);
  g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
  src.start(0, id === 'bgm' ? 0 : Math.random() * buf.duration);
  L.src = src; L.srcGain = g;
}
function fadeOut(L, t) { const s = L.src, g = L.srcGain; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1); s.stop(t + 1.1); L.src = null; L.srcGain = null; }

// 「はじめる」で呼ぶ（ブラウザは押したあとでないと音を出せない）
export function startAudio() { ensureCtx(); ctx.resume(); started = true; for (const r of ROWS) play(r.id); for (const n of ['sfx-flare', 'sfx-flare2', 'sfx-crumble', 'sfx-crumble2', 'sfx-pick']) if (state.sfx.on) load(n); }
export async function sfx(name, vol = 1, rate = 1) {
  if (!started || !state.sfx.on) return;
  const buf = await load(name); if (!buf) return;
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol * state.sfx.vol; s.connect(g); g.connect(master); s.start();
}
// 毎こま: たき火は火の大きさ、足音は運んでいるあいだ
export function tickAudio({ fire = 1, walk = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const r of ROWS) { if (r.id === 'sfx') continue; let v = state[r.id].vol; if (r.id === 'fire') v *= fire; if (r.id === 'step') v *= walk; live[r.id].bus.gain.setTargetAtTime(v, t, 0.25); }
}

export function mountAudioPanel() {
  const btn = document.createElement('button'); btn.className = 'snd-btn'; btn.textContent = '♪ 音'; btn.setAttribute('aria-expanded', 'false');
  const pane = document.createElement('div'); pane.className = 'snd-pane'; pane.hidden = true;
  pane.innerHTML = ROWS.map(r => `<div class="snd-row" data-id="${r.id}">
    <button class="snd-on" aria-pressed="${state[r.id].on}">${r.name}</button>
    ${r.items.length > 1 ? `<select aria-label="${r.name}をえらぶ">${r.items.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>` : `<span class="snd-one">${r.items[0][1]}</span>`}
    <input type="range" min="0" max="1" step="0.05" aria-label="${r.name}の大きさ"></div>`).join('');
  document.body.append(btn, pane);
  if (new URLSearchParams(location.search).get('snd') === 'open') { pane.hidden = false; btn.setAttribute('aria-expanded', 'true'); } // 撮影用
  btn.addEventListener('click', () => { pane.hidden = !pane.hidden; btn.setAttribute('aria-expanded', String(!pane.hidden)); });
  for (const row of pane.querySelectorAll('.snd-row')) {
    const id = row.dataset.id, S = state[id], on = row.querySelector('.snd-on'), sel = row.querySelector('select'), vol = row.querySelector('input');
    if (sel) sel.value = S.pick; vol.value = S.vol;
    on.addEventListener('click', () => { S.on = !S.on; on.setAttribute('aria-pressed', String(S.on)); save(); if (started) play(id); });
    if (sel) sel.addEventListener('change', () => { S.pick = sel.value; save(); if (started && S.on) play(id); });
    vol.addEventListener('input', () => { S.vol = +vol.value; save(); });
  }
  for (const el of [btn, pane]) for (const ev of ['pointerdown', 'wheel']) el.addEventListener(ev, e => e.stopPropagation());
}
