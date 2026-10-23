import assert from 'node:assert/strict';
import { adjustRect, intersect } from '../selection.js';
import { normalizeHotkey } from '../settings.js';
const rect = { x: 30, y: 40, width: 100, height: 80 }, start = { x: 50, y: 50 }, bounds = { width: 300, height: 200 };
assert.deepEqual(adjustRect(rect, start, { x: -100, y: 900 }, 'move', bounds), { x: 0, y: 120, width: 100, height: 80 });
assert.deepEqual(adjustRect(rect, start, { x: 1000, y: 1000 }, 'se', bounds), { x: 30, y: 40, width: 270, height: 160 });
assert.deepEqual(adjustRect(rect, start, { x: 500, y: 500 }, 'nw', bounds), { x: 128, y: 118, width: 2, height: 2 });
for (const edge of ['n','ne','e','se','s','sw','w','nw']) {
  const adjusted = adjustRect(rect, start, { x: 70, y: 65 }, edge, bounds);
  assert.ok(adjusted.width >= 2 && adjusted.height >= 2 && adjusted.x >= 0 && adjusted.y >= 0);
  assert.ok(adjusted.x + adjusted.width <= bounds.width && adjusted.y + adjusted.height <= bounds.height);
}
assert.deepEqual(intersect({ x: -50, y: 30, width: 120, height: 40 }, { x: 0, y: 0, width: 200, height: 200 }), { x: 0, y: 30, width: 70, height: 40 });
assert.equal(intersect(rect, { x: 500, y: 500, width: 30, height: 30 }), null);
assert.equal(normalizeHotkey('alt+CONTROL+a'), 'Ctrl+Alt+A');
assert.equal(normalizeHotkey('F24'), 'F24'); assert.equal(normalizeHotkey('win+shift+9'), 'Shift+Super+9');
for (const invalid of ['A','Shift+A','Ctrl','Ctrl+Ctrl+A','Ctrl+A+B','Ctrl+Delete','F25']) assert.throws(() => normalizeHotkey(invalid));
console.log('PASS: resize all handles, screen bounds, minimum size, monitor clipping, shortcut normalization and invalid combinations');
