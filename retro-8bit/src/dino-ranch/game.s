; 恐竜かけっこ牧場 8bit（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; もとは「恐竜かけっこ牧場」（dino-race。Planck.js の物理で骨格を走らせる）。8ビットでは物理のかわりに、
; 能力から速さ・加速・転びやすさを決める式（derive。data.mjs の derive と同じ）で走らせる。
; ビルド: node retro-8bit/tools/build.mjs dino-ranch

PPUCTRL = $2000
PPUMASK = $2001
PPUSTATUS = $2002
OAMADDR = $2003
PPUSCROLL = $2005
PPUADDR = $2006
PPUDATA = $2007
OAMDMA = $4014
JOY1 = $4016

CTRL_ON = %10001000
MASK_ON = %00011110   ; 左の8ドットも出す（囲いの角のカーソル）

BTN_A = $80
BTN_B = $40
BTN_SELECT = $20
BTN_START = $10
BTN_UP = $08
BTN_DOWN = $04
BTN_LEFT = $02
BTN_RIGHT = $01

ST_TITLE = 0
ST_RANCH = 1
ST_EGGS = 2
ST_RACE = 3
ST_RESULT = 4
ST_END = 5

FINISH_HI = 5          ; ゴール = 1280 ドット（100m。10m = 128 ドット）
NRUN = 4

; ---- ゼロページ ----
nmi_count = $00
buf_ready = $01
buf_len = $02
frame = $03
pad = $04
pad_old = $05
pad_new = $06
state = $07
rng = $08          ; 2バイト
tmp = $0A
tmp2 = $0B
tmp3 = $0C
tmp4 = $0D
ptr = $0E          ; 2バイト
cursor = $10       ; 牧場の囲い（0〜3）／卵の列（0〜2）
mode = $11         ; 牧場: 0 えらぶ・1 なにをする・2 相手をえらぶ・3 逃がす？・4 お知らせ
msel = $12         ; なにをする: 0 走る・1 かけ合わせ・2 逃がす
sel_a = $13
sel_b = $14
sub = $15          ; 場面の中の時間
cam_lo = $16
cam_hi = $17
race_tl = $18
race_th = $19
places = $1A
count = $1B        ; スタートまで
start_st = $1C     ; 0 ふつう・1 よいスタート・2 フライング
sky_hit = $1D
end_t = $1E
won = $1F
g_s = $20          ; 能力（作業用）
g_l = $21
g_m = $22
g_t = $23
g_p = $24
d_kmh = $25
d_acc = $26
d_fall = $27
tmp5 = $28
tmp6 = $29
tmp7 = $2A
dv_lo = $2B
dv_hi = $2C
mus_on = $2D
paused = $2E
oam_i = $2F
li = $3A          ; put_dino を呼ぶくり返しの番号（put_dino は tmp5・tmp6 を使う）
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
r_xs = $40         ; 走る4頭（0 = じぶん）
r_xl = $44
r_xh = $48
r_spl = $4C
r_sph = $50
r_topl = $54
r_toph = $58
r_acc = $5C
r_fall = $60
r_down = $64
r_place = $68
r_tl = $6C
r_th = $70
r_kmh = $74
lang = $7E          ; 0 かな・1 英語（タイトルのたびに $7FFF から）
cheer_t = $7F       ; ゴールの歓声の のこりフレーム
CHEER_LEN = 156
LANG = $7FFF

OAM = $0200
BUF = $0300
KIDS = $0400       ; 生まれた3頭: 8バイトずつ（つかう・大・脚・筋・尾・速・km/h）
SAVE = $6000       ; 電池の RAM: "DR81"・杯・回・…
SV_CUP = $6004
SV_RACE = $6005
DINO = $6010       ; 4頭 × 8バイト（つかう・大・脚・筋・尾・速・km/h）

.org $8000

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
  lda #$e1
  sta rng
  lda #$7c
  sta rng+1
  jsr load_palette
  lda #CTRL_ON
  sta PPUCTRL
  jsr go_title

main:
  jsr read_pad
  lda state
  asl a
  tax
  lda state_tab,x
  sta ptr
  lda state_tab+1,x
  sta ptr+1
  jsr @call
  jsr cheer_update
  jsr music_update
  jsr wait_frame
  jmp main
@call:
  jmp (ptr)

state_tab:
  .word title_update, ranch_update, eggs_update, race_update, result_update, end_update

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

; ptr の 1024 バイトを、A = $20 か $24 の画面へ
draw_nt:
  jsr lang_fix
  bit PPUSTATUS
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

; 画面を消して、ptr の絵を出す
show_nt:
  jsr screen_off
  lda #$20
  jsr draw_nt
  jsr clear_oam
  rts

; ことばが かなのとき、英語の字・画面を指す ptr を、かなの写しへずらす（英語 → かなの順に同じ形で入っている）
;   字: msg_start〜msg_end → MSG_SIZE バイトあと。画面: nt_title〜nt_ja → 4096 バイトあと。A・X・Y はこわさない
lang_fix:
  pha
  lda lang
  bne @r
  lda ptr
  cmp #<msg_start
  lda ptr+1
  sbc #>msg_start
  bcc @nt
  lda ptr
  cmp #<msg_end
  lda ptr+1
  sbc #>msg_end
  bcs @nt
  lda ptr
  clc
  adc #<MSG_SIZE
  sta ptr
  lda ptr+1
  adc #>MSG_SIZE
  sta ptr+1
  pla
  rts
@nt:
  lda ptr
  cmp #<nt_title
  lda ptr+1
  sbc #>nt_title
  bcc @r
  lda ptr
  cmp #<nt_ja
  lda ptr+1
  sbc #>nt_ja
  bcs @r
  lda ptr+1
  clc
  adc #$10
  sta ptr+1
@r:
  pla
  rts

; ptr の字（番地・長さ・中身）を、画面を消したまま書く
text_now:
  jsr lang_fix
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
@l:
  iny
  lda (ptr),y
  sta PPUDATA
  dex
  bne @l
  rts

; ptr の字の中身だけを、いまの番地へ（番地は呼ぶ前に PPUADDR へ）
text_here:
  jsr lang_fix
  ldy #2
  lda (ptr),y
  tax
@l:
  iny
  lda (ptr),y
  sta PPUDATA
  dex
  bne @l
  rts

; tmp6:tmp5 の番地を PPUADDR へ
set_addr:
  bit PPUSTATUS
  lda tmp6
  sta PPUADDR
  lda tmp5
  sta PPUADDR
  rts

; tmp6:tmp5 に A を足す
add_addr:
  clc
  adc tmp5
  sta tmp5
  bcc @r
  inc tmp6
@r:
  rts

; 能力の棒（A = 0〜15）を4枚、PPUDATA へ
write_bar:
  sta tmp7
  ldx #4
