; カワセミ ダイブ（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs kingfisher（絵の番号 T_・S_、画面のデータ、ダイブの決まりの数は data.mjs が足す）
; 決まり: カワセミは枝にとまって魚を待つ。A でまっすぐ下へとびこみ、くちばしが魚に重なれば とれる。
;   とった魚は枝へもちかえって、枝にたたきつけてから のみこむ（本物のカワセミも そうする）。大きい魚ほど点が高く、おなかも ふくれる。
;   おなかは だんだん へる。とびこむのにも 力がいる。ナマズは大きすぎて くわえられず、はじかれる。おなかが からになると おしまい
; 画面は動かさない（字の段も 景色も止めたまま）

PPUCTRL = $2000
PPUMASK = $2001
PPUSTATUS = $2002
OAMADDR = $2003
PPUSCROLL = $2005
PPUADDR = $2006
PPUDATA = $2007
OAMDMA = $4014
JOY1 = $4016

CTRL_ON = %10001000   ; NMI あり・スプライトの絵は $1000・背景は $0000
MASK_ON = %00011010   ; 背景とスプライトを出す（左の 8 ドットはスプライトを隠す＝左から来る魚が すっと出る）

BTN_A = $80
BTN_B = $40
BTN_START = $10

BX = 80            ; カワセミの左の x（とびこむ列はいつも同じ）
; BEAKX（くちばしの x）・PERCH_Y（とまっているときの絵の上の y）・DV0・AIR_ACC・VMAX・WATER_DEC・UP_W・UP_A は data.mjs の DIVE
SURF = 128         ; 水の面の y
NF = 5             ; 魚の数
FOOD_MAX = 48
DIVE_COST = 2      ; とびこむのに使う おなか
BONK_COST = 10     ; ナマズに はじかれると へる おなか
B_PERCH = 0
B_DIVE = 1
B_UP = 2
B_EAT = 3

; ---- ゼロページ ----
nmi_count = $00
buf_ready = $01
buf_len = $02
frame = $03
pad = $04
pad_old = $05
pad_new = $06
state = $07        ; 0 タイトル・1 あそぶ・2 おわり
rng = $08          ; 2バイト
tmp = $0A
tmp2 = $0B
tmp3 = $0C
tmp4 = $0D
ptr = $0E          ; 2バイト
by = $10           ; カワセミの絵の上の y（8.8）
byl = $11
bvl = $12          ; たての速さ（8.8・符号つき）
bvh = $13
bst = $14          ; B_PERCH・B_DIVE・B_UP・B_EAT
btm = $15          ; ようすの のこり時間
carry = $16        ; くわえている魚（0 なし・1 小・2 中・3 大）
bwet = $17         ; 1 = 水の中
score = $18        ; 4 けた（上のけたから）
hi = $1C           ; 4 けた
food = $20         ; おなか（0〜48）
foodl = $21
level = $22        ; 0〜7（とった魚 4 ひきごと）
caught = $23
sp_t = $24
oam_i = $25
end_t = $26
lang = $27
blink_old = $28
hint_on = $29
newrec = $2A
gw = $2B
gh = $2C
mus_on = $2D
paused = $2E
demo_t = $2F
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
f_type = $40       ; 0 なし・1 小・2 中・3 大・4 ナマズ（NF ずつ）
f_x = $45          ; 左の x（16 ビットの下）
f_xh = $4A         ; 上（0 画面の中・1 右の外・$FF 左の外）
f_xl = $4F         ; ドットより下
f_y = $54          ; まん中の y
f_sl = $59         ; 速さ（8.8）
f_sh = $5E
f_dir = $63        ; 0 右へ・1 左へ
spl_t = $68        ; しぶきの のこり
pop_t = $69        ; 点の字の のこり
pop_y = $6A
pop_n = $6B        ; 点の字のまん中の絵
gx = $6C           ; draw_obj: x（16 ビット）
gxh = $6D
gc = $6E
gr = $6F
gflip = $70
gbase = $71
gattr = $72
gx0 = $73
gxh0 = $74
bonk = $75         ; はじかれて点めつする のこり
tmp5 = $76
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "KF01"・いちばん高い点 4 けた

OAM = $0200
BUF = $0300

.org $8000

; ================= はじめ =================
reset:
  sei
  cld
  ldx #$40
  stx $4017
  ldx #$ff
  txs
  inx
  stx PPUCTRL
  stx PPUMASK
  stx $4010
  bit PPUSTATUS
@vw1:
  bit PPUSTATUS
  bpl @vw1
  lda #0
  tax
