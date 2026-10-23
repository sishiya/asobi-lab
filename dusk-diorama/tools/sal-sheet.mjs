// sal-look.mjs の切り出しを、名前ごとに1行で並べる（原寸と、点を大きくした3倍）。前とあとの見くらべ用
// 使い方: node dusk-diorama/tools/sal-sheet.mjs <出力.png> <フォルダ:名前> [<フォルダ:名前> ...] [--x=3] [--dev=pc]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2), out = args[0], rows = args.slice(1).filter(a => !a.startsWith('--'));
const X = +(args.find(a => a.startsWith('--x=')) || '--x=3').slice(4), dev = (args.find(a => a.startsWith('--dev=')) || '--dev=pc').slice(6);
const states = ['home', 'flare', 'hover', 'curl', 'rest'];
let html = `<body style="margin:0;background:#111;color:#ccc;font:13px sans-serif">`;
for (const r of rows) {
  const [dir, tag] = r.split(':');
  for (const z of ['', '-zoom']) {
    html += `<div style="display:flex;gap:4px;align-items:flex-end;padding:4px"><div style="width:90px">${tag}${z ? ' 寄せ' : ''}</div>`;
    for (const s of states) { const f = path.join(dir, `sal-${tag}-${dev}-${s}${z}.png`); if (fs.existsSync(f)) html += `<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="image-rendering:pixelated;zoom:${X}"><figcaption>${s}</figcaption></figure>`; }
    html += '</div>';
  }
}
const b = await launch(), p = await b.newPage({ viewport: { width: 400, height: 200 } });
await p.setContent(html + '</body>'); await p.screenshot({ path: out, fullPage: true }); await b.close();
console.log(out);
