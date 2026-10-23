import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { CaptureWorker } from './worker.js';
import runtimePaths from './runtime_paths.cjs';
import { ensureRuntime } from './ensure_runtime.js';

export class OverlayHelper {
  constructor({ shellPid = process.ppid } = {}) {
    this.pending = new Map(); this.disposed = false; this.starting = null; this.shellPid = shellPid;
    this.worker = new CaptureWorker();
  }
  start() {
    if (this.starting) return this.starting;
    if (this.disposed) return Promise.reject(new Error('Overlay helper stopped'));
    this.starting = ensureRuntime().then(() => {
      if (this.disposed) throw new Error('Overlay helper stopped');
      return this.launch();
    }).catch(error => { this.starting = null; throw error; });
    return this.starting;
  }
  launch() {
    return new Promise((resolve, reject) => {
      const token = randomUUID();
      let stderr = '', failed = false;
      const fail = error => {
        if (failed) return; failed = true;
        clearTimeout(timer); reject(error);
        for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(error); }
        this.pending.clear(); this.socket?.destroy(); server.close();
        if (!this.disposed) this.child?.kill();
        this.socket = null; this.starting = null;
      };
      const server = this.server = net.createServer(socket => {
        if (this.socket) { socket.destroy(); return; }
        this.socket = socket; socket.setEncoding('utf8');
        let buffer = '', authenticated = false;
        socket.on('data', chunk => {
          buffer += chunk;
          let index;
          while ((index = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
            try {
              const data = JSON.parse(line);
              if (data.type === 'ready') {
                if (data.token !== token) { socket.destroy(); return; }
                authenticated = true; clearTimeout(timer); resolve();
              }
              else {
                if (!authenticated) { socket.destroy(); return; }
                if (data.type === 'native') {
                  void (async () => {
                    try {
                      const result = data.command.op === 'warm' ? (await this.worker.start(), {}) : await this.worker.run(data.command);
                      if (!socket.destroyed) socket.write(JSON.stringify({ type: 'native-result', id: data.id, result }) + '\n');
                    } catch (error) {
                      if (!socket.destroyed) socket.write(JSON.stringify({ type: 'native-result', id: data.id, error: error.message }) + '\n');
                    }
                  })();
                  continue;
                }
                const task = this.pending.get(data.id);
                if (task) { clearTimeout(task.timer); this.pending.delete(data.id); task.resolve(data); }
              }
            } catch (error) { fail(error); }
          }
        });
        socket.on('error', fail);
        socket.on('close', () => fail(new Error('Overlay helper disconnected')));
      });
      const timer = setTimeout(() => fail(new Error('Overlay startup timed out: ' + stderr)), 15000);
      server.on('error', fail);
      server.listen(0, '127.0.0.1', () => {
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
        const paths = runtimePaths();
        env.DSH_SHOT_DATA_DIR = paths.dataDir;
        env.TEMP = env.TMP = paths.tempDir;
        fs.mkdirSync(env.TEMP, { recursive: true });
        env.DSH_SHOT_SHELL_PID = String(this.shellPid);
        this.child = spawn(paths.electronExe,
          ['--no-sandbox', fileURLToPath(new URL('./helper_main.cjs', import.meta.url)), '--shot-port=' + server.address().port, '--shot-token=' + token],
          { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        this.child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-3000); });
        this.child.on('error', fail);
        this.child.on('exit', code => { this.worker.stop(); fail(new Error('Overlay exited (' + code + '): ' + stderr)); });
      });
    });
  }
  async request(body) {
    await this.start();
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      this.pending.set(id, { resolve, reject, timer: setTimeout(() => {
        this.pending.delete(id); reject(new Error('Overlay command timed out'));
      }, 20000) });
      this.socket.write(JSON.stringify({ id, body }) + '\n');
    });
  }
  stop() {
    this.disposed = true;
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error('Overlay helper stopped')); }
    this.pending.clear();
    this.socket?.end(JSON.stringify({ stop: true }) + '\n');
    this.server?.close();
    const child = this.child;
    if (child) { const timer = setTimeout(() => child.kill(), 1500); timer.unref(); }
  }
}
