; ---- 描く: 空と海・ブロックの面・ねらいのふち・十字・持ち物の列。行列・パッド・はじめの設定（main.s のつづき） ----

NEAR    = 40             ; これより手前の点がある面は描かない（手前の切れ目）
LODZ    = 2048           ; これより遠い面は、模様をやめて霧にまぜた一色（8 ブロック）
AOZ     = 1536           ; これより近い面だけ、すみの陰（グーロー）をつける（6 ブロック）
FARZ    = 5120           ; 霧でいちばん白くなる所（20 ブロック）
; 見える広さ・霧のはじまりと長さ・霧の上限・明るさは、昼と夜の段ごと（data.mjs の LEVELS → lighttab → V_〜）
MAXDRAW = 1400           ; 1 こまに描く面のいちばん多い数（近いチャンクから描くので、あふれるのは遠く）
SHIPYAW = 200            ; のろしのあと船が来る方角（256 で 1 周）
TPAGE   = 10             ; 模様のページ（VRAM の x = 640）・4 ビット

gteinit:
  ctc2 zero, 24              ; OFX・OFY = 0（まん中へは GPU の E5）
  ctc2 zero, 25
  li t0, 160
  ctc2 t0, 26                ; H（横の見える広さ ≒ 90 度）
  li t0, 1024
  ctc2 t0, 30                ; ZSF4 = 1/4（4 点の平均）
  jr ra
  nop

; 明るさの段（V_LVL）の数を lighttab から V_〜 へ写し、霧の色を GTE の FC へ（毎こま、描くまえに）
lightset:
  lw t0, V_LVL(gp)
  la t1, lighttab
  sll t2, t0, 5
  sll t0, t0, 4
  addu t0, t0, t2            ; × 48
  addu t1, t1, t0
  addiu t2, gp, V_MODB
  li t3, 9
@ls:
  lw t0, 0(t1)
  addiu t1, t1, 4
  sw t0, 0(t2)
  addiu t3, t3, -1
  bnez t3, @ls
  addiu t2, t2, 4
  lw t0, V_FOGRGB(gp)        ; 遠くの色（DPCS で霧にまぜる）= 霧の色 × 16
  nop
  andi t1, t0, 255
  sll t1, t1, 4
  ctc2 t1, 21
  srl t1, t0, 8
  andi t1, t1, 255
  sll t1, t1, 4
  ctc2 t1, 22
  srl t1, t0, 16
  andi t1, t1, 255
  sll t1, t1, 4
  ctc2 t1, 23
  jr ra
  nop

; ブロックの模様と色の表を VRAM へ（CPU → VRAM の転送）
texupload:
  li t0, 0xa0000000
  sw t0, GP0(s7)
  li t0, 640                 ; (640, 0)
  sw t0, GP0(s7)
  li t0, (32 << 16) | 64     ; 64 × 32（2 段）
  sw t0, GP0(s7)
  la t1, texdata
  li t2, 64 * 32 / 2
@t:
  lw t0, 0(t1)
  addiu t1, t1, 4
  addiu t2, t2, -1
  bnez t2, @t
  sw t0, GP0(s7)
  li t0, 0xa0000000
  sw t0, GP0(s7)
  li t0, (240 << 16) | 320   ; (320, 240)
  sw t0, GP0(s7)
  li t0, (1 << 16) | (NTEX * 16)
  sw t0, GP0(s7)
  la t1, clutdata
  li t2, NTEX * 16 / 2
@c:
  lw t0, 0(t1)
  addiu t1, t1, 4
  addiu t2, t2, -1
  bnez t2, @c
  sw t0, GP0(s7)
  jr ra
  nop

; ---- 1 こまを描く ----
render:
  addiu sp, sp, -48           ; 32 = 近い順の何番目・36 = チャンク・40 = 向き
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
  sw s4, 20(sp)
  sw s5, 24(sp)
  sw fp, 28(sp)
  jal lightset
  nop
  jal sky
  nop
  ; 回す行列 = 上下（x のまわり）×向き（y のまわり）。どちらも逆向きに回して、見る向きを +z に
  lw a0, V_PIT(gp)
  nop
  sra a0, a0, 8
  subu a0, zero, a0
  la a1, mat_a
  jal rotx
  nop
  lw a0, V_YAW(gp)
  nop
  srl a0, a0, 8
  subu a0, zero, a0
  la a1, mat_b
  jal roty
  nop
  la a0, mat_a
  la a1, mat_b
  la a2, mat_c
  jal matmul
  nop
  la a0, mat_c
  jal setrt
  nop
  ctc2 zero, 5
  ctc2 zero, 6
  ctc2 zero, 7
  ; 並べ表を空に
  la t0, ot + (OTN - 1) * 4
  sw t0, D6MADR(s7)
  li t0, OTN
  sw t0, D6BCR(s7)
  li t0, 0x11000002
  sw t0, D6CHCR(s7)
  lw s4, V_CX(gp)
  lw fp, V_EY(gp)
  lw s5, V_CZ(gp)
  la s2, pkts
  li s3, 0                   ; 描いた面の数
  jal sortchunks
  nop
  li t9, 0                   ; 近い順の何番目か
@chunk:
  sw t9, 32(sp)
  la t0, corder
  addu t0, t0, t9
  lbu t9, 0(t0)              ; チャンクの番号
  nop
  ; チャンクのまん中までの距離（ブロック）で、遠いものは描かない
  andi t0, t9, 3
  sll t0, t0, 11
  addiu t0, t0, 1024         ; まん中の x（×256）
  srl t1, t9, 2
  sll t1, t1, 11
  addiu t1, t1, 1024
  subu t0, t0, s4
  subu t1, t1, s5
  sra t0, t0, 8
  sra t1, t1, 8
  mult t0, t0
  mflo t2
  mult t1, t1
  mflo t3
  addu t2, t2, t3
  lw t3, V_VR2(gp)
  nop
  slt t2, t2, t3
  beqz t2, @nextchunk
  nop
  sw t9, 36(sp)              ; チャンクの番号
  sw zero, 40(sp)            ; 向き
@dir:
  lw t9, 36(sp)
  lw t8, 40(sp)
  andi t0, t9, 3
  sll t0, t0, 11             ; チャンクの左はしの x（×256）
  srl t1, t9, 2
  sll t1, t1, 11             ; 手前はしの z
  ; 横の向きは、チャンクのどの面もカメラから裏になるなら、まとめて飛ばす
  bnez t8, @g1
  nop
  addiu t2, t0, 256          ; +x: カメラの x が 左はし + 1 より右でなければ全部裏
  slt t3, t2, s4
  beqz t3, @nextdir
  nop
  b @gok
  nop
@g1:
  li t2, 1
  bne t8, t2, @g4
  nop
  addiu t2, t0, 7 * 256      ; −x: カメラの x が 右はしのブロックより左でなければ全部裏
  slt t3, s4, t2
  beqz t3, @nextdir
  nop
  b @gok
  nop
@g4:
  li t2, 4
  bne t8, t2, @g5
  nop
  addiu t2, t1, 256          ; +z
  slt t3, t2, s5
  beqz t3, @nextdir
  nop
  b @gok
  nop
@g5:
  li t2, 5
  bne t8, t2, @gok
  nop
  addiu t2, t1, 7 * 256      ; −z
  slt t3, s5, t2
  beqz t3, @nextdir
  nop
@gok:
  li t2, 6 * DIRF * 4
  mult t9, t2
  mflo t0
  la s0, faces
  addu s0, s0, t0
  sll t0, t8, 10             ; 向き × DIRF × 4
  addu s0, s0, t0
  sll t0, t9, 3
  sll t1, t9, 4
  addu t0, t0, t1            ; チャンク × 24
  sll t1, t8, 2
  addu t0, t0, t1
  la t1, fcount
  addu t1, t1, t0
  lw s1, 0(t1)
  nop
  beqz s1, @nextdir
  nop
