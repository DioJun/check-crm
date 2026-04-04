const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const fs = require('fs');

// Detectar ambiente de desenvolvimento
const isDev = !app.isPackaged;

let mainWindow;
let backendProcess;

// Em produção, backend fica em extraResources (fora do asar)
function getBackendPath() {
  if (isDev) return path.join(__dirname, '..', 'backend');
  return path.join(process.resourcesPath, 'backend');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Checkmate - CRM',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  // Em desenvolvimento: carregar localhost React
  // Em produção: carregar build estático (loadFile resolve asar automaticamente)
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // __dirname em prod = resources/app.asar/electron/, logo ../frontend/dist/ resolve dentro do asar
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    console.log(`Loading file: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Garantir que o .env existe no backend (para produção).
 * Se não existir, cria com valores padrão usando userData como DB path.
 */
function ensureBackendEnv() {
  const backendDir = getBackendPath();
  const envPath = path.join(backendDir, '.env');

  if (!fs.existsSync(envPath)) {
    // Em produção, colocar o DB no diretório de dados do usuário
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'checkmate.db').replace(/\\/g, '/');

    const envContent = [
      `DATABASE_URL="file:${dbPath}"`,
      `JWT_SECRET="${require('crypto').randomBytes(32).toString('hex')}"`,
      `PORT=3001`,
      `CORS_ORIGIN="http://localhost:5173,http://localhost:3001"`,
    ].join('\n');

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log(`[Prod] .env criado em ${envPath}`);
    console.log(`[Prod] Database em: ${dbPath}`);
  }
}

/** Verificar se backend já está rodando na porta 3001 */
function checkBackendRunning() {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

/** Aguardar até o backend responder (polling) */
async function waitForBackend(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkBackendRunning()) {
      console.log(`Backend respondendo (tentativa ${i + 1})`);
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// Iniciar backend Node.js
async function startBackend() {
  // Verificar se o backend já está rodando
  if (await checkBackendRunning()) {
    console.log('Backend já está rodando na porta 3001');
    return;
  }

  ensureBackendEnv();

  const backendDir = getBackendPath();
  const backendEntry = path.join(backendDir, 'src', 'app.js');

  if (isDev) {
    // Dev: usar spawn com npm run dev (nodemon)
    console.log('Iniciando backend (dev)...');
    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: true,
    });
  } else {
    // Produção: fork direto do app.js (de app.asar.unpacked)
    console.log(`Iniciando backend (prod): ${backendEntry}`);
    backendProcess = fork(backendEntry, [], {
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    backendProcess.stdout?.on('data', (d) => console.log(`[backend] ${d}`));
    backendProcess.stderr?.on('data', (d) => console.error(`[backend] ${d}`));
  }

  backendProcess.on('error', (err) => {
    console.error('Erro ao iniciar backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend saiu com código ${code}`);
    backendProcess = null;
  });

  // Aguardar backend ficar pronto
  const ready = await waitForBackend();
  if (!ready) {
    console.error('Backend não respondeu após 10s. Continuando mesmo assim...');
  }
}

app.on('ready', async () => {
  console.log('Electron app ready');
  
  // Iniciar backend (ou verificar se já está rodando)
  await startBackend();
  
  // Criar janela principal
  createWindow();
  require('./ipc-handlers.js');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Criar menu
const template = [
  {
    label: 'Arquivo',
    submenu: [
      {
        label: 'Sair',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          if (backendProcess) {
            backendProcess.kill();
          }
          app.quit();
        },
      },
    ],
  },
  {
    label: 'Editar',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ],
  },
  {
    label: 'Exibir',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
