// 絵のならび。出典とライセンスは CREDITS.md。
// hole: くり抜く穴（だ円）。x・y・rx・ry は絵のよこはばを 1 とした割合、rot は度（右回りが＋）。
//   顔が見つかる絵は tools/analyze.html の結果から、見つからない絵（叫び・写楽・ゴッホ）は目で測った。
// goal: お手本の表情（face.js の expression と同じ名前、0〜1）。部位の中で書かなかった名前は 0 として軽く見る。
// roll: 首のかたむき（度。右に倒すと＋）、yaw: 顔の向き（画面の右向きが＋、-1〜1）。null なら見ない。
export const PAINTINGS = [
  { id: 'scream', src: 'art/scream.jpg', title: '叫び', artist: 'エドヴァルド・ムンク', year: 1893, hint: 'さけべ！',
    hole: { x: 0.525, y: 0.70, rx: 0.056, ry: 0.092, rot: 0 },
    goal: { jaw: 0.6, round: 0.55, eyeWide: 0.5, browUp: 0.5 }, roll: 0, yaw: null },
  { id: 'monalisa', src: 'art/monalisa.jpg', title: 'モナ・リザ', artist: 'レオナルド・ダ・ヴィンチ', year: 1503, hint: 'ほんのり、ほほえむ',
    hole: { x: 0.478, y: 0.396, rx: 0.113, ry: 0.135, rot: 0 },
    goal: { smile: 0.35, eyeNarrow: 0.3, browDown: 0.1 }, roll: 0, yaw: -0.4 },
  { id: 'pearl', src: 'art/pearl.jpg', title: '真珠の耳飾りの少女', artist: 'ヨハネス・フェルメール', year: 1665, hint: 'ふりむいて、はっ',
    hole: { x: 0.464, y: 0.531, rx: 0.135, ry: 0.174, rot: 11 },
    goal: { jaw: 0.2, eyeWide: 0.3, browUp: 0.25 }, roll: 11, yaw: -0.6 },
  { id: 'lizard', src: 'art/lizard.jpg', title: 'トカゲに噛まれる少年', artist: 'カラヴァッジョ', year: 1594, hint: 'いたっ！',
    hole: { x: 0.519, y: 0.376, rx: 0.117, ry: 0.13, rot: 15 },
    goal: { jaw: 0.35, round: 0.3, browUp: 0.6, eyeNarrow: 0.5 }, roll: 15, yaw: null },
  { id: 'sharaku', src: 'art/sharaku.jpg', title: '三代目大谷鬼次の江戸兵衛', artist: '東洲斎写楽', year: 1794, hint: 'にらみつける',
    hole: { x: 0.683, y: 0.645, rx: 0.17, ry: 0.245, rot: 0 },
    goal: { frown: 0.6, browDown: 0.6, eyeWide: 0.3 }, roll: 0, yaw: 0.5 },
  { id: 'gogh', src: 'art/gogh.jpg', title: '麦わら帽子の自画像', artist: 'フィンセント・ファン・ゴッホ', year: 1887, hint: 'むすっ',
    hole: { x: 0.45, y: 0.59, rx: 0.14, ry: 0.19, rot: 0 },
    goal: { frown: 0.25, browDown: 0.35 }, roll: 0, yaw: -0.3 },
];