@clr:
  sta $00,x
  sta $0100,x
  sta $0300,x
  sta $0400,x
  sta $0500,x
  sta $0600,x
  sta $0700,x
  inx
  bne @clr
  lda #$ff
@hide:
  sta OAM,x
  inx
  bne @hide
@vw2:
  bit PPUSTATUS
  bpl @vw2
  lda #%00001111
  sta $4015
  lda #$5b
  sta rng
  lda #$c3
  sta rng+1
  jsr load_palette
  jsr load_save
  lda #CTRL_ON
  sta PPUCTRL
  jsr go_title

main:
  jsr read_pad
  lda state
  bne @n1
  jsr title_update
  jmp @done
@n1:
  cmp #1
  bne @n2
  jsr play_update
  jmp @done
@n2:
  jsr end_update
@done:
  jsr music_update
  jsr wait_frame
  jmp main

irq:
  rti

; ================= 帰線（NMI） =================
nmi:
  pha
  txa
  pha
  tya
  pha
  lda #0
  sta OAMADDR
  lda #>OAM
  sta OAMDMA
  lda buf_ready
  beq @skip
  ldx #0
@ent:
  lda BUF,x
  beq @end
  sta PPUADDR
  lda BUF+1,x
  sta PPUADDR
  ldy BUF+2,x
  inx
  inx
  inx
@dat:
  lda BUF,x
  sta PPUDATA
  inx
  dey
  bne @dat
  jmp @ent
@end:
  lda #0
  sta buf_ready
  sta buf_len
@skip:
  lda #0
  sta PPUSCROLL
  sta PPUSCROLL
  lda #CTRL_ON
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  inc nmi_count
  pla
  tay
  pla
  tax
  pla
  rti

; 書くものを閉じて、つぎの帰線を待つ
wait_frame:
  ldx buf_len
  lda #0
  sta BUF,x
  lda #1
  sta buf_ready
  lda nmi_count
@w:
  cmp nmi_count
  beq @w
  inc frame
  rts

; ================= 画面の道具 =================
screen_off:
  jsr wait_frame
  lda #0
  sta PPUCTRL
  sta PPUMASK
  rts

screen_on:
  lda #0
  sta buf_len
  bit PPUSTATUS
@w:
  bit PPUSTATUS
  bpl @w
  lda #0
  sta PPUSCROLL
  sta PPUSCROLL
  lda #CTRL_ON
  sta PPUCTRL
  lda #MASK_ON
  sta PPUMASK
  rts

load_palette:
  bit PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #0
  sta PPUADDR
  ldx #0
@l:
  lda palette,x
  sta PPUDATA
  inx
  cpx #32
  bne @l
  rts

; ptr の 1024 バイトを画面の表 $2000 へ（画面を消してから）
draw_nt:
  bit PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldx #4
  ldy #0
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  bne @l
  inc ptr+1
  dex
  bne @l
  rts

; ptr の字のデータ（番地・長さ・中身）を、画面を消したまま書く
vram_msg:
  bit PPUSTATUS
  ldy #0
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  sta PPUADDR
  iny
  lda (ptr),y
  tax
  iny
@l:
  lda (ptr),y
  sta PPUDATA
  iny
  dex
  bne @l
  rts

; 4 けたの数を、画面を消したまま書く: A = 番地の上・tmp = 下・X = ゼロページの数の場所
vram_digits:
  bit PPUSTATUS
  sta PPUADDR
  lda tmp
  sta PPUADDR
  ldy #4
@l:
  lda $00,x
  clc
  adc #T_0
  sta PPUDATA
  inx
  dey
  bne @l
  rts

; 書くものの見出し: A = 番地の上・X = 下・Y = 長さ
buf_head:
  sty tmp
  ldy buf_len
  sta BUF,y
  txa
  sta BUF+1,y
  lda tmp
  sta BUF+2,y
  iny
  iny
  iny
  sty buf_len
  rts

buf_byte:
  ldy buf_len
  sta BUF,y
  inc buf_len
  rts

; ptr のデータ（番地・長さ・中身）をそのまま書くものへ
buf_data:
  ldy #2
  lda (ptr),y
  clc
  adc #3
  sta tmp2
  ldy #0
  ldx buf_len
@l:
  lda (ptr),y
  sta BUF,x
  inx
  iny
  cpy tmp2
  bne @l
  stx buf_len
  rts

; A = 字の番号（M_…）→ ptr にことばの字
say_ptr:
  ldx lang
  beq @j
  clc
  adc #MSG_N
@j:
  tax
  lda msg_lo,x
  sta ptr
  lda msg_hi,x
  sta ptr+1
  rts

