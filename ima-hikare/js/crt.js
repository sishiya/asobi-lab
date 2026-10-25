// いま光れ（見くらべ）: 白黒のブラウン管を描く（WebGL2・1パス）。
// 光る量（glow 375×246）を受け取り、ふくらみ・とびこしなしの走査線・横のにじみ・ブルーム・ガラスの映りこみ・角の暗さをかける。
// 色の三つ組の網目と色ずれは入れない（白黒の管。ART の決めごと）。
const VS = `#version 300 es
in vec2 a; out vec2 uv; void main(){ uv = a * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(a, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uGlow;
uniform vec2 uPic;        // 375×246
uniform vec2 uRes;        // キャンバスのピクセル
uniform float uCurve, uScan, uBloom, uRefl, uFlick, uDot;
uniform vec3 uBeam;       // x,y（絵の座標）, 見せるか
uniform vec3 uBeamSz;     // 芯・光の輪・尾（絵の座標）
uniform float uCorner;    // 型紙のかぎかっこの長さ
uniform vec2 uStripe;     // 見本の縞（ビットの重さ, 明るさ）
uniform vec4 uBandX;      // 縦帯 x0,x1（絵の座標）, 強さ, 重なり
uniform vec4 uBandY;      // 横帯 y0,y1, 強さ
uniform vec4 uGhost;      // 型紙 x0,y0,x1,y1（0なら出さない）
uniform float uGhostOn;
uniform float uTime;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float g(vec2 p){ return texture(uGlow, p / uPic).r; }

void main(){
  // ふくらみ（たる型）
  vec2 q = uv * 2.0 - 1.0;
  float k = uCurve;
  q *= 1.0 + k * dot(q, q) * vec2(0.9, 1.1);
  vec2 p = (q * 0.5 + 0.5) * uPic;
  vec2 ad = abs(q) - vec2(0.97);
  float edge = 1.0 - smoothstep(-0.01, 0.02, length(max(ad, 0.0)) + min(max(ad.x, ad.y), 0.0) - 0.0);
  // 管の面（光っていないガラス）
  vec3 face = vec3(0.030, 0.036, 0.036);
  vec3 col = face;
  if (edge > 0.0){
    // 1行のビームのすじ（262本・とびこしなし）。明るいほどすじが太る
    float row = p.y + 16.0;                 // 本物の行（消す時間を足す）
    float fy = fract(row) - 0.5;
    float lum = 0.0;
    // 横のにじみ（帯域が狭いので、右へ少し尾を引く）
    for (int i = -1; i <= 3; i++){
      float dx = float(i) * 0.6;
      float w = i < 0 ? 0.35 : exp(-0.35 * float(i * i));
      lum += g(vec2(p.x - dx, floor(p.y) + 0.5)) * w;
    }
    lum /= 2.3;
    float width = mix(0.22, 0.48, clamp(lum, 0.0, 1.0));
    float line = exp(-0.5 * fy * fy / (width * width));
    lum *= mix(1.0, line * 1.35, uScan);
    // ブルーム（明るい所のにじみ。2段）
    float b1 = 0.0, b2 = 0.0;
    for (int i = 0; i < 8; i++){
      float a = float(i) * 0.785398;
      vec2 d = vec2(cos(a), sin(a));
      b1 += g(p + d * 1.6);
      b2 += g(p + d * 4.5);
    }
    lum += uBloom * (b1 / 8.0 * 0.55 + b2 / 8.0 * 0.5);
    // 白（P4）が消えぎわに少し青緑へ
    vec3 hot = vec3(0.78, 0.86, 0.95), cool = vec3(0.45, 0.55, 0.62);
    float tl = 1.0 - exp(-1.7 * lum);       // 明るい所が真っ白にとばないように（トーンマップ）
    vec3 ph = mix(cool, hot, smoothstep(0.02, 0.8, lum)) * tl * 0.78 * uFlick;
    col += ph;
    // 一致の帯（うすい琥珀）。くらべる部品が 1 のあいだ。重なった所だけ強く
    vec3 amber = vec3(1.0, 0.70, 0.28);
    float inX = step(uBandX.x, p.x) * step(p.x, uBandX.y);
    float inY = step(uBandY.x, p.y) * step(p.y, uBandY.y);
    col += amber * (inX * uBandX.z + inY * uBandY.z + inX * inY * uBandX.w);
    // 型紙（ねらいの所）。四すみのかぎかっこだけ（帯は面、型紙は線、点は白、と形を分ける。UX）
    if (uGhostOn > 0.5){
      vec2 a0 = uGhost.xy, a1 = uGhost.zw;
      vec2 mid = (a0 + a1) * 0.5;
      vec2 c = vec2(p.x < mid.x ? a0.x : a1.x, p.y < mid.y ? a0.y : a1.y);
      vec2 d = (p - c) * vec2(p.x < mid.x ? 1.0 : -1.0, p.y < mid.y ? 1.0 : -1.0);   // 内がわが正
      float lw = 1.0;
      float arm = step(abs(d.y), lw) * step(-lw, d.x) * step(d.x, uCorner) + step(abs(d.x), lw) * step(-lw, d.y) * step(d.y, uCorner);
      col += vec3(0.62, 0.78, 0.88) * min(arm, 1.0) * 0.6;
    }
    // 見本の縞（段0。脈打っている端子をつなぐと出る縞をうすく）
    if (uStripe.x > 0.0){
      float on = mod(floor((p.x + 80.0) / uStripe.x), 2.0);
      col += vec3(0.55, 0.68, 0.78) * on * uStripe.y * 0.35;
    }
    // ビームのいる所（見せかけ。本物のビームは光らせない所では見えない）。芯・光の輪・いまの行のうしろの尾
    if (uBeam.z > 0.5){
      vec2 d = p - uBeam.xy;
      float r2 = dot(d * vec2(1.0, 1.15), d * vec2(1.0, 1.15));
      col += vec3(0.85, 0.92, 1.0) * exp(-r2 / (2.0 * uBeamSz.x * uBeamSz.x * 0.45)) * 0.9;
      col += vec3(0.6, 0.75, 1.0) * exp(-r2 / (2.0 * uBeamSz.y * uBeamSz.y * 0.3)) * 0.25;
      float tail = step(abs(d.y), 0.7) * step(-uBeamSz.z, d.x) * step(d.x, 0.0);
      col += vec3(0.7, 0.85, 1.0) * tail * (1.0 + d.x / uBeamSz.z) * 0.35;
    }
  }
  // ガラスの映りこみ（机のランプのにじんだ形・左上）と、角の暗さ
  vec2 r = uv - vec2(0.24, 0.18);
  float refl = exp(-dot(r * vec2(1.0, 1.8), r * vec2(1.0, 1.8)) / 0.02);
  col += vec3(1.0, 0.86, 0.66) * refl * uRefl;
  col += vec3(0.9, 0.95, 1.0) * smoothstep(0.08, 0.0, abs(uv.y - 0.06 - uv.x * 0.08)) * uRefl * 0.25;
  float vig = smoothstep(1.6, 0.4, length(q * vec2(0.92, 1.0)));
  col *= mix(0.55, 1.0, vig);
  col *= edge;
  // ガラスのざらつき
  col += (hash(uv * uRes + uTime) - 0.5) * 0.012;
  o = vec4(pow(max(col, 0.0), vec3(1.0 / 1.15)), 1.0);
}`;

