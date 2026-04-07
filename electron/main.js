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
  
  // Abrir devtools se houver erro ou estiver em dev
  if (isDev) {
    mainWindow.webContents.openDevTools();
  } else {
    // Em produção, abrir devtools também para debug
    mainWindow.webContents.openDevTools();
  }

  // Log quando página falhar ao carregar
  mainWindow.webContents.on('crashed', () => {
    console.error('[ERROR] Renderer process crashed!');
  });

  mainWindow.webContents.on('failed-to-load', () => {
    console.error('[ERROR] Failed to load page');
  });

  mainWindow.webContents.on('did-fail-preliminary-load', (event, errorCode, errorDescription) => {
    console.error(`[ERROR] Preliminary load failed: ${errorCode} - ${errorDescription}`);
  });

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
    
    // Generate JWT_SECRET once and persist it
    const jwtSecret = require('crypto').randomBytes(32).toString('hex');

    const envContent = [
      `DATABASE_URL="file:${dbPath}"`,
      `JWT_SECRET="${jwtSecret}"`,
      `PORT=3001`,
      `CORS_ORIGIN="http://localhost:5173,http://localhost:3001"`,
    ].join('\n');

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log(`[Backend] .env criado em ${envPath}`);
    console.log(`[Backend] Database em: ${dbPath}`);
  } else {
    console.log('[Backend] .env já existe, usando valores persistidos');
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

/** Garantir que as dependências do backend estão instaladas */
async function ensureBackendDeps() {
  const backendDir = getBackendPath();
  const nodeModulesPath = path.join(backendDir, 'node_modules');
  const packagePath = path.join(backendDir, 'package.json');

  // Verificar se package.json existe
  if (!fs.existsSync(packagePath)) {
    console.error('[Backend] package.json não encontrado em:', packagePath);
    return false;
  }

  // Se node_modules já existe e tem pacotes principais, ok
  if (fs.existsSync(nodeModulesPath)) {
    const expressPath = path.join(nodeModulesPath, 'express');
    const prismaPath = path.join(nodeModulesPath, '.prisma');
    if (fs.existsSync(expressPath)) {
      console.log('[Backend] ✓ node_modules encontrado com dependências');
      return true;
    }
  }

  // Instalar dependências
  console.log('[Backend] 📦 Instalando dependências do backend...');
  console.log('[Backend] Diretório:', backendDir);

  return new Promise((resolve) => {
    // Usar npm.cmd no Windows
    const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const npm = spawn(cmd, ['install', '--production', '--verbose'], {
      cwd: backendDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdoutData = '';
    let stderrData = '';

    if (npm.stdout) {
      npm.stdout.on('data', (data) => {
        const str = data.toString();
        stdoutData += str;
        // Log apenas linhas importantes
        if (str.includes('added') || str.includes('up to date') || str.includes('packages')) {
          console.log('[npm]', str.trim());
        }
      });
    }

    if (npm.stderr) {
      npm.stderr.on('data', (data) => {
        const str = data.toString();
        stderrData += str;
        if (str.includes('ERR!') || str.includes('error')) {
          console.error('[npm ERR]', str.trim());
        }
      });
    }

    npm.on('error', (error) => {
      console.error('[Backend] Erro ao executar npm:', error.message);
      console.error('[Backend] Verifique se Node.js está instalado: https://nodejs.org/');
      resolve(false);
    });

    npm.on('close', (code) => {
      if (code === 0) {
        console.log('[Backend] ✓ Dependências instaladas com sucesso');
        resolve(true);
      } else {
        console.error(`[Backend] ✗ npm install falhou (código ${code})`);
        if (stderrData) console.error('[Backend] Detalhes:', stderrData);
        // Mesmo com erro, deixa tentar usar (pode estar parcialmente instalado)
        resolve(false);
      }
    });
  });
}

/** Run database migrations in production */
async function runDatabaseMigrations() {
  if (isDev) return true; // Skip in dev
  
  const backendDir = getBackendPath();
  console.log('[Database] Executando migrações Prisma...');
  
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const migrate = spawn(cmd, ['prisma', 'migrate', 'deploy', '--skip-generate'], {
      cwd: backendDir,
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    if (migrate.stdout) {
      migrate.stdout.on('data', (data) => {
        output += data.toString();
        const msg = data.toString().trim();
        if (msg && msg.includes('migrations')) console.log('[Database]', msg);
      });
    }
    if (migrate.stderr) {
      migrate.stderr.on('data', (data) => {
        output += data.toString();
        const msg = data.toString().trim();
        if (msg) console.error('[Database]', msg);
      });
    }

    migrate.on('close', (code) => {
      if (code === 0) {
        console.log('[Database] ✓ Migrações aplicadas com sucesso');
        resolve(true);
      } else {
        console.warn('[Database] ⚠️ Aviso na migração (código ' + code + '), continuando...');
        resolve(true); // Continue mesmo com warning
      }
    });

    migrate.on('error', (err) => {
      console.error('[Database] Erro ao executar migração:', err.message);
      resolve(false);
    });
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

  ensureBackendEnv();

  const backendDir = getBackendPath();
  const backendEntry = path.join(backendDir, 'src', 'app.js');

  // Em produção, garantir que as dependências estão instaladas
  if (!isDev) {
    console.log('[Backend] Iniciando check de dependências...');
    const depSuccess = await ensureBackendDeps();
    if (!depSuccess) {
      console.warn('[Backend] ⚠️ npm install retornou erro, tentando mesmo assim...');
    }
    
    // Run database migrations
    console.log('[Backend] Preparando banco de dados...');
    const migSuccess = await runDatabaseMigrations();
    if (!migSuccess) {
      console.warn('[Backend] ⚠️ Migração retornou erro, tentando mesmo assim...');
    }
  }

  if (isDev) {
    // Dev: usar spawn com npm run dev (nodemon)
    console.log('[Backend] Iniciando backend (dev mode)...');
    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: true,
    });
  } else {
    // Produção: fork direto do app.js
    console.log(`[Backend] Iniciando backend (production mode): ${backendEntry}`);
    backendProcess = fork(backendEntry, [], {
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    backendProcess.stdout?.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[backend:out] ${msg}`);
    });
    
    backendProcess.stderr?.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`[backend:err] ${msg}`);
    });
  }

  backendProcess.on('error', (err) => {
    console.error('[Backend] Erro ao iniciar processo:', err.message);
  });

  backendProcess.on('exit', (code, signal) => {
    console.warn(`[Backend] Processo saiu com código ${code} (sinal: ${signal})`);
    backendProcess = null;
  });

  // Aguardar backend ficar pronto (importante: aguarde ANTES de criar window)
  console.log('[Backend] Aguardando backend responder...');
  const ready = await waitForBackend();
  if (!ready) {
    console.warn('[Backend] ⚠️ Backend não respondeu após 30s. Continuando mesmo assim...');
    console.warn('[Backend] Verifique se há erros acima. Pode precisar instalar Node.js.');
  } else {
    console.log('[Backend] ✅ Backend online e pronto!');
  }
}

app.on('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Electron app iniciando...');
  console.log('Environment:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');
  console.log('Backend path:', getBackendPath());
  console.log('='.repeat(60) + '\n');
  
  // Iniciar backend (ou verificar se já está rodando)
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
