import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import runtimePaths from './runtime_paths.cjs';

export class NativePicker {
  constructor() { this.child = null; this.pending = new Map(); }
  record(update) {
    this.diagnostics = { ...this.diagnostics, ...update, updatedAt: new Date().toISOString() };
    try { fs.writeFileSync(path.join(runtimePaths().dataDir, 'native-selection-status.json'), JSON.stringify(this.diagnostics)); } catch (_) {}
  }
  start() {
    if (this.child) return this.ready;
    const temp = runtimePaths().tempDir;
    fs.mkdirSync(temp, { recursive: true });
    const child = this.child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./native_picker.ps1', import.meta.url))], {
      env: { ...process.env, TEMP: temp, TMP: temp }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000); this.record({ stderr }); });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { reject(new Error('Native selection startup timed out')); this.stop(); }, 15000);
      this.rejectStart = error => { clearTimeout(timer); reject(error); };
      readline.createInterface({ input: child.stdout }).on('line', line => {
        if (line === 'READY') { clearTimeout(timer); this.record({ state: 'ready' }); resolve(); return; }
        try {
          const message = JSON.parse(line), task = this.pending.get(message.id);
          if (!task) return;
          this.pending.delete(message.id); clearTimeout(task.timer);
          message.ok ? task.resolve(message.result) : task.reject(new Error(message.error));
        } catch (error) { this.fail(child, error); }
      });
    });
    child.on('error', error => this.fail(child, error));
    child.stdin.on('error', error => this.fail(child, error));
    child.on('exit', () => this.fail(child, new Error('Native selection exited: ' + stderr)));
    return this.ready;
  }
  fail(child, error) {
    if (this.child !== child) return;
    this.rejectStart?.(error); this.child = null;
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(error); }
    this.pending.clear();
    if (child.exitCode === null) child.kill();
  }
  async run(command) {
    await this.start();
    if (command.op === 'select') this.record({ state: 'selecting', bounds: command, result: null });
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      this.pending.set(id, { resolve: result => { if (command.op === 'select') this.record({ state: result.selected ? 'selected' : 'cancelled', result }); resolve(result); }, reject, timer: setTimeout(() => {
        this.pending.delete(id); reject(new Error('Native selection timed out')); this.stop();
      }, command.op === 'enableAdminEscape' ? 120000 : command.op === 'select' ? 130000 : 12000) });
      this.child.stdin.write(JSON.stringify({ ...command, id }) + '\n');
      if (command.op === 'select') {
        const child = this.child;
        const timer = setTimeout(() => { if (this.child === child) void this.run({ op: 'status' }).then(status => this.record({ status })).catch(() => {}); }, 100);
        timer.unref();
      }
    });
  }
  stop() {
    const child = this.child;
    if (!child) return;
    this.child = null;
    this.rejectStart?.(new Error('Native selection stopped'));
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error('Native selection stopped')); }
    this.pending.clear();
    child.stdin.end(JSON.stringify({ id: randomUUID(), op: 'quit' }) + '\n');
    const timer = setTimeout(() => child.kill(), 1500); timer.unref();
    child.once('exit', () => clearTimeout(timer));
  }
}
