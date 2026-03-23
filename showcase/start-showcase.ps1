# 從工作坊根目錄啟動靜態伺服器並開啟展示頁（Windows PowerShell）
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Port = if ($env:SHOWCASE_PORT) { [int]$env:SHOWCASE_PORT } else { 8765 }
$Url = "http://127.0.0.1:$Port/showcase/"

Set-Location $Root
Write-Host "根目錄: $Root"
Write-Host "展示網址: $Url"
Write-Host ""

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
  $py = Get-Command python3 -ErrorAction SilentlyContinue
}
if (-not $py) {
  Write-Error "找不到 python 或 python3，請先安裝 Python 並加入 PATH。"
}

$pyExe = $py.Source
$job = Start-Job -ScriptBlock {
  param($RootPath, $ListenPort, $PythonExe)
  Set-Location $RootPath
  & $PythonExe -m http.server $ListenPort
} -ArgumentList $Root.Path, $Port, $pyExe

Start-Sleep -Seconds 1
Start-Process $Url
Write-Host "伺服器在背景 Job 中執行。展示頁應已於瀏覽器開啟。"
Write-Host "按 Enter 停止伺服器並結束…"
$null = Read-Host
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
Write-Host "已停止。"
