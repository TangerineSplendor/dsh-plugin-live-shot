#Requires -Version 5.1
[CmdletBinding()]
param([string]$DshExe, [string]$DshHome, [string]$ProfileDir, [string]$DataDir)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'install_common.ps1')
$src = [IO.Path]::GetFullPath($PSScriptRoot)
Test-ShotChecksums $src
$targetProfile = Get-ShotProfile $DshHome $ProfileDir
if (-not (Test-Path -LiteralPath (Join-Path $targetProfile 'package.json'))) { throw 'DSH desktop profile not found. Open DSH once, or specify -ProfileDir.' }
$dest = Assert-ShotPackage $targetProfile
$legacy = Assert-ShotPackage $targetProfile -Legacy
$oldConfig = Join-Path $dest '.install.json'
if (-not (Test-Path -LiteralPath $oldConfig)) { $oldConfig = Join-Path $legacy '.install.json' }
$patch = Join-Path $targetProfile 'cordis.patch.yml'
$text = if (Test-Path -LiteralPath $patch) { Read-ShotText $patch } else { '' }
$rowCount = [regex]::Matches($text, '(?m)^[ \t]*- id:[ \t]*dsh-shot[ \t]*\r?$').Count
if ($rowCount -gt 1) { throw 'Duplicate dsh-shot entries; resolve the duplicate profile entries first' }
$ownRow = '(?m)^([ \t]*- id:[ \t]*dsh-shot[ \t]*\r?\n[ \t]+name:[ \t]*)[''"]?(?:@local/dsh-shot|dsh-plugin-live-shot)[''"]?([ \t]*\r?)$'
if ($rowCount -eq 1) {
  if (-not [regex]::IsMatch($text, $ownRow)) { throw 'A different plugin already uses id dsh-shot' }
  $next = [regex]::Replace($text, $ownRow, '${1}''dsh-plugin-live-shot''${2}')
} else {
  $next = $text + "`r`n# BEGIN dsh-shot portable`r`n- insert:`r`n    - id: dsh-shot`r`n      name: 'dsh-plugin-live-shot'`r`n# END dsh-shot portable`r`n"
}
if (-not $DataDir -and (Test-Path -LiteralPath $oldConfig)) { $DataDir = (Read-ShotText $oldConfig | ConvertFrom-Json).dataDir }
if (-not $DataDir) { $DataDir = Join-Path $targetProfile '.dsh-shot-data' }
$exe = Find-ShotDsh $DshExe
$data = Initialize-ShotData $DataDir $targetProfile
$runtimeExe = Initialize-ShotRuntime $exe $data

# Copy a public-file allowlist only. Never mirror .runtime, profiles, or Git.
$payload = Get-ShotPayload $src
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($relative in $payload.Keys) {
  $output = Join-Path $dest $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null
  if ([IO.Path]::GetFullPath($payload[$relative]) -ne [IO.Path]::GetFullPath($output)) { Copy-Item -LiteralPath $payload[$relative] -Destination $output -Force }
}
$manifest = Read-ShotText (Join-Path $src 'package.json') | ConvertFrom-Json
$config = @{ kind='dsh-shot-install'; version=$manifest.version; dataDir=$data; electronExe=$runtimeExe; profileDir=$targetProfile; sourceDsh=$exe }
Write-ShotText (Join-Path $dest '.install.json') (($config | ConvertTo-Json) + "`n")

if ($next -ne $text) {
  $backups = Join-Path $data 'backups'
  New-Item -ItemType Directory -Force -Path $backups | Out-Null
  if (Test-Path -LiteralPath $patch) { Copy-Item -LiteralPath $patch -Destination (Join-Path $backups ('patch-' + [Guid]::NewGuid().ToString('N') + '.yml')) }
  Write-ShotText $patch $next
  Write-Output 'patch: canonical screenshot entry installed (legacy name migrated if present)'
} else { Write-Output 'patch: existing screenshot entry retained' }
Write-Output "Installed $($manifest.version)"
Write-Output "Package: $dest"
Write-Output "Data: $data"
Write-Output 'No administrator rights, Node.js, or network download was required.'
Write-Output 'Next: quit DSH completely from its tray menu, then open DSH again.'
Write-Output 'After installation you can delete the extracted ZIP folder.'
