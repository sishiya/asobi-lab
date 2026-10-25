; ほって つんで 3D（仮）— 32ビット互換機のオリジナル（PLAN.md 6章）
;   main.s = はじめ・1こまの流れ・歩く・跳ぶ・ぶつかる・ねらい・掘る・置く・持ち物
;   world.s = 島のブロック・面の一覧を作る。render.s = 空・面を描く・ねらいのふち・持ち物の列・行列・パッド
;   レジスタの約束: s7 = I/O、gp = 変数、s6 = いま描く側。サブルーチンは t・a・v をこわしてよい
;   座標: 1 ブロック = 256。y は上が +（描くときに下が + にひっくり返す）。遅延スロットとロードの遅れは自分で nop

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
DIRF   = 256           ; 1 チャンク・1 向きの面のいちばん多い数（面の一覧は向きごとに分けて持つ）

B_UP    = 0x0010
B_RIGHT = 0x0020
B_DOWN  = 0x0040
B_LEFT  = 0x0080
B_START = 0x0008
B_SELECT = 0x0001
B_L     = 0x0400
B_R     = 0x0800
B_Y     = 0x1000
B_A     = 0x2000
B_B     = 0x4000
B_X     = 0x8000

; 変数（gp から）
V_CX    = 0      ; 足もとの x（×256）
V_CY    = 4      ; 足もとの y
V_CZ    = 8
V_VY    = 12     ; 上下の速さ
V_YAW   = 16     ; 向き（256 で 1 周。×256）
V_PIT   = 20     ; 上下（−48〜48 ×256）
V_ONG   = 24     ; 地面に立っている
V_PAD   = 28
V_PREV  = 32
V_EDGE  = 36
V_TGT   = 40     ; ねらったブロック（場所の番号。−1 なし）
V_TGTF  = 44     ; ねらった面の向き
V_PLC   = 48     ; 置ける場所（−1 なし）
V_DIGP  = 52     ; 掘りぐあい
V_DIGI  = 56     ; 掘っているブロック
V_SEL   = 60     ; 持っているブロック
V_BLINK = 64
V_EY    = 68     ; 目の高さ（y）
V_DIRTY = 72     ; 作りなおすチャンク（16 ビット）
V_INWAT = 76     ; 水の中
V_SCL   = 80
V_NFACE = 84     ; このこまに描いた面の数（確かめ用）
V_DENY  = 88     ; 置けなかった印を出すのこりのこま
V_EVT   = 92     ; 音の印（sound.s の EV_〜。sndframe が鳴らして消す）
V_EVM   = 96     ; 音のブロック（掘る・くずれた・置いたの高さ）
V_STEPC = 100    ; 足音までの歩いた量
V_TIME  = 104    ; 1 日の中のこま（0 〜 DAYU × 64）
V_LVL   = 108    ; 明るさの段（0 昼 〜 7 夜。lvltab から）
; 描くときの段ごとの数（render の lightset が lighttab から写す）
V_MODB  = 112    ; この段の modtab
V_FOG0  = 116
V_FOGK  = 120
V_LIGHT = 124
V_VR2   = 128
V_FOGC  = 132
V_FOGRGB = 136
V_SKYT  = 140
V_SEA   = 144
V_CRAFT = 148    ; 作る帯が開いている（開いている間は世界が止まる）
V_CSEL  = 152    ; 作る帯で選んでいる物（0〜3）
V_BLADE = 156    ; 火山ガラスの刃を持っている（掘るのが 2 倍の速さ）
V_DAY   = 160    ; 何日目
V_WIN   = 164    ; のろしをあげた
V_WINP  = 168    ; のろしの場所（ブロックの番号）
V_WINT  = 172    ; のろしをあげてからのこま
V_SEEN  = 176    ; 作る帯を一度でも開いた（開くまでは、幹を持つと案内が光る）
V_ACAM  = 180    ; のろしのあと、カメラを水平にして船へ向けるのこりのこま
V_UPF   = 184    ; のろしを低い所に置いたとき、ねらいの上に ▲ を出すのこりのこま
V_SPAWND = 188   ; 夜の生き物を出した日（1 晩に 1 回）
V_TSAVE = 192    ; この夜に守った子ガメ
V_TALL  = 196    ; これまでに守った子ガメ
V_TSPAWN = 200   ; この夜に出た子ガメ
V_TSHOW = 204    ; 朝のあと、守った数を見せるのこりのこま
V_TMP   = 208    ; 生き物の計算の置き場（crits.s）
V_TMP2  = 212
V_TMP3  = 216
V_TMP4  = 220
V_TMP5  = 224
V_TMP6  = 228
V_TMP7  = 232
V_PLVL  = 256    ; 前のこまの明るさの段（朝になったか見る。ここから先はセーブしない）
V_SAVET = 260    ; セーブの印を出すのこり（負ならセーブできなかった）
V_CRABN = 236    ; ヤシガニが近い（ねらいの横に [B] の札）
V_MODE  = 240    ; 0 遊ぶ・1 はじめの画面（つづき／あたらしく）
V_MSEL  = 244    ; はじめの画面でえらんでいる方（0 つづき・1 あたらしく）
V_SDAY  = 248    ; カードのセーブの日
V_SAVEQ = 252    ; セーブしてほしい（朝・のろし）

