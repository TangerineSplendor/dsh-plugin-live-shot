#Requires -Version 5.1
[CmdletBinding()]
param([string]$DshHome, [string]$ProfileDir, [string]$DataDir, [switch]$RemoveData)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'install_common.ps1')
$targetProfile = Get-ShotProfile $DshHome $ProfileDir
$dest = Assert-ShotPackage $targetProfile
$legacy = Assert-ShotPackage $targetProfile -Legacy
$data = if ($DataDir) { [IO.Path]::GetFullPath($DataDir) } else { Join-Path $targetProfile '.dsh-shot-data' }
$configPath = Join-Path $dest '.install.json'
if (-not (Test-Path -LiteralPath $configPath)) { $configPath = Join-Path $legacy '.install.json' }
if (-not $DataDir -and (Test-Path -LiteralPath $configPath)) { $data = (Read-ShotText $configPath | ConvertFrom-Json).dataDir }
$patch = Join-Path $targetProfile 'cordis.patch.yml'
if (Test-Path -LiteralPath $patch) {
  $text = Read-ShotText $patch
  $new = [regex]::Replace($text, '(?m)\r?\n# BEGIN dsh-shot portable\r?\n- insert:\r?\n    - id: dsh-shot\r?\n      name: ''(?:@local/dsh-shot|dsh-plugin-live-shot)''\r?\n# END dsh-shot portable\r?\n?', '')
  # Also accept the exact unmarked block used by the original local installer.
  $new = [regex]::Replace($new, '(?m)^- insert:\r?\n    - id: dsh-shot\r?\n      name: ''(?:@local/dsh-shot|dsh-plugin-live-shot)''\r?\n?', '')
  if ($new -ne $text) { Write-ShotText $patch $new; Write-Output 'patch: screenshot entry removed' }
}
# Assert-ShotPackage has checked this exact absolute target and its owner.
foreach ($ownedPackage in @($dest, $legacy)) {
  if (Test-Path -LiteralPath $ownedPackage) { Remove-Item -LiteralPath $ownedPackage -Recurse -Force; Write-Output "Removed: $ownedPackage" }
}
if ($RemoveData -and (Test-Path -LiteralPath $data)) {
  $root = [IO.Path]::GetFullPath($data).TrimEnd('\')
  if ($root -eq [IO.Path]::GetPathRoot($root).TrimEnd('\') -or $root -eq $targetProfile.TrimEnd('\')) { throw 'Unsafe data removal target' }
  $item = Get-Item -LiteralPath $root -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to remove linked data directory' }
  $marker = Join-Path $root '.dsh-shot-data.json'
  if (-not (Test-Path -LiteralPath $marker)) { throw 'No ownership marker; data not removed' }
  $owner = Read-ShotText $marker | ConvertFrom-Json
  if ($owner.package -notin '@local/dsh-shot', 'dsh-plugin-live-shot' -or $owner.profileDir -ne $targetProfile) { throw 'Data owner mismatch; data not removed' }
  Remove-Item -LiteralPath $root -Recurse -Force
  Write-Output "Removed data: $root"
} else { Write-Output "Preferences and runtime retained: $data" }
Write-Output 'Next: quit DSH completely from its tray menu, then open DSH again.'
