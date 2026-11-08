# ノウサギの跳び方を、関節を本物の向きだけにした体で学習し直す（2026-11-08 夜）
# 手本の出発点（SEED）からでは本物の向きの体は1段目で転び続けて育たなかった（learn-log22〜24）→ いまの turn2 から始める（turn2 は本物の向きの体でもまっすぐなら 2.2m 転ばない）
# 1段目: まっすぐ・手本に合わせる → 2段目: 向きの指示で曲がる
set -e
ANAT=1 FROM=turn2 OUT=anat SD=0.08 node learn.mjs 40 1 straight 8 4 2 0.25 > logs/learn-log25-anat-a.txt
ANAT=1 OUT=anat SD=0.06 node learn.mjs 50 1 steer 8 4 2 0.6 > logs/learn-log26-anat-b.txt
echo done