EYE_H   = 410    ; 目の高さ（1.6 ブロック）
BODY_H  = 461    ; 体の高さ（1.8）
HALF    = 77     ; 体の半分の幅（0.3）
SPEED   = 18     ; 歩く速さ（1 こま）
JUMP_V  = 58     ; 跳ぶ速さ
GRAV    = 5

.org 0x80010000
start:
  li s7, IO
  la gp, vars
  sw zero, GP1(s7)
  li t0, 0x08000001          ; 320×240・15 ビット
  sw t0, GP1(s7)
  li t0, 0x06c60260
  sw t0, GP1(s7)
  li t0, 0x07042018
  sw t0, GP1(s7)
  li t0, 0x04000002
  sw t0, GP1(s7)
  li t0, 0x03000000
  sw t0, GP1(s7)
  lw t0, DPCR(s7)
  li t1, 0x08000800
  or t0, t0, t1
  sw t0, DPCR(s7)
  li t0, 2
  sw t0, V_SCL(gp)
  jal gteinit
  nop
  jal texupload
  nop
  jal newworld
  nop
  jal sndinit
  nop
  sw zero, V_MODE(gp)        ; カードにこのソフトのセーブがあれば、はじめの画面（つづき／あたらしく）
  sw zero, V_MSEL(gp)
  sw zero, V_SAVEQ(gp)
  sw zero, V_SAVET(gp)
  jal peeksave
  nop
  beqz v0, @nosave
  nop
  li t0, 1
  sw t0, V_MODE(gp)
@nosave:
  li s6, 0

frame:
  jal begin
  nop
  jal readpad
  nop
  lw t0, V_BLINK(gp)
  nop
  addiu t0, t0, 1
  sw t0, V_BLINK(gp)
  jal update
  nop
  jal render
  nop
  jal sndframe
  nop
  lw t0, V_SAVEQ(gp)         ; セーブ（朝・のろし）
  nop
  beqz t0, @nosv
  nop
  sw zero, V_SAVEQ(gp)
  jal savegame
  nop
  li t0, 150                 ; カードの印を 2.5 秒（書けなかったら × つき）
  bnez v0, @svok
  nop
  li t0, -150
@svok:
  sw t0, V_SAVET(gp)
@nosv:
  j frame
  nop

; ---- あたらしい島（島を写して、面の一覧をぜんぶ作る） ----
newworld:
  addiu sp, sp, -8
  sw ra, 0(sp)
  la t0, world0
  la t1, world
  li t2, W * D * H / 4
@cp:
  lw t3, 0(t0)
  addiu t0, t0, 4
  addiu t2, t2, -1
  sw t3, 0(t1)
  bnez t2, @cp
  addiu t1, t1, 4
  li t0, START_X
  sw t0, V_CX(gp)
  li t0, START_Y
  sw t0, V_CY(gp)
  addiu t0, t0, EYE_H        ; 目の高さ（はじめの画面でも島が見えるように）
  sw t0, V_EY(gp)
  li t0, START_Z
  sw t0, V_CZ(gp)
  sw zero, V_VY(gp)
  li t0, START_YAW << 8      ; 向き: 島のまん中を見る
  sw t0, V_YAW(gp)
  li t0, -10 << 8            ; 少し下を見る（島ののぼりと、手前の地面の両方が見える）
  sw t0, V_PIT(gp)
  li t0, 2
  sw t0, V_SEL(gp)
  sw zero, V_DENY(gp)
  la t0, inv                 ; 持ち物: 土を 5 つだけ（はじめの X で置ける）
  sw zero, 0(t0)
  sw zero, 4(t0)
  sw zero, 8(t0)
  sw zero, 12(t0)
  li t1, 5
  sb t1, 2(t0)
  sw zero, V_CRAFT(gp)
  sw zero, V_CSEL(gp)
  sw zero, V_BLADE(gp)
  sw zero, V_WIN(gp)
  sw zero, V_WINT(gp)
  sw zero, V_SEEN(gp)
  sw zero, V_TIME(gp)
  sw zero, V_ACAM(gp)
  sw zero, V_UPF(gp)
  li t1, 1
  sw t1, V_DAY(gp)
  jal critinit
  nop
  li t0, 0xffff
  sw t0, V_DIRTY(gp)
  jal rebuildall
  nop
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; ---- 1こまの決まり ----
update:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  lw s0, V_PAD(gp)
  lw t0, V_SAVET(gp)         ; セーブの印ののこり
  nop
  beqz t0, @st0
  nop
  bgtz t0, @st1
  addiu t0, t0, -1
  addiu t0, t0, 2
