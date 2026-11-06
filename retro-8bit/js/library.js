// 棚にならぶカートリッジ（あそびラボのオリジナルだけ）。frames = 棚の小さな画面に出すまで進めるフレーム
// color = カセットのはじめの色（shelf.js の CART_COLORS から。本体の色とかぶらないもの）。keys = [コントローラーのボタン（PAD・A・B・START・SELECT）, そのソフトで何をするか]。押せるキーは main.js の BUTTON_KEYS
// 名前・説明・キーの案内は TX(日本語, 英語)。ソフトの中の字も、ページのことばで かな／英語 になる（i18n.js の setRomLang）
// ならびは カエル・ダンゴムシ・ミツバチ（2026-10-25 ユーザー。ミツバチは 2026-11-07 に足した）。恐竜かけっこ牧場 8bit は 2026-11-07 に棚から外した（ユーザー。ROM と src/dino-ranch/ は残す）
import { TX } from './i18n.js';

export const LIBRARY = [
  {
    id: 'frog-night', file: 'roms/frog-night.nes', title: TX('カエルのよる', 'Frog Night'), color: '#3f4f86',
    desc: TX('夜の池で舌をのばして虫をとる。でも、光るホタルは毒。朝が来るまでの 90 秒。', 'Catch bugs over a night pond with your tongue. But glowing fireflies are poison. 90 seconds until morning.'),
    keys: [['PAD', TX('←→ 動く', '←→ move')], ['A', TX('舌', 'tongue')], ['START', TX('はじめる・止める', 'start / pause')]],
    frames: 70,
  },
  {
    id: 'pillbug-path', file: 'roms/pillbug-path.nes', title: TX('ダンゴムシのみち', 'Pillbug Path'), color: '#6f7a3a',
    desc: TX('ダンゴムシは前がふさがると曲がる。左に曲がったら、つぎは右。石を置いて、葉っぱまで歩かせるパズル。ひなたに出ると丸くなる。',
      'A pillbug turns only when blocked: left, then right, then left. Place stones to walk it to the leaves. In the sun it curls up.'),
    keys: [['PAD', TX('カーソル', 'cursor')], ['A', TX('石を置く・とる', 'place / take stone')], ['START', TX('歩かせる', 'walk')], ['B', TX('止める', 'stop')], ['SELECT', TX('石をもどす', 'clear stones')]],
    frames: 70,
  },
  {
    id: 'bee-dance', file: 'roms/bee-dance.nes', title: TX('ミツバチの おどり', 'Bee Dance'), color: '#d4a03a',
    desc: TX('仲間のおしりふりダンスを読んで、花へ飛ぶ。まっすぐ進む向きが太陽から見た花の向き、ふる回数が遠さ。太陽は少しずつ動く。',
      "Read your sister's waggle dance and fly to the flowers. Her straight run's angle from straight up is the flowers' angle from the sun; the waggles tell how far. The sun keeps moving."),
    keys: [['PAD', TX('←→ むき・↑↓ とおさ', '←→ aim / ↑↓ distance')], ['A', TX('そとへ・とぶ', 'go out / fly')], ['START', TX('はじめる', 'start')]],
    frames: 120,
  },
];
