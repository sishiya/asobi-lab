# 名画の顔ハメ 出典

絵はどれもパブリックドメインです（作者が亡くなって70年以上たち、所蔵館やウィキメディア・コモンズがパブリックドメイン／CC0 として出している画像）。`art/` には、よこかたての長いほうを 1100px に縮めたものを置いています。

| ファイル | 作品 | 作者・年 | 出どころ | 扱い |
|---|---|---|---|---|
| `art/scream.jpg` | 叫び | エドヴァルド・ムンク、1893 | ウィキメディア・コモンズ「Edvard Munch, 1893, The Scream, oil, tempera and pastel on cardboard, 91 x 73 cm, National Gallery of Norway.jpg」（所蔵: ノルウェー国立美術館） | パブリックドメイン |
| `art/monalisa.jpg` | モナ・リザ | レオナルド・ダ・ヴィンチ、1503〜1519ごろ | ウィキメディア・コモンズ「Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg」（所蔵: ルーヴル美術館） | パブリックドメイン |
| `art/pearl.jpg` | 真珠の耳飾りの少女 | ヨハネス・フェルメール、1665ごろ | ウィキメディア・コモンズ「1665 Girl with a Pearl Earring.jpg」（所蔵: マウリッツハイス美術館） | パブリックドメイン |
| `art/lizard.jpg` | トカゲに噛まれる少年 | カラヴァッジョ、1594〜1596ごろ | ウィキメディア・コモンズ「Boy Bitten by a Lizard-Caravaggio (Longhi).jpg」（所蔵: ロベルト・ロンギ財団、フィレンツェ） | パブリックドメイン |
| `art/sharaku.jpg` | 三代目大谷鬼次の江戸兵衛 | 東洲斎写楽、1794 | メトロポリタン美術館 Open Access（object 37358、DP130228） | CC0 |
| `art/gogh.jpg` | 麦わら帽子の自画像 | フィンセント・ファン・ゴッホ、1887 | メトロポリタン美術館 Open Access（object 436532、DT1502） | CC0 |
| `art/ducreux.jpg` | あざける自画像 | ジョゼフ・デュクルー、1793ごろ | ウィキメディア・コモンズ「Joseph Ducreux - Self-portrait of the artist as a mocker.jpg」（所蔵: ルーヴル美術館） | パブリックドメイン |
| `art/courbet.jpg` | 絶望の男（自画像） | ギュスターヴ・クールベ、1843〜1845ごろ | ウィキメディア・コモンズ「Gustave Courbet - Le Désespéré (1843).jpg」 | パブリックドメイン |
| `art/hals.jpg` | 笑う少年 | フランス・ハルス、1625ごろ | ウィキメディア・コモンズ「Frans Hals - Laughing Boy - 1032 - Mauritshuis.jpg」（所蔵: マウリッツハイス美術館） | パブリックドメイン |
| `art/brouwer.jpg` | 苦い飲み物 | アドリアーン・ブラウエル、1636ごろ | ウィキメディア・コモンズ「Adriaen Brouwer - The Bitter Potion - Google Art Project.jpg」（所蔵: シュテーデル美術館） | パブリックドメイン |
| `art/rembrandt.jpg` | 口を開けた自画像（帽子の） | レンブラント・ファン・レイン、1630 | ウィキメディア・コモンズ「Rembrandt van Rijn, Self-Portrait in a Cap, Open-Mouthed, 1630, NGA 10060.jpg」（ワシントン・ナショナル・ギャラリー） | CC0 |
| `art/reiko.jpg` | 麗子微笑 | 岸田劉生、1921 | ウィキメディア・コモンズ「Reiko Smiling by Kishida Ryusei (Tokyo National Museum).jpg」（所蔵: 東京国立博物館。画像のもとは e国宝） | パブリックドメイン |
| `art/utamaro.jpg` | 婦女人相十品 ポッピンを吹く娘 | 喜多川歌麿、1792〜93ごろ | メトロポリタン美術館 Open Access（DP135591。ウィキメディア・コモンズ経由） | CC0 |
| `art/yawning.jpg` | あくびをする自画像 | ジョゼフ・デュクルー、1783ごろ | ウィキメディア・コモンズ「Joseph Ducreux - Self-Portrait, Yawning - 71.PA.56 - J. Paul Getty Museum.jpg」（ゲティ美術館 Open Content） | パブリックドメイン |
| `art/milkmaid.jpg` | 牛乳を注ぐ女（人物のまわりを切りぬき） | ヨハネス・フェルメール、1658ごろ | ウィキメディア・コモンズ「Johannes Vermeer - Het melkmeisje - Google Art Project.jpg」（所蔵: アムステルダム国立美術館） | パブリックドメイン |

## ライブラリ
- MediaPipe Tasks Vision 0.10.14（`vendor/mediapipe/`。Face Landmarker のモデル `face_landmarker.task` もふくむ）: Apache License 2.0、Google。顔の読み取りはブラウザの中だけで動き、映像を外に送りません。
- TensorFlow.js 4.22.0（`vendor/tfjs/tf.min.js`）: Apache License 2.0、Google。筆のタッチを使うときだけ読む。
- Magenta の任意スタイル変換（Ghiasi ほか 2017「Exploring the structure of a real-time, arbitrary neural artistic stylization network」）の変換のネットワーク（`vendor/style-transfer/`）: reiinakano/arbitrary-image-stylization-tfjs が TensorFlow.js の形にしたもの（saved_model_transformer_separable_js）。Apache License 2.0。スタイルを読むほうのネットワーク（saved_model_style_js）は公開せず、開発のときに絵ごとの特徴を計算するのにだけ使った（`js/styles.js`）。
- 絵ごとの専用モデル（v009 で使い、v010 でやめた）: `tools/train_style.py` で学習（COCO val2017 の写真と torchvision の VGG16 を手元の学習にだけ使った）。
