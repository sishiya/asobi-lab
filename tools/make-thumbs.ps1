# あそびラボのサムネイルを作る → thumbs/<game>.jpg（640×360）
# 使い方（ローカルのサーバー games を起動しておく。リポジトリのルートで）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-thumbs.ps1 -Games dino-race
# しくみ: ヘッドレスの Chrome で <game>/?thumb を開いて撮る。各ゲームは ?thumb のとき、
# 見せたい場面をその場で描いて止まる（dino-race は main.js の最後）。
param(
  [string[]]$Games = @('dino-race'),
  [int]$Port = 8780
)
$ErrorActionPreference = 'Stop'
$Games = $Games | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'thumbs'
[IO.Directory]::CreateDirectory($out) | Out-Null
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome か Edge が見つかりません' }
$tmp = Join-Path $env:TEMP 'asobi-thumbs'
[IO.Directory]::CreateDirectory($tmp) | Out-Null

foreach ($g in $Games) {
  $png = Join-Path $tmp "$g.png"
  if (Test-Path $png) { Remove-Item $png }
  # 2倍の大きさで撮って縮める（線がきれいになる）。virtual-time-budget で読み込みと描画を待つ
  # Start-Process で起動する（Chrome が標準エラーに出す警告で、PowerShell 5.1 が止まらないように）
  $args_ = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=640,360',
    '--virtual-time-budget=8000', "--user-data-dir=`"$tmp\profile`"", "--screenshot=`"$png`"", "http://localhost:$Port/$g/?thumb")
  Start-Process -FilePath $chrome -ArgumentList $args_ -Wait -WindowStyle Hidden
  $t = 0; while (-not (Test-Path $png) -and $t -lt 30) { Start-Sleep -Milliseconds 500; $t++ }
  if (-not (Test-Path $png)) { Write-Host "$g : 撮れませんでした" -ForegroundColor Yellow; continue }
  $src = [Drawing.Image]::FromFile($png)
  $bmp = New-Object Drawing.Bitmap 640, 360
  $gr = [Drawing.Graphics]::FromImage($bmp)
  $gr.InterpolationMode = 'HighQualityBicubic'
  $gr.DrawImage($src, 0, 0, 640, 360)
  $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 86L
  $dst = Join-Path $out "$g.jpg"
  $bmp.Save($dst, $codec, $ep)   # System.Drawing で作り直すので、撮影情報などのメタデータは入らない
  $gr.Dispose(); $bmp.Dispose(); $src.Dispose()
  Write-Host "$g : $dst"
}