@face:
  lw t0, 0(s0)
  addiu s0, s0, 4
  andi t1, t0, 31            ; x
  srl t2, t0, 5
  andi t2, t2, 31            ; z
  srl t3, t0, 10
  andi t3, t3, 15            ; y
  srl t4, t0, 14
  andi t4, t4, 7             ; 向き
  srl t5, t0, 17
  andi t5, t5, 31            ; ブロック
  srl t9, t0, 22             ; t9 = すみの陰（2 ビット × 4）| 裏返し << 8（この面のあいだ使う）
  sll t1, t1, 8
  subu t1, t1, s4            ; bx（カメラから）
  sll t3, t3, 8
  subu t3, fp, t3            ; by（下が +）
  sll t2, t2, 8
  subu t2, t2, s5            ; bz
  ; 裏の面は捨てる（カメラがどちらの側にいるかで）
  beqz t4, @d0
  nop
  li t6, 1
  beq t4, t6, @d1
  nop
  li t6, 2
  beq t4, t6, @d2
  nop
  li t6, 3
  beq t4, t6, @d3
  nop
  li t6, 4
  beq t4, t6, @d4
  nop
  blez t2, @skip             ; −z: カメラが z より手前（bz > 0）
  nop
  b @vis
  nop
@d0:
  slti t6, t1, -256          ; +x: bx < −256
  beqz t6, @skip
  nop
  b @vis
  nop
@d1:
  blez t1, @skip             ; −x: bx > 0
  nop
  b @vis
  nop
@d2:
  slti t6, t3, 257           ; 上: by > 256
  bnez t6, @skip
  nop
  b @vis
  nop
@d3:
  bgez t3, @skip             ; 下: by < 0
  nop
  b @vis
  nop
@d4:
  slti t6, t2, -256          ; +z: bz < −256
  beqz t6, @skip
  nop
@vis:
  ; 4 すみ（corners の表: 向き × 4 × 3）
  la t6, corners
  sll t7, t4, 3
  sll t8, t4, 4
  addu t7, t7, t8            ; 向き × 24 バイト
  addu t6, t6, t7
  ; すみ 0・1・2 → V0・V1・V2
  lh t7, 0(t6)
  lh t8, 2(t6)
  lh a0, 4(t6)
  addu t7, t1, t7
  subu t8, t3, t8
  addu a0, t2, a0
  andi t7, t7, 0xffff
  sll t8, t8, 16
  or t7, t7, t8
  mtc2 t7, 0
  mtc2 a0, 1
  lh t7, 6(t6)
  lh t8, 8(t6)
  lh a0, 10(t6)
  addu t7, t1, t7
  subu t8, t3, t8
  addu a0, t2, a0
  andi t7, t7, 0xffff
  sll t8, t8, 16
  or t7, t7, t8
  mtc2 t7, 2
  mtc2 a0, 3
  lh t7, 12(t6)
  lh t8, 14(t6)
  lh a0, 16(t6)
  addu t7, t1, t7
  subu t8, t3, t8
  addu a0, t2, a0
  andi t7, t7, 0xffff
  sll t8, t8, 16
  or t7, t7, t8
  mtc2 t7, 4
  mtc2 a0, 5
  nop
  cop2 0x0280030             ; RTPT
  mfc2 t7, 17
  mfc2 t8, 18
  mfc2 a0, 19
  slti t7, t7, NEAR
  bnez t7, @skip
  slti t8, t8, NEAR
  bnez t8, @skip
  slti a0, a0, NEAR
  bnez a0, @skip
  nop
  swc2 12, 8(s2)             ; 左上（模様の荷物の場所。一色なら下で詰める）
  swc2 13, 16(s2)
  swc2 14, 24(s2)
  ; すみ 3 → RTPS
  lh t7, 18(t6)
  lh t8, 20(t6)
  lh a0, 22(t6)
  addu t7, t1, t7
  subu t8, t3, t8
  addu a0, t2, a0
  andi t7, t7, 0xffff
  sll t8, t8, 16
  or t7, t7, t8
  mtc2 t7, 0
  mtc2 a0, 1
  nop
  cop2 0x0180001             ; RTPS
  mfc2 t7, 19
  nop
  slti t7, t7, NEAR
  bnez t7, @skip
  nop
  swc2 14, 32(s2)
  cop2 0x168002e             ; AVSZ4
  mfc2 a1, 7                 ; 奥行き
  ; 模様の番号（上・横・下）
  la t6, texside
  li t7, 2
  bne t4, t7, @nt
  nop
  la t6, textop
@nt:
  li t7, 3
  bne t4, t7, @nb
  nop
  la t6, texbot
@nb:
  addu t6, t6, t5
  lbu a2, 0(t6)              ; 模様
  la t6, shadeof
  addu t6, t6, t4
  lbu a3, 0(t6)              ; 向きの明るさ
  ; 霧の割合 t =（奥行き − FOG0）を 0〜4096 に（近い面も遠い面も同じ t で霧の色へまぜる）
  lw t0, V_FOG0(gp)
  lw t1, V_FOGK(gp)
  subu t0, a1, t0
  mult t0, t1
  mflo t0
  sra t0, t0, 8              ; ×（4096 / 霧の長さ）
  bgez t0, @f0
  nop
  li t0, 0
@f0:
  slti t1, t0, 4096
  bnez t1, @f0b
  nop
  li t0, 4096
@f0b:
  mult t0, t0                ; 2 乗にして、近くはうすく遠くで急に濃く（中ほどの木が透けて見えないように）
  mflo t0
  srl t0, t0, 12
  lw t1, V_FOGC(gp)          ; 霧の上限（昼は 65%＝遠くの木が空に溶けて透けて見えないように、夜は 100%）
  nop
  slt t2, t0, t1
  bnez t2, @f0c
  nop
  move t0, t1
@f0c:
  slti t7, a1, LODZ
  beqz t7, @flat
  nop
  ; ---- 近い: 模様つきの四角（0x2C）。色の倍率をチャンネルごとに決めて、明るさと霧を一度に ----
  ;   ねらい = 平均 × 明るさ / 128 ×（1 − t）+ 霧の色 × t、倍率 = ねらい × 128 / 平均（255 まで）
  ;   遠くの一色（平均 × 明るさを DPCS で霧へ）と同じ式なので、切りかわりで絵が飛ばない
  ; 倍率は表から（模様 × 向き × 霧の 17 段。data.mjs で、遠くの一色と同じ式で作ってある）
  li t6, 11
  bne t5, t6, @lit
  lw t6, V_MODB(gp)          ; この段の表
  la t6, modtab              ; たき火は自分で光る（昼の明るさの表のまま）
@lit:
  li t7, 6
  mult a2, t7
  mflo t7
  addu t7, t7, t4            ; 模様 × 6 + 向き
  sll t8, t7, 4
  addu t7, t8, t7            ; × 17
  srl t8, t0, 8
  addu t7, t7, t8            ; + 霧の段
  sll t7, t7, 4              ; × 4 段の陰 × 4 バイト
  addu t0, t6, t7            ; t0 = この面の陰 0 の場所（陰 c は +4c）
  lw t4, 0(t0)
  nop
  ; uv（裏返しつき・CLUT とページ入り）は表から: uvtab + 模様 × 64 + 裏返し × 16 → TL・TR・BL・BR
  la t1, uvtab
  sll t2, a2, 6
  addu t1, t1, t2
  srl t2, t9, 4
  andi t2, t2, 0x30
  addu t1, t1, t2
  lw t5, 12(t1)
  lw t3, 8(t1)
  lw t2, 4(t1)
  lw t1, 0(t1)
  nop
  andi t6, t9, 255
  beqz t6, @noao
  slti t6, a1, AOZ            ; すみの陰は近い面だけ（遠くでは見えないので、速さのため）
  bnez t6, @ao
  nop
@noao:
  lui t8, 0x2c00             ; 陰なし: 模様つきの四角（0x2C）
  or t7, t4, t8
  sw t7, 4(s2)
  sw t1, 12(s2)
  sw t2, 20(s2)
  sw t3, 28(s2)
  sw t5, 36(s2)
  lui v1, 0x0900             ; 語 9 つ
  li a0, 40
  b @link
  nop