export function makeCRT(canvas, picW, picH) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, picW, picH, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  const U = n => gl.getUniformLocation(pr, n);
  const u = Object.fromEntries(['uGlow', 'uPic', 'uRes', 'uCurve', 'uScan', 'uBloom', 'uRefl', 'uFlick', 'uDot', 'uBeam', 'uBandX', 'uBandY', 'uGhost', 'uGhostOn', 'uTime', 'uBeamSz', 'uCorner', 'uStripe'].map(n => [n, U(n)]));
  gl.uniform1i(u.uGlow, 0);
  gl.uniform2f(u.uPic, picW, picH);
  const bytes = new Uint8Array(picW * picH);
  return {
    draw(glow, o) {
      const w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      for (let i = 0; i < bytes.length; i++) { const v = glow[i]; bytes[i] = v >= 1 ? 255 : v <= 0 ? 0 : v * 255; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, picW, picH, gl.RED, gl.UNSIGNED_BYTE, bytes);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uCurve, o.curve); gl.uniform1f(u.uScan, o.scan); gl.uniform1f(u.uBloom, o.bloom);
      gl.uniform1f(u.uRefl, o.refl); gl.uniform1f(u.uFlick, o.flick); gl.uniform1f(u.uDot, o.dot);
      gl.uniform3f(u.uBeam, o.beam[0], o.beam[1], o.beam[2]);
      gl.uniform4f(u.uBandX, ...o.bandX); gl.uniform4f(u.uBandY, ...o.bandY);
      gl.uniform4f(u.uGhost, ...o.ghost); gl.uniform1f(u.uGhostOn, o.ghostOn);
      gl.uniform1f(u.uTime, o.time);
      gl.uniform3f(u.uBeamSz, o.beamCore, o.beamHalo, o.beamTail); gl.uniform1f(u.uCorner, o.corner); gl.uniform2f(u.uStripe, o.stripe[0], o.stripe[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
