import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import runtimePaths from './runtime_paths.cjs';

// npm/market installs have no machine-specific config. Prepare locally on first use.
export async function ensureRuntime() {
  const paths = runtimePaths();
  if (fs.existsSync(paths.electronExe)) return paths;
  if (process.platform !== 'win32') throw new Error('DSH Shot requires the Windows x64 desktop app');
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      fileURLToPath(new URL('./prepare_runtime.ps1', import.meta.url)), '-DataDir', paths.dataDir],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = chunk => { output = (output + chunk).slice(-3000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Local screenshot runtime setup timed out')); }, 60000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error('Local runtime setup failed: ' + output)); });
  });
  const ready = runtimePaths();
  if (!fs.existsSync(ready.electronExe)) throw new Error('Local screenshot runtime was not prepared');
  return ready;
}
