// 花の小川: しずくのもちもちの形（PLAN.md 段階A4）。粒を1つずつ玉で描かず、同じ塊の粒どうしだけを なめらかにつないだ1つの形にする。
// やり方: 粒のまわりの箱を描き、画素ごとに光線を進めて形の表面をさがす（レイマーチング）。形は「粒の球の距離」を塊ごとに
// なめらかな min（smin）で合わせ、塊どうしはふつうの min（まざらない）。乾いた粒（かたい粒）は合わせかたを小さく、丸くかたく。
// 見た目は本物の水（ver. 0.7）: 景色を屈折させて透かし、フレネルで空を映す。色は厚みによる吸収だけ。
// 軽くするため（批判役 2026-11-07）: 粒は CPU で塊の番号順に並べて渡し、shader は1つのループで「同じ塊のあいだは smin、
// 塊が変わったら min」。色・乾き・つかみは当たった点で1回だけ。光線は箱を出たら打ち切る。スマホは歩数を減らす。
import * as THREE from 'three';

export const NMAX = 32;

export function makeBlob(sun, coarse, sky = null) {   // sky: 映りこみに使う空の写真（equirect の HDR。なければ手作りの空）
  const P = Array.from({ length: NMAX }, () => new THREE.Vector4(0, -9, 0, 0));   // xyz＝中心、w＝半径
  const D = Array.from({ length: NMAX }, () => new THREE.Vector4(0, 0, 0, 0));    // x＝塊の番号、y＝乾き 0〜1、z＝かたい粒 1・指でつかんでいる 2、w＝ぷるん
  const E = Array.from({ length: NMAX }, () => new THREE.Vector4(1, 0, 0, 0));    // x＝つながりぐあい 0〜1（くっついた直後は 0 から、むにゅっと首がのびる）、yz＝速さの向き（のびる）
  const STEPS = coarse ? 36 : 56;
  const mat = new THREE.ShaderMaterial({
    transparent: false, depthWrite: true,
    uniforms: { P: { value: P }, D: { value: D }, E: { value: E }, n: { value: 0 }, t: { value: 0 }, sun: { value: sun }, bmin: { value: new THREE.Vector3() }, bmax: { value: new THREE.Vector3() }, tScene: { value: null }, res: { value: new THREE.Vector2(1, 1) }, vp: { value: new THREE.Matrix4() }, sky: { value: sky }, useSky: { value: sky ? 1 : 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec4 P[${NMAX}]; uniform vec4 D[${NMAX}]; uniform vec4 E[${NMAX}]; uniform int n; uniform float t; uniform vec3 sun; uniform vec3 bmin; uniform vec3 bmax; uniform sampler2D tScene; uniform vec2 res; uniform mat4 vp; uniform sampler2D sky; uniform float useSky; varying vec3 vW;
      float smin(float a, float b, float k){ k = max(k, 1e-3); float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
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
          tt += d * .8; if (tt > tFar) break;   // 変形した距離は大きめに出るので、少しずつ（すり抜けて穴があかないように）
        }
        if (hit < .5) discard;
        vec3 p = ro + rd * tt;
        vec2 e = vec2(.005, -.005);
        vec3 N = normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
        // 当たった点で1回だけ: 近い粒の乾きとつかみのならし
        float ws = 0., dry = 0., held = 0.;
        for (int i = 0; i < ${NMAX}; i++) { if (i >= n) break; float w = exp(-max(ball(p, i), 0.) * 14.); ws += w; dry += w * D[i].y; held += w * step(1.5, D[i].z); }
        dry /= max(ws, 1e-4); held /= max(ws, 1e-4);
        // 本物の水のように（ver. 0.7）: 色を塗らず、後ろの景色を曲げて透かし、角度で空を映す
        vec3 V = -rd; float cosv = max(dot(N, V), 0.), F = .02 + .98 * pow(1. - cosv, 5.);   // フレネル（水の屈折率 1.33）
        // 厚み: 中心を通る光ほど長く水の中を進む（近い粒の半径から）
        float thick = 0.; for (int i = 0; i < ${NMAX}; i++) { if (i >= n) break; float d = length((p - P[i].xyz).xz); thick = max(thick, P[i].w * sqrt(max(0., 1. - pow(d / max(P[i].w, 1e-3), 2.)))); }
        // 屈折: 画面の上の後ろの絵を、表面の向きでずらして読む（色ごとに少しずつ＝虹のにじみ）
        vec3 Nv = normalize((viewMatrix * vec4(N, 0.)).xyz);
        vec2 uv = gl_FragCoord.xy / res, off = -Nv.xy * (.035 + .05 * thick) * (1. - .4 * dry);
        vec3 bgc = vec3(texture2D(tScene, uv + off * 1.06).r, texture2D(tScene, uv + off).g, texture2D(tScene, uv + off * .94).b);
        // 吸収: 湿ったしずくはほとんど透明（わずかに青緑）、乾くほど はちみつ色（茶色にしない）
        vec3 absorb = mix(vec3(.55, .16, .10), vec3(.08, .55, 1.6), smoothstep(.2, .9, dry));
        vec3 trans = bgc * exp(-absorb * thick * 1.6);
        trans += bgc * pow(cosv, 6.) * .12;   // 中心は少し明るく（レンズで光が集まる）
        // 映りこみ: 空（上ほど青く、地平はあたたかい）と、花畑の緑（下向きの面）
        vec3 R = reflect(rd, N);
        vec3 skyc = mix(vec3(1., .95, .86), vec3(.55, .74, .98), smoothstep(0., .6, R.y));
        vec3 env = R.y > 0. ? skyc : mix(vec3(.30, .48, .20), vec3(1., .95, .86), smoothstep(-.25, 0., R.y));
        if (useSky > .5) { vec2 eu = vec2(atan(R.z, R.x) * .15915 + .5, asin(clamp(R.y, -1., 1.)) * .31831 + .5); env = min(texture2D(sky, eu).rgb * .8, vec3(6.)); }   // 花畑を照らすのと同じ空の写真を映す
        vec3 c = mix(trans, env, F);
        // 太陽のハイライト（小さく鋭い）と、窓のような やわらかい光
        float spec = pow(max(dot(R, normalize(sun)), 0.), 700.) * 14. + pow(max(dot(R, normalize(sun)), 0.), 60.) * .5;
        c += vec3(1., .97, .9) * spec;
        c += vec3(1., .9, .7) * pow(1. - cosv, 2.5) * held * (.35 + .15 * sin(t * 6.));   // 指でつまんでいる塊は、ふちがあたたかく光る
        vec4 clip = vp * vec4(p, 1.);
        gl_FragDepth = clip.z / clip.w * .5 + .5;   // 景色と深さをくらべる（花の陰に入れば隠れる）
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.layers.set(1);   // 景色のあとに別に描く（js/post3d.js の RefractPass）
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
