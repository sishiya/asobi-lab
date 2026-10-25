// 棚にならぶカートリッジ（あそびラボのオリジナルだけ）。frames = 棚の小さな画面に出すまで進めるフレーム
// color = カセットのはじめの色（shelf.js の CART_COLORS から。本体の色とかぶらないもの）。keys = [コントローラーのボタン（PAD・A・B・START・SELECT）, そのソフトで何をするか]。押せるキーは main.js の BUTTON_KEYS
// 名前・説明・キーの案内は TX(日本語, 英語)。ソフトの中の字も、ページのことばで かな／英語 になる（i18n.js の setRomLang）
// ならびは カエル・ダンゴムシ・恐竜（2026-10-25 ユーザー）
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
    id: 'dino-ranch', file: 'roms/dino-ranch.nes', title: TX('恐竜かけっこ牧場 8bit', 'Dino Sprint Ranch 8bit'), color: '#d4a03a',
    desc: TX('恐竜をかけ合わせて育て、100m を走らせる。大きい体は重く、長い脚は転びやすい。しっぽでつり合いをとる。',
      'Breed dinosaurs and race them 100m. Big bodies are heavy, long legs trip easily, and the tail keeps balance.'),
    keys: [['PAD', TX('えらぶ', 'choose')], ['A', TX('決める', 'OK')], ['B', TX('もどる', 'back')], ['START', TX('はじめる', 'start')]],
    frames: 90,
  },
];