; A = 字の番号 → そのまま書くものへ
say_buf:
  jsr say_ptr
  jmp buf_data

; スプライト1つ: tmp = y・tmp2 = 絵・tmp3 = 色と向き・tmp4 = x（X はこわさない）
put_spr:
  ldy oam_i
  beq @full
  lda tmp
  sta OAM,y
  lda tmp2
  sta OAM+1,y
  lda tmp3
  sta OAM+2,y
  lda tmp4
  sta OAM+3,y
  tya
  clc
  adc #4
  sta oam_i
@full:
  rts

; gw×gh 枚の絵（gbase から順に）を gx・gxh（16 ビット）と tmp（y）に。gflip = 1 で左右さかさ。画面の外の絵は出さない
;   色は gattr（gflip のときは $40 も足す）。X はこわさない
draw_obj:
  lda gx
  sta gx0
  lda gxh
  sta gxh0
  lda gattr
  ldy gflip
  beq @na
  ora #$40
@na:
  sta tmp3
  lda gh
  sta gr
@row:
  lda gx0
  sta gx
  lda gxh0
  sta gxh
  lda #0
  sta gc
@col:
  lda gxh
  bne @skip
  lda gx
  sta tmp4
  lda gflip
  beq @fw
  lda gw               ; さかさ: 右から
  sec
  sbc gc
  sec
  sbc #1
  jmp @t
@fw:
  lda gc
@t:
  clc
  adc gbase
  sta tmp2
  jsr put_spr
@skip:
  lda gx
  clc
  adc #8
  sta gx
  lda gxh
  adc #0
  sta gxh
  inc gc
  lda gc
  cmp gw
  bne @col
  lda gbase
  clc
  adc gw
  sta gbase
  lda tmp
  clc
  adc #8
  sta tmp
  dec gr
  bne @row
  rts

; 絵のかたまり（左右そのまま・画面の中）: A = 絵・X = x・Y = y・gw・gh・gattr はよびだすまえに
draw_at:
  sta gbase
  stx gx
  sty tmp
  lda #0
  sta gxh
  sta gflip
  jmp draw_obj

; スプライトを出しはじめる（0 番は使わない）
oam_start:
  lda #$ff
  sta OAM
  lda #4
  sta oam_i
  rts

hide_rest:
  ldx oam_i
  beq @r
  lda #$ff
@l:
  sta OAM,x
  inx
  inx
  inx
  inx
  bne @l
@r:
  rts

read_pad:
  lda pad
  sta pad_old
  lda #1
  sta JOY1
  sta pad
  lda #0
  sta JOY1
@l:
  lda JOY1
  lsr a
  rol pad
  bcc @l
  lda pad_old
  eor #$ff
  and pad
  sta pad_new
  rts

rand:
  ldy #8
  lda rng
@l:
  asl a
  rol rng+1
  bcc @n
  eor #$39
@n:
  dey
  bne @l
  sta rng
  rts

; ================= タイトル =================
go_title:
  ldx #0
  lda LANG
  cmp #1
  bne @lj
  inx
@lj:
  stx lang
  jsr screen_off
  lda #<nt_title_0
  ldx #>nt_title_0
  ldy lang
  beq @t0
  lda #<nt_title_1
  ldx #>nt_title_1
@t0:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda #<ADDR_THI
  sta tmp
  lda #>ADDR_THI
  ldx #hi
  jsr vram_digits
  lda #0
  sta state
  sta paused
  sta blink_old
  jsr reset_bird
  jsr clear_fish
  lda #20
  sta sp_t
  lda #60
  sta demo_t
  lda #SONG_MAIN
  jsr music_play
  jsr draw_all
  jsr screen_on
  rts

reset_bird:
  lda #PERCH_Y
  sta by
  lda #0
  sta byl
  sta bvl
  sta bvh
  sta bst
  sta btm
  sta carry
  sta bwet
  sta spl_t
  sta pop_t
  sta bonk
  rts

clear_fish:
  lda #0
  ldx #NF-1
@l:
  sta f_type,x
  dex
  bpl @l
  rts

blink_push:
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jmp say_buf
@off:
  lda #M_PUSH_OFF
  jmp say_buf
@same:
  rts

title_update:
  jsr blink_push
  ; 見本: 浅い所を通る魚が ちょうどよい所に来たら とびこむ
  lda bst
  bne @move
  lda btm
  bne @move
  lda demo_t
  beq @look
  dec demo_t
  jmp @move
@look:
  ldx #NF-1
