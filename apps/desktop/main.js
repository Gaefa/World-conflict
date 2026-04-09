const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let serverProcess;
let webProcess;

const isDev = !app.isPackaged;
const SERVER_PORT = 3002;
const WEB_PORT = 3000;

// Logging helper — writes to file even before Electron is ready
const LOG_FILE = (() => {
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'conflict-game.log');
  } catch {
    return null;
  }
})();

function log(...args) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(line);
  if (LOG_FILE) {
    try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
  }
}

// Clear log file on startup
if (LOG_FILE) {
  try { fs.writeFileSync(LOG_FILE, ''); } catch {}
}

log('=== Conflict.Game starting ===');
log('isDev:', isDev);
log('execPath:', process.execPath);
log('resourcesPath:', process.resourcesPath || '(dev)');
log('platform:', process.platform);

function getResourcePath(...segments) {
  if (isDev) {
    return path.join(__dirname, '..', ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.request(
        { host: '127.0.0.1', port, method: 'GET', path: '/', timeout: 1000 },
        (res) => { res.resume(); resolve(); }
      );
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.on('timeout', () => { req.destroy(); });
      req.end();
    };
    setTimeout(check, 500);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      const serverDir = path.join(__dirname, '..', 'server');
      log('[dev] Starting server from', serverDir);
      const tsxBin = path.join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
      serverProcess = spawn(tsxBin, ['src/index.ts'], {
        cwd: serverDir,
        env: { ...process.env, PORT: String(SERVER_PORT) },
        stdio: 'pipe',
        windowsHide: true,
      });
    } else {
      const serverEntry = getResourcePath('server', 'dist', 'index.js');
      log('[prod] Server entry:', serverEntry);

      if (!fs.existsSync(serverEntry)) {
        log('ERROR: Server entry does not exist');
        // List what we have in resources to help debug
        try {
          const resources = fs.readdirSync(process.resourcesPath);
          log('resourcesPath contents:', resources.join(', '));
          const serverDir = path.join(process.resourcesPath, 'server');
          if (fs.existsSync(serverDir)) {
            log('server dir contents:', fs.readdirSync(serverDir).join(', '));
            const distDir = path.join(serverDir, 'dist');
            if (fs.existsSync(distDir)) {
              log('server/dist contents:', fs.readdirSync(distDir).join(', '));
            }
          }
        } catch (e) {
          log('Failed to list resources:', e.message);
        }
        reject(new Error(`Server not found: ${serverEntry}`));
        return;
      }

      // Use ELECTRON_RUN_AS_NODE to run the current binary as Node.js
      // This avoids needing a separate node executable
      serverProcess = spawn(process.execPath, [serverEntry], {
        cwd: getResourcePath('server'),
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          PORT: String(SERVER_PORT),
          NODE_ENV: 'production',
          NODE_PATH: getResourcePath('server', 'node_modules'),
        },
        stdio: 'pipe',
        windowsHide: true,
      });
    }

    serverProcess.stdout?.on('data', (d) => log('[server]', d.toString().trim()));
    serverProcess.stderr?.on('data', (d) => log('[server:err]', d.toString().trim()));
    serverProcess.on('error', (err) => {
      log('[server] spawn error:', err.message);
      reject(err);
    });
    serverProcess.on('exit', (code, signal) => {
      log('[server] exited with code', code, 'signal', signal);
    });

    waitForPort(SERVER_PORT, 30000).then(resolve).catch(reject);
  });
}

function startWeb() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      const webDir = path.join(__dirname, '..', 'web');
      log('[dev] Starting web from', webDir);
      const nextBin = path.join(webDir, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');
      webProcess = spawn(nextBin, ['start', '-p', String(WEB_PORT)], {
        cwd: webDir,
        env: { ...process.env },
        stdio: 'pipe',
        windowsHide: true,
      });
    } else {
      const webDir = getResourcePath('web');
      const standaloneServer = path.join(webDir, 'apps', 'web', 'server.js');

      log('[prod] Web entry:', standaloneServer);

      if (!fs.existsSync(standaloneServer)) {
        log('ERROR: Web server not found');
        try {
          if (fs.existsSync(webDir)) {
            log('web dir contents:', fs.readdirSync(webDir).join(', '));
            const appsDir = path.join(webDir, 'apps');
            if (fs.existsSync(appsDir)) {
              log('web/apps contents:', fs.readdirSync(appsDir).join(', '));
              const webSubdir = path.join(appsDir, 'web');
              if (fs.existsSync(webSubdir)) {
                log('web/apps/web contents:', fs.readdirSync(webSubdir).join(', '));
              }
            }
          }
        } catch (e) {
          log('Failed to list web dir:', e.message);
        }
        reject(new Error(`Web server not found: ${standaloneServer}`));
        return;
      }

      webProcess = spawn(process.execPath, [standaloneServer], {
        cwd: path.dirname(standaloneServer),
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          PORT: String(WEB_PORT),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
        },
        stdio: 'pipe',
        windowsHide: true,
      });
    }

    webProcess.stdout?.on('data', (d) => log('[web]', d.toString().trim()));
    webProcess.stderr?.on('data', (d) => log('[web:err]', d.toString().trim()));
    webProcess.on('error', (err) => {
      log('[web] spawn error:', err.message);
      reject(err);
    });
    webProcess.on('exit', (code, signal) => {
      log('[web] exited with code', code, 'signal', signal);
    });

    waitForPort(WEB_PORT, 30000).then(resolve).catch(reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'Conflict.Game',
    backgroundColor: '#0a0a0a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSplash() {
  const splash = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    title: 'Conflict.Game',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html><head><title>Conflict.Game</title></head>
    <body style="background:#0a0a0a;color:#e0e0e0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif;border:1px solid #333;">
      <h1 style="color:#dc2626;font-size:24px;letter-spacing:4px;margin:0">CONFLICT.GAME</h1>
      <p style="color:#888;font-size:14px;margin-top:12px">Starting server...</p>
    </body></html>
  `));
  return splash;
}

app.whenReady().then(async () => {
  let splash;
  try {
    splash = createSplash();
    log('Starting server...');
    await startServer();
    log('Server ready on port', SERVER_PORT);

    log('Starting web...');
    await startWeb();
    log('Web ready on port', WEB_PORT);

    if (splash && !splash.isDestroyed()) splash.close();
    createWindow();
  } catch (err) {
    log('Failed to start:', err.message, err.stack);
    if (splash && !splash.isDestroyed()) splash.close();
    dialog.showErrorBox(
      'Conflict.Game - Startup Error',
      `Failed to start: ${err.message}\n\nCheck logs at: ${LOG_FILE}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
  if (webProcess && !webProcess.killed) {
    try { webProcess.kill(); } catch {}
    webProcess = null;
  }
});
