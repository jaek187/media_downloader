#Requires -Version 5.1
<#
  Media Downloader installer for Windows.
  Run: irm https://raw.githubusercontent.com/jaek187/media_downloader/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"
$Repo = "jaek187/media_downloader"
$InstallDir = Join-Path $env:LOCALAPPDATA "MediaDownloader"
$AssetName = "media-downloader-windows.zip"
$TaskName = "MediaDownloaderServer"

function Get-ReleaseAssetUrl([string]$Name) {
    "https://github.com/$Repo/releases/latest/download/$Name"
}

Write-Host "Media Downloader installer" -ForegroundColor Cyan
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("media-downloader-" + [guid]::NewGuid())
$Archive = Join-Path $TempDir $AssetName

try {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    Write-Host "Downloading the latest release..."
    Invoke-WebRequest -Uri (Get-ReleaseAssetUrl $AssetName) -OutFile $Archive -UseBasicParsing

    # Prevent Task Scheduler from restarting the helper while it is being updated.
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    # A previous installer version could leave duplicate helpers running. The
    # executable name is unique to this application, so close every instance.
    & taskkill.exe /F /IM "media-downloader-server.exe" 2>$null | Out-Null
    $Deadline = (Get-Date).AddSeconds(10)
    while ((Get-Process -Name "media-downloader-server" -ErrorAction SilentlyContinue) -and (Get-Date) -lt $Deadline) {
        Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Name "media-downloader-server" -ErrorAction SilentlyContinue) {
        throw "The existing Media Downloader service did not stop. Close it and run the installer again."
    }

    if (Test-Path $InstallDir) { Remove-Item -LiteralPath $InstallDir -Recurse -Force }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Expand-Archive -LiteralPath $Archive -DestinationPath $InstallDir -Force

    $Server = Join-Path $InstallDir "media-downloader-server.exe"
    if (-not (Test-Path -LiteralPath $Server)) { throw "The release archive does not contain media-downloader-server.exe." }
    $Action = New-ScheduledTaskAction -Execute $Server -WorkingDirectory $InstallDir
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    $Settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName

    Write-Host "`nInstalled successfully." -ForegroundColor Green
    Write-Host "In Chrome, Edge, or Brave: open chrome://extensions, enable Developer mode, then Load unpacked:"
    Write-Host (Join-Path $InstallDir "extension") -ForegroundColor Yellow
} finally {
    if (Test-Path $TempDir) { Remove-Item -LiteralPath $TempDir -Recurse -Force }
}