@ao:
  ; 陰あり: グーローの模様つき四角（0x3C）。点を 8・16・24・32 → 8・20・32・44 へ
  lw t7, 32(s2)
  lw t8, 24(s2)
  lw v0, 16(s2)
  sw t7, 44(s2)
  sw t8, 32(s2)
  sw v0, 20(s2)
  sw t1, 12(s2)
  sw t2, 24(s2)
  sw t3, 36(s2)
  sw t5, 48(s2)
  ; 4 すみの色は表から（陰の段 c → t0 + 4c）
  andi t7, t9, 3
  sll t7, t7, 2
  addu t7, t0, t7
  lw t7, 0(t7)
  srl t8, t9, 2
  sw t7, 4(s2)
  andi t8, t8, 3
  sll t8, t8, 2
  addu t8, t0, t8
  lw t8, 0(t8)
  srl t7, t9, 4
  sw t8, 16(s2)
  andi t7, t7, 3
  sll t7, t7, 2
  addu t7, t0, t7
  lw t7, 0(t7)
  srl t8, t9, 6
  sw t7, 28(s2)
  andi t8, t8, 3
  sll t8, t8, 2
  addu t8, t0, t8
  lw t8, 0(t8)
  nop
  sw t8, 40(s2)
  lw t7, 4(s2)
  lui t8, 0x3c00
  or t7, t7, t8
  sw t7, 4(s2)
  lui v1, 0x0c00             ; 語 12
  li a0, 52
  b @link
  nop
@flat:
  ; ---- 遠い: 霧にまぜた一色の四角（0x28）。色 = 模様の平均 × 明るさ を、遠さの割合で霧の色へ（GTE の DPCS）----
  li t6, 11                  ; たき火は暗くしない
  beq t5, t6, @nolight
  nop
  lw t6, V_LIGHT(gp)
  nop
  mult a3, t6
  mflo a3
  srl a3, a3, 8              ; 向きの明るさ × 段の明るさ
@nolight:
  la t6, texavg
  sll t7, a2, 2
  addu t6, t6, t7
  lw t7, 0(t6)               ; 平均の色
  li v0, 0
  li t8, 0
@sh:
  srlv v1, t7, t8
  andi v1, v1, 255
  mult v1, a3
  mflo v1
  srl v1, v1, 7
  sllv v1, v1, t8
  or v0, v0, v1
  addiu t8, t8, 8
  slti v1, t8, 24
  bnez v1, @sh
  nop
  lui v1, 0x2800
  or v0, v0, v1
  mtc2 v0, 6                 ; RGBC
  mtc2 t0, 8                 ; IR0 = 霧の割合（近い面と同じ t）
  nop
  cop2 0x0780010             ; DPCS（sf）
  nop
  swc2 22, 4(s2)             ; 色と命令
  ; 点を詰める（模様の荷物の場所 8・16・24・32 → 8・12・16・20）
  lw t7, 16(s2)
  lw t8, 24(s2)
  lw v0, 32(s2)
  sw t7, 12(s2)
  sw t8, 16(s2)
  sw v0, 20(s2)
  lui v1, 0x0500             ; 語 5 つ
  li a0, 24
@link:
  srl t7, a1, 4              ; 並べ表の番号
  slti t8, t7, OTN
  bnez t8, @ok
  nop
  li t7, OTN - 1
@ok:
  la t8, ot
  sll t7, t7, 2
  addu t7, t8, t7
  lw t8, 0(t7)
  li v0, 0x00ffffff
  and t8, t8, v0
  or t8, t8, v1
  sw t8, 0(s2)
  and t8, s2, v0
  sw t8, 0(t7)
  addu s2, s2, a0
  addiu s3, s3, 1
  slti t7, s3, MAXDRAW
  beqz t7, @done
  nop
@skip:
  addiu s1, s1, -1
  bnez s1, @face
  nop
@nextdir:
  lw t8, 40(sp)
  nop
  addiu t8, t8, 1
  sw t8, 40(sp)
  slti t0, t8, 6
  bnez t0, @dir
  nop
@nextchunk:
  lw t9, 32(sp)
  nop
  addiu t9, t9, 1
  slti t0, t9, 16
  bnez t0, @chunk
  nop
@done:
  jal drawcrits              ; 夜の生き物（同じ並べ表へ）
  nop
  sw s3, V_NFACE(gp)
  la t0, ot + (OTN - 1) * 4
  sw t0, D2MADR(s7)
  sw zero, D2BCR(s7)
  li t0, 0x01000401
  sw t0, D2CHCR(s7)
@dma:
  lw t0, D2CHCR(s7)
  li t1, 0x01000000
  and t0, t0, t1
  bnez t0, @dma
  nop
  jal smoke
  nop
  jal outline
  nop
  jal hud
  nop
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  lw s3, 16(sp)
  lw s4, 20(sp)
  lw s5, 24(sp)
  lw fp, 28(sp)
  jr ra
  addiu sp, sp, 48

; チャンクを、カメラから近い順に corder へ（16 こ。差しこみで並べる）
sortchunks:
  lw t4, V_CX(gp)
  lw t5, V_CZ(gp)
  la t6, cdist
  la t7, corder
  li t9, 0
@d:
  andi t0, t9, 3
  sll t0, t0, 11
  addiu t0, t0, 1024
  srl t1, t9, 2
  sll t1, t1, 11
  addiu t1, t1, 1024
  subu t0, t0, t4
  subu t1, t1, t5
  sra t0, t0, 8
  sra t1, t1, 8
  mult t0, t0
  mflo t2
  mult t1, t1
  mflo t3
  addu t2, t2, t3            ; 距離の 2 乗
  ; 差しこみ: うしろから、自分より遠いものを 1 つずつずらす
  move t8, t9
@ins:
  beqz t8, @put
  nop
  addiu t0, t8, -1
  sll t1, t0, 2
  addu t1, t6, t1
  lw t3, 0(t1)
  nop
  slt t3, t2, t3
  beqz t3, @put
  nop
  lw t3, 0(t1)
  addu a0, t7, t0
  sw t3, 4(t1)               ; 距離を 1 つうしろへ
  lbu a1, 0(a0)
  nop
  sb a1, 1(a0)               ; 番号も
  b @ins
  move t8, t0
@put:
  sll t1, t8, 2
  addu t1, t6, t1
  sw t2, 0(t1)
  addu a0, t7, t8
  sb t9, 0(a0)
  addiu t9, t9, 1
  slti t0, t9, 16
  bnez t0, @d
  nop
  jr ra
  nop

; 空と海: 地平線の高さ = H × tan（上下の角度）。上は青から霧の色、下は霧の色から深い海の色
sky:
  move t9, ra
  lw a0, V_PIT(gp)
  nop
  sra a0, a0, 8
  jal sincos
  nop
  li t2, 160
  mult t0, t2
  mflo t0
  div t0, t1
  mflo t3                    ; 地平線の y（見上げると下へ）
  li t4, -120
  slt t5, t3, t4
  beqz t5, @h1
  nop
  move t3, t4
@h1:
  li t4, 120
  slt t5, t4, t3
  beqz t5, @h2
  nop
  move t3, t4
@h2:
  sll t3, t3, 16             ; y を上の 16 ビットへ
  ; 空
  lw t0, V_SKYT(gp)          ; 上の色（段ごと）
  lui t1, 0x3800
  or t1, t1, t0
  sw t1, GP0(s7)
  li t1, 0xff88ff60
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  li t1, 0xff8800a0
  sw t1, GP0(s7)
  lw t0, V_FOGRGB(gp)
  nop
  sw t0, GP0(s7)
  li t1, 0xff60
  or t1, t1, t3
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  ori t1, t3, 0x00a0
  sw t1, GP0(s7)
  ; 海
  lw t0, V_FOGRGB(gp)
  li t1, 0x38000000
  or t1, t1, t0
  sw t1, GP0(s7)
  li t1, 0xff60
  or t1, t1, t3
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  ori t1, t3, 0x00a0
  sw t1, GP0(s7)
  lw t0, V_SEA(gp)           ; 手前の海の色（段ごと）
  nop
  sw t0, GP0(s7)
  li t1, 0x0078ff60
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  li t1, 0x007800a0
  sw t1, GP0(s7)
  lw t0, V_WIN(gp)
  nop
  beqz t0, @noship
  nop
  sra t8, t3, 16             ; 水平線の y
  lw a0, V_YAW(gp)
  li t0, SHIPYAW
  srl a0, a0, 8
  subu a0, t0, a0
  andi a0, a0, 255
  slti t0, a0, 128
  bnez t0, @sd
  nop
  addiu a0, a0, -256
