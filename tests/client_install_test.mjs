import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// The DSH scanner requires the bare Loader name to equal the manifest name.
// Checking only Host start/cancel misses a package silently skipped by that scanner.
export async function verifyInstalledClient(packageDir, profileDir) {
  const manifest = JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'));
  const patch = await fs.readFile(path.join(profileDir, 'cordis.patch.yml'), 'utf8');
  const row = /- id:[ \t]*dsh-shot[ \t]*\r?\n[ \t]+name:[ \t]*['"]?([^'"\s]+)/.exec(patch);
  assert.ok(row, 'profile must contain the screenshot plugin');
  assert.equal(row[1], manifest.name, 'DSH skips Client when the Loader specifier differs from package.json name');
  assert.equal(path.basename(packageDir), manifest.name, 'installed folder must resolve by its public package name');
  const source = await fs.readFile(path.join(packageDir, 'client.js'), 'utf8');
  for (const hasComposer of [true, false]) {
    const modules = new Map(), slots = [], operations = [], attached = [], cleanups = [];
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3uQAAAAASUVORK5CYII=', 'base64');
    const input = { focus() {}, dispatchEvent(event) { attached.push(...event.clipboardData.files); return false; } };
    const React = { createElement: (type, props, ...children) => ({ type, props, children }), useState: value => [value, () => {}], useEffect: () => {} };
    class Transfer { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } }
    class TransferEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } }
    const context = vm.createContext({
      window: { __ModuleLoader__: { load: registration => modules.set(registration.id, registration) } },
      crypto: { randomUUID }, sessionStorage: { getItem: () => null, setItem() {} },
      document: { hasFocus: () => true, querySelector: () => hasComposer ? input : null,
        getElementById: () => null, createElement: () => ({ style: {}, remove() {} }), body: { appendChild() {} } },
      fetch: async (_url, options) => { const op = JSON.parse(options.body).op; operations.push(op);
        return { ok: true, status: 200, text: async () => JSON.stringify(op === 'poll'
          ? { result: { id: 'completed-shot', png: png.toString('base64') }, hideDsh: false } : {}) }; },
      File, Uint8Array, DataTransfer: Transfer, ClipboardEvent: TransferEvent, DragEvent: TransferEvent,
      atob, Date, Set, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    });
    new vm.Script(source, { filename: 'installed-client.js' }).runInContext(context);
    const registration = modules.get(manifest.name);
    assert.ok(registration, 'client bundle must register the module DSH imports');
    const plugin = registration.factory(name => { assert.equal(name, 'react'); return React; });
    plugin.apply({ slots: { inject: (_slot, callback) => callback(), register: (config, component) => slots.push({ config, component }) },
      effect: callback => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); } });
    for (let i = 0; i < 20 && !operations.includes(hasComposer ? 'ack' : 'failure'); i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(slots.length, 1); assert.equal(slots[0].config.name, 'conversation.input.left');
    const button = slots[0].component();
    assert.ok(button.children.some(child => child?.props?.['aria-label'] === '截图'), 'camera must be rendered');
    if (hasComposer) {
      assert.deepEqual(operations, ['poll', 'ack']); assert.equal(attached.length, 1);
      assert.deepEqual(Buffer.from(await attached[0].arrayBuffer()), png, 'completed image must reach the composer');
    } else { assert.deepEqual(operations, ['poll', 'failure']); assert.equal(attached.length, 0); }
    for (const cleanup of cleanups) cleanup();
  }
  console.log('PASS: installed Loader/manifest/client identity, camera slot, completed PNG delivery and ack, preserve image when composer absent');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2]) {
    await verifyInstalledClient(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
  } else {
    // CI can exercise the real installer without running a DSH executable.
    const project = fileURLToPath(new URL('..', import.meta.url));
    const root = path.join(project, '.release_test', 'client-contract-' + randomUUID());
    const profile = path.join(root, 'profile'), dsh = path.join(root, 'fixture dsh');
    await fs.mkdir(profile, { recursive: true }); await fs.writeFile(path.join(profile, 'package.json'), '{}');
    for (const name of ['DeepSeek Harness.exe', 'icudtl.dat', 'resources.pak', 'v8_context_snapshot.bin', 'locales/en-US.pak', 'resources/default_app.asar']) {
      const file = path.join(dsh, name); await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, 'Installation fixture only; never executed.');
    }
    const ps = (name, args) => new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(project, name), ...args], { windowsHide: true });
      let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
      child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(output)));
    });
    await ps('install.ps1', ['-ProfileDir', profile, '-DshExe', path.join(dsh, 'DeepSeek Harness.exe')]);
    await verifyInstalledClient(path.join(profile, 'node_modules', 'dsh-plugin-live-shot'), profile);
    await ps('uninstall.ps1', ['-ProfileDir', profile, '-RemoveData']);
    const legacy = path.join(profile, 'node_modules', '@local', 'dsh-shot');
    const data = path.join(root, 'legacy custom data');
    await fs.mkdir(legacy, { recursive: true }); await fs.mkdir(data);
    for (const name of ['package.json', 'client.js']) await fs.copyFile(path.join(project, name), path.join(legacy, name));
    await fs.writeFile(path.join(legacy, '.install.json'), JSON.stringify({ dataDir: data }));
    await fs.writeFile(path.join(data, '.dsh-shot-data.json'), JSON.stringify({ package: '@local/dsh-shot', profileDir: profile }));
    const preference = '{"hideDsh":true,"hotkey":"Ctrl+Alt+Shift+F24"}\n';
    await fs.writeFile(path.join(data, 'preferences.json'), preference);
    await fs.writeFile(path.join(profile, 'cordis.patch.yml'), "\r\n# BEGIN dsh-shot portable\r\n- insert:\r\n    - id: dsh-shot\r\n      name: '@local/dsh-shot'\r\n# END dsh-shot portable\r\n");
    await assert.rejects(verifyInstalledClient(legacy, profile), /DSH skips Client/);
    await ps('install.ps1', ['-ProfileDir', profile, '-DshExe', path.join(dsh, 'DeepSeek Harness.exe')]);
    const migrated = path.join(profile, 'node_modules', 'dsh-plugin-live-shot');
    await verifyInstalledClient(migrated, profile);
    assert.equal(JSON.parse(await fs.readFile(path.join(migrated, '.install.json'), 'utf8')).dataDir, data);
    assert.equal(await fs.readFile(path.join(data, 'preferences.json'), 'utf8'), preference);
    await ps('install.ps1', ['-ProfileDir', profile, '-DshExe', path.join(dsh, 'DeepSeek Harness.exe')]);
    assert.equal((await fs.readFile(path.join(profile, 'cordis.patch.yml'), 'utf8')).match(/- id: dsh-shot/g).length, 1);
    await ps('uninstall.ps1', ['-ProfileDir', profile, '-RemoveData']);
    await assert.rejects(fs.stat(legacy), { code: 'ENOENT' }); await assert.rejects(fs.stat(data), { code: 'ENOENT' });
    console.log('PASS: beta.2 alias failure, automatic migration, custom data/preferences retained, repeat upgrade and full uninstall');
    console.log('PASS: real Windows installer Client contract in a clean isolated profile (no DSH fixture executable was launched)');
  }
}
