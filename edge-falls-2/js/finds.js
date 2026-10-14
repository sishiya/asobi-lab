'use strict';
// 見つけたこと（観察の記録）の一覧。[id, 題, 文, 見つけたかを調べる関数(s)]。調べるのは book.js の stepFinds（0.5 秒ごと・一度に一つ）
// ---- 見つけたこと（観察の記録） ----
const FINDS = [
  ['fall', TX('果ての滝', 'The Edge Falls'), TX('水が、世界の果てから落ちていった。', 'Water fell from the edge of the world.'), s => s.out > 0.3],
  ['mist', TX('霧の雲', 'Mist clouds'), TX('滝のしぶきが、のぼって雲になった。', 'Spray from the falls rose and became clouds.'), () => W.flags.mist],
  ['mrain', TX('山の雨', 'Mountain rain'), TX('山にぶつかった雲が、雨をふらせた。', 'Clouds hit a mountain and it rained.'), () => W.flags.mrain],
  ['abyss', TX('深淵の底', 'The bottom of the Abyss'), TX('深淵の水が、底をつきかけた。泉が細くなる。', 'The Abyss almost ran out of water. The springs grow weak.'), () => W.abyss < 60 && W.springs.length > 0],
  ['green', TX('緑の原', 'Green plain'), TX('草が、大地の一割をおおった。', 'Grass covered a tenth of the land.'), s => s.grass > 0.1],
  ['tree', TX('はじめての木', 'The first tree'), TX('草の茂った乾いた所に、木が育った。', 'A tree grew in a dry, grassy place.'), () => G.maxTree > 0.7],
  ['born', TX('はじめての子', 'The first young'), TX('大地で、はじめて子が生まれた。', 'The first young was born on the land.'), () => L.born > 0],
  ['snow', TX('初雪', 'First snow'), TX('寒い山に、雪がつもった。', 'Snow piled up on a cold mountain.'), () => G.snowy],
  ['ice', TX('氷', 'Ice'), TX('水が凍った。凍った水は流れない。', 'Water froze. Frozen water doesn’t flow.'), () => G.icy],
  ['swim', TX('泳ぐシカ', 'Swimming deer'), TX('シカが、深い水を泳ぎわたった。', 'A deer swam across deep water.'), () => W.flags.swim],
  ['giveup', TX('逃げきった', 'Got away'), TX('オオカミが、シカを追いきれなかった。', 'A wolf couldn’t catch the deer it chased.'), () => W.flags.giveup],
  ['fallen', TX('果てへ', 'Over the edge'), TX('流された生き物が、滝から落ちていった。', 'An animal was carried away and fell off the falls.'), () => L.fell > 0],
  ['catch', TX('サギの漁', 'The heron’s catch'), TX('サギが、浅瀬でサカナをとった。', 'A heron caught a fish in the shallows.'), () => L.why['fish:caught'] > 0],
  ['return', TX('帰ってきた命', 'Lives come back'), TX('去った命が、深淵からつぼへ戻ってきた。', 'Lives that passed away came back from the Abyss to the jar.'), () => W.flags.ret],
  ['follow', TX('光を追って', 'Following the light'), TX('命の光の粒を押して、そのゆくえを追った。', 'You pressed a speck of the light of life and followed where it went.'), () => W.flags.follow],
  ['isolated', TX('隔てられた群れ', 'A group cut off'), TX('同じ種の群れが、水や陸で二つに隔てられた。まじわらないまま時がたつと……', 'A group of one species was cut in two by water or land. If time passes without them mixing...'), () => W.flags.isolated],
  ['species', TX('新しい種', 'A new species'), TX('隔てられた群れが、別の種に分かれた。もう、もとの種とは子を残さない。', 'The group that was cut off split into a separate species. It no longer has young with the original species.'), () => W.flags.species],
  ['bloom', TX('土にかえる', 'Back to the soil'), TX('生き物が去った所の土が肥えて、花が咲いた。', 'Where an animal passed away, the soil grew rich and flowers bloomed.'), () => W.flags.bloom && INS.some(i => W.fert[i] > 0.95 && W.veg[i] > 0.5)],
  ['mistlife', TX('霧にのる命', 'Lives on the mist'), TX('深淵の命の光が、滝のしぶきの霧にのって、雲へのぼった。', 'A light of life from the Abyss rose with the mist of the falls into a cloud.'), () => W.flags.mistlife],
  ['rainlife', TX('雨とおりる命', 'Lives come down with the rain'), TX('雲にのった命の光が、雨といっしょに大地へおりて、命のつぼへ帰った。', 'A light of life riding a cloud came down with the rain and went home to the Life Jar.'), () => W.flags.rainlife],
  ['gen10', TX('十代目', 'Tenth generation'), TX('第 10 世代の子が生まれた。', 'A young of the 10th generation was born.'), () => W.flags.gen10],
  // 太陽と月の遊び（v020）
  ['bigtide', TX('大潮', 'Spring tide'), TX('月と太陽が同じ向きにそろうと、潮がいちばん大きく寄った。', 'When the Moon and Sun lined up on the same side, the tide pulled the hardest.'), s => (W.knob ? W.knob.tide : 1) >= 0.5 && s.wet > 0.03 && Math.abs(sunMoonGap()) < 0.2],
  ['eclipse', TX('日食', 'Eclipse'), TX('月が太陽に重なって、昼の大地が暗くなった。', 'The Moon covered the Sun, and the land grew dark in the daytime.'), () => eclipseK() > 0.6],
  ['stillsun', TX('止まった昼', 'The Sun stands still'), TX('太陽を止めたまま一日がすぎた。昼の所はずっと昼、夜の所はずっと夜。', 'A whole day passed with the Sun stopped. Day stayed day, and night stayed night.'), () => G.sunStill > DAY],
  // 空と命の暦（v2）
  ['nighthunt', TX('夜の狩り', 'Night hunt'), TX('オオカミは、太陽から遠い夜の所で狩りをする。昼は休んでいる。', 'Wolves hunt where it is night, far from the Sun. By day they rest.'), () => W.flags.nighthunt],
  ['tidecatch', TX('引き潮の漁', 'Low-tide fishing'), TX('大潮で浅瀬が広がると、サギはサカナをたくさんとった。', 'When the spring tide widened the shallows, the herons caught plenty of fish.'), () => W.flags.tidecatch],
  ['moonspawn', TX('満月の産卵', 'Full-moon spawning'), TX('満月のころ、サカナがいっせいに卵を産んだ。', 'Around the full moon, the fish all laid their eggs.'), () => W.flags.moonspawn],
  ['hush', TX('静まった昼', 'The quiet noon'), TX('日食で暗くなると、シカもオオカミも立ちどまった。', 'When the eclipse darkened the land, deer and wolves stood still.'), () => W.flags.hush],
  ['scorch', TX('焼けた大地', 'Scorched land'), TX('止めた太陽の真下が、暑さで乾いてひび割れた。', 'Under the stopped Sun, the land dried out and cracked in the heat.'), () => W.sun.stop && W.Tavg !== undefined && INS.some(i => W.T[i] > 34)],
  // ヒトの知恵（v2。humans.js）
  ...WISDOM.map(([k, name, text]) => ['w_' + k, TX('知恵　', 'Wisdom: ') + name, text, () => knows(k)]),
  ['village', TX('ヒトの村', 'A human village'), TX('ヒトが、村をつくって暮らしはじめた。', 'The humans built a village and began to live there.'), () => W.flags.village],
  // 体が変わる（v2。遺伝子の平均が はじめ 0.5 から動いた）
  ['longlegs', TX('長い足', 'Long legs'), TX('シカの足が長くなってきた。遅いシカほど、オオカミにつかまったから。', 'The deer’s legs are getting longer, because the slower deer were caught by wolves.'), () => geneStats('deer').speed > 0.6 && L.counts.deer >= 8],
  ['bigbody', TX('大きな体', 'Big bodies'), TX('シカの体が大きくなってきた。大きな体は寒さに強い。', 'The deer are getting bigger. Big bodies hold up better in the cold.'), () => geneStats('deer').size > 0.6 && L.counts.deer >= 8],
  ['bigfish', TX('大きなサカナ', 'Big fish'), TX('サカナの体が大きくなってきた。小さなサカナほど、サギにのみこまれたから。', 'The fish are getting bigger, because the smaller ones were swallowed by herons.'), () => geneStats('fish').size > 0.6 && L.counts.fish >= 8],
  ['longbeak', TX('長いくちばし', 'Long beaks'), TX('サギのくちばしが長くなってきた。深い所のサカナにも届く。', 'The herons’ beaks are getting longer, so they reach fish in deeper water.'), () => geneStats('bird').beak > 0.6 && L.counts.bird >= 4],
  ['frostside', TX('明けない夜', 'Endless night'), TX('太陽を止めると、反対がわは夜のまま凍りついた。', 'With the Sun stopped, the far side stayed in night and froze.'), () => W.sun.stop && G.sunStill > DAY * 0.5 && G.icy],
];
