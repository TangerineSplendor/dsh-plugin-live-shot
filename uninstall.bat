@echo off
setlocal
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
if errorlevel 1 (
  echo.
  echo Uninstall failed. Copy the message above when reporting a problem.
  pause
  exit /b 1
)
echo.
pause
