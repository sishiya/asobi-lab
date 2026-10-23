// エフェクト: 炎（ノイズでゆらぐ板を2枚交差）・おき火・火の粉・灰・けむり・崩れる土ぼこり。大きさは火の燃料 F に合わせる
import * as THREE from 'three';
import { FIRE, H } from './util.js';

const NOISE = `float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
  float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= .5; } return s; }`;

function softDot() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

// 粒: 位置・大きさ・明るさを毎こま書きかえる（明るさは頂点の色で。加算なら黒＝消える）
function particles(n, opt) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: opt.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    uniforms: { map: { value: opt.tex }, scale: { value: 300 } },
    vertexShader: `attribute float aSize; attribute vec4 aCol; varying vec4 vCol; uniform float scale;
      void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vCol; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = opt.order || 0;
  return { p, n, pos: g.attributes.position, size: g.attributes.aSize, col: g.attributes.aCol, data: Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 0.05 })) };
}

const ZERO = { x: 0, z: 0 };
export function makeFx(root) {
  const fy = H(FIRE.x, FIRE.z), dot = softDot();
  // 炎: 2枚の板（いつもカメラに向く向きを y で回す）
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { t: { value: 0 }, power: { value: 1 }, seed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: NOISE + `uniform float t, power, seed; varying vec2 vUv;
      void main(){ vec2 uv = vUv; float x = (uv.x - .5) * 2.;
        float n = fb(vec2(uv.x * 3.2 + seed, uv.y * 2.4 - t * 2.6)), n2 = fb(vec2(uv.x * 6. - seed, uv.y * 4. - t * 4.));
        float body = (1. - uv.y) * (1. - pow(abs(x + (n - .5) * .6 * uv.y), 1.6));
        float f = clamp(body * 1.7 - n * 1.05 * (.3 + uv.y) - n2 * .25 - uv.y * .35, 0., 1.);
        vec3 c = mix(vec3(.75, .12, .02), vec3(1., .62, .18), smoothstep(.05, .5, f)); c = mix(c, vec3(1., .93, .7), smoothstep(.5, .95, f));
        gl_FragColor = vec4(c * f * power * 0.62, 1.); }`,
  });
  const flames = [0, 1].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), flameMat.clone()); m.material.uniforms.seed.value = i * 7.3; m.renderOrder = 5; root.add(m); return m; });
  // おき火（燃料が少なくても赤く残る）
  const coalMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, power: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: NOISE + `uniform float t, power; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.; float n = fb(vUv * 9. + vec2(t * .3, -t * .2));
      float g = smoothstep(1., .2, r) * (.35 + .9 * n); gl_FragColor = vec4(vec3(1., .3, .06) * g * power, 1.); }` });
  const coal = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), coalMat); coal.rotation.x = -Math.PI / 2; coal.position.set(FIRE.x, fy + 0.06, FIRE.z); root.add(coal);
  // 燃えている丸太（くべた物の代わりに見せる黒い木）
  const charMat = new THREE.MeshStandardMaterial({ color: '#120a06', emissive: '#ff4a10', emissiveIntensity: 0.4, roughness: 1 });
  const logs = [0, 1, 2, 3].map(i => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.52, 6), charMat); l.rotation.set(Math.PI / 2 - 0.5, i * Math.PI / 2 + 0.3, 0); l.position.set(FIRE.x, fy + 0.1, FIRE.z); root.add(l); return l; });
  const light = new THREE.PointLight('#ff8a3a', 10, 10, 2); light.position.set(FIRE.x, fy + 0.7, FIRE.z); root.add(light);

  const embers = particles(260, { add: true, tex: dot, order: 6 });
  const ash = particles(900, { add: false, tex: dot, order: 4 });
  const dust = particles(500, { add: false, tex: dot, order: 4 });
  const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const smoke = particles(70, { add: false, tex: smokeTex, order: 3 });
  for (const P of [embers, ash, dust, smoke]) root.add(P.p);
  // 雨: 落ちる線
  const RN = 900, rainPos = new Float32Array(RN * 6), rainData = Array.from({ length: RN }, () => ({ x: (Math.random() - .5) * 22, y: Math.random() * 16 - 4, z: (Math.random() - .5) * 22, v: 9 + Math.random() * 4 }));
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c9b8b0', transparent: true, opacity: 0, depthWrite: false, fog: false }));
  rain.frustumCulled = false; root.add(rain);
  for (const d of ash.data) { d.x = (Math.random() - .5) * 20; d.y = Math.random() * 14 - 3; d.z = (Math.random() - .5) * 20; d.s = 0.03 + Math.random() * 0.05; d.ph = Math.random() * 9; d.sp = 0.2 + Math.random() * 0.3; }

  let flare = 0, emberAcc = 0, smokeAcc = 0, ri = 0;
  const spawn = (P, f) => { for (let k = 0; k < P.n; k++) { ri = (ri + 1) % P.n; const d = P.data[ri]; if (d.life <= 0) { f(d); return d; } } };

  // 毎こま。F = 燃料、smokeK = 生木などのけむり（0〜1）、camYaw = カメラの向き
  function update(t, dt, { F, smokeK, camera, out, wind = ZERO, rainK = 0, ashK = 1 }) {
    const k = Math.sqrt(Math.min(1, F / 40)) + flare * 0.6, alive = F > 0;
    flare = Math.max(0, flare - dt * 0.8);
    const yaw = Math.atan2(camera.position.x - FIRE.x, camera.position.z - FIRE.z), lean = 0.12 * k;
    flames.forEach((m, i) => { const hgt = 0.45 + 1.7 * k, wid = 0.32 + 0.55 * k; m.scale.set(wid * (1 - i * 0.3), hgt * (1 - i * 0.25), 1); m.position.set(FIRE.x + wind.x * lean, fy + 0.08 + m.scale.y / 2, FIRE.z + wind.z * lean); /* 風下へかたむく */ m.rotation.set(0, yaw + i * 0.9, 0); m.material.uniforms.t.value = t; m.material.uniforms.power.value = alive ? 1 : 0; m.visible = alive; });
    coalMat.uniforms.t.value = t; coalMat.uniforms.power.value = alive ? 0.9 + k : Math.max(0.25, 0.8 - out * 0.06);
    charMat.emissiveIntensity = alive ? 0.5 + k : 0.25;
    light.intensity = alive ? (5 + 22 * k) * (0.82 + 0.12 * Math.sin(t * 11) + 0.06 * Math.sin(t * 27.3)) : 1.5; light.distance = 4 + 9 * k;
    // 火の粉: 火が大きいほど多く。くべたときはどっと
    emberAcc += dt * (alive ? 10 + 60 * k : 1.5);
    while (emberAcc > 1) { emberAcc--; spawn(embers, d => { d.x = FIRE.x + (Math.random() - .5) * 0.3 * (0.5 + k); d.z = FIRE.z + (Math.random() - .5) * 0.3 * (0.5 + k); d.y = fy + 0.2 + Math.random() * 0.3 * k; d.vx = (Math.random() - .5) * 0.4; d.vz = (Math.random() - .5) * 0.4; d.vy = 0.6 + Math.random() * 1.6 * (0.4 + k); d.max = d.life = 1.2 + Math.random() * 2.2; d.s = 0.03 + Math.random() * 0.05; d.ph = Math.random() * 9; }); }
    for (let i = 0; i < embers.n; i++) { const d = embers.data[i];
      if (d.life > 0) { d.life -= dt; d.vx += Math.sin(t * 3 + d.ph) * 0.6 * dt; d.vz += Math.cos(t * 2.3 + d.ph) * 0.6 * dt; d.vy -= 0.15 * dt; d.x += (d.vx + wind.x * 0.9) * dt; d.z += wind.z * 0.9 * dt; d.y += d.vy * dt; d.z += d.vz * dt; }
      const a = Math.max(0, d.life / d.max), tw = 0.6 + 0.4 * Math.sin(t * 20 + d.ph);
      embers.pos.setXYZ(i, d.x, d.life > 0 ? d.y : -99, d.z); embers.size.setX(i, d.s * (0.5 + a)); embers.col.setXYZW(i, 1, 0.35 + 0.4 * a, 0.08 * a, a * tw);
    }
    // けむり
    smokeAcc += dt * (alive ? 2 + 10 * smokeK : 0.6);
    while (smokeAcc > 1) { smokeAcc--; spawn(smoke, d => { d.x = FIRE.x; d.z = FIRE.z; d.y = fy + 0.5 + k * 0.6; d.vx = 0.15 + Math.random() * 0.1; d.vz = -0.08 + (Math.random() - .5) * 0.1; d.vy = 0.5 + Math.random() * 0.3; d.max = d.life = 5 + Math.random() * 3; d.s = 0.5; }); }
    for (let i = 0; i < smoke.n; i++) { const d = smoke.data[i]; if (d.life > 0) { d.life -= dt; d.x += (d.vx + wind.x * 0.8) * dt; d.y += d.vy * dt; d.z += (d.vz + wind.z * 0.8) * dt; }
      const a = Math.max(0, d.life / d.max), age = 1 - a; smoke.pos.setXYZ(i, d.x, d.life > 0 ? d.y : -99, d.z); smoke.size.setX(i, 0.4 + age * 2.6); smoke.col.setXYZW(i, 0.42, 0.37, 0.34, Math.sin(a * Math.PI) * (0.18 + 0.25 * smokeK)); }
    // 灰: ひらひら回りながら落ちる（小さい灰は速く、大きい灰はゆっくり）
    for (let i = 0; i < ash.n; i++) { const d = ash.data[i]; d.y -= d.sp * dt * (0.06 / d.s) * 0.5 * (0.6 + 0.4 * ashK); d.x += wind.x * 1.4 * dt; d.z += wind.z * 1.4 * dt; if (d.y < -8 || Math.abs(d.x) > 12 || Math.abs(d.z) > 12) { d.y = d.y < -8 ? 12 : d.y; d.x = (Math.random() - .5) * 20 - wind.x * 4; d.z = (Math.random() - .5) * 20 - wind.z * 4; }
      const fl = Math.sin(t * 1.7 + d.ph); ash.pos.setXYZ(i, d.x + Math.sin(t * 0.5 + d.ph) * 0.5, d.y, d.z + Math.cos(t * 0.4 + d.ph) * 0.35); ash.size.setX(i, d.s * (0.6 + 0.4 * Math.abs(fl)) * (0.7 + 0.5 * ashK)); const g = 0.55 + 0.2 * fl; ash.col.setXYZW(i, g, g * 0.92, g * 0.86, 0.55); }
    // 土ぼこり・こぼれる土
    for (let i = 0; i < dust.n; i++) { const d = dust.data[i]; if (d.life > 0) { d.life -= dt; d.vy -= 6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; }
      const a = Math.max(0, d.life / d.max); dust.pos.setXYZ(i, d.x, d.life > 0 ? d.y : -99, d.z); dust.size.setX(i, d.s); dust.col.setXYZW(i, 0.3, 0.24, 0.19, Math.min(1, a * 2)); }
    // 雨
    rain.material.opacity = 0.35 * rainK; rain.visible = rainK > 0.01;
    if (rain.visible) { for (let i = 0; i < RN; i++) { const d = rainData[i]; d.y -= d.v * dt; d.x += wind.x * 3 * dt; if (d.y < -6) { d.y = 12; d.x = (Math.random() - .5) * 22; d.z = (Math.random() - .5) * 22; }
      rainPos.set([d.x, d.y, d.z, d.x - 0.02, d.y + 0.35, d.z], i * 6); } rainGeo.attributes.position.needsUpdate = true; }
    for (const P of [embers, ash, dust, smoke]) { P.pos.needsUpdate = P.size.needsUpdate = P.col.needsUpdate = true; P.p.material.uniforms.scale.value = innerHeight * 0.9; }
  }
  // くべた瞬間
  function burst(power) { flare = Math.min(1.6, flare + power); for (let i = 0; i < 30 * power; i++) spawn(embers, d => { d.x = FIRE.x; d.z = FIRE.z; d.y = fy + 0.3; const a = Math.random() * 6.28, s = 0.5 + Math.random() * 1.5; d.vx = Math.cos(a) * s; d.vz = Math.sin(a) * s; d.vy = 1.5 + Math.random() * 2.5; d.max = d.life = 1 + Math.random() * 1.5; d.s = 0.04 + Math.random() * 0.05; d.ph = Math.random() * 9; }); }
  // 土がこぼれる（ふるえている塊・落ちる塊）
  function crumbs(x, y, z, n, spread = 0.6) { for (let i = 0; i < n; i++) spawn(dust, d => { d.x = x + (Math.random() - .5) * spread; d.z = z + (Math.random() - .5) * spread; d.y = y; d.vx = (Math.random() - .5) * 0.6; d.vz = (Math.random() - .5) * 0.6; d.vy = Math.random() * 0.8; d.max = d.life = 1.5 + Math.random() * 1.5; d.s = 0.03 + Math.random() * 0.07; }); }
  return { update, burst, crumbs, fireParts: [coal, ...logs, light, ...flames], get flare() { return flare; } };
}