@sd:
  slti t0, a0, 40            ; 見ている向きから ±56° の中だけ
  beqz t0, @noship
  nop
  slti t0, a0, -39
  bnez t0, @noship
  nop
  andi a0, a0, 255
  jal sincos
  nop
  li t2, 160
  mult t0, t2
  mflo t0
  div t0, t1
  mflo t7                    ; 船の x
  lw t5, V_WINT(gp)
  nop
  srl t5, t5, 8
  addiu t5, t5, 2
  slti t0, t5, 8
  bnez t0, @ss
  nop
  li t5, 8                   ; 大きさ s（2 → 8）
@ss:
  li t0, 3                   ; 船体: 幅 6s・高さ s
  mult t5, t0
  mflo t0
  subu t1, t7, t0
  andi t1, t1, 0xffff
  subu t2, t8, t5
  sll t2, t2, 16
  or a0, t1, t2
  sll t0, t0, 1
  sll t1, t5, 16
  or a1, t0, t1
  li a2, 0x60283040
  sw a2, GP0(s7)
  sw a0, GP0(s7)
  sw a1, GP0(s7)
  srl t0, t5, 1              ; 帆: 幅 s・高さ 3s
  subu t1, t7, t0
  andi t1, t1, 0xffff
  sll t0, t5, 2
  subu t2, t8, t0
  sll t2, t2, 16
  or a0, t1, t2
  li t0, 3
  mult t5, t0
  mflo t0
  sll t0, t0, 16
  or a1, t0, t5
  li a2, 0x60d8e0e8
  sw a2, GP0(s7)
  sw a0, GP0(s7)
  sw a1, GP0(s7)
@noship:
  jr t9
  nop

; ねらったブロックの面のふち（白い線。掘っているあいだは、だいだいへ）
outline:
  lw t0, V_TGT(gp)
  nop
  bltz t0, @no
  nop
  andi t1, t0, 31            ; x
  srl t2, t0, 5
  andi t2, t2, 31            ; z
  srl t3, t0, 10             ; y
  lw t4, V_TGTF(gp)
  lw t5, V_CX(gp)
  sll t1, t1, 8
  subu t1, t1, t5
  lw t5, V_EY(gp)
  sll t3, t3, 8
  subu t3, t5, t3
  lw t5, V_CZ(gp)
  sll t2, t2, 8
  subu t2, t2, t5
  la t6, corners
  sll t7, t4, 3
  sll t8, t4, 4
  addu t7, t7, t8
  addu t6, t6, t7
  la a3, linebuf
  li a2, 4
@c:
  lh t7, 0(t6)
  lh t8, 2(t6)
  lh a0, 4(t6)
  addu t7, t1, t7
  subu t8, t3, t8
  addu a0, t2, a0
  andi t7, t7, 0xffff
  sll t8, t8, 16
  or t7, t7, t8
  mtc2 t7, 0
  mtc2 a0, 1
  nop
  cop2 0x0180001             ; RTPS
  mfc2 t7, 19
  nop
  slti t7, t7, NEAR / 2
  bnez t7, @no
  nop
  swc2 14, 0(a3)
  addiu a3, a3, 4
  addiu t6, t6, 6
  addiu a2, a2, -1
  bnez a2, @c
  nop
  ; 掘っている途中なら、ひびの模様（3 段）を面に重ねる
  lw t0, V_DIGP(gp)
  lw t1, V_DIGI(gp)
  blez t0, @nocrack
  nop
  lw t2, V_TGT(gp)
  nop
  bne t1, t2, @nocrack
  nop
  la t3, world
  addu t3, t3, t2
  lbu t3, 0(t3)
  la t4, hardness
  addu t4, t4, t3
  lbu t4, 0(t4)
  li t5, 3
  beqz t4, @nocrack
  nop
  mult t0, t5
  mflo t5
  div t5, t4
  mflo t5                    ; 段 = 掘りぐあい × 3 ÷ かたさ
  slti t6, t5, 3
  bnez t6, @cs
  nop
  li t5, 2
@cs:
  addiu t5, t5, 12           ; ひびの模様の番号
  la a3, linebuf
  li t6, 0x2e808080          ; 半透明の模様つき四角（ひびの色はほぼ黒と半分ずつまぜる＝下の面が半分の明るさに）
  sw t6, GP0(s7)
  lw t7, 0(a3)
  nop
  sw t7, GP0(s7)
  sll t6, t5, 4              ; u
  addiu t7, t5, 20
  ori t7, t7, 240 << 6       ; CLUT
  sll t7, t7, 16
  or t7, t7, t6
  sw t7, GP0(s7)
  lw t7, 4(a3)
  nop
  sw t7, GP0(s7)
  addiu t7, t6, 15
  lui t8, TPAGE              ; ページ＋半透明の形 0（半分ずつ）
  or t7, t7, t8
  sw t7, GP0(s7)
  lw t7, 8(a3)
  nop
  sw t7, GP0(s7)
  ori t7, t6, 15 << 8
  sw t7, GP0(s7)
  lw t7, 12(a3)
  nop
  sw t7, GP0(s7)
  addiu t7, t6, 15
  ori t7, t7, 15 << 8
  sw t7, GP0(s7)
@nocrack:
  li t1, 0x48e8f0f8          ; ふちは白いまま
  sw t1, GP0(s7)
  la a3, linebuf
  lw t0, 0(a3)               ; 左上 → 右上 → 右下 → 左下 → 左上
  lw t1, 4(a3)
  lw t2, 12(a3)
  lw t3, 8(a3)
  sw t0, GP0(s7)
  sw t1, GP0(s7)
  sw t2, GP0(s7)
  sw t3, GP0(s7)
  sw t0, GP0(s7)
  li t0, 0x55555555
  sw t0, GP0(s7)
@no:
  jr ra
  nop

; ねらいの印（4 つの点）・置けなかった ×・持ち物の札（ブロック 2〜8: 土・石・砂・幹・葉・板・黒曜石）
;   腰袋: 持っている物だけを左下にたてに積む（元のゲームの下の横の列にしない）。札は角を落とした四角、選んでいる札だけ 4 点右へ出て明るい。数は絵の下のまん中
hud:
  addiu sp, sp, -24          ; 16 = いちばん上の札の y・20 = s3
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 20(sp)
  li a2, 0x60f0f0f0          ; ねらいの印: まわりに 2×2 の点を 4 つ、まん中に 1 点
  li a1, 0x00020002
  li a0, 0xfffbfffb          ; (−5, −5)
  bal rect
  nop
  li a0, 0xfffb0004          ; (4, −5)
  bal rect
  nop
  li a0, 0x0004fffb          ; (−5, 4)
  bal rect
  nop
  li a0, 0x00040004          ; (4, 4)
  bal rect
  nop
  li a1, 0x00010001
  li a0, 0
  bal rect
  nop
  ; 置けなかった: 十字の所に赤い ×（少しのあいだ）
  lw t0, V_DENY(gp)
  nop
  blez t0, @nodeny
  nop
  li t1, 0x404050f0
  li t2, 0xfff9fff9          ; (−7, −7) → (7, 7)
  li t3, 0x00070007
  li t4, 0xfff90007          ; (7, −7) → (−7, 7)
  li t5, 0x0007fff9
  li t6, 1
