import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CaptureWorker } from './worker.js';
import { adjustRect, intersect } from './selection.js';
import { DEFAULT_HOTKEY, normalizeHotkey } from './settings.js';
import runtimePaths from './runtime_paths.cjs';

export const inject = ['connection'];
export function apply(ctx) {
  const require = createRequire(import.meta.url);
  const { app, BrowserWindow, screen, globalShortcut, ipcMain, clipboard, nativeImage, dialog, Notification } = require('electron');
  const worker = ctx.capture || new CaptureWorker();
  const channel = 'dsh-shot-' + randomUUID();
  let hotkey = DEFAULT_HOTKEY, hotkeyError = '';
  let win, active = false, phase = 'idle', display, startPoint, selection, poll, disposed = false;
  let registered = false, lastError = '', result = null, owner = null, readyMessage = null;
  let hideDsh = false, hiddenSession = null, opening = false, restoring = Promise.resolve(), settingsWrite = Promise.resolve();
  let adjustment = null, downCandidate = null, hoverBusy = false, hoverTime = 0;
  let generation = 0;
  const paths = runtimePaths();
  const preferencePath = paths.preferences;
  const shellPid = Number(process.env.DSH_SHOT_SHELL_PID);
  const clients = new Map();
  const send = data => { if (win && !win.isDestroyed()) win.webContents.send(channel, data); };
  const clamp = p => ({ x: Math.max(0, Math.min(display.bounds.width, p.x)), y: Math.max(0, Math.min(display.bounds.height, p.y)) });
  function end() {
    active = false; phase = 'idle'; clearInterval(poll); poll = null;
    generation++;
    if (readyMessage) { clearTimeout(readyMessage.timer); readyMessage.reject(new Error('Screenshot cancelled')); readyMessage = null; }
    if (win && !win.isDestroyed()) win.hide();
    const session = hiddenSession; hiddenSession = null;
    if (session?.windows.length) {
      restoring = restoring.then(async () => {
        try { await worker.run({ op: 'restore', ...session }); }
        catch (_) { await worker.run({ op: 'restore', ...session }); }
      }).catch(error => { lastError = 'Failed to restore DSH: ' + error.message; console.error('[dsh-shot]', lastError); });
    }
    return restoring;
  }
  function report(error) {
    lastError = error?.message || String(error);
    console.error('[dsh-shot]', lastError);
    end();
    if (Notification.isSupported()) new Notification({ title: 'DSH screenshot', body: lastError }).show();
  }
  async function makeWindow() {
    if (win && !win.isDestroyed()) return;
    win = new BrowserWindow({ width: 800, height: 600, show: false, frame: false,
      transparent: true, backgroundColor: '#00000000', alwaysOnTop: true,
      skipTaskbar: true, hasShadow: false, resizable: false, movable: false,
      fullscreenable: false, minimizable: false, maximizable: false,
      webPreferences: { preload: fileURLToPath(new URL('./overlay_preload.cjs', import.meta.url)),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        backgroundThrottling: false, additionalArguments: ['--shot-channel=' + channel] } });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
    win.webContents.on('render-process-gone', () => { end(); win?.destroy(); win = null; });
    win.on('closed', () => { end(); win = null; });
    // Losing focus cancels selection, preventing an invisible input trap.
    win.on('blur', () => { if (['selecting', 'dragging', 'adjusting'].includes(phase)) end(); });
    await win.loadURL(new URL('./overlay.html', import.meta.url).href);
  }
  const initial = app.whenReady().then(async () => {
    try {
      const saved = JSON.parse(await fs.readFile(preferencePath, 'utf8'));
      hideDsh = saved.hideDsh === true; hotkey = normalizeHotkey(saved.hotkey || DEFAULT_HOTKEY);
    }
    catch (error) { if (error.code !== 'ENOENT') console.warn('[dsh-shot] preferences:', error.message); }
    await makeWindow();
    await worker.start(); // No bitmap or screen sampling during warm-up.
    if (disposed) { win?.destroy(); worker.stop(); return; }
    registered = globalShortcut.register(hotkey, () => { void begin().catch(report); });
    if (!registered) hotkeyError = '快捷键 ' + hotkey + ' 已被其他程序占用，请在截图设置中更换';
  }).catch(report);
  async function begin(clientId, hideOverride) {
    await initial;
    if (disposed || active || opening) return;
    opening = true;
    try {
      await restoring;
      if (result) throw new Error('A completed screenshot is still waiting for the DSH composer.');
      await makeWindow();
      owner = clientId || [...clients.entries()].filter(([, c]) => Date.now() - c.seen < 10000)
        .sort((a, b) => b[1].focused - a[1].focused)[0]?.[0];
      display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      win.setBounds(display.bounds);
      active = true; phase = 'preparing'; selection = null; startPoint = null; adjustment = null; downCandidate = null; lastError = '';
      generation++;
      if (typeof hideOverride === 'boolean' ? hideOverride : hideDsh) {
        if (!Number.isInteger(shellPid) || shellPid <= 0) throw new Error('DSH shell process is unavailable');
        hiddenSession = await worker.run({ op: 'hide', pid: shellPid });
        if (!active || disposed) { await end(); return; }
      }
      await present({ type: 'reset', width: display.bounds.width, height: display.bounds.height });
      if (!active) return;
      phase = 'selecting';
      win.show(); win.focus();
    } catch (error) { await end(); throw error; }
    finally { opening = false; }
  }
  function present(message) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      readyMessage = { id, resolve, reject, timer: setTimeout(() => {
        readyMessage = null; reject(new Error('Screenshot renderer did not become ready'));
      }, 5000) };
      send({ ...message, readyId: id });
    });
  }
  function move(point) {
    const p = clamp(point);
    selection = phase === 'adjusting' ? adjustRect(adjustment.rect, startPoint, p, adjustment.edge, display.bounds)
      : { x: Math.min(startPoint.x, p.x), y: Math.min(startPoint.y, p.y),
        width: Math.abs(p.x - startPoint.x), height: Math.abs(p.y - startPoint.y) };
    send({ type: 'selection', rect: selection });
  }
  async function windowAt(point) {
    const targetDisplay = display;
    const global = { x: targetDisplay.bounds.x + point.x, y: targetDisplay.bounds.y + point.y, width: 1, height: 1 };
    const physical = screen.dipToScreenRect(win, global);
    const found = await worker.run({ op: 'windowAt', x: physical.x, y: physical.y, excludePid: process.pid });
    if (!found) return null;
    const clipped = intersect(found, screen.dipToScreenRect(win, targetDisplay.bounds));
    if (!clipped) return null;
    const dip = screen.screenToDipRect(win, clipped);
    return intersect({ x: dip.x - targetDisplay.bounds.x, y: dip.y - targetDisplay.bounds.y, width: dip.width, height: dip.height },
      { x: 0, y: 0, width: targetDisplay.bounds.width, height: targetDisplay.bounds.height });
  }
  function watchRelease() {
    clearInterval(poll); let checking = false;
    poll = setInterval(async () => {
      if (checking || !['dragging', 'adjusting'].includes(phase)) return;
      checking = true;
      try {
        const p = await worker.run({ op: 'pointer' });
        if (!['dragging', 'adjusting'].includes(phase)) return;
        const dip = screen.screenToDipPoint({ x: p.x, y: p.y });
        if (!p.down) await release({ x: dip.x - display.bounds.x, y: dip.y - display.bounds.y });
      } catch (e) { report(e); }
      finally { checking = false; }
    }, 65);
  }
  async function release(point) {
    if (!['dragging', 'adjusting'].includes(phase)) return;
    const preserve = phase === 'adjusting';
    const session = generation;
    move(point);
    clearInterval(poll); poll = null;
    if (!preserve && Math.hypot(point.x - startPoint.x, point.y - startPoint.y) < 3) {
      phase = 'resolving'; const candidate = await downCandidate;
      if (!active || phase !== 'resolving' || session !== generation) return;
      if (candidate) selection = candidate;
    }
    if (selection.width < 2 || selection.height < 2) { phase = 'selecting'; send({ type: 'reset' }); return; }
    if (preserve && ['x', 'y', 'width', 'height'].every(k => selection[k] === adjustment.rect[k])) {
      phase = 'editing'; send({ type: 'adjust-cancel' }); return;
    }
    await captureSelection(preserve);
  }
  async function captureSelection(preserve) {
    const session = generation;
    phase = 'capturing';
    // Convert a rectangle on ONE monitor; multiplying a virtual-desktop union
    // by a single scaleFactor is incorrect with mixed-DPI monitors.
    const global = { x: display.bounds.x + selection.x, y: display.bounds.y + selection.y,
      width: selection.width, height: selection.height };
    const rect = screen.dipToScreenRect(win, global);
    win.hide();
    await new Promise(resolve => setTimeout(resolve, 70));
    if (!active || disposed || session !== generation) return;
    const image = await worker.run({ op: 'region', ...rect });
    if (!active || disposed || session !== generation) return;
    await present({ type: 'edit', rect: selection, preserve, ...image });
    if (!active || disposed || session !== generation) return;
    phase = 'editing';
    win.show(); win.focus();
  }
  async function handle(event, op, data) {
    if (!win || event.sender !== win.webContents || !active) throw new Error('Inactive screenshot window');
    if (op === 'ready' && readyMessage?.id === data) {
      clearTimeout(readyMessage.timer); readyMessage.resolve(); readyMessage = null; return;
    }
    if (op === 'cancel') { await end(); return; }
    if (op === 'hover' && phase === 'selecting') {
      if (hoverBusy || Date.now() - hoverTime < 90) return;
      hoverBusy = true; hoverTime = Date.now();
      const session = generation;
      try { const candidate = await windowAt(clamp(data)); if (phase === 'selecting' && session === generation) send({ type: 'hover', rect: candidate }); }
      finally { hoverBusy = false; }
    } else if (op === 'down' && phase === 'selecting') {
      startPoint = clamp(data); phase = 'dragging'; move(data);
      downCandidate = windowAt(startPoint).catch(() => null); watchRelease();
    } else if (op === 'adjust-down' && phase === 'editing') {
      if (!['move', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].includes(data.edge)) throw new Error('Invalid resize handle');
      adjustment = { rect: { ...selection }, edge: data.edge }; startPoint = clamp(data.point);
      phase = 'adjusting'; send({ type: 'adjusting' }); move(data.point); watchRelease();
    } else if (op === 'move' && ['dragging', 'adjusting'].includes(phase)) move(data);
    else if (op === 'up') await release(data);
    else if (['complete', 'copy', 'save'].includes(op) && phase === 'editing') {
      if (typeof data !== 'string' || data.length > 140000000 || !data.startsWith('data:image/png;base64,')) throw new Error('Invalid PNG');
      const bytes = Buffer.from(data.slice(22), 'base64');
      const image = nativeImage.createFromBuffer(bytes);
      if (image.isEmpty()) throw new Error('Empty PNG');
      if (op === 'copy') { clipboard.writeImage(image); await end(); }
      else if (op === 'save') {
        phase = 'saving';
        try {
          await fs.mkdir(paths.captures, { recursive: true });
          const picked = await dialog.showSaveDialog(win, { defaultPath: path.join(paths.captures, 'shot-' + Date.now() + '.png'), filters: [{ name: 'PNG', extensions: ['png'] }] });
          if (!picked.canceled && picked.filePath) await fs.writeFile(picked.filePath, bytes);
        } finally { if (active) phase = 'editing'; }
      } else {
        result = { id: randomUUID(), png: data.slice(22), owner, created: Date.now() };
        await end();
        // Return focus to the app so its composer can accept the synthetic paste.
        const target = BrowserWindow.getAllWindows().find(w => w !== win && !w.isDestroyed() && w.webContents.getURL() && w.webContents.getURL() !== win.webContents.getURL());
        if (target) { if (target.isMinimized()) target.restore(); target.show(); target.focus(); }
        else if (Number(process.env.DSH_SHOT_SHELL_PID) > 0) {
          await worker.run({ op: 'focus', pid: Number(process.env.DSH_SHOT_SHELL_PID) }).catch(() => {});
        }
      }
    }
  }
  ipcMain.handle(channel, async (...args) => {
    try { return await handle(...args); }
    catch (error) { lastError = error.message; if (phase === 'capturing') report(error); throw error; }
  });
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/dsh-shot/control', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        const body = await request.json();
        if (!/^[a-z0-9-]{8,80}$/i.test(body.client || '')) throw new Error('Invalid client');
        const old = clients.get(body.client);
        clients.set(body.client, { seen: Date.now(), focused: body.focused ? Date.now() : old?.focused || 0 });
        for (const [id, c] of clients) if (Date.now() - c.seen > 60000) clients.delete(id);
        if (body.op === 'settings') {
          if (body.hideDsh !== undefined && typeof body.hideDsh !== 'boolean') throw new Error('hideDsh must be boolean');
          if (body.hideDsh === undefined && body.hotkey === undefined) throw new Error('No settings provided');
          const save = settingsWrite.then(async () => {
            await initial;
            const nextHotkey = body.hotkey === undefined ? hotkey : normalizeHotkey(body.hotkey);
            const nextHide = body.hideDsh === undefined ? hideDsh : body.hideDsh;
            const changed = nextHotkey !== hotkey || (!registered && body.hotkey !== undefined);
            if (changed && !globalShortcut.register(nextHotkey, () => { void begin().catch(report); })) {
              throw new Error('快捷键 ' + nextHotkey + ' 已被占用，原设置未改变');
            }
            try {
              await fs.mkdir(path.dirname(preferencePath), { recursive: true });
              await fs.writeFile(preferencePath + '.tmp', JSON.stringify({ hideDsh: nextHide, hotkey: nextHotkey }) + '\n', 'utf8');
              await fs.rename(preferencePath + '.tmp', preferencePath);
            } catch (error) { if (changed) globalShortcut.unregister(nextHotkey); throw error; }
            if (registered && nextHotkey !== hotkey) globalShortcut.unregister(hotkey);
            hotkey = nextHotkey; hideDsh = nextHide;
            if (changed) { registered = true; hotkeyError = ''; }
          });
          settingsWrite = save.catch(() => {}); await save;
        }
        if (body.op === 'start') await begin(body.client, body.hideDsh);
        if (body.op === 'cancel' && owner === body.client) await end();
        if (body.op === 'ack' && result?.id === body.id && (!result.owner || result.owner === body.client)) result = null;
        if (body.op === 'failure') lastError = 'Composer insertion failed; screenshot retained for retry.';
        if (result && (!result.owner || (!clients.has(result.owner) && body.focused))) result.owner = body.client;
        return Response.json({ registered, phase, hideDsh, dshHidden: !!hiddenSession?.windows.length, hotkey, hotkeyError, error: lastError,
          result: result?.owner === body.client && body.op === 'poll' && !body.skipImage ? { id: result.id, png: result.png } : null });
      } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    } }), 'dsh-shot: control');
  ctx.effect(() => () => {
    disposed = true; const finished = end();
    if (registered) globalShortcut.unregister(hotkey);
    ipcMain.removeHandler(channel); win?.destroy();
    return finished.finally(() => worker.stop());
  });
}
