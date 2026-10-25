#!/usr/bin/env node
const { spawn } = require('node:child_process');
const path = require('node:path');
const [command, ...args] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h') {
  console.log('dsh-plugin-live-shot for Windows x64\nUsage: dsh-shot install [PowerShell installer options]\n       dsh-shot uninstall [PowerShell uninstaller options]\nAfter installation or removal, quit DSH completely and reopen it.');
} else if (!['install', 'uninstall'].includes(command)) {
  console.error('Unknown command. Use dsh-shot --help.'); process.exitCode = 1;
} else if (process.platform !== 'win32' || process.arch !== 'x64') {
  console.error('dsh-plugin-live-shot requires Windows x64.'); process.exitCode = 1;
} else {
  const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(__dirname, '..', command + '.ps1'), ...args], { stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('close', code => { process.exitCode = code ?? 1; });
}
