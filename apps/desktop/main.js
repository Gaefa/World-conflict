const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow;
let splashWindow;
let devWebServerPid = null;

const isDev = !app.isPackaged;
const SERVER_PORT = 3002;
// Dev mode still uses Next.js dev server on :3000 (hot reload). Production
// loads the statically-exported UI directly from disk via file://.
const DEV_WEB_PORT = 3000;

// --- Logging (to file + console) ---
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
  const msg = args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? (a.stack || a.message) : JSON.stringify(a)))
    .join(' ');
  const line = `${new Date().toISOString()} ${msg}`;
  try { console.log(line); } catch {}
  if (LOG_FILE) {
    try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
  }
}

// Clear log on startup
if (LOG_FILE) {
  try { fs.writeFileSync(LOG_FILE, ''); } catch {}
}

// --- Single-instance lock: hard guard against any fork-bomb recurrence ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance is already running. Bail out immediately, BEFORE
  // doing anything else, so we can never recurse.
  log('Another instance is already running — exiting this one');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

log('=== Conflict.Game starting ===');
log('isDev:', isDev);
log('execPath:', process.execPath);
log('resourcesPath:', process.resourcesPath || '(dev)');
log('platform:', process.platform);
log('node version:', process.versions.node);
log('electron version:', process.versions.electron);

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
          setTimeout(check, 300);
        }
      });
      req.on('timeout', () => { req.destroy(); });
      req.end();
    };
    setTimeout(check, 300);
  });
}

function listDir(p, depth = 1) {
  try {
    if (!fs.existsSync(p)) return `${p} (missing)`;
    const entries = fs.readdirSync(p);
    return `${p}: ${entries.join(', ')}`;
  } catch (e) {
    return `${p} (read error: ${e.message})`;
  }
}

// --- In-process server startup ---
// We load the Fastify server and Next.js standalone server directly into
// the Electron main process. This avoids:
//   • needing a separate `node` binary (not present in packaged Electron)
//   • ELECTRON_RUN_AS_NODE, which electron-builder strips for security
//   • spawning subprocesses that create cmd.exe popups on Windows
//   • the fork-bomb risk we hit last build

async function startServerInProcess() {
  const serverEntry = getResourcePath('server', 'dist', 'index.js');
  log('Loading Fastify server in-process:', serverEntry);

  if (!fs.existsSync(serverEntry)) {
    log('ERROR: server entry missing');
    log(listDir(process.resourcesPath));
    log(listDir(getResourcePath('server')));
    log(listDir(getResourcePath('server', 'dist')));
    throw new Error(`Server entry not found: ${serverEntry}`);
  }

  // Server reads PORT/HOST from env at module load time.
  process.env.PORT = String(SERVER_PORT);
  process.env.HOST = '127.0.0.1';
  process.env.NODE_ENV = 'production';

  // Ensure module resolution finds bundled node_modules.
  const serverDir = getResourcePath('server');
  const serverNodeModules = path.join(serverDir, 'node_modules');
  if (fs.existsSync(serverNodeModules)) {
    process.env.NODE_PATH = serverNodeModules +
      (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : '');
    require('module').Module._initPaths();
  }

  // apps/server is ESM ("type": "module"), so we must use dynamic import.
  // On Windows, import() requires a file:// URL, not a raw path.
  try {
    const url = pathToFileURL(serverEntry).href;
    log('Dynamic-importing server from:', url);
    await import(url);
    log('Server module evaluated — waiting for listen()...');
  } catch (e) {
    log('Failed to import server:', e);
    throw e;
  }

  await waitForPort(SERVER_PORT, 30000);
  log('Fastify server ready on', SERVER_PORT);
}

function resolveWebIndexHtml() {
  // Production: statically exported UI is shipped as extraResources under
  // `resources/web/index.html`. No Next.js runtime server is required.
  const indexPath = getResourcePath('web', 'index.html');
  log('Resolving static web entry:', indexPath);
  if (!fs.existsSync(indexPath)) {
    log('ERROR: web index.html missing');
    log(listDir(getResourcePath('web')));
    throw new Error(`Web entry not found: ${indexPath}`);
  }
  return indexPath;
}

// --- Windows ---
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 220,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    skipTaskbar: false,
    title: 'Conflict.Game',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const html = `
    <html><head><meta charset="utf-8"><title>Conflict.Game</title></head>
    <body style="background:#0a0a0a;color:#e0e0e0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif;border:1px solid #333;">
      <h1 style="color:#dc2626;font-size:26px;letter-spacing:4px;margin:0">CONFLICT.GAME</h1>
      <p style="color:#888;font-size:13px;margin-top:12px">Loading the world...</p>
    </body></html>
  `;
  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function createMainWindow() {
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

  if (isDev) {
    // Dev: Next.js dev server must be running separately on :3000.
    const devUrl = `http://127.0.0.1:${DEV_WEB_PORT}`;
    log('Loading dev UI:', devUrl);
    mainWindow.loadURL(devUrl);
  } else {
    // Prod: load the statically-exported UI directly from disk.
    const indexHtml = resolveWebIndexHtml();
    log('Loading static UI:', indexHtml);
    mainWindow.loadFile(indexHtml);
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load:', code, desc, url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    createSplash();

    // 1. Fastify server (bundled, runs in-process — no subprocess, no node
    //    binary needed). Everything except this is plain static files.
    await startServerInProcess();

    // 2. Main window — loads the static UI directly from disk in prod, or
    //    the Next.js dev server in dev.
    createMainWindow();
  } catch (err) {
    log('Fatal startup error:', err);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox(
      'Conflict.Game — Startup Error',
      `Failed to start the game.\n\n${err.message}\n\nLog file:\n${LOG_FILE}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

process.on('uncaughtException', (err) => {
  log('uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  log('unhandledRejection:', reason);
});