@st1:
  sw t0, V_SAVET(gp)
@st0:
  ; ---- はじめの画面: ←→ でえらぶ・A か START で決める ----
  lw t0, V_MODE(gp)
  nop
  beqz t0, @inplay
  nop
  lw t0, V_EDGE(gp)
  lw t1, V_MSEL(gp)
  andi t2, t0, B_LEFT | B_RIGHT
  beqz t2, @ms
  nop
  xori t1, t1, 1
  sw t1, V_MSEL(gp)
@ms:
  andi t2, t0, B_A | B_START
  beqz t2, @frozen
  nop
  sw zero, V_MODE(gp)
  bnez t1, @fresh            ; あたらしく: いまの島のまま
  nop
  jal loadgame               ; つづき: カードから
  nop
  beqz v0, @fresh
  nop
  sw zero, V_CRAFT(gp)       ; 読んだあと、とちゅうの物は消す
  sw zero, V_DIGP(gp)
  sw zero, V_ACAM(gp)
  sw zero, V_UPF(gp)
  sw zero, V_DENY(gp)
  sw zero, V_EVT(gp)
  sw zero, V_MODE(gp)
  sw zero, V_SAVET(gp)
  sw zero, V_SAVEQ(gp)
  la t0, crits
  li t1, NCRIT
@zc:
  sw zero, 0(t0)
  addiu t1, t1, -1
  bnez t1, @zc
  addiu t0, t0, 32
  li t0, 0xffff
  sw t0, V_DIRTY(gp)
  jal rebuildall
  nop
@fresh:
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_MADE
  sw t0, V_EVT(gp)
  b @frozen
  nop
@inplay:
  ; ---- 作る帯（SELECT で開く・閉じる。開いている間は世界が止まる）----
  lw t0, V_EDGE(gp)
  lw t1, V_CRAFT(gp)
  andi t2, t0, B_SELECT
  beqz t2, @nosw
  nop
  xori t1, t1, 1
  sw t1, V_CRAFT(gp)
  li t2, 1
  sw t2, V_SEEN(gp)
  b @frozen
  nop
@nosw:
  beqz t1, @play
  nop
  andi t2, t0, B_B           ; B でも閉じる
  beqz t2, @nb2
  nop
  sw zero, V_CRAFT(gp)
  b @frozen
  nop
@nb2:
  lw t3, V_CSEL(gp)          ; ←→ で選ぶ
  andi t2, t0, B_LEFT
  beqz t2, @nl2
  nop
  addiu t3, t3, -1
@nl2:
  andi t2, t0, B_RIGHT
  beqz t2, @nr2
  nop
  addiu t3, t3, 1
@nr2:
  andi t3, t3, 3
  sw t3, V_CSEL(gp)
  andi t2, t0, B_A           ; A で作る
  beqz t2, @frozen
  nop
  move a0, t3
  jal cancraft
  nop
  beqz v0, @cdeny
  nop
  la t0, recipes             ; 材料をへらす
  lw t3, V_CSEL(gp)
  nop
  sll t1, t3, 3
  addu t0, t0, t1
  la t3, inv
  lbu t1, 2(t0)
  lbu t2, 3(t0)
  addu t4, t3, t1
  lbu t5, 0(t4)
  nop
  subu t5, t5, t2
  sb t5, 0(t4)
  lbu t1, 4(t0)
  lbu t2, 5(t0)
  beqz t1, @one
  addu t4, t3, t1
  lbu t5, 0(t4)
  nop
  subu t5, t5, t2
  sb t5, 0(t4)
@one:
  lbu t1, 0(t0)              ; できた物を持ち物へ（刃は印だけ）
  lbu t2, 1(t0)
  li t5, 13
  bne t1, t5, @blk
  nop
  li t5, 1
  sw t5, V_BLADE(gp)
  b @made
  nop
@blk:
  addu t4, t3, t1
  lbu t5, 0(t4)
  nop
  addu t5, t5, t2
  slti t6, t5, 100
  bnez t6, @cap
  nop
  li t5, 99