@l:
  lda tmp7
  cmp #4
  bcc @part
  sbc #4
  sta tmp7
  lda #T_BAR4
  jmp @w
@part:
  clc
  adc #T_BAR0
  pha
  lda #0
  sta tmp7
  pla
@w:
  sta PPUDATA
  dex
  bne @l
  rts

; A（0〜99）を2けたで PPUDATA へ
write_num2:
  ldx #0
@t:
  cmp #10
  bcc @u
  sbc #10
  inx
  jmp @t
@u:
  pha
  txa
  clc
  adc #T_0
  sta PPUDATA
  pla
  clc
  adc #T_0
  sta PPUDATA
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

; ptr のデータ（番地・長さ・中身）を書くものへ
buf_data:
  jsr lang_fix
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

; 書くものへ2けたの数（A）
buf_num2:
  ldx #0
@t:
  cmp #10
  bcc @u
  sbc #10
  inx
  jmp @t
@u:
  pha
  txa
  clc
  adc #T_0
  jsr buf_byte
  pla
  clc
  adc #T_0
  jsr buf_byte
  rts

; スプライト1つ: tmp = y・tmp2 = 絵・tmp3 = 色と向き・tmp4 = x（X はこわさない）
put_spr:
  ldy oam_i
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
  bne @r
  lda #252           ; 64 こをこえたら最後を使いまわす（こわさない）
  sta oam_i
@r:
  rts

; 恐竜（24×16）: tmp = y・tmp2 = 最初の絵・tmp3 = 色と向き（$80 で上下さかさ）・tmp4/tmp7 = x（16ビット。画面の外の部分は描かない）
put_dino:
  lda tmp4
  sta tmp5
  lda tmp7
  sta tmp6
  lda tmp2
  pha
  lda tmp3
  bpl @n1
  pla
  pha
  clc
  adc #3
  sta tmp2
@n1:
  jsr @row
  lda tmp
  clc
  adc #8
  sta tmp
  lda tmp5
  sta tmp4
  lda tmp6
  sta tmp7
  pla
  sta tmp2
  lda tmp3
  bmi @n2
  lda tmp2
  clc
  adc #3
  sta tmp2
@n2:
  jsr @row
  rts
@row:
  ldx #3
@a:
  lda tmp7
  bne @skip
  txa
  pha
  jsr put_spr
  pla
  tax
@skip:
  inc tmp2
  lda tmp4
  clc
  adc #8
  sta tmp4
  lda tmp7
  adc #0
  sta tmp7
  dex
  bne @a
  rts

hide_rest:
  ldx oam_i
  lda #$ff
@l:
  sta OAM,x
  inx
  inx
  inx
  inx
  bne @l
  rts

clear_oam:
  lda #0
  sta oam_i
  jsr hide_rest
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

; ================= 能力から走りへ =================
; g_s〜g_p → d_kmh（最高の速さ km/h）・d_acc（加速）・d_fall（転びやすさ 0〜63）
derive:
  lda g_s
  lsr a
  sta tmp5           ; 大きさ/2
  clc
  adc g_l
  adc g_p
  adc #18
  sta tmp6           ; 歩幅と足の速さで出したい速さ
  lda g_m
  asl a
  clc
  adc #26
  sec
  sbc g_s
  sec
  sbc tmp5           ; 筋肉で出せる速さ（体が大きいと重い）
  cmp tmp6
  bcc @c
  lda tmp6
@c:
  cmp #8
  bcs @k
  lda #8
@k:
  sta d_kmh
  lda g_m
  clc
  adc #8
  sec
  sbc tmp5
  cmp #3
  bcs @a
  lda #3
@a:
  sta d_acc
  lda g_l            ; つり合い: 10 + しっぽ×2 が、脚 + 足の速さ + 大きさ/2 にとどかないと転ぶ
  clc
  adc g_p
  adc tmp5
  sta tmp6
  lda g_t
  asl a
  adc #10
  cmp tmp6
  bcs @ok
  sta tmp5
  lda tmp6
  sec
  sbc tmp5
  asl a
  cmp #64
  bcc @f
  lda #63
@f:
  sta d_fall
  rts
@ok:
  lda #0
  sta d_fall
  rts

; X = 囲いの番号×8 の能力を g_ へ
load_genes:
  lda DINO+1,x
  sta g_s
  lda DINO+2,x
  sta g_l
  lda DINO+3,x
  sta g_m
  lda DINO+4,x
  sta g_t
  lda DINO+5,x
  sta g_p
  rts

; ================= セーブ =================
check_save:
  lda SAVE
  cmp #'D'
  bne new_ranch
  lda SAVE+1
  cmp #'R'
  bne new_ranch
  lda SAVE+2
  cmp #'8'
  bne new_ranch
  lda SAVE+3
  cmp #'1'
  bne new_ranch
  rts

new_ranch:
  ldx #0
  lda #0
@z:
  sta SAVE,x
  inx
  cpx #$40
  bne @z
  lda #'D'
  sta SAVE
  lda #'R'
  sta SAVE+1
  lda #'8'
  sta SAVE+2
  lda #'1'
  sta SAVE+3
  ldx #0
@s:
  lda starters,x
  sta DINO,x
  inx
  cpx #16
  bne @s
  ldx #0
  jsr fix_kmh
  ldx #8
  jsr fix_kmh
  rts

; X = 囲い×8 の km/h を計算しなおす
fix_kmh:
  txa
  pha
  jsr load_genes
  jsr derive
  pla
  tax
  lda d_kmh
  sta DINO+6,x
  rts

; はじめの2頭: ふつうの子と、大きいが筋肉の足りない子（しっぽも短い）
starters:
  .byte 1, 5, 6, 6, 6, 5, 0, 0
  .byte 1, 9, 8, 5, 3, 7, 0, 0

; ================= タイトル =================
go_title:
  ; ことば（ページが電源を入れる前に $7FFF へ。1 だけが英語、ほかは かな）
  ldx #0
  lda LANG
  cmp #1
  bne @lj
  inx
@lj:
  stx lang
  lda #<nt_title
  sta ptr
  lda #>nt_title
  sta ptr+1
  jsr show_nt
  jsr check_save
  jsr title_cup_text
  lda #<t_push
  sta ptr
  lda #>t_push
  sta ptr+1
  jsr text_now
  lda #ST_TITLE
  sta state
  lda #0
  sta sub
  lda #SONG_RANCH
  jsr music_play
  jsr screen_on
  rts

; タイトルの「CUP x RACE y」（画面を消したまま）
title_cup_text:
  lda #<t_cont
  sta ptr
  lda #>t_cont
  sta ptr+1
  jsr text_now
  bit PPUSTATUS
  lda #>ADDR_TCUP
  sta PPUADDR
  lda #<ADDR_TCUP
  sta PPUADDR
  lda SV_CUP
  cmp #3
  bcc @n
  lda #2
