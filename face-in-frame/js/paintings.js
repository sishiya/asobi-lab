// 絵のならび。出典とライセンスは CREDITS.md。
// face: 顔の線（face.js の faceLines と同じ形。鼻先 nx・ny と、そこから眉の下・上まぶた・下まぶた・あご・ほおまで。
//   絵のよこはばを 1 とした割合、rot は首のかたむきの度）。くり抜く穴は、設定の「くり抜く所」に合わせてここから作る（face.js の areaBox）。
//   顔が見つかる絵（モナ・リザ・真珠・トカゲ）は Face Landmarker の結果、見つからない絵（叫び・写楽・ゴッホ）は目で測った。
// title_en・artist_en・hint_en: 英語のときの題・作者・ひとこと。styleCrop: 筆のタッチのスタイルを読む広さ（顔のはばの倍、ふつう 3。tools/style-bottlenecks）。touchMax: 筆のタッチの強さの上限（ふつう 1）。fast: 筆のタッチに絵ごとの専用モデルを使う。fastCrop: 専用モデルの学習で読む広さ。
// goal: お手本の口の形（face.js の expression の jaw・smile・frown・round、0〜1）。書かなかった名前は 0 として軽く見る。
// roll: 首のかたむき（度。右に倒すと＋）、yaw: 顔の向き（画面の右向きが＋、-1〜1）。null なら見ない。
import { CALIBRATED } from './goals.js?v=11';