@cap:
  sb t5, 0(t4)
  lw t6, V_SEL(gp)           ; 選んでいる物が空なら、できた物を持つ
  nop
  addu t7, t3, t6
  lbu t7, 0(t7)
  nop
  bnez t7, @made
  nop
  sw t1, V_SEL(gp)
@made:
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_MADE
  sw t0, V_EVT(gp)
  b @frozen
  nop
@cdeny:
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_DENY
  sw t0, V_EVT(gp)
  b @frozen
  nop
@play:
  ; 時刻をすすめて、明るさの段を決める（1 日が回ったら何日目をふやす）
  lw t0, V_TIME(gp)
  li t1, DAYU * 64
  addiu t0, t0, 1
  slt t2, t0, t1
  bnez t2, @tok
  nop
  lw t2, V_DAY(gp)
  nop
  addiu t2, t2, 1
  sw t2, V_DAY(gp)
  li t0, 0
@tok:
  sw t0, V_TIME(gp)
  srl t0, t0, 6
  la t1, lvltab
  addu t1, t1, t0
  lbu t1, 0(t1)
  nop
  sw t1, V_LVL(gp)
  lw t0, V_PLVL(gp)          ; 朝になった（段が 0 になった）らセーブ
  sw t1, V_PLVL(gp)
  bnez t1, @nomorn
  nop
  beqz t0, @nomorn
  nop
  li t0, 1
  sw t0, V_SAVEQ(gp)
@nomorn:
  lw t0, V_WIN(gp)           ; のろしをあげてからの時間（船が近づく）
  lw t1, V_WINT(gp)
  beqz t0, @nowin
  nop
  addiu t1, t1, 1
  sw t1, V_WINT(gp)
@nowin:
  jal critframe              ; 夜の生き物
  nop
  lw t0, V_UPF(gp)
  nop
  blez t0, @noupf
  nop
  addiu t0, t0, -1
  sw t0, V_UPF(gp)
@noupf:
  ; のろしのあと: 上下を水平へ、向きを船の方角へ、1/8 ずつ（遊ぶ人がいちばんのごほうびを見のがさないように）
  lw t0, V_ACAM(gp)
  nop
  blez t0, @noacam
  nop
  addiu t0, t0, -1
  sw t0, V_ACAM(gp)
  lw t1, V_PIT(gp)
  nop
  sra t2, t1, 3
  subu t1, t1, t2
  sw t1, V_PIT(gp)
  lw t1, V_YAW(gp)
  li t2, SHIPYAW << 8
  subu t2, t2, t1
  sll t2, t2, 16
  sra t2, t2, 16             ; −32768〜32767 に
  sra t2, t2, 3
  addu t1, t1, t2
  andi t1, t1, 0xffff
  sw t1, V_YAW(gp)
  b @frozen                  ; 向きを変えている間は歩かない
  nop
@noacam:
  ; 向き（←→）と、上下（L・R）
  lw t0, V_YAW(gp)
  andi t1, s0, B_LEFT
  beqz t1, @nl
  nop
  addiu t0, t0, -0x300
@nl:
  andi t1, s0, B_RIGHT
  beqz t1, @nr
  nop
  addiu t0, t0, 0x300
@nr:
  li t1, 0xffff
  and t0, t0, t1
  sw t0, V_YAW(gp)
  lw t0, V_PIT(gp)
  andi t1, s0, B_L
  beqz t1, @nlu
  nop
  addiu t0, t0, 0x200
@nlu:
  andi t1, s0, B_R
  beqz t1, @nld
  nop
  addiu t0, t0, -0x200
@nld:
  li t1, 48 << 8
  slt t2, t1, t0
  beqz t2, @p1
  nop
  move t0, t1
@p1:
  li t1, -48 << 8
  slt t2, t0, t1
  beqz t2, @p2
  nop
  move t0, t1
@p2:
  sw t0, V_PIT(gp)
  ; 前へ・うしろへ（向きの sin・cos で）
  li s1, 0
  andi t1, s0, B_UP
  beqz t1, @nf
  nop
  li s1, SPEED
@nf:
  andi t1, s0, B_DOWN
  beqz t1, @nb
  nop
  li s1, -SPEED
@nb:
  beqz s1, @nomove
  nop
  lw t0, V_ONG(gp)           ; 足音: 地面を歩いた量がたまったら
  lw t1, V_STEPC(gp)
  beqz t0, @nostep
  nop
  addiu t1, t1, SPEED
  slti t0, t1, 150
  bnez t0, @nostep
  nop
  li t1, 0
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_STEP
  sw t0, V_EVT(gp)
