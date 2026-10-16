// 見た目どうしで使う道具
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function radialTexture(inner, outer) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 絵を描いた canvas から、くり返すテクスチャ
export function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  return tex;
}

// 台の上の床（テクスチャつきの大きな板）
export function floorPlane(L, tex, y = -4.5, color = '#ffffff') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L.W + 70, L.T + 90),
    new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.85 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(L.W / 2, y, L.T / 2);
  return m;
}

// 地形の列の、左右のとなりより高い面に影
export function sideShade(g, L, S, rgba) {
  const py = (y) => (L.H - y) * S;
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const l = c > 0 ? L.tops[c - 1] : top, r = c < L.W - 1 ? L.tops[c + 1] : top;
    const W = 7;
    for (const [side, nb] of [[0, l], [1, r]]) {
      if (nb >= top) continue;
      const y0 = py(top), y1 = nb === -Infinity ? py(0) : py(nb);
      const x = side ? (c + 1) * S : c * S;
      const gr = g.createLinearGradient(x, 0, side ? x - W : x + W, 0);
      gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(side ? x - W : x, y0 + 3, W, y1 - y0);
    }
  }
}
