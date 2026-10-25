; ---- 描く: 空と海・ブロックの面・ねらいのふち・十字・持ち物の列。行列・パッド・はじめの設定（main.s のつづき） ----

NEAR    = 40             ; これより手前の点がある面は描かない（手前の切れ目）
LODZ    = 2048           ; これより遠い面は、模様をやめて霧にまぜた一色（8 ブロック）
FOG0    = 1024           ; 霧がかかりはじめる所（4 ブロック）。FARZ − FOG0 = 4096
FARZ    = 5120           ; 霧でいちばん白くなる所（20 ブロック）
VIEWR   = 22             ; チャンクのまん中がこれより遠ければ描かない（ブロック）
MAXDRAW = 1400           ; 1 こまに描く面のいちばん多い数（近いチャンクから描くので、あふれるのは遠く）
; 霧の色 FOG_R・FOG_G・FOG_B は data.mjs（倍率の表と同じ色を使うため）
TPAGE   = 10             ; 模様のページ（VRAM の x = 640）・4 ビット

gteinit:
  ctc2 zero, 24              ; OFX・OFY = 0（まん中へは GPU の E5）
  ctc2 zero, 25
  li t0, 160
  ctc2 t0, 26                ; H（横の見える広さ ≒ 90 度）
  li t0, 1024
  ctc2 t0, 30                ; ZSF4 = 1/4（4 点の平均）
  li t0, FOG_R * 16          ; 遠くの色（DPCS で霧にまぜる）
  ctc2 t0, 21
  li t0, FOG_G * 16
  ctc2 t0, 22
  li t0, FOG_B * 16
  ctc2 t0, 23
  jr ra
  nop

; ブロックの模様と色の表を VRAM へ（CPU → VRAM の転送）
texupload:
  li t0, 0xa0000000
  sw t0, GP0(s7)
  li t0, 640                 ; (640, 0)
  sw t0, GP0(s7)
  li t0, (16 << 16) | 64     ; 64 × 16
  sw t0, GP0(s7)
  la t1, texdata
  li t2, 64 * 16 / 2
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
  addiu sp, sp, -40
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
  sw s4, 20(sp)
  sw s5, 24(sp)
  sw fp, 28(sp)
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
  slti t2, t2, VIEWR * VIEWR
  beqz t2, @nextchunk
  nop
  sll t0, t9, 12
  la s0, faces
  addu s0, s0, t0
  sll t0, t9, 2
  la t1, fcount
  addu t1, t1, t0
  lw s1, 0(t1)
  nop
  beqz s1, @nextchunk
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
  srl t5, t0, 17             ; ブロック
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
  addiu t0, a1, -FOG0
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
  slti t7, a1, LODZ
  beqz t7, @flat
  nop
  ; ---- 近い: 模様つきの四角（0x2C）。色の倍率をチャンネルごとに決めて、明るさと霧を一度に ----
  ;   ねらい = 平均 × 明るさ / 128 ×（1 − t）+ 霧の色 × t、倍率 = ねらい × 128 / 平均（255 まで）
  ;   遠くの一色（平均 × 明るさを DPCS で霧へ）と同じ式なので、切りかわりで絵が飛ばない
  ; 倍率は表から（模様 × 向き × 霧の 17 段。data.mjs で、遠くの一色と同じ式で作ってある）
  la t6, modtab
  li t7, 6
  mult a2, t7
  mflo t7
  addu t7, t7, t4            ; 模様 × 6 + 向き
  sll t8, t7, 4
  addu t7, t8, t7            ; × 17
  srl t8, t0, 8
  addu t7, t7, t8            ; + 霧の段
  sll t7, t7, 2
  addu t6, t6, t7
  lw t4, 0(t6)
  nop
  lui t8, 0x2c00
  or t7, t4, t8
  sw t7, 4(s2)
  sll t7, a2, 4              ; u のはじめ（模様 × 16）
  addiu t8, a2, 20           ; CLUT: (320 + 模様 × 16, 240) → x/16 = 20 + 模様
  ori t8, t8, 240 << 6
  sll t8, t8, 16
  or t8, t8, t7
  sw t8, 12(s2)              ; 左上の uv と CLUT
  addiu t8, t7, 15
  lui v0, TPAGE
  or t8, t8, v0
  sw t8, 20(s2)              ; 右上の uv とページ
  ori t8, t7, 15 << 8
  sw t8, 28(s2)              ; 左下
  addiu t8, t7, 15
  ori t8, t8, 15 << 8
  sw t8, 36(s2)              ; 右下
  lui v1, 0x0900             ; 語 9 つ
  li a0, 40
  b @link
  nop
@flat:
  ; ---- 遠い: 霧にまぜた一色の四角（0x28）。色 = 模様の平均 × 明るさ を、遠さの割合で霧の色へ（GTE の DPCS）----
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
@nextchunk:
  lw t9, 32(sp)
  nop
  addiu t9, t9, 1
  slti t0, t9, 16
  bnez t0, @chunk
  nop
