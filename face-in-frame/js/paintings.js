// 絵のならび。出典とライセンスは CREDITS.md。
// face: 顔の線（face.js の faceLines と同じ形。鼻先 nx・ny と、そこから眉の下・上まぶた・下まぶた・あご・ほおまで。
//   絵のよこはばを 1 とした割合、rot は首のかたむきの度）。くり抜く穴は、設定の「くり抜く所」に合わせてここから作る（face.js の areaBox）。
//   顔が見つかる絵（モナ・リザ・真珠・トカゲ）は Face Landmarker の結果、見つからない絵（叫び・写楽・ゴッホ）は目で測った。
// title_en・artist_en・hint_en: 英語のときの題・作者・ひとこと。styleCrop: 筆のタッチのスタイルを読む広さ（顔のはばの倍、ふつう 3。tools/style-bottlenecks）。touchMax: 筆のタッチの強さの上限（ふつう 1）。fast: 筆のタッチに絵ごとの専用モデルを使う。fastCrop: 専用モデルの学習で読む広さ。
// goal: お手本の口の形（face.js の expression の jaw・smile・frown・round、0〜1）。書かなかった名前は 0 として軽く見る。
// roll: 首のかたむき（度。右に倒すと＋）、yaw: 顔の向き（画面の右向きが＋、-1〜1）。null なら見ない。
import { CALIBRATED } from './goals.js?v=19';

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
  { id: 'reiko', src: 'art/reiko.jpg', title: '麗子微笑', artist: '岸田劉生', year: 1921, hint: 'にんまり',
    title_en: 'Reiko Smiling', artist_en: 'Kishida Ryūsei', hint_en: 'Sly smile',
    styleCrop: 1.1, touchMax: 0.4, // 筆のタッチ: まわりの暗い地を読むと顔が黒ずむので、顔の肌だけ・弱く
    calibrate: false, // 読み取りが顔の線と笑みを読みちがえる（にんまりを 0 と読む）ので、顔の線は目で測り、お手本は手で決めたまま
    face: { nx: 0.659, ny: 0.477, rot: 0, brow: -0.085, lidTop: -0.0625, lidBot: -0.037, chin: 0.105, left: -0.19, right: 0.085 },
    goal: { smile: 0.4 }, roll: 0, yaw: 0 },
  { id: 'utamaro', src: 'art/utamaro.jpg', title: 'ポッピンを吹く娘', artist: '喜多川歌麿', year: 1793, hint: '口をすぼめて、ふーっ',
    title_en: 'Young Woman Blowing a Poppin', artist_en: 'Kitagawa Utamaro', hint_en: 'Blow!',
    // 版画で顔が見つからないので、顔の線は目で測った
    face: { nx: 0.37, ny: 0.591, rot: 0, brow: -0.128, lidTop: -0.091, lidBot: -0.067, chin: 0.101, left: -0.02, right: 0.161 },
    goal: { round: 0.6 }, roll: 0, yaw: -0.4 },
  { id: 'manet', src: 'art/manet.jpg', title: '笛を吹く少年', artist: 'エドゥアール・マネ', year: 1866, hint: '笛をくわえて、ぴー',
    title_en: 'The Fifer', artist_en: 'Édouard Manet', hint_en: 'Play the fife!',
    face: { nx: 0.5189, ny: 0.48, rot: 2, brow: -0.1014, lidTop: -0.0789, lidBot: -0.0576, chin: 0.0889, left: -0.1276, right: 0.0922 },
    goal: { round: 0.4 }, roll: 0, yaw: 0 },
  { id: 'yawning', src: 'art/yawning.jpg', title: 'あくびをする自画像', artist: 'ジョゼフ・デュクルー', year: 1783, hint: 'ふぁ〜あ',
    title_en: 'Self-Portrait, Yawning', artist_en: 'Joseph Ducreux', hint_en: 'Big yawn!',
    calibrate: false, // 読み取りが大あくびの口を笑みと読む（jaw 0.08・smile 0.55）ので、お手本は手で決めたまま
    face: { nx: 0.5192, ny: 0.397, rot: -11.9, brow: -0.0527, lidTop: -0.0367, lidBot: -0.0283, chin: 0.1251, left: -0.1459, right: 0.0353 },
    goal: { jaw: 0.9, round: 0.3 }, roll: 0, yaw: 0 },
  { id: 'gogh2', src: 'art/gogh2.jpg', title: '自画像（1889年）', artist: 'フィンセント・ファン・ゴッホ', year: 1889, hint: 'じっと、にらむ',
    title_en: 'Self-Portrait (1889)', artist_en: 'Vincent van Gogh', hint_en: 'Stare hard',
    face: { nx: 0.4076, ny: 0.5499, rot: -1.4, brow: -0.1314, lidTop: -0.1061, lidBot: -0.0839, chin: 0.1479, left: -0.0314, right: 0.2543 },
    goal: { frown: 0.3 }, roll: 0, yaw: -0.3 },
  { id: 'tanguy', src: 'art/tanguy.jpg', title: 'タンギー爺さん', artist: 'フィンセント・ファン・ゴッホ', year: 1887, hint: 'まじめな顔で',
    title_en: 'Portrait of Père Tanguy', artist_en: 'Vincent van Gogh', hint_en: 'Straight face',
    face: { nx: 0.5136, ny: 0.3651, rot: -1.1, brow: -0.1188, lidTop: -0.0864, lidBot: -0.0667, chin: 0.1108, left: -0.1243, right: 0.1418 },
    goal: { frown: 0.2 }, roll: 0, yaw: 0 },
  { id: 'milkmaid', src: 'art/milkmaid.jpg', title: '牛乳を注ぐ女', artist: 'ヨハネス・フェルメール', year: 1658, hint: 'そっと、うつむいて',
    title_en: 'The Milkmaid', artist_en: 'Johannes Vermeer', hint_en: 'Look down, gently',
    styleCrop: 1.1, touchMax: 0.4, // 筆のタッチ: まわりの暗い地を読むと顔が黒ずむので、顔の肌だけ・弱く
    face: { nx: 0.5753, ny: 0.3529, rot: 13.4, brow: -0.0941, lidTop: -0.0718, lidBot: -0.0598, chin: 0.0769, left: -0.0652, right: 0.1363 },
    goal: {}, roll: 0, yaw: 0 },
];

// お手本を、その絵自身の顔を同じしくみで読んだ数に合わせる（tools/calibrate.mjs が js/goals.js に書く）。
// 絵の顔を正確にはめこめば 100 点近くになるように（v010 ユーザー）。読めない絵（叫び・写楽）は上の手で決めた数のまま
for (const p of PAINTINGS) if (CALIBRATED[p.id] && p.calibrate !== false) Object.assign(p, CALIBRATED[p.id]);
