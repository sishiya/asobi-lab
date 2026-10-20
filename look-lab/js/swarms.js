// ルックの実験室: 群れ系。たくさんの小さなものが、それぞれ簡単な決まりで動くと、景色が浮かぶ。
// 動きは GPU の絵（1つの画素＝1匹: x, y, 向きなど）を毎コマ書きかえる。
import * as THREE from 'three';

const quadGeo = new THREE.PlaneGeometry(2, 2);
const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const COMMON = `
  vec3 toS(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2)); }
  float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float dark(vec3 c){ float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); return clamp(pow(smoothstep(0.42, 0.95, 1.0 - lum(c)), 1.3) + s * 0.25, 0.0, 1.0); }
`;
// マスゲームとテントウムシの色の板（sRGB）
const PALETTE = `
  const int NP = 10;
  vec3 pal(int i){
    if (i == 0) return vec3(0.95, 0.94, 0.9); if (i == 1) return vec3(0.13, 0.13, 0.15); if (i == 2) return vec3(0.8, 0.18, 0.15);
    if (i == 3) return vec3(0.96, 0.8, 0.22); if (i == 4) return vec3(0.17, 0.32, 0.7); if (i == 5) return vec3(0.24, 0.5, 0.24);
    if (i == 6) return vec3(0.52, 0.74, 0.32); if (i == 7) return vec3(0.55, 0.35, 0.2); if (i == 8) return vec3(0.62, 0.8, 0.92); return vec3(0.83, 0.68, 0.42);
  }
  int nearest(vec3 c){ int b = 0; float bd = 9.0; for (int i = 0; i < NP; i++){ vec3 d = pal(i) - c; float e = dot(d, d); if (e < bd){ bd = e; b = i; } } return b; }
`;
function pass(fs, uniforms, opts = {}) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: COMMON + fs, depthTest: false, depthWrite: false, ...opts });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(quadGeo, m));
  return { m, run(r, target) { r.setRenderTarget(target); r.render(s, qCam); } };
}
const linRT = (type = THREE.HalfFloatType, depth = false) => new THREE.WebGLRenderTarget(4, 4, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth });
const sceneRT = () => linRT(THREE.HalfFloatType, true);
function drawScene(ctx, rt) { ctx.renderer.setRenderTarget(rt); ctx.renderer.clear(); ctx.renderer.render(ctx.scene, ctx.camera); }

// 1匹＝1画素の動き（ping-pong）。init(i) が [x, y, z, w] を返す
function agents(S, init) {
  const n = S * S, d = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) d.set(init(i), i * 4);
  const tex = new THREE.DataTexture(d, S, S, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
  const o = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false };
  const A = { a: new THREE.WebGLRenderTarget(S, S, o), b: new THREE.WebGLRenderTarget(S, S, o), seeded: false };
  const seed = pass('uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', { t: { value: tex } });
  A.step = (r, p) => { if (!A.seeded) { seed.run(r, A.a); A.seeded = true; } p.m.uniforms.tP.value = A.a.texture; p.run(r, A.b); [A.a, A.b] = [A.b, A.a]; };
  // 点の形（1匹ずつ）。ref はその1匹の画素
  const ref = new Float32Array(n * 2); for (let i = 0; i < n; i++) { ref[i * 2] = (i % S + 0.5) / S; ref[i * 2 + 1] = (Math.floor(i / S) + 0.5) / S; }
  A.geo = new THREE.BufferGeometry(); A.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); A.geo.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
  A.points = (vs, fs, uniforms, extra = {}) => {
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader: COMMON + PALETTE + vs, fragmentShader: COMMON + PALETTE + fs, depthTest: false, depthWrite: false, transparent: true, ...extra });
    const p = new THREE.Points(A.geo, m); p.frustumCulled = false; const s = new THREE.Scene(); s.add(p);
    return { m, draw(r, target, clear = false) { r.setRenderTarget(target); const ac = r.autoClear; r.autoClear = clear; r.render(s, qCam); r.autoClear = ac; } };
  };
  return A;
}
const rnd = Math.random;
const sizeFor = (w, h, dpr, base) => Math.max(3, base * dpr * Math.sqrt(w * h / (921600 * dpr * dpr)) + 1);

