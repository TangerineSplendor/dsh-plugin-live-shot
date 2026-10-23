#Requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$DataDir)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'install_common.ps1')
$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$separator = '\node_modules\'
$index = $packageRoot.LastIndexOf($separator, [StringComparison]::OrdinalIgnoreCase)
$profile = if ($index -ge 0) { $packageRoot.Substring(0, $index) } else { Get-ShotProfile '' '' }
$exe = Find-ShotDsh '' -NoPrompt
$data = Initialize-ShotData $DataDir $profile
$runtime = Initialize-ShotRuntime $exe $data
$config = @{ kind='dsh-shot-install'; dataDir=$data; electronExe=$runtime; profileDir=$profile; sourceDsh=$exe }
Write-ShotText (Join-Path $packageRoot '.install.json') (($config | ConvertTo-Json) + "`n")
Write-Output 'Local screenshot runtime prepared from the installed DSH. No download was needed.'