@dl:
  sw t1, GP0(s7)
  sw t2, GP0(s7)
  sw t3, GP0(s7)
  sw t1, GP0(s7)
  sw t4, GP0(s7)
  sw t5, GP0(s7)
  addiu t2, t2, 1            ; となりにもう 1 本（太く）
  addiu t3, t3, 1
  addiu t4, t4, 1
  addiu t5, t5, 1
  bnez t6, @dl
  addiu t6, t6, -1
@nodeny:
  lw t0, V_UPF(gp)           ; のろしを低い所に置いた: ねらいの上に ▲
  nop
  blez t0, @noupf
  nop
  li a2, 0x6040b0f0
  li a0, 0xfff00000          ; (0, −16)
  li a1, 0x00010001
  bal rect
  nop
  li a0, 0xfff1ffff
  li a1, 0x00010003
  bal rect
  nop
  li a0, 0xfff2fffe
  li a1, 0x00010005
  bal rect
  nop
  li a0, 0xfff3fffd
  li a1, 0x00010007
  bal rect
  nop
@noupf:
  lw t0, V_TGT(gp)           ; 夜にたき火をねらっている: ねらいの右上に月（X で休める）
  la t1, world
  bltz t0, @nomoon
  addu t1, t1, t0
  lbu t1, 0(t1)
  li t2, 11
  bne t1, t2, @nomoon
  nop
  lw t1, V_LVL(gp)
  nop
  slti t1, t1, 4
  bnez t1, @nomoon
  nop
  li a2, 0x60e0d8c8
  li a0, 0xfff70009          ; (9, −9)
  li a1, 0x00040006
  bal rect
  nop
  li a0, 0xfff6000a
  li a1, 0x00060004
  bal rect
  nop
@nomoon:
  lw t0, V_CRABN(gp)         ; ヤシガニが近い: ねらいの右に [B] の札
  nop
  beqz t0, @nob
  nop
  li a2, 0x60c8dcd8
  li a0, 0xfffd000c          ; (12, −3)
  li a1, 0x000b000b
  bal rect
  nop
  la a0, strb
  li a1, 15
  li a2, -1
  li a3, 0x00283038
  li t0, 1
  sw t0, V_SCL(gp)
  jal text
  nop
@nob:
  li t0, 0xe100020a          ; スプライトは模様のページで（ディザも）
  sw t0, GP0(s7)
  ; 腰袋: 持っている物だけを、左下にたてに積む（上から ブロックの番号の順。いちばん下の札の上が y = 82）
  la t0, inv                 ; 持っている種類の数 → いちばん上の札の y
  li t1, 2
  li t2, 0
@cnt:
  addu t3, t0, t1
  lbu t3, 0(t3)
  addiu t1, t1, 1
  beqz t3, @cn
  slti t4, t1, 13
  addiu t2, t2, 1
@cn:
  bnez t4, @cnt
  nop
  bnez t2, @some
  nop
  ; 何も持っていない: 空の札の枠を 1 つ
  li a2, 0x62909090
  li a0, 0x0052ff69          ; (−151, 82)
  li a1, 0x00010012          ; 上
  bal rect
  nop
  li a0, 0x006dff69          ; 下 (−151, 109)
  bal rect
  nop
  li a0, 0x0053ff68          ; 左 (−152, 83)
  li a1, 0x001a0001
  bal rect
  nop
  li a0, 0x0053ff7b          ; 右 (−133, 83)
  bal rect
  nop
  b @pdone
  nop
@some:
  slti t3, t2, 7             ; 6 枚をこえたら 2 列目へ（高さは 6 枚まで）
  bnez t3, @le6
  nop
  li t2, 6
@le6:
  li t3, 30                  ; 札の間
  mult t2, t3
  mflo t3
  li t4, 112
  subu t4, t4, t3            ; いちばん上の札の y（82 − (数 − 1) × 30）
  sw t4, 16(sp)
  li s3, 0                   ; 何枚目
  li s0, 2
@slot:
  la t4, inv
  addu t4, t4, s0
  lbu t4, 0(t4)
  nop
  beqz t4, @next
  nop
  li s2, -152                ; 札の左の x（2 列目は 24 点右。選んでいる札は 4 点右へ出て明るい）
  move t1, s3
  slti t0, s3, 6
  bnez t0, @c0
  nop
  li s2, -126
  addiu t1, s3, -6
@c0:
  li t0, 30
  mult t1, t0
  mflo t1
  lw t0, 16(sp)
  nop
  addu s1, t0, t1
  lw t0, V_SEL(gp)
  li a2, 0x62202020
  bne t0, s0, @bg
  nop
  addiu s2, s2, 4
  li a2, 0x60c8dcd8
@bg:
  ; 角を落とした札（20 × 28）: 横長の四角とたて長の四角を重ねる
  addiu t2, s1, 1
  sll t2, t2, 16
  andi t3, s2, 0xffff
  or a0, t2, t3
  li a1, 0x001a0014          ; 20 × 26
  bal rect
  nop
  addiu t3, s2, 1
  andi t3, t3, 0xffff
  sll t1, s1, 16
  or a0, t1, t3
  li a1, 0x001c0012          ; 18 × 28
  bal rect
  nop
  ; ブロックの絵（16×16 のスプライト）
  li t1, 0x7c808080
  sw t1, GP0(s7)
  addiu t2, s2, 2
  andi t2, t2, 0xffff
  addiu t3, s1, 2
  sll t3, t3, 16
  or t2, t2, t3
  sw t2, GP0(s7)
  la t5, icontab
  addu t5, t5, s0
  lbu t5, 0(t5)
  jal spruv
  nop
  sw v0, GP0(s7)
  ; 数は絵の下のまん中に（1 けたは 8 点、2 けたは 5 点右から）
  lw t0, V_SEL(gp)
  move a0, t4
  addiu a1, s2, 8
  slti t1, t4, 10
  bnez t1, @one
  nop
  addiu a1, s2, 5
@one:
  addiu a2, s1, 20
  li a3, 0x00f8f8f8
  bne t0, s0, @wc
  nop
  li a3, 0x00283038          ; 明るい札の上は暗い字
@wc:
  li t0, 1
  sw t0, V_SCL(gp)
  jal num
  nop
  addiu s3, s3, 1
@next:
  addiu s0, s0, 1
  slti t0, s0, 13
  bnez t0, @slot
  nop
@pdone:
  ; ---- 上のまん中: 何日目（昼は太陽・夜は月の丸と、数）----
  lw t0, V_LVL(gp)
  li a2, 0x6040c8f0          ; 太陽
  slti t0, t0, 4
  bnez t0, @sun
  nop
  li a2, 0x60e0d8c8          ; 月
@sun:
  li a0, 0xff8dfff0          ; 角を落とした丸（7 × 5 と 5 × 7）
  li a1, 0x00050007
  bal rect
  nop
  li a0, 0xff8cfff1
  li a1, 0x00070005
  bal rect
  nop
  lw a0, V_DAY(gp)
  li a1, -6
  li a2, -116
  li a3, 0x00f8f8f8
  li t0, 1
  sw t0, V_SCL(gp)
  jal num
  nop
  lw t0, V_LVL(gp)           ; 子ガメ: 左上に、出た数だけの小さなこうら（守れた子は緑）。夜と、朝のあと少しのあいだ
  lw t1, V_TSHOW(gp)
  slti t0, t0, 7
  beqz t0, @tsh
  nop
  blez t1, @notur
  nop
@tsh:
  lw t2, V_TSPAWN(gp)
  li s0, 0
@tu:
  slt t0, s0, t2
  beqz t0, @notur
  nop
  lw t1, V_TSAVE(gp)
  li a2, 0x62707070          ; まだの子: うすい灰（半透明）
  slt t1, s0, t1
  beqz t1, @tg
  nop
  li a2, 0x6070d060          ; 守れた子: 緑（上に白い点も）