@n:
  clc
  adc #T_0+1
  sta PPUDATA
  bit PPUSTATUS
  lda #>ADDR_TRACE
  sta PPUADDR
  lda #<ADDR_TRACE
  sta PPUADDR
  lda SV_RACE
  clc
  adc #T_0+1
  sta PPUDATA
  rts

title_update:
  lda #0
  sta oam_i
  ; 走る骨格が横切る
  inc sub
  lda #151
  sta tmp
  lda sub
  sta tmp4
  lda #0
  sta tmp7
  sta tmp3
  lda frame
  lsr a
  lsr a
  and #3
  tax
  lda run_frames,x
  sta tmp2
  jsr put_dino
  jsr hide_rest
  lda pad_new
  and #BTN_START
  beq @r
  lda pad
  and #BTN_SELECT
  beq @go
  jsr new_ranch      ; SELECT を押しながら START: はじめから
@go:
  jsr go_ranch
@r:
  rts

run_frames:
  .byte S_DINOA, S_DINOB, S_DINOC, S_DINOB

; ================= 牧場 =================
pen_lo: .byte <PEN0, <PEN1, <PEN2, <PEN3
pen_hi: .byte >PEN0, >PEN1, >PEN2, >PEN3
pen_x: .byte 0, 128, 0, 128          ; 囲いの左上（ドット）
pen_y: .byte 24, 24, 120, 120

go_ranch:
  lda #<nt_ranch
  sta ptr
  lda #>nt_ranch
  sta ptr+1
  jsr show_nt
  ldx #0
@p:
  txa
  pha
  jsr draw_pen
  pla
  tax
  inx
  cpx #4
  bne @p
  ; 杯と回
  lda SV_CUP
  cmp #3
  bcc @cup
  lda #<m_allcups
  sta ptr
  lda #>m_allcups
  sta ptr+1
  jsr text_now
  jmp @menu
@cup:
  lda #<m_cup
  sta ptr
  lda #>m_cup
  sta ptr+1
  jsr text_now
  bit PPUSTATUS
  lda #>[ADDR_CUP+4]
  sta PPUADDR
  lda #<[ADDR_CUP+4]
  sta PPUADDR
  lda SV_CUP
  clc
  adc #T_0+1
  sta PPUDATA
  bit PPUSTATUS
  lda #>[ADDR_CUP+11]
  sta PPUADDR
  lda #<[ADDR_CUP+11]
  sta PPUADDR
  lda SV_RACE
  clc
  adc #T_0+1
  sta PPUDATA
@menu:
  lda #<m_help
  sta ptr
  lda #>m_help
  sta ptr+1
  jsr text_now
  lda #ST_RANCH
  sta state
  lda #0
  sta mode
  sta msel
  ; カーソルは恐竜のいる囲いへ
  ldx cursor
  jsr slot_x8
  lda DINO,x
  bne @ok
  ldx #0
@f:
  lda DINO,x
  bne @fx
  txa
  clc
  adc #8
  tax
  cpx #32
  bne @f
@fx:
  txa
  lsr a
  lsr a
  lsr a
  and #3
  sta cursor
@ok:
  lda mus_on
  bne @m
  lda #SONG_RANCH
  jsr music_play
@m:
  jsr screen_on
  rts

; X = 囲い → X = 囲い×8
slot_x8:
  txa
  asl a
  asl a
  asl a
  tax
  rts

; 囲い X の中身を書く（画面を消したまま）
draw_pen:
  lda pen_lo,x
  sta tmp5
  lda pen_hi,x
  sta tmp6
  jsr slot_x8
  stx tmp4
  lda DINO,x
  bne @used
  lda #32*3+6
  jsr add_addr
  jsr set_addr
  lda #<m_empty
  sta ptr
  lda #>m_empty
  sta ptr+1
  jsr text_here
  rts
@used:
  lda #32+9
  jsr add_addr
  jsr set_addr
  ldx tmp4
  jsr load_genes
  ldx tmp4
  lda DINO+6,x
  jsr write_num2
  lda #<m_kmh
  sta ptr
  lda #>m_kmh
  sta ptr+1
  jsr text_here
  lda #32*2
  jsr add_addr       ; 1行目の 9 列 → 3行目の 9 列（恐竜の右）
  jsr wobbly_mark
  lda #32*2-2
  jsr add_addr       ; 3行目の 9 列 → 5行目の 7 列
  lda #0
  sta tmp3
@g:
  jsr set_addr
  lda tmp4
  clc
  adc tmp3
  tax
  lda DINO+1,x
  pha
  jsr write_bar
  lda #T_BLANK
  sta PPUDATA
  pla
  jsr write_num2
  lda #32
  jsr add_addr
  inc tmp3
  lda tmp3
  cmp #5
  bne @g
  rts

; g_ の能力が転びやすければ、tmp6:tmp5 に「WOBBLY」（そうでなければ空白）
wobbly_mark:
  lda tmp5
  pha
  lda tmp6
  pha
  jsr derive
  pla
  sta tmp6
  pla
  sta tmp5
  jsr set_addr
  lda d_fall
  beq @no
  lda #<m_wobbly
  sta ptr
  lda #>m_wobbly
  sta ptr+1
  jmp text_here
@no:
  rts

; X = 子×8 の能力を g_ へ
kid_genes:
  lda KIDS+1,x
  sta g_s
  lda KIDS+2,x
  sta g_l
  lda KIDS+3,x
  sta g_m
  lda KIDS+4,x
  sta g_t
  lda KIDS+5,x
  sta g_p
  rts

; いる恐竜の数 → A
count_dinos:
  ldx #0
  ldy #0
@l:
  lda DINO,x
  beq @n
  iny
@n:
  txa
  clc
  adc #8
  tax
  cpx #32
  bne @l
  tya
  rts

; あいている囲い → A（なければ $FF）
find_empty:
  ldx #0
  ldy #0
@l:
  lda DINO,x
  beq @got
  iny
  txa
  clc
  adc #8
  tax
  cpx #32
  bne @l
  lda #$ff
  rts
@got:
  tya
  rts

menu_text:   ; ptr の字をメニューの行へ
  jsr buf_data
  rts

set_menu:    ; A = 0 help 1 act 2 partner 3 full 4 letgo 5 last 6 same
  asl a
  tax
  lda menu_tab,x
  sta ptr
  lda menu_tab+1,x
  sta ptr+1
  jsr buf_data
  rts
menu_tab:
  .word m_help, m_act, m_partner, m_full, m_letgo, m_last, m_same

ranch_update:
  lda mode
  asl a
  tax
  lda ranch_modes,x
  sta ptr
  lda ranch_modes+1,x
  sta ptr+1
  jsr @call
  jsr ranch_sprites
  rts
@call:
  jmp (ptr)
ranch_modes:
  .word rm_browse, rm_action, rm_partner, rm_letgo, rm_notice