@f:
  lda f_type,x
  beq @fn
  lda f_xh,x
  bne @fn
  ldy f_type,x
  lda f_x,x
  clc
  adc f_half-1,y       ; まん中の x
  ldy f_dir,x
  sec
  sbc demo_lo,y
  cmp #6
  bcs @fn
  jsr start_dive
  lda #90
  sta demo_t
  jmp @move
@fn:
  dex
  bpl @f
@move:
  jsr update_bird
  jsr spawn_shallow
  jsr update_fish
  jsr draw_all
  lda pad_new
  and #BTN_START
  beq @r
  jsr start_game
@r:
  rts

; ================= あそぶ =================
start_game:
  jsr screen_off
  lda #<nt_play_0
  ldx #>nt_play_0
  ldy lang
  beq @p0
  lda #<nt_play_1
  ldx #>nt_play_1
@p0:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  lda #M_HINT            ; はじめの案内（はじめて とびこんだら消す）
  jsr say_ptr
  jsr vram_msg
  lda #1
  sta hint_on
  lda #0
  ldx #3
@z:
  sta score,x
  dex
  bpl @z
  sta level
  sta caught
  sta paused
  sta newrec
  sta foodl
  lda #FOOD_MAX
  sta food
  jsr reset_bird
  jsr clear_fish
  lda #30
  sta sp_t
  lda frame
  eor rng
  sta rng
  lda #1
  sta state
  jsr draw_all
  jsr hud
  jsr screen_on
  rts

play_update:
  lda pad_new
  and #BTN_START
  beq @np
  lda paused
  eor #1
  sta paused
  beq @unp
  lda #$30           ; 止めたら音も止める
  sta $4000
  sta $4004
  sta $400C
  lda #$80
  sta $4008
  sta $400B
  lda #M_PAUSE
  jsr say_buf
  jmp @np
@unp:
  lda #M_PAUSE_OFF
  jsr say_buf
  lda hint_on
  beq @np
  lda #M_HINT
  jsr say_buf
@np:
  lda paused
  beq @run
  rts
@run:
  lda pad_new
  and #BTN_A|BTN_B
  beq @nodive
  lda bst
  bne @nodive
  lda btm
  bne @nodive
  jsr start_dive
  lda food             ; とびこむのにも力がいる
  sec
  sbc #DIVE_COST
  bcs @fc
  lda #0
  sta foodl
@fc:
  sta food
  lda hint_on
  beq @nodive
  lda #0
  sta hint_on
  lda #M_HINT_OFF
  jsr say_buf
@nodive:
  jsr update_bird
  jsr spawn
  jsr update_fish
  ; おなかが へる
  ldx level
  lda foodl
  sec
  sbc drain_tab,x
  sta foodl
  bcs @nd
  lda food
  beq @z0
  dec food
  jmp @nd
@z0:
  lda #0
  sta foodl
@nd:
  jsr draw_all
  jsr hud
  ; おなかが からで、枝で 待っているなら おしまい
  lda food
  bne @r
  lda bst
  bne @r
  jsr go_end
@r:
  rts

start_dive:
  lda #B_DIVE
  sta bst
  lda #<DV0
  sta bvl
  lda #>DV0
  sta bvh
  lda #0
  sta byl
  sta bwet
  jsr sfx_dive
  rts

; ---- カワセミ ----
update_bird:
  lda bst
  cmp #B_DIVE
  bne @n1
  jmp bird_dive
@n1:
  cmp #B_UP
  bne @n2
  jmp bird_up
@n2:
  cmp #B_EAT
  bne @n3
  jmp bird_eat
@n3:
  lda btm
  beq @r
  dec btm
@r:
  rts

bird_dive:
  lda by
  clc
  adc #23
  cmp #SURF
  bcs @water
  lda bvl              ; 空: 落ちるほど速く（いちばん上 VMAX）
  clc
  adc #AIR_ACC
  sta bvl
  lda bvh
  adc #0
  sta bvh
  cmp #>VMAX
  bcc @mv
  lda #>VMAX
  sta bvh
  lda bvl
  cmp #<VMAX
  bcc @mv
  lda #<VMAX
  sta bvl
  jmp @mv
@water:
  lda bwet
  bne @wet
  lda #1
  sta bwet
  lda #16
  sta spl_t
  jsr sfx_splash
@wet:
  lda bvl              ; 水: だんだん おそく。止まったら はずれ
  sec
  sbc #WATER_DEC
  sta bvl
  lda bvh
  sbc #0
  sta bvh
  bpl @mv
  lda #B_UP
  sta bst
  rts
@mv:
  lda byl
  clc
  adc bvl
  sta byl
  lda by
  adc bvh
  sta by
  lda bwet
  beq @r
  jsr check_catch
@r:
  rts

