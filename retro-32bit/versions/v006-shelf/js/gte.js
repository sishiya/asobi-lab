// GTE（COP2）: 3D の計算の専用チップ。座標変換（回す・ずらす・画面へ投げる）・光と色・面の向き・奥行きの平均。
//   数は固定小数点（1.0 = 4096）。計算のとちゅうのあふれ・値の切りつめは FLAG に印を立てる（本物と同じ所で）
//   命令の語: 19 番 sf（12 ビット右へずらす）、10 番 lm（IR を 0 より下にしない）、17-18 行列・15-16 ベクトル・13-14 足す物（MVMVA）、0-5 命令
const UNR = Array.from({ length: 257 }, (_, i) => Math.max(0, Math.floor((Math.floor(0x40000 / (i + 0x100)) + 1) / 2) - 0x101));
const P43 = 2 ** 43, P44 = 2 ** 44;
const s16 = (v) => (v << 16) >> 16;
const lo16 = (v) => s16(v), hi16 = (v) => v >> 16;
const pack = (a, b) => ((b & 0xffff) << 16) | (a & 0xffff);

export class GTE {
  constructor() {
    this.v = [new Int32Array(3), new Int32Array(3), new Int32Array(3)]; // V0〜V2（16 ビット）
    this.rgbc = 0; this.otz = 0;
    this.ir = new Int32Array(4);
    this.sxy = [0, 0, 0];             // 画面の点の FIFO（xy をつめた形）
    this.sz = new Int32Array(4);      // 奥行きの FIFO（SZ0〜SZ3）
    this.rgb = [0, 0, 0];             // 色の FIFO
    this.res1 = 0; this.mac = new Int32Array(4); this.lzcs = 0; this.lzcr = 32;
    this.rt = new Int32Array(9); this.tr = new Int32Array(3);   // 回す行列・ずらす量
    this.llm = new Int32Array(9); this.bk = new Int32Array(3);  // 光の向きの行列・まわりの光
    this.lcm = new Int32Array(9); this.fc = new Int32Array(3);  // 光の色の行列・遠くの色
    this.ofx = 0; this.ofy = 0; this.h = 0; this.dqa = 0; this.dqb = 0; this.zsf3 = 0; this.zsf4 = 0;
    this.flag = 0;
  }

  // ---- レジスタ ----
  getData(r) {
    switch (r) {
      case 0: case 2: case 4: { const v = this.v[r >> 1]; return pack(v[0], v[1]); }
      case 1: case 3: case 5: return this.v[r >> 1][2];
      case 6: return this.rgbc;
      case 7: return this.otz;
      case 8: case 9: case 10: case 11: return this.ir[r - 8];
      case 12: case 13: case 14: return this.sxy[r - 12];
      case 15: return this.sxy[2];
      case 16: case 17: case 18: case 19: return this.sz[r - 16];
      case 20: case 21: case 22: return this.rgb[r - 20];
      case 23: return this.res1;
      case 24: case 25: case 26: case 27: return this.mac[r - 24];
      case 28: case 29: {
        const c = (i) => Math.max(0, Math.min(31, this.ir[i] >> 7));
        return c(1) | (c(2) << 5) | (c(3) << 10);
      }
      case 30: return this.lzcs;
      case 31: return this.lzcr;
    }
    return 0;
  }
  setData(r, v) {
    v |= 0;
    switch (r) {
      case 0: case 2: case 4: { const a = this.v[r >> 1]; a[0] = lo16(v); a[1] = hi16(v); break; }
      case 1: case 3: case 5: this.v[r >> 1][2] = lo16(v); break;
      case 6: this.rgbc = v; break;
      case 7: this.otz = v & 0xffff; break;
      case 8: case 9: case 10: case 11: this.ir[r - 8] = lo16(v); break;
      case 12: case 13: case 14: this.sxy[r - 12] = v; break;
      case 15: this.sxy[0] = this.sxy[1]; this.sxy[1] = this.sxy[2]; this.sxy[2] = v; break;
      case 16: case 17: case 18: case 19: this.sz[r - 16] = v & 0xffff; break;
      case 20: case 21: case 22: this.rgb[r - 20] = v; break;
      case 23: this.res1 = v; break;
      case 24: case 25: case 26: case 27: this.mac[r - 24] = v; break;
      case 28: this.ir[1] = (v & 31) << 7; this.ir[2] = ((v >> 5) & 31) << 7; this.ir[3] = ((v >> 10) & 31) << 7; break;
      case 30: this.lzcs = v; this.lzcr = Math.clz32(v < 0 ? ~v : v) || 32; break;
    }
  }
  getCtrl(r) {
    const mat = (m, k) => k === 4 ? m[8] : pack(m[k * 2], m[k * 2 + 1]);
    if (r < 5) return mat(this.rt, r);
    if (r < 8) return this.tr[r - 5];
    if (r < 13) return mat(this.llm, r - 8);
    if (r < 16) return this.bk[r - 13];
    if (r < 21) return mat(this.lcm, r - 16);
    if (r < 24) return this.fc[r - 21];
    switch (r) {
      case 24: return this.ofx; case 25: return this.ofy;
      case 26: return s16(this.h);  // 読むと符号つきに見える（本物の癖）
      case 27: return this.dqa; case 28: return this.dqb; case 29: return this.zsf3; case 30: return this.zsf4;
      case 31: return this.flag;
    }
    return 0;
  }
  setCtrl(r, v) {
    v |= 0;
    const mat = (m, k) => { if (k === 4) m[8] = lo16(v); else { m[k * 2] = lo16(v); m[k * 2 + 1] = hi16(v); } };
    if (r < 5) return mat(this.rt, r);
    if (r < 8) { this.tr[r - 5] = v; return; }
    if (r < 13) return mat(this.llm, r - 8);
    if (r < 16) { this.bk[r - 13] = v; return; }
    if (r < 21) return mat(this.lcm, r - 16);
    if (r < 24) { this.fc[r - 21] = v; return; }
    switch (r) {
      case 24: this.ofx = v; break; case 25: this.ofy = v; break;
      case 26: this.h = v & 0xffff; break;
      case 27: this.dqa = lo16(v); break; case 28: this.dqb = v; break;
      case 29: this.zsf3 = lo16(v); break; case 30: this.zsf4 = lo16(v); break;
      case 31: this.flag = (v & 0x7ffff000) | ((v & 0x7f87e000) ? 0x80000000 : 0); break;
    }
  }