; 十字キーで囲いをえらぶ（左右で ^1、上下で ^2）
move_cursor:
  lda pad_new
  and #BTN_LEFT|BTN_RIGHT
  beq @v
  lda cursor
  eor #1
  sta cursor
  jsr sfx_move
@v:
  lda pad_new
  and #BTN_UP|BTN_DOWN
  beq @r
  lda cursor
  eor #2
  sta cursor
  jsr sfx_move
@r:
  rts

rm_browse:
  jsr move_cursor
  lda pad_new
  and #BTN_A
  beq @r
  ldx cursor
  jsr slot_x8
  lda DINO,x
  beq @r
  lda #1
  sta mode
  lda #0
  sta msel
  lda #1
  jsr set_menu
  jsr sfx_ok
@r:
  rts

rm_action:
  lda pad_new
  and #BTN_LEFT
  beq @nl
  dec msel
  bpl @s1
  lda #2
  sta msel
@s1:
  jsr sfx_move
@nl:
  lda pad_new
  and #BTN_RIGHT
  beq @nr
  inc msel
  lda msel
  cmp #3
  bcc @s2
  lda #0
  sta msel
@s2:
  jsr sfx_move
@nr:
  lda pad_new
  and #BTN_B
  beq @nb
  jmp back_browse
@nb:
  lda pad_new
  and #BTN_A
  bne @a
  rts
@a:
  jsr sfx_ok
  lda msel
  bne @n0
  jmp go_race
@n0:
  cmp #1
  bne @letgo
  jsr find_empty
  cmp #$ff
  bne @br
  lda #3
  jmp notice
@br:
  lda cursor
  sta sel_a
  lda #2
  sta mode
  lda #2
  jsr set_menu
  rts
@letgo:
  jsr count_dinos
  cmp #2
  bcs @lg
  lda #5
  jmp notice
@lg:
  lda #3
  sta mode
  lda #4
  jsr set_menu
  rts

back_browse:
  lda #0
  sta mode
  lda #0
  jsr set_menu
  jsr sfx_back
  rts

; お知らせ（A = 字の番号）。なにか押すともどる
notice:
  jsr set_menu
  lda #4
  sta mode
  rts
rm_notice:
  lda pad_new
  and #BTN_A|BTN_B
  beq @r
  jmp back_browse
@r:
  rts

rm_partner:
  jsr move_cursor
  lda pad_new
  and #BTN_B
  beq @nb
  jmp back_browse
@nb:
  lda pad_new
  and #BTN_A
  beq @r
  lda cursor
  cmp sel_a
  beq @same
  ldx cursor
  jsr slot_x8
  lda DINO,x
  beq @same
  lda cursor
  sta sel_b
  jsr sfx_ok
  jmp go_eggs
@same:
  lda #6
  jsr set_menu
@r:
  rts

rm_letgo:
  lda pad_new
  and #BTN_B
  beq @nb
  jmp back_browse
@nb:
  lda pad_new
  and #BTN_A
  beq @r
  ldx cursor
  jsr slot_x8
  lda #0
  sta DINO,x
  jsr sfx_back
  jmp go_ranch
@r:
  rts

ranch_sprites:
  lda #0
  sta oam_i
  ; 相手をえらぶとき: えらんだ1頭目に星
  lda mode
  cmp #2
  bne @nostar
  ldx sel_a
  lda pen_y,x
  clc
  adc #7
  sta tmp
  lda pen_x,x
  clc
  adc #56
  sta tmp4
  lda #S_STAR
  sta tmp2
  lda #2
  sta tmp3
  jsr put_spr
@nostar:
  ; カーソル（囲いの4つの角。点滅）
  lda frame
  and #16
  bne @corner
  lda mode
  cmp #1
  bne @nocorner
@corner:
  ldx cursor
  lda pen_y,x
  clc
  adc #1
  sta tmp
  lda pen_x,x
  clc
  adc #1
  sta tmp4
  lda #S_CORNER
  sta tmp2
  lda #2
  sta tmp3
  jsr put_spr
  lda tmp4
  clc
  adc #118
  sta tmp4
  lda #$42
  sta tmp3
  jsr put_spr
  lda tmp
  clc
  adc #86
  sta tmp
  lda #$c2
  sta tmp3
  jsr put_spr
  lda tmp4
  sec
  sbc #118
  sta tmp4
  lda #$82
  sta tmp3
  jsr put_spr
@nocorner:
  ; なにをする の矢印
  lda mode
  cmp #1
  bne @noarrow
  lda #223
  sta tmp
  ldx msel
  lda arrow_x,x
  sta tmp4
  lda #S_ARROW
  sta tmp2
  lda #2
  sta tmp3
  jsr put_spr
@noarrow:
  ; 囲いの恐竜（足ぶみ）
  ldx #0
@d:
  stx li
  txa
  asl a
  asl a
  asl a
  tay
  lda DINO,y
  beq @next
  lda pen_y,x
  clc
  adc #19
  sta tmp
  lda pen_x,x
  clc
  adc #28
  sta tmp4
  lda #0
  sta tmp7
  sta tmp3
  lda li
  asl a
  asl a
  asl a
  clc
  adc frame
  lsr a
  lsr a
  lsr a
  lsr a
  and #3
  tax
  lda run_frames,x
  sta tmp2
  jsr put_dino
@next:
  ldx li
  inx
  cpx #4
  bne @d
  jsr hide_rest
  rts
arrow_x: .byte 30, 94, 158

; ================= 卵 =================
kid_lo: .byte <KID0, <KID1, <KID2
kid_hi: .byte >KID0, >KID1, >KID2

go_eggs:
  ; 3頭の子: 能力ごとに親のどちらかをもらい、2回に1回くらい少し変わる
  ldx sel_a
  jsr slot_x8
  stx tmp3           ; 親A
  ldx sel_b
  jsr slot_x8
  stx tmp4           ; 親B
  lda #0
  sta tmp7           ; 子の番号×8
@kid:
  lda #1
  ldx tmp7
  sta KIDS,x
  lda #1
  sta tmp2           ; 能力の番号（1〜5）
@gene:
  jsr rand
  and #1
  beq @fromb
  lda tmp3
  jmp @take
@fromb:
  lda tmp4
@take:
  clc
  adc tmp2
  tax
  lda DINO,x
  sta tmp5
  jsr rand
  sta tmp6
  and #1             ; 2回に1回くらい少し変わる（シミュレーションで、3杯まで 15〜30 世代）
  bne @keep
  lda tmp6           ; 変わる: ±1、ときどき ±2
  and #8
  beq @one
  lda #2
  jmp @amt
@one:
  lda #1
@amt:
  sta tmp
  lda tmp6
  and #4
  beq @up
  lda tmp5
  sec
  sbc tmp
  bpl @set
  lda #0
  jmp @set
@up:
  lda tmp5
  clc
  adc tmp
  cmp #16
  bcc @set
  lda #15
