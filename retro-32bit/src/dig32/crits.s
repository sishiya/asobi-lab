; ---- 夜の生き物: 子ガメとヤシガニ（main.s のつづき。PLAN.md 6章 B-2）----
;   どちらも敵にしない。子ガメ: 夜に浜の巣から 4 匹、いちばん明るい向き（海の向き＋見えているたき火）へ歩く。海に入れたら守れた
;   ヤシガニ: 夜に浜から 2 匹。近くの人へ寄ってきて、ふれると腰袋の物を 1 つ持って海へ帰る。B でつつくと落として逃げる
;   どちらも 1 段ならのぼれる（2 段の壁で止まる）。ヤシガニはたき火から 3 ブロックの中には入らない。朝になるといなくなる（子ガメは親が連れて帰る）
;   生き物 1 匹 32 バイト: 0 種類（0 なし・1 子ガメ・2 ヤシガニ）・4 x・8 y（足もと）・12 z（×256）・16 前の向き x・20 前の向き z（×4096）
;     24 持っている物（ヤシガニ）・28 逃げるのこりのこま（ヤシガニ。負の数は、取るまえにゆれている間＝その 1 秒に B が間に合う）
;   海へ持っていかれた物は、朝に浜へ打ち上がって腰袋へもどる（washed）。はじめの夜はヤシガニ 1 匹だけ

NCRIT   = 6              ; 0〜3 子ガメ・4〜5 ヤシガニ
TSPD    = 3              ; 子ガメの速さ（1 こま。×256）
CSPD    = 5              ; ヤシガニの速さ
CRUN    = 9              ; ヤシガニが海へ帰る速さ
FIREK   = 6              ; たき火の引きの強さ（6 ブロックで海と同じ）
EV_SAVE  = 256           ; 子ガメが海に入った
EV_STEAL = 512           ; ヤシガニが持っていった
EV_POKE  = 1024          ; つついた
EV_CRAB  = 2048          ; ヤシガニの足音（近いとき）
EV_HATCH = 4096          ; 子ガメが出てきた

; はじめ: 生き物をなくし、たき火の一覧を空に
critinit:
  la t0, crits
  li t1, NCRIT
@ci:
  sw zero, 0(t0)
  addiu t1, t1, -1
  bnez t1, @ci
  addiu t0, t0, 32
  la t0, fires
  li t1, 8
  li t2, -1
@cf:
  sw t2, 0(t0)
  addiu t1, t1, -1
  bnez t1, @cf
  addiu t0, t0, 4
  sw zero, V_SPAWND(gp)
  sw zero, V_TSAVE(gp)
  la t0, washed
  sw zero, 0(t0)
  sw zero, 4(t0)
  sw zero, 8(t0)
  sw zero, 12(t0)
  sw zero, V_TALL(gp)
  sw zero, V_TSPAWN(gp)
  jr ra
  nop

; たき火の一覧: a0 = ブロックの番号を足す・消す（8 つまで）。t6〜t8 だけ使う
fireadd:
  la t6, fires
  li t7, 8
@fa:
  lw t8, 0(t6)
  nop
  bltz t8, @fput
  nop
  addiu t7, t7, -1
  bnez t7, @fa
  addiu t6, t6, 4
  jr ra
  nop
@fput:
  jr ra
  sw a0, 0(t6)
firedel:
  la t6, fires
  li t7, 8
@fd:
  lw t8, 0(t6)
  nop
  bne t8, a0, @fdn
  nop
  li t8, -1
  sw t8, 0(t6)
@fdn:
  addiu t7, t7, -1
  bnez t7, @fd
  addiu t6, t6, 4
  jr ra
  nop

; 1こまごと（世界が動いているときだけ）
critframe:
  addiu sp, sp, -16
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw zero, V_CRABN(gp)
  lw t0, V_TSHOW(gp)         ; 朝のあとも少しのあいだ、守った数を見せる
  nop
  blez t0, @ts
  nop
  addiu t0, t0, -1
  sw t0, V_TSHOW(gp)
@ts:
  lw t0, V_LVL(gp)
  li t1, 7
  bne t0, t1, @nospawn
  nop
  lw t2, V_SPAWND(gp)        ; 夜（段 7）になったら、その日に 1 回だけ出す
  lw t3, V_DAY(gp)
  nop
  beq t2, t3, @nospawn
  nop
  sw t3, V_SPAWND(gp)
  jal spawnall
  nop
