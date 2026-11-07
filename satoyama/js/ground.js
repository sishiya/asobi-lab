// 地面（純粋）: 起伏のある草地。高さの関数と、物理の高さの網（heightfield）を同じ式で作る。単位は m
export const SIZE = 24, RES = 96; // 24m 四方を 96 マスに
export function height(x, z) {
  return 0.035 * Math.sin(x * 1.3 + 0.4) * Math.cos(z * 1.1) + 0.02 * Math.sin(x * 3.1 + z * 2.3) + 0.012 * Math.sin(x * 7.3 - z * 5.9) + 0.06 * Math.sin(x * 0.35) * Math.sin(z * 0.27);
}
// Rapier の heightfield 用（行＝z、列＝x の順で、列ごとに並べる）
export function heights() {
  const n = RES + 1, h = new Float32Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h[j * n + i] = height(-SIZE / 2 + SIZE * j / RES, -SIZE / 2 + SIZE * i / RES);
  return h;
}
