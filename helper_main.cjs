// Runs in a real Electron MAIN process, never in the DSH Node Host.
const { app } = require('electron');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const runtimePaths = require('./runtime_paths.cjs');
const port = Number(process.argv.find(v => v.startsWith('--shot-port='))?.slice(12));
const token = process.argv.find(v => v.startsWith('--shot-token='))?.slice(13);
if (!port || !token) { app.exit(2); }
else {
  app.setPath('userData', runtimePaths().userData);
  const cleanups = [];
  const nativePending = new Map();
  let route, socket, buffer = '', stopping = false;
  function native(command) {
    if (!socket || socket.destroyed) return Promise.reject(new Error('Native capture connection closed'));
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      nativePending.set(id, { resolve, reject, timer: setTimeout(() => {
        nativePending.delete(id); reject(new Error('Native capture timed out'));
      }, 15000) });
      socket.write(JSON.stringify({ type: 'native', id, command }) + '\n');
    });
  }
  async function stop() {
    if (stopping) return; stopping = true;
    for (const task of nativePending.values()) { clearTimeout(task.timer); task.reject(new Error('Native capture connection closed')); }
    nativePending.clear();
    for (const fn of cleanups.reverse()) { try { await fn(); } catch (_) {} }
    socket?.destroy(); app.quit();
  }
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => { if (!stopping) { event.preventDefault(); void stop(); } });
  import(pathToFileURL(path.join(__dirname, 'electron_controller.js')).href).then(module => {
    module.apply({
      capture: { start: () => native({ op: 'warm' }), run: command => native(command), stop: () => {} },
      connection: { fetch: { register: config => { route = config.fetch; return () => {}; } } },
      effect: fn => { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
    });
    socket = net.connect(port, '127.0.0.1'); socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(JSON.stringify({ type: 'ready', token }) + '\n'));
    socket.on('error', error => { console.error('Screenshot helper:', error.message); stop(); }); socket.on('close', stop);
    socket.on('data', chunk => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        void (async () => {
          let message;
          try {
            message = JSON.parse(line);
            if (message.type === 'native-result') {
              const task = nativePending.get(message.id);
              if (task) {
                nativePending.delete(message.id); clearTimeout(task.timer);
                message.error ? task.reject(new Error(message.error)) : task.resolve(message.result);
              }
              return;
            }
            if (message.stop) { stop(); return; }
            const response = await route(new Request('http://dsh.internal/api/dsh-shot/control', {
              method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(message.body),
            }));
            socket.write(JSON.stringify({ id: message.id, status: response.status, body: await response.json() }) + '\n');
          } catch (error) {
            socket.write(JSON.stringify({ id: message?.id, status: 500, body: { error: error.message } }) + '\n');
          }
        })();
      }
    });
  }).catch(error => { console.error(error); app.exit(1); });
}