@nospawn:
  lw t0, V_LVL(gp)
  nop
  bnez t0, @live
  nop
  la t0, crits               ; 朝: みんないなくなる
  li t1, NCRIT
  li t3, 0
@cl:
  lw t2, 0(t0)
  sw zero, 0(t0)
  or t3, t3, t2
  addiu t1, t1, -1
  bnez t1, @cl
  addiu t0, t0, 32
  la t0, washed              ; 海へ持っていかれた物は、朝に浜へ打ち上がって腰袋へもどる
  la t1, inv
  li t2, 16
@wa:
  lbu t4, 0(t0)
  lbu t5, 0(t1)
  sb zero, 0(t0)
  addu t5, t5, t4
  slti t6, t5, 100
  bnez t6, @wb
  nop
  li t5, 99
@wb:
  sb t5, 0(t1)
  addiu t0, t0, 1
  addiu t2, t2, -1
  bnez t2, @wa
  addiu t1, t1, 1
  beqz t3, @end
  nop
  li t0, 600                 ; だれかいたなら、守った数を 10 秒見せる
  sw t0, V_TSHOW(gp)
  b @end
  nop
@live:
  la s0, crits
  li s1, NCRIT
@each:
  lw t0, 0(s0)
  li t1, 1
  beqz t0, @next
  nop
  bne t0, t1, @crab
  nop
  jal turtle
  move a0, s0
  b @next
  nop
@crab:
  jal crab
  move a0, s0
@next:
  addiu s1, s1, -1
  bnez s1, @each
  addiu s0, s0, 32
@end:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  jr ra
  addiu sp, sp, 16

; 夜のはじまり: 巣のまわりに子ガメ 4 匹、浜の 2 か所にヤシガニ
spawnall:
  move t9, ra
  la t0, crits
  li t1, 0
@st:
  li t2, 1
  sw t2, 0(t0)
  andi t3, t1, 1             ; 巣のまわり 2 × 2 に
  sll t3, t3, 7
  addiu t3, t3, NEST_X * 256 + 64
  sw t3, 4(t0)
  srl t4, t1, 1
  sll t4, t4, 7
  addiu t4, t4, NEST_Z * 256 + 64
  sw t4, 12(t0)
  li t5, (H - 1) * 256       ; 高さはあとで地面に合わせる
  sw t5, 8(t0)
  sw zero, 16(t0)
  li t5, 4096
  sw t5, 20(t0)
  addiu t1, t1, 1
  slti t2, t1, 4
  bnez t2, @st
  addiu t0, t0, 32
  li t2, 2                   ; ヤシガニ
  sw t2, 0(t0)
  li t3, CRAB0_X * 256 + 128
  sw t3, 4(t0)
  li t3, CRAB0_Z * 256 + 128
  sw t3, 12(t0)
  li t5, (H - 1) * 256
  sw t5, 8(t0)
  sw zero, 16(t0)
  li t5, 4096
  sw t5, 20(t0)
  sw zero, 24(t0)
  sw zero, 28(t0)
  addiu t0, t0, 32
  lw t3, V_DAY(gp)           ; はじめの夜は 1 匹だけ（囲い・たき火で防げることを先に）
  li t6, 1
  beq t3, t6, @one
  nop
  sw t2, 0(t0)
@one:
  li t3, CRAB1_X * 256 + 128
  sw t3, 4(t0)
  li t3, CRAB1_Z * 256 + 128
  sw t3, 12(t0)
  sw t5, 8(t0)
  sw zero, 16(t0)
  li t5, 4096
  sw t5, 20(t0)
  sw zero, 24(t0)
  sw zero, 28(t0)
  sw zero, V_TSAVE(gp)
  li t0, 4
  sw t0, V_TSPAWN(gp)
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_HATCH
  sw t0, V_EVT(gp)
  la t0, crits               ; 高さを地面に
  li t1, NCRIT