@done:
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
  addiu sp, sp, 40

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
  li t0, 0x38e0a058          ; 上の色（青）
  sw t0, GP0(s7)
  li t0, 0xff88ff60
  sw t0, GP0(s7)
  li t0, 0x00e0a058
  sw t0, GP0(s7)
  li t0, 0xff8800a0
  sw t0, GP0(s7)
  li t0, (FOG_B << 16) | (FOG_G << 8) | FOG_R
  sw t0, GP0(s7)
  li t1, 0xff60
  or t1, t1, t3
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  ori t1, t3, 0x00a0
  sw t1, GP0(s7)
  ; 海
  li t0, (FOG_B << 16) | (FOG_G << 8) | FOG_R
  li t1, 0x38000000
  or t1, t1, t0
  sw t1, GP0(s7)
  li t1, 0xff60
  or t1, t1, t3
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  ori t1, t3, 0x00a0
  sw t1, GP0(s7)
  li t0, 0x00a06830          ; 手前の海の色
  sw t0, GP0(s7)
  li t1, 0x0078ff60
  sw t1, GP0(s7)
  sw t0, GP0(s7)
  li t1, 0x007800a0
  sw t1, GP0(s7)
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
  li t6, 0x2c808080
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
  lui t8, TPAGE
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
;   札は角を落とした四角。選んでいる札だけ 4 点上に出て明るい。持っていない札は枠だけ（絵を出さない）
hud:
  addiu sp, sp, -16
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
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
  li t0, 0xe100020a          ; スプライトは模様のページで（ディザも）
  sw t0, GP0(s7)
  li s0, 2                   ; ブロック
  li s1, -84                 ; x
@slot:
  lw t0, V_SEL(gp)
  li s2, 94                  ; 札の上の y（選んでいる札は 4 点上）
  bne t0, s0, @up
  nop
  li s2, 90
@up:
  la t4, inv
  addu t4, t4, s0
  lbu t4, 0(t4)
  nop
  beqz t4, @empty
  nop
  ; 持っている札: 角を落とした下じき（選んでいれば明るい不透明、ほかは暗い半透明）
  li a2, 0x62202020
  bne t0, s0, @bg
  nop
  li a2, 0x60c8dcd8
@bg:
  sll t1, s2, 16
  addiu t2, s2, 1
  sll t2, t2, 16
  andi t3, s1, 0xffff
  or a0, t2, t3
  li a1, 0x00120014          ; 20 × 18
  bal rect
  nop
  addiu t3, s1, 1
  andi t3, t3, 0xffff
  sll t1, s2, 16
  or a0, t1, t3
  li a1, 0x00140012          ; 18 × 20
  bal rect
  nop
  ; ブロックの絵（16×16 のスプライト）
  li t1, 0x7c808080
  sw t1, GP0(s7)
  addiu t2, s1, 2
  andi t2, t2, 0xffff
  addiu t3, s2, 2
  sll t3, t3, 16
  or t2, t2, t3
  sw t2, GP0(s7)
  la t5, texside
  addu t5, t5, s0
  lbu t5, 0(t5)
  nop
  sll t6, t5, 4              ; u
  addiu t7, t5, 20
  ori t7, t7, 240 << 6       ; CLUT
  sll t7, t7, 16
  or t6, t6, t7
  sw t6, GP0(s7)
  ; 数（右下に小さく）
  move a0, t4
  addiu a1, s1, 9
  addiu a2, s2, 12
  li a3, 0x00f8f8f8
  li t0, 1
  sw t0, V_SCL(gp)
  jal num
  nop
  b @next
  nop
@empty:                       ; 持っていない札: 枠だけ
  li a2, 0x62909090
  bne t0, s0, @fr
  nop
  li a2, 0x60c8dcd8
@fr:
  addiu t3, s1, 1
  andi t3, t3, 0xffff
  sll t1, s2, 16
  or a0, t1, t3
  li a1, 0x00010012          ; 上
  bal rect
  nop
  addiu t1, s2, 19
  sll t1, t1, 16
  addiu t3, s1, 1
  andi t3, t3, 0xffff
  or a0, t1, t3
  bal rect                   ; 下
  nop
  addiu t1, s2, 1
  sll t1, t1, 16
  andi t3, s1, 0xffff
  or a0, t1, t3
  li a1, 0x00120001          ; 左
  bal rect
  nop
  addiu t1, s2, 1
  sll t1, t1, 16
  addiu t3, s1, 19
  andi t3, t3, 0xffff
  or a0, t1, t3
  bal rect                   ; 右
  nop
@next:
  addiu s0, s0, 1
  addiu s1, s1, 24
  slti t0, s0, 9
  bnez t0, @slot
  nop
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  jr ra
  addiu sp, sp, 16

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
vars:    .space 128
inv:     .space 16
numbuf:  .space 8
linebuf: .space 16
mat_a:   .space 20
mat_b:   .space 20
mat_c:   .space 20
fcount:  .space 64
cdist:   .space 64
corder:  .space 16
ot:      .space OTN * 4
world:   .space W * D * H
faces:   .space 16 * MAXF * 4
pkts:    .space MAXDRAW * 40 + 64