bird_up:
  ; 水の中は ゆっくり、出たら はばたいて枝へ
  ldx #<UP_W
  ldy #>UP_W
  lda bwet
  beq @air
  lda by
  clc
  adc #16
  cmp #SURF
  bcs @set
  lda #0
  sta bwet
  lda #16
  sta spl_t
  jsr sfx_out
@air:
  ldx #<UP_A
  ldy #>UP_A
@set:
  txa
  clc
  adc byl
  sta byl
  tya
  adc by
  sta by
  cmp #PERCH_Y
  beq @home
  bcs @r
@home:
  lda #PERCH_Y
  sta by
  lda #0
  sta byl
  lda carry
  beq @empty
  lda #B_EAT
  sta bst
  lda #48
  sta btm
  rts
@empty:
  lda #B_PERCH
  sta bst
  lda #6
  sta btm
@r:
  rts

; 枝で魚をたたいてから のみこむ（本物のカワセミは 魚を枝にたたきつけて 弱らせ、頭から のむ）
bird_eat:
  dec btm
  lda btm
  cmp #40
  beq @wh
  cmp #24
  bne @nw
@wh:
  jsr sfx_whack
@nw:
  lda btm
  bne @r
  ldy carry
  lda pop_tile-1,y     ; 点の字
  sta pop_n
  lda #40
  sta pop_t
  lda #PERCH_Y-10
  sta pop_y
  lda state
  cmp #1
  bne @done
  ; 点
  lda pts-1,y
  clc
  adc score+2
  sta score+2
  ldx #2
@cy:
  lda score,x
  cmp #10
  bcc @cok
  sbc #10
  sta score,x
  dex
  bmi @max
  inc score,x
  jmp @cy
@max:
  lda #9
  ldx #3
@m9:
  sta score,x
  dex
  bpl @m9
@cok:
  ; おなか
  ldy carry
  lda gain-1,y
  clc
  adc food
  cmp #FOOD_MAX
  bcc @fok
  lda #FOOD_MAX
@fok:
  sta food
  ; 段: 4 ひきごと（7 まで）
  inc caught
  lda caught
  lsr a
  lsr a
  cmp #7
  bcc @lv
  lda #7
@lv:
  sta level
@done:
  jsr sfx_gulp
  lda #0
  sta carry
  lda #B_PERCH
  sta bst
  lda #4
  sta btm
@r:
  rts

; くちばし（BEAKX, by+23）が魚に重なったか
check_catch:
  lda by
  clc
  adc #23
  sta tmp5
  ldx #NF-1
@l:
  ldy f_type,x
  beq @next
  lda tmp5             ; たて
  sec
  sbc f_y,x
  bcs @py
  eor #$ff
  adc #1
@py:
  cmp f_hh-1,y
  bcs @next
  lda #BEAKX+2         ; よこ（16 ビット）
  sec
  sbc f_x,x
  sta tmp
  lda #0
  sbc f_xh,x
  bne @next
  lda tmp
  cmp f_hitw-1,y
  bcs @next
  cpy #4
  beq @cat
  sty carry            ; とれた
  lda #0
  sta f_type,x
  lda #B_UP
  sta bst
  jsr sfx_catch
  rts
@cat:
  lda #B_UP            ; ナマズ: 大きすぎて くわえられない。はじかれて おなかが へる
  sta bst
  lda #40
  sta bonk
  lda state
  cmp #1
  bne @nc
  lda food
  sec
  sbc #BONK_COST
  bcs @fc
  lda #0
@fc:
  sta food
@nc:
  jsr sfx_bonk
  rts
@next:
  dex
  bpl @l
  rts

; ---- 魚 ----
; あいている場所を X に（なければ キャリー 1）
free_slot:
  ldx #NF-1
@f:
  lda f_type,x
  beq @got
  dex
  bpl @f
  sec
  rts
@got:
  clc
  rts

spawn:
  dec sp_t
  beq @go
  rts
@go:
  ldx level
  lda spawn_iv,x
  sta sp_t
  jsr free_slot
  bcc @ok
  rts
@ok:
  jsr rand
  and #15
  sta tmp
  lda level
  asl a
  asl a
  asl a
  asl a
  ora tmp
  tay
  lda mix,y
  sta tmp4             ; 種類
  cmp #4
  bne @typ
  ldy #NF-1            ; ナマズは 1 ぴきだけ
@cc:
  lda f_type,y
  cmp #4
  beq @two
  dey
  bpl @cc
  jmp @typ
@two:
  lda #2
  sta tmp4
