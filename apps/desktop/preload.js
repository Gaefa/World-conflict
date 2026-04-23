// Preload runs in an isolated context between Electron main and the
// renderer. contextBridge is the only safe way to hand the renderer a
// narrow, typed API without exposing Node globals.
//
// Surface used by the web UI: `window.conflictLAN.getInfo()` returns
// the LAN-reachable addresses for the embedded Fastify server so the
// host can share them with friends on the same network.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('conflictLAN', {
  /**
   * @returns {Promise<{ port: number, ipv4: string[] }>}
   *   port: the embedded server's listen port
   *   ipv4: all non-loopback IPv4 addresses detected on the host
   */
  getInfo: () => ipcRenderer.invoke('lan:get-info'),
});
