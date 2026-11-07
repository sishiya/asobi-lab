; とべ! トビウオ（あそびラボ 2026）。8ビット互換機の 6502 のアセンブリ。
; ビルド: node retro-8bit/tools/build.mjs flying-fish（絵の番号 T_・S_ と画面のデータは data.mjs が足す）
; 決まり: A（か B）をおしているあいだ、海の中では上へ泳ぎ、空では胸びれを広げてゆっくり落ちる。はなすと しずむ。
;   うしろから来る マグロは海の中、グンカンドリは空。深くから勢いをつけるほど高く飛べる。3 回つかまると おしまい
; 画面: 上の 4 行（字の段）は止めたまま、0 番のスプライトの当たりのあとで下だけ横に流す

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
MASK_ON = %00011110   ; 背景とスプライトを出す（背景の左の8ドットも出す・スプライトは隠す）

BTN_A = $80
BTN_B = $40
BTN_START = $10

FX = 144           ; トビウオの左の x（いつも同じ。海が流れる）
SURF = 116         ; 海の面の y（これより上が空）
TOP = 38           ; トビウオのまん中の y のいちばん上・下
BOTTOM = 210
G_UP = $18         ; 空でのぼるあいだの重さ（1/256 ドット）
GLIDE = $60        ; 胸びれを広げて落ちる速さのいちばん上
NH = 4             ; 追ってくるものの数
WARN_T = 45        ; ！を出してから来るまで（フレーム）
FAIR_X = 96        ; 海と空の両方から同時には来ない（ほかの種類がこの x より左にいたら待つ）
TUNA_MINY = SURF+2   ; 海の面すれすれまで来る（面の上をはねつづけても にげられない）
TUNA_MAXY = 204
BIRD_MAXY = SURF-7

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
fy = $10           ; トビウオのまん中の y（8.8）
fyl = $11
vyl = $12          ; たての速さ（8.8・符号つき）
vyh = $13
air = $14          ; 1 = 空
sx = $15           ; 横に流した量（8.8）
sxl = $16
spl = $17          ; 流れる速さ（8.8）
sph = $18
dist = $19         ; にげた きょり 4 けた（上のけたから。16 ドット = 1 m）
hi = $1D           ; 4 けた
dsub = $21
lives = $22
inv = $23          ; つかまったあと、すり抜けるあいだ
sp_t = $24
level = $25
oam_i = $26
end_t = $27
lang = $28
blink_old = $29
hint_on = $2A
hold = $2B
split = $2C        ; 1 = 字の段の下で横に流す
mus_on = $2D
paused = $2E
mus_ptr0 = $30
mus_t0 = $32
mus_base0 = $33
mus_ptr1 = $35
mus_t1 = $37
mus_base1 = $38
hz_type = $40      ; 0 なし・1 マグロ・2 グンカンドリ（NH ずつ）
hz_st = $44        ; 0 ！を出している・1 来ている
hz_t = $48         ; ！の残り／来てからは もとの高さ
hz_x = $4C
hz_xl = $50
hz_y = $54
hz_rl = $58        ; トビウオに追いつく速さ（8.8）
hz_rh = $5C
spl_t = $60        ; しぶきの残り
spl_x = $61
spl_xl = $62
newrec = $63
gw = $64           ; put_grid: よこ・たての枚数
gh = $65
gc = $66
gr = $67
gx0 = $68
gwrap = $69
LANG = $7FFF
SAVE = $6000       ; 電池の RAM: "TB01"・いちばん遠い きょり 4 けた

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
  sta PPUSCROLL      ; 字の段は流さない
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

; 書くものを閉じて、つぎの帰線を待つ。そのあと 0 番の当たりを待って、字の段より下を横に流す
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
  lda split
  beq @r
  ldx #0
  ldy #10
@c:                  ; 前の画面の当たりの印が消えるのを待つ
  bit PPUSTATUS
  bvc @s0
  dex
  bne @c
  dey
  bne @c
  rts
@s0:
  ldx #0
  ldy #10
