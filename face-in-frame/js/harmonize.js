// なじませ（周波数で分ける）: 穴のまわりの映像を「ぼかした成分（明るさ・色・光の当たり方）」と「こまかい成分（口・鼻・しわ）」に分け、
// ぼかした成分だけを、穴の下にある元の絵の顔のぼかした成分に入れかえる。部屋の明るさ・照明の色・肌の色・横からの光を、まとめて絵の光にそろえる。
// out = 映像 + (絵のぼかし − 映像のぼかし) × amount。ぼかしは小さな絵（GRID×GRID）に縮めて、なめらかに広げて作る（口の開きは、こまかいほうに残る粗さ）
export const GRID = 6;

const VS = `attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D src, lowSrc, lowDst;
uniform float k;
uniform vec2 lp; // 小さな絵の1ますの大きさ（uv）
vec3 low(sampler2D t){ // 4点をならして、ますの目が出ないように
  return (texture2D(t, uv + vec2(-lp.x, -lp.y) * 0.5).rgb + texture2D(t, uv + vec2(lp.x, -lp.y) * 0.5).rgb
        + texture2D(t, uv + vec2(-lp.x, lp.y) * 0.5).rgb + texture2D(t, uv + vec2(lp.x, lp.y) * 0.5).rgb) * 0.25;
}
void main(){
  vec3 c = texture2D(src, uv).rgb;
  gl_FragColor = vec4(clamp(c + (low(lowDst) - low(lowSrc)) * k, 0.0, 1.0), 1.0);
}`;

// 小さく縮める（2段で縮めて、ならす）
const small = (() => {
  const mid = document.createElement('canvas'); mid.width = mid.height = GRID * 4;
  return (src, x, y, w, h, out) => {
    out.width = out.height = GRID;
    const m = mid.getContext('2d'); m.imageSmoothingQuality = 'high'; m.clearRect(0, 0, mid.width, mid.height);
    m.drawImage(src, x, y, w, h, 0, 0, mid.width, mid.height);
    const o = out.getContext('2d'); o.imageSmoothingQuality = 'high'; o.drawImage(mid, 0, 0, GRID, GRID);
    return out;
  };
})();

export function createHarmonizer() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = [0, 1, 2].map(i => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  });
  gl.uniform1i(gl.getUniformLocation(prog, 'src'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'lowSrc'), 1);
  gl.uniform1i(gl.getUniformLocation(prog, 'lowDst'), 2);
  const uk = gl.getUniformLocation(prog, 'k'), ulp = gl.getUniformLocation(prog, 'lp');
  const lowSrc = document.createElement('canvas'), crop = document.createElement('canvas');
  const up = (i, img) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); };
  return {
    // 絵の (x, y, w, h) を小さく縮めたもの（元の絵の顔の、ぼかした成分）。絵ごとに1回
    lowOf: (img, x, y, w, h) => small(img, x, y, w, h, document.createElement('canvas')),
    // g（2D）の (x, y, w, h) を、lowDst に合わせてなじませて、その場に描きもどす。amount は 0〜1
    apply(g, [x, y, w, h], lowDst, amount) {
      const W = Math.max(8, Math.round(w)), H = Math.max(8, Math.round(h));
      crop.width = W; crop.height = H;
      crop.getContext('2d').drawImage(g.canvas, x, y, w, h, 0, 0, W, H);
      small(crop, 0, 0, W, H, lowSrc);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
      up(0, crop); up(1, lowSrc); up(2, lowDst);
      gl.uniform1f(uk, amount); gl.uniform2f(ulp, 1 / GRID, 1 / GRID);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(canvas, x, y, w, h); g.restore();
    },
  };
}