@sg:
  lw a0, 4(t0)
  lw a1, 8(t0)
  lw a2, 12(t0)
  sw t0, V_TMP(gp)
  sw t1, V_TMP2(gp)
  bal groundat
  nop
  lw t0, V_TMP(gp)
  lw t1, V_TMP2(gp)
  sw v0, 8(t0)
  addiu t1, t1, -1
  bnez t1, @sg
  addiu t0, t0, 32
  jr t9
  nop

; a0・a1・a2 = 場所（×256） → v0 = 足もとの地面の高さ（×256）。いまの高さの 1 段上から下へ、はじめのかたいブロック（水はかたくない）の上
;   t9 は使わない（呼ぶ側の ra のかわり）。t5〜t8・v0・v1 を使う
groundat:
  sra t5, a0, 8
  sra t6, a2, 8
  sra t7, a1, 8
  addiu t7, t7, 1
  li v0, 0
  bltz t5, @gz
  nop
  bltz t6, @gz
  nop
  slti v1, t5, W
  beqz v1, @gz
  nop
  slti v1, t6, D
  beqz v1, @gz
  nop
  slti v1, t7, H
  bnez v1, @gy
  nop
  li t7, H - 1
@gy:
  sll t6, t6, 5
  addu t5, t5, t6
  la t6, world
  addu t5, t5, t6            ; 柱の y = 0 の場所
@gl:
  sll t6, t7, 10
  addu t6, t5, t6
  lbu t8, 0(t6)
  li v1, 9
  beqz t8, @gn
  nop
  beq t8, v1, @gn
  nop
  addiu t7, t7, 1
  jr ra
  sll v0, t7, 8
@gn:
  addiu t7, t7, -1
  bgez t7, @gl
  nop
@gz:
  jr ra
  nop

; 歩く: s1 = 生き物、a0・a1 = 動く向き（どちらも ±256 くらいの大きさ）、a2 = 速さ → 向きを決めて 1 こま進む（1 段まではのぼる・落ちる）
;   v0 = 0 進んだ・1 ふさがれた
walk:
  move t9, ra
  ; 長さ ≒ 大きい方 + 小さい方 / 2
  move t0, a0
  bgez t0, @w1
  nop
  subu t0, zero, t0
@w1:
  move t1, a1
  bgez t1, @w2
  nop
  subu t1, zero, t1
@w2:
  slt t2, t0, t1
  beqz t2, @w3
  nop
  move t3, t0
  move t0, t1
  move t1, t3
@w3:
  srl t1, t1, 1
  addu t0, t0, t1            ; 長さ
  beqz t0, @wz
  nop
  sll t1, a0, 12             ; 前の向き（×4096）
  div t1, t0
  mflo t1
  sw t1, 16(s1)
  sll t1, a1, 12
  div t1, t0
  mflo t1
  sw t1, 20(s1)
  lw t1, 16(s1)
  lw t2, 20(s1)
  mult t1, a2
  mflo t1
  sra t1, t1, 12             ; 1 こまの x
  mult t2, a2
  mflo t2
  sra t2, t2, 12             ; 1 こまの z
  lw a0, 4(s1)
  lw a1, 8(s1)
  lw a2, 12(s1)
  addu a0, a0, t1
  addu a2, a2, t2
  sw a0, V_TMP(gp)
  sw a2, V_TMP2(gp)
  bal groundat
  nop
  beqz v0, @wz               ; 島の外へは出ない
  nop
  lw t0, 8(s1)
  nop
  addiu t1, t0, 256          ; 1 段より高ければ進めない
  slt t1, t1, v0
  bnez t1, @wz
  nop
  lw a0, V_TMP(gp)
  lw a2, V_TMP2(gp)
  sw a0, 4(s1)
  sw a2, 12(s1)
  sw v0, 8(s1)
  jr t9
  li v0, 0
@wz:
  jr t9
  li v0, 1

; 子ガメ 1 匹（a0 = 生き物）
turtle:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s1, 4(sp)
  sw s2, 8(sp)
  sw s3, 12(sp)
  sw s4, 16(sp)
  move s1, a0
  ; 海に入った？（足もとのすぐ上が水）
  lw a0, 4(s1)
  lw a1, 8(s1)
  lw a2, 12(s1)
  addiu a1, a1, 128
  jal blockat
  nop
  li t0, 9
  bne v0, t0, @land
  nop
  sw zero, 0(s1)             ; 守れた
  lw t0, V_TSAVE(gp)
  lw t1, V_TALL(gp)
  addiu t0, t0, 1
  addiu t1, t1, 1
  sw t0, V_TSAVE(gp)
  sw t1, V_TALL(gp)
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_SAVE
  sw t0, V_EVT(gp)
  b @tend
  nop