@s:                  ; 当たりを待つ
  bit PPUSTATUS
  bvs @hit
  dex
  bne @s
  dey
  bne @s
  rts
@hit:
  lda sx
  sta PPUSCROLL
  lda #0
  sta PPUSCROLL
@r:
  rts

; ================= 画面の道具 =================
screen_off:
  jsr wait_frame
  lda #0
  sta split
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
  lda #1
  sta split
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

; ptr の 1024 バイトを画面の表 A（$20 か $24）へ（画面を消してから）。ptr はこわさない
draw_nt:
  bit PPUSTATUS
  sta PPUADDR
  lda #$00
  sta PPUADDR
  lda ptr+1
  pha
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
  pla
  sta ptr+1
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

; gw×gh 枚の絵（tmp2 から順に）を tmp4・tmp に。右の画面の外にはみ出す絵は出さない
put_grid:
  lda tmp4
  sta gx0
  lda gh
  sta gr
@row:
  lda gx0
  sta tmp4
  lda gw
  sta gc
  lda #0
  sta gwrap
@col:
  lda gwrap
  bne @nd
  jsr put_spr
@nd:
  inc tmp2
  lda tmp4
  clc
  adc #8
  sta tmp4
  bcc @nc
  lda #1
  sta gwrap
@nc:
  dec gc
  bne @col
  lda tmp
  clc
  adc #8
  sta tmp
  dec gr
  bne @row
  rts

; スプライトを出しはじめる: 0 番は字の段の下のふちに当てる印（背景のうしろなので見えない）
oam_start:
  lda #23
  sta OAM
  lda #S_MARK
  sta OAM+1
  lda #$23
  sta OAM+2
  lda #248
  sta OAM+3
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
  lda #$20
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
  sta sx
  sta sxl
  sta sph
  sta spl
  jsr reset_fish
  lda #122             ; 見本は浅い所から
  sta fy
  jsr clear_hz
  lda #SONG_MAIN
  jsr music_play
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

reset_fish:
  lda #150
  sta fy
  lda #0
  sta fyl
  sta vyl
  sta vyh
  sta air
  sta inv
  sta spl_t
  rts

clear_hz:
  lda #0
  ldx #NH-1
@l:
  sta hz_type,x
  dex
  bpl @l
  rts

title_update:
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jsr say_ptr
  jmp @put
@off:
  lda #M_PUSH_OFF
  jsr say_ptr
@put:
  jsr buf_data
@same:
  ; 見本: 海では ある深さまで しずんでから のぼり、空では胸びれを広げる
  lda #0
  sta hold
  lda air
  bne @inair
  lda vyh
  bmi @h
  lda fy
  cmp #124             ; 浅くはねるだけ（題の板にかからない）
  bcc @demo
@h:
  lda #1
  sta hold
@inair:
@demo:
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
  lda #$20
  jsr draw_nt
  lda #$24
  jsr draw_nt
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  lda #M_HINT1           ; はじめの案内（海に書いてあって、流れていく）
  jsr say_ptr
  jsr vram_msg
  lda #M_HINT2
  jsr say_ptr
  jsr vram_msg
  lda #1
  sta hint_on
  lda #0
  ldx #3
@z:
  sta dist,x
  dex
  bpl @z
  sta dsub
  sta level
  sta sx
  sta sxl
  sta spl
  sta paused
  sta newrec
  jsr reset_fish
  jsr clear_hz
  lda #2
  sta sph
  lda #3
  sta lives
  lda #150
  sta sp_t
  lda frame
  eor rng
  sta rng
  lda #1
  sta state
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts

play_update:
  lda pad_new
  and #BTN_START
  beq @np
  lda paused
  eor #1
  sta paused
  beq @np
  lda #$30           ; 止めたら音も止める
  sta $4004
  lda #$80
  sta $4008
  sta $400B
@np:
  lda paused
  beq @run
  rts
@run:
  lda #0
  sta hold
  lda pad
  and #BTN_A|BTN_B
  beq @nh
  inc hold
