import assert from 'node:assert/strict';
import { NativePicker } from '../picker.js';
const picker = new NativePicker();
try {
  await picker.start();
  const initial = await picker.run({ op: 'status' });
  assert.equal(initial.active, false);
  assert.equal(initial.adminEscapeReady, false, 'game compatibility must be opt-in');
  assert.deepEqual(await picker.run({ op: 'adminEscapeStatus' }), { ready: false });
  await assert.rejects(picker.run({ op: 'select', x: 0, y: 0, width: 0, height: 200 }), /Invalid native selection/);
  if (initial.foregroundWindow === '0') {
    console.log('PASS: native picker compilation/startup and invalid bounds; SKIP interactive HWND/hook checks without a foreground desktop');
  }
  for (let attempt = 0; attempt < (initial.foregroundWindow === '0' ? 0 : 2); attempt++) {
    const selected = picker.run({ op: 'select', x: 0, y: 0, width: 640, height: 480 });
    let status;
    for (let i = 0; i < 50; i++) {
      status = await picker.run({ op: 'status' });
      if (status.active && status.escapeHook) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(status.active, true);
    assert.equal(status.visible, true, 'native picker must actually be visible, not only logically active');
    assert.match(status.handle, /^[1-9]\d*$/);
    assert.equal(status.escapeHook, true, 'selection must install its scoped Escape handler');
    assert.equal(status.escapeRawInput, true, 'selection must receive Escape without keyboard focus');
    await assert.rejects(picker.run({ op: 'enableAdminEscape' }), /Finish selection/, 'never launch an admin prompt during selection');
    await picker.run({ op: 'cancel' });
    const outcome = await selected;
    assert.equal(outcome.selected, false);
    assert.equal(outcome.png, undefined);
    assert.equal((await picker.run({ op: 'status' })).active, false);
  }
  if (initial.foregroundWindow !== '0') console.log('PASS: actual native picker process, scoped Escape handlers, start/cancel/reuse, invalid bounds, no screenshot pixels');
} finally { picker.stop(); }