@tg:
  sll t0, s0, 3
  sll t1, s0, 1
  addu t0, t0, t1            ; 10 点ごと
  addiu t0, t0, -150
  andi t0, t0, 0xffff
  li t1, 0xff8e0000          ; y = −114
  or a0, t0, t1
  li a1, 0x00040008
  sw t2, 16(sp)
  bal rect
  nop
  addiu a0, a0, 1             ; 右へ 1・上へ 1（丸く見せる）
  li a1, 0x00060006
  lui t0, 0xffff
  addu a0, a0, t0
  bal rect
  nop
  lw t1, V_TSAVE(gp)
  nop
  slt t1, s0, t1
  beqz t1, @nodot
  nop
  addiu a0, a0, 2            ; 守れた子のしるし（白い点）
  li a1, 0x00020002
  li a2, 0x60f0f0f0
  bal rect
  nop
@nodot:
  lw t2, 16(sp)
  addiu s0, s0, 1
  b @tu
  nop
@notur:
  lw t0, V_CRAFT(gp)         ; 作る帯
  nop
  beqz t0, @nocraft
  nop
  jal crafthud
  nop
  b @hdone
  nop
@nocraft:
  ; ---- いまやることの札（下のまん中に 1 つだけ。中身はそのときやることに替える）----
  ;   のろしを持っている → のろしの絵と ▲（いまの高さが頂上と同じなら緑）
  ;   幹があり、作る帯を開いたことがない → [SELECT の形] [板]
  ;   夕方・夜で、たき火を作れるのに持っていない → [SELECT の形] [たき火]
  la t1, inv
  lbu t0, 12(t1)
  nop
  beqz t0, @h2
  nop
  li t1, 0x7c808080          ; のろしの絵
  sw t1, GP0(s7)
  li t1, 0x005cffec          ; (−20, 92)
  sw t1, GP0(s7)
  li t5, 20
  jal spruv
  nop
  sw v0, GP0(s7)
  lw t0, V_CY(gp)            ; ▲: 足もとの高さが頂上の高さなら緑、まだなら白
  li a2, 0x60e0e0e0
  sra t0, t0, 8
  slti t0, t0, SUMMIT
  bnez t0, @tri
  nop
  li a2, 0x6060e070
@tri:
  li a0, 0x00600006          ; (6, 96) から 1・3・5・7 点の横線で ▲
  li a1, 0x00010001
  bal rect
  nop
  li a0, 0x00610005
  li a1, 0x00010003
  bal rect
  nop
  li a0, 0x00620004
  li a1, 0x00010005
  bal rect
  nop
  li a0, 0x00630003
  li a1, 0x00010007
  bal rect
  nop
  li a0, 0x00640005          ; ▲ の柱
  li a1, 0x00040003
  bal rect
  nop
  b @hdone
  nop
@h2:
  lw t0, V_SEEN(gp)
  lbu t2, 5(t1)
  bnez t0, @h3
  nop
  beqz t2, @h3
  nop
  li t5, 8                   ; 板
  b @hsel
  nop
@h3:
  lw t0, V_LVL(gp)
  lbu t2, 11(t1)             ; たき火を持っているか
  beqz t0, @hdone            ; 昼は出さない
  nop
  bnez t2, @hdone
  nop
  li a0, 1
  jal cancraft
  nop
  beqz v0, @hdone
  nop
  li t5, 16                  ; たき火
@hsel:
  ; [SELECT の形] → [できる物]（ボタンは左・結果は右）。ゆっくり点滅し、消えている間もうすく残す
  lw t0, V_BLINK(gp)
  li a2, 0x60c8c8c8
  andi t0, t0, 64
  bnez t0, @hb
  nop
  li a2, 0x62707070
@hb:
  li a0, 0x0061ffe8          ; (−24, 97) 細長い丸い札
  li a1, 0x00060010
  bal rect
  nop
  li a0, 0x0060ffe9
  li a1, 0x0008000e
  bal rect
  nop
  lw t0, V_BLINK(gp)
  li t1, 0x7c808080
  andi t0, t0, 64
  bnez t0, @hb2
  nop
  li t1, 0x7c505050
@hb2:
  sw t1, GP0(s7)
  li t1, 0x005c0000          ; (0, 92)
  sw t1, GP0(s7)
  jal spruv
  nop
  sw v0, GP0(s7)
@hdone:
  ; ---- セーブの印: 右上にカード（書いている間は点滅・書けなかったら赤い ×）----
  lw t0, V_SAVET(gp)
  nop
  beqz t0, @nocard
  nop
  bltz t0, @cbad
  nop
  lw t1, V_BLINK(gp)
  nop
  andi t1, t1, 16
  beqz t1, @nocard
  nop
@cbad:
  li a0, 136
  li a1, -116
  jal cardicon
  nop
  lw t0, V_SAVET(gp)
  nop
  bgez t0, @nocard
  nop
  li t1, 0x404050f0          ; 書けなかった: 赤い ×
  sw t1, GP0(s7)
  li t1, 0xff8b0084          ; (132, −117) → (150, −101)
  sw t1, GP0(s7)
  li t1, 0xff9b0096
  sw t1, GP0(s7)
  li t1, 0x404050f0
  sw t1, GP0(s7)
  li t1, 0xff8b0096
  sw t1, GP0(s7)
  li t1, 0xff9b0084
  sw t1, GP0(s7)
@nocard:
  ; ---- はじめの画面: [カード・何日目]（つづき）と [草のブロック]（あたらしく）。選んでいる方は白い太わくと「A」----
  lw t0, V_MODE(gp)
  nop
  beqz t0, @nomode
  nop
  li a2, 0x62101010
  li a0, 0xffdcff9c          ; (−100, −36)
  li a1, 0x004800c8          ; 200 × 72
  bal rect
  nop
  li s0, 0
@mt:
  sll t0, s0, 6
  sll t1, s0, 3
  addu t0, t0, t1            ; 72 ごと
  addiu s1, t0, -76          ; 札の左
  lw t0, V_MSEL(gp)
  nop
  bne t0, s0, @mtb
  nop
  li a2, 0x60f0f0f0
  addiu t3, s1, -2
  andi t3, t3, 0xffff
  li t2, 0xffe00000          ; y = −32
  or a0, t2, t3
  li a1, 0x00360040          ; 64 × 54
  bal rect
  nop
  li a2, 0x60c8dcd8          ; 「A」の札
  addiu t3, s1, 26
  andi t3, t3, 0xffff
  li t2, 0x00180000          ; y = 24
  or a0, t2, t3
  li a1, 0x000b000c
  bal rect
  nop
  la a0, stra
  addiu a1, s1, 30
  li a2, 26
  li a3, 0x00283038
  li t0, 1
  sw t0, V_SCL(gp)
  jal text
  nop
@mtb:
  li a2, 0x60282828
  andi t3, s1, 0xffff
  li t2, 0xffe20000          ; y = −30
  or a0, t2, t3
  li a1, 0x0032003c          ; 60 × 50
  bal rect
  nop
  bnez s0, @mnew
  nop
  addiu a0, s1, 8            ; つづき: カードと、その日の数
  li a1, -22
  jal cardicon
  nop
  lw a0, V_SDAY(gp)
  addiu a1, s1, 26
  li a2, -20
  li a3, 0x00f8f8f8
  li t0, 2
  sw t0, V_SCL(gp)
  jal num
  nop
  b @mnx
  nop
@mnew:
  li t1, 0x7c808080          ; あたらしく: 草のブロックの絵（大きく 2 つ）
  sw t1, GP0(s7)
  addiu t2, s1, 14
  andi t2, t2, 0xffff
  li t3, 0xffe60000          ; y = −26
  or t2, t2, t3
  sw t2, GP0(s7)
  li t5, 1
  jal spruv
  nop
  sw v0, GP0(s7)
  li t1, 0x7c808080
  sw t1, GP0(s7)
  addiu t2, s1, 30
  andi t2, t2, 0xffff
  li t3, 0xffe60000
  or t2, t2, t3
  sw t2, GP0(s7)
  li t5, 0
  jal spruv
  nop
  sw v0, GP0(s7)
  li a2, 0x6060e070          ; 芽（あたらしい島）
  addiu t3, s1, 28
  andi t3, t3, 0xffff
  li t2, 0xfffa0000          ; y = −6
  or a0, t2, t3
  li a1, 0x00080002
  bal rect
  nop
  addiu t3, s1, 24
  andi t3, t3, 0xffff
  li t2, 0xfff80000
  or a0, t2, t3
  li a1, 0x00020004
  bal rect
  nop
  addiu t3, s1, 30
  andi t3, t3, 0xffff
  li t2, 0xfff60000
  or a0, t2, t3
  li a1, 0x00020004
  bal rect
  nop