  // ---- 切りつめと印 ----
  // MAC1〜3 のとちゅうの和（44 ビット）。あふれたら印を立てて 44 ビットで回す
  a44(i, x) {
    if (x >= P43) this.flag |= 1 << (31 - i);
    else if (x < -P43) this.flag |= 1 << (28 - i);
    else return x;
    x = ((x + P43) % P44 + P44) % P44 - P43;
    return x;
  }
  setMac(i, x, sh) { this.mac[i] = Math.floor(x / (sh ? 4096 : 1)) | 0; return this.mac[i]; }
  m0(x) { // MAC0（32 ビット）
    if (x > 0x7fffffff) this.flag |= 1 << 16; else if (x < -0x80000000) this.flag |= 1 << 15;
    this.mac[0] = x | 0; return x;
  }
  satIr(i, x, lm) {
    const lo = lm ? 0 : -0x8000;
    if (x < lo) { this.flag |= 1 << (25 - i); x = lo; } else if (x > 0x7fff) { this.flag |= 1 << (25 - i); x = 0x7fff; }
    this.ir[i] = x;
  }
  macToIr(lm) { for (let i = 1; i <= 3; i++) this.satIr(i, this.mac[i], lm); }
  pushColor() {
    const c = (i) => { let x = this.mac[i] >> 4; if (x < 0) { x = 0; this.flag |= 1 << (22 - i); } else if (x > 255) { x = 255; this.flag |= 1 << (22 - i); } return x; };
    this.rgb[0] = this.rgb[1]; this.rgb[1] = this.rgb[2];
    this.rgb[2] = c(1) | (c(2) << 8) | (c(3) << 16) | (this.rgbc & 0xff000000);
  }
  pushZ(x) {
    if (x < 0) { x = 0; this.flag |= 1 << 18; } else if (x > 0xffff) { x = 0xffff; this.flag |= 1 << 18; }
    this.sz[0] = this.sz[1]; this.sz[1] = this.sz[2]; this.sz[2] = this.sz[3]; this.sz[3] = x;
  }

  // 行列 × ベクトル ＋ 足す物（足す物は 4096 倍してから）。結果は MAC1〜3（とちゅうの和を返す）
  mulMat(m, vec, add, sh) {
    const raw = [0, 0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let x = this.a44(i + 1, (add ? add[i] : 0) * 4096 + m[i * 3] * vec[0]);
      x = this.a44(i + 1, x + m[i * 3 + 1] * vec[1]);
      x = this.a44(i + 1, x + m[i * 3 + 2] * vec[2]);
      raw[i + 1] = x;
      this.setMac(i + 1, x, sh);
    }
    return raw;
  }

