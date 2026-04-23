const { app, BrowserWindow, dialog, protocol, net, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

// Register a privileged custom scheme BEFORE app is ready. This scheme
// behaves like http/https: it's a "standard" URL, supports fetch/XHR,
// has a proper origin, and is secure enough to use modern web APIs
// (WebGL, WebAudio, Workers). We serve the statically-exported Next.js
// UI from this scheme so that absolute asset paths like
// `/_next/static/chunks/foo.js` resolve against the app's own root
// instead of the operating-system filesystem root (as they would under
// file://).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow;
let splashWindow;
let devWebServerPid = null;

// Allow forcing prod-mode codepaths during local testing (e.g. to smoke test
// the app:// protocol handler without packaging a full DMG/EXE).
const isDev = !app.isPackaged && process.env.CONFLICT_FORCE_PROD !== '1';
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
  // When NOT packaged (including CONFLICT_FORCE_PROD=1 smoke tests on dev
  // machines), resolve relative to the monorepo. When packaged by
  // electron-builder, extraResources are copied into process.resourcesPath.
  if (!app.isPackaged) {
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
  //
  // Bind to 0.0.0.0 so the embedded server is reachable from other
  // machines on the same LAN — that's the whole point of LAN-host mode.
  // Singleplayer in-browser uses InMemoryTransport and never hits this
  // port, so exposing it doesn't break singleplayer. macOS/Windows
  // firewalls still gate inbound connections separately.
  process.env.PORT = String(SERVER_PORT);
  process.env.HOST = '0.0.0.0';
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

/**
 * Collect every non-loopback IPv4 address on this machine. We use this
 * to tell the renderer which URLs friends on the LAN can connect to.
 *
 * We skip IPv6 for the first cut — most home LANs work fine on IPv4,
 * and Windows/mac link-local IPv6 addresses look scary to non-technical
 * users who just want a string to paste into a chat.
 */
function getLanIpv4Addresses() {
  const results = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // `net.family === 'IPv4'` in Node 18+; older Node returns 4.
      const isV4 = net.family === 'IPv4' || net.family === 4;
      if (!isV4 || net.internal) continue;
      results.push(net.address);
    }
  }
  return results;
}

function registerAppProtocol() {
  // Map `app://local/<path>` -> `<webRoot>/<path>`, defaulting to
  // index.html for the root and for directory-style URLs (because
  // next.config.ts sets trailingSlash: true, so the router emits
  // href="/" and href="/foo/").
  //
  // Packaged: extraResources copies apps/web/out -> resources/web,
  // so webRoot = process.resourcesPath/web.
  // Unpackaged (CONFLICT_FORCE_PROD=1 smoke test): monorepo apps/web/out.
  const webRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.join(__dirname, '..', 'web', 'out');
  log('Registering app:// protocol, webRoot:', webRoot);

  if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
    log('ERROR: web index.html missing at', webRoot);
    log(listDir(webRoot));
    throw new Error(`Web root not found: ${webRoot}`);
  }

  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      // Strip the leading `/` and decode percent-encoding. Reject any
      // path segment with `..` so we can't escape webRoot.
      let relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (relPath.split('/').some((s) => s === '..')) {
        return new Response('Forbidden', { status: 403 });
      }
      if (relPath === '' || relPath.endsWith('/')) {
        relPath = path.posix.join(relPath, 'index.html');
      }
      const absPath = path.join(webRoot, relPath);
      if (!fs.existsSync(absPath)) {
        // Fall back to index.html for client-side routing (SPA) so refreshes
        // on a sub-route still load the app.
        const indexFallback = path.join(webRoot, 'index.html');
        log('app:// 404 ->', relPath, '(falling back to index.html)');
        return net.fetch(pathToFileURL(indexFallback).href);
      }
      return net.fetch(pathToFileURL(absPath).href);
    } catch (e) {
      log('app:// handler error:', e);
      return new Response('Internal error', { status: 500 });
    }
  });

  log('app:// protocol registered');
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
      // Preload exposes window.conflictLAN.getInfo() — used by the LAN-host
      // UI to display the current machine's LAN URLs.
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    // Dev: Next.js dev server must be running separately on :3000.
    const devUrl = `http://127.0.0.1:${DEV_WEB_PORT}`;
    log('Loading dev UI:', devUrl);
    mainWindow.loadURL(devUrl);
  } else {
    // Prod: load from our custom app:// scheme so absolute paths like
    // /_next/static/... resolve against the bundled web root instead
    // of the filesystem root.
    const entryUrl = 'app://local/index.html';
    log('Loading static UI via custom scheme:', entryUrl);
    mainWindow.loadURL(entryUrl);
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

// IPC: renderer asks for our LAN addresses so it can show them to the host.
// Registered before app.whenReady resolves so the renderer can call it as
// soon as the window loads.
ipcMain.handle('lan:get-info', () => ({
  port: SERVER_PORT,
  ipv4: getLanIpv4Addresses(),
}));

app.whenReady().then(async () => {
  try {
    createSplash();

    // 1. Register our custom app:// protocol handler (prod only — dev uses
    //    the Next.js dev server on http://127.0.0.1:3000).
    if (!isDev) {
      registerAppProtocol();
    }

    // 2. Fastify server (bundled, runs in-process — no subprocess, no node
    //    binary needed). Everything except this is plain static files.
    await startServerInProcess();

    // 3. Main window — loads the static UI via app:// in prod, or
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
