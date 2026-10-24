#Requires -Version 5.1
param([int]$OwnerPid,[long]$OwnerWindow,[int]$Nonce)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Path (Join-Path $PSScriptRoot 'escape_bridge.cs') -ReferencedAssemblies System.Windows.Forms
[AdminEscapeBridge]::Run($OwnerPid,$OwnerWindow,$Nonce)
