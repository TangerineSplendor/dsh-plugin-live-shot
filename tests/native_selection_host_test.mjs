import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
let route, window, pendingPick, pendingAdmin;
let adminReady = false;
const calls = [], handlers = new Map(), shortcuts = new Map(), cleanups = [];
class Window extends EventEmitter {
  constructor(options) {
    super(); window = this; this.visible = false;
    this.webContents = new EventEmitter();
    this.webContents.send = (channel, data) => { if (data.readyId) queueMicrotask(() => handlers.get(channel)({ sender: this.webContents }, 'ready', data.readyId)); };
    this.webContents.setWindowOpenHandler = () => {};
  }
  setAlwaysOnTop() {} setOpacity() {} setBounds() {} async loadURL() {} isDestroyed() { return false; }
  hide() { this.visible = false; } show() { this.visible = true; } focus() {} destroy() {}
  static getAllWindows() { return []; }
}
const capture = {
  start: async () => {}, stop() {},
  run: async command => {
    calls.push({ ...command, visible: window.visible });
    if (command.op === 'pick') return new Promise(resolve => { pendingPick = resolve; });
    if (command.op === 'cancelPick') { pendingPick?.({ selected: false }); return {}; }
    if (command.op === 'adminEscapeStatus') return { ready: adminReady };
    if (command.op === 'enableAdminEscape') return new Promise(resolve => { pendingAdmin = () => { adminReady = true; resolve({ ready: true }); }; });
    if (command.op === 'region') return { png: 'aGVsbG8=', width: command.width, height: command.height };
    return {};
  },
};
const electron = {
  app: { whenReady: async () => {} }, BrowserWindow: Window,
  screen: {
    getCursorScreenPoint: () => ({ x: -200, y: 100 }),
    getDisplayNearestPoint: () => ({ bounds: { x: -800, y: 0, width: 800, height: 600 } }),
    dipToScreenRect: (_window, rect) => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, value * 1.5])),
    screenToDipRect: (_window, rect) => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, value / 1.5])),
  },
  globalShortcut: { register: (key, fn) => { shortcuts.set(key, fn); return true; }, unregister: key => shortcuts.delete(key) },
  ipcMain: { handle: (channel, fn) => handlers.set(channel, fn), removeHandler: channel => handlers.delete(channel) },
  clipboard: {}, nativeImage: {}, dialog: {}, Notification: { isSupported: () => false },
};
const entry = new URL('../electron_controller.js', import.meta.url);
const module = new vm.SourceTextModule(await fs.readFile(entry, 'utf8'), { identifier: entry.href, initializeImportMeta: meta => { meta.url = entry.href; } });
await module.link(async name => {
  const exports = name === 'node:module' ? { createRequire: () => () => electron }
    : name === 'node:fs/promises' ? { default: { readFile: async () => '{"hideDsh":false}' } }
    : name.startsWith('./') ? await import(new URL(name, entry).href) : await import(name);
  const synthetic = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); });
  return synthetic;
});
await module.evaluate();
module.namespace.apply({ nativeSelection: true, capture,
  connection: { fetch: { register: config => { route = config.fetch; return () => {}; } } },
  effect: fn => { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
});
const control = async op => (await route(new Request('http://local', { method: 'POST', body: JSON.stringify({ op, client: 'native-selection-host-test' }) }))).json();
const settle = async phase => {
  for (let i = 0; i < 100; i++) { const state = await control('poll'); if (state.phase === phase) return state; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('Did not reach phase ' + phase);
};
try {
  assert.equal((await control('poll')).gameCompatibilityReady, false);
  assert.equal(calls.filter(call => call.op === 'enableAdminEscape').length, 0, 'normal startup never prompts for elevation');
  assert.equal((await control('start')).phase, 'selecting');
  assert.equal(window.visible, false, 'Electron must remain hidden during native selection');
  assert.match((await control('gameCompatibility')).error, /结束当前截图/);
  assert.equal(calls.filter(call => call.op === 'enableAdminEscape').length, 0);
  assert.equal(calls.filter(call => call.op === 'region').length, 0);
  const pick = calls.find(call => call.op === 'pick');
  assert.deepEqual(pick, { op: 'pick', x: -1200, y: 0, width: 1200, height: 900, visible: false });
  pendingPick({ selected: true, x: -1110, y: 60, width: 300, height: 225 });
  await settle('editing');
  assert.deepEqual(calls.find(call => call.op === 'region'), { op: 'region', x: -1110, y: 60, width: 300, height: 225, visible: false });
  assert.equal(window.visible, true, 'editor appears only after selected pixels arrive');
  await control('cancel');
  const count = calls.filter(call => call.op === 'region').length;
  await control('start'); await control('cancel');
  assert.equal((await control('poll')).phase, 'idle');
  assert.equal(calls.filter(call => call.op === 'region').length, count, 'cancel never captures');
  await control('start'); pendingPick({ selected: false }); await settle('idle');
  assert.equal(calls.filter(call => call.op === 'region').length, count, 'Escape/native cancel never captures');
  assert.equal((await control('gameCompatibility')).gameCompatibilityEnabling, true);
  await control('gameCompatibility');
  assert.equal(calls.filter(call => call.op === 'enableAdminEscape').length, 1, 'repeated clicks launch only one confirmation');
  pendingAdmin();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await control('poll')).gameCompatibilityReady, true);
  assert.equal(calls.filter(call => call.op === 'region').length, count, 'enabling Escape compatibility never samples pixels');
  console.log('PASS: native geometry only, hidden Electron selection, physical/DIP mapping, capture after release, editor handoff, cancellation');
} finally { for (const cleanup of cleanups.reverse()) await cleanup(); }