@nostep:
  sw t1, V_STEPC(gp)
  lw a0, V_YAW(gp)
  nop
  srl a0, a0, 8
  jal sincos
  nop
  mult t0, s1                ; dx = sin × 速さ
  mflo t2
  sra t2, t2, 12
  mult t1, s1                ; dz = cos × 速さ
  mflo t3
  sra t3, t3, 12
  sw t3, 12(sp)
  ; x へ動かして、ぶつかったらもどす
  lw t4, V_CX(gp)
  nop
  addu t5, t4, t2
  sw t5, V_CX(gp)
  sw t4, 16(sp)
  jal collide
  nop
  beqz v0, @okx
  nop
  lw t4, 16(sp)
  nop
  sw t4, V_CX(gp)
@okx:
  lw t3, 12(sp)
  lw t4, V_CZ(gp)
  nop
  addu t5, t4, t3
  sw t5, V_CZ(gp)
  sw t4, 16(sp)
  jal collide
  nop
  beqz v0, @nomove
  nop
  lw t4, 16(sp)
  nop
  sw t4, V_CZ(gp)
@nomove:
  ; 水の中か（足もとのブロック）
  lw a0, V_CX(gp)
  lw a1, V_CY(gp)
  lw a2, V_CZ(gp)
  addiu a1, a1, 64
  jal blockat
  nop
  xori v0, v0, 9
  sltiu v0, v0, 1
  sw v0, V_INWAT(gp)
  ; 跳ぶ（地面に立っているとき）・水の中では A で浮く
  andi t1, s0, B_A
  beqz t1, @nj
  nop
  lw t2, V_INWAT(gp)
  nop
  beqz t2, @jl
  nop
  li t3, 22
  sw t3, V_VY(gp)
  b @nj
  nop
@jl:
  lw t2, V_ONG(gp)
  nop
  beqz t2, @nj
  nop
  li t3, JUMP_V
  sw t3, V_VY(gp)
@nj:
  ; 落ちる（水の中はゆっくり）
  lw t0, V_VY(gp)
  lw t2, V_INWAT(gp)
  addiu t0, t0, -GRAV
  beqz t2, @g1
  nop
  addiu t0, t0, 3
  slti t3, t0, -16
  beqz t3, @g1
  nop
  li t0, -16
@g1:
  slti t3, t0, -90
  beqz t3, @g2
  nop
  li t0, -90
@g2:
  sw t0, V_VY(gp)
  lw t4, V_CY(gp)
  sw zero, V_ONG(gp)
  addu t5, t4, t0
  sw t5, V_CY(gp)
  sw t4, 16(sp)
  jal collide
  nop
  beqz v0, @oky
  nop
  lw t4, 16(sp)
  lw t0, V_VY(gp)
  sw t4, V_CY(gp)
  sw zero, V_VY(gp)
  bgtz t0, @oky              ; 頭をぶつけた
  nop
  slti t1, t0, -24           ; 速く落ちてきたら着地の音
  beqz t1, @soft
  nop
  lw t1, V_EVT(gp)
  nop
  ori t1, t1, EV_LAND
  sw t1, V_EVT(gp)
@soft:
  li t1, 1
  sw t1, V_ONG(gp)
@oky:
  ; 島の下へ落ちたら、はじめの場所へ
  lw t0, V_CY(gp)
  nop
  bgez t0, @alive
  nop
  li t0, START_X
  sw t0, V_CX(gp)
  li t0, START_Y
  sw t0, V_CY(gp)
  li t0, START_Z
  sw t0, V_CZ(gp)
  sw zero, V_VY(gp)
@alive:
  lw t0, V_CY(gp)
  nop
  addiu t0, t0, EYE_H
  sw t0, V_EY(gp)
  jal aim
  nop
  ; ---- 掘る（B を押している間。かたさのこまの数だけ）----
  lw t0, V_TGT(gp)
  andi t1, s0, B_B
  beqz t1, @nodig
  nop
  bltz t0, @nodig
  nop
  lw t2, V_DIGI(gp)
  nop
  beq t2, t0, @digging
  nop
  sw t0, V_DIGI(gp)
  sw zero, V_DIGP(gp)
@digging:
  la t3, world
  addu t3, t3, t0
  lbu t4, 0(t3)              ; ブロック
  la t5, hardness
  addu t5, t5, t4
  lbu t5, 0(t5)
  lw t6, V_DIGP(gp)
  nop
  lw t7, V_BLADE(gp)         ; 火山ガラスの刃があれば 2 倍の速さ
  addiu t6, t6, 1
  addu t6, t6, t7
  sw t6, V_DIGP(gp)
  andi t7, t6, 7             ; 掘りぐあいが 8 すすむごとに「ざくっ」
  li t8, 2
  bne t7, t8, @nosnd
  nop
  lw t7, V_EVT(gp)
  sw t4, V_EVM(gp)
  ori t7, t7, EV_DIG
  sw t7, V_EVT(gp)
