/**
 * Módulo CRM — Gestão de Leads, Pipeline e Interações
 * 
 * Este módulo agrupa toda a lógica de negócio do CRM:
 * - Leads (CRUD, importação, estatísticas)
 * - Interações (mensagens, ligações, anotações)
 * - API pública v1 (autenticação por API Key)
 * - Planilhas (importação Excel/CSV)
 */
const express = require('express');
const leadRouter = require('./lead.routes');
const interactionRouter = require('./interaction.routes');
const v1Router = require('./api-v1.routes');

module.exports = {
  name: 'crm',
  label: 'CRM',
  description: 'Gestão de Leads, Pipeline e Interações',
  icon: 'Users',
  register(app) {
    app.use('/api/leads', leadRouter);
    app.use('/api/interactions', interactionRouter);
    app.use('/api/v1', v1Router);
    console.log(`✅ Módulo [crm] registrado em /api/leads, /api/interactions, /api/v1`);
  },
};
