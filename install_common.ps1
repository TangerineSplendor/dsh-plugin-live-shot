# Shared by the portable installer and uninstaller. ASCII for PowerShell 5.1.
function Get-ShotProfile([string]$HomePath, [string]$ProfilePath) {
  if ($ProfilePath) { return [IO.Path]::GetFullPath($ProfilePath) }
  if (-not $HomePath) { $HomePath = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' } }
  return [IO.Path]::GetFullPath((Join-Path $HomePath 'profiles\desktop'))
}
function Read-ShotText([string]$FilePath) {
  return [IO.File]::ReadAllText($FilePath, [Text.Encoding]::UTF8)
}
function Get-ShotHash([string]$FilePath) {
  $algorithm = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($FilePath)
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}
function Write-ShotText([string]$FilePath, [string]$Text) {
  $bom = $false
  if (Test-Path -LiteralPath $FilePath) {
    $bytes = [IO.File]::ReadAllBytes($FilePath)
    $bom = $bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191
  }
  [IO.File]::WriteAllText($FilePath, $Text, [Text.UTF8Encoding]::new($bom))
}
function Assert-ShotPackage([string]$ProfilePath, [switch]$Legacy) {
  $root = [IO.Path]::GetFullPath($ProfilePath).TrimEnd('\')
  $slot = if ($Legacy) { 'node_modules\@local\dsh-shot' } else { 'node_modules\dsh-plugin-live-shot' }
  $target = [IO.Path]::GetFullPath((Join-Path $root $slot))
  if (-not $target.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe package path' }
  if (Test-Path -LiteralPath $target) {
    $item = Get-Item -LiteralPath $target -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to modify a linked plugin directory' }
    $manifest = Join-Path $target 'package.json'
    if (-not (Test-Path -LiteralPath $manifest)) { throw 'Existing plugin directory has no package.json; resolve it manually' }
    if ((Read-ShotText $manifest | ConvertFrom-Json).name -notin '@local/dsh-shot', 'dsh-plugin-live-shot') { throw 'Existing directory belongs to another package' }
  }
  return $target
}
function Find-ShotDsh([string]$ExplicitPath, [switch]$NoPrompt) {
  $candidates = New-Object 'System.Collections.Generic.List[string]'
  if ($ExplicitPath) { $candidates.Add([IO.Path]::GetFullPath($ExplicitPath)) }
  else {
    Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path -and -not $candidates.Contains($_.Path)) { $candidates.Add($_.Path) }
    }
    foreach ($base in @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
      if ($base) {
        $candidates.Add((Join-Path $base 'Programs\DeepSeek Harness\DeepSeek Harness.exe'))
        $candidates.Add((Join-Path $base 'DeepSeek Harness\DeepSeek Harness.exe'))
      }
    }
    foreach ($registryPath in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
      Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*DeepSeek*Harness*' } | ForEach-Object {
        if ($_.InstallLocation) { $candidates.Add((Join-Path $_.InstallLocation 'DeepSeek Harness.exe')) }
        if ($_.DisplayIcon) { $candidates.Add(($_.DisplayIcon -replace ',\d+$', '').Trim('"')) }
      }
    }
  }
  foreach ($candidate in $candidates) {
    if ((Test-Path -LiteralPath $candidate -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path (Split-Path $candidate) 'resources\default_app.asar'))) {
      return (Get-Item -LiteralPath $candidate).FullName
    }
  }
  if ($ExplicitPath) { throw 'Selected executable is not a supported DSH Electron installation' }
  if ($NoPrompt) { throw 'DSH runtime not found. Run the supplied install.bat and select DeepSeek Harness.exe.' }
  Add-Type -AssemblyName System.Windows.Forms
  $picker = New-Object System.Windows.Forms.OpenFileDialog
  $picker.Title = 'Select the installed DeepSeek Harness.exe'
  $picker.Filter = 'DeepSeek Harness|DeepSeek Harness.exe|Executable|*.exe'
  try {
    if ($picker.ShowDialog() -ne 'OK') { throw 'No DSH executable selected' }
    return Find-ShotDsh $picker.FileName
  } finally { $picker.Dispose() }
}
function Initialize-ShotData([string]$DataPath, [string]$ProfilePath) {
  $dataRoot = [IO.Path]::GetFullPath($DataPath).TrimEnd('\')
  if ($dataRoot -eq [IO.Path]::GetPathRoot($dataRoot).TrimEnd('\') -or $dataRoot -eq $ProfilePath.TrimEnd('\')) { throw 'Choose a dedicated plugin data directory' }
  $marker = Join-Path $dataRoot '.dsh-shot-data.json'
  if ((Test-Path -LiteralPath $dataRoot) -and ((Get-Item -LiteralPath $dataRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Refusing a linked data directory' }
  if (Test-Path -LiteralPath $marker) {
    $owner = Read-ShotText $marker | ConvertFrom-Json
    if ($owner.package -notin '@local/dsh-shot', 'dsh-plugin-live-shot' -or $owner.profileDir -ne $ProfilePath) { throw 'Data directory belongs to another installation' }
  } elseif ((Test-Path -LiteralPath $dataRoot) -and (Get-ChildItem -LiteralPath $dataRoot -Force | Select-Object -First 1)) {
    throw 'Data directory is not empty and has no ownership marker; choose an empty directory'
  }
  New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
  Write-ShotText $marker ((@{ package='dsh-plugin-live-shot'; profileDir=$ProfilePath } | ConvertTo-Json) + "`n")
  return $dataRoot
}
function Initialize-ShotRuntime([string]$DshPath, [string]$DataPath) {
  $source = Split-Path $DshPath
  foreach ($required in @('icudtl.dat', 'resources.pak', 'v8_context_snapshot.bin', 'locales\en-US.pak', 'resources\default_app.asar')) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $required))) { throw "DSH runtime file missing: $required" }
  }
  $hash = Get-ShotHash $DshPath
  $engine = Join-Path $DataPath ('engine-' + $hash.Substring(0, 12).ToLowerInvariant())
  $stamp = Join-Path $engine 'runtime.json'
  $exe = Join-Path $engine 'electron.exe'
  if ((Test-Path -LiteralPath $stamp) -and (Test-Path -LiteralPath $exe)) {
    $old = Read-ShotText $stamp | ConvertFrom-Json
    if ($old.sha256 -eq $hash -and (Get-ShotHash $exe) -eq $hash) { return $exe }
  }
  if (Test-Path -LiteralPath $engine) { $engine += '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) }
  New-Item -ItemType Directory -Force -Path (Join-Path $engine 'resources') | Out-Null
  Copy-Item -LiteralPath $DshPath -Destination (Join-Path $engine 'electron.exe')
  Get-ChildItem -LiteralPath $source -File | Where-Object {
    $_.Extension -in '.dll', '.pak', '.bin', '.dat' -or $_.Name -in 'LICENSE.electron.txt', 'LICENSES.chromium.html', 'vk_swiftshader_icd.json'
  } | Copy-Item -Destination $engine
  Copy-Item -LiteralPath (Join-Path $source 'locales') -Destination $engine -Recurse
  Copy-Item -LiteralPath (Join-Path $source 'resources\default_app.asar') -Destination (Join-Path $engine 'resources\default_app.asar')
  Write-ShotText (Join-Path $engine 'runtime.json') ((@{ sha256=$hash; source=$DshPath; version=(Get-Item -LiteralPath $DshPath).VersionInfo.FileVersion } | ConvertTo-Json) + "`n")
  return Join-Path $engine 'electron.exe'
}
function Get-ShotPayload([string]$SourcePath) {
  $manifest = Read-ShotText (Join-Path $SourcePath 'package.json') | ConvertFrom-Json
  $patterns = @('package.json', 'README.md', 'portable_readme.md', 'THIRD_PARTY_NOTICES.md', 'install.ps1', 'uninstall.ps1', 'install_common.ps1', 'install.bat', 'uninstall.bat') + $manifest.files
  $found = @{}
  foreach ($pattern in $patterns) {
    if ([IO.Path]::IsPathRooted($pattern) -or $pattern -match '(^|[/\\])\.\.([/\\]|$)') { throw 'Unsafe package file pattern' }
    $directory = [IO.Path]::GetDirectoryName($pattern)
    $parent = if ($directory) { Join-Path $SourcePath $directory } else { $SourcePath }
    $leaf = [IO.Path]::GetFileName($pattern)
    $matchesForPattern = if ($leaf.Contains('*') -or $leaf.Contains('?')) {
      @(Get-ChildItem -LiteralPath $parent -Filter $leaf -File -ErrorAction Stop)
    } else { @(Get-Item -LiteralPath (Join-Path $parent $leaf) -ErrorAction Stop) }
    foreach ($file in $matchesForPattern) {
      if (-not $file.FullName.StartsWith($SourcePath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Package file escapes its source directory' }
      $relative = $file.FullName.Substring($SourcePath.TrimEnd('\').Length + 1)
      $found[$relative] = $file.FullName
    }
  }
  return $found
}
function Test-ShotChecksums([string]$SourcePath) {
  $manifest = Join-Path $SourcePath 'checksums.sha256'
  if (-not (Test-Path -LiteralPath $manifest)) { return }
  foreach ($line in ((Read-ShotText $manifest) -split "`n")) {
    if (-not $line.Trim()) { continue }
    if ($line.TrimEnd("`r") -notmatch '^([0-9a-fA-F]{64})  (.+)$') { throw 'Malformed checksums.sha256' }
    $expected = $Matches[1]; $relative = $Matches[2]
    $target = [IO.Path]::GetFullPath((Join-Path $SourcePath $relative))
    if (-not $target.StartsWith($SourcePath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Checksum file escapes the package' }
    if (-not (Test-Path -LiteralPath $target) -or (Get-ShotHash $target) -ne $expected) { throw "Package checksum mismatch: $relative" }
  }
}
