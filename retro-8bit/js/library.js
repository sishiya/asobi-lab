// 棚にならぶカートリッジ（あそびラボのオリジナルだけ）。frames = 棚の小さな画面に出すまで進めるフレーム
// color = カセットのはじめの色（shelf.js の CART_COLORS から。本体の色とかぶらないもの）。keys = [コントローラーのボタン（PAD・A・B・START・SELECT）, そのソフトで何をするか]。押せるキーは main.js の BUTTON_KEYS
export const LIBRARY = [
  {
    id: 'dino-ranch', file: 'roms/dino-ranch.nes', title: '恐竜かけっこ牧場 8bit', color: '#d4a03a',
    desc: '恐竜をかけ合わせて育て、100m を走らせる。大きい体は重く、長い脚は転びやすい。しっぽでつり合いをとる。',
    keys: [['PAD', 'えらぶ'], ['A', '決める'], ['B', 'もどる'], ['START', 'はじめる']],
    frames: 90,
  },
  {
    id: 'frog-night', file: 'roms/frog-night.nes', title: 'カエルのよる', color: '#3f4f86',
    desc: '夜の池で舌をのばして虫をとる。でも、光るホタルは毒。朝が来るまでの 90 秒。',
    keys: [['PAD', '←→ 動く'], ['A', '舌'], ['START', 'はじめる・止める']],
    frames: 70,
  },
  {
    id: 'pillbug-path', file: 'roms/pillbug-path.nes', title: 'ダンゴムシのみち', color: '#6f7a3a',
    desc: 'ダンゴムシは前がふさがると曲がる。左に曲がったら、つぎは右。石を置いて、葉っぱまで歩かせるパズル。ひなたに出ると丸くなる。',
    keys: [['PAD', 'カーソル'], ['A', '石を置く・とる'], ['START', '歩かせる'], ['B', '止める'], ['SELECT', '石をもどす']],
    frames: 70,
  },
];
