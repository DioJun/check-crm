const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

function getBackendPath() {
  return path.join(__dirname, '..', 'backend');
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

  // Configurar CSP para evitar warning de segurança
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:3001 ws://localhost:5173; font-src 'self' data:;"
        ]
      }
    });
  });

  // Carregar frontend do Vite dev server
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('crashed', () => {
    console.error('[ERROR] Renderer process crashed!');
  });

  mainWindow.webContents.on('failed-to-load', () => {
    console.error('[ERROR] Failed to load page');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
async function waitForBackend(maxAttempts = 60, delayMs = 500) {
  console.log('[Backend] Polling backend em http://localhost:3001/health...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:3001/health', { timeout: 2000 });
      if (response.ok) {
        console.log(`[Backend] ✓ Backend respondeu (tentativa ${i + 1}/${maxAttempts})`);
        return true;
      }
    } catch (err) {
      // Retry silenciosamente
    }
    
    const elapsed = ((i + 1) * delayMs / 1000).toFixed(1);
    process.stderr.write(`[Backend] Tentativa ${i + 1}/${maxAttempts} (${elapsed}s)...\r`);
    await new Promise(r => setTimeout(r, delayMs));
  }

  console.error('\n[Backend] ✗ Backend não respondeu após 30 segundos');
  console.error('[Backend] Possíveis causas:');
  console.error('  1. Node.js não está instalado');
  console.error('  2. Dependências (npm) não instalaram corretamente');
  console.error('  3. Erro na inicialização do Express/Prisma');
  return false;
}

// Iniciar backend Node.js
async function startBackend() {
  // Verificar se o backend já está rodando
  if (await checkBackendRunning()) {
    console.log('[Backend] ✓ Backend já está rodando na porta 3001');
    return;
  }

  const backendDir = getBackendPath();
  
  console.log('[Backend] Iniciando backend com nodemon...');
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
  });

  backendProcess.on('error', (err) => {
    console.error('[Backend] Erro ao iniciar processo:', err.message);
  });

  backendProcess.on('exit', (code, signal) => {
    console.warn(`[Backend] Processo saiu com código ${code} (sinal: ${signal})`);
    backendProcess = null;
  });

  // Aguardar backend ficar pronto
  console.log('[Backend] Aguardando backend responder...');
  const ready = await waitForBackend();
  if (!ready) {
    console.warn('[Backend] ⚠️ Backend não respondeu após 30s. Continuando mesmo assim...');
  } else {
    console.log('[Backend] ✓ Backend respondendo normalmente');
  }
}

app.on('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Checkmate CRM - Desktop');
  console.log('='.repeat(60) + '\n');
  
  process.env.IS_ELECTRON = 'true';
  
  // Iniciar backend
  await startBackend();
  
  // Criar janela principal
  console.log('[App] Criando janela principal...');
  createWindow();
  require('./ipc-handlers.js');
  console.log('[App] ✅ App pronto!\n');
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
