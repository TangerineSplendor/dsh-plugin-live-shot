#Requires -Version 5.1
[CmdletBinding()]
param([string]$OutputDir)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'install_common.ps1')
$sourceRoot = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not $OutputDir) { $OutputDir = Join-Path $sourceRoot 'dist' }
$outputRoot = [IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$manifest = Read-ShotText (Join-Path $sourceRoot 'package.json') | ConvertFrom-Json
$name = $manifest.name + '-' + $manifest.version + '-windows-x64'
$staging = Join-Path $outputRoot ('stage-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
$bundle = Join-Path $staging $name
New-Item -ItemType Directory -Force -Path $bundle | Out-Null
$files = Get-ShotPayload $sourceRoot
foreach ($relative in $files.Keys) {
  $target = Join-Path $bundle $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  Copy-Item -LiteralPath $files[$relative] -Destination $target
}
# The distributed README is the user guide, not the developer workspace notes.
Copy-Item -LiteralPath (Join-Path $sourceRoot 'portable_readme.md') -Destination (Join-Path $bundle 'README.md') -Force
$lines = @()
foreach ($file in (Get-ChildItem -LiteralPath $bundle -Recurse -File | Sort-Object FullName)) {
  $relative = $file.FullName.Substring($bundle.Length + 1).Replace('\','/')
  $lines += ((Get-ShotHash $file.FullName) + '  ' + $relative)
}
Write-ShotText (Join-Path $bundle 'checksums.sha256') (($lines -join "`n") + "`n")
$zip = Join-Path $outputRoot ($name + '.zip')
if (Test-Path -LiteralPath $zip) {
  $zip = Join-Path $outputRoot ($name + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($staging, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
Write-ShotText ($zip + '.sha256') ((Get-ShotHash $zip) + '  ' + [IO.Path]::GetFileName($zip) + "`n")
Write-Output "Archive: $zip"
Write-Output ('SHA256: ' + (Get-ShotHash $zip))
Write-Output ('Bytes: ' + (Get-Item -LiteralPath $zip).Length)