@set:
  sta tmp5
@keep:
  lda tmp7
  clc
  adc tmp2
  tax
  lda tmp5
  sta KIDS,x
  inc tmp2
  lda tmp2
  cmp #6
  bne @gene
  ; km/h
  ldx tmp7
  lda KIDS+1,x
  sta g_s
  lda KIDS+2,x
  sta g_l
  lda KIDS+3,x
  sta g_m
  lda KIDS+4,x
  sta g_t
  lda KIDS+5,x
  sta g_p
  jsr derive
  ldx tmp7
  lda d_kmh
  sta KIDS+6,x
  lda tmp7
  clc
  adc #8
  sta tmp7
  cmp #24
  beq @kdone
  jmp @kid
@kdone:
  ; 画面
  lda #<nt_eggs
  sta ptr
  lda #>nt_eggs
  sta ptr+1
  jsr show_nt
  ldx #0
@col:
  txa
  pha
  jsr draw_kid
  pla
  tax
  inx
  cpx #3
  bne @col
  lda #ST_EGGS
  sta state
  lda #0
  sta cursor
  sta sub
  jsr screen_on
  rts

; 子 X の数を書く（画面を消したまま）
draw_kid:
  lda kid_lo,x
  sta tmp5
  lda kid_hi,x
  sta tmp6
  txa
  asl a
  asl a
  asl a
  sta tmp4
  lda #32*6+2
  jsr add_addr
  jsr set_addr
  ldx tmp4
  lda KIDS+6,x
  jsr write_num2
  lda #<m_kmh
  sta ptr
  lda #>m_kmh
  sta ptr+1
  jsr text_here
  lda #32
  jsr add_addr       ; 7行目の 2 列
  ldx tmp4
  jsr kid_genes
  jsr wobbly_mark
  lda #32+1
  jsr add_addr      ; 7行目の 2 列 → 8行目の 3 列
  lda #0
  sta tmp3
@g:
  jsr set_addr
  lda tmp4
  clc
  adc tmp3
  tax
  lda KIDS+1,x
  pha
  jsr write_bar
  pla
  jsr write_num2
  lda #32
  jsr add_addr
  inc tmp3
  lda tmp3
  cmp #5
  bne @g
  rts

eggs_update:
  lda #0
  sta oam_i
  lda sub
  cmp #120
  bcs @hatched
  inc sub
  ; 卵がゆれて、ひびが入る
  ldx #0
@e:
  stx tmp6
  lda #63
  sta tmp
  lda egg_x,x
  sta tmp4
  lda sub
  and #8
  beq @still
  lda sub
  cmp #40
  bcc @still
  inc tmp4
@still:
  lda sub
  cmp #90
  bcs @crack
  lda #S_EGG
  jmp @put
@crack:
  lda #S_EGGCRACK
@put:
  sta tmp2
  lda #0
  sta tmp3
  jsr put_egg
  ldx tmp6
  inx
  cpx #3
  bne @e
  lda sub
  cmp #90
  bne @r1
  jsr sfx_crack
@r1:
  jsr hide_rest
  rts
@hatched:
  ; 生まれた3頭と、えらぶカーソル
  ldx #0
@k:
  stx li
  lda #63
  sta tmp
  lda egg_x,x
  sec
  sbc #4
  sta tmp4
  lda #0
  sta tmp7
  sta tmp3
  lda frame
  lsr a
  lsr a
  lsr a
  and #3
  tax
  lda run_frames,x
  sta tmp2
  jsr put_dino
  ldx li
  inx
  cpx #3
  bne @k
  ; カーソル（列の4つの角）
  lda frame
  and #16
  bne @nocur
  ldx cursor
  lda #41
  sta tmp
  lda kidcol_x,x
  sta tmp4
  lda #S_CORNER
  sta tmp2
  lda #2
  sta tmp3
  jsr put_spr
  lda tmp4
  clc
  adc #70
  sta tmp4
  lda #$42
  sta tmp3
  jsr put_spr
  lda #166
  sta tmp
  lda #$c2
  sta tmp3
  jsr put_spr
  lda tmp4
  sec
  sbc #70
  sta tmp4
  lda #$82
  sta tmp3
  jsr put_spr
@nocur:
  jsr hide_rest
  ; えらぶ
  lda pad_new
  and #BTN_LEFT
  beq @nl
  dec cursor
  bpl @m1
  lda #2
  sta cursor
@m1:
  jsr sfx_move
@nl:
  lda pad_new
  and #BTN_RIGHT
  beq @nr
  inc cursor
  lda cursor
  cmp #3
  bcc @m2
  lda #0
  sta cursor
@m2:
  jsr sfx_move
@nr:
  lda pad_new
  and #BTN_B
  beq @nb
  jsr sfx_back
  lda sel_a
  sta cursor
  jmp go_ranch
@nb:
  lda pad_new
  and #BTN_A
  beq @r
  ; あいている囲いへ
  jsr find_empty
  sta tmp
  tax
  jsr slot_x8
  stx tmp2
  lda cursor
  asl a
  asl a
  asl a
  tay
  ldx tmp2
  lda #7
  sta tmp3
@cp:
  lda KIDS,y
  sta DINO,x
  inx
  iny
  dec tmp3
  bne @cp
  lda tmp
  sta cursor
  jsr sfx_ok
  jmp go_ranch
@r:
  rts
egg_x: .byte 40, 120, 200
kidcol_x: .byte 9, 89, 169

; 卵（16×16）: tmp = y・tmp2 = 絵・tmp4 = x
put_egg:
  jsr put_spr
  inc tmp2
  lda tmp4
  clc
  adc #8
  sta tmp4
  jsr put_spr
  inc tmp2
  lda tmp
  clc
  adc #8
  sta tmp
  lda tmp4
  sec
  sbc #8
  sta tmp4
  jsr put_spr
  inc tmp2
  lda tmp4
  clc
  adc #8
  sta tmp4
  jsr put_spr
  rts

; ================= かけっこ =================
; 走る4頭を用意して画面へ（じぶんは cursor の囲いの恐竜）
go_race:
  ldx cursor
  jsr slot_x8
  jsr load_genes
  ldx #0
  jsr setup_runner
  ; ライバル: (杯×3 + 回)×15 から 5 バイトずつ
  lda SV_CUP
  cmp #3
  bcc @c
  lda #2
  sta tmp3           ; 全部勝ったあとは、いちばん速い組
  lda #2
  jmp @r
@c:
  sta tmp3
  lda SV_RACE
@r:
  sta tmp4
  lda tmp3
  asl a
  adc tmp3
  adc tmp4           ; 杯×3 + 回
  sta tmp
  asl a
  asl a
  asl a
  asl a
  sec
  sbc tmp            ; ×15
  tay
  ldx #1
