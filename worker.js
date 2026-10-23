import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import fs from 'node:fs';
import runtimePaths from './runtime_paths.cjs';

export class CaptureWorker {
  constructor() { this.child = null; this.queue = Promise.resolve(); }
  start() {
    if (this.child) return this.ready;
    const temp = runtimePaths().tempDir;
    fs.mkdirSync(temp, { recursive: true });
    const child = this.child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./capture_worker.ps1', import.meta.url))], {
      env: { ...process.env, TEMP: temp, TMP: temp }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { reject(new Error('Worker startup timeout')); this.stop(); }, 12000);
      this.startReject = (e) => { clearTimeout(timer); reject(e); };
      readline.createInterface({ input: child.stdout }).on('line', line => {
        if (line === 'READY') { clearTimeout(timer); resolve(); return; }
        if (!this.pending) return;
        const { resolve: done, reject: fail, timer: limit } = this.pending;
        this.pending = null; clearTimeout(limit);
        try { const data = JSON.parse(line); data.ok ? done(data.result) : fail(new Error(data.error)); }
        catch (e) { fail(e); }
      });
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    const fail = error => {
      if (this.child !== child) return;
      this.startReject?.(error);
      if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
      this.child = null;
    };
    child.on('error', fail);
    child.on('exit', () => fail(new Error('Capture worker exited: ' + stderr)));
    child.stdin.on('error', fail);
    return this.ready;
  }
  run(command) {
    const task = this.queue.then(async () => {
      await this.start();
      return new Promise((resolve, reject) => {
        this.pending = { resolve, reject, timer: setTimeout(() => this.stop(new Error('Capture timeout')), 12000) };
        this.child.stdin.write(JSON.stringify(command) + '\n');
      });
    });
    this.queue = task.catch(() => {});
    return task;
  }
  stop(error = new Error('Worker stopped')) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
    this.startReject?.(error);
    const child = this.child; this.child = null;
    if (child) {
      child.stdin.end('quit\n');
      const timer = setTimeout(() => child.kill(), 1500); timer.unref();
      child.once('exit', () => clearTimeout(timer));
    }
  }
}
