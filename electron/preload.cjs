// @ts-check
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cpvtsDesktop', {
  openCustomerDisplay: (code) => ipcRenderer.invoke('open-customer-display', code),
});
