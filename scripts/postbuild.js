const fs = require('fs');
const path = require('path');

// Copiar backend para dist após o build
const source = path.join(__dirname, '..', 'backend');
const dest = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app', 'backend');

console.log(`📦 Post-build: Copiando backend...`);
console.log(`   From: ${source}`);
console.log(`   To: ${dest}`);

// Criar diretório de destino
if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

// Função para copiar diretório recursivamente
function copyDir(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }

  const files = fs.readdirSync(src);
  files.forEach(file => {
    // Ignorar diretórios/arquivos desnecessários
    if (['.env', '.git', '.gitignore', 'dev.db-journal', 'dev.db'].includes(file)) {
      return;
    }

    const srcPath = path.join(src, file);
    const dstPath = path.join(dst, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  });
}

try {
  copyDir(source, dest);
  console.log('✅ Backend copiado com sucesso!');
} catch (err) {
  console.error('❌ Erro ao copiar backend:', err);
  process.exit(1);
}