@land:
  ; 海の向き（柱ごとの表。×100 → ×2 で ±200）
  lw t0, 4(s1)
  lw t1, 12(s1)
  sra t0, t0, 8
  sra t1, t1, 8
  sll t1, t1, 5
  addu t0, t0, t1
  sll t0, t0, 1
  la t1, seadir
  addu t1, t1, t0
  lb s2, 0(t1)
  lb s3, 1(t1)
  sll s2, s2, 1
  sll s3, s3, 1
  ; 見えているたき火の引き: 向き × FIREK / 距離²（ブロック）。間にかたいブロックがあれば見えない
  li s4, 0
@tf:
  la t0, fires
  sll t1, s4, 2
  addu t0, t0, t1
  lw t0, 0(t0)
  nop
  bltz t0, @tfn
  nop
  andi t1, t0, 31
  sll t1, t1, 8
  addiu t1, t1, 128
  lw t2, 4(s1)
  nop
  subu t1, t1, t2            ; dx（×256）
  srl t3, t0, 5
  andi t3, t3, 31
  sll t3, t3, 8
  addiu t3, t3, 128
  lw t2, 12(s1)
  nop
  subu t3, t3, t2            ; dz
  sra t4, t1, 8
  sra t5, t3, 8
  mult t4, t4
  mflo t4
  mult t5, t5
  mflo t5
  addu t4, t4, t5
  addiu t4, t4, 1            ; 距離²（ブロック）+ 1
  slti t5, t4, 145           ; 12 ブロックまで
  beqz t5, @tfn
  nop
  sw t1, V_TMP3(gp)
  sw t3, V_TMP4(gp)
  sw t4, V_TMP5(gp)
  ; 見えるか: 子ガメの目（足もと + 0.8）から、たき火の明かり（たき火のブロックの 1 段上）までの線の 1/4・1/2・3/4 を調べる
  ;   明かりは空に広がるので 1 段の砂のこぶではかくれない。2 段の壁ならかくれる
  srl t5, t0, 10
  addiu t5, t5, 2
  sll t5, t5, 8              ; 明かりの高さ
  lw t2, 8(s1)
  nop
  addiu t2, t2, 200
  subu t5, t5, t2            ; 高さの差
  sw t5, V_TMP7(gp)
  li t6, 1
@los:
  lw t1, V_TMP3(gp)
  lw t3, V_TMP4(gp)
  mult t1, t6
  mflo t1
  sra t1, t1, 2
  mult t3, t6
  mflo t3
  sra t3, t3, 2
  lw t5, V_TMP7(gp)
  nop
  mult t5, t6
  mflo t5
  sra t5, t5, 2
  lw a0, 4(s1)
  lw a1, 8(s1)
  lw a2, 12(s1)
  addu a0, a0, t1
  addiu a1, a1, 200
  addu a1, a1, t5
  addu a2, a2, t3
  sw t6, V_TMP6(gp)
  jal blockat
  nop
  lw t6, V_TMP6(gp)
  beqz v0, @lok
  nop
  li t0, 9
  bne v0, t0, @tfn           ; かたいブロックでかくれている
  nop
@lok:
  addiu t6, t6, 1
  slti t0, t6, 4
  bnez t0, @los
  nop
  lw t1, V_TMP3(gp)
  lw t3, V_TMP4(gp)
  lw t4, V_TMP5(gp)
  li t0, FIREK
  mult t1, t0
  mflo t1
  div t1, t4
  mflo t1
  addu s2, s2, t1
  mult t3, t0
  mflo t3
  div t3, t4
  mflo t3
  addu s3, s3, t3
@tfn:
  addiu s4, s4, 1
  slti t0, s4, 8
  bnez t0, @tf
  nop
  move a0, s2
  move a1, s3
  li a2, TSPD
  jal walk
  nop
@tend:
  lw ra, 0(sp)
  lw s1, 4(sp)
  lw s2, 8(sp)
  lw s3, 12(sp)
  lw s4, 16(sp)
  jr ra
  addiu sp, sp, 24