// ---------------------------------------------------------------- アリ（墨と筆。2026-10-21 ユーザー「筆で書いた感がでるように」）
// においの道＝和紙にしみる墨。暗い所を歩くアリほど墨を多く落とすので、アリが景色を墨絵で描く。
// アリの体は墨の点3つ（頭・胸・腹）と、毛筆の細い線の脚・触角。茶色・つやは使わない（ゴキブリに見えないように）
export const ants = {
  ja: 'アリ', note: 'アリが墨をつけて歩く。暗い所ほど墨を多く落とすので、景色が墨絵になる。においの道もたどる',
  init(ctx) {
    this.scn = sceneRT(); this.ta = linRT(); this.tb = linRT();
    this.A = agents(160, () => [rnd(), rnd(), rnd() * 6.283, 0.55 + rnd() * 0.45]);   // w＝墨の濃さ（1匹ずつ）
    this.stepP = pass(`
      uniform sampler2D tP, tScene, tTrail; uniform float uT, uDt, uAspect; varying vec2 vUv;
      float sense(vec2 x){ return (1.0 - exp(-texture2D(tTrail, x).r * 1.5)) * 0.5 + dark(toS(texture2D(tScene, x).rgb)) * 3.0; }
      void main(){
        vec4 p = texture2D(tP, vUv); vec2 x = p.xy; float a = p.z;
        vec2 k = vec2(1.0 / uAspect, 1.0) * 0.014;
        float f = sense(x + vec2(cos(a), sin(a)) * k), l = sense(x + vec2(cos(a + 0.6), sin(a + 0.6)) * k), r = sense(x + vec2(cos(a - 0.6), sin(a - 0.6)) * k);
        float h = hash(vUv * 731.0 + uT);
        if (f < l || f < r) a += (l > r ? 1.0 : -1.0) * 6.0 * uDt;
        a += (h - 0.5) * 2.5 * uDt;
        float D = dark(toS(texture2D(tScene, x).rgb));
        x += vec2(cos(a), sin(a)) * mix(0.13, 0.025, D) * uDt * vec2(1.0 / uAspect, 1.0);
        x = fract(x);
        gl_FragColor = vec4(x, a, p.w);
      }`, { tP: { value: null }, tScene: { value: this.scn.texture }, tTrail: { value: null }, uT: { value: 0 }, uDt: { value: 0.016 }, uAspect: { value: 1 } });
    // 墨がにじんで、少しずつ乾いてうすれる
    this.decay = pass(`
      uniform sampler2D tT; uniform vec2 uTx; varying vec2 vUv;
      void main(){ float s = texture2D(tT, vUv).r * 0.52 + 0.12 * (texture2D(tT, vUv + vec2(uTx.x, 0.0)).r + texture2D(tT, vUv - vec2(uTx.x, 0.0)).r + texture2D(tT, vUv + vec2(0.0, uTx.y)).r + texture2D(tT, vUv - vec2(0.0, uTx.y)).r);
        gl_FragColor = vec4(vec3(s * 0.965), 1.0); }`, { tT: { value: null }, uTx: { value: new THREE.Vector2() } });
    this.deposit = this.A.points(`attribute vec2 ref; uniform sampler2D tP, tScene; varying float vI;
        void main(){ vec4 p = texture2D(tP, ref); vI = (0.0008 + 0.06 * pow(dark(toS(texture2D(tScene, p.xy).rgb)), 1.4)) * p.w; gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = 1.5; }`,
      'varying float vI; void main(){ gl_FragColor = vec4(vI, 0.0, 0.0, 1.0); }', { tP: { value: null }, tScene: { value: this.scn.texture } }, { blending: THREE.AdditiveBlending });
    // 和紙と墨（薄墨は少し青い灰、濃い所とふちは墨。紙の繊維とざらつき）
    this.bg = pass(`uniform sampler2D tT; uniform vec2 uTx; varying vec2 vUv;
      void main(){
        float T = texture2D(tT, vUv).r;
        float Tb = 0.0; for (int i = 0; i < 8; i++){ float a = float(i) * 0.785398; Tb += texture2D(tT, vUv + vec2(cos(a), sin(a)) * uTx * 3.0).r; } Tb /= 8.0;
        float grain = hash(floor(vUv / uTx * 1.5)), fib = smoothstep(0.985, 1.0, hash(floor(vec2(vUv.x * 60.0 + vUv.y * 9.0, vUv.y * 1400.0))));
        vec3 paper = vec3(0.955, 0.94, 0.9) * (0.975 + 0.025 * grain) - fib * 0.035;
        float wash = 1.0 - exp(-T * 2.2);
        float edge = clamp((T - Tb) * 5.0, 0.0, 1.0) * smoothstep(0.05, 0.3, T);   // ふちにたまる墨
        vec3 usu = vec3(0.47, 0.49, 0.53), sumi = vec3(0.07, 0.07, 0.08);
        vec3 c = mix(paper, usu, wash * (0.85 + 0.3 * (grain - 0.5)));
        c = mix(c, sumi, clamp(pow(wash, 2.2) * 0.85 + edge * 0.55, 0.0, 0.95));
        gl_FragColor = vec4(c, 1.0);
      }`, { tT: { value: null }, uTx: { value: new THREE.Vector2() } });
    this.draw = this.A.points(`
      attribute vec2 ref; uniform sampler2D tP; uniform float uSize; varying float vA; varying float vInk; varying float vSeed;
      void main(){ vec4 p = texture2D(tP, ref); vA = p.z; vInk = p.w; vSeed = hash(ref * 77.0);
        gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uSize; }`, `
      varying float vA; varying float vInk; varying float vSeed;
      float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
      float dab(vec2 q, vec2 c, vec2 r){ return length((q - c) / r); }      // 筆の点（1 がふち）
      void main(){
        vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float c = cos(vA), s = sin(vA); q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
        // 体: 頭・胸・腹を、すきまをあけた3つの点で（腰のくびれ）。腹は筆を置いて引いた形（後ろが細い）
        float head = dab(q, vec2(0.56, 0.0), vec2(0.15, 0.13));
        float tho = dab(q, vec2(0.2, 0.0), vec2(0.17, 0.085));
        float tail = clamp((-q.x - 0.1) / 0.75, 0.0, 1.0);
        float abd = dab(q, vec2(-0.36, 0.0), vec2(0.34, 0.22 * (1.0 - 0.55 * tail * tail)));
        float body = min(min(head, tho), abd);
        float cov = 1.0 - smoothstep(0.82, 1.0, body);
        // 脚と触角: 毛筆の細い線（先ほど細い）
        float lw = 0.03;
        float l = 9.0;
        for (int i = 0; i < 3; i++){ float fx = 0.3 - float(i) * 0.14; float bx = fx + (float(i) - 1.0) * 0.32;
          l = min(l, seg(vec2(q.x, abs(q.y)), vec2(fx, 0.03), vec2(fx + (float(i) - 1.0) * 0.12, 0.34)));
          l = min(l, seg(vec2(q.x, abs(q.y)), vec2(fx + (float(i) - 1.0) * 0.12, 0.34), vec2(bx, 0.6))); }
        float ant = min(seg(vec2(q.x, abs(q.y)), vec2(0.66, 0.05), vec2(0.82, 0.2)), seg(vec2(q.x, abs(q.y)), vec2(0.82, 0.2), vec2(0.97, 0.16)));
        float legs = 1.0 - smoothstep(lw * 0.4, lw, l);
        float ants = 1.0 - smoothstep(lw * 0.3, lw * 0.85, ant);
        // かすれ: 筆の毛のすじ（進む向きにのびる）
        float streak = hash(vec2(floor(q.y * 11.0 + vSeed * 7.0), vSeed));
        float dry = mix(1.0, 0.55 + 0.45 * step(0.25, streak), smoothstep(0.35, 0.95, body));
        float a = max(cov * dry, max(legs * 0.8, ants * 0.7)) * mix(0.55, 1.0, vInk);
        if (a < 0.02) discard;
        gl_FragColor = vec4(mix(vec3(0.3, 0.31, 0.34), vec3(0.05, 0.05, 0.06), vInk), a);
      }`, { tP: { value: null }, uSize: { value: 9 } });
  },
  resize(w, h, dpr) {
    const s = Math.min(1, 560 / Math.max(w, h)); this.scn.setSize(Math.round(w * s), Math.round(h * s));
    const tw = Math.round(w * s), th = Math.round(h * s); this.ta.setSize(tw, th); this.tb.setSize(tw, th);
    this.decay.m.uniforms.uTx.value.set(1 / tw, 1 / th); this.bg.m.uniforms.uTx.value.set(1 / tw, 1 / th);
    this.stepP.m.uniforms.uAspect.value = w / h; this.draw.m.uniforms.uSize.value = sizeFor(w, h, dpr, 9);
  },
  render(ctx, t, dt) {
    const r = ctx.renderer; drawScene(ctx, this.scn);
    const u = this.stepP.m.uniforms; u.uT.value = t; u.uDt.value = Math.min(dt, 0.033); u.tTrail.value = this.ta.texture;
    this.A.step(r, this.stepP);
    this.decay.m.uniforms.tT.value = this.ta.texture; this.decay.run(r, this.tb);
    this.deposit.m.uniforms.tP.value = this.A.a.texture; this.deposit.draw(r, this.tb);
    [this.ta, this.tb] = [this.tb, this.ta];
    this.bg.m.uniforms.tT.value = this.ta.texture; this.bg.run(r, null);
    this.draw.m.uniforms.tP.value = this.A.a.texture; this.draw.draw(r, null);
  },
};