@typ:
  jsr rand             ; 深さ
  and #3
  sta tmp
  lda tmp4
  sec
  sbc #1
  asl a
  asl a
  ora tmp
  tay
  lda lanes,y
  sta f_y,x
  ldy tmp4             ; 速さ = 種類の速さ + 段 × $18 + でたらめ
  lda level
  asl a
  asl a
  asl a
  sta tmp
  asl a
  clc
  adc tmp
  sta tmp
  jsr rand
  and #$3f
  clc
  adc tmp
  ldy tmp4             ; rand は Y をこわす
  clc
  adc spd_lo-1,y
  sta f_sl,x
  lda spd_hi-1,y
  adc #0
  sta f_sh,x
  jmp place_fish

; タイトルと結果の画面: 浅い所（138）を 小と中の魚が ふつうの速さで
spawn_shallow:
  dec sp_t
  beq @go
  rts
@go:
  lda #70
  sta sp_t
  jsr free_slot
  bcc @ok
  rts
@ok:
  jsr rand
  and #1
  clc
  adc #1
  sta tmp4
  lda #138
  sta f_y,x
  lda #0
  sta f_sl,x
  lda #1
  sta f_sh,x
  ; ここから place_fish

; X の場所に tmp4 の種類の魚を置く（向きは でたらめ）。右へ行くなら左の外から、左へ行くなら右の外から
place_fish:
  lda tmp4
  sta f_type,x
  lda #0
  sta f_xl,x
  jsr rand
  and #1
  sta f_dir,x
  bne @fromR
  ldy tmp4
  lda #0
  sec
  sbc f_w-1,y
  sta f_x,x
  lda #$ff
  sta f_xh,x
  rts
@fromR:
  lda #0
  sta f_x,x
  lda #1
  sta f_xh,x
  rts

update_fish:
  ldx #NF-1
@l:
  lda f_type,x
  beq @next
  lda f_dir,x
  bne @left
  lda f_xl,x
  clc
  adc f_sl,x
  sta f_xl,x
  lda f_x,x
  adc f_sh,x
  sta f_x,x
  lda f_xh,x
  adc #0
  sta f_xh,x
  cmp #1
  bne @next
  beq @kill
@left:
  lda f_xl,x
  sec
  sbc f_sl,x
  sta f_xl,x
  lda f_x,x
  sbc f_sh,x
  sta f_x,x
  lda f_xh,x
  sbc #0
  sta f_xh,x
  cmp #$ff
  bne @next
  lda f_x,x
  cmp #$c8
  bcs @next
@kill:
  lda #0
  sta f_type,x
@next:
  dex
  bpl @l
  rts

; ---- 絵 ----
draw_all:
  jsr oam_start
  ; 点の字（上へ のぼって消える）
  lda pop_t
  beq @nopop
  dec pop_t
  lda pop_t
  and #3
  bne @pp
  dec pop_y
@pp:
  lda #3
  sta gattr
  lda #1
  sta gw
  sta gh
  lda #S_PLUS
  ldx #BX-2
  ldy pop_y
  jsr draw_at
  lda pop_n
  ldx #BX+6
  ldy pop_y
  jsr draw_at
  lda #S_N0
  ldx #BX+14
  ldy pop_y
  jsr draw_at
@nopop:
  ; カワセミ（はじかれたあとは点めつ）
  lda bonk
  beq @nb
  dec bonk
  and #2
  beq @nb
  jmp @nobird
@nb:
  lda #0
  sta gattr
  lda bst
  cmp #B_DIVE
  beq @dive
  cmp #B_UP
  beq @fly
  ; とまっている・たべている
  lda #2
  sta gw
  lda #3
  sta gh
  lda bst
  cmp #B_EAT
  beq @eat
  lda frame            ; ときどき頭をふって川をのぞく
  and #$3f
  cmp #10
  lda #S_PERCHA
  bcs @pa
  lda #S_PERCHB
@pa:
  ldx #BX
  ldy by
  jsr draw_at
  jmp @nobird
@eat:
  lda btm              ; 魚を枝にたたきつける
  and #8
  beq @e1
  lda #S_PERCHB
  ldx #BX
  ldy by
  jsr draw_at
  lda by
  clc
  adc #6
  sta tmp5
  jmp @carry
@e1:
  lda #S_PERCHA
  ldx #BX
  ldy by
  jsr draw_at
  lda by
  clc
  adc #4
  sta tmp5
  lda #BX+15
  jmp @carry2
@dive:
  lda #2
  sta gw
  lda #3
  sta gh
  lda frame
  and #4
  beq @d0
  lda #S_DIVEB
  bne @d1
@d0:
  lda #S_DIVEA
