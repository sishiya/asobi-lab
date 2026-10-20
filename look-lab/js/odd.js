// ルックの実験室: へんてこ系。群れ以外で、工夫1つで見え方ががらっと変わるもの。
import * as THREE from 'three';

const quadGeo = new THREE.PlaneGeometry(2, 2);
const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const COMMON = `
  vec3 toS(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2)); }
  float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;
function pass(fs, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: COMMON + fs, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(quadGeo, m));
  return { m, run(r, target) { r.setRenderTarget(target); r.render(s, qCam); } };
}
const sceneRT = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
function drawScene(ctx, rt) { ctx.renderer.setRenderTarget(rt); ctx.renderer.clear(); ctx.renderer.render(ctx.scene, ctx.camera); }

// ---------------------------------------------------------------- まだら（チューリング模様）
// 2つの物質が広がりながら反応すると、斑点やしまが自然にできる（Gray-Scott の式）。景色の暗さで反応の速さを変える
export const turing = {
  ja: 'まだら', note: '世界ぜんぶが動物の模様。暗い所はしま・網目、明るい所は斑点になり、動く物が通ると模様が組みかわる',
  init(ctx) {
    this.scn = sceneRT();
    const o = { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.a = new THREE.WebGLRenderTarget(4, 4, o); this.b = new THREE.WebGLRenderTarget(4, 4, o);
    this.seedP = pass(`varying vec2 vUv; uniform vec2 uRes; void main(){ vec2 c = floor(vUv * uRes / 6.0); float v = step(0.93, hash(c)); gl_FragColor = vec4(1.0 - v * 0.5, v * 0.25, 0.0, 1.0); }`, { uRes: { value: new THREE.Vector2() } });
    this.step = pass(`
      uniform sampler2D tS, tScene; uniform vec2 uTx; varying vec2 vUv;
      void main(){
        vec2 s = texture2D(tS, vUv).rg;
        vec2 L = -s;
        L += 0.2 * (texture2D(tS, vUv + vec2(uTx.x, 0.0)).rg + texture2D(tS, vUv - vec2(uTx.x, 0.0)).rg + texture2D(tS, vUv + vec2(0.0, uTx.y)).rg + texture2D(tS, vUv - vec2(0.0, uTx.y)).rg);
        L += 0.05 * (texture2D(tS, vUv + uTx).rg + texture2D(tS, vUv - uTx).rg + texture2D(tS, vUv + vec2(uTx.x, -uTx.y)).rg + texture2D(tS, vUv - vec2(uTx.x, -uTx.y)).rg);
        float D = smoothstep(0.2, 0.7, 1.0 - lum(toS(texture2D(tScene, vUv).rgb)));
        float f = D < 0.5 ? mix(0.024, 0.0367, D * 2.0) : mix(0.0367, 0.029, D * 2.0 - 1.0);   // 明るい＝まばら、中＝斑点、暗い＝しま
        float k = D < 0.5 ? mix(0.0605, 0.0649, D * 2.0) : mix(0.0649, 0.057, D * 2.0 - 1.0);
        float uvv = s.r * s.g * s.g;
        vec2 n = s + vec2(1.0 * L.r - uvv + f * (1.0 - s.r), 0.5 * L.g + uvv - (f + k) * s.g);
        gl_FragColor = vec4(clamp(n, 0.0, 1.0), 0.0, 1.0);
      }`, { tS: { value: null }, tScene: { value: this.scn.texture }, uTx: { value: new THREE.Vector2() } });
    this.out = pass(`
      uniform sampler2D tS, tScene; varying vec2 vUv;
      void main(){
        float v = texture2D(tS, vUv).g;
        float m = smoothstep(0.18, 0.3, v);
        vec3 c = toS(texture2D(tScene, vUv).rgb);
        vec3 fur = mix(c, vec3(0.97, 0.93, 0.82), 0.45);
        vec3 spot = c * 0.35 + vec3(0.06, 0.04, 0.02);
        gl_FragColor = vec4(mix(fur, spot, m), 1.0);
      }`, { tS: { value: null }, tScene: { value: this.scn.texture } });
  },
  resize(w, h) {
    const s = Math.min(0.5, 640 / Math.max(w, h)), W = Math.round(w * s), H = Math.round(h * s);
    for (const r of [this.scn, this.a, this.b]) r.setSize(W, H);
    this.step.m.uniforms.uTx.value.set(1 / W, 1 / H); this.seedP.m.uniforms.uRes.value.set(W, H); this.seeded = false;
  },
  render(ctx) {
    const r = ctx.renderer;
    if (!this.seeded) { this.seedP.run(r, this.a); this.seeded = true; }
    drawScene(ctx, this.scn);
    const u = this.step.m.uniforms;
    for (let i = 0; i < 14; i++) { u.tS.value = this.a.texture; this.step.run(r, this.b); [this.a, this.b] = [this.b, this.a]; }
    this.out.m.uniforms.tS.value = this.a.texture; this.out.run(r, null);
  },
};

// ---------------------------------------------------------------- 止まると消える（どれも同じ砂あらし）
// 模様は物にはりついているので、止まると背景にまぎれる。動いた物だけが見える
export const still = {
  ja: '止まると消える', note: '地面も物も同じ砂あらしの模様。止まっている物は見えず、動いた物だけが見える（立ち止まると世界が消える）',
  init() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vP; void main(){ vP = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: COMMON + 'varying vec3 vP; void main(){ float n = step(0.5, hash3(floor(vP * 11.0))); gl_FragColor = vec4(vec3(0.12 + 0.8 * n), 1.0); }',
      side: THREE.DoubleSide,
    });
  },
  render(ctx) {
    const { renderer, scene } = ctx, bg = scene.background, fog = scene.fog;
    scene.overrideMaterial = this.mat; scene.background = new THREE.Color(0x777777); scene.fog = null;
    renderer.setRenderTarget(null); renderer.render(scene, ctx.camera);
    scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
  },
};

// ---------------------------------------------------------------- 影だけ（物は透明、影を墨で）
export const shadows = {
  ja: '影だけ', note: '物は透明で、地面に落ちた影だけを墨で描く。太陽がゆっくり回るので、影がのびて回る',
  init(ctx) {
    this.mat = new THREE.ShadowMaterial({ color: 0x1b1d2a, opacity: 0.88 });
    this.paper = new THREE.Color(0xf1ead9);
  },
  render(ctx, t) {
    const { renderer, scene, camera, ground, sun } = ctx, bg = scene.background, fog = scene.fog, gm = ground.material;
    const a = t * 0.22, tx = sun.target.position;
    sun.position.set(tx.x + Math.cos(a) * 16, 7 + 3 * Math.sin(t * 0.13), tx.z + Math.sin(a) * 16);
    const hid = [];                                                  // 物は色も深さも書かない（影だけ落とす）
    scene.traverse(o => { if ((o.isMesh) && o !== ground && o.material.colorWrite) { hid.push(o.material); o.material.colorWrite = false; o.material.depthWrite = false; } });
    scene.background = this.paper; scene.fog = null; ground.material = this.mat;
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    for (const m of hid) { m.colorWrite = true; m.depthWrite = true; }
    ground.material = gm; scene.background = bg; scene.fog = fog;
  },
};

// ---------------------------------------------------------------- 虫の目（複眼）
export const compound = {
  ja: '虫の目', note: '昆虫の複眼で見る。六角形の小さな目の一つずつに、さかさまの小さな景色が映る',
  init() {
    this.scn = sceneRT();
    this.p = pass(`
      uniform sampler2D tScene; uniform vec2 uRes; uniform float uR; varying vec2 vUv;
      vec2 hexCenter(vec2 p){                                         // いちばん近い六角形の中心
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
        return dot(a, a) < dot(b, b) ? p - a : p - b;
      }
      void main(){
        vec2 px = vUv * uRes / uR;
        vec2 c = hexCenter(px), l = px - c;                            // l: 目の中の位置（半径 0.5 くらい）
        vec2 cUv = c * uR / uRes;
        vec2 uv = cUv - l * uR * 2.6 / uRes;                           // レンズでさかさまに、少し広く
        vec3 col = toS(texture2D(tScene, clamp(uv, 0.0, 1.0)).rgb);
        float d = length(l) / 0.5;
        vec2 q = abs(l); float hx = max(q.x, dot(q, vec2(0.5, 0.8660254)));
        col *= 1.0 - 0.55 * d * d;                                     // 目のふちは暗く
        col += vec3(0.08, 0.1, 0.06) * (hash(c) - 0.5);
        col = mix(col, vec3(0.04, 0.05, 0.03), smoothstep(0.43, 0.49, hx));
        col += vec3(0.25) * smoothstep(0.18, 0.0, length(l - vec2(-0.14, 0.16)));   // つや
        gl_FragColor = vec4(col, 1.0);
      }`, { tScene: { value: this.scn.texture }, uRes: { value: new THREE.Vector2() }, uR: { value: 30 } });
  },
  resize(w, h, dpr) { this.scn.setSize(Math.round(w * 0.6), Math.round(h * 0.6)); this.p.m.uniforms.uRes.value.set(w, h); this.p.m.uniforms.uR.value = (matchMedia('(pointer:coarse)').matches ? 22 : 30) * dpr; },
  render(ctx) { drawScene(ctx, this.scn); this.p.run(ctx.renderer, null); },
};

// ---------------------------------------------------------------- シャボン（すべてが石けんの膜）
export const soap = {
  ja: 'シャボン', note: 'どの物もシャボン玉の膜でできている。見る向きと膜の厚みで、虹色が流れる',
  init() {
    this.u = { uT: { value: 0 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uT; varying vec3 vW; varying vec3 vN;
        void main(){
          vec3 v = normalize(cameraPosition - vW), n = normalize(vN); if (dot(n, v) < 0.0) n = -n;
          float ct = clamp(dot(n, v), 0.0, 1.0);
          float th = 0.9 + 0.5 * sin(vW.x * 1.7 + uT * 0.4) * sin(vW.z * 0.7 - uT * 0.3) + 0.3 * sin(vW.y * 3.0 + uT * 0.8) + 0.25 * sin((vW.x + vW.z) * 2.3 + uT);
          vec3 film = 0.5 + 0.5 * cos(6.2831 * (2.2 * th * (0.6 + 0.4 * ct) * vec3(1.0, 1.18, 1.38)));
          float fres = 0.15 + 0.85 * pow(1.0 - ct, 2.5);
          float flat_ = smoothstep(0.85, 1.0, abs(n.y));                 // 地面の膜はうすく
          vec3 col = film * mix(fres, 0.1, flat_) + vec3(0.9) * pow(max(dot(reflect(-v, n), normalize(vec3(0.4, 0.9, 0.3))), 0.0), 60.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  },
  render(ctx, t) {
    const { renderer, scene } = ctx, bg = scene.background, fog = scene.fog;
    this.u.uT.value = t;
    scene.overrideMaterial = this.mat; scene.background = new THREE.Color(0x07080d); scene.fog = null;
    renderer.setRenderTarget(null); renderer.render(scene, ctx.camera);
    scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
  },
};
