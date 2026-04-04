const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Detectar ambiente de desenvolvimento
const isDev = !app.isPackaged;

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Checkmate - CRM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  // Em desenvolvimento: carregar localhost React
  // Em produção: carregar build estático
  const startUrl = isDev 
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;
  
  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Iniciar backend Node.js (apenas se não estiver rodando separadamente)
async function startBackend() {
  // Verificar se o backend já está rodando
  try {
    const http = require('http');
    await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3001/health', (res) => {
        if (res.statusCode === 200) {
          console.log('Backend já está rodando na porta 3001');
          resolve(true);
        } else {
          reject(new Error('Backend não respondeu corretamente'));
        }
      });
      req.on('error', () => reject(new Error('Backend não encontrado')));
      req.setTimeout(1000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
    return; // Backend já rodando, não precisa spawnar
  } catch (e) {
    // Backend não está rodando, vamos iniciar
  }

  console.log('Iniciando backend...');
  const backendPath = path.join(__dirname, '../backend');
  
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendPath,
    stdio: 'inherit',
    shell: true,
  });

  backendProcess.on('error', (err) => {
    console.error('Erro ao iniciar backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend saiu com código ${code}`);
  });

  // Aguardar backend iniciar
  await new Promise(resolve => setTimeout(resolve, 3000));
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
    if (backendProcess) {
      backendProcess.kill();
    }
    app.quit();
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