@riv:
  lda rival_genes,y
  sta g_s
  lda rival_genes+1,y
  sta g_l
  lda rival_genes+2,y
  sta g_m
  lda rival_genes+3,y
  sta g_t
  lda rival_genes+4,y
  sta g_p
  tya
  pha
  txa
  pha
  jsr setup_runner
  pla
  tax
  pla
  clc
  adc #5
  tay
  inx
  cpx #NRUN
  bne @riv
  ; 画面（2枚の画面に同じ絵）
  jsr screen_off
  lda #<nt_race
  sta ptr
  lda #>nt_race
  sta ptr+1
  lda #$20
  jsr draw_nt
  lda #<nt_race
  sta ptr
  lda #>nt_race
  sta ptr+1
  lda #$24
  jsr draw_nt
  jsr clear_oam
  bit PPUSTATUS
  lda #>ADDR_RCUP
  sta PPUADDR
  lda #<ADDR_RCUP
  sta PPUADDR
  lda tmp3
  clc
  adc #T_0+1
  sta PPUDATA
  bit PPUSTATUS
  lda #>ADDR_RRACE
  sta PPUADDR
  lda #<ADDR_RRACE
  sta PPUADDR
  lda tmp4
  clc
  adc #T_0+1
  sta PPUDATA
  lda #ST_RACE
  sta state
  lda #0
  sta race_tl
  sta race_th
  sta places
  sta start_st
  sta sub
  lda #200
  sta count
  lda #$c0           ; カメラ: じぶん − 64
  sta cam_lo
  lda #$ff
  sta cam_hi
  jsr music_stop
  jsr race_draw
  jsr screen_on
  rts

; g_ の能力で走り手 X を用意
setup_runner:
  txa
  pha
  jsr derive
  pla
  tax
  lda #0
  sta r_xs,x
  sta r_xl,x
  sta r_xh,x
  sta r_spl,x
  sta r_sph,x
  sta r_down,x
  sta r_place,x
  sta r_tl,x
  sta r_th,x
  lda d_acc
  sta r_acc,x
  lda d_fall
  sta r_fall,x
  lda d_kmh
  sta r_kmh,x
  ; 最高の速さ（1フレームのドット 8.8）= km/h × 15
  sta tmp5
  lda #0
  sta tmp6
  asl tmp5
  rol tmp6
  asl tmp5
  rol tmp6
  asl tmp5
  rol tmp6
  asl tmp5
  rol tmp6
  lda tmp5
  sec
  sbc d_kmh
  sta r_topl,x
  lda tmp6
  sbc #0
  sta r_toph,x
  rts

; 上の帯（0〜3行）は止めて、その下を横にずらす: 0番のスプライトが帯の線に当たるのを待つ
split_scroll:
  ldx #0
  ldy #12
@w1:
  bit PPUSTATUS
  bvs @w1            ; 前のフレームの当たりが消えるまで
@w2:
  inx
  bne @c
  dey
  beq @r             ; 念のため（当たらないときに止まらない）
@c:
  bit PPUSTATUS
  bvc @w2
  ldy #6
@d:
  dey
  bne @d
  lda cam_hi
  and #1
  ora #CTRL_ON
  sta PPUCTRL
  lda cam_lo
  sta PPUSCROLL
  lda #0
  sta PPUSCROLL
@r:
  rts

race_update:
  jsr split_scroll
  lda count
  bne @cd
  jmp @run
@cd:
  dec count
  lda pad_new
  and #BTN_A
  beq @nf
  lda #2             ; GO の前に A: フライング
  sta start_st
@nf:
  ldx #0
@tb:
  lda count
  cmp cd_at,x
  beq @hit
  inx
  cpx #5
  bne @tb
  jmp @draw
@hit:
  lda cd_lo,x
  sta ptr
  lda cd_hi,x
  sta ptr+1
  cpx #0
  beq @say
  cpx #4
  beq @go
  jsr sfx_beep
  jmp @say
@go:
  jsr sfx_go
  lda #SONG_RACE
  jsr music_play
  lda start_st
  cmp #2
  bne @say
  lda #50
  sta r_down
  lda #<m_false
  sta ptr
  lda #>m_false
  sta ptr+1
@say:
  jsr buf_data
@draw:
  jsr race_draw
  rts
@run:
  ; GO のすぐあと（20 フレームのうち）に A でよいスタート
  lda start_st
  bne @ns
  lda race_th
  bne @ns
  lda race_tl
  cmp #20
  bcs @ns
  lda pad_new
  and #BTN_A
  beq @ns
  lda #1
  sta start_st
  lda r_topl
  sta r_spl
  lda r_toph
  lsr a
  sta r_sph
  ror r_spl
  lda #<m_good
  sta ptr
  lda #>m_good
  sta ptr+1
  jsr buf_data
@ns:
  inc race_tl
  bne @t
  inc race_th
@t:
  lda race_th          ; 1.5 秒たったら「GO!」などを消す
  bne @nc
  lda race_tl
  cmp #90
  bne @nc
  lda r_place
  bne @nc
  lda #<m_clear
  sta ptr
  lda #>m_clear
  sta ptr+1
  jsr buf_data
@nc:
  ldx #0
@u:
  jsr run_step
  inx
  cpx #NRUN
  bne @u
  ; カメラ = じぶん − 64
  lda r_xl
  sec
  sbc #64
  sta cam_lo
  lda r_xh
  sbc #0
  sta cam_hi
  jsr race_hud
  jsr race_draw
  ; じぶんがゴールして、みんながゴールするか 3 秒たったら結果へ
  lda r_place
  beq @r
  inc sub
  lda places
  cmp #NRUN
  beq @to
  lda sub
  cmp #240
  bcc @r
@to:
  lda sub
  cmp #40
  bcc @r
  jmp go_result
@r:
  rts

; 走り手 X を1フレーム
run_step:
  lda r_down,x
  beq @up
  dec r_down,x
  lda #0
  sta r_spl,x
  sta r_sph,x
  jmp @move
@up:
  lda r_place,x        ; ゴールしたら、ゆっくり止まる
  beq @acc
  lda r_spl,x
  sec
  sbc #12
  sta r_spl,x
  lda r_sph,x
  sbc #0
  bcs @slow
  lda #0
  sta r_spl,x
@slow:
  sta r_sph,x
  jmp @move
@acc:
  ; 速くなる（最高まで）
  lda r_spl,x
  clc
  adc r_acc,x
  sta r_spl,x
  lda r_sph,x
  adc #0
  sta r_sph,x
  cmp r_toph,x
  bcc @fallchk
  bne @cap
  lda r_spl,x
  cmp r_topl,x
  bcc @fallchk
@cap:
  lda r_topl,x
  sta r_spl,x
  lda r_toph,x
  sta r_sph,x
