// ルックの実験室: 4つの案。どれも「同じ景色の絵」に工夫を1つだけ足す。
// 景色は線形の色で小さな絵に描かれるので、画面に出すときは toS()（sRGB へ）を通す。
import * as THREE from 'three';
import { ants, birds, cards, beetles } from './swarms.js';
import { turing, still, shadows, compound, soap } from './odd.js';

const quadGeo = new THREE.PlaneGeometry(2, 2);
const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const COMMON = `
  vec3 toS(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2)); }
  float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;
function pass(fs, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: COMMON + fs, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(quadGeo, m));
  return { m, run(renderer, target) { renderer.setRenderTarget(target); renderer.render(s, qCam); } };
}
const rtOpt = (type = THREE.HalfFloatType) => ({ type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
// 人のいる所（画面の uv）
function walkerUv(ctx) {
  const v = ctx.walker.position.clone(); v.y += 1; v.project(ctx.camera);
  return new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
}

// 0. 元の絵（くらべる用）
export const raw = {
  ja: '元の絵', note: 'くらべる用。ふつうに描いた景色',
  render(ctx) { ctx.renderer.setRenderTarget(null); ctx.renderer.render(ctx.scene, ctx.camera); },
};

// 1. 時差: 人から遠いほど、少し前の時間の絵
export const lag = {
  ja: '時差', note: '自分から遠いほど、少し前の時間が映る（画面のはしで2秒前）。動く物は遠くでのび、歩くと世界がしなる',
  N: 48,
  init(ctx) {
    this.hist = new THREE.WebGLArrayRenderTarget(4, 4, this.N);
    Object.assign(this.hist.texture, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.hist.depthBuffer = true;
    this.head = 0; this.filled = 0;
    this.p = pass(`
      precision highp sampler2DArray;
      uniform sampler2DArray tHist; uniform float uHead, uN, uFill, uAspect; uniform vec2 uC; varying vec2 vUv;
      vec3 at(float k){ k = min(k, uFill); return texture(tHist, vec3(vUv, mod(uHead - k + uN, uN))).rgb; }
      void main(){
        float r = length((vUv - uC) * vec2(uAspect, 1.0));
        float d = smoothstep(0.08, 0.95, r) * (uN - 2.0);
        float k0 = floor(d);
        vec3 c = mix(at(k0), at(k0 + 1.0), d - k0);
        gl_FragColor = vec4(toS(c), 1.0);
      }`, { tHist: { value: this.hist.texture }, uHead: { value: 0 }, uN: { value: this.N }, uFill: { value: 0 }, uAspect: { value: 1 }, uC: { value: new THREE.Vector2() } });
  },
  resize(w, h) { const s = Math.min(1, 900 / Math.max(w, h)); this.hist.setSize(Math.round(w * s), Math.round(h * s), this.N); this.p.m.uniforms.uAspect.value = w / h; this.filled = 0; },
  render(ctx, t, dt) {
    const { renderer } = ctx;
    this.acc = (this.acc || 0) + dt;
    if (this.acc >= 1 / 24 || !this.filled) { this.acc = Math.min(this.acc - 1 / 24, 1 / 24); this.head = (this.head + 1) % this.N; this.filled = Math.min(this.N - 1, this.filled + 1); }
    renderer.setRenderTarget(this.hist, this.head); renderer.clear(); renderer.render(ctx.scene, ctx.camera);
    const u = this.p.m.uniforms; u.uHead.value = this.head; u.uFill.value = this.filled; u.uC.value.copy(walkerUv(ctx));
    this.p.run(renderer, null);
  },
};

// 2. 墨流し: 物のふちから、墨の輪が絶えず広がる。輪はゆっくりした渦で流れ、動く物がかきまぜる
// 状態の絵: rgb＝墨の色、a＝その輪が生まれた時刻（となりへ1マスずつ広がる＝距離の分だけ古い）
export const marble = {
  ja: '墨流し', note: '物のふちから墨の輪が広がり、水に浮いて流れる。動く物が輪をかきまぜる',
  init(ctx) {
    this.scn = new THREE.WebGLRenderTarget(4, 4, { ...rtOpt(), depthBuffer: true });
    this.a = new THREE.WebGLRenderTarget(4, 4, rtOpt(THREE.FloatType)); this.b = new THREE.WebGLRenderTarget(4, 4, rtOpt(THREE.FloatType));
    this.step = pass(`
      uniform sampler2D tS, tScene; uniform vec2 uTx; uniform float uT, uDt, uFresh; varying vec2 vUv;
      vec3 sc(vec2 uv){ return toS(texture2D(tScene, uv).rgb); }
      void main(){
        vec2 p = vUv * vec2(1.6, 1.0);
        vec2 v = vec2(sin(p.y * 4.0 + uT * 0.21) + 0.5 * sin(p.y * 9.0 - uT * 0.17 + p.x * 3.0),
                      sin(p.x * 5.0 - uT * 0.19) + 0.5 * cos(p.x * 11.0 + uT * 0.13 - p.y * 2.0)) * uTx * 0.35;
        vec2 q = vUv - v;
        vec4 s = texture2D(tS, q);
        float k = uDt * 1.0;                                           // 1マスごとに古くなる時間
        vec4 n;
        for (int i = 0; i < 8; i++) {                                   // となり8マスから広がる（ななめは1.41倍古く）
          float a = float(i) * 0.7853982; vec2 o = vec2(cos(a), sin(a)); float l = (i - (i / 2) * 2) == 1 ? 1.4142 : 1.0;
          n = texture2D(tS, q + o * l * uTx); if (n.a - k * l > s.a) s = vec4(n.rgb, n.a - k * l);
        }
        vec3 c = sc(vUv);
        vec2 e = uTx * 1.5;
        float edge = length(c - sc(vUv + vec2(e.x, 0.0))) + length(c - sc(vUv - vec2(e.x, 0.0))) + length(c - sc(vUv + vec2(0.0, e.y))) + length(c - sc(vUv - vec2(0.0, e.y)));
        if (edge > 0.32) s = vec4(c, uT);                              // ふちで墨を落とす
        if (uFresh > 0.5) s = vec4(c, uT - 60.0);
        gl_FragColor = s;
      }`, { tS: { value: null }, tScene: { value: this.scn.texture }, uTx: { value: new THREE.Vector2() }, uT: { value: 0 }, uDt: { value: 0.016 }, uFresh: { value: 1 } });
    this.out = pass(`
      uniform sampler2D tS; uniform float uT; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tS, vUv);
        float age = uT - s.a;
        float q = s.a * 2.2;                                           // 1秒に2.2本の輪
        float d = abs(fract(q) - 0.5) / max(fwidth(q), 1e-4);
        float line = 1.0 - clamp(d - 0.7, 0.0, 1.0);
        float fade = exp(-age * 0.12);
        float band = mod(floor(q + 0.5), 3.0);
        vec3 tint = s.rgb / max(max(s.r, max(s.g, s.b)), 0.08);
        vec3 ink = band < 0.5 ? vec3(0.08, 0.08, 0.1) : band < 1.5 ? mix(vec3(0.14, 0.23, 0.45), tint * 0.45, 0.5) : tint * 0.55;
        vec3 paper = vec3(0.95, 0.93, 0.87) * (0.97 + 0.03 * hash(floor(vUv * 700.0)));
        paper = mix(paper, paper * (0.75 + 0.25 * tint), 0.35 * fade);
        gl_FragColor = vec4(mix(paper, ink, line * (0.25 + 0.7 * fade)), 1.0);
      }`, { tS: { value: null }, uT: { value: 0 } });
  },
  resize(w, h) {
    const s = Math.min(1, 640 / Math.max(w, h)), W = Math.round(w * s), H = Math.round(h * s);
    for (const r of [this.scn, this.a, this.b]) r.setSize(W, H);
    this.step.m.uniforms.uTx.value.set(1 / W, 1 / H); this.fresh = true;
  },
  render(ctx, t, dt) {
    const { renderer } = ctx, u = this.step.m.uniforms;
    renderer.setRenderTarget(this.scn); renderer.clear(); renderer.render(ctx.scene, ctx.camera);
    u.tS.value = this.a.texture; u.uT.value = t; u.uDt.value = Math.max(dt, 1 / 120); u.uFresh.value = this.fresh ? 1 : 0; this.fresh = false;
    this.step.run(renderer, this.b);
    [this.a, this.b] = [this.b, this.a];
    this.out.m.uniforms.tS.value = this.a.texture; this.out.m.uniforms.uT.value = t; this.out.run(renderer, null);
  },
};

// 3. 群れ: 小さな魚は暗い所でゆっくり、明るい所で速く泳ぐ → 暗い所にたまって絵になる
export const swarm = {
  ja: '魚', note: '6万匹の小さな魚が、暗い所ではゆっくり泳ぐので、そこにたまって絵になる',
  S: 256,
  init(ctx) {
    const S = this.S, n = S * S, d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { d[i * 4] = Math.random(); d[i * 4 + 1] = Math.random(); const a = Math.random() * 6.28; d[i * 4 + 2] = Math.cos(a) * 0.05; d[i * 4 + 3] = Math.sin(a) * 0.05; }
    const tex = new THREE.DataTexture(d, S, S, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
    const o = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false };
    this.pa = new THREE.WebGLRenderTarget(S, S, o); this.pb = new THREE.WebGLRenderTarget(S, S, o);
    this.seed = pass('uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', { t: { value: tex } });
    this.seeded = false;
    this.scn = new THREE.WebGLRenderTarget(4, 4, { ...rtOpt(), depthBuffer: true });
    this.step = pass(`
      uniform sampler2D tP, tScene; uniform float uT, uDt, uAspect; varying vec2 vUv;
      float dens(vec2 uv){ vec3 c = toS(texture2D(tScene, uv).rgb); float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); return clamp(pow(smoothstep(0.42, 0.95, 1.0 - lum(c)), 1.3) + s * 0.25, 0.0, 1.0); }
      void main(){
        vec4 p = texture2D(tP, vUv);
        vec2 x = p.xy, v = p.zw;
        float D = dens(x);
        vec2 e = vec2(0.006 / uAspect, 0.006);
        vec2 g = vec2(dens(x + vec2(e.x, 0.0)) - dens(x - vec2(e.x, 0.0)), dens(x + vec2(0.0, e.y)) - dens(x - vec2(0.0, e.y)));
        float h = hash(vUv * 517.0 + floor(uT * 3.0 + hash(vUv) * 3.0));
        float ang = atan(v.y, v.x) + (h - 0.5) * 1.6 * uDt * 6.0;      // ふらふら向きを変える
        float sp = mix(0.32, 0.012, D);                               // 暗い所はゆっくり
        vec2 dir = vec2(cos(ang), sin(ang));
        dir += g * 6.0; dir = normalize(dir + 1e-5);
        v = mix(v, dir * sp, min(1.0, uDt * 4.0));
        x += v * uDt * vec2(1.0 / uAspect, 1.0);
        if (x.x < 0.0 || x.x > 1.0 || x.y < 0.0 || x.y > 1.0 || (D < 0.04 && h < 0.004)) x = vec2(hash(vUv + uT), hash(vUv.yx - uT));
        gl_FragColor = vec4(x, v);
      }`, { tP: { value: null }, tScene: { value: this.scn.texture }, uT: { value: 0 }, uDt: { value: 0.016 }, uAspect: { value: 1 } });
    // 魚を点で描く（向きに合わせて体と尾）
    const ref = new Float32Array(n * 2); for (let i = 0; i < n; i++) { ref[i * 2] = (i % S + 0.5) / S; ref[i * 2 + 1] = (Math.floor(i / S) + 0.5) / S; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
    this.fishM = new THREE.ShaderMaterial({
      uniforms: { tP: { value: null }, tScene: { value: this.scn.texture }, uSize: { value: 5 } }, transparent: true, depthTest: false,
      vertexShader: COMMON + `
        attribute vec2 ref; uniform sampler2D tP, tScene; uniform float uSize; varying vec3 vC; varying float vA; varying float vD;
        void main(){ vec4 p = texture2D(tP, ref); vA = atan(p.w, p.z);
          vec3 c = toS(texture2D(tScene, p.xy).rgb); vC = c * 0.7; vD = smoothstep(0.42, 0.95, 1.0 - lum(c));
          gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uSize; }`,
      fragmentShader: `varying vec3 vC; varying float vA; varying float vD;
        void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float c = cos(vA), s = sin(vA); q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
          float body = (q.x * q.x) / 0.36 + (q.y * q.y) / 0.06; float tail = step(-0.95, q.x) * step(q.x, -0.45) * step(abs(q.y), (-0.45 - q.x) * 0.9);
          if (body > 1.0 && tail < 0.5) discard; gl_FragColor = vec4(vC, 0.22 + 0.73 * vD); }`,
    });
    this.fish = new THREE.Points(g, this.fishM); this.fish.frustumCulled = false;
    this.fs = new THREE.Scene(); this.fs.add(this.fish);
    this.bg = pass(`varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(0.93, 0.95, 0.94) - 0.04 * vUv.y, 1.0); }`, {});
  },
  resize(w, h, dpr) { const s = Math.min(1, 640 / Math.max(w, h)); this.scn.setSize(Math.round(w * s), Math.round(h * s)); this.step.m.uniforms.uAspect.value = w / h; this.fishM.uniforms.uSize.value = Math.max(4, 3.2 * dpr * Math.sqrt(w * h / 921600) + 2); },
  light: true,
  render(ctx, t, dt) {
    const { renderer } = ctx;
    if (!this.seeded) { this.seed.run(renderer, this.pa); this.seeded = true; }
    renderer.setRenderTarget(this.scn); renderer.clear(); renderer.render(ctx.scene, ctx.camera);
    const u = this.step.m.uniforms; u.tP.value = this.pa.texture; u.uT.value = t; u.uDt.value = Math.min(dt, 0.033);
    this.step.run(renderer, this.pb); [this.pa, this.pb] = [this.pb, this.pa];
    this.bg.run(renderer, null);
    this.fishM.uniforms.tP.value = this.pa.texture;
    renderer.autoClear = false; renderer.render(this.fs, qCam); renderer.autoClear = true;
  },
};

// 4. 一筆: 画面を1本のヒルベルト曲線でうめ、暗い所ほどジグザグを大きく
function hilbert(order) {
  const n = 1 << order, pts = new Float32Array(n * n * 2);
  for (let d = 0; d < n * n; d++) {
    let x = 0, y = 0, t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t / 2), ry = 1 & (t ^ rx);
      if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } [x, y] = [y, x]; }
      x += s * rx; y += s * ry; t = Math.floor(t / 4);
    }
    pts[d * 2] = (x + 0.5) / n; pts[d * 2 + 1] = (y + 0.5) / n;
  }
  return pts;
}
export const stroke = {
  ja: '一筆', note: '画面ぜんぶが1本の線。暗い所ほど線が細かくゆれる',
  init(ctx) {
    this.scn = new THREE.WebGLRenderTarget(4, 4, { ...rtOpt(), depthBuffer: true });
    this.lineM = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.scn.texture }, uAmp: { value: 0.004 }, uBox: { value: new THREE.Vector4(0, 0, 1, 1) } }, depthTest: false,
      vertexShader: COMMON + `
        attribute vec2 aP, aN; attribute float aSide; uniform sampler2D tScene; uniform float uAmp; uniform vec4 uBox; varying vec3 vC;
        void main(){
          vec2 uv = uBox.xy + aP * uBox.zw;                           // 正方形の曲線を画面に合わせて切りとる
          vec3 c = toS(texture2D(tScene, uv).rgb);
          float D = smoothstep(0.45, 0.88, 1.0 - lum(c));
          uv += aN * aSide * D * uAmp * vec2(uBox.z / uBox.w, 1.0) * uBox.w;
          float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
          vC = mix(vec3(0.82, 0.8, 0.74), mix(vec3(0.1, 0.1, 0.12), c * 0.7, clamp(sat * 1.4, 0.0, 0.6)), 0.25 + 0.75 * D);
          gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0); }`,
      fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
    });
    this.bg = pass(`varying vec2 vUv; void main(){ gl_FragColor = vec4(0.96, 0.94, 0.89, 1.0); }`, {});
    this.ls = new THREE.Scene();
  },
  build(order) {
    if (this.order === order) return; this.order = order;
    if (this.line) { this.ls.remove(this.line); this.line.geometry.dispose(); }
    const p = hilbert(order), n = p.length / 2, nrm = new Float32Array(n * 2), side = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = p[b * 2] - p[a * 2], dy = p[b * 2 + 1] - p[a * 2 + 1], l = Math.hypot(dx, dy) || 1;
      nrm[i * 2] = -dy / l; nrm[i * 2 + 1] = dx / l; side[i] = i % 2 ? 1 : -1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aP', new THREE.BufferAttribute(p, 2)); g.setAttribute('aN', new THREE.BufferAttribute(nrm, 2)); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.line = new THREE.Line(g, this.lineM); this.line.frustumCulled = false; this.ls.add(this.line);
    this.lineM.uniforms.uAmp.value = 0.62 / (1 << order);
  },
  resize(w, h) {
    const s = Math.min(1, 640 / Math.max(w, h)); this.scn.setSize(Math.round(w * s), Math.round(h * s));
    const big = Math.max(w, h); this.build(big > 1000 ? 8 : 7);
    // 正方形を長い辺に合わせ、短い辺ははみ出す
    const sx = big / w, sy = big / h; this.lineM.uniforms.uBox.value.set((1 - sx) / 2, (1 - sy) / 2, sx, sy);
  },
  render(ctx) {
    const { renderer } = ctx;
    renderer.setRenderTarget(this.scn); renderer.clear(); renderer.render(ctx.scene, ctx.camera);
    this.bg.run(renderer, null);
    renderer.autoClear = false; renderer.render(this.ls, qCam); renderer.autoClear = true;
  },
};

export const LOOKS = [raw, lag, marble, stroke, swarm, ants, birds, cards, beetles, turing, still, shadows, compound, soap];
// 組（ボタンの区切り）
for (const [g, list] of [['', [raw]], ['最初の案', [lag, marble, stroke]], ['群れ', [swarm, ants, birds, cards, beetles]], ['へんてこ', [turing, still, shadows, compound, soap]]]) for (const L of list) L.group = g;