@mnx:
  addiu s0, s0, 1
  slti t0, s0, 2
  bnez t0, @mt
  nop
@nomode:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  lw s3, 20(sp)
  jr ra
  addiu sp, sp, 24

; カードの絵（10 × 13）: a0 = x、a1 = y。白い札・右上の欠け・青いラベル
cardicon:
  move t9, ra
  andi a0, a0, 0xffff
  sll a1, a1, 16
  or t8, a0, a1
  li a2, 0x60d8d8d8
  move a0, t8
  li a1, 0x000d000a
  bal rect
  nop
  li a2, 0x60303030
  addiu a0, t8, 7
  li a1, 0x00030003
  bal rect
  nop
  li a2, 0x60e0a060
  lui t0, 5
  addu a0, t8, t0
  addiu a0, a0, 2
  li a1, 0x00040006
  bal rect
  nop
  jr t9
  nop

; t5 = 模様の番号 → v0 = スプライトの uv と CLUT の語（2 段の模様にも）
spruv:
  andi v0, t5, 15
  sll v0, v0, 4              ; u
  srl t7, t5, 4
  sll t7, t7, 12             ; v（16 点 × 段）<< 8
  or v0, v0, t7
  addiu t7, t5, 20
  ori t7, t7, 240 << 6       ; CLUT
  sll t7, t7, 16
  jr ra
  or v0, v0, t7

; 作る帯: 下のまん中に 4 品（板・たき火・火山ガラスの刃・のろし）。絵の下に材料の小さな絵と数（足りなければ赤）
;   作れる物は明るく、作れない物は暗く。選んでいる札は明るい地で 4 点上
crafthud:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
  li a2, 0x62101010          ; 帯の下じき
  li a0, 0x0032ff98          ; (−104, 50)
  li a1, 0x004600d0          ; 208 × 70
  bal rect
  nop
  li s0, 0
@r:
  move a0, s0
  jal cancraft
  nop
  move s3, v0                ; 作れるか
  sll t0, s0, 5
  sll t1, s0, 4
  addu t0, t0, t1
  addiu s1, t0, -100         ; 札の左の x（48 ごと）
  lw t0, V_CSEL(gp)
  li s2, 56                  ; 札の上の y
  bne t0, s0, @rb
  nop
  li a2, 0x60f0f0f0          ; 選んでいる札: 白い太わく（2 点）と、下に「A」の札
  addiu t2, s2, -2
  sll t2, t2, 16
  addiu t3, s1, -2
  andi t3, t3, 0xffff
  or a0, t2, t3
  li a1, 0x00320030          ; 48 × 50
  bal rect
  nop
  li a2, 0x60c8dcd8
  addiu t2, s2, 50
  sll t2, t2, 16
  addiu t3, s1, 16
  andi t3, t3, 0xffff
  or a0, t2, t3
  li a1, 0x000b000c          ; 12 × 11
  bal rect
  nop
  la a0, stra
  addiu a1, s1, 20
  addiu a2, s2, 52
  li a3, 0x00283038
  li t0, 1
  sw t0, V_SCL(gp)
  jal text
  nop
@rb:
  li a2, 0x60282828
  addiu t2, s2, 1            ; 角を落とした札（44 × 46）
  sll t2, t2, 16
  andi t3, s1, 0xffff
  or a0, t2, t3
  li a1, 0x002c002c
  bal rect
  nop
  addiu t3, s1, 1
  andi t3, t3, 0xffff
  sll t2, s2, 16
  or a0, t2, t3
  li a1, 0x002e002a
  bal rect
  nop
  ; できる物の絵（作れなければ暗く）
  la t0, recipes
  sll t1, s0, 3
  addu t0, t0, t1
  lbu t5, 0(t0)
  li t1, 0x7c808080
  bnez s3, @rl
  nop
  li t1, 0x7c383838
@rl:
  sw t1, GP0(s7)
  addiu t2, s1, 14
  andi t2, t2, 0xffff
  addiu t3, s2, 4
  sll t3, t3, 16
  or t2, t2, t3
  sw t2, GP0(s7)
  la t1, icontab
  addu t1, t1, t5
  lbu t5, 0(t1)
  jal spruv
  nop
  sw v0, GP0(s7)
  ; できる数（2 つ以上なら、絵の右に）
  la t0, recipes
  sll t1, s0, 3
  addu t0, t0, t1
  lbu a0, 1(t0)
  nop
  slti t1, a0, 2
  bnez t1, @n1
  nop
  addiu a1, s1, 31            ; できる数は絵の右下に
  addiu a2, s2, 14
  li a3, 0x00f8f8f8
  li t0, 1
  sw t0, V_SCL(gp)
  jal num
  nop
@n1:
  ; 材料 2 つ: 8 × 8 の小さな絵と数
  li s3, 0
@ing:
  la t0, recipes
  sll t1, s0, 3
  addu t0, t0, t1
  sll t1, s3, 1
  addu t0, t0, t1
  lbu t4, 2(t0)              ; 材料
  lbu t6, 3(t0)              ; 数
  beqz t4, @ingn
  nop
  sw t6, 20(sp)
  li t1, 0x74808080
  sw t1, GP0(s7)
  li t1, 21
  mult s3, t1
  mflo t1
  addu t2, s1, t1
  addiu t2, t2, 4
  andi t2, t2, 0xffff
  addiu t3, s2, 28
  sll t3, t3, 16
  or t2, t2, t3
  sw t2, GP0(s7)
  la t1, icontab
  addu t1, t1, t4
  lbu t5, 0(t1)
  jal spruv
  nop
  sw v0, GP0(s7)
  la t0, recipes             ; 足りるか（足りなければ赤い数）
  sll t1, s0, 3
  addu t0, t0, t1
  sll t1, s3, 1
  addu t0, t0, t1
  lbu t4, 2(t0)
  la t1, inv
  addu t1, t1, t4
  lbu t1, 0(t1)
  lw a0, 20(sp)
  li a3, 0x00f8f8f8
  slt t1, t1, a0
  beqz t1, @ok2
  nop
  li a3, 0x004858f8          ; 足りない数は赤
@ok2:
  li t1, 21
  mult s3, t1
  mflo t1
  addu a1, s1, t1
  addiu a1, a1, 14
  addiu a2, s2, 29
  li t0, 1
  sw t0, V_SCL(gp)
  jal num
  nop
@ingn:
  addiu s3, s3, 1
  slti t0, s3, 2
  bnez t0, @ing
  nop
  addiu s0, s0, 1
  slti t0, s0, 4
  bnez t0, @r
  nop
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  lw s3, 16(sp)
  jr ra
  addiu sp, sp, 24

; のろしの煙: のろしの上に、6 つの灰色の丸（四角）がゆっくりのぼる（GTE で投げて、近いほど大きく）
smoke:
  lw t0, V_WIN(gp)
  nop
  beqz t0, @sx
  nop
  lw t0, V_WINP(gp)
  lw t5, V_CX(gp)
  andi t1, t0, 31
  sll t1, t1, 8
  addiu t1, t1, 128
  subu t1, t1, t5            ; bx
  srl t2, t0, 5
  andi t2, t2, 31
  sll t2, t2, 8
  addiu t2, t2, 128
  lw t5, V_CZ(gp)
  nop
  subu t2, t2, t5            ; bz
  srl t3, t0, 10
  addiu t3, t3, 1
  sll t3, t3, 8              ; のろしの上の高さ
  lw t4, V_BLINK(gp)
  nop
  andi t4, t4, 127           ; のぼる量（0〜127）
  addu t3, t3, t4
  li t6, 0
