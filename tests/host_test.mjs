import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import fs from 'node:fs/promises';

// Exercise the actual Host state machine with an Electron boundary double.
const calls = [], windows = [], handlers = new Map();
let route, shortcut, copied = 0, currentWindow, pointerDown = true, failCapture = false, candidate = null, failSave = false;
const bindings = new Map();
const originalPid = process.env.DSH_SHOT_SHELL_PID;
process.env.DSH_SHOT_SHELL_PID = '4242';
let savedPreferences = '{"hideDsh":false}';
class FakeWindow extends EventEmitter {
  constructor(options) {
    super(); this.options = options; this.visible = false; windows.push(this); currentWindow = this;
    this.webContents = new EventEmitter();
    this.webContents.send = (channel, data) => {
      calls.push({ op: 'message', data });
      if (data.readyId) queueMicrotask(() => handlers.get(channel)({ sender: this.webContents }, 'ready', data.readyId));
    };
    this.webContents.setWindowOpenHandler = () => {};
    this.webContents.getURL = () => 'file:///overlay.html';
  }
  setAlwaysOnTop() {} setBounds(bounds) { this.bounds = bounds; }
  async loadURL() {} isDestroyed() { return false; }
  show() { this.visible = true; calls.push({ op: 'show' }); } hide() { this.visible = false; }
  focus() {} destroy() {} static getAllWindows() { return windows; }
}
class FakeWorker {
  async start() { calls.push({ op: 'warm' }); }
  async run(command) {
    calls.push({ ...command, visible: currentWindow.visible });
    if (command.op === 'pointer') return { x: 100, y: 100, down: pointerDown };
    if (command.op === 'windowAt') return candidate;
    if (command.op === 'hide') return { windows: ['101'], pid: command.pid };
    if (command.op === 'restore') return { restored: true };
    if (command.op === 'region' && failCapture) { failCapture = false; throw new Error('Simulated capture failure'); }
    return { png: 'aGVsbG8=', width: command.width, height: command.height };
  }
  stop() {}
}
const electron = {
  app: { whenReady: async () => {} }, BrowserWindow: FakeWindow,
  screen: {
    getCursorScreenPoint: () => ({ x: -400, y: 300 }),
    getDisplayNearestPoint: () => ({ bounds: { x: -800, y: 0, width: 800, height: 600 }, scaleFactor: 1.5 }),
    dipToScreenRect: (_win, r) => ({ x: r.x * 1.5, y: r.y * 1.5, width: r.width * 1.5, height: r.height * 1.5 }),
    screenToDipPoint: p => p,
    screenToDipRect: (_win, r) => ({ x: r.x / 1.5, y: r.y / 1.5, width: r.width / 1.5, height: r.height / 1.5 }),
  },
  globalShortcut: {
    register: (key, cb) => { if (key === 'Ctrl+Alt+Q') return false; bindings.set(key, cb); shortcut = cb; return true; },
    unregister: key => bindings.delete(key),
  },
  ipcMain: { handle: (channel, cb) => handlers.set(channel, cb), removeHandler: channel => handlers.delete(channel) },
  clipboard: { writeImage: () => copied++ }, nativeImage: { createFromBuffer: () => ({ isEmpty: () => false }) },
  dialog: {}, Notification: { isSupported: () => false },
};
const source = await fs.readFile(new URL('../electron_controller.js', import.meta.url), 'utf8');
const mod = new vm.SourceTextModule(source, {
  identifier: new URL('../electron_controller.js', import.meta.url).href,
  initializeImportMeta(meta) { meta.url = new URL('../electron_controller.js', import.meta.url).href; },
});
await mod.link(async name => {
  let exports;
  if (name === 'node:module') exports = { createRequire: () => () => electron };
  else if (name === './worker.js') exports = { CaptureWorker: FakeWorker };
  else if (name === 'node:fs/promises') exports = { default: {
    readFile: async () => savedPreferences, mkdir: async () => {}, rename: async () => {},
    writeFile: async (_file, content) => { if (failSave) throw new Error('Simulated settings write failure'); savedPreferences = content; },
  } };
  else if (name.startsWith('./')) exports = await import(new URL(name, new URL('../electron_controller.js', import.meta.url)));
  else exports = await import(name);
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  });
});
await mod.evaluate();
const cleanups = [];
mod.namespace.apply({
  connection: { fetch: { register: config => { route = config.fetch; return () => {}; } } },
  effect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
});
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
while (!shortcut) await tick();
const control = async body => (await route(new Request('http://local', { method: 'POST', body: JSON.stringify({ client: 'test-client-123', ...body }) }))).json();
const ipc = (op, data) => [...handlers.values()][0]({ sender: currentWindow.webContents }, op, data);
try {
  assert.equal(calls.filter(c => c.op === 'region').length, 0, 'warm-up must never sample pixels');
  await control({ op: 'start' });
  assert.equal(currentWindow.options.transparent, true);
  assert.equal(currentWindow.options.frame, false);
  assert.equal(currentWindow.visible, true);
  assert.equal(calls.filter(c => c.op === 'region').length, 0, 'hotkey/start must never sample pixels');
  await ipc('down', { x: 30, y: 20 }); await ipc('move', { x: 130, y: 100 });
  assert.equal(calls.filter(c => c.op === 'region').length, 0, 'dragging must never sample pixels');
  await ipc('up', { x: 230, y: 120 }); await ipc('up', { x: 230, y: 120 });
  const regions = calls.filter(c => c.op === 'region');
  assert.equal(regions.length, 1, 'release is idempotent');
  assert.deepEqual(regions[0], { op: 'region', x: -1155, y: 30, width: 300, height: 150, visible: false });
  await ipc('copy', 'data:image/png;base64,aGVsbG8=');
  assert.equal(copied, 1); assert.equal((await control({ op: 'poll' })).result, null, 'copy never inserts');
  await control({ op: 'start' }); await ipc('cancel');
  assert.equal(calls.filter(c => c.op === 'region').length, 1, 'cancel before release never samples pixels');
  await control({ op: 'start' }); await ipc('down', { x: 10, y: 10 }); await ipc('up', { x: 100, y: 90 });
  await ipc('complete', 'data:image/png;base64,aGVsbG8=');
  const pending = (await control({ op: 'poll' })).result;
  assert.ok(pending?.png); assert.equal(copied, 1, 'complete must not overwrite clipboard');
  await control({ op: 'ack', id: 'wrong-id' }); assert.ok((await control({ op: 'poll' })).result);
  await control({ op: 'ack', id: pending.id }); assert.equal((await control({ op: 'poll' })).result, null);
  shortcut();
  while (!currentWindow.visible) await tick();
  const before = calls.filter(c => c.op === 'region').length;
  await ipc('down', { x: 10, y: 10 }); pointerDown = false;
  for (let i = 0; i < 100 && calls.filter(c => c.op === 'region').length === before; i++) await tick();
  assert.equal(calls.filter(c => c.op === 'region').length, before + 1, 'native button polling recovers a missing mouseup');
  while (!currentWindow.visible) await tick();
  await ipc('cancel');
  const configured = await control({ op: 'settings', hideDsh: true });
  assert.equal(configured.hideDsh, true); assert.equal(JSON.parse(savedPreferences).hideDsh, true);
  const hiddenCount = () => calls.filter(c => c.op === 'hide').length;
  const restoredCount = () => calls.filter(c => c.op === 'restore').length;
  await control({ op: 'start' }); assert.equal(hiddenCount(), 1);
  await ipc('cancel'); assert.equal(restoredCount(), 1, 'cancel restores DSH');
  await control({ op: 'start', hideDsh: false }); assert.equal(hiddenCount(), 1, 'one-shot override leaves DSH visible');
  await ipc('cancel'); assert.equal((await control({ op: 'poll' })).hideDsh, true, 'override does not change saved setting');
  pointerDown = true;
  await control({ op: 'start' }); await ipc('down', { x: 10, y: 10 }); await ipc('up', { x: 70, y: 60 });
  await ipc('copy', 'data:image/png;base64,aGVsbG8='); assert.equal(restoredCount(), 2, 'copy restores DSH');
  await control({ op: 'start' }); await ipc('down', { x: 10, y: 10 }); await ipc('up', { x: 70, y: 60 });
  await ipc('complete', 'data:image/png;base64,aGVsbG8='); assert.equal(restoredCount(), 3, 'complete restores DSH');
  const completed = (await control({ op: 'poll' })).result; await control({ op: 'ack', id: completed.id });
  await control({ op: 'start' }); await ipc('down', { x: 10, y: 10 }); failCapture = true;
  await assert.rejects(ipc('up', { x: 70, y: 60 }), /Simulated capture failure/); await tick();
  assert.equal(restoredCount(), 4, 'capture failure restores DSH');
  shortcut(); while (!currentWindow.visible) await tick();
  assert.equal(hiddenCount(), 5, 'global shortcut uses remembered setting'); await ipc('cancel');
  assert.equal(restoredCount(), 5);
  await control({ op: 'settings', hideDsh: false });
  const beforeHover = calls.filter(c => c.op === 'region').length;
  candidate = { x: -1110, y: 60, width: 300, height: 225 };
  await control({ op: 'start' }); await ipc('hover', { x: 80, y: 80 });
  assert.equal(calls.filter(c => c.op === 'region').length, beforeHover, 'hover only reads geometry');
  assert.deepEqual(calls.findLast(c => c.op === 'message' && c.data.type === 'hover').data.rect, { x: 60, y: 40, width: 200, height: 150 });
  await ipc('down', { x: 80, y: 80 }); await ipc('up', { x: 80, y: 80 });
  assert.deepEqual(calls.findLast(c => c.op === 'region'), { op: 'region', x: -1110, y: 60, width: 300, height: 225, visible: false });
  const beforeAdjust = calls.filter(c => c.op === 'region').length;
  await ipc('adjust-down', { point: { x: 90, y: 90 }, edge: 'move' });
  await ipc('move', { x: 110, y: 100 });
  assert.equal(calls.filter(c => c.op === 'region').length, beforeAdjust, 'moving selection does not sample pixels');
  await ipc('up', { x: 110, y: 100 });
  assert.deepEqual(calls.findLast(c => c.op === 'region'), { op: 'region', x: -1080, y: 75, width: 300, height: 225, visible: false });
  await ipc('adjust-down', { point: { x: 280, y: 200 }, edge: 'se' }); await ipc('up', { x: 330, y: 240 });
  assert.deepEqual(calls.findLast(c => c.op === 'region'), { op: 'region', x: -1080, y: 75, width: 375, height: 285, visible: false });
  assert.equal(calls.findLast(c => c.op === 'message' && c.data.type === 'edit').data.preserve, true);
  const resized = calls.filter(c => c.op === 'region').length;
  await ipc('adjust-down', { point: { x: 90, y: 90 }, edge: 'move' }); await ipc('up', { x: 90, y: 90 });
  assert.equal(calls.filter(c => c.op === 'region').length, resized, 'unchanged rectangle does not recapture');
  await ipc('cancel'); candidate = null;
  assert.equal((await control({ op: 'settings', hotkey: 'ctrl+alt+a' })).hotkey, 'Ctrl+Alt+A');
  assert.equal(bindings.has('Ctrl+Shift+X'), false); assert.equal(bindings.has('Ctrl+Alt+A'), true);
  const conflict = await control({ op: 'settings', hotkey: 'Ctrl+Alt+Q' }); assert.match(conflict.error, /已被占用/);
  assert.equal((await control({ op: 'poll' })).hotkey, 'Ctrl+Alt+A'); assert.equal(bindings.has('Ctrl+Alt+A'), true);
  failSave = true; const failedSave = await control({ op: 'settings', hotkey: 'Ctrl+Alt+B' }); failSave = false;
  assert.match(failedSave.error, /write failure/); assert.equal(bindings.has('Ctrl+Alt+B'), false); assert.equal(bindings.has('Ctrl+Alt+A'), true);
  console.log('PASS: no pre-release pixels, transparent window, DPI/negative origin, hide before region, release once, cancel, copy/complete separation, ack, global shortcut, missing-mouseup recovery');
  console.log('PASS: remembered hide preference, one-shot override, global hotkey, restore on cancel/copy/complete/capture failure');
  console.log('PASS: geometry-only hover, click window capture, move/resize recapture on release only, preserve annotations flag, hotkey conflict/write rollback');
} finally {
  for (const fn of cleanups.reverse()) await fn();
  if (originalPid === undefined) delete process.env.DSH_SHOT_SHELL_PID; else process.env.DSH_SHOT_SHELL_PID = originalPid;
}