@nosnd:
  slt t7, t6, t5
  bnez t7, @digdone
  nop
  ; 掘れた: 空気にして、持ち物へ
  sb zero, 0(t3)
  lw t7, V_EVT(gp)
  sw t4, V_EVM(gp)
  ori t7, t7, EV_BREAK
  sw t7, V_EVT(gp)
  la t5, dropof
  addu t5, t5, t4
  lbu t5, 0(t5)
  la t6, inv
  addu t6, t6, t5
  lbu t7, 0(t6)
  nop
  addiu t7, t7, 1
  slti t8, t7, 100
  beqz t8, @full
  nop
  sb t7, 0(t6)
@full:
  lw t7, V_SEL(gp)           ; 何も持っていなければ、いま掘ったものを持つ
  la t8, inv
  addu t8, t8, t7
  lbu t8, 0(t8)
  nop
  bnez t8, @keep
  nop
  sw t5, V_SEL(gp)
@keep:
  sw zero, V_DIGP(gp)
  move a0, t0
  jal markdirty
  nop
  lw t0, V_EVM(gp)           ; たき火を掘ったら、一覧から消す
  li t1, 11
  bne t0, t1, @nofd
  nop
  lw a0, V_DIGI(gp)
  jal firedel
  nop
@nofd:
  b @digdone
  nop
@nodig:                       ; 指を離しても、掘りぐあいは少しずつもどる（同じブロックならつづきから）
  lw t1, V_DIGP(gp)
  nop
  blez t1, @digdone
  nop
  addiu t1, t1, -1
  sw t1, V_DIGP(gp)
@digdone:
  ; ---- 置く（X）。夜にたき火をねらって X なら、朝までとばす ----
  lw t0, V_EDGE(gp)
  nop
  andi t0, t0, B_X
  beqz t0, @noplace
  nop
  lw t0, V_TGT(gp)
  la t1, world
  bltz t0, @nofire
  addu t1, t1, t0
  lbu t1, 0(t1)
  li t2, 11
  bne t1, t2, @nofire
  nop
  lw t1, V_LVL(gp)
  nop
  slti t1, t1, 4
  bnez t1, @nofire
  nop
  la t1, crits               ; 子ガメが陸を歩いている間は休めない（見ないまま朝にならないように）
  li t2, 4
@tl:
  lw t3, 0(t1)
  li t4, 1
  beq t3, t4, @deny
  nop
  addiu t2, t2, -1
  bnez t2, @tl
  addiu t1, t1, 32
  li t1, DAWNT
  sw t1, V_TIME(gp)
  lw t1, V_EVT(gp)
  nop
  ori t1, t1, EV_MADE
  sw t1, V_EVT(gp)
  b @noplace
  nop
@nofire:
  lw t0, V_PLC(gp)
  lw t1, V_SEL(gp)
  bltz t0, @deny
  nop
  la t2, inv
  addu t2, t2, t1
  lbu t3, 0(t2)
  nop
  beqz t3, @deny
  nop
  ; 置く場所に自分の体が入っていないか（置いてみて、ぶつかればもどす）
  la t4, world
  addu t4, t4, t0
  sb t1, 0(t4)
  sw t4, 16(sp)
  sw t2, 20(sp)
  jal collide
  nop
  lw t4, 16(sp)
  lw t2, 20(sp)
  beqz v0, @placed
  nop
  sb zero, 0(t4)
@deny:
  li t0, 24
  sw t0, V_DENY(gp)
  lw t0, V_EVT(gp)
  nop
  ori t0, t0, EV_DENY
  sw t0, V_EVT(gp)
  b @noplace
  nop
@placed:
  lbu t3, 0(t2)
  nop
  addiu t3, t3, -1
  sb t3, 0(t2)
  lw t0, V_SEL(gp)
  lw t1, V_EVT(gp)
  sw t0, V_EVM(gp)
  ori t1, t1, EV_PLACE
  sw t1, V_EVT(gp)
  li t2, 12                  ; のろしを島のいちばん高い地面の高さ以上に置いたら、船を呼べた
  bne t0, t2, @nowin2
  nop
  lw t2, V_PLC(gp)
  lw t3, V_WIN(gp)
  srl t4, t2, 10
  bnez t3, @nowin2
  slti t4, t4, SUMMIT
  bnez t4, @nowin2
  nop
  li t3, 1
  sw t3, V_WIN(gp)
  sw t2, V_WINP(gp)
  sw zero, V_WINT(gp)
  li t3, 90
  sw t3, V_ACAM(gp)
  li t3, 1                   ; のろしをあげたらセーブ
  sw t3, V_SAVEQ(gp)
  ori t1, t1, EV_WIN
  sw t1, V_EVT(gp)
  b @placeok
  nop
