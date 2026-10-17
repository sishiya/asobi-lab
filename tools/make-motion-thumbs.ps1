# あそびラボの動くサムネイルを作る → thumbs/<game>.mp4（640×360、4秒、音なし、くり返し再生用）
# 静止画の <game>.jpg も、動画の最初のコマで撮り直す（-NoStill でしない）。静止画は動画の最初の絵・動きを減らす設定の人・OGP 用。
# 動画のないゲームの静止画は make-thumbs.ps1 で撮る。
# 使い方（ローカルのサーバー games を起動しておく。リポジトリのルートで）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-motion-thumbs.ps1 -Games dino-race,resistance -Sheet $env:TEMP\sheets
# しくみ: make-thumbs.ps1 と同じく tools/thumb.html?game=<game>&motion=1 を開き、ready になったら
# ゲームの時計を止めて 1 コマずつ進めては撮り、ffmpeg で mp4 にする（重いゲームでも動画の中の速さは本物どおり）。
# ?thumb で止まる作りのゲームは、thumb.html の MOTION で同じ場面から動きはじめさせる。まなびラボの _dev/tools/make-motion-thumbs.ps1 を写したもの
param(
  [string[]]$Games = @('dino-race','edge-falls','flat-history','heaven-spheres','parasite-pilot','resistance'),
  [string]$Sheet = '',   # 指定すると、確かめ用に4コマを並べた png をこのフォルダに作る
  [string]$Probe = '',   # 確かめ用: 撮りはじめと撮り終わりに、この式をゲームの窓（w）で評価して表示（例: 'w.__rz.world.t'）
  [double]$Sec = 4,
  [int]$Fps = 15,
  [int]$Crf = 0,   # 画質（大きいほど小さく・あらく）。0 なら下の $CrfOf（なければ 30）
  [int]$Port = 8780,
  [int]$DebugPort = 9344,
  [int]$TimeoutSec = 90,
  [string]$Query = '',   # 確かめ用: thumb.html に足す引数（例: '&dino=raptor&t=3'）
  [switch]$NoStill   # 静止画 <game>.jpg を撮り直さない（ふつうは最初のコマで撮り直して、動画とそろえる）
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$Games = $Games | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
$CrfOf = @{ 'dino-race' = 32 }   # 背景が速く流れて大きくなるゲームだけ、少しあらく（1本 150KB まで）
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'thumbs'
$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg) { throw 'ffmpeg が見つかりません（winget install Gyan.FFmpeg）' }
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome か Edge が見つかりません' }
$tmp = Join-Path $env:TEMP 'asobi-motion-thumbs'
[IO.Directory]::CreateDirectory($tmp) | Out-Null