@fallchk:
  ; 32 フレームに1回、つり合いが悪いと転ぶ（ゴールのあとは転ばない）
  lda r_place,x
  bne @move
  txa
  asl a
  asl a
  asl a
  eor race_tl
  and #31
  bne @move
  lda r_fall,x
  beq @move
  stx tmp
  jsr rand
  ldx tmp
  and #63
  cmp r_fall,x
  bcs @move
  lda #45
  sta r_down,x
  cpx #0
  bne @move
  jsr sfx_fall
  ldx tmp
@move:
  lda r_xs,x
  clc
  adc r_spl,x
  sta r_xs,x
  lda r_xl,x
  adc r_sph,x
  sta r_xl,x
  lda r_xh,x
  adc #0
  sta r_xh,x
  ; ゴール
  lda r_place,x
  bne @r
  lda r_xh,x
  cmp #FINISH_HI
  bcc @r
  inc places
  lda places
  sta r_place,x
  lda race_tl
  sta r_tl,x
  lda race_th
  sta r_th,x
  cpx #0
  bne @r
  jsr cheer_start    ; じぶんがゴール: 歓声
  lda #<m_finish
  sta ptr
  lda #>m_finish
  sta ptr+1
  stx tmp
  jsr buf_data
  ldx tmp
@r:
  rts

; 上の帯の時間（じぶんがゴールするまで）
race_hud:
  lda r_place
  bne @r
  lda race_tl
  sta dv_lo
  lda race_th
  sta dv_hi
  jsr div6           ; 10 分の 1 秒
  lda #>ADDR_RTIME
  ldx #<ADDR_RTIME
  ldy #4
  jsr buf_head
  jsr tenths_out
@r:
  rts

; dv_hi:dv_lo を 6 でわる（あまりは捨てる）→ dv_lo:dv_hi
div6:
  lda #0
  sta tmp5
  ldx #16
@l:
  asl dv_lo
  rol dv_hi
  rol tmp5
  lda tmp5
  sec
  sbc #6
  bcc @n
  sta tmp5
  inc dv_lo
@n:
  dex
  bne @l
  rts

; dv（10 分の 1 秒、999 まで）を「SS.T」で書くものへ
tenths_out:
  lda dv_hi
  bne @max
  lda dv_lo
  ldx #0
@s:
  cmp #10
  bcc @t
  sbc #10
  inx
  jmp @s
@t:
  pha
  txa
  jsr buf_num2
  lda #T_DOT
  jsr buf_byte
  pla
  clc
  adc #T_0
  jsr buf_byte
  rts
@max:
  lda #99
  jsr buf_num2
  lda #T_DOT
  jsr buf_byte
  lda #T_0+9
  jsr buf_byte
  rts

cd_at: .byte 170, 130, 90, 50, 0
cd_lo: .byte <m_ready, <m_3, <m_2, <m_1, <m_go
cd_hi: .byte >m_ready, >m_3, >m_2, >m_1, >m_go
lane_y: .byte 87, 119, 151, 183
lane_attr: .byte 0, 1, 3, 2

race_draw:
  lda #0
  sta oam_i
  ; 0番: 帯の線に当てる（背景のうしろなので見えない）
  lda #29
  sta tmp
  lda #S_HIT
  sta tmp2
  lda #$20
  sta tmp3
  lda #240
  sta tmp4
  jsr put_spr
  ; 4頭
  ldx #0
@d:
  stx li
  lda lane_y,x
  sta tmp
  lda lane_attr,x
  sta tmp3
  lda r_xl,x
  sec
  sbc cam_lo
  sta tmp4
  lda r_xh,x
  sbc cam_hi
  sta tmp7
  lda r_down,x
  beq @run
  lda #S_DINOB
  sta tmp2
  lda tmp3
  ora #$80
  sta tmp3
  jmp @put
@run:
  lda r_sph,x
  ora r_spl,x
  bne @mv
  lda #S_DINOB
  jmp @fr
@mv:
  lda r_xl,x
  lsr a
  lsr a
  lsr a
  lsr a
  and #3
  tay
  lda run_frames,y
@fr:
  sta tmp2
@put:
  jsr put_dino
  ldx li
  inx
  cpx #NRUN
  bne @d
  ; 10m ごとの数（柱の上）
  lda #1
  sta tmp6
@m:
  lda tmp6
  lsr a
  sta tmp5           ; 上のバイト = k/2
  lda #0
  ror a              ; 下のバイト = (k&1)×128
  sec
  sbc cam_lo
  sta tmp4
  lda tmp5
  sbc cam_hi
  bne @mn
  lda tmp4
  cmp #8
  bcc @mn
  cmp #240
  bcs @mn
  sec
  sbc #6
  sta tmp4
  lda #68
  sta tmp
  lda tmp6
  clc
  adc #S_D0
  sta tmp2
  lda #0
  sta tmp3
  jsr put_spr
  lda tmp4
  clc
  adc #6
  sta tmp4
  lda #S_D0
  sta tmp2
  jsr put_spr
@mn:
  inc tmp6
  lda tmp6
  cmp #10
  bne @m
  ; ゴールの旗（1280 ドット）
  lda #0
  sec
  sbc cam_lo
  sta tmp4
  lda #FINISH_HI
  sbc cam_hi
  bne @nf
  lda tmp4
  cmp #8
  bcc @nf
  cmp #248
  bcs @nf
  lda #S_FLAG
  sta tmp2
  lda #2
  sta tmp3
  lda #79
  sta tmp
@f:
  jsr put_spr
  lda tmp
  clc
  adc #8
  sta tmp
  cmp #207
  bcc @f
@nf:
  jsr hide_rest
  rts

; ================= 結果 =================
name_lo: .byte <r_you, <r_blue, <r_green, <r_red
name_hi: .byte >r_you, >r_blue, >r_green, >r_red

go_result:
  ; まだの走り手に順位をつける
  ldx #0
@p:
  lda r_place,x
  bne @np
  inc places
  lda places
  sta r_place,x
  lda #$ff
  sta r_tl,x
  lda #$0f
  sta r_th,x
@np:
  inx
  cpx #NRUN
  bne @p
  lda #<nt_plain
  sta ptr
  lda #>nt_plain
  sta ptr+1
  jsr show_nt
  lda #<r_title
  sta ptr
  lda #>r_title
  sta ptr+1
  jsr text_now
  ; 1位から4位
  lda #1
  sta tmp3
@rank:
  ldx #0
@find:
  lda r_place,x
  cmp tmp3
  beq @got
  inx
  cpx #NRUN
  bne @find
@got:
  stx tmp4
  ; 行の番地: (7 + 2×順位) 行の 6 列
  lda tmp3
  asl a
  clc
  adc #5
  sta tmp5
  lda #0
  sta tmp6
  ldx #5
