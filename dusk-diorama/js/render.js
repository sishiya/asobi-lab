// 描き方: 空・日食・光・仕上げ（光のにじみ → ACES → ミニチュアのぼけ → 色の調子）と、火の輪の外を暗くするしかけ
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ルック C 灰と残り火（look/look.js の STYLES[2]）と、夜明け
const NIGHT = { sky: ['#0e0304', '#5c160a', '#0b0404'], glow: '#ff5a1f', glowAmt: 0.7, hemi: ['#a04828', '#1a0c08', 1.4], key: ['#ff7a42', 2.8], fog: '#2a0f09', exposure: 1.3, sat: [0.55, 1.15], lift: '#2a0806', liftAmt: 0.06, vig: 0.5 };
const DAWN = { sky: ['#1f2a46', '#b8714a', '#140f12'], glow: '#ffc890', glowAmt: 0.35, hemi: ['#7d8db3', '#2e2219', 1.1], key: ['#ffd2a8', 2.2], fog: '#2c2226', exposure: 1.0, sat: [0.95, 1.15], lift: '#0c1020', liftAmt: 0.02, vig: 0.38 };

export const DARK = { uFire: { value: new THREE.Vector3() }, uR: { value: 3 }, uDark: { value: 1 } };
// 輪の外は色を抜いて暗く。輪のふちに、ほのかな火の色のすじ（島の上の面だけ）
export function patchDark(mat) {
  if (mat.userData.dark || !mat.isMeshStandardMaterial) return;
  mat.userData.dark = true;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, DARK);
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 wpp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wpp = instanceMatrix * wpp;
      #endif
      vWp = (modelMatrix * wpp).xyz;`);
    sh.fragmentShader = 'uniform vec3 uFire; uniform float uR; uniform float uDark; varying vec3 vWp;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `{
      float dd = length(vWp.xz - uFire.xz), dk = smoothstep(uR, uR + 0.9, dd) * uDark;
      float lum = dot(gl_FragColor.rgb, vec3(.3, .59, .11));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(lum) * vec3(.62, .48, .45), dk * .85) * (1.0 - dk * .6);
      vec3 fn = normalize(cross(dFdx(vWp), dFdy(vWp)));
      float onTop = step(uFire.y - 1.6, vWp.y) * smoothstep(.6, .85, abs(fn.y)); // 上を向いた面だけ（岩の壁に光のすじを出さない）
      gl_FragColor.rgb += vec3(1., .42, .12) * exp(-pow((dd - uR - .1) * 8.0, 2.0)) * .08 * uDark * onTop;
    }
    #include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => 'dark';
}