  // ---- 命令 ----
  command(op) {
    const sh = (op >> 19) & 1, lm = (op >> 10) & 1;
    this.flag = 0;
    switch (op & 0x3f) {
      case 0x01: this.rtp(this.v[0], sh, lm, true); break;                               // RTPS
      case 0x30: this.rtp(this.v[0], sh, lm, false); this.rtp(this.v[1], sh, lm, false); this.rtp(this.v[2], sh, lm, true); break; // RTPT
      case 0x06: { // NCLIP: 画面の3点の回る向き（裏向きの面を見分ける）
        const p = this.sxy.map((v) => [lo16(v), hi16(v)]);
        this.m0(p[0][0] * p[1][1] + p[1][0] * p[2][1] + p[2][0] * p[0][1] - p[0][0] * p[2][1] - p[1][0] * p[0][1] - p[2][0] * p[1][1]);
        break;
      }
      case 0x2d: { const x = this.m0(this.zsf3 * (this.sz[1] + this.sz[2] + this.sz[3])); this.otz = this.satOtz(x); break; } // AVSZ3
      case 0x2e: { const x = this.m0(this.zsf4 * (this.sz[0] + this.sz[1] + this.sz[2] + this.sz[3])); this.otz = this.satOtz(x); break; } // AVSZ4
      case 0x12: this.mvmva(op, sh, lm); break;
      case 0x0c: { // OP: 外積
        const d = [this.rt[0], this.rt[4], this.rt[8]], ir = this.ir;
        this.setMac(1, this.a44(1, ir[3] * d[1] - ir[2] * d[2]), sh);
        this.setMac(2, this.a44(2, ir[1] * d[2] - ir[3] * d[0]), sh);
        this.setMac(3, this.a44(3, ir[2] * d[0] - ir[1] * d[1]), sh);
        this.macToIr(lm); break;
      }
      case 0x28: for (let i = 1; i <= 3; i++) this.setMac(i, this.a44(i, this.ir[i] * this.ir[i]), sh); this.macToIr(lm); break; // SQR
      case 0x3d: for (let i = 1; i <= 3; i++) this.setMac(i, this.a44(i, this.ir[0] * this.ir[i]), sh); this.macToIr(lm); this.pushColor(); break; // GPF
      case 0x3e: for (let i = 1; i <= 3; i++) this.setMac(i, this.a44(i, this.mac[i] * (sh ? 4096 : 1) + this.ir[0] * this.ir[i]), sh); this.macToIr(lm); this.pushColor(); break; // GPL
      case 0x1e: this.nc(this.v[0], sh, lm, 0); break;                                   // NCS
      case 0x20: for (let k = 0; k < 3; k++) this.nc(this.v[k], sh, lm, 0); break;       // NCT
      case 0x1b: this.nc(this.v[0], sh, lm, 1); break;                                   // NCCS
      case 0x3f: for (let k = 0; k < 3; k++) this.nc(this.v[k], sh, lm, 1); break;       // NCCT
      case 0x13: this.nc(this.v[0], sh, lm, 2); break;                                   // NCDS
      case 0x16: for (let k = 0; k < 3; k++) this.nc(this.v[k], sh, lm, 2); break;       // NCDT
      case 0x1c: this.bkLight(sh, lm); this.colorMul(sh, lm, false); break;               // CC
      case 0x14: this.bkLight(sh, lm); this.colorMul(sh, lm, true); break;                // CDP
      case 0x10: this.rgbShift16(this.rgbc); this.depthCue(sh, lm); break;                // DPCS
      case 0x2a: for (let k = 0; k < 3; k++) { this.rgbShift16(this.rgb[0]); this.depthCue(sh, lm); } break; // DPCT
      case 0x29: { // DCPL
        const c = this.rgbc;
        for (let i = 1; i <= 3; i++) this.mac[i] = ((c >> ((i - 1) * 8)) & 255) * this.ir[i] * 16;
        this.depthCue(sh, lm, true); break;
      }
      case 0x11: for (let i = 1; i <= 3; i++) this.mac[i] = this.ir[i] * 4096; this.depthCue(sh, lm, true); break; // INTPL
    }
    if (this.flag & 0x7f87e000) this.flag |= 0x80000000;
  }

  satOtz(x) { x = Math.floor(x / 4096); if (x < 0) { this.flag |= 1 << 18; return 0; } if (x > 0xffff) { this.flag |= 1 << 18; return 0xffff; } return x; }

