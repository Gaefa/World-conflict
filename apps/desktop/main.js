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

function log(...args) {
  const msg = args.join(' ');
  console.log(`[desktop] ${msg}`);
  // Also write to a log file for debugging packaged app
  if (!isDev) {
    const logFile = path.join(app.getPath('userData'), 'conflict-game.log');
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
  }
}

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
      const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/', timeout: 500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const nodeExe = process.execPath.includes('electron') || process.execPath.includes('Electron')
      ? 'node'
      : process.execPath;

    if (isDev) {
      const serverDir = path.join(__dirname, '..', 'server');
      log('Starting dev server from', serverDir);
      serverProcess = spawn('npx', ['tsx', 'src/index.ts'], {
        cwd: serverDir,
        env: { ...process.env, PORT: String(SERVER_PORT) },
        stdio: 'pipe',
        shell: true,
      });
    } else {
      const serverEntry = getResourcePath('server', 'dist', 'index.js');
      log('Starting production server from', serverEntry);

      if (!fs.existsSync(serverEntry)) {
        log('ERROR: Server entry not found at', serverEntry);
        reject(new Error(`Server entry not found: ${serverEntry}`));
        return;
      }

      serverProcess = spawn(nodeExe, [serverEntry], {
        cwd: getResourcePath('server'),
        env: {
          ...process.env,
          PORT: String(SERVER_PORT),
          NODE_PATH: [
            getResourcePath('server', 'node_modules'),
            getResourcePath('node_modules'),
          ].join(path.delimiter),
        },
        stdio: 'pipe',
        shell: true,
      });
    }

    serverProcess.stdout?.on('data', (d) => log('[server]', d.toString().trim()));
    serverProcess.stderr?.on('data', (d) => log('[server:err]', d.toString().trim()));
    serverProcess.on('error', (err) => {
      log('Server process error:', err.message);
      reject(err);
    });
    serverProcess.on('exit', (code) => {
      log('Server exited with code', code);
    });

    waitForPort(SERVER_PORT, 30000).then(resolve).catch(reject);
  });
}

function startWeb() {
  return new Promise((resolve, reject) => {
    const nodeExe = process.execPath.includes('electron') || process.execPath.includes('Electron')
      ? 'node'
      : process.execPath;

    if (isDev) {
      const webDir = path.join(__dirname, '..', 'web');
      log('Starting dev web from', webDir);
      webProcess = spawn('npx', ['next', 'start', '-p', String(WEB_PORT)], {
        cwd: webDir,
        env: { ...process.env },
        stdio: 'pipe',
        shell: true,
      });
    } else {
      // Next.js standalone output: run the standalone server.js directly
      const webDir = getResourcePath('web');
      const standaloneServer = path.join(webDir, 'apps', 'web', 'server.js');

      log('Starting production web from', standaloneServer);

      if (!fs.existsSync(standaloneServer)) {
        log('ERROR: Standalone server not found at', standaloneServer);
        // Try alternative path
        const altPath = path.join(webDir, 'server.js');
        if (fs.existsSync(altPath)) {
          log('Found server.js at alternative path:', altPath);
        }
        reject(new Error(`Web server not found: ${standaloneServer}`));
        return;
      }

      webProcess = spawn(nodeExe, [standaloneServer], {
        cwd: path.dirname(standaloneServer),
        env: {
          ...process.env,
          PORT: String(WEB_PORT),
          HOSTNAME: '127.0.0.1',
        },
        stdio: 'pipe',
        shell: true,
      });
    }

    webProcess.stdout?.on('data', (d) => log('[web]', d.toString().trim()));
    webProcess.stderr?.on('data', (d) => log('[web:err]', d.toString().trim()));
    webProcess.on('error', (err) => {
      log('Web process error:', err.message);
      reject(err);
    });
    webProcess.on('exit', (code) => {
      log('Web exited with code', code);
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

// Splash/loading window while starting services
function createSplash() {
  const splash = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splash.loadURL(`data:text/html;charset=utf-8,
    <html><body style="background:#0a0a0a;color:#e0e0e0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;border:1px solid #333;border-radius:12px;">
      <h1 style="color:#dc2626;font-size:24px;letter-spacing:4px;margin:0">CONFLICT.GAME</h1>
      <p style="color:#888;font-size:14px;margin-top:12px">Starting server...</p>
    </body></html>
  `);
  return splash;
}

app.whenReady().then(async () => {
  const splash = createSplash();
  try {
    log('isDev:', isDev);
    log('resourcesPath:', process.resourcesPath);

    log('Starting server...');
    await startServer();
    log('Server ready on port', SERVER_PORT);

    log('Starting web...');
    await startWeb();
    log('Web ready on port', WEB_PORT);

    splash.close();
    createWindow();
  } catch (err) {
    log('Failed to start:', err.message);
    splash.close();
    dialog.showErrorBox('Conflict.Game - Startup Error', `Failed to start: ${err.message}\n\nCheck logs at: ${path.join(app.getPath('userData'), 'conflict-game.log')}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (webProcess && !webProcess.killed) {
    webProcess.kill();
    webProcess = null;
  }
});
