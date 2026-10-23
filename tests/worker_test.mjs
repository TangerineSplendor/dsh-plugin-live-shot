import assert from 'node:assert/strict';
import { CaptureWorker } from '../worker.js';
const worker = new CaptureWorker();
try {
  await worker.start();
  const pointer = await worker.run({ op: 'pointer' });
  assert.equal(typeof pointer.down, 'boolean');
  const shot = await worker.run({ op: 'region', x: 10, y: 10, width: 317, height: 193 });
  const png = Buffer.from(shot.png, 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 317); assert.equal(png.readUInt32BE(20), 193);
  await assert.rejects(worker.run({ op: 'region', x: 0, y: 0, width: 0, height: 10 }), /Invalid region/);
  assert.equal(typeof (await worker.run({ op: 'pointer' })).down, 'boolean');
  console.log('PASS: real PowerShell 5.1 startup, pointer-only protocol, native PNG 317x193, invalid dimensions, recovery');
} finally { worker.stop(); }
