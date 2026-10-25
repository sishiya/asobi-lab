// main.s のうしろにつなぐ表: sin の表・キューブの頂点（8）・面（6: 頂点の番号 4 つ・面の向き・色）・並べ表と荷物の場所
const S = 110;
export function gen() {
  const sin = Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * Math.PI * 2) * 4096));
  const vtx = Array.from({ length: 8 }, (_, i) => [i & 1 ? S : -S, i & 2 ? S : -S, i & 4 ? S : -S]);
  const idx = (p) => vtx.findIndex((v) => v.every((c, k) => c === p[k]));
  // 面: 外から見て 左上・右上・左下・右下 の順（GPU の四角の順）。u × v = -n になるように u（右）と v（下）を選ぶ
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const colors = [0xe0603c, 0x50b0e0, 0xe0c050, 0x70d080, 0xb070e0, 0xe08aa0]; // 0xRRGGBB
  const faces = [];
  let k = 0;
  for (const ax of axes) for (const sg of [-1, 1]) {
    const n = ax.map((c) => c * sg);
    const others = axes.filter((a) => a !== ax);
    let u = others[0], v = others[1];
    const c = cross(u, v);
    if (c[0] !== -n[0] || c[1] !== -n[1] || c[2] !== -n[2]) [u, v] = [v, u];
    const corner = (su, sv) => idx(n.map((nc, i) => nc * S + su * u[i] * S + sv * v[i] * S));
    const col = colors[k++];
    const bgr = ((col & 255) << 16) | (col & 0xff00) | (col >> 16);
    faces.push({ p: [corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)], n: n.map((c) => c * 4096), rgbc: (0x28 << 24) | bgr });
  }
  const half = (a) => a.map((x) => x & 0xffff).join(', ');
  return [
    '.align 4', 'sintab:',
    ...Array.from({ length: 32 }, (_, i) => '  .word ' + sin.slice(i * 8, i * 8 + 8).join(', ')),
    'verts:', ...vtx.map((v) => `  .half ${half([...v, 0])}`),
    'faces:', ...faces.map((f) => `  .byte ${f.p.join(', ')}\n  .half ${half([...f.n, 0])}\n  .word 0x${(f.rgbc >>> 0).toString(16)}`),
    'ot: .space ' + 256 * 4,
    'pkts: .space ' + 6 * 24,
  ].join('\n') + '\n';
}
