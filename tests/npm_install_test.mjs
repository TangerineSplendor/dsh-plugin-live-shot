import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { verifyInstalledClient } from './client_install_test.mjs';

const project = fileURLToPath(new URL('..', import.meta.url));
const tgz = path.resolve(process.argv[2]);
const root = path.join(project, '.release_test', 'npm-' + randomUUID());
await fs.mkdir(root, { recursive: true });
const run = (exe, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(exe, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  child.on('error', reject); child.on('close', code => resolve({ code, output }));
});
const ok = result => { assert.equal(result.code, 0, result.output); return result; };
ok(await run('tar.exe', ['-xzf', tgz, '-C', root]));
const source = path.join(root, 'package');
const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
assert.equal(manifest.name, 'dsh-plugin-live-shot'); assert.equal(manifest.private, undefined);
for (const forbidden of ['.install.json', '.runtime', '.git', 'HANDOFF.md', 'tests']) {
  await assert.rejects(fs.stat(path.join(source, forbidden)), { code: 'ENOENT' });
}
ok(await run(process.execPath, [path.join(source, 'bin/dsh-shot.cjs'), '--help']));
// Explicit installer and standard bundles must use the same package identity.
const profile = path.join(root, 'explicit profile');
await fs.mkdir(profile); await fs.writeFile(path.join(profile, 'package.json'), '{}');
ok(await run(process.execPath, [path.join(source, 'bin/dsh-shot.cjs'), 'install', '-ProfileDir', profile]));
assert.equal(JSON.parse(await fs.readFile(path.join(profile, 'node_modules/dsh-plugin-live-shot/package.json'), 'utf8')).name, manifest.name);
await verifyInstalledClient(path.join(profile, 'node_modules/dsh-plugin-live-shot'), profile);
ok(await run(process.execPath, [path.join(source, 'bin/dsh-shot.cjs'), 'uninstall', '-ProfileDir', profile, '-RemoveData']));
// A standard bundle install has no private config or pre-copied runtime.
const bundleProfile = path.join(root, 'bundle profile');
const installed = path.join(bundleProfile, 'node_modules', manifest.name);
await fs.mkdir(path.dirname(installed), { recursive: true });
await fs.cp(source, installed, { recursive: true });
await fs.writeFile(path.join(bundleProfile, 'package.json'), '{}');
const body = `
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {apply}=await import(${JSON.stringify(pathToFileURL(path.join(installed, 'index.js')).href)});
let route;const cleanups=[];
apply({connection:{fetch:{register:c=>{route=c.fetch;return()=>{}}}},effect:f=>{const c=f();if(c)cleanups.push(c)}});
try{for(const op of ['start','cancel']){const r=await route(new Request('http://local',{method:'POST',body:JSON.stringify({op,client:'npm-bootstrap-test'})}));const d=await r.json();assert.equal(r.status,200,d.error);assert.equal(d.phase,op==='start'?'selecting':'idle')}}finally{for(const c of cleanups.reverse())await c()}
const config=JSON.parse(await fs.readFile(${JSON.stringify(path.join(installed, '.install.json'))},'utf8'));
assert.equal(config.profileDir.toLowerCase(),${JSON.stringify(bundleProfile.toLowerCase())});
assert.equal(config.dataDir.toLowerCase(),${JSON.stringify(path.join(bundleProfile, '.dsh-shot-data').toLowerCase())});
console.log('Standard bundle first-run runtime setup and real Electron start/cancel passed');
`;
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('DSH_SHOT_')) delete env[key];
console.log(ok(await run(process.execPath, ['--input-type=module', '-e', body], env)).output.trim());
console.log('PASS: npm tarball contents, CLI help/install/uninstall, standard bundle bootstrap without private config, real helper startup');
console.log('Isolated fixture:', root);
