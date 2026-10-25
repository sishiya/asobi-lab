// カメラの映像を絵になじませる（WebGL）。
// 色移し: Reinhard の lαβ（目の感じ方に近い色の空間）で、顔の色の平均と散らばりを、絵の顔の色にそろえる。
// そのうえで少しぼかし・粒をのせる。左右反転（鏡）もここでする。

const RGB2LMS = [0.3811, 0.5783, 0.0402, 0.1967, 0.7244, 0.0782, 0.0241, 0.1288, 0.8444];
const S3 = 1 / Math.sqrt(3), S6 = 1 / Math.sqrt(6), S2 = 1 / Math.sqrt(2);

// JS 側でも同じ変換（平均と散らばりを測るため）
export function rgbToLab(r, g, b) {
  const m = RGB2LMS;
  const L = Math.log10(Math.max(1e-3, m[0] * r + m[1] * g + m[2] * b));
  const M = Math.log10(Math.max(1e-3, m[3] * r + m[4] * g + m[5] * b));
  const S = Math.log10(Math.max(1e-3, m[6] * r + m[7] * g + m[8] * b));
  return [S3 * (L + M + S), S6 * (L + M - 2 * S), S2 * (L - M)];
}

// 画像の一部（ImageData）の色の平均と散らばり。mask(x, y) が false の点は数えない
export function labStats(data, w, h, mask) {
  const sum = [0, 0, 0], sq = [0, 0, 0]; let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (mask && !mask(x, y)) continue;
    const i = (y * w + x) * 4;
    const lab = rgbToLab(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    for (let k = 0; k < 3; k++) { sum[k] += lab[k]; sq[k] += lab[k] * lab[k]; }
    n++;
  }
  if (!n) return null;
  const mean = sum.map(s => s / n);
  const std = sq.map((s, k) => Math.sqrt(Math.max(1e-6, s / n - mean[k] * mean[k])));
  return { mean, std };
}

const VS = `attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2(1.0 - (p.x * 0.5 + 0.5), 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 px;
uniform vec3 sm, ss, dm, ds;
uniform float k, soft, grain, seed;
vec3 toLab(vec3 c){
  vec3 lms = vec3(dot(c, vec3(0.3811, 0.5783, 0.0402)), dot(c, vec3(0.1967, 0.7244, 0.0782)), dot(c, vec3(0.0241, 0.1288, 0.8444)));
  lms = log(max(lms, vec3(0.001))) / log(10.0);
  return vec3((lms.x + lms.y + lms.z) * 0.57735, (lms.x + lms.y - 2.0 * lms.z) * 0.40825, (lms.x - lms.y) * 0.70711);
}
vec3 toRgb(vec3 l){
  float a = l.x * 0.57735, b = l.y * 0.40825, c = l.z * 0.70711;
  vec3 lms = pow(vec3(10.0), vec3(a + b + c, a + b - c, a - 2.0 * b));
  return vec3(dot(lms, vec3(4.4679, -3.5873, 0.1193)), dot(lms, vec3(-1.2186, 2.3809, -0.1624)), dot(lms, vec3(0.0497, -0.2439, 1.2045)));
}
float hash(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
void main(){
  vec3 c = texture2D(tex, uv).rgb;
  vec3 b = (texture2D(tex, uv + vec2(px.x, 0.0)).rgb + texture2D(tex, uv - vec2(px.x, 0.0)).rgb
          + texture2D(tex, uv + vec2(0.0, px.y)).rgb + texture2D(tex, uv - vec2(0.0, px.y)).rgb) * 0.25;
  c = mix(c, b, soft);
  vec3 l = toLab(c);
  // 明るさの散らばりは 0.6〜1.4 倍まで（絵の穴に暗い背景が入っても、顔の明暗を強めすぎない）
  vec3 r = clamp(ds / ss, vec3(0.6, 0.35, 0.35), vec3(1.4, 2.0, 2.0));
  vec3 t = toRgb((l - sm) * r + dm);
  c = mix(c, clamp(t, 0.0, 1.0), k);
  c += (hash(gl_FragCoord.xy) - 0.5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createBlender() {
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
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const U = n => gl.getUniformLocation(prog, n);
  const u = { px: U('px'), sm: U('sm'), ss: U('ss'), dm: U('dm'), ds: U('ds'), k: U('k'), soft: U('soft'), grain: U('grain'), seed: U('seed') };
  return {
    canvas,
    // video → canvas（鏡にした絵）。src・dst は labStats の結果、amount は 0〜1 のなじませの強さ
    draw(video, w, h, src, dst, amount) {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.uniform2f(u.px, 1.6 / w, 1.6 / h);
      const s = src && dst && amount > 0;
      gl.uniform3fv(u.sm, s ? src.mean : [0, 0, 0]); gl.uniform3fv(u.ss, s ? src.std : [1, 1, 1]);
      gl.uniform3fv(u.dm, s ? dst.mean : [0, 0, 0]); gl.uniform3fv(u.ds, s ? dst.std : [1, 1, 1]);
      gl.uniform1f(u.k, s ? amount : 0);
      gl.uniform1f(u.soft, amount * 0.6);
      gl.uniform1f(u.grain, amount * 0.07);
      gl.uniform1f(u.seed, Math.floor(performance.now() / 120) % 97);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