// ---------------------------------------------------------------- ムクドリ（向きをそろえて飛ぶ）
export const birds = {
  ja: 'ムクドリ', note: '鳥は近くの鳥と向きをそろえて飛び続け、暗い所に引かれる。夕焼けに群れの影で景色が浮かぶ',
  init(ctx) {
    this.scn = sceneRT(); this.fa = linRT(); this.fb = linRT();
    this.A = agents(150, () => { const a = rnd() * 6.283; return [rnd(), rnd(), Math.cos(a) * 0.15, Math.sin(a) * 0.15]; });
    this.stepP = pass(`
      uniform sampler2D tP, tScene, tF; uniform float uT, uDt, uAspect; varying vec2 vUv;
      float D(vec2 x){ return dark(toS(texture2D(tScene, x).rgb)); }
      void main(){
        vec4 p = texture2D(tP, vUv); vec2 x = p.xy, v = p.zw;
        vec4 F = texture2D(tF, x); vec2 avg = F.xy / max(F.z, 1e-3);
        vec2 e = vec2(0.01 / uAspect, 0.01);
        vec2 g = vec2(D(x + vec2(e.x, 0.0)) - D(x - vec2(e.x, 0.0)), D(x + vec2(0.0, e.y)) - D(x - vec2(0.0, e.y)));
        float d = D(x), h = hash(vUv * 613.0 + floor(uT * 2.0));
        v += (avg - v) * min(1.0, uDt * 2.5);                          // そろえる
        v += g * 5.0 * uDt;                                            // 暗い所へ
        float a = atan(v.y, v.x) + (h - 0.5) * 3.0 * uDt;
        float sp = mix(0.42, 0.035, smoothstep(0.0, 0.6, d));
        v = vec2(cos(a), sin(a)) * sp;
        x += v * uDt * vec2(1.0 / uAspect, 1.0); x = fract(x);
        gl_FragColor = vec4(x, v);
      }`, { tP: { value: null }, tScene: { value: this.scn.texture }, tF: { value: null }, uT: { value: 0 }, uDt: { value: 0.016 }, uAspect: { value: 1 } });
    this.deposit = this.A.points(`attribute vec2 ref; uniform sampler2D tP; varying vec2 vV; void main(){ vec4 p = texture2D(tP, ref); vV = p.zw; gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = 3.0; }`,
      'varying vec2 vV; void main(){ gl_FragColor = vec4(vV, 1.0, 1.0); }', { tP: { value: null } }, { blending: THREE.AdditiveBlending });
    this.blur = pass(`uniform sampler2D tF; uniform vec2 uTx; varying vec2 vUv; void main(){ vec4 s = vec4(0.0); for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) s += texture2D(tF, vUv + vec2(float(i), float(j)) * uTx); gl_FragColor = s / 25.0; }`, { tF: { value: null }, uTx: { value: new THREE.Vector2() } });
    this.bg = pass(`varying vec2 vUv; void main(){ vec3 c = mix(vec3(0.98, 0.78, 0.6), vec3(0.62, 0.6, 0.78), vUv.y); c = mix(c, vec3(1.0, 0.9, 0.7), exp(-length((vUv - vec2(0.7, 0.25)) * vec2(1.6, 1.0)) * 4.0) * 0.5); gl_FragColor = vec4(c, 1.0); }`, {});
    this.draw = this.A.points(`
      attribute vec2 ref; uniform sampler2D tP; uniform float uSize; varying float vA; varying float vF;
      void main(){ vec4 p = texture2D(tP, ref); vA = atan(p.w, p.z); vF = hash(ref * 91.0); gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uSize; }`, `
      uniform float uT; varying float vA; varying float vF;
      void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float c = cos(vA), s = sin(vA); q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
        float flap = 0.35 + 0.25 * sin(uT * 18.0 + vF * 30.0);
        float wing = abs(abs(q.y) * flap * 2.2 - (0.35 - q.x) * 0.0) ; float shape = step(abs(q.x + abs(q.y) * (0.9 - flap)), 0.16) * step(abs(q.y), 0.85);
        if (shape < 0.5) discard; gl_FragColor = vec4(vec3(0.13, 0.11, 0.16), 0.85); }`, { tP: { value: null }, uSize: { value: 7 }, uT: { value: 0 } });
  },
  resize(w, h, dpr) {
    const s = Math.min(1, 640 / Math.max(w, h)); this.scn.setSize(Math.round(w * s), Math.round(h * s));
    const fw = Math.round(w / 12), fh = Math.round(h / 12); this.fa.setSize(fw, fh); this.fb.setSize(fw, fh); this.blur.m.uniforms.uTx.value.set(1 / fw, 1 / fh);
    this.stepP.m.uniforms.uAspect.value = w / h; this.draw.m.uniforms.uSize.value = sizeFor(w, h, dpr, 6);
  },
  render(ctx, t, dt) {
    const r = ctx.renderer; drawScene(ctx, this.scn);
    r.setRenderTarget(this.fa); r.setClearColor(0x000000, 0); r.clear();
    this.deposit.m.uniforms.tP.value = this.A.a.texture; this.deposit.draw(r, this.fa);
    this.blur.m.uniforms.tF.value = this.fa.texture; this.blur.run(r, this.fb);
    const u = this.stepP.m.uniforms; u.uT.value = t; u.uDt.value = Math.min(dt, 0.033); u.tF.value = this.fb.texture;
    this.A.step(r, this.stepP);
    this.bg.run(r, null);
    this.draw.m.uniforms.tP.value = this.A.a.texture; this.draw.m.uniforms.uT.value = t; this.draw.draw(r, null);
  },
};

