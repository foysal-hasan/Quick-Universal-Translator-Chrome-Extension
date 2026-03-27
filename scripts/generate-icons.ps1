$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "f:\Github\Chrome extension devloping\Translator\assets\icons"
if (-not (Test-Path $root)) {
  New-Item -ItemType Directory -Path $root | Out-Null
}

$sizes = @(16, 48, 128)
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $g.Clear([System.Drawing.Color]::FromArgb(13, 79, 131))

  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 242, 251))
  $g.FillEllipse($bgBrush, 1, 1, $s - 2, $s - 2)

  $fontSize = [Math]::Max([int]($s * 0.5), 7)
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

  $txtBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(9, 57, 94))
  $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
  $g.DrawString("B", $font, $txtBrush, $rect, $fmt)

  $outFile = Join-Path $root ("icon" + $s + ".png")
  $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

  $txtBrush.Dispose()
  $fmt.Dispose()
  $font.Dispose()
  $bgBrush.Dispose()
  $g.Dispose()
  $bmp.Dispose()

  Write-Output "Created $outFile"
}
