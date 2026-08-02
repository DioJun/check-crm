/**
 * GitHub Service — Versionamento/backup dos sites de demonstração
 *
 * Publica o código do site (index.html) num repositório GitHub via API REST,
 * criando o repo (se não existir) e fazendo commit inicial (ou atualização).
 *
 * PAPEL: backup/versionamento do código do site. Se o lead comprar o produto
 * final, este repositório vira a base do projeto.
 *
 * CONFIG: token GitHub (PAT — personal access token) + owner salvos na tabela
 * Configuracao (chave `github:config`). Token criado em github.com/settings/tokens
 * com escopo 'repo'.
 *
 * FLUXO (GitHub API):
 *  1. GET /user → descobre o login (owner)
 *  2. GET /repos/{owner}/{repo} → existe? senão POST /user/repos cria
 *  3. GET /repos/{owner}/{repo}/contents/index.html → SHA do arquivo atual
 *  4. PUT /repos/{owner}/{repo}/contents/index.html → cria/atualiza com Base64
 */
const prisma = require('../../core/lib/prisma');
const { slugify } = require('./site.util');

const GH_API = 'https://api.github.com';
const CHAVE_CONFIG = 'github:config';

/**
 * Carrega a config do GitHub (token + owner).
 */
async function getConfig() {
  let salvo = {};
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CONFIG } });
    if (row && row.valor) {
      salvo = JSON.parse(row.valor);
    }
  } catch (err) {
    console.error('[GitHub] Erro ao ler config salva:', err.message);
  }

  const token = salvo.token || process.env.GITHUB_TOKEN || '';
  return { token, owner: salvo.owner || '' };
}

/**
 * Salva a config do GitHub.
 */
async function saveConfig({ token, owner } = {}) {
  const atual = await getConfig();
  const novo = {
    token: token !== undefined ? token : atual.token,
    owner: owner !== undefined ? owner : atual.owner,
  };

  await prisma.configuracao.upsert({
    where: { chave: CHAVE_CONFIG },
    update: { valor: JSON.stringify(novo) },
    create: { chave: CHAVE_CONFIG, valor: JSON.stringify(novo) },
  });
  return novo;
}

/**
 * Helper: chamada à API do GitHub com o token.
 */
async function ghFetch(path, { method = 'GET', body = null, token } = {}) {
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'checkmate-crm',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = '';
    try { const e = await res.json(); msg = e?.message || `GitHub API error ${res.status}`; }
    catch { msg = `GitHub API error ${res.status}`; }
    const err = new Error(`Falha na API do GitHub: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Descobre o owner (login) do token, se não informado.
 */
async function descobrirOwner(token) {
  const user = await ghFetch('/user', { token });
  return user.login;
}

/**
 * Publica o site no GitHub (cria/atualiza repositório + arquivo index.html).
 * @param {object} site - SiteDemo
 * @param {string} html - HTML do site
 * @param {object} [opts] - { token, owner, repoNome } opcionais (salvos se fornecidos)
 * @returns {{ repoUrl, repo, branch, message }}
 */
async function publicarNoGitHub(site, html, { token, owner, repoNome } = {}) {
  const config = await getConfig();
  const tk = token || config.token;
  if (!tk) {
    const err = new Error('Token do GitHub não configurado. Configure em Configurações (ou env GITHUB_TOKEN).');
    err.status = 400;
    throw err;
  }

  // Owner
  let dono = owner || config.owner;
  if (!dono) {
    dono = await descobrirOwner(tk);
    await saveConfig({ token: tk, owner: dono });
  }

  // Nome do repo (sluggable)
  const repo = repoNome || `demo-${slugify(site.nomeSite || site.lead?.nome || 'site')}`;

  // 1. Verificar se o repo existe; se não, criar
  let repoExiste = true;
  try {
    await ghFetch(`/repos/${dono}/${repo}`, { token: tk });
  } catch {
    repoExiste = false;
  }

  if (!repoExiste) {
    await ghFetch('/user/repos', {
      method: 'POST',
      token: tk,
      body: {
        name: repo,
        description: `Site de demonstração — ${site.nomeSite || ''}`.trim(),
        private: false,
        auto_init: false,
        has_issues: false,
        has_wiki: false,
      },
    });
  }

  // 2. Obter SHA do arquivo atual (se existir)
  let sha = null;
  try {
    const atual = await ghFetch(`/repos/${dono}/${repo}/contents/index.html`, { token: tk });
    sha = atual.sha;
  } catch { sha = null; }

  // 3. Criar/atualizar o arquivo index.html
  const conteudo = Buffer.from(html, 'utf-8').toString('base64');
  const commitMsg = sha ? 'Atualiza site de demonstração' : 'Inicia site de demonstração';
  await ghFetch(`/repos/${dono}/${repo}/contents/index.html`, {
    method: 'PUT',
    token: tk,
    body: {
      message: commitMsg,
      content: conteudo,
      sha: sha || undefined,
    },
  });

  return {
    repoUrl: `https://github.com/${dono}/${repo}`,
    repo: `${dono}/${repo}`,
    branch: 'main',
    message: `Código salvo no GitHub: https://github.com/${dono}/${repo}`,
  };
}

module.exports = {
  getConfig,
  saveConfig,
  publicarNoGitHub,
  descobrirOwner,
};