// ---------------------------------------------------------------- マスゲーム（観客が色の板を裏返す）
export const cards = {
  ja: 'マスゲーム', note: '観客席の一人ひとりが、足もとの景色の色に板を裏返す。少しずつずれるので、動く物のまわりにウェーブが走る',
  init(ctx) {
    this.scn = sceneRT();
    const o = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false };
    this.sa = new THREE.WebGLRenderTarget(4, 4, o); this.sb = new THREE.WebGLRenderTarget(4, 4, o);
    // 状態: r＝見せている色、g＝次の色、b＝裏返しの進み（0＝止まっている）、a＝待ち時間
    this.stepP = pass(PALETTE + `
      uniform sampler2D tS, tScene; uniform float uT, uDt, uFresh; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tS, vUv);
        float target = float(nearest(toS(texture2D(tScene, vUv).rgb)));
        float wait = 0.08 + 0.55 * hash(vUv * 977.0 + floor(uT * 0.5));
        if (uFresh > 0.5) { gl_FragColor = vec4(target, target, 0.0, wait); return; }
        if (s.b > 0.0) { s.b += uDt / 0.32; if (s.b >= 0.5) s.r = s.g; if (s.b >= 1.0) s.b = 0.0; }
        else if (abs(target - s.r) > 0.5) { s.a -= uDt; if (s.a <= 0.0) { s.g = target; s.b = 0.001; s.a = wait; } }
        else s.a = wait;
        gl_FragColor = s;
      }`, { tS: { value: null }, tScene: { value: this.scn.texture }, uT: { value: 0 }, uDt: { value: 0.016 }, uFresh: { value: 1 } });
    this.out = pass(PALETTE + `
      uniform sampler2D tS; uniform vec2 uGrid; varying vec2 vUv;
      void main(){
        vec2 g = vUv * uGrid, cell = floor(g), f = fract(g);
        vec4 s = texture2D(tS, (cell + 0.5) / uGrid);
        float h = hash(cell);
        vec3 seat = vec3(0.2, 0.19, 0.22) * (0.9 + 0.2 * h);
        vec3 col = seat;
        vec2 hp = vec2(0.5 + (h - 0.5) * 0.1, 0.78);                  // 頭（板の上からのぞく）
        vec3 skin = mix(vec3(0.95, 0.8, 0.66), vec3(0.55, 0.38, 0.26), hash(cell + 3.1));
        vec3 hair = mix(vec3(0.12, 0.1, 0.08), vec3(0.45, 0.3, 0.18), hash(cell + 7.7));
        float hd = length((f - hp) * vec2(1.0, 1.15));
        if (hd < 0.21) col = f.y > hp.y + 0.03 - (f.x - hp.x) * 0.3 ? hair : skin;
        float w = 0.43 * abs(cos(3.14159 * s.b));                      // 裏返すと細くなる
        if (abs(f.x - 0.5) < w && f.y > 0.05 && f.y < 0.6) {
          vec3 c = pal(int(s.r + 0.5));
          col = c * (0.82 + 0.18 * abs(cos(3.14159 * s.b))) * (0.96 + 0.04 * h);
          if (abs(f.x - 0.5) > w - 0.03) col *= 0.8;
        }
        if (abs(f.y - 0.56) < 0.06 && (abs(f.x - 0.5 - w) < 0.06 || abs(f.x - 0.5 + w) < 0.06)) col = skin * 0.9;   // 板を持つ手
        gl_FragColor = vec4(col, 1.0);
      }`, { tS: { value: null }, uGrid: { value: new THREE.Vector2(1, 1) } });
  },
  resize(w, h, dpr) {
    const cell = (matchMedia('(pointer:coarse)').matches ? 12 : 16) * dpr;
    const cols = Math.round(w / cell), rows = Math.round(h / cell);
    this.scn.setSize(cols, rows); this.sa.setSize(cols, rows); this.sb.setSize(cols, rows);
    this.out.m.uniforms.uGrid.value.set(cols, rows); this.fresh = true;
  },
  render(ctx, t, dt) {
    const r = ctx.renderer; drawScene(ctx, this.scn);
    const u = this.stepP.m.uniforms; u.tS.value = this.sa.texture; u.uT.value = t; u.uDt.value = Math.min(dt, 0.05); u.uFresh.value = this.fresh ? 1 : 0; this.fresh = false;
    this.stepP.run(r, this.sb); [this.sa, this.sb] = [this.sb, this.sa];
    this.out.m.uniforms.tS.value = this.sa.texture; this.out.run(r, null);
  },
};