@d1:
  ldx #BX
  ldy by
  jsr draw_at
  jmp @nobird
@fly:
  lda #3
  sta gw
  lda #2
  sta gh
  ldx #BX-4
  lda by
  clc
  adc #4
  tay
  lda frame
  and #4
  beq @f2
  lda #S_FLYB
  bne @f3
@f2:
  lda #S_FLYA
@f3:
  jsr draw_at
  lda carry
  beq @nobird
  lda by
  clc
  adc #9
  sta tmp5
  lda #BX+19
  jmp @carry2
@carry:
  lda #BX+15
@carry2:
  ; くわえた魚: A = くちばしの先の x・tmp5 = 上の y
  ldy carry
  sec
  sbc f_half-1,y
  sta gx
  lda #0
  sta gxh
  sta gflip
  lda tmp5
  sta tmp
  lda #1
  sta gattr
  sta gh
  lda f_tw-1,y
  sta gw
  lda f_tile-1,y
  sta gbase
  jsr draw_obj
@nobird:
  ; しぶき
  lda spl_t
  beq @nospl
  dec spl_t
  lda #3
  sta gattr
  lda #2
  sta gw
  lda #1
  sta gh
  lda spl_t
  cmp #8
  lda #S_SPLB
  bcc @sp
  lda #S_SPLA
@sp:
  ldx #BX
  ldy #SURF-8
  jsr draw_at
@nospl:
  ; 魚
  ldx #NF-1
@fl:
  lda f_type,x
  beq @fn
  jsr draw_fish
@fn:
  dex
  bpl @fl
  jsr hide_rest
  rts

; X の魚を出す（尾を ふる 2 こま）
draw_fish:
  ldy f_type,x
  lda f_tw-1,y
  sta gw
  lda f_th-1,y
  sta gh
  lda f_pal-1,y
  sta gattr
  lda f_y,x
  sec
  sbc f_yoff-1,y
  sta tmp
  lda frame
  lsr a
  lsr a
  lsr a
  sta tmp5
  txa
  clc
  adc tmp5
  and #1
  beq @a
  lda f_frm-1,y
@a:
  clc
  adc f_tile-1,y
  sta gbase
  lda f_x,x
  sta gx
  lda f_xh,x
  sta gxh
  lda f_dir,x
  sta gflip
  jmp draw_obj

; 字の段: 点・おなかの ぼう
hud:
  lda #>ADDR_SCORE
  ldx #<ADDR_SCORE
  ldy #4
  jsr buf_head
  ldx #0
@l:
  lda score,x
  clc
  adc #T_0
  jsr buf_byte
  inx
  cpx #4
  bne @l
  lda #>ADDR_BAR
  ldx #<ADDR_BAR
  ldy #6
  jsr buf_head
  lda food
  sta tmp4
  ldx #6
@b:
  lda tmp4
  cmp #8
  bcc @part
  sbc #8
  sta tmp4
  lda #8
  jmp @put
@part:
  lda tmp4
  ldy #0
  sty tmp4
@put:
  clc
  adc #T_BAR0
  jsr buf_byte
  dex
  bne @b
  rts

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  ldx #0
@c:
  lda score,x
  cmp hi,x
  bcc @nohi
  bne @newhi
  inx
  cpx #4
  bne @c
  jmp @nohi
@newhi:
  ldx #3
@cp:
  lda score,x
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @cp
  lda #1
  sta newrec
@nohi:
  lda #SONG_OVER
  jsr music_play
  rts

end_update:
  lda end_t
  cmp #200
  bcs @k
  inc end_t
@k:
  lda end_t
  cmp #50
  bcs @res
  ; しばらく そのまま（カワセミは 枝で うなだれる）
  jsr update_fish
  jsr draw_all
  rts
@res:
  bne @wait
  jsr screen_off
  lda #<nt_end_0
  ldx #>nt_end_0
  ldy lang
  beq @p0
  lda #<nt_end_1
  ldx #>nt_end_1
@p0:
  sta ptr
  stx ptr+1
  jsr draw_nt
  lda #M_E_SCORE
  jsr say_ptr
  jsr vram_msg
  lda #M_E_BEST
  jsr say_ptr
  jsr vram_msg
  lda newrec
  beq @nn
  lda #M_E_NEW
  jsr say_ptr
  jsr vram_msg
@nn:
  lda #<ADDR_ESCORE
  sta tmp
  lda #>ADDR_ESCORE
  ldx #score
  jsr vram_digits
  lda #<ADDR_EBEST
  sta tmp
  lda #>ADDR_EBEST
  ldx #hi
  jsr vram_digits
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  jsr reset_bird
  jsr clear_fish
  lda #20
  sta sp_t
  jsr draw_all
  jsr hud
  jsr screen_on
  rts