@nh:
  jsr update_fish
  jsr scroll_on
  jsr spawn
  jsr update_hz
  lda inv
  beq @ni
  dec inv
@ni:
  jsr draw_all
  jsr hud
  ; 案内が左へ流れて見えなくなったら消す（もう一度まわってくる前に）
  lda hint_on
  beq @nhint
  lda sx
  cmp #248
  bcc @nhint
  lda #0
  sta hint_on
  lda #M_HINT1_OFF
  jsr say_ptr
  jsr buf_data
  lda #M_HINT2_OFF
  jsr say_ptr
  jsr buf_data
@nhint:
  lda lives
  bne @r
  jsr go_end
@r:
  rts

; ---- トビウオの動き ----
update_fish:
  lda fy
  cmp #SURF
  bcc @air
  jsr accel_water
  jmp fish_move
@air:
  jsr accel_air
  jmp fish_move

accel_water:
  ; 海の中: おすと上へ（速さに上限）、はなすと下へ
  lda hold
  beq @wrel
  lda vyl
  sec
  sbc #$40
  sta vyl
  lda vyh
  sbc #0
  sta vyh
  bpl @r
  cmp #$fc
  bcc @wcl
  bne @r
  lda vyl
  cmp #$80
  bcs @r
@wcl:
  lda #$fc
  sta vyh
  lda #$80
  sta vyl
  jmp @r
@wrel:
  lda vyl
  clc
  adc #$18
  sta vyl
  lda vyh
  adc #0
  sta vyh
  bmi @r
  cmp #2
  bcc @r
  lda #2
  sta vyh
  lda #0
  sta vyl
  jmp @r
@r:
  rts

accel_air:
  lda vyh
  bpl @fall
  lda vyl              ; 空でのぼるあいだ: 重さ
  clc
  adc #G_UP
  sta vyl
  lda vyh
  adc #0
  sta vyh
  jmp @r
@fall:
  lda hold
  beq @drop
  ; 胸びれを広げる: 落ちる速さを GLIDE まで
  lda vyh
  bne @slow
  lda vyl
  cmp #GLIDE+1
  bcs @slow
  clc
  adc #4
  cmp #GLIDE
  bcc @g1
  lda #GLIDE
@g1:
  sta vyl
  jmp @r
@slow:
  lda vyl
  sec
  sbc #$10
  sta vyl
  lda vyh
  sbc #0
  sta vyh
  bne @r
  lda vyl
  cmp #GLIDE
  bcs @r
  lda #GLIDE
  sta vyl
  jmp @r
@drop:
  lda vyl
  clc
  adc #$20
  sta vyl
  lda vyh
  adc #0
  sta vyh
  cmp #3
  bcc @r
  lda #3
  sta vyh
  lda #0
  sta vyl
@r:
  rts

fish_move:
  lda fyl
  clc
  adc vyl
  sta fyl
  lda fy
  adc vyh
  sta fy
  cmp #TOP
  bcs @nt
  lda #TOP
  sta fy
  lda #0
  sta vyl
  sta vyh
@nt:
  lda fy
  cmp #BOTTOM
  bcc @nb
  lda #BOTTOM
  sta fy
  lda vyh
  bmi @nb
  lda #0
  sta vyh
  sta vyl
@nb:
  ldx #0
  lda fy
  cmp #SURF
  bcs @inw
  inx
@inw:
  cpx air
  beq @r
  stx air
  lda #16              ; 海の面を出入りした: しぶき
  sta spl_t
  lda #FX
  sta spl_x
  lda #0
  sta spl_xl
  lda air
  beq @in
  jsr sfx_leap
  rts
@in:
  jsr sfx_splash
@r:
  rts

; ---- 海が流れる・きょり ----
scroll_on:
  lda sph              ; 流れたドット（小数のくり上がりこみ）を tmp に
  sta tmp
  lda sxl
  clc
  adc spl
  sta sxl
  bcc @nc
  inc tmp