; ヤシガニ 1 匹（a0 = 生き物）
crab:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s1, 4(sp)
  sw s2, 8(sp)
  sw s3, 12(sp)
  sw s4, 16(sp)
  move s1, a0
  lw t0, 28(s1)              ; 逃げるのこり（正）
  nop
  blez t0, @nf
  nop
  addiu t0, t0, -1
  sw t0, 28(s1)
@nf:
  sw zero, V_TMP7(gp)
  ; つつかれた？（B を押した・2 ブロックの中で、前にいる）
  lw t0, V_EDGE(gp)
  nop
  andi t0, t0, B_B
  beqz t0, @nopoke
  nop
  lw t1, 4(s1)
  lw t2, V_CX(gp)
  lw t3, 12(s1)
  lw t4, V_CZ(gp)
  subu t1, t1, t2
  subu t3, t3, t4
  sra t5, t1, 4
  sra t6, t3, 4
  mult t5, t5
  mflo t5
  mult t6, t6
  mflo t6
  addu t5, t5, t6            ; 距離²（×16）
  li t6, 1024 + 512          ; 2.4 ブロック²
  slt t6, t5, t6
  beqz t6, @nopoke
  nop
  lw a0, V_YAW(gp)
  nop
  srl a0, a0, 8
  jal sincos
  nop
  lw t2, 4(s1)               ; 前への量 = dx × sin + dz × cos
  lw t3, V_CX(gp)
  nop
  subu t2, t2, t3
  mult t2, t0
  mflo t5
  lw t2, 12(s1)
  lw t3, V_CZ(gp)
  nop
  subu t2, t2, t3
  mult t2, t1
  mflo t6
  addu t5, t5, t6
  blez t5, @nopoke           ; うしろにいる
  nop
  lw t1, 24(s1)              ; つつかれた: 持っている物を落として逃げる
  li t2, 240
  sw t2, 28(s1)
  beqz t1, @pk
  nop
  la t2, inv
  addu t2, t2, t1
  lbu t3, 0(t2)
  nop
  addiu t3, t3, 1
  sb t3, 0(t2)
  sw zero, 24(s1)
@pk:
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_POKE
  sw t0, V_EVT(gp)
@nopoke:
  ; 持っている・逃げている → 海へ。海に入ったらいなくなる
  lw t0, 24(s1)
  lw t1, 28(s1)
  bnez t0, @tosea
  nop
  blez t1, @hunt
  nop
@tosea:
  lw a0, 4(s1)
  lw a1, 8(s1)
  lw a2, 12(s1)
  addiu a1, a1, 128
  jal blockat
  nop
  li t0, 9
  bne v0, t0, @run
  nop
  lw t0, 24(s1)              ; 持っていた物は、朝に浜へ打ち上がる
  la t1, washed
  addu t1, t1, t0
  lbu t2, 0(t1)
  nop
  addiu t2, t2, 1
  sb t2, 0(t1)
  sw zero, 0(s1)
  b @cend
  nop
@run:
  lw t0, 4(s1)
  lw t1, 12(s1)
  sra t0, t0, 8
  sra t1, t1, 8
  sll t1, t1, 5
  addu t0, t0, t1
  sll t0, t0, 1
  la t1, seadir
  addu t1, t1, t0
  lb a0, 0(t1)
  lb a1, 1(t1)
  li a2, CRUN
  jal walk
  nop
  b @cend
  nop
@hunt:
  ; 人まで（ブロック²）
  lw s2, V_CX(gp)
  lw t1, 4(s1)
  lw s3, V_CZ(gp)
  lw t3, 12(s1)
  subu s2, s2, t1            ; 人への dx
  subu s3, s3, t3
  sra t5, s2, 4
  sra t6, s3, 4
  mult t5, t5
  mflo t5
  mult t6, t6
  mflo t6
  addu s4, t5, t6            ; 距離²（×256 で 1 ブロック²）
  ; ふれた？（0.7 ブロックの中・高さの差が 1.5 ブロックより小さい）
  slti t0, s4, 125
  beqz t0, @far
  nop
  lw t0, V_CY(gp)
  lw t1, 8(s1)
  nop
  subu t0, t0, t1
  bgez t0, @dy
  nop
  subu t0, zero, t0