// ---------------------------------------------------------------- テントウムシ（自分の色の場所に集まる）
export const beetles = {
  ja: 'テントウムシ', note: '一匹ずつ自分の色が決まっていて、同じ色の場所に集まる。合わないと急いで歩き、たまに色がえ',
  init(ctx) {
    this.scn = sceneRT();
    this.A = agents(200, () => [rnd(), rnd(), rnd() * 6.283, Math.floor(rnd() * 10)]);
    this.stepP = pass(PALETTE + `
      uniform sampler2D tP, tScene; uniform float uT, uDt, uAspect; varying vec2 vUv;
      float match(vec2 x, vec3 me){ vec3 d = toS(texture2D(tScene, x).rgb) - me; return exp(-dot(d, d) * 14.0); }
      void main(){
        vec4 p = texture2D(tP, vUv); vec2 x = p.xy; float a = p.z; int ci = int(p.w + 0.5); vec3 me = pal(ci);
        float m = match(x, me);
        vec2 k = vec2(1.0 / uAspect, 1.0) * 0.01;
        float l = match(x + vec2(cos(a + 0.7), sin(a + 0.7)) * k, me), r = match(x + vec2(cos(a - 0.7), sin(a - 0.7)) * k, me);
        float h = hash(vUv * 457.0 + uT);
        a += (l - r) * 14.0 * uDt + (h - 0.5) * 3.0 * uDt;
        x += vec2(cos(a), sin(a)) * mix(0.16, 0.004, m) * uDt * vec2(1.0 / uAspect, 1.0); x = fract(x);
        if (m < 0.3 && hash(vUv * 191.0 + uT * 1.7) < uDt * 1.5) p.w = float(nearest(toS(texture2D(tScene, x).rgb)));   // 色がえ
        gl_FragColor = vec4(x, a, p.w);
      }`, { tP: { value: null }, tScene: { value: this.scn.texture }, uT: { value: 0 }, uDt: { value: 0.016 }, uAspect: { value: 1 } });
    this.bg = pass(`varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(0.9, 0.9, 0.86) * (0.97 + 0.03 * hash(floor(vUv * 400.0))), 1.0); }`, {});
    this.draw = this.A.points(`
      attribute vec2 ref; uniform sampler2D tP; uniform float uSize; varying float vA; varying vec3 vC;
      void main(){ vec4 p = texture2D(tP, ref); vA = p.z; vC = pal(int(p.w + 0.5)); gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uSize; }`, `
      varying float vA; varying vec3 vC;
      void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float c = cos(vA), s = sin(vA); q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
        float body = length(q * vec2(1.0, 1.12)); float head = length((q - vec2(0.62, 0.0)) * vec2(1.3, 1.0));
        if (body > 0.72 && head > 0.3) discard;
        vec3 col = head < 0.3 && body > 0.6 ? vec3(0.1) : vC * (1.0 - 0.25 * smoothstep(0.4, 0.72, body));
        if (abs(q.y) < 0.04 && q.x < 0.55) col *= 0.55;                // 羽の合わせ目
        col += vec3(0.22) * smoothstep(0.25, 0.0, length(q - vec2(0.1, 0.25)));
        gl_FragColor = vec4(col, 1.0); }`, { tP: { value: null }, uSize: { value: 8 } });
  },
  resize(w, h, dpr) { const s = Math.min(1, 640 / Math.max(w, h)); this.scn.setSize(Math.round(w * s), Math.round(h * s)); this.stepP.m.uniforms.uAspect.value = w / h; this.draw.m.uniforms.uSize.value = sizeFor(w, h, dpr, 8); },
  render(ctx, t, dt) {
    const r = ctx.renderer; drawScene(ctx, this.scn);
    const u = this.stepP.m.uniforms; u.uT.value = t; u.uDt.value = Math.min(dt, 0.033);
    this.A.step(r, this.stepP);
    this.bg.run(r, null);
    this.draw.m.uniforms.tP.value = this.A.a.texture; this.draw.draw(r, null);
  },
};