@nc:
  lda sx
  clc
  adc tmp
  sta sx
  lda dsub
  clc
  adc tmp
  sta dsub
  cmp #16
  bcc @r
  sbc #16
  sta dsub
  ; 1 m のびた
  ldx #3
@l:
  inc dist,x
  lda dist,x
  cmp #10
  bcc @lv
  lda #0
  sta dist,x
  dex
  bpl @l
  lda #9               ; 9999 で止める
  ldx #3
@m:
  sta dist,x
  dex
  bpl @m
@lv:
  ; 段 = 100 m ごと（7 まで）。速さも少しずつ上がる
  lda dist
  beq @d1
  lda #7
  bne @d2
@d1:
  lda dist+1
  cmp #7
  bcc @d2
  lda #7
@d2:
  sta level
  asl a
  asl a
  asl a
  sta tmp
  asl a
  clc
  adc tmp              ; level × $18
  sta spl
@r:
  rts

; ---- 追ってくるもの ----
spawn:
  dec sp_t
  beq @go
  rts
@go:
  ldx level
  lda spawn_iv,x
  sta sp_t
  ldx #NH-1
@f:
  lda hz_type,x
  beq @got
  dex
  bpl @f
  rts
@got:
  lda #1               ; はじめの 100 m は マグロだけ（とび方をおぼえる）
  sta tmp4
  lda level
  beq @typ
  jsr rand
  and #1
  clc
  adc #1
  sta tmp4
@typ:
  ldy #NH-1            ; 海と空から同時に来ないように（ほかの種類が うしろにいたら待つ）
@chk:
  lda hz_type,y
  beq @cn
  cmp tmp4
  beq @cn
  lda hz_st,y
  beq @busy
  lda hz_x,y
  cmp #FAIR_X
  bcc @busy
@cn:
  dey
  bpl @chk
  jmp @ok
@busy:
  lda #20
  sta sp_t
  rts
@ok:
  lda tmp4
  sta hz_type,x
  lda #0
  sta hz_st,x
  sta hz_x,x
  sta hz_xl,x
  lda #WARN_T
  sta hz_t,x
  jsr rand
  and #$1f
  sta tmp
  lda level
  asl a
  asl a
  asl a
  asl a
  clc
  adc tmp
  sta tmp
  lda tmp4
  cmp #1
  bne @bird
  lda tmp              ; マグロ: 速さ 1.25〜、深さ 140〜203
  clc
  adc #$40
  sta hz_rl,x
  lda #1
  adc #0
  sta hz_rh,x
  jsr rand
  and #63
  clc
  adc #140
  sta hz_y,x
  rts
@bird:
  lda tmp              ; グンカンドリ: 速さ 1.06〜、高さ 52〜83
  clc
  adc #$10
  sta hz_rl,x
  lda #1
  adc #0
  sta hz_rh,x
  jsr rand
  and #31
  clc
  adc #52
  sta hz_y,x
  rts

update_hz:
  ldx #NH-1
@l:
  lda hz_type,x
  bne @live
  jmp @next
@live:
  lda hz_st,x
  bne @go
  dec hz_t,x
  bne @n0
  lda #1
  sta hz_st,x
  lda hz_y,x
  sta hz_t,x           ; もとの高さ（グンカンドリがもどる所）
@n0:
  jmp @next
@go:
  lda hz_xl,x
  clc
  adc hz_rl,x
  sta hz_xl,x
  lda hz_x,x
  adc hz_rh,x
  sta hz_x,x
  bcs @kill
  cmp #250
  bcc @home
@kill:
  lda #0
  sta hz_type,x
  jmp @next
@home:
  cmp #FX              ; トビウオのうしろにいるあいだだけ、高さを合わせてくる
  bcs @hit
  lda hz_type,x
  cmp #1
  bne @btgt
  lda fy               ; マグロ: 海の面のすぐ下より上には来ない
  cmp #TUNA_MINY
  bcs @tt
  lda #TUNA_MINY
@tt:
  cmp #TUNA_MAXY
  bcc @tt2
  lda #TUNA_MAXY