@dy:
  slti t0, t0, 384
  beqz t0, @far
  nop
  lw t0, 28(s1)              ; 1 秒（60 こま）ゆれてから取る
  nop
  bltz t0, @wind
  nop
  li t0, -60
  sw t0, 28(s1)
  b @cend
  nop
@wind:
  addiu t0, t0, 1
  sw t0, 28(s1)
  bltz t0, @cend
  nop
  jal steal
  nop
  b @cend
  nop
@far:
  lw t0, 28(s1)              ; 離れたら、ゆれをやめる
  nop
  bgez t0, @nw
  nop
  sw zero, 28(s1)
@nw:
  li t0, 64 * 256            ; 8 ブロックより遠ければ、島の内へゆっくり
  slt t0, s4, t0
  bnez t0, @near
  nop
  lw t0, 4(s1)
  lw t1, 12(s1)
  sra t0, t0, 8
  sra t1, t1, 8
  sll t1, t1, 5
  addu t0, t0, t1
  sll t0, t0, 1
  la t1, seadir
  addu t1, t1, t0
  lb s2, 0(t1)
  lb s3, 1(t1)
  subu s2, zero, s2
  subu s3, zero, s3
  li s4, 2
  b @fire
  nop
@near:
  li t0, 1                   ; 近い: ねらいの横に [B] の札
  sw t0, V_CRABN(gp)
  li s4, CSPD
  lw t0, V_BLINK(gp)         ; 近いときは足音（16 こまに 1 回）
  nop
  andi t0, t0, 15
  bnez t0, @fire
  nop
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_CRAB
  sw t0, V_EVT(gp)
@fire:
  ; たき火から 3 ブロックの中には入らない（進んだ先が近ければ止まる）
  li t9, 0
@cf2:
  la t0, fires
  sll t1, t9, 2
  addu t0, t0, t1
  lw t0, 0(t0)
  nop
  bltz t0, @cfn
  nop
  andi t1, t0, 31
  sll t1, t1, 8
  addiu t1, t1, 128
  srl t3, t0, 5
  andi t3, t3, 31
  sll t3, t3, 8
  addiu t3, t3, 128
  lw t2, 4(s1)
  lw t4, 12(s1)
  subu t1, t1, t2
  subu t3, t3, t4
  sra t1, t1, 4
  sra t3, t3, 4
  mult t1, t1
  mflo t1
  mult t3, t3
  mflo t3
  addu t1, t1, t3
  li t3, 9 * 256             ; 3 ブロック²
  slt t1, t1, t3
  beqz t1, @cfn
  nop
  li t0, 120                 ; たき火の輪の中: 逃げる
  sw t0, 28(s1)
  b @cend
  nop
@cfn:
  addiu t9, t9, 1
  slti t0, t9, 8
  bnez t0, @cf2
  nop
  move a0, s2
  move a1, s3
  sra a0, a0, 2
  sra a1, a1, 2
  move a2, s4
  jal walk
  nop
@cend:
  lw ra, 0(sp)
  lw s1, 4(sp)
  lw s2, 8(sp)
  lw s3, 12(sp)
  lw s4, 16(sp)
  jr ra
  addiu sp, sp, 24

; ヤシガニがふれた（s1）: 選んでいる物（なければ、持っているいちばん若い番号の物）を 1 つ持って海へ
steal:
  lw t0, V_SEL(gp)
  la t1, inv
  addu t2, t1, t0
  lbu t3, 0(t2)
  nop
  bnez t3, @got
  nop
  li t0, 2
@sf:
  addu t2, t1, t0
  lbu t3, 0(t2)
  nop
  bnez t3, @got
  nop
  addiu t0, t0, 1
  slti t4, t0, 13
  bnez t4, @sf
  nop
  li t0, 120                 ; 何も持っていない: そのまま帰る
  jr ra
  sw t0, 28(s1)
@got:
  addiu t3, t3, -1
  sb t3, 0(t2)
  sw t0, 24(s1)
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_STEAL
  jr ra
  sw t0, V_EVT(gp)

; ---- 描く: 生き物を箱で（render の面のあと、並べ表へ）。s2 = 荷物の場所・s3 = 描いた数を進める ----
drawcrits:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s4, 12(sp)
  la s0, crits
  li s1, NCRIT