@x32:
  asl tmp5
  rol tmp6
  dex
  bne @x32
  lda #6
  jsr add_addr
  lda tmp6
  clc
  adc #$20
  sta tmp6
  jsr set_addr
  lda tmp3
  clc
  adc #T_0
  sta PPUDATA
  lda #T_BLANK
  sta PPUDATA
  sta PPUDATA
  ldx tmp4
  lda name_lo,x
  sta ptr
  lda name_hi,x
  sta ptr+1
  jsr text_here
  ; 時間（10 分の 1 秒）
  ldx tmp4
  lda r_tl,x
  sta dv_lo
  lda r_th,x
  sta dv_hi
  cmp #$0f
  beq @dnf
  jsr div6
  lda #0
  sta buf_len
  jsr tenths_out
  ldx #0
@cp:
  lda BUF,x
  sta PPUDATA
  inx
  cpx buf_len
  bne @cp
  lda #0
  sta buf_len
  lda #T_S
  sta PPUDATA
  jmp @nr
@dnf:
  lda #T_DASH
  sta PPUDATA
  sta PPUDATA
@nr:
  inc tmp3
  lda tmp3
  cmp #5
  beq @rdone
  jmp @rank
@rdone:
  ; じぶんの最高の速さ
  lda #<r_top
  sta ptr
  lda #>r_top
  sta ptr+1
  jsr text_now
  bit PPUSTATUS
  lda #>ADDR_RTOP
  sta PPUADDR
  lda #<ADDR_RTOP
  sta PPUADDR
  lda r_kmh
  jsr write_num2
  ; 勝ち・負け
  lda #0
  sta won
  lda r_place
  cmp #1
  bne @lose
  lda #1
  sta won
  lda #<r_win
  sta ptr
  lda #>r_win
  sta ptr+1
  jsr text_now
  ; つぎの回へ
  lda SV_CUP
  cmp #3
  bcs @song
  inc SV_RACE
  lda SV_RACE
  cmp #3
  bcc @song
  lda #0
  sta SV_RACE
  inc SV_CUP
  lda #2
  sta won            ; 杯をとった
  lda #<r_cupwon
  sta ptr
  lda #>r_cupwon
  sta ptr+1
  jsr text_now
  lda SV_CUP
  cmp #3
  bne @song
  lda #3
  sta won            ; 全部の杯
@song:
  lda #SONG_WIN
  jsr music_play
  jmp @back
@lose:
  lda #<r_lose
  sta ptr
  lda #>r_lose
  sta ptr+1
  jsr text_now
  lda #SONG_LOSE
  jsr music_play
@back:
  lda #<r_back
  sta ptr
  lda #>r_back
  sta ptr+1
  jsr text_now
  lda #ST_RESULT
  sta state
  lda #0
  sta sub
  jsr screen_on
  rts

result_update:
  lda #0
  sta oam_i
  jsr hide_rest
  lda sub
  cmp #40
  bcs @k
  inc sub
  rts
@k:
  lda pad_new
  and #BTN_A|BTN_START
  beq @r
  jsr music_stop
  lda won
  cmp #3
  bne @ranch
  jmp go_end
@ranch:
  jmp go_ranch
@r:
  rts

; ================= おわり（全部の杯） =================
go_end:
  lda #<nt_plain
  sta ptr
  lda #>nt_plain
  sta ptr+1
  jsr show_nt
  ldx #0
@t:
  lda end_lo,x
  sta ptr
  lda end_hi,x
  sta ptr+1
  txa
  pha
  jsr text_now
  pla
  tax
  inx
  cpx #7
  bne @t
  lda #ST_END
  sta state
  lda #0
  sta sub
  lda #SONG_ENDING
  jsr music_play
  jsr screen_on
  rts
end_lo: .byte <e_1, <e_2, <e_3, <e_4, <e_5, <e_6, <e_7
end_hi: .byte >e_1, >e_2, >e_3, >e_4, >e_5, >e_6, >e_7

end_update:
  lda #0
  sta oam_i
  ; 骨格が走っていく
  inc sub
  lda #207
  sta tmp
  lda sub
  sta tmp4
  lda #0
  sta tmp7
  sta tmp3
  lda frame
  lsr a
  lsr a
  and #3
  tax
  lda run_frames,x
  sta tmp2
  jsr put_dino
  jsr hide_rest
  lda pad_new
  and #BTN_A|BTN_START
  beq @r
  jsr music_stop
  jmp go_ranch
@r:
  rts

; ================= 音 =================
sfx_move:
  lda #%10011000
  sta $4000
  lda #$08
  sta $4001
  lda #$90
  sta $4002
  lda #$00
  sta $4003
  rts
sfx_ok:
  lda #%10011010
  sta $4000
  lda #%10001011
  sta $4001
  lda #$c0
  sta $4002
  lda #$10
  sta $4003
  rts
sfx_back:
  lda #%10011000
  sta $4000
  lda #%10000011
  sta $4001
  lda #$60
  sta $4002
  lda #$10
  sta $4003
  rts
sfx_crack:
  lda #%00000011
  sta $400C
  lda #$05
  sta $400E
  lda #$18
  sta $400F
  rts
sfx_beep:
  lda #%10011000
  sta $4000
  lda #$08
  sta $4001
  lda #$d5
  sta $4002
  lda #$10
  sta $4003
  rts
sfx_go:
  lda #%10011010
  sta $4000
  lda #$08
  sta $4001
  lda #$6a
  sta $4002
  lda #$20
  sta $4003
  rts
sfx_fall:
  lda #%00000100
  sta $400C
  lda #$0c
  sta $400E
  lda #$20
  sta $400F
  rts

; ゴールの歓声（ワーワー。2026-10-25 ユーザー「ゴールしたときにワーワー歓声 SE がほしい」）
;   ノイズの大きさを 16 フレームごとに ゆらし（人の声のかたまりの うねり）、音の高さも 4 フレームごとに少し変える。
;   はじめに ぐっと大きく、2.6 秒かけて小さく（cheer_env）。曲は矩形波2と三角波なので、ぶつからない
cheer_start:
  lda #CHEER_LEN
  sta cheer_t
  lda #$08
  sta $400F
  rts

cheer_update:
  lda cheer_t
  beq @r
  dec cheer_t
  beq @off
  lda cheer_t
  lsr a
  lsr a
  lsr a
  tay
  lda frame
  lsr a
  and #7
  tax
  lda cheer_env,y
  sec
  sbc cheer_wob,x
  bcs @v
  lda #0
@v:
  ora #%00110000
  sta $400C
  lda frame
  lsr a
  lsr a
  and #3
  tax
  lda cheer_per,x
  sta $400E
@r:
  rts
@off:
  lda #%00110000
  sta $400C
  rts

cheer_env: .byte 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 7, 4   ; のこり/8 → 大きさ（うしろが はじまり）
cheer_wob: .byte 0, 1, 2, 3, 3, 2, 1, 0
cheer_per: .byte 6, 7, 5, 7

; 曲の係（music_play・music_stop・music_update）は src/music.s（build がつなぐ）
