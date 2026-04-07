const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let serverProcess;
let webProcess;

const isDev = !app.isPackaged;
const SERVER_PORT = 3002;
const WEB_PORT = 3000;

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
      const req = http.request({ host: '127.0.0.1', port, method: 'HEAD', timeout: 500 }, () => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 300);
        }
      });
      req.end();
    };
    check();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In dev, use tsx to run the server source directly
      const serverDir = path.join(__dirname, '..', 'server');
      serverProcess = fork(
        path.join(serverDir, 'node_modules', '.bin', 'tsx'),
        ['src/index.ts'],
        {
          cwd: serverDir,
          env: { ...process.env, PORT: String(SERVER_PORT) },
          stdio: 'pipe',
        }
      );
    } else {
      // In production, run the compiled server
      const serverEntry = getResourcePath('server', 'index.js');
      serverProcess = fork(serverEntry, [], {
        env: {
          ...process.env,
          PORT: String(SERVER_PORT),
          NODE_PATH: getResourcePath('server-modules'),
        },
        stdio: 'pipe',
      });
    }

    serverProcess.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
    serverProcess.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));
    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Server exited with code ${code}`);
      }
    });

    // Wait for server to be ready
    waitForPort(SERVER_PORT).then(resolve).catch(reject);
  });
}

function startWeb() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      const webDir = path.join(__dirname, '..', 'web');
      const nextBin = path.join(webDir, 'node_modules', '.bin', 'next');
      webProcess = fork(nextBin, ['start', '-p', String(WEB_PORT)], {
        cwd: webDir,
        env: { ...process.env },
        stdio: 'pipe',
      });
    } else {
      const nextBin = path.join(getResourcePath('web-modules'), '.bin', 'next');
      const webDir = getResourcePath('web');
      webProcess = fork(nextBin, ['start', '-p', String(WEB_PORT)], {
        cwd: webDir,
        env: {
          ...process.env,
          NODE_PATH: getResourcePath('web-modules'),
        },
        stdio: 'pipe',
      });
    }

    webProcess.stdout?.on('data', (d) => process.stdout.write(`[web] ${d}`));
    webProcess.stderr?.on('data', (d) => process.stderr.write(`[web] ${d}`));
    webProcess.on('error', reject);

    waitForPort(WEB_PORT).then(resolve).catch(reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Conflict.Game',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${WEB_PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    console.log('Starting Conflict.Game server...');
    await startServer();
    console.log('Server ready on port', SERVER_PORT);

    console.log('Starting web app...');
    // In dev, assume web is already built (next start needs .next)
    // For quick dev testing, user should run `npm run build` in apps/web first
    await startWeb();
    console.log('Web ready on port', WEB_PORT);

    createWindow();
  } catch (err) {
    console.error('Failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (webProcess) {
    webProcess.kill();
    webProcess = null;
  }
});
