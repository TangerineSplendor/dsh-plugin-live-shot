const { contextBridge, ipcRenderer } = require('electron');
const channel = process.argv.find(v => v.startsWith('--shot-channel=')).slice(15);
contextBridge.exposeInMainWorld('shot', {
  call: (op, data) => ipcRenderer.invoke(channel, op, data),
  on: callback => ipcRenderer.on(channel, (_event, data) => callback(data)),
});