@tt2:
  sta tmp
  lda frame
  and #1
  beq @hit
  jmp @step
@btgt:
  lda air              ; グンカンドリ: 空にいるトビウオをねらう。海にもぐったら もとの高さへ
  beq @cruise
  lda fy
  cmp #BIRD_MAXY
  bcc @bt
  lda #BIRD_MAXY
@bt:
  sta tmp
  jmp @step
@cruise:
  lda hz_t,x
  sta tmp
  lda frame
  and #1
  beq @hit
@step:
  lda hz_y,x
  cmp tmp
  beq @hit
  bcc @down
  dec hz_y,x
  jmp @hit
@down:
  inc hz_y,x
@hit:
  lda state
  cmp #1
  bne @next
  lda inv
  bne @next
  ldy hz_type,x
  lda hz_x,x
  clc
  adc hit_cx-1,y       ; まん中（マグロ 16・鳥 12）
  sec
  sbc #FX+8
  bcs @px
  eor #$ff
  adc #1
@px:
  cmp hit_w-1,y
  bcs @next
  lda hz_y,x
  sec
  sbc fy
  bcs @py
  eor #$ff
  adc #1
@py:
  cmp #7
  bcs @next
  txa
  pha
  jsr hurt
  pla
  tax
@next:
  dex
  bmi @done
  jmp @l
@done:
  rts

hurt:
  lda lives
  beq @z
  dec lives
@z:
  lda #100
  sta inv
  jsr sfx_hurt
  rts

; ---- 絵 ----
draw_all:
  jsr oam_start
  ; トビウオ（つかまったあとは点めつ）
  lda inv
  and #4
  bne @nofish
  lda #S_FISHS
  ldx air
  beq @pose
  lda #S_FISHG
@pose:
  sta tmp2
  lda fy
  sec
  sbc #9
  sta tmp
  lda #0
  sta tmp3
  lda #FX-4
  sta tmp4
  lda #3
  sta gw
  lda #2
  sta gh
  jsr put_grid
@nofish:
  ; しぶき（海といっしょに流れる）
  lda spl_t
  beq @nospl
  dec spl_t
  lda spl_xl
  sec
  sbc spl
  sta spl_xl
  lda spl_x
  sbc sph
  sta spl_x
  bcc @nospl
  sta tmp4
  lda #SURF-12
  sta tmp
  lda #3
  sta tmp3
  lda #S_SPLB
  ldx spl_t
  cpx #9
  bcc @sp
  lda #S_SPLA
@sp:
  sta tmp2
  lda #2
  sta gw
  lda #1
  sta gh
  jsr put_grid
@nospl:
  ; 追ってくるもの
  ldx #NH-1
@h:
  lda hz_type,x
  bne @hd
  jmp @hn
@hd:
  lda hz_st,x
  bne @body
  lda frame            ; ！（左のはしで点めつ）
  and #8
  bne @hn
  lda hz_y,x
  sec
  sbc #9
  sta tmp
  lda #S_WARN
  sta tmp2
  lda #3
  sta tmp3
  lda #10
  sta tmp4
  lda #1
  sta gw
  lda #2
  sta gh
  jsr put_grid
  jmp @hn
@body:
  lda hz_y,x
  sec
  sbc #9
  sta tmp
  lda hz_x,x
  sta tmp4
  lda #3
  sta gw
  lda #2
  sta gh
  lda frame
  and #8
  sta gc
  lda hz_type,x
  cmp #1
  bne @w3
  lda #4               ; マグロは 32 ドット
  sta gw
@w3:
  lda hz_type,x
  cmp #1
  bne @bd
  lda #1
  sta tmp3
  lda #S_TUNAA
  ldy gc
  beq @tp
  lda #S_TUNAB
@tp:
  sta tmp2
  jmp @gd
@bd:
  lda #2
  sta tmp3
  lda #S_BIRDA
  ldy gc
  beq @bp
  lda #S_BIRDB
@bp:
  sta tmp2
@gd:
  txa
  pha
  jsr put_grid
  pla
  tax