# --- DevTools プロトコル（WebSocket）の小さな道具（make-thumbs.ps1 と同じ） ---
$script:msgId = 0
function Send-Cdp($ws, [string]$method, $params) {
  $script:msgId++
  $id = $script:msgId
  $p = if ($params) { $params } else { @{} }
  $json = @{ id = $id; method = $method; params = $p } | ConvertTo-Json -Depth 6 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ws.SendAsync((New-Object ArraySegment[byte] -ArgumentList @(, $bytes)), 'Text', $true, [Threading.CancellationToken]::None).Wait()
  $buf = New-Object byte[] 1048576
  while ($true) {
    $ms = New-Object IO.MemoryStream
    do {
      $r = $ws.ReceiveAsync((New-Object ArraySegment[byte] -ArgumentList @(, $buf)), [Threading.CancellationToken]::None).Result
      $ms.Write($buf, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $msg = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
    if ($msg.id -eq $id) { return $msg }   # それ以外（イベント）は読み捨てる
  }
}

$proc = Start-Process -FilePath $chrome -PassThru -WindowStyle Hidden -ArgumentList @(
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--window-size=1280,720', "--remote-debugging-port=$DebugPort", "--user-data-dir=$tmp\profile", 'about:blank')
try {
  for ($i = 0; $i -lt 50; $i++) { try { Invoke-RestMethod "http://127.0.0.1:$DebugPort/json/version" | Out-Null; break } catch { Start-Sleep -Milliseconds 200 } }
  $jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter([Drawing.Imaging.Encoder]::Quality, [long]86)   # make-thumbs.ps1 と同じ画質

  foreach ($a in $Games) {
    $url = "http://localhost:$Port/tools/thumb.html?game=$a&motion=1$Query"
    $tab = Invoke-RestMethod -Method Put "http://127.0.0.1:$DebugPort/json/new?about:blank"
    $ws = New-Object Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
    # 画面をちょうど 640×360 に、2倍の細かさで（撮れる絵は 1280×720）。ゲームは前の撮り方と同じ 640×360 の画面で見える。
    # （--window-size だけだと窓のふちの分だけ描ける部分が低くなり、静止画が縦にのびていた。2026-10-17）
    Send-Cdp $ws 'Emulation.setDeviceMetricsOverride' @{ width = 640; height = 360; deviceScaleFactor = 2; mobile = $false } | Out-Null
    Send-Cdp $ws 'Page.navigate' @{ url = $url } | Out-Null
    $ok = $false
    $t0 = Get-Date
    while (((Get-Date) - $t0).TotalSeconds -lt $TimeoutSec) {
      Start-Sleep -Seconds 1
      $r = Send-Cdp $ws 'Runtime.evaluate' @{ expression = 'document.title' }
      if ($r.result.result.value -eq 'ready') { $ok = $true; break }
    }
    if (-not $ok) { Write-Host "時間切れ（そのまま撮る）: $a" }

    # ゲームの時計を 1/$Fps 秒ずつ進めては撮る（thumb.html の __motionStep。2倍の細かさの絵を 640×360 で）
    $dir = Join-Path $tmp $a
    if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
    [IO.Directory]::CreateDirectory($dir) | Out-Null
    $clip = @{ x = 0; y = 0; width = 640; height = 360; scale = 0.5 }   # 2倍の細かさで描いたものを 640×360 に
    $n = [int]($Sec * $Fps)
    $probeJs = "(() => { const w = document.getElementById('f').contentWindow; try { return JSON.stringify($Probe); } catch (e) { return String(e); } })()"
    if ($Probe) { Write-Host "  はじめ: $((Send-Cdp $ws 'Runtime.evaluate' @{ expression = $probeJs }).result.result.value)" }
    for ($i = 0; $i -lt $n; $i++) {
      Send-Cdp $ws 'Runtime.evaluate' @{ expression = "window.__motionStep($(1000 / $Fps))"; awaitPromise = $true } | Out-Null
      $shot = Send-Cdp $ws 'Page.captureScreenshot' @{ format = 'jpeg'; quality = 92; clip = $clip }
      [IO.File]::WriteAllBytes((Join-Path $dir ('f{0:D4}.jpg' -f $i)), [Convert]::FromBase64String($shot.result.data))
      if ($i -eq 0 -and -not $NoStill) {
        # 静止画 <game>.jpg も、この最初のコマで撮り直す（make-thumbs.ps1 と同じ作り方）。雲や虫の場所が読みこむたびに変わるゲームでも、
        # 静止画と動画のはじめの絵がぴったりそろう（マウスを乗せたとき、絵がとばない）
        $png = [Convert]::FromBase64String((Send-Cdp $ws 'Page.captureScreenshot' @{ format = 'png' }).result.data)
        $src = [Drawing.Image]::FromStream((New-Object IO.MemoryStream(, $png)))
        if ($src.Width -ne 1280 -or $src.Height -ne 720) { throw "撮れた大きさが $($src.Width)×$($src.Height)（1280×720 のはず。縦横がのびる）: $a" }
        $bmp = New-Object Drawing.Bitmap 640, 360
        $g = [Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($src, 0, 0, 640, 360)
        $g.Dispose(); $src.Dispose()
        $bmp.Save((Join-Path $out "$a.jpg"), $jpeg, $ep); $bmp.Dispose()   # System.Drawing で作り直すので、撮影情報などのメタデータは入らない
      }
    }
    if ($Probe) { Write-Host "  おわり: $((Send-Cdp $ws 'Runtime.evaluate' @{ expression = $probeJs }).result.result.value)" }
    $ws.Dispose()
    Invoke-RestMethod "http://127.0.0.1:$DebugPort/json/close/$($tab.id)" | Out-Null

    $mp4 = Join-Path $out "$a.mp4"
    & $ffmpeg -y -loglevel error -framerate $Fps -i (Join-Path $dir 'f%04d.jpg') -vf 'scale=640:360,format=yuv420p' `
      -c:v libx264 -preset slow -crf $(if ($Crf) { $Crf } elseif ($CrfOf[$a]) { $CrfOf[$a] } else { 30 }) -profile:v main -movflags +faststart -an $mp4
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg に失敗: $a" }
    if ($Sheet) {
      [IO.Directory]::CreateDirectory($Sheet) | Out-Null
      & $ffmpeg -y -loglevel error -i $mp4 -vf "select='not(mod(n\,$([int]($n / 4))))',scale=480:270,tile=4x1" -frames:v 1 (Join-Path $Sheet "$a.png")
    }
    $kb = [int]((Get-Item $mp4).Length / 1024)
    Write-Host "作成: thumbs/$a.mp4（$n コマ・$kb KB・$([int]((Get-Date) - $t0).TotalSeconds) 秒）"
  }
} finally {
  # 撮影用に起動した Chrome（専用のプロフィール）だけを終了する
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*asobi-motion-thumbs*" } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
}
