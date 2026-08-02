/**
 * Deploy Service — Publicação de sites de demonstração no Vercel
 *
 * Usa a API de deploy direto da Vercel (POST /v13/deployments) enviando os
 * arquivos do site (index.html) — sem precisar de git push intermediário.
 *
 * CONFIG: token Vercel + teamId opcional salvos na tabela Configuracao
 * (chave `vercel:config`). O token é criado em vercel.com/account/tokens.
 *
 * FLUXO:
 *  1. Lê token da config (ou env VERCE_ACCESS_TOKEN como fallback)
 *  2. Monta payload com os arquivos (index.html + vercel.json p/ SPA)
 *  3. POST https://api.vercel.com/v13/deployments
 *  4. Retorna o link público (https://<projeto>.vercel.app)
 */
const prisma = require('../../core/lib/prisma');
const { slugify } = require('./site.util');

const VERCE_API = 'https://api.vercel.com';
const CHAVE_CONFIG = 'vercel:config';

/**
 * Carrega a config do Vercel (token + teamId).
 */
async function getConfig() {
  let salvo = {};
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CONFIG } });
    if (row && row.valor) {
      salvo = JSON.parse(row.valor);
    }
  } catch (err) {
    console.error('[Vercel] Erro ao ler config salva:', err.message);
  }

  const token = salvo.token || process.env.VERCEL_ACCESS_TOKEN || '';
  return { token, teamId: salvo.teamId || '' };
}

/**
 * Salva a config do Vercel.
 */
async function saveConfig({ token, teamId } = {}) {
  const atual = await getConfig();
  const novo = {
    token: token !== undefined ? token : atual.token,
    teamId: teamId !== undefined ? teamId : atual.teamId,
  };

  await prisma.configuracao.upsert({
    where: { chave: CHAVE_CONFIG },
    update: { valor: JSON.stringify(novo) },
    create: { chave: CHAVE_CONFIG, valor: JSON.stringify(novo) },
  });
  return novo;
}

/**
 * Monta o payload de arquivos para o deploy.
 * @param {string} html - conteúdo do index.html
 * @param {string} nomeSite - usado no nome do projeto (slug)
 */
function buildFiles(html, nomeSite) {
  const slug = slugify(nomeSite) || 'site-demo';
  const prefix = 'demo-' + slug;

  return {
    files: [
      { file: 'index.html', data: html },
      {
        file: 'vercel.json',
        data: JSON.stringify({
          cleanUrls: true,
          headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }],
        }),
      },
    ],
    name: prefix,
    project: prefix,
    target: 'production',
    // Obrigatório para novos projetos: descreve o framework/estático
    projectSettings: {
      framework: null, // null = estático/Other (sem framework)
      buildCommand: null,
      devCommand: null,
      installCommand: null,
      outputDirectory: null,
    },
  };
}

/**
 * Faz o deploy direto na Vercel.
 * @param {object} site - SiteDemo
 * @param {string} html - HTML do site a publicar
 * @returns {{ link: string, url: string, status: string }}
 */
async function deploy(site, html) {
  const { token, teamId } = await getConfig();
  if (!token) {
    const err = new Error('Token do Vercel não configurado. Configure em Configurações (ou env VERCEL_ACCESS_TOKEN).');
    err.status = 400;
    throw err;
  }

  const payload = buildFiles(html, site.nomeSite || site.lead?.nome || 'site-demo');
  const url = teamId
    ? `${VERCE_API}/v13/deployments?teamId=${encodeURIComponent(teamId)}`
    : `${VERCE_API}/v13/deployments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = '';
    try { const e = await res.json(); msg = e?.error?.message || e?.error?.code || `Vercel API error ${res.status}`; }
    catch { msg = `Vercel API error ${res.status}`; }
    const err = new Error(`Falha no deploy Vercel: ${msg}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const urlDeploy = data.url || '';
  const link = urlDeploy ? `https://${urlDeploy}` : '';

  return { link, url: urlDeploy, status: data.status || 'queued', readyState: data.readyState };
}

/**
 * Consulta o status de um deploy pelo ID (polling opcional).
 */
async function getDeployStatus(deployId, token) {
  const t = token || (await getConfig()).token;
  if (!t || !deployId) return null;

  const res = await fetch(`${VERCE_API}/v13/deployments/${deployId}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Remove um deploy do Vercel (usado quando o site de demo é removido).
 */
async function removeDeploy(site, token) {
  const t = token || (await getConfig()).token;
  if (!t) return false;
  try {
    const res = await fetch(`${VERCE_API}/v9/projects/${encodeURIComponent(site.nomeProjeto || '')}/deployments`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data = await res.json();
      // Remove o deploy de produção mais recente do projeto
      for (const d of (data.deployments || []).slice(0, 5)) {
        await fetch(`${VERCE_API}/v13/deployments/${d.uid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${t}` },
        });
      }
    }
    return true;
  } catch (err) {
    console.error('[Vercel] Erro ao remover deploy:', err.message);
    return false;
  }
}

module.exports = {
  getConfig,
  saveConfig,
  deploy,
  getDeployStatus,
  removeDeploy,
  buildFiles,
};