export function makeRenderer(canvas) {
  const wx = { fog: 0, rain: 0 }; // 夜の空（setWeather）
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const DPR = Math.min(2, devicePixelRatio || 1);
  renderer.setPixelRatio(DPR); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, glowCol: { value: new THREE.Color() }, glowAmt: { value: 1 }, moonDir: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec3 vDir; void main(){ vec4 w = modelMatrix*vec4(position,1.); vDir = normalize(w.xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 top, mid, bot, glowCol; uniform float glowAmt; uniform vec3 moonDir; varying vec3 vDir;
      void main(){ float y = vDir.y; vec3 c = y > 0. ? mix(mid, top, pow(y, .55)) : mix(mid, bot, pow(-y, .45));
        float g = max(dot(vDir, moonDir), 0.); c += glowCol * (pow(g, 6.) * .35 + pow(g, 40.) * .8) * glowAmt; gl_FragColor = vec4(c, 1.); }`,
  });
  const skyGeo = new THREE.SphereGeometry(200, 32, 16); scene.add(new THREE.Mesh(skyGeo, skyMat));
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(skyGeo, skyMat)); const pmrem = new THREE.PMREMGenerator(renderer);

  // 日食（書き割り。画面の右上の奥にいつも）
  const ecl = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(255,190,120,1)'); gr.addColorStop(0.32, 'rgba(255,90,30,.75)'); gr.addColorStop(1, 'rgba(255,40,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#050101'; g.beginPath(); g.arc(128, 128, 38, 0, 7); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ecl, fog: false, depthWrite: false, transparent: true })); moon.scale.setScalar(26); scene.add(moon);

  const hemi = new THREE.HemisphereLight(); scene.add(hemi);
  const key = new THREE.DirectionalLight(); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  key.position.set(0.25, 0.16, -0.95).normalize().multiplyScalar(25); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#ff5a1f', 1.8); fill.position.set(-0.25 * 20, -6, 0.95 * 20 + 10); scene.add(fill);
  scene.fog = new THREE.Fog(NIGHT.fog, 18, 56);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.6, 0.55); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  const TILT = { uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() }, focus: { value: 0.5 }, band: { value: 0.17 }, range: { value: 0.32 }, amount: { value: 2.2 * DPR } }, vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; uniform float focus, band, range, amount; varying vec2 vUv;
      void main(){ float b = amount * smoothstep(0., range, abs(vUv.y - focus) - band); vec2 o1 = dir * 1.3846 * b, o2 = dir * 3.2308 * b;
        gl_FragColor = texture2D(tDiffuse, vUv) * .2270 + (texture2D(tDiffuse, vUv + o1) + texture2D(tDiffuse, vUv - o1)) * .3162 + (texture2D(tDiffuse, vUv + o2) + texture2D(tDiffuse, vUv - o2)) * .0703; }` };
  const tiltH = new ShaderPass(TILT), tiltV = new ShaderPass(TILT); composer.addPass(tiltH); composer.addPass(tiltV);
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, satLo: { value: 1 }, satHi: { value: 1 }, l0: { value: 0.05 }, l1: { value: 0.4 }, lift: { value: new THREE.Color() }, liftAmt: { value: 0 }, vig: { value: 0 }, grain: { value: 0.03 }, time: { value: 0 }, aspect: { value: 1 }, flash: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float satLo, satHi, l0, l1, liftAmt, vig, grain, time, aspect, flash; uniform vec3 lift; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, mix(satLo, satHi, smoothstep(l0, l1, l))); c += lift * liftAmt * (1. - l);
        vec2 d = (vUv - .5) * vec2(aspect, 1.); c *= 1. - vig * smoothstep(.3, 1.05, length(d));
        c += vec3(1., .5, .2) * flash * (1. - smoothstep(0., .9, length(d)));
        c += (rnd(vUv * vec2(913., 577.) + fract(time)) - .5) * grain; gl_FragColor = vec4(c, 1.); }` });
  composer.addPass(grade);

  // 夜 → 夜明け（k: 0〜1）
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const mix = (a, b, k) => tmp.set(a).lerp(tmp2.set(b), k);
  let lastEnv = -1;
  function setDawn(k) {
    skyMat.uniforms.top.value.copy(mix(NIGHT.sky[0], DAWN.sky[0], k)); skyMat.uniforms.mid.value.copy(mix(NIGHT.sky[1], DAWN.sky[1], k)); skyMat.uniforms.bot.value.copy(mix(NIGHT.sky[2], DAWN.sky[2], k));
    skyMat.uniforms.glowCol.value.copy(mix(NIGHT.glow, DAWN.glow, k)); skyMat.uniforms.glowAmt.value = NIGHT.glowAmt + (DAWN.glowAmt - NIGHT.glowAmt) * k;
    hemi.color.copy(mix(NIGHT.hemi[0], DAWN.hemi[0], k)); hemi.groundColor.copy(mix(NIGHT.hemi[1], DAWN.hemi[1], k)); hemi.intensity = NIGHT.hemi[2] + (DAWN.hemi[2] - NIGHT.hemi[2]) * k;
    key.color.copy(mix(NIGHT.key[0], DAWN.key[0], k)); key.intensity = NIGHT.key[1] + (DAWN.key[1] - NIGHT.key[1]) * k;
    scene.fog.color.copy(mix(NIGHT.fog, DAWN.fog, k)).lerp(tmp2.set('#7a4a40'), wx.fog * 0.6 * (1 - k)); // 霧の夜は、白っぽい霧 renderer.toneMappingExposure = (NIGHT.exposure + (DAWN.exposure - NIGHT.exposure) * k) * (1 - 0.18 * wx.rain * (1 - k));
    const G = grade.uniforms; G.satLo.value = NIGHT.sat[0] + (DAWN.sat[0] - NIGHT.sat[0]) * k; G.satHi.value = NIGHT.sat[1] + (DAWN.sat[1] - NIGHT.sat[1]) * k;
    G.lift.value.copy(mix(NIGHT.lift, DAWN.lift, k)); G.liftAmt.value = NIGHT.liftAmt + (DAWN.liftAmt - NIGHT.liftAmt) * k; G.vig.value = NIGHT.vig + (DAWN.vig - NIGHT.vig) * k;
    moon.material.opacity = 1 - k;
    const step = Math.round(k * 4); if (step !== lastEnv) { lastEnv = step; if (scene.environment) scene.environment.dispose(); scene.environment = pmrem.fromScene(envScene, 0.02).texture; }
  }
  setDawn(0);

  let W = 0, Hh = 0;
  const view = { az: 0.55, el: 0.5, zoom: 1, base: 30, target: new THREE.Vector3(0, -0.6, 0) };
  function resize() {
    W = innerWidth; Hh = innerHeight; const asp = W / Hh;
    renderer.setSize(W, Hh, false); composer.setSize(W, Hh); composer.setPixelRatio(DPR);
    camera.aspect = asp; camera.updateProjectionMatrix(); view.base = Math.max(30, 24 / asp);
    tiltH.uniforms.dir.value.set(1 / W, 0); tiltV.uniforms.dir.value.set(0, 1 / Hh); grade.uniforms.aspect.value = asp;
    const k = view.base - 30, fk = wx.fog; scene.fog.near = (18 + k) * (1 - 0.45 * fk); scene.fog.far = (56 + k) * (1 - 0.35 * fk);
  }
  addEventListener('resize', resize); resize();

  function render(t) {
    const d = view.base * view.zoom;
    camera.position.set(view.target.x + Math.sin(view.az) * Math.cos(view.el) * d, view.target.y + Math.sin(view.el) * d, view.target.z + Math.cos(view.az) * Math.cos(view.el) * d);
    camera.lookAt(view.target);
    const f = view.target.clone().sub(camera.position).normalize(), r = f.clone().cross(camera.up).normalize(), u = r.clone().cross(f), kk = 150 * Math.tan(THREE.MathUtils.degToRad(15));
    moon.position.copy(camera.position).addScaledVector(f, 150).addScaledVector(r, kk * camera.aspect * 0.55).addScaledVector(u, kk * 0.62);
    skyMat.uniforms.moonDir.value.copy(moon.position).sub(camera.position).normalize();
    grade.uniforms.time.value = t;
    composer.render();
  }
  // 夜の空: 霧（見える遠さがちぢむ）・雨（暗く）
  function setWeather(o) { Object.assign(wx, o); resize(); setDawn(0); }
  return { renderer, scene, camera, view, render, setDawn, grade, resize, setWeather };
}
