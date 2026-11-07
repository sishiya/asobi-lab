// 花の小川: 画面全体のしあげ（PLAN.md 段階A3）。やわらかい光のにじみ（ブルーム）＋箱庭のぼかし（ティルトシフト）＋色の整え。
// やり方は あそびラボの dusk-diorama/js/render.js と同じ（three.js の EffectComposer・UnrealBloomPass ＋自前のぼかし）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';

export function makePost(renderer, scene, camera, coarse) {
  const composer = new EffectComposer(renderer);   // MSAA の描き先（samples）は、この PC の Chrome で画面が真っ黒になったので使わない。ふちは FXAA で
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);   // 草・花びらのふちのギザギザ
  // ぼかし: 画面のたての focus のまわり band はくっきり、上下へ行くほどぼける（上＝遠く、下＝カメラの手前）
  const TILT = { uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() }, focus: { value: 0.52 }, band: { value: 0.2 }, range: { value: 0.3 }, amount: { value: 2 } }, vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; uniform float focus, band, range, amount; varying vec2 vUv;
      void main(){ float b = amount * smoothstep(0., range, abs(vUv.y - focus) - band); vec2 o1 = dir * 1.3846 * b, o2 = dir * 3.2308 * b;
        gl_FragColor = texture2D(tDiffuse, vUv) * .2270 + (texture2D(tDiffuse, vUv + o1) + texture2D(tDiffuse, vUv - o1)) * .3162 + (texture2D(tDiffuse, vUv + o2) + texture2D(tDiffuse, vUv - o2)) * .0703; }` };
  const tiltH = new ShaderPass(TILT), tiltV = new ShaderPass(TILT); composer.addPass(tiltH); composer.addPass(tiltV);
  // 色: 少しあざやかに、暗いところをあたたかく持ち上げ、ふちをやわらかく落とす。flash は雷
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, aspect: { value: 1 }, flash: { value: 0 }, dim: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, aspect, flash, dim; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, sat * (1. - dim * .45)); c += vec3(.06, .035, .0) * (1. - l);
        c = mix(c, c * vec3(.78, .8, .98), dim);
        vec2 d = (vUv - .5) * vec2(aspect, 1.); c *= 1. - .22 * smoothstep(.35, 1.1, length(d));
        c = mix(c, vec3(1.), flash);
        gl_FragColor = vec4(c, 1.); }` });
  composer.addPass(grade);

  function resize(w, h, dpr) {
    if (coarse) dpr = 1;   // スマホは全画面のパスが重いので解像度 1
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.resolution.set(w * (coarse ? 0.35 : 0.5), h * (coarse ? 0.35 : 0.5));
    fxaa.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr));
    tiltH.uniforms.dir.value.set(1 / w, 0); tiltV.uniforms.dir.value.set(0, 1 / h);
    for (const p of [tiltH, tiltV]) p.uniforms.amount.value = 1.8 * dpr;
    grade.uniforms.aspect.value = w / h;
  }
  return { composer, bloom, grade, resize, render() { composer.render(); } };
}