@hn:
  dex
  bmi @hearts
  jmp @h
@hearts:
  lda state
  beq @end
  lda #7
  sta tmp
  lda #2
  sta tmp3
  ldx #0
@ht:
  lda heart_x,x
  sta tmp4
  lda #S_HEART
  cpx lives
  bcc @full
  lda #S_HEARTOFF
@full:
  sta tmp2
  jsr put_spr
  inx
  cpx #3
  bne @ht
@end:
  jsr hide_rest
  rts

; きょりを字の段へ
hud:
  lda #>ADDR_DIST
  ldx #<ADDR_DIST
  ldy #4
  jsr buf_head
  ldx #0
@l:
  lda dist,x
  clc
  adc #T_0
  jsr buf_byte
  inx
  cpx #4
  bne @l
  rts

; ================= おわり =================
go_end:
  lda #2
  sta state
  lda #0
  sta end_t
  sta hold
  ; いちばん遠い きょり
  ldx #0
@c:
  lda dist,x
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
  lda dist,x
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
  ; しばらく そのまま（トビウオは しずむ）
  jsr update_fish
  jsr draw_all
  rts
@res:
  bne @wait
  ; 結果を出す（海を はじめの位置にもどして書きなおす）
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
  lda #$20
  jsr draw_nt
  lda #M_E_DIST
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
  lda #<ADDR_EDIST
  sta tmp
  lda #>ADDR_EDIST
  ldx #dist
  jsr vram_digits
  lda #<ADDR_EBEST
  sta tmp
  lda #>ADDR_EBEST
  ldx #hi
  jsr vram_digits
  lda #<ADDR_DIST
  sta tmp
  lda #>ADDR_DIST
  ldx #dist
  jsr vram_digits
  lda #<ADDR_PHI
  sta tmp
  lda #>ADDR_PHI
  ldx #hi
  jsr vram_digits
  lda #0
  sta sx
  sta sxl
  sta sph
  sta spl
  sta spl_t
  jsr clear_hz
  jsr reset_fish
  jsr oam_start
  jsr hide_rest
  jsr screen_on
  rts
@wait:
  ; 結果の画面: トビウオは見本と同じに はねる
  lda #0
  sta hold
  lda air
  bne @ia
  lda vyh
  bmi @hh
  lda fy
  cmp #124
  bcc @dm
@hh:
  lda #1
  sta hold
@ia:
@dm:
  jsr update_fish
  jsr draw_all
  lda end_t
  cmp #80
  bcc @r
  lda frame
  and #$20
  cmp blink_old
  beq @same
  sta blink_old
  cmp #0
  bne @off
  lda #M_PUSH
  jsr say_ptr
  jmp @put
@off:
  lda #M_PUSH_OFF
  jsr say_ptr
@put:
  jsr buf_data
@same:
  lda pad_new
  and #BTN_START
  beq @r
  jsr go_title
@r:
  rts

; ================= 音 =================
sfx_leap:
  lda #%10010110
  sta $4000
  lda #%10001010
  sta $4001
  lda #$40
  sta $4002
  lda #$11
  sta $4003
  lda #%00000010       ; 水をはなれる音
  sta $400C
  lda #$04
  sta $400E
  lda #$18
  sta $400F
  rts

sfx_splash:
  lda #%00000100
  sta $400C
  lda #$07
  sta $400E
  lda #$20
  sta $400F
  rts

sfx_hurt:
  lda #%00000100
  sta $400C
  lda #$0a
  sta $400E
  lda #$40
  sta $400F
  lda #%10011010
  sta $4000
  lda #%10110011
  sta $4001
  lda #$00
  sta $4002
  lda #$11
  sta $4003
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

; ================= 決まりの表 =================
save_magic: .byte 'T', 'B', '0', '1'
spawn_iv: .byte 170, 150, 130, 115, 100, 88, 76, 66
heart_x: .byte 112, 122, 132
hit_cx: .byte 16, 12
hit_w: .byte 15, 13