@nowin2:
  li t2, 12                  ; のろしを低い所に置いた: ねらいの上に ▲（もっと高い所へ）
  bne t0, t2, @placeok
  nop
  lw t3, V_WIN(gp)
  nop
  bnez t3, @placeok
  nop
  li t3, 40
  sw t3, V_UPF(gp)
@placeok:
  lw t0, V_SEL(gp)           ; たき火を置いたら、子ガメとヤシガニのためにたき火の一覧へ
  li t1, 11
  bne t0, t1, @nofa
  nop
  lw a0, V_PLC(gp)
  jal fireadd
  nop
@nofa:
  lw a0, V_PLC(gp)
  jal markdirty
  nop
@noplace:
  lw t0, V_DENY(gp)
  nop
  blez t0, @nodeny
  nop
  addiu t0, t0, -1
  sw t0, V_DENY(gp)
@nodeny:
  ; ---- 持ち物をかえる（Y。持っている数が 1 以上のものだけ）----
  lw t0, V_EDGE(gp)
  nop
  andi t0, t0, B_Y
  beqz t0, @nosel
  nop
  lw t1, V_SEL(gp)
  la t3, inv
  li t4, 13
@sl:
  addiu t1, t1, 1
  slti t2, t1, 13
  bnez t2, @sl2
  nop
  li t1, 1
@sl2:
  addu t5, t3, t1
  lbu t5, 0(t5)
  addiu t4, t4, -1
  bnez t5, @slok
  nop
  bnez t4, @sl
  nop
  b @nosel
  nop
@slok:
  sw t1, V_SEL(gp)
@nosel:
@frozen:
  jal rebuilddirty
  nop
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  jr ra
  addiu sp, sp, 24

; 体（足もと V_CX/CY/CZ、幅 HALF×2・高さ BODY_H）がかたいブロックに入っているか → v0
collide:
  addiu sp, sp, -8
  sw ra, 0(sp)
  lw t0, V_CX(gp)
  lw t1, V_CY(gp)
  lw t2, V_CZ(gp)
  addiu t3, t0, -HALF
  sra t3, t3, 8              ; x0
  addiu t4, t0, HALF
  sra t4, t4, 8              ; x1
  sra t5, t1, 8              ; y0
  addiu t6, t1, BODY_H
  sra t6, t6, 8              ; y1
  addiu t7, t2, -HALF
  sra t7, t7, 8              ; z0
  addiu t8, t2, HALF
  sra t8, t8, 8              ; z1
  move a1, t5
@cy:
  move a2, t7
@cz:
  move a0, t3
@cx:
  ; かたいか（世界の外のよこは かべ・下は かべ・上は空気）
  li v0, 1
  bltz a0, @hit
  nop
  bltz a2, @hit
  nop
  bltz a1, @hit
  nop
  slti v1, a0, W
  beqz v1, @hit
  nop
  slti v1, a2, D
  beqz v1, @hit
  nop
  slti v1, a1, H
  beqz v1, @nx
  nop
  sll v1, a1, 10
  sll v0, a2, 5
  addu v1, v1, v0
  addu v1, v1, a0
  la v0, world
  addu v1, v1, v0
  lbu v1, 0(v1)
  nop
  beqz v1, @nx
  nop
  xori v1, v1, 9
  bnez v1, @hit1
  nop
@nx:
  addiu a0, a0, 1
  slt v1, t4, a0
  beqz v1, @cx
  nop
  addiu a2, a2, 1
  slt v1, t8, a2
  beqz v1, @cz
  nop
  addiu a1, a1, 1
  slt v1, t6, a1
  beqz v1, @cy
  nop
  li v0, 0
  b @out
  nop
@hit1:
  li v0, 1
@hit:
@out:
  lw ra, 0(sp)
  addiu sp, sp, 8
  jr ra
  nop

; a0・a1・a2 = 場所（×256）→ v0 = ブロック（世界の外は 0）
blockat:
  sra a0, a0, 8
  sra a1, a1, 8
  sra a2, a2, 8
  li v0, 0
  bltz a0, @o
  nop
  bltz a1, @o
  nop
  bltz a2, @o
  nop
  slti t9, a0, W
  beqz t9, @o
  nop
  slti t9, a1, H
  beqz t9, @o
  nop
  slti t9, a2, D
  beqz t9, @o
  nop
  sll t9, a1, 10
  sll v0, a2, 5
  addu t9, t9, v0
  addu t9, t9, a0
  la v0, world
  addu t9, t9, v0
  lbu v0, 0(t9)