  // 1点を回してずらし、画面に投げる。last なら奥行きの霞（IR0）も
  rtp(vec, sh, lm, last) {
    const raw = this.mulMat(this.rt, vec, this.tr, sh);
    this.satIr(1, this.mac[1], lm); this.satIr(2, this.mac[2], lm);
    // IR3: 値は lm で切るが、印は raw>>12 で見る（本物の癖）
    const z12 = Math.floor(raw[3] / 4096);
    if (z12 < -0x8000 || z12 > 0x7fff) this.flag |= 1 << 22;
    this.ir[3] = Math.max(lm ? 0 : -0x8000, Math.min(0x7fff, this.mac[3]));
    this.pushZ(z12);
    const n = this.divide();
    const sx = this.m0(n * this.ir[1] + this.ofx), sy = this.m0(n * this.ir[2] + this.ofy);
    const cl = (x, bit) => { x = Math.floor(x / 65536); if (x < -0x400) { this.flag |= 1 << bit; return -0x400; } if (x > 0x3ff) { this.flag |= 1 << bit; return 0x3ff; } return x; };
    this.sxy[0] = this.sxy[1]; this.sxy[1] = this.sxy[2]; this.sxy[2] = pack(cl(sx, 14), cl(sy, 13));
    if (last) {
      const d = this.m0(n * this.dqa + this.dqb);
      let ir0 = Math.floor(d / 4096);
      if (ir0 < 0) { ir0 = 0; this.flag |= 1 << 12; } else if (ir0 > 0x1000) { ir0 = 0x1000; this.flag |= 1 << 12; }
      this.ir[0] = ir0;
    }
  }
  // H / SZ3（本物と同じ、表を引いてニュートン法で2回）
  divide() {
    const h = this.h, z = this.sz[3];
    if (h >= z * 2) { this.flag |= 1 << 17; return 0x1ffff; }
    const s = Math.clz32(z) - 16;
    const n = h << s;
    let d = z << s;
    const u = UNR[(d - 0x7fc0) >> 7] + 0x101;
    d = (0x2000080 - d * u) >> 8;
    d = (0x0000080 + d * u) >> 8;
    return Math.min(0x1ffff, Math.floor((n * d + 0x8000) / 65536));
  }

  mvmva(op, sh, lm) {
    const ms = (op >> 17) & 3, vs = (op >> 15) & 3, ts = (op >> 13) & 3;
    const m = ms === 0 ? this.rt : ms === 1 ? this.llm : ms === 2 ? this.lcm : new Int32Array([-(this.rgbc & 255) << 4, (this.rgbc & 255) << 4, this.ir[0], this.rt[2], this.rt[2], this.rt[2], this.rt[4], this.rt[4], this.rt[4]]);
    const v = vs === 3 ? [this.ir[1], this.ir[2], this.ir[3]] : this.v[vs];
    const t = ts === 0 ? this.tr : ts === 1 ? this.bk : ts === 2 ? this.fc : null;
    this.mulMat(m, v, t, sh);
    this.macToIr(lm);
  }

  // 光: 面の向き × 光の向き → まわりの光 ＋ 光の色 → (0 そのまま / 1 頂点の色をかける / 2 さらに遠くの色へ霞ませる)
  nc(vec, sh, lm, kind) {
    this.mulMat(this.llm, vec, null, sh); this.macToIr(lm);
    this.bkLight(sh, lm);
    if (kind === 0) { this.pushColor(); return; }
    this.colorMul(sh, lm, kind === 2);
  }
  bkLight(sh, lm) { this.mulMat(this.lcm, [this.ir[1], this.ir[2], this.ir[3]], this.bk, sh); this.macToIr(lm); }
  colorMul(sh, lm, cue) {
    const c = this.rgbc;
    for (let i = 1; i <= 3; i++) this.mac[i] = ((c >> ((i - 1) * 8)) & 255) * this.ir[i] * 16;
    if (cue) { this.depthCue(sh, lm, true); return; }
    for (let i = 1; i <= 3; i++) this.setMac(i, this.a44(i, this.mac[i]), sh);
    this.macToIr(lm); this.pushColor();
  }
  rgbShift16(c) { for (let i = 1; i <= 3; i++) this.mac[i] = ((c >> ((i - 1) * 8)) & 255) * 65536; }
  // MAC を遠くの色（FC）へ IR0 の割合で近づける。色の FIFO へ
  depthCue(sh, lm, fromMac = true) {
    const m = [0, this.mac[1], this.mac[2], this.mac[3]];
    for (let i = 1; i <= 3; i++) {
      const x = this.a44(i, this.fc[i - 1] * 4096 - m[i]);
      this.satIr(i, Math.floor(x / (sh ? 4096 : 1)), 0);
    }
    for (let i = 1; i <= 3; i++) this.setMac(i, this.a44(i, this.ir[i] * this.ir[0] + m[i]), sh);
    this.macToIr(lm); this.pushColor();
  }
}
