; 光るキューブ（段階B のテストソフト: GTE とコントローラー）
;   GTE で回して画面へ投げ（RTPT/RTPS）、裏の面を捨て（NCLIP）、奥行きの平均（AVSZ4）で並べ表に入れ、
;   面の向きと光で色を決める（MVMVA → MVMVA → CC）。十字キーで回す（はなすとゆっくり回りつづける）。
;   遅延スロットとロードの遅れは自分で nop を入れる

IO     = 0x1f801000
GP0    = 0x810
GP1    = 0x814
ISTAT  = 0x070
D2MADR = 0x0a0
D2BCR  = 0x0a4
D2CHCR = 0x0a8
D6MADR = 0x0e0
D6BCR  = 0x0e4
D6CHCR = 0x0e8
DPCR   = 0x0f0
JDATA  = 0x040
JSTAT  = 0x044
JCTRL  = 0x04a
OTN    = 256

.org 0x80010000
start:
  li s7, IO
  sw zero, GP1(s7)
  li t0, 0x08000001
  sw t0, GP1(s7)
  li t0, 0x06c60260
  sw t0, GP1(s7)
  li t0, 0x07042018
  sw t0, GP1(s7)
  li t0, 0x04000002
  sw t0, GP1(s7)
  li t0, 0x03000000
  sw t0, GP1(s7)
  li t0, 0xe1000600          ; ディザあり
  sw t0, GP0(s7)
  lw t0, DPCR(s7)
  li t1, 0x08000800          ; DMA の GPU と並べ表の口
  or t0, t0, t1
  sw t0, DPCR(s7)

  ; ---- GTE: 画面のまん中・投げる距離・奥行きの平均・ずらす量 ----
  ctc2 zero, 24              ; OFX = 0（画面のまん中へのずらしは GPU の E5 でする）
  ctc2 zero, 25              ; OFY = 0
  li t0, 240
  ctc2 t0, 26                ; H（大きいほど望遠）
  li t0, 1024
  ctc2 t0, 30                ; ZSF4 = 1/4（4点の平均）
  ctc2 zero, 5
  ctc2 zero, 6
  li t0, 700
  ctc2 t0, 7                 ; 前へ 700
  ; 光: 向き（光のほうへ。左上の手前）・色（あたたかい白）・まわりの光（青み）
  li t0, 0xf666f8cd          ; L11=-1843 L12=-2458
  ctc2 t0, 8
  li t0, 0x0000f571          ; L13=-2703
  ctc2 t0, 9
  ctc2 zero, 10
  ctc2 zero, 11
  ctc2 zero, 12
  li t0, 0x00001000          ; LR1=4096
  ctc2 t0, 16
  li t0, 0x0f300000          ; LG1=3888
  ctc2 t0, 17
  ctc2 zero, 18
  li t0, 0x00000d40          ; LB1=3392
  ctc2 t0, 19
  ctc2 zero, 20
  li t0, 760
  ctc2 t0, 13                ; まわりの光 R
  li t0, 840
  ctc2 t0, 14                ; G
  li t0, 1100
  ctc2 t0, 15                ; B
  li s6, 0
  li s0, 0x1800              ; x のまわりの角度（下の 8 ビットは端数）
  li s1, 0x2000              ; y のまわり

frame:
@wait:
  lw t0, ISTAT(s7)
  nop
  andi t0, t0, 1
  beqz t0, @wait
  nop
  li t0, -2
  sw t0, ISTAT(s7)
  ; 描きおえた側を見せ、反対側に描く（回る三角形と同じ）
  sll t1, s6, 18
  li t0, 0x05000000
  or t0, t0, t1
  sw t0, GP1(s7)
  xori s6, s6, 1
  sll t2, s6, 8
  sll t1, t2, 10
  li t0, 0xe3000000
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t1, t2, 239
  sll t1, t1, 10
  ori t1, t1, 319
  li t0, 0xe4000000
  or t0, t0, t1
  sw t0, GP0(s7)
  addiu t1, t2, 120
  sll t1, t1, 11
  ori t1, t1, 160
  li t0, 0xe5000000
  or t0, t0, t1
  sw t0, GP0(s7)
  ; 背景: 上は夜の青、下はあたたかい灰のグーロー
  li t0, 0x38281410
  sw t0, GP0(s7)
  li t0, 0xff88ff60
  sw t0, GP0(s7)
  li t0, 0x00281410
  sw t0, GP0(s7)
  li t0, 0xff8800a0
  sw t0, GP0(s7)
  li t0, 0x00303844
  sw t0, GP0(s7)
  li t0, 0x0078ff60
  sw t0, GP0(s7)
  li t0, 0x00303844
  sw t0, GP0(s7)
  li t0, 0x007800a0
  sw t0, GP0(s7)

  ; ---- パッドを読んで、回す ----
  jal readpad
  nop
  move s3, v0
  li t0, 0x50                ; 何も押さなければ、ゆっくり
  andi t1, s3, 0x20          ; →
  beqz t1, @nr
  nop
  li t0, 0x280
@nr:
  andi t1, s3, 0x80          ; ←
  beqz t1, @nl
  nop
  li t0, -0x280
@nl:
  addu s1, s1, t0
  li t0, 0x20
  andi t1, s3, 0x40          ; ↓
  beqz t1, @nd
  nop
  li t0, 0x280
@nd:
  andi t1, s3, 0x10          ; ↑
  beqz t1, @nu
  nop
  li t0, -0x280