@pf:
  lw t5, V_EY(gp)
  nop
  subu t5, t5, t3            ; by（下が +）
  mult t6, t6                ; 上ほど風に流れる（x へ 8 × 何番目の 2 乗）
  mflo a3
  sll a3, a3, 3
  addu a3, a3, t1
  andi t7, a3, 0xffff
  sll t5, t5, 16
  or t7, t7, t5
  mtc2 t7, 0
  mtc2 t2, 1
  nop
  cop2 0x0180001             ; RTPS
  mfc2 t7, 19                ; 奥行き
  mfc2 t8, 14                ; 画面の場所
  slti t5, t7, 40
  bnez t5, @pn
  nop
  li t5, 20000
  addiu t9, t6, 3
  mult t5, t9
  mflo t5
  div t5, t7
  mflo t5                    ; 大きさ（遠いほど小さく、上ほど広がる）
  srl t5, t5, 2
  slti t9, t5, 2
  beqz t9, @p1
  nop
  li t5, 2
@p1:
  slti t9, t5, 64
  bnez t9, @p2
  nop
  li t5, 64
@p2:
  srl t9, t5, 1
  sll a0, t9, 16
  or a0, a0, t9
  subu a0, t8, a0            ; 左上（x・y とも大きさの半分だけ）
  sll a1, t5, 16
  or a1, a1, t5
  li a2, 0x62c8c8c8
  sw a2, GP0(s7)
  sw a0, GP0(s7)
  sw a1, GP0(s7)
@pn:
  addiu t3, t3, 140          ; つぎの丸は上へ
  addiu t6, t6, 1
  slti t5, t6, 6
  bnez t5, @pf
  nop
@sx:
  jr ra
  nop

; 四角を 1 つ（a0 = 位置 y << 16 | x、a1 = 大きさ h << 16 | w、a2 = 命令と色）
rect:
  sw a2, GP0(s7)
  sw a0, GP0(s7)
  jr ra
  sw a1, GP0(s7)

; ---- 字（5×7。V_SCL 倍） ----
; a0 = 字の番号の列（0xff で終わり）、a1 = x、a2 = y、a3 = 色
text:
  lw t9, V_SCL(gp)
  li t0, 0x60000000
  or a3, a3, t0
  sll t8, t9, 16
  or t8, t8, t9
@ch:
  lbu t0, 0(a0)
  nop
  li t1, 0xff
  beq t0, t1, @done
  nop
  la t1, font
  sll t2, t0, 3
  subu t2, t2, t0
  addu t1, t1, t2
  move t2, a2
  li t3, 7
@row:
  lbu t4, 0(t1)
  move t5, a1
  li t6, 16
@col:
  and t7, t4, t6
  beqz t7, @off
  nop
  sw a3, GP0(s7)
  sll t7, t2, 16
  andi v1, t5, 0xffff
  or t7, t7, v1
  sw t7, GP0(s7)
  sw t8, GP0(s7)
@off:
  addu t5, t5, t9
  srl t6, t6, 1
  bnez t6, @col
  nop
  addu t2, t2, t9
  addiu t3, t3, -1
  bnez t3, @row
  addiu t1, t1, 1
  sll t0, t9, 2
  addu t0, t0, t9
  addu t0, t0, t9
  addu a1, a1, t0
  b @ch
  addiu a0, a0, 1
@done:
  jr ra
  nop
; a0 = 数 → text（a1・a2・a3 はそのまま）
num:
  la t0, numbuf + 7
  li t1, 0xff
  sb t1, 0(t0)
  li t2, 10
@n:
  divu a0, t2
  mfhi t3
  mflo a0
  addiu t0, t0, -1
  bnez a0, @n
  sb t3, 0(t0)
  b text
  move a0, t0

; ---- 行列（ムネエソの腹あかりと同じ） ----
sincos:                       ; a0 = 角度 → t0 = sin・t1 = cos
  la t2, sintab
  andi t0, a0, 255
  sll t0, t0, 2
  addu t0, t2, t0
  addiu t1, a0, 64
  andi t1, t1, 255
  sll t1, t1, 2
  addu t1, t2, t1
  lw t0, 0(t0)
  lw t1, 0(t1)
  jr ra
  nop
rotx:                         ; [1 0 0; 0 c −s; 0 s c]
  move t9, ra
  jal sincos
  nop
  li t2, 4096
  sh t2, 0(a1)
  sh zero, 2(a1)
  sh zero, 4(a1)
  sh zero, 6(a1)
  sh t1, 8(a1)
  subu t2, zero, t0
  sh t2, 10(a1)
  sh zero, 12(a1)
  sh t0, 14(a1)
  jr t9
  sh t1, 16(a1)
roty:                         ; [c 0 s; 0 1 0; −s 0 c]
  move t9, ra
  jal sincos
  nop
  sh t1, 0(a1)
  sh zero, 2(a1)
  sh t0, 4(a1)
  sh zero, 6(a1)
  li t2, 4096
  sh t2, 8(a1)
  sh zero, 10(a1)
  subu t2, zero, t0
  sh t2, 12(a1)
  sh zero, 14(a1)
  jr t9
  sh t1, 16(a1)
setrt:                        ; a0 = 行列 → RT
  lhu t0, 0(a0)
  lhu t1, 2(a0)
  lhu t2, 4(a0)
  lhu t3, 6(a0)
  sll t1, t1, 16
  or t0, t0, t1
  ctc2 t0, 0
  sll t3, t3, 16
  or t2, t2, t3
  ctc2 t2, 1
  lhu t0, 8(a0)
  lhu t1, 10(a0)
  lhu t2, 12(a0)
  lhu t3, 14(a0)
  sll t1, t1, 16
  or t0, t0, t1
  ctc2 t0, 2
  sll t3, t3, 16
  or t2, t2, t3
  ctc2 t2, 3
  lh t0, 16(a0)
  nop
  ctc2 t0, 4
  jr ra
  nop
matmul:                       ; C = A × B（a0・a1・a2）
  move t9, ra
  jal setrt
  nop
  li t4, 0
@col:
  sll t5, t4, 1
  addu t6, a1, t5
  lhu t0, 0(t6)
  lh t1, 6(t6)
  lh t2, 12(t6)
  sll t1, t1, 16
  or t0, t0, t1
  mtc2 t0, 0
  mtc2 t2, 1
  nop
  cop2 0x0486012
  addu t7, a2, t5
  mfc2 t0, 9
  mfc2 t1, 10
  mfc2 t2, 11
  sh t0, 0(t7)
  sh t1, 6(t7)
  sh t2, 12(t7)
  addiu t4, t4, 1
  slti t0, t4, 3
  bnez t0, @col
  nop
  jr t9
  nop

; ---- 垂直帰線を待って、描く側を入れかえる ----
begin:
@wait:
  lw t0, ISTAT(s7)
  nop
  andi t0, t0, 1
  beqz t0, @wait
  nop
  li t0, -2
  sw t0, ISTAT(s7)
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
  li t0, 0xe1000220          ; ディザ・加算の半透明
  sw t0, GP0(s7)
  jr ra
  nop

; パッド（口 1）→ V_PAD・V_EDGE
readpad:
  move t8, ra
  li t0, 0x0003
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
  andi v0, v0, 0xffff
  lw t1, V_PAD(gp)
  sw v0, V_PAD(gp)
  sw t1, V_PREV(gp)
  not t1, t1
  and t1, t1, v0
  jr t8
  sw t1, V_EDGE(gp)
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

; ---- 変数と作業の場所 ----
.align 4
stra:    .byte 10, 0xff, 0, 0
strb:    .byte 11, 0xff, 0, 0
vars:    .space 320            ; 0〜255 はセーブする・256〜 はしない
inv:     .space 16
numbuf:  .space 8
linebuf: .space 16
mat_a:   .space 20
mat_b:   .space 20
mat_c:   .space 20
fcount:  .space 16 * 6 * 4
cdist:   .space 64
corder:  .space 16
ot:      .space OTN * 4
world:   .space W * D * H
faces:   .space 16 * 6 * DIRF * 4
pkts:    .space MAXDRAW * 52 + 64
