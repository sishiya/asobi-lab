// 花の小川: 川の水（PLAN.md 段階A3）。底が見える浅い水: 深さの色・川底の小石・ゆらぐ光の網（コースティクス）・つや・岸の白いふち。
// 指でさわったところと、しずくのまわりに波紋。しずくの下の川底には、しずくがレンズになって集めた光。
import * as THREE from 'three';

const inc = src => src.replace(/#include <(\w+)>/g, '\n#include <$1>\n');
export const NR = 12, NBEAD = 12;   // 波紋の数・しずくの数（シェーダーの配列の長さ）

// P(s, x) → 川の中の位置、widthAt(s) → 川はばの倍率、HALF → 川はばの半分
export function makeRiver({ P, HALF, widthAt, L, sun }) {
  const pos = [], uv = [], idx = []; let n = 0;
  for (let s = -400; s <= L + 60; s += 10) {
    const c = P(s), d = P(s + 1).sub(c).normalize(), nx = -d.z, nz = d.x, hw = HALF * 1.12 * widthAt(s);
    for (const side of [-1, 1]) { pos.push(c.x + nx * side * hw, 0, c.z + nz * side * hw); uv.push(side < 0 ? 0 : 1, s / 100); }
    if (n) idx.push(2 * n - 2, 2 * n - 1, 2 * n, 2 * n - 1, 2 * n + 1, 2 * n);
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const ripples = Array.from({ length: NR }, () => new THREE.Vector4(0, 0, -99, 0));
  const beads = Array.from({ length: NBEAD }, () => new THREE.Vector4(0, 0, 0, 0));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { t: { value: 0 }, flow: { value: 0 }, sun: { value: sun }, ripples: { value: ripples }, beads: { value: beads }, cloud: { value: 0 }, ...THREE.UniformsLib.fog },
    vertexShader: inc(`varying vec2 vUv; varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vUv = uv; vW = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`),
    fragmentShader: inc(`uniform float t; uniform float flow; uniform vec3 sun; uniform vec4 ripples[${NR}]; uniform vec4 beads[${NBEAD}]; uniform float cloud;
      varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec2 h2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      // ボロノイ: 小石（f1）と光の網（f2−f1 の細い線）
      vec2 vor(vec2 p, float tm){ vec2 i = floor(p), f = fract(p); float d1 = 9., d2 = 9.;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = h2(i + g); o = .5 + .45 * sin(tm + 6.2831 * o); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        return vec2(d1, d2 - d1); }
      void main(){
        float e = abs(vUv.x - .5) * 2.;                 // 0＝まん中、1＝岸
        float depth = 1. - e * e;
        vec2 q = vW.xz;
        // 水面のゆらぎ（流れの向き＝−z へ動く）
        vec2 fq = q + vec2(0., flow);
        float w1 = n(fq * vec2(2.2, 1.1)), w2 = n(fq * vec2(5., 2.6) + 7.);
        vec2 wob = (vec2(w1, w2) - .5) * .12;
        // 波紋: 指でさわったところ（xy＝位置、z＝生まれた時刻、w＝強さ）
        float rip = 0.;
        for (int k = 0; k < ${NR}; k++) { vec4 r = ripples[k]; float age = t - r.z; if (age < 0. || age > 2.5) continue;
          float d = length(q - r.xy), front = age * 1.5; float env = exp(-pow((d - front) * 3.2, 2.)) * (1. - age / 2.5) * r.w;
          rip += sin((d - front) * 22.) * env; }
        // しずくのまわり: 小さな波の輪と、川底の光（xy＝位置、z＝大きさ、w＝乾き 0〜1）
        float ring = 0., focus = 0., gold = 0., shade = 0.;
        for (int k = 0; k < ${NBEAD}; k++) { vec4 b = beads[k]; if (b.z <= 0.) continue;
          float d = length(q - b.xy);
          ring += exp(-pow((d - .36 * b.z) * 14., 2.)) * .5 * (.6 + .4 * sin(t * 6. + float(k)));
          float f = exp(-pow(length(q - b.xy - vec2(.09, .14)) / (.16 * b.z), 2.)); focus += f; gold += f * b.w;
          shade += exp(-pow(length((q - b.xy - vec2(-.06, .2)) * vec2(1., .8)) / (.34 * b.z), 2.)); }
        wob += vec2(rip) * .25;
        // 川底: 砂の色に小石。深いところほど水の色に沈む
        vec2 vo = vor(q * 2.6 + wob * 2., 0.);
        vec3 bed = mix(vec3(.80, .75, .60), vec3(.74, .70, .58), smoothstep(.0, .7, vo.x)) * (.94 + .1 * n(q * 9.)) * (.95 + .08 * h(floor(q * 2.6 + wob * 2.)));   // 小石はうっすら（タイルに見えないように）
        vec2 ca = vor(q * 1.7 + wob * 4. + vec2(0., flow * .35), t * .8);
        float caus = pow(smoothstep(.09, 0., ca.y), 2.) * (.35 + .4 * depth) * (1. - cloud * .7);   // 光の網
        vec3 shallow = vec3(.50, .80, .82), deep = vec3(.14, .40, .60);
        vec3 col = mix(bed, mix(shallow, deep, depth), .35 + .55 * depth);
        col += vec3(1., .98, .86) * caus * .1;
        col *= 1. - .38 * min(shade, 1.);   // しずくの影
        col += mix(vec3(.8, 1., 1.), vec3(1., .86, .45), gold / max(focus, 1e-3)) * min(focus, 1.2) * .55;   // しずくが集めた光
        // つや: 遠くほど空を映す（フレネル）。太陽のまぶしい点がまたたく
        vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vec3(wob.x * 3., 1., wob.y * 3.));
        float fr = pow(1. - max(dot(N, V), 0.), 4.);
        col = mix(col, vec3(.90, .93, .96), fr * .4);
        vec3 Hh = normalize(sun + V); float sp = pow(max(dot(N, Hh), 0.), 300.) * step(.72, n(q * 34. + vec2(t * 2., flow * 3.))) * (1. - cloud);   // まぶしい点は、こまかくまたたく粒に
        col += sp * 2. + rip * .12 + ring * .25;
        // 岸の白いふち（波打ちぎわ）
        float foam = smoothstep(.80, .9, e + (w1 - .5) * .12) * (1. - smoothstep(.95, 1., e));
        col = mix(col, vec3(.97, .97, .93), foam * .55);
        gl_FragColor = vec4(pow(max(col, 0.), vec3(2.2)), 1. - smoothstep(.93, 1., e));
        #include <fog_fragment>
      }`),
  });
  const mesh = new THREE.Mesh(g, mat);
  let ri = 0;
  return {
    mesh, mat,
    ripple(x, z, tNow, str = 1) {   // 寿命（2.5 秒）が終わった枠から使う。空きがなければいちばん古いもの
      let k = ripples.findIndex(r => tNow - r.z > 2.5); if (k < 0) { k = ri; ri = (ri + 1) % NR; }
      ripples[k].set(x, z, tNow, str);
    },
    setBead(i, x, z, size, dry) { beads[i].set(x, z, size, dry); },
  };
}
