#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'escape_bridge.cs') -ReferencedAssemblies System.Windows.Forms
$flags = [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
$rejected = $false
try {
  [System.Activator]::CreateInstance([AdminEscapeBridge], $flags, $null, [object[]]@([int]-1,[long]0,[int]0), $null) | Out-Null
} catch {
  $cause = $_.Exception
  while ($cause.InnerException) { $cause = $cause.InnerException }
  if ($cause.Message -ne 'Invalid picker owner') { throw }
  $rejected = $true
}
if (-not $rejected) { throw 'Escape bridge accepted an invalid owner' }
Write-Output 'PASS: Escape bridge compilation and invalid owner rejection, no elevation requested'
