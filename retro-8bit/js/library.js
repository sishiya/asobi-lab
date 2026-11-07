// 棚にならぶカートリッジ（あそびラボのオリジナルだけ）。frames = 棚の小さな画面に出すまで進めるフレーム
// color = カセットのはじめの色（shelf.js の CART_COLORS から。本体の色とかぶらないもの）。keys = [コントローラーのボタン（PAD・A・B・START・SELECT）, そのソフトで何をするか]。押せるキーは main.js の BUTTON_KEYS
// 名前・説明・キーの案内は TX(日本語, 英語)。ソフトの中の字も、ページのことばで かな／英語 になる（i18n.js の setRomLang）
// ならびは カエル・ダンゴムシ・トビウオ（2026-10-25 ユーザー。2026-11-07 にミツバチを足し、同じ日に「おもしろくない・ルールが簡単にわかるものを」でトビウオに入れかえた。ミツバチの ROM と src/bee-dance/ は残す）。恐竜かけっこ牧場 8bit は 2026-11-07 に棚から外した（ユーザー。ROM と src/dino-ranch/ は残す）
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
    id: 'flying-fish', file: 'roms/flying-fish.nes', title: TX('とべ! トビウオ', 'Flying Fish'), color: '#3f8a8c',
    desc: TX('A をおすと上へ泳いで海から飛び出し、胸びれを広げて飛ぶ。はなすと しずむ。海の中はマグロ、空はグンカンドリ。どこまで にげられる?',
      'Hold A to swim up, leap out and glide on your fins. Let go to dive. Tuna hunt below, frigatebirds above. How far can you get?'),
    keys: [['A', TX('おす: のぼる・飛ぶ ／ はなす: しずむ', 'hold: rise / glide · let go: dive')], ['START', TX('はじめる・止める', 'start / pause')]],
    frames: 150,
  },
];
