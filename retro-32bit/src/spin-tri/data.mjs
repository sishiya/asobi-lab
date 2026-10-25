// main.s のうしろにつなぐ表（ビルドのときに作る）: sin の表 256 こ（4096 で 1）
export function gen() {
  const v = Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * Math.PI * 2) * 4096));
  const rows = [];
  for (let i = 0; i < 256; i += 8) rows.push('  .word ' + v.slice(i, i + 8).join(', '));
  return '.align 4\nsintab:\n' + rows.join('\n') + '\n';
}
