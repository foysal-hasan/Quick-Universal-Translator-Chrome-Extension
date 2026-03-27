$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "f:\Github\Chrome extension devloping\Translator\assets\icons"
if (-not (Test-Path $root)) {
  New-Item -ItemType Directory -Path $root | Out-Null
}

function New-RoundedRectPath {
  param(
    [float]$x,
    [float]$y,
    [float]$w,
    [float]$h,
    [float]$r
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

$sizes = @(64, 192, 512)
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [Math]::Max([float]($s * 0.03), 1)
  $tileSize = $s - (2 * $pad)
  $radius = [Math]::Max([float]($s * 0.22), 2)
  $tilePath = New-RoundedRectPath -x $pad -y $pad -w $tileSize -h $tileSize -r $radius

  $startPoint = New-Object System.Drawing.PointF -ArgumentList @([float]$pad, [float]$pad)
  $endPoint = New-Object System.Drawing.PointF -ArgumentList @([float]($s - $pad), [float]($s - $pad))
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $startPoint,
    $endPoint,
    [System.Drawing.Color]::FromArgb(24, 104, 219),
    [System.Drawing.Color]::FromArgb(24, 104, 219)
  )
  $g.FillPath($bgBrush, $tilePath)

  $accentBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $startPoint,
    $endPoint,
    [System.Drawing.Color]::FromArgb(0, 0, 0, 0),
    [System.Drawing.Color]::FromArgb(80, 191, 232, 255)
  )
  $g.FillPath($accentBrush, $tilePath)

  $strokeWidth = [Math]::Max([float]($s * 0.08), 2.0)
  $glyphPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 255, 255), $strokeWidth)
  $glyphPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $glyphPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $glyphPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $left = $pad + ($tileSize * 0.22)
  $right = $pad + ($tileSize * 0.78)
  $mid = $pad + ($tileSize * 0.5)
  $topY = $pad + ($tileSize * 0.37)
  $bottomY = $pad + ($tileSize * 0.64)

  # Upper directional stroke (->)
  $g.DrawLine($glyphPen, [float]$left, [float]$topY, [float]($right - ($s * 0.1)), [float]$topY)
  $head = [Math]::Max([float]($s * 0.09), 1.8)
  $g.DrawLine($glyphPen, [float]($right - $head), [float]($topY - $head), [float]$right, [float]$topY)
  $g.DrawLine($glyphPen, [float]($right - $head), [float]($topY + $head), [float]$right, [float]$topY)

  # Lower directional stroke (<-)
  $g.DrawLine($glyphPen, [float]($left + ($s * 0.1)), [float]$bottomY, [float]$right, [float]$bottomY)
  $g.DrawLine($glyphPen, [float]($left + $head), [float]($bottomY - $head), [float]$left, [float]$bottomY)
  $g.DrawLine($glyphPen, [float]($left + $head), [float]($bottomY + $head), [float]$left, [float]$bottomY)

  $dividerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 255, 255), [Math]::Max([float]($s * 0.035), 1.5))
  $dividerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $dividerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $dividerPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLine($dividerPen, [float]$mid, [float]($topY + ($s * 0.03)), [float]$mid, [float]($bottomY - ($s * 0.03)))

  $outFile = Join-Path $root ("icon" + $s + ".png")
  $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

  $dividerPen.Dispose()
  $glyphPen.Dispose()
  $accentBrush.Dispose()
  $bgBrush.Dispose()
  $tilePath.Dispose()
  $g.Dispose()
  $bmp.Dispose()

  Write-Output "Created $outFile"
}
