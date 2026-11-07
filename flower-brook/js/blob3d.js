// 花の小川: しずくのもちもちの形（PLAN.md 段階A4）。粒を1つずつ玉で描かず、同じ塊の粒どうしだけを なめらかにつないだ1つの形にする。
// やり方: 粒のまわりの箱を描き、画素ごとに光線を進めて形の表面をさがす（レイマーチング）。形は「粒の球の距離」を塊ごとに
// なめらかな min（smin）で合わせ、塊どうしはふつうの min（まざらない）。乾いた粒（かたい粒）は合わせかたを小さく、丸くかたく。
// 軽くするため（批判役 2026-11-07）: 粒は CPU で塊の番号順に並べて渡し、shader は1つのループで「同じ塊のあいだは smin、
// 塊が変わったら min」。色・乾き・つかみは当たった点で1回だけ。光線は箱を出たら打ち切る。スマホは歩数を減らす。
import * as THREE from 'three';

export const NMAX = 32;

export function makeBlob(sun, coarse) {
  const P = Array.from({ length: NMAX }, () => new THREE.Vector4(0, -9, 0, 0));   // xyz＝中心、w＝半径
  const D = Array.from({ length: NMAX }, () => new THREE.Vector4(0, 0, 0, 0));    // x＝塊の番号、y＝乾き 0〜1、z＝かたい粒 1・指でつかんでいる 2、w＝ぷるん
  const E = Array.from({ length: NMAX }, () => new THREE.Vector4(1, 0, 0, 0));    // x＝つながりぐあい 0〜1（くっついた直後は 0 から、むにゅっと首がのびる）、yz＝速さの向き（のびる）
  const STEPS = coarse ? 36 : 56;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { P: { value: P }, D: { value: D }, E: { value: E }, n: { value: 0 }, t: { value: 0 }, sun: { value: sun }, bmin: { value: new THREE.Vector3() }, bmax: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec4 P[${NMAX}]; uniform vec4 D[${NMAX}]; uniform vec4 E[${NMAX}]; uniform int n; uniform float t; uniform vec3 sun; uniform vec3 bmin; uniform vec3 bmax; varying vec3 vW;
      float smin(float a, float b, float k){ k = max(k, 1e-3); float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
      vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., .333, .667)) * 6. - 3.) - 1., 0., 1.); }
      float ball(vec3 p, int i){
        vec4 c = P[i]; vec4 d = D[i]; vec4 e = E[i];
        vec3 q = p - c.xyz; q.y /= mix(.78, .95, d.y);                              // 水っぽいほど平たく、乾くほど丸く
        vec2 v = e.yz; float sp = length(v);
        if (sp > .01) { vec2 u = v / sp; float a = dot(q.xz, u); q.xz += u * a * (1. / (1. + sp) - 1.); }   // 速いほど、流れの向きにのびる
        float r = c.w * (1. + .07 * sin(t * 2.3 + float(i) * 1.7) + d.w * .25 * sin(t * 17. + float(i)));
        return length(q) - r;
      }
      // 形までの距離（粒は塊の番号順に並んでいる）
      float sdf(vec3 p){
        float m = 1e3, acc = 1e3, g = -1.;
        for (int i = 0; i < ${NMAX}; i++) {
          if (i >= n) break;
          float di = ball(p, i), gi = D[i].x;
          if (gi != g) { m = min(m, acc); acc = di; g = gi; }
          else acc = smin(acc, di, (D[i].z > .5 && D[i].z < 1.5 ? .02 : .26) * E[i].x);   // かたい粒はほとんどつながらない
        }
        return min(m, acc);
      }
      void main(){
        vec3 ro = cameraPosition, rd = normalize(vW - cameraPosition);
        vec3 inv = 1. / rd, t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
        vec3 tmx = max(t0, t1); float tFar = min(min(tmx.x, tmx.y), tmx.z);       // 箱を出るところ
        float tt = length(vW - ro) - .02, hit = 0.;
        for (int k = 0; k < ${STEPS}; k++) {
          float d = sdf(ro + rd * tt);
          if (d < .004) { hit = 1.; break; }
          tt += d; if (tt > tFar) break;
        }
        if (hit < .5) discard;
        vec3 p = ro + rd * tt;
        vec2 e = vec2(.005, -.005);
        vec3 N = normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
        // 当たった点で1回だけ: 近い粒の乾きとつかみのならし
        float ws = 0., dry = 0., held = 0.;
        for (int i = 0; i < ${NMAX}; i++) { if (i >= n) break; float w = exp(-max(ball(p, i), 0.) * 14.); ws += w; dry += w * D[i].y; held += w * step(1.5, D[i].z); }
        dry /= max(ws, 1e-4); held /= max(ws, 1e-4);
        vec3 V = -rd; float f = 1. - max(dot(N, V), 0.);
        // 色: 水色 → はちみつの金（茶色にしない）。すけて、ふちほど濃い。内からの光は乾くほど
        vec3 wet = vec3(.42, .84, .97), honey = vec3(1., .80, .38), gold = vec3(1., .70, .30);
        vec3 col = dry < .65 ? mix(wet, honey, dry / .65) : mix(honey, gold, (dry - .65) / .35);
        vec3 c = mix(col * .95, col * col * .72, f * f);
        c += (1. - f) * (.08 + .38 * dry) * col;
        c = mix(c, hue(f * 1.3 + t * .12 + N.x * .4) * .85, smoothstep(.55, .98, f) * (.5 - .3 * dry));   // 虹色のふち（湿っているほど）
        float sp = pow(max(dot(N, normalize(sun + V)), 0.), 90.) * 1.4 + pow(max(dot(N, normalize(vec3(-.45, .7, .55))), 0.), 50.) * .9;
        c += sp + vec3(1., .97, .9) * pow(max(dot(N, normalize(vec3(.4, .8, .45))), 0.), 6.) * .12;   // もちもちのつや
        c += vec3(1., .9, .7) * pow(f, 2.5) * held * (.55 + .2 * sin(t * 6.));                       // 指でつかんでいる塊は、ふちがあたたかく光る
        float a = mix(.62, .9, dry) + .3 * f + sp;
        gl_FragColor = vec4(pow(max(c, 0.), vec3(2.2)), min(a, 1.));
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  mesh.renderOrder = 2; mesh.frustumCulled = false;
  const box = new THREE.Box3(), order = [];
  return {
    mesh, mat,
    // list: [{ x, y, z, r, g, dry, pellet, held, jig, conn, vx, vz }]
    set(list, t) {
      box.makeEmpty();
      order.length = 0; for (let i = 0; i < list.length; i++) order.push(i);
      order.sort((a, b) => list[a].g - list[b].g);   // 塊の番号順（shader は並びの切れ目で塊を分ける）
      order.forEach((k, i) => {
        const b = list[k];
        P[i].set(b.x, b.y, b.z, b.r); D[i].set(b.g, b.dry, b.pellet ? 1 : b.held ? 2 : 0, b.jig); E[i].set(b.conn, b.vx, b.vz, 0);
        if (b.r > 0.001) { const m = b.r * 1.6; box.expandByPoint(_v.set(b.x - m, b.y - m, b.z - m)); box.expandByPoint(_v.set(b.x + m, b.y + m, b.z + m)); }
      });
      mat.uniforms.n.value = list.length; mat.uniforms.t.value = t;
      mesh.visible = !box.isEmpty();
      if (mesh.visible) { box.expandByScalar(0.1); box.getCenter(mesh.position); box.getSize(mesh.scale); mat.uniforms.bmin.value.copy(box.min); mat.uniforms.bmax.value.copy(box.max); }
    },
  };
}
const _v = new THREE.Vector3();
