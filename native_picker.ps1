#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing,System.Windows.Forms,System.Web.Extensions
Add-Type -Path (Join-Path $PSScriptRoot 'native_picker.cs') -ReferencedAssemblies System.Drawing,System.Windows.Forms,System.Web.Extensions
[NativeSelectionServer]::Run($PSScriptRoot)