@o:
  jr ra
  nop

; ねらい: 目から向きへ 1/8 ブロックずつ 6 ブロックまで進み、はじめに当たったかたいブロック（V_TGT）と、その手前の空いた場所（V_PLC）
aim:
  addiu sp, sp, -24
  sw ra, 0(sp)
  sw s0, 4(sp)
  sw s1, 8(sp)
  sw s2, 12(sp)
  sw s3, 16(sp)
  sw s4, 20(sp)
  ; 向き: (sin yaw × cos pit, sin pit, cos yaw × cos pit) × 32/4096
  lw a0, V_PIT(gp)
  nop
  sra a0, a0, 8
  jal sincos
  nop
  move s3, t0                ; sin pit
  move s4, t1                ; cos pit
  lw a0, V_YAW(gp)
  nop
  srl a0, a0, 8
  jal sincos
  nop
  mult t0, s4
  mflo s0
  sra s0, s0, 19             ; dx（×32/4096 → 12+7 ビット右）
  mult t1, s4
  mflo s2
  sra s2, s2, 19             ; dz
  sra s1, s3, 7              ; dy
  lw t4, V_CX(gp)
  lw t5, V_EY(gp)
  lw t6, V_CZ(gp)
  li t7, -1                  ; ひとつ前の場所（番号）
  li t8, 48
@step:
  addu t4, t4, s0
  addu t5, t5, s1
  addu t6, t6, s2
  sra a0, t4, 8
  sra a1, t5, 8
  sra a2, t6, 8
  bltz a0, @miss
  nop
  bltz a1, @miss
  nop
  bltz a2, @miss
  nop
  slti v0, a0, W
  beqz v0, @miss
  nop
  slti v0, a1, H
  beqz v0, @miss
  nop
  slti v0, a2, D
  beqz v0, @miss
  nop
  sll v1, a1, 10
  sll v0, a2, 5
  addu v1, v1, v0
  addu v1, v1, a0            ; 番号
  beq v1, t7, @next
  nop
  la v0, world
  addu v0, v0, v1
  lbu v0, 0(v0)
  nop
  beqz v0, @empty
  nop
  xori v0, v0, 9
  beqz v0, @empty
  nop
  ; 当たった
  sw v1, V_TGT(gp)
  sw t7, V_PLC(gp)
  ; 面の向き: ひとつ前の場所とのちがい（番号の差で）
  subu v0, t7, v1
  li a3, 2                   ; +y（上）
  li t9, 1024
  beq v0, t9, @face
  nop
  li a3, 3
  li t9, -1024
  beq v0, t9, @face
  nop
  li a3, 4                   ; +z
  li t9, 32
  beq v0, t9, @face
  nop
  li a3, 5
  li t9, -32
  beq v0, t9, @face
  nop
  li a3, 0                   ; +x
  li t9, 1
  beq v0, t9, @face
  nop
  li a3, 1
@face:
  sw a3, V_TGTF(gp)
  b @done
  nop
@empty:
  move t7, v1
@next:
  addiu t8, t8, -1
  bnez t8, @step
  nop
@miss:
  li t0, -1
  sw t0, V_TGT(gp)
  sw t0, V_PLC(gp)
@done:
  lw ra, 0(sp)
  lw s0, 4(sp)
  lw s1, 8(sp)
  lw s2, 12(sp)
  lw s3, 16(sp)
  lw s4, 20(sp)
  jr ra
  addiu sp, sp, 24

; a0 = 作る物の番号 → v0 = 作れるなら 1（材料が足りる・刃はまだ持っていない）
cancraft:
  la t0, recipes
  sll t1, a0, 3
  addu t0, t0, t1
  lbu t1, 0(t0)
  li t2, 13
  bne t1, t2, @c1
  nop
  lw t2, V_BLADE(gp)
  nop
  bnez t2, @no
  nop
@c1:
  la t3, inv
  lbu t1, 2(t0)
  lbu t2, 3(t0)
  addu t4, t3, t1
  lbu t4, 0(t4)
  nop
  slt t4, t4, t2
  bnez t4, @no
  nop
  lbu t1, 4(t0)
  lbu t2, 5(t0)
  beqz t1, @yes
  addu t4, t3, t1
  lbu t4, 0(t4)
  nop
  slt t4, t4, t2
  bnez t4, @no
  nop
@yes:
  jr ra
  li v0, 1
@no:
  jr ra
  li v0, 0
