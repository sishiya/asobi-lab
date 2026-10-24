// 棚にならぶカートリッジ（あそびラボのオリジナルだけ）。frames = 棚の小さな画面に出すまで進めるフレーム
export const LIBRARY = [
  {
    id: 'dino-ranch', file: 'roms/dino-ranch.nes', title: '恐竜かけっこ牧場 8bit',
    desc: '恐竜をかけ合わせて育て、100m を走らせる。大きい体は重く、長い脚は転びやすい。しっぽでつり合いをとる。',
    keys: [['↑↓←→', 'えらぶ'], ['X', '決める（A）'], ['Z', 'もどる（B）'], ['Enter', 'スタート']],
    frames: 90,
  },
  {
    id: 'frog-night', file: 'roms/frog-night.nes', title: 'カエルのよる',
    desc: '夜の池で舌をのばして虫をとる。でも、光るホタルは毒。朝が来るまでの 90 秒。',
    keys: [['←→', '動く'], ['X', '舌（A）'], ['Enter', 'スタート']],
    frames: 70,
  },
];
