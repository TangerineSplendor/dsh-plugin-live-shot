const fs = require('node:fs');
const path = require('node:path');

module.exports = function runtimePaths() {
  let config = {};
  try { config = JSON.parse(fs.readFileSync(path.join(__dirname, '.install.json'), 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Invalid screenshot installation config: ' + error.message); }
  const modules = __dirname.lastIndexOf(path.sep + 'node_modules' + path.sep);
  const defaultData = modules >= 0 ? path.join(__dirname.slice(0, modules), '.dsh-shot-data') : path.join(__dirname, '.runtime');
  const dataDir = path.resolve(process.env.DSH_SHOT_DATA_DIR || config.dataDir || defaultData);
  return {
    dataDir,
    tempDir: path.join(dataDir, 'tmp'),
    electronExe: process.env.DSH_SHOT_ELECTRON_PATH || config.electronExe || path.join(dataDir, 'electron.exe'),
    preferences: process.env.DSH_SHOT_PREFERENCES_PATH || path.join(dataDir, 'preferences.json'),
    userData: process.env.DSH_SHOT_USER_DATA_PATH || path.join(dataDir, 'user_data'),
    captures: path.join(dataDir, 'captures'),
  };
};