@nu:
  addu s0, s0, t0

  ; ---- 回す行列 R = Ry × Rx を GTE へ ----
  la t9, sintab
  srl t0, s0, 8
  andi t0, t0, 255
  sll t1, t0, 2
  addu t1, t9, t1
  lw t2, 0(t1)               ; sx
  addiu t1, t0, 64
  andi t1, t1, 255
  sll t1, t1, 2
  addu t1, t9, t1
  lw t3, 0(t1)               ; cx
  srl t0, s1, 8
  andi t0, t0, 255
  sll t1, t0, 2
  addu t1, t9, t1
  lw t4, 0(t1)               ; sy
  addiu t1, t0, 64
  andi t1, t1, 255
  sll t1, t1, 2
  addu t1, t9, t1
  lw t5, 0(t1)               ; cy
  mult t4, t2
  mflo t6
  sra t6, t6, 12             ; R12 = sy*sx
  mult t4, t3
  mflo t7
  sra t7, t7, 12             ; R13 = sy*cx
  andi t0, t5, 0xffff        ; R11 = cy
  sll t1, t6, 16
  or t0, t0, t1
  ctc2 t0, 0
  andi t0, t7, 0xffff        ; R21 = 0
  ctc2 t0, 1
  andi t0, t3, 0xffff        ; R22 = cx
  subu t1, zero, t2          ; R23 = -sx
  sll t1, t1, 16
  or t0, t0, t1
  ctc2 t0, 2
  mult t5, t2
  mflo t6
  sra t6, t6, 12             ; R32 = cy*sx
  mult t5, t3
  mflo t7
  sra t7, t7, 12             ; R33 = cy*cx
  subu t0, zero, t4          ; R31 = -sy
  andi t0, t0, 0xffff
  sll t1, t6, 16
  or t0, t0, t1
  ctc2 t0, 3
  ctc2 t7, 4

  ; ---- 並べ表を空にする（DMA 6） ----
  la t0, ot + (OTN - 1) * 4
  sw t0, D6MADR(s7)
  li t0, OTN
  sw t0, D6BCR(s7)
  li t0, 0x11000002
  sw t0, D6CHCR(s7)

  ; ---- 面ごとに ----
  la s5, faces
  la s4, pkts
  li s2, 6
@face:
  la t9, verts
  lbu t0, 0(s5)
  lbu t1, 1(s5)
  lbu t2, 2(s5)
  sll t0, t0, 3
  addu t0, t9, t0
  sll t1, t1, 3
  addu t1, t9, t1
  sll t2, t2, 3
  addu t2, t9, t2
  lwc2 0, 0(t0)
  lwc2 1, 4(t0)
  lwc2 2, 0(t1)
  lwc2 3, 4(t1)
  lwc2 4, 0(t2)
  lwc2 5, 4(t2)
  nop
  cop2 0x0280030             ; RTPT
  nop
  cop2 0x1400006             ; NCLIP
  mfc2 t0, 24
  nop
  blez t0, @skip             ; 裏向き
  nop
  swc2 12, 8(s4)
  swc2 13, 12(s4)
  swc2 14, 16(s4)
  lbu t0, 3(s5)
  nop                        ; ロードの遅れ（すぐ使うと前の値が見える）
  sll t0, t0, 3
  addu t0, t9, t0
  lwc2 0, 0(t0)
  lwc2 1, 4(t0)
  nop
  cop2 0x0180001             ; RTPS（4つ目の点）
  nop
  swc2 14, 20(s4)
  cop2 0x168002e             ; AVSZ4
  mfc2 t3, 7                 ; OTZ
  ; 光: 面の向きを回す → 光の向きとの内積（0 より下は 0）→ まわりの光＋光の色 × 面の色
  lwc2 0, 4(s5)
  lwc2 1, 8(s5)
  lw t0, 12(s5)
  nop
  mtc2 t0, 6                 ; RGBC（上のバイト 0x28 = 四角の命令）
  cop2 0x0086012             ; MVMVA: RT × V0
  nop
  cop2 0x00be412             ; MVMVA: LLM × IR（lm）
  nop
  cop2 0x138041c             ; CC
  nop
  swc2 22, 4(s4)             ; 色と命令
  ; 並べ表へ: 奥ほど大きな番号（先に描かれる）
  srl t3, t3, 2
  slti t1, t3, OTN
  bnez t1, @ok
  nop
  li t3, OTN - 1
@ok:
  la t9, ot
  sll t3, t3, 2
  addu t3, t9, t3
  lw t1, 0(t3)
  li t2, 0x00ffffff
  and t1, t1, t2
  lui t4, 0x0500
  or t1, t1, t4
  sw t1, 0(s4)
  and t1, s4, t2
  sw t1, 0(t3)
  addiu s4, s4, 24
@skip:
  addiu s5, s5, 16
  addiu s2, s2, -1
  bnez s2, @face
  nop

  ; ---- 並べ表を GPU へ（奥の端から） ----
  la t0, ot + (OTN - 1) * 4
  sw t0, D2MADR(s7)
  sw zero, D2BCR(s7)
  li t0, 0x01000401
  sw t0, D2CHCR(s7)
  j frame
  nop

; パッド（口 1）を読む → v0 = 押しているボタン（1 が押している）
readpad:
  move t8, ra
  li t0, 0x0003              ; 送る・選ぶ（口 1）
  sh t0, JCTRL(s7)
  li a0, 0x01
  bal @xfer
  nop
  li a0, 0x42
  bal @xfer
  nop
  li a0, 0
  bal @xfer
  nop
  li a0, 0
  bal @xfer
  nop
  move t5, v0
  li a0, 0
  bal @xfer
  nop
  sh zero, JCTRL(s7)
  sll v0, v0, 8
  or v0, v0, t5
  not v0, v0
  jr t8
  andi v0, v0, 0xffff
@xfer:
  sb a0, JDATA(s7)
@w:
  lw t0, JSTAT(s7)
  nop
  andi t0, t0, 2
  beqz t0, @w
  nop
  lbu v0, JDATA(s7)
  jr ra
  nop
