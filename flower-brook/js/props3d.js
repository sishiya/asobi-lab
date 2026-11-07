// 岸の石とアーチの根もと（ver. 0.9）。形は TripoSG（MIT）で自作の画像から作った（tools/build-prop-inputs.py → tools/triposg-run.py）。
// 写真の模様は貼らない（ver. 0.7 で「ポリゴン感がつよまってきたなく見えた」）。色は形の向きと高さから: 水ぎわはぬれて暗く、上を向いた面にうすい苔。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// glb の最初のメッシュを、底が y=0・横の中心が原点・横はば 1 にそろえる
function shape(scene) {
  let geo = null;
  scene.updateMatrixWorld(true);
  scene.traverse(o => { if (!geo && o.isMesh) geo = o.geometry.clone().applyMatrix4(o.matrixWorld); });
  geo.computeBoundingBox();
  const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  geo.translate(-c.x, -b.min.y, -c.z); geo.scale(1 / w, 1 / w, 1 / w);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo, 1e-4); geo.computeVertexNormals();   // 頂点をまとめないと面ごとの法線になり、角ばって見える
  return geo;
}

function propMaterial(color, moss) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 wp4 = vec4(transformed, 1.);\n#ifdef USE_INSTANCING\nwp4 = instanceMatrix * wp4;\n#endif\nvWp = (modelMatrix * wp4).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float up = clamp(normalize(vWn).y, 0., 1.);
        float n = fract(sin(dot(floor(vWp * 9.), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        diffuseColor.rgb *= .9 + .2 * n;                                                      // ほんの少しのむら
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${moss}), smoothstep(.55, .95, up) * .5);   // 上を向いた面に苔
        float wet = 1. - smoothstep(.0, .08, vWp.y);                                          // 水ぎわはぬれて暗い
        diffuseColor.rgb *= 1. - .45 * wet;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .35, 1. - smoothstep(.0, .08, vWp.y));');
  };
  m.userData.keep = true;
  return m;
}

export function makeProps() {
  const stoneMat = propMaterial('#b3ada2', '.42,.52,.30'), rootMat = propMaterial('#6e5c47', '.36,.48,.26');
  let geos = null;
  const ready = new GLTFLoader().setPath('./assets/');
  const loaded = Promise.all(['stones.glb', 'roots.glb'].map(f => ready.loadAsync(f).then(g => shape(g.scene))))
    .then(([stones, roots]) => { geos = { stones, roots }; })
    .catch(e => console.warn('岸の石・根もとを読めなかったので、なしで', e));
  // list: [{x, z, s, ry}]。コースを作りなおすと geometry は捨てられるので、毎回 clone する
  const place = (geo, mat, list) => {
    const m = new THREE.InstancedMesh(geo.clone(), mat, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { o.position.set(p.x, p.y ?? 0, p.z); o.rotation.set(0, p.ry, 0); o.scale.setScalar(p.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.computeBoundingSphere(); return m;
  };
  return {
    loaded,
    stones: list => geos && list.length ? place(geos.stones, stoneMat, list) : null,
    roots: list => geos && list.length ? place(geos.roots, rootMat, list) : null,
  };
}