export const PAINTINGS = [
  { id: 'scream', src: 'art/scream.jpg', title: '叫び', artist: 'エドヴァルド・ムンク', year: 1893, hint: 'さけべ！',
    title_en: 'The Scream', artist_en: 'Edvard Munch', hint_en: 'Scream!',
    face: { nx: 0.525, ny: 0.717, rot: 3, brow: -0.043, lidTop: -0.035, lidBot: -0.022, chin: 0.08, left: -0.053, right: 0.058 },
    goal: { jaw: 0.6, round: 0.55 }, roll: 0, yaw: null },
  { id: 'monalisa', src: 'art/monalisa.jpg', title: 'モナ・リザ', artist: 'レオナルド・ダ・ヴィンチ', year: 1503, hint: 'すまし顔',
    title_en: 'Mona Lisa', artist_en: 'Leonardo da Vinci', hint_en: 'Poker face',
    touchMax: 0.4, // 筆のタッチの強さの上限（なめらかな肌の絵は、模様が強く出すぎるので弱く）
    face: { nx: 0.4346, ny: 0.4329, rot: 0, brow: -0.1083, lidTop: -0.0952, lidBot: -0.0783, chin: 0.0985, left: -0.0666, right: 0.1631 },
    goal: { smile: 0.35 }, roll: 0, yaw: -0.4 },
  { id: 'pearl', src: 'art/pearl.jpg', title: '真珠の耳飾りの少女', artist: 'ヨハネス・フェルメール', year: 1665, hint: 'ふりむいて、そっと',
    title_en: 'Girl with a Pearl Earring', artist_en: 'Johannes Vermeer', hint_en: 'Glance back, softly',
    touchMax: 0.4, // 筆のタッチの強さの上限（なめらかな肌の絵は、模様が強く出すぎるので弱く）
    styleCrop: 1.1, // 筆のタッチ: まわりの暗い地を読むと顔が黒ずむので、顔の肌だけを読む（ユーザー「すごい濃くなっちゃった」）
    face: { nx: 0.346, ny: 0.5551, rot: 11, brow: -0.1417, lidTop: -0.1209, lidBot: -0.0945, chin: 0.1341, left: -0.0421, right: 0.2481 },
    goal: { jaw: 0.2 }, roll: 11, yaw: -0.6 },
  { id: 'lizard', src: 'art/lizard.jpg', title: 'トカゲに噛まれる少年', artist: 'カラヴァッジョ', year: 1594, hint: 'いたっ！',
    title_en: 'Boy Bitten by a Lizard', artist_en: 'Caravaggio', hint_en: 'Ouch!',
    touchMax: 0.4, // 筆のタッチの強さの上限（なめらかな肌の絵は、模様が強く出すぎるので弱く）
    styleCrop: 1.1, // 筆のタッチ: まわりの暗い地と髪を読むと顔が黒ずむので、顔の肌だけを読む（ユーザー「すごい濃くなっちゃった」）
    face: { nx: 0.5249, ny: 0.3897, rot: 15, brow: -0.0885, lidTop: -0.0618, lidBot: -0.0438, chin: 0.1185, left: -0.1336, right: 0.1002 },
    goal: { jaw: 0.35, round: 0.3 }, roll: 15, yaw: null },
  { id: 'sharaku', src: 'art/sharaku.jpg', title: '三代目大谷鬼次の江戸兵衛', artist: '東洲斎写楽', year: 1794, hint: '口をへの字に！',
    title_en: 'Ōtani Oniji III as Yakko Edobei', artist_en: 'Tōshūsai Sharaku', hint_en: 'Frown hard!',
    styleCrop: 1.1, // 筆のタッチ: まわりの暗い地と髪を読むと顔が黒ずむので、顔の肌と線だけを読む
    face: { nx: 0.856, ny: 0.6875, rot: 0, brow: -0.195, lidTop: -0.165, lidBot: -0.1315, chin: 0.1955, left: -0.236, right: 0.02 },
    goal: { frown: 0.6 }, roll: 0, yaw: 0.5 },
  { id: 'gogh', src: 'art/gogh.jpg', title: '麦わら帽子の自画像', artist: 'フィンセント・ファン・ゴッホ', year: 1887, hint: '口をすぼめて、むすっ',
    title_en: 'Self-Portrait with a Straw Hat', artist_en: 'Vincent van Gogh', hint_en: 'Purse your lips',
    face: { nx: 0.427, ny: 0.627, rot: 0, brow: -0.157, lidTop: -0.147, lidBot: -0.114, chin: 0.163, left: -0.13, right: 0.14 },
    goal: { frown: 0.25 }, roll: 0, yaw: -0.3 },
  { id: 'ducreux', src: 'art/ducreux.jpg', title: 'あざける自画像', artist: 'ジョゼフ・デュクルー', year: 1793, hint: 'にやり、とあざ笑う',
    title_en: 'Self-Portrait as a Mocker', artist_en: 'Joseph Ducreux', hint_en: 'Smirk!',
    face: { nx: 0.4323, ny: 0.4004, rot: -12.9, brow: -0.0623, lidTop: -0.0435, lidBot: -0.0314, chin: 0.1209, left: -0.0201, right: 0.1707 },
    goal: { smile: 0.4 }, roll: -13, yaw: null },
  { id: 'courbet', src: 'art/courbet.jpg', title: '絶望の男（自画像）', artist: 'ギュスターヴ・クールベ', year: 1845, hint: 'ぼうぜん…',
    title_en: 'The Desperate Man', artist_en: 'Gustave Courbet', hint_en: 'Dumbstruck…',
    styleCrop: 1.1, touchMax: 0.4, // 筆のタッチ: まわりの暗い地と髪を読むと顔が黒ずみ、ざらつくので、顔の肌だけ・弱く
    face: { nx: 0.4787, ny: 0.4003, rot: 0.6, brow: -0.1258, lidTop: -0.0941, lidBot: -0.0656, chin: 0.1612, left: -0.1406, right: 0.149 },
    goal: { jaw: 0.3, round: 0.3 }, roll: 0, yaw: null },
  { id: 'hals', src: 'art/hals.jpg', title: '笑う少年', artist: 'フランス・ハルス', year: 1625, hint: 'にかっと笑う',
    title_en: 'Laughing Boy', artist_en: 'Frans Hals', hint_en: 'Big grin!',
    face: { nx: 0.421, ny: 0.5129, rot: 2.3, brow: -0.1369, lidTop: -0.0983, lidBot: -0.0775, chin: 0.1972, left: -0.1278, right: 0.2558 },
    goal: { smile: 0.7, jaw: 0.3 }, roll: 0, yaw: null },
  { id: 'brouwer', src: 'art/brouwer.jpg', title: '苦い飲み物', artist: 'アドリアーン・ブラウエル', year: 1636, hint: 'にがっ！',
    title_en: 'The Bitter Potion', artist_en: 'Adriaen Brouwer', hint_en: 'Bitter!',
    calibrate: false, // 横顔は読み取りが口の開きを読めない（開いた口を 0 と読む）ので、お手本は手で決めたまま
    face: { nx: 0.736, ny: 0.477, rot: 0, brow: -0.1, lidTop: -0.079, lidBot: -0.05, chin: 0.226, left: -0.234, right: 0.01 },
    goal: { jaw: 0.8, frown: 0.3 }, roll: 0, yaw: 0.7 },
  { id: 'rembrandt', src: 'art/rembrandt.jpg', title: '口を開けた自画像', artist: 'レンブラント・ファン・レイン', year: 1630, hint: 'あっ！',
    title_en: 'Self-Portrait in a Cap, Open-Mouthed', artist_en: 'Rembrandt van Rijn', hint_en: 'Gasp!',
    face: { nx: 0.517, ny: 0.484, rot: 0, brow: -0.163, lidTop: -0.133, lidBot: -0.097, chin: 0.195, left: -0.217, right: 0.203 },
    goal: { jaw: 0.5, round: 0.4 }, roll: 0, yaw: 0 },
];

// お手本を、その絵自身の顔を同じしくみで読んだ数に合わせる（tools/calibrate.mjs が js/goals.js に書く）。
// 絵の顔を正確にはめこめば 100 点近くになるように（v010 ユーザー）。読めない絵（叫び・写楽）は上の手で決めた数のまま
for (const p of PAINTINGS) if (CALIBRATED[p.id] && p.calibrate !== false) Object.assign(p, CALIBRATED[p.id]);