@wait:
  jsr spawn_shallow
  jsr update_fish
  jsr update_bird
  jsr draw_all
  jsr hud
  lda end_t
  cmp #80
  bcc @r
  jsr blink_push
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
; とびこむ: カワセミの「チーッ」（高い笛の音が下がる）
sfx_dive:
  lda #%10011001
  sta $4000
  lda #%10100011
  sta $4001
  lda #$50
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_splash:
  lda #%00000100
  sta $400C
  lda #$06
  sta $400E
  lda #$20
  sta $400F
  rts

sfx_out:
  lda #%00000011
  sta $400C
  lda #$04
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_catch:
  lda #%01011000
  sta $4000
  lda #%10001010
  sta $4001
  lda #$70
  sta $4002
  lda #$08
  sta $4003
  rts

sfx_whack:
  lda #%00000010
  sta $400C
  lda #$0c
  sta $400E
  lda #$08
  sta $400F
  rts

sfx_gulp:
  lda #%10011000
  sta $4000
  lda #%10011010
  sta $4001
  lda #$40
  sta $4002
  lda #$09
  sta $4003
  rts

sfx_bonk:
  lda #%10011100
  sta $4000
  lda #%10010011
  sta $4001
  lda #$60
  sta $4002
  lda #$0a
  sta $4003
  lda #%00000100
  sta $400C
  lda #$0e
  sta $400E
  lda #$18
  sta $400F
  rts

; ================= セーブ =================
load_save:
  ldx #3
@c:
  lda SAVE,x
  cmp save_magic,x
  bne @new
  dex
  bpl @c
  ldx #3
@d:
  lda SAVE+4,x
  cmp #10
  bcs @new
  sta hi,x
  dex
  bpl @d
  rts
@new:
  ldx #3
@w:
  lda save_magic,x
  sta SAVE,x
  lda #0
  sta hi,x
  sta SAVE+4,x
  dex
  bpl @w
  rts

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）

; ================= 決まりの表（種類 1 小・2 中・3 大・4 ナマズ の順） =================
save_magic: .byte 'K', 'F', '0', '1'
f_w: .byte 8, 16, 24, 32
f_half: .byte 4, 8, 12, 16
f_hitw: .byte 13, 21, 29, 36      ; くちばしが入れば とれる はば（魚の はば ＋ 5）
f_hh: .byte 5, 5, 5, 7            ; たての近さ
f_tw: .byte 1, 2, 3, 4
f_th: .byte 1, 1, 1, 2
f_frm: .byte 1, 2, 3, 8           ; 尾をふる 2 こめの絵までの数
f_tile: .byte S_FSA, S_FMA, S_FLA, S_CATA
f_pal: .byte 1, 1, 1, 2
f_yoff: .byte 4, 4, 4, 9
pts: .byte 1, 3, 5                ; 点（10 の けた）
gain: .byte 7, 11, 16             ; おなか
pop_tile: .byte S_N1, S_N3, S_N5
spd_lo: .byte $f0, $c0, $a0, $70
spd_hi: .byte 0, 0, 0, 0
lanes:                            ; 深さ（大きい魚ほど深い）
  .byte 138, 146, 154, 162
  .byte 146, 154, 166, 176
  .byte 168, 176, 184, 190
  .byte 180, 184, 186, 188
spawn_iv: .byte 72, 66, 60, 56, 52, 48, 44, 40
drain_tab: .byte 8, 9, 10, 12, 14, 16, 18, 21
demo_lo: .byte DEMO_R, DEMO_L     ; 見本: 魚のまん中が ここから 6 ドットのうちに来たら とびこむ
mix:                              ; 段ごとの 16 の くじ
  .byte 1,1,1,1, 2,2,2,2, 2,2,2,2, 3,3,3,3
  .byte 1,1,1,1, 2,2,2,2, 2,2,2,3, 3,3,3,4
  .byte 1,1,1,1, 1,2,2,2, 2,2,2,3, 3,3,4,4
  .byte 1,1,1,1, 1,1,2,2, 2,2,2,3, 3,3,4,4
  .byte 1,1,1,1, 1,1,1,2, 2,2,2,2, 3,3,4,4
  .byte 1,1,1,1, 1,1,1,1, 2,2,2,2, 3,3,4,4
  .byte 1,1,1,1, 1,1,1,1, 1,2,2,2, 3,3,4,4
  .byte 1,1,1,1, 1,1,1,1, 1,1,2,2, 3,4,4,4
