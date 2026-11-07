// 花の小川: しずくのもちもちの形（PLAN.md 段階A4）。粒を1つずつ玉で描かず、同じ塊の粒どうしだけを なめらかにつないだ1つの形にする。
// やり方: 粒のまわりの箱を描き、画素ごとに光線を進めて形の表面をさがす（レイマーチング）。形は「粒の球の距離」を塊ごとに
// なめらかな min（smin）で合わせ、塊どうしはふつうの min（まざらない）。乾いた粒（かたい粒）は合わせかたを小さく、丸くかたく。
import * as THREE from 'three';

export const NMAX = 32;

export function makeBlob(sun) {
  const P = Array.from({ length: NMAX }, () => new THREE.Vector4(0, -9, 0, 0));   // xyz＝中心、w＝半径
  const D = Array.from({ length: NMAX }, () => new THREE.Vector4(0, 0, 0, 0));    // x＝塊の番号、y＝乾き 0〜1、z＝かたい粒か、w＝ぷるん
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { P: { value: P }, D: { value: D }, n: { value: 0 }, t: { value: 0 }, sun: { value: sun } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec4 P[${NMAX}]; uniform vec4 D[${NMAX}]; uniform int n; uniform float t; uniform vec3 sun; varying vec3 vW;
      float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
      vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., .333, .667)) * 6. - 3.) - 1., 0., 1.); }
      float gd[${NMAX}];
      // 形までの距離。dry: 近い粒の乾きのならし
      float sdf(vec3 p, out float dry){
        for (int g = 0; g < ${NMAX}; g++) gd[g] = 1e3;
        float ws = 0., dw = 0.;
        for (int i = 0; i < ${NMAX}; i++) {
          if (i >= n) break;
          vec4 c = P[i]; vec4 d = D[i];
          vec3 q = p - c.xyz; q.y /= mix(.78, .95, d.y);                       // 水っぽいほど平たく、乾くほど丸く
          float r = c.w * (1. + .07 * sin(t * 2.3 + float(i) * 1.7) + d.w * .25 * sin(t * 17. + float(i)));
          float di = length(q) - r;
          int g = int(d.x + .5);
          gd[g] = smin(gd[g], di, d.z > .5 ? .02 : .26);                        // かたい粒はほとんどつながらない
          float w = exp(-max(di, 0.) * 14.); ws += w; dw += w * d.y;
        }
        float m = 1e3; for (int g = 0; g < ${NMAX}; g++) m = min(m, gd[g]);
        dry = dw / max(ws, 1e-4);
        return m;
      }
      void main(){
        vec3 ro = cameraPosition, rd = normalize(vW - cameraPosition);
        float tt = length(vW - ro) - .05, dry = 0., hit = 0.;
        for (int k = 0; k < 56; k++) {
          float d = sdf(ro + rd * tt, dry);
          if (d < .003) { hit = 1.; break; }
          tt += d; if (tt > 60.) break;
        }
        if (hit < .5) discard;
        vec3 p = ro + rd * tt; float dd;
        vec2 e = vec2(.004, -.004);
        vec3 N = normalize(e.xyy * sdf(p + e.xyy, dd) + e.yyx * sdf(p + e.yyx, dd) + e.yxy * sdf(p + e.yxy, dd) + e.xxx * sdf(p + e.xxx, dd));
        vec3 V = -rd; float f = 1. - max(dot(N, V), 0.);
        // 色: 水色 → はちみつの金（茶色にしない）。すけて、ふちほど濃い。内からの光は乾くほど
        vec3 wet = vec3(.42, .84, .97), honey = vec3(1., .80, .38), gold = vec3(1., .70, .30);
        vec3 col = dry < .65 ? mix(wet, honey, dry / .65) : mix(honey, gold, (dry - .65) / .35);
        vec3 c = mix(col * .95, col * col * .72, f * f);
        c += (1. - f) * (.08 + .38 * dry) * col;
        c = mix(c, hue(f * 1.3 + t * .12 + N.x * .4) * .85, smoothstep(.55, .98, f) * (.5 - .3 * dry));   // 虹色のふち（湿っているほど）
        float sp = pow(max(dot(N, normalize(sun + V)), 0.), 90.) * 1.4 + pow(max(dot(N, normalize(vec3(-.45, .7, .55))), 0.), 50.) * .9;
        c += sp + vec3(1., .97, .9) * pow(max(dot(N, normalize(vec3(.4, .8, .45))), 0.), 6.) * .12;   // もちもちのつや
        float a = mix(.62, .9, dry) + .3 * f + sp;
        gl_FragColor = vec4(pow(max(c, 0.), vec3(2.2)), min(a, 1.));
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  mesh.renderOrder = 2; mesh.frustumCulled = false;
  const box = new THREE.Box3();
  return {
    mesh, mat,
    // list: [{ x, y, z, r, g, dry, pellet, jig }]
    set(list, t) {
      box.makeEmpty();
      list.forEach((b, i) => {
        P[i].set(b.x, b.y, b.z, b.r); D[i].set(b.g, b.dry, b.pellet ? 1 : 0, b.jig);
        if (b.r > 0.001) { box.expandByPoint(_v.set(b.x - b.r, b.y - b.r, b.z - b.r)); box.expandByPoint(_v.set(b.x + b.r, b.y + b.r, b.z + b.r)); }
      });
      mat.uniforms.n.value = list.length; mat.uniforms.t.value = t;
      mesh.visible = !box.isEmpty();
      if (mesh.visible) { box.expandByScalar(0.12); box.getCenter(mesh.position); box.getSize(mesh.scale); }
    },
  };
}
const _v = new THREE.Vector3();