@dc:
  lw t0, 0(s0)
  nop
  beqz t0, @dn
  nop
  la s4, shapes              ; 形 = shapes + (種類 − 1) × 68
  addiu t0, t0, -1
  sll t1, t0, 6
  sll t0, t0, 2
  addu t0, t0, t1
  addu s4, s4, t0
  lw t0, 0(s4)
  addiu s4, s4, 4
  sw t0, 16(sp)              ; 箱の数
@db:
  move a0, s0
  move a1, s4
  jal drawbox
  nop
  addiu s4, s4, 16
  lw t0, 16(sp)
  nop
  addiu t0, t0, -1
  sw t0, 16(sp)
  bnez t0, @db
  nop
@dn:
  addiu s1, s1, -1
  bnez s1, @dc
  addiu s0, s0, 32
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s4, 12(sp)
  jr ra
  addiu sp, sp, 24

; 箱を 1 つ: a0 = 生き物、a1 = 箱（hx, hy, hz, ox, oy, oz, 色）
drawbox:
  move t9, ra
  slti t0, s3, MAXDRAW - 8
  beqz t0, @bx
  nop
  sw a0, V_TMP(gp)
  sw a1, V_TMP2(gp)
  ; 8 すみ（c = x の +・y の +・z の + を 1・2・4 ビット）を投げて boxbuf へ（画面の場所・奥行き）
  li t8, 0
@bc:
  lw a1, V_TMP2(gp)
  lw a0, V_TMP(gp)
  lh t0, 0(a1)               ; hx
  lh t1, 6(a1)               ; ox
  andi t2, t8, 1
  bnez t2, @px
  nop
  subu t0, zero, t0
@px:
  addu t0, t0, t1            ; lx
  lh t1, 2(a1)               ; hy
  lh t2, 8(a1)               ; oy
  andi t3, t8, 2
  addu t2, t2, t1            ; まん中の高さ = oy + hy
  bnez t3, @py
  nop
  subu t1, zero, t1
@py:
  addu t1, t1, t2            ; ly（足もとから上）
  lh t2, 4(a1)               ; hz
  lh t3, 10(a1)              ; oz
  andi t4, t8, 4
  bnez t4, @pz
  nop
  subu t2, zero, t2
@pz:
  addu t2, t2, t3            ; lz（前が +）
  lw t3, 16(a0)              ; 前の向き fx・fz
  lw t4, 20(a0)
  nop
  mult t0, t4                ; dx = lx × fz + lz × fx
  mflo t5
  mult t2, t3
  mflo t6
  addu t5, t5, t6
  sra t5, t5, 12
  mult t2, t4                ; dz = lz × fz − lx × fx
  mflo t6
  mult t0, t3
  mflo t7
  subu t6, t6, t7
  sra t6, t6, 12
  lw t0, 4(a0)
  lw t2, V_CX(gp)
  addu t0, t0, t5
  subu t0, t0, t2            ; bx
  lw t2, 8(a0)
  lw t3, V_EY(gp)
  addu t2, t2, t1
  subu t2, t3, t2            ; by（下が +）
  lw t3, 12(a0)
  lw t4, V_CZ(gp)
  addu t3, t3, t6
  subu t3, t3, t4            ; bz
  andi t0, t0, 0xffff
  sll t2, t2, 16
  or t0, t0, t2
  mtc2 t0, 0
  mtc2 t3, 1
  nop
  cop2 0x0180001             ; RTPS
  mfc2 t0, 19
  la t1, boxbuf
  slti t2, t0, NEAR
  bnez t2, @bx               ; カメラに近すぎる箱は描かない
  sll t2, t8, 3
  addu t1, t1, t2
  swc2 14, 0(t1)
  sw t0, 4(t1)
  addiu t8, t8, 1
  slti t0, t8, 8
  bnez t0, @bc
  nop
  ; 6 面（すみの番号 4 つ・外から見て左回り）。表の面だけ、色 × 面の明るさ × 夜の明るさ
  la t7, boxfaces
  li t8, 6
