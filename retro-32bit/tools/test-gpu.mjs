// GPU の確かめ: VRAM への転送・4 ビットのテクスチャ（CLUT）・色をかける・透明・四角（スプライト）・半透明・グーロー。
//   node retro-32bit/tools/test-gpu.mjs
import { GPU } from '../js/gpu.js';
import '../js/raster.js';

let bad = 0;
function check(name, ok, info = '') { if (!ok) bad++; console.log(`${ok ? 'ok ' : 'NG '} ${name}${info ? ': ' + info : ''}`); }
const c15 = (r, g, b) => (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
const px = (g, x, y) => g.vram[y * 1024 + x];
const rgb = (v) => [(v & 31) << 3, ((v >> 5) & 31) << 3, ((v >> 10) & 31) << 3];

const g = new GPU();
g.gp0(0xe3000000); g.gp0(0xe4000000 | (511 << 10) | 1023); g.gp0(0xe5000000);   // 描ける範囲＝ぜんぶ、ずらしなし
// CLUT（16 色）を (320, 240) へ: 0 は透明、1 赤、2 緑、3 青（色をかけて確かめるため 0x8000 なし）
const clut = [0, c15(248, 0, 0), c15(0, 248, 0), c15(0, 0, 248), ...Array(12).fill(c15(128, 128, 128))];
g.gp0(0xa0000000); g.gp0((240 << 16) | 320); g.gp0((1 << 16) | 16);
for (let i = 0; i < 16; i += 2) g.gp0(clut[i] | (clut[i + 1] << 16));
// 4 ビットのテクスチャ 16×16 を (640, 0)（テクスチャページ 10）へ: 左上 8×8 が 1、右上 2、左下 3、右下 0（透明）
g.gp0(0xa0000000); g.gp0((0 << 16) | 640); g.gp0((16 << 16) | 4);
for (let y = 0; y < 16; y++) for (let hw = 0; hw < 4; hw += 2) {
  const word = (h) => { let v = 0; for (let k = 0; k < 4; k++) { const x = h * 4 + k; v |= (y < 8 ? (x < 8 ? 1 : 2) : (x < 8 ? 3 : 0)) << (k * 4); } return v; };
  g.gp0(word(hw) | (word(hw + 1) << 16));
}
check('CPU → VRAM の転送', px(g, 640, 0) === 0x1111 && px(g, 642, 0) === 0x2222 && px(g, 640, 8) === 0x3333, px(g, 640, 0).toString(16));
const clutWord = (240 << 6) | (320 >> 4), tpage = 10;   // ページ 10（x=640）・4 ビット
// 1) テクスチャの四角（ポリゴン 0x2D＝そのまま）を (0,0)-(32,32) に、uv 0〜15 で（2 倍にのびる）
g.gp0(0x2d808080); g.gp0(0); g.gp0((clutWord << 16) | 0x0000); g.gp0(32); g.gp0((tpage << 16) | 0x000f);
g.gp0(32 << 16); g.gp0(0x0f00); g.gp0((32 << 16) | 32); g.gp0(0x0f0f);
check('テクスチャ（左上が赤）', rgb(px(g, 4, 4)).join() === '248,0,0', rgb(px(g, 4, 4)).join());
check('テクスチャ（右上が緑）', rgb(px(g, 26, 4)).join() === '0,248,0', rgb(px(g, 26, 4)).join());
check('テクスチャ（左下が青）', rgb(px(g, 4, 26)).join() === '0,0,248', rgb(px(g, 4, 26)).join());
check('色 0 は透明（下の色のまま）', px(g, 26, 26) === 0);
// 2) 色をかける（0x2C、色 0x404040 ＝ 半分）
g.gp0(0x2c404040); g.gp0(40); g.gp0((clutWord << 16) | 0); g.gp0(72); g.gp0((tpage << 16) | 0x0f);
g.gp0(32 << 16 | 40); g.gp0(0x0f00); g.gp0((32 << 16) | 72); g.gp0(0x0f0f);
check('色をかける（半分の明るさ）', rgb(px(g, 44, 4)).join() === '120,0,0', rgb(px(g, 44, 4)).join());
// 3) テクスチャの四角（スプライト 0x7C＝16×16、色をかけない 0x7D）
g.gp0(0xe1000000 | tpage);   // スプライトは描き方（E1）のページを使う
g.gp0(0x7d808080); g.gp0((40 << 16) | 0); g.gp0((clutWord << 16) | 0x0800);
check('スプライト（16×16・左下の青から）', rgb(px(g, 2, 42)).join() === '0,0,248', rgb(px(g, 2, 42)).join());
// 4) 半透明（加算・E1 のモード 1）: 赤の上に緑を加算して黄色
g.gp0(0x600000f8); g.gp0((100 << 16) | 100); g.gp0((4 << 16) | 4);   // 赤（色は 0xBBGGRR）
g.gp0(0xe1000020);
g.gp0(0x6200f800); g.gp0((100 << 16) | 100); g.gp0((4 << 16) | 4);
const y = rgb(px(g, 101, 101));
check('加算の半透明', y[0] > 200 && y[1] > 200 && y[2] === 0, y.join());
console.log(bad ? `\n${bad} こ ちがいます` : '\nぜんぶ ok');
process.exit(bad ? 1 : 0);