@bf:
  la t1, boxbuf
  lbu t2, 0(t7)
  lbu t3, 1(t7)
  lbu t4, 2(t7)
  lbu t5, 3(t7)
  sll t2, t2, 3
  sll t3, t3, 3
  sll t4, t4, 3
  sll t5, t5, 3
  addu t2, t1, t2
  addu t3, t1, t3
  addu t4, t1, t4
  addu t5, t1, t5
  ; 表か: (b − a) × (d − a) の向き
  lh t0, 0(t2)               ; ax
  lh t1, 2(t2)               ; ay
  lh a0, 0(t3)
  lh a1, 2(t3)
  subu a0, a0, t0            ; b − a
  subu a1, a1, t1
  lh a2, 0(t5)
  lh a3, 2(t5)
  subu a2, a2, t0            ; d − a
  subu a3, a3, t1
  mult a0, a3
  mflo t0
  mult a1, a2
  mflo t1
  subu t0, t0, t1
  blez t0, @bfn              ; 裏
  nop
  ; 荷物（0x28 の一色の四角: a・b・d・c）
  lw t0, 0(t2)
  nop
  sw t0, 8(s2)
  lw t0, 0(t3)
  nop
  sw t0, 12(s2)
  lw t0, 0(t5)
  nop
  sw t0, 16(s2)
  lw t0, 0(t4)
  nop
  sw t0, 20(s2)
  ; 色 = 箱の色 × 面の明るさ（表の 4 番目）× 夜でも少し見える明るさ
  lw a1, V_TMP2(gp)
  lbu t1, 4(t7)              ; 面の明るさ（/256）
  lw t0, 12(a1)              ; 色（上のバイトが 1 なら自分で光る）
  lw a0, V_LIGHT(gp)
  srl a2, t0, 24
  beqz a2, @em
  nop
  li a0, 256
@em:
  slti a2, a0, 210           ; 夜でも月あかりで見える（少なくとも 82%）
  beqz a2, @lt
  nop
  li a0, 210
@lt:
  mult t1, a0
  mflo t1
  srl t1, t1, 8              ; 合わせた明るさ（/256）
  li a2, 0x00ff00ff
  and a3, t0, a2             ; （上のバイトの光る印は、ここで消える）
  mult a3, t1
  mflo a3
  srl a3, a3, 8
  and a3, a3, a2
  andi a0, t0, 0xff00
  mult a0, t1
  mflo a0
  srl a0, a0, 8
  andi a0, a0, 0xff00
  or a3, a3, a0
  lui a0, 0x2800
  or a3, a3, a0
  sw a3, 4(s2)
  ; 並べ表へ（4 すみの奥行きの和 >> 6。地面より手前に）
  lw t0, 4(t2)
  lw t1, 4(t3)
  nop
  addu t0, t0, t1
  lw t1, 4(t4)
  nop
  addu t0, t0, t1
  lw t1, 4(t5)
  nop
  addu t0, t0, t1
  srl t0, t0, 6
  addiu t0, t0, -1
  bgez t0, @o0
  nop
  li t0, 0
@o0:
  slti t1, t0, OTN
  bnez t1, @o1
  nop
  li t0, OTN - 1
@o1:
  la t1, ot
  sll t0, t0, 2
  addu t0, t1, t0
  lw t1, 0(t0)
  li a0, 0x00ffffff
  and t1, t1, a0
  lui a1, 0x0500
  or t1, t1, a1
  sw t1, 0(s2)
  and t1, s2, a0
  sw t1, 0(t0)
  addiu s2, s2, 24
  addiu s3, s3, 1
@bfn:
  addiu t7, t7, 5
  addiu t8, t8, -1
  bnez t8, @bf
  nop
@bx:
  jr t9
  nop

; 箱の 6 面: すみ a・b・c・d（外から見て左回り）と面の明るさ（/256）
boxfaces:
  .byte 1, 3, 7, 5, 190      ; +x
  .byte 0, 4, 6, 2, 190      ; −x
  .byte 2, 6, 7, 3, 255      ; 上
  .byte 0, 1, 5, 4, 120      ; 下
  .byte 4, 5, 7, 6, 220      ; 前
  .byte 0, 2, 3, 1, 220      ; うしろ
.align 4
boxbuf:  .space 64
crits:   .space NCRIT * 32
fires:   .space 32
washed:  .space 16
