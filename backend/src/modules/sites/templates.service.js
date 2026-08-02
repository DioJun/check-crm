/**
 * Templates Service — 7 templates de sites de demonstração
 *
 * Cada template gera um index.html COMPLETO e autossuficiente
 * (CSS + JS embutidos) — pronto para deploy estático (Vercel) ou preview.
 *
 * Regra de ouro: são sites de AMOSTRA para vender o produto final.
 * Todos os templates têm:
 *  - Design responsivo (mobile-first — o lead abre pelo celular)
 *  - Botão flutuante de WhatsApp com o número real do lead
 *  - Placeholders {{...}} que são preenchidos com os dados do lead
 *  - Beacon de tracking (POST para o endpoint configurado, se houver)
 */
const { normalizeTelefone } = require('./site.util');

// ============ DADOS DE CONTEXTO ============
// Coleta dados relevantes do lead para preencher o template

function buildContext(site, lead) {
  const nomeSite = site.nomeSite || (lead && lead.nome ? lead.nome.split(' ')[0] : 'Seu Negócio');
  const servico = (site && site.ramo) || (lead && lead.servico) || 'serviços de qualidade';
  const cidade = (lead && lead.cidade) || 'sua região';
  const instagram = (lead && lead.instagram) || '';
  const telefone = normalizeTelefone((lead && lead.telefone) || '');
  const cor = site.cor || '#d4af37';
  const tom = site.tom || 'moderno';
  // Tracking: siteId real + endpoint público (se configurado via env SITES_TRACKER_URL)
  const siteId = (site && site.id) || '';
  const trackerUrl = process.env.SITES_TRACKER_URL || '';

  return { nomeSite, servico, cidade, instagram, telefone, cor, tom, siteId, trackerUrl };
}

// ============ COMPONENTES REUTILIZÁVEIS ============

// ============ BASE HTML/CSS ============

const BASE_CSS = `
  :root {
    --primaria: {{cor}};
    --primaria-escura: {{corEscura}};
    --texto: #1f2937;
    --texto-suave: #6b7280;
    --fundo: #ffffff;
    --fundo-suave: #f9fafb;
    --raio: 16px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: var(--texto);
    background: var(--fundo);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 960px; margin: 0 auto; padding: 0 20px; }

  /* Header */
  .header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #e5e7eb;
  }
  .header-inner { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; max-width: 960px; margin: 0 auto; }
  .brand { font-weight: 800; font-size: 1.15rem; color: var(--texto); }
  .brand span { color: var(--primaria); }
  .nav-links { display: flex; gap: 18px; list-style: none; }
  .nav-links a { text-decoration: none; color: var(--texto-suave); font-size: 0.9rem; font-weight: 500; }
  .nav-links a:hover { color: var(--primaria); }

  /* Hero */
  .hero {
    padding: 56px 20px 48px;
    background: linear-gradient(180deg, {{corClara}} 0%, #ffffff 100%);
    text-align: center;
  }
  .hero h1 { font-size: 2.1rem; font-weight: 800; color: var(--texto); margin-bottom: 12px; line-height: 1.2; }
  .hero h1 em { font-style: normal; color: var(--primaria); }
  .hero p { font-size: 1.05rem; color: var(--texto-suave); max-width: 560px; margin: 0 auto 24px; }
  .hero-cta {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--primaria); color: #fff;
    padding: 13px 28px; border-radius: 999px;
    font-weight: 600; font-size: 1rem; text-decoration: none;
    box-shadow: 0 6px 20px {{corSombra}};
    transition: transform 0.15s, box-shadow 0.15s;
    border: none; cursor: pointer;
  }
  .hero-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 28px {{corSombra}}; }

  /* Seções */
  .section { padding: 48px 20px; }
  .section-alt { background: var(--fundo-suave); }
  .section-title { font-size: 1.5rem; font-weight: 700; text-align: center; margin-bottom: 8px; }
  .section-sub { text-align: center; color: var(--texto-suave); margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 900px) { .grid-3 { grid-template-columns: repeat(3, 1fr); } }
  .card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: var(--raio);
    padding: 22px; transition: transform 0.15s, box-shadow 0.15s;
  }
  .card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
  .card .icone { font-size: 1.8rem; margin-bottom: 8px; }
  .card h3 { font-size: 1.05rem; margin-bottom: 6px; }
  .card p { font-size: 0.92rem; color: var(--texto-suave); }
  .card .preco { font-weight: 700; color: var(--primaria); margin-top: 10px; font-size: 1.05rem; }

  /* Sobre */
  .sobre { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: center; }
  @media (min-width: 768px) { .sobre { grid-template-columns: 1fr 1fr; } }
  .sobre h2 { font-size: 1.4rem; margin-bottom: 12px; }
  .sobre p { color: var(--texto-suave); margin-bottom: 12px; }
  .selo { display: inline-flex; align-items: center; gap: 6px; background: var(--fundo-suave); border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 14px; font-size: 0.85rem; color: var(--texto); margin: 4px 6px 0 0; }

  /* Depoimentos */
  .depoimento { background: #fff; border: 1px solid #e5e7eb; border-radius: var(--raio); padding: 20px; }
  .depoimento .estrelas { color: #f59e0b; letter-spacing: 2px; margin-bottom: 8px; }
  .depoimento p { font-size: 0.92rem; color: var(--texto-suave); font-style: italic; }
  .depoimento .autor { font-weight: 600; color: var(--texto); font-style: normal; margin-top: 8px; font-size: 0.88rem; }

  /* Contato / CTA final */
  .cta-final {
    background: var(--primaria); color: #fff; text-align: center;
    padding: 48px 20px; border-radius: 0;
  }
  .cta-final h2 { font-size: 1.6rem; margin-bottom: 10px; }
  .cta-final p { opacity: 0.92; margin-bottom: 20px; }
  .cta-final .btn-branco {
    display: inline-flex; align-items: center; gap: 8px;
    background: #fff; color: var(--primaria-escura);
    padding: 13px 28px; border-radius: 999px; font-weight: 700;
    text-decoration: none; border: none; cursor: pointer;
  }

  /* Footer */
  .footer { background: #111827; color: #9ca3af; text-align: center; padding: 24px 20px; font-size: 0.85rem; }
  .footer strong { color: #fff; }
  .footer a { color: var(--primaria); text-decoration: none; }

  /* Botão flutuante WhatsApp */
  .wa-float {
    position: fixed; bottom: 20px; right: 20px; z-index: 100;
    width: 58px; height: 58px; border-radius: 50%;
    background: #25d366; color: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(37,211,102,0.4);
    border: none; cursor: pointer;
    animation: wa-pulse 2s infinite;
  }
  @keyframes wa-pulse {
    0% { box-shadow: 0 0 0 0 rgba(37,211,102,0.4); }
    70% { box-shadow: 0 0 0 14px rgba(37,211,102,0); }
    100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); }
  }
  .wa-float svg { width: 30px; height: 30px; fill: #fff; }

  .hero-social { display: flex; gap: 10px; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
  .hero-social a {
    display: inline-flex; align-items: center; gap: 6px;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 999px;
    padding: 8px 16px; font-size: 0.88rem; color: var(--texto); text-decoration: none;
  }
  .hero-social a:hover { border-color: var(--primaria); }
`;

// ============ CONSTRUÇÃO DO HTML ============

function buildHtml(templateId, dados, overrides = {}) {
  const { nomeSite, servico, cidade, instagram, telefone, cor, tom, siteId = '', trackerUrl = '' } = dados;

  // Variações de cor para gradientes/sombras
  const corEscura = darken(cor, 0.18);
  const corClara = lighten(cor, 0.86);
  const corSombra = hexToRgba(cor, 0.35);

  const ctx = {
    cor, corEscura, corClara, corSombra,
    nomeSite, servico, cidade, instagram, telefone, tom,
  };

  const css = BASE_CSS
    .replaceAll('{{cor}}', cor)
    .replaceAll('{{corEscura}}', corEscura)
    .replaceAll('{{corClara}}', corClara)
    .replaceAll('{{corSombra}}', corSombra);

  // Conteúdo base do template, sobrescrito pelos overrides da IA (se houver)
  const baseSecoes = TEMPLATE_SECTIONS[templateId].build(ctx);
  const secoes = { ...baseSecoes, ...overrides };
  const waMensagem = overrides.waMensagem || TEMPLATE_SECTIONS[templateId].waMensagem(ctx);

  const js = `
  // Mensagem padrão ao clicar no WhatsApp
  window.__WA_MSG__ = ${JSON.stringify(waMensagem)};
  document.querySelectorAll('[data-wa]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const msg = encodeURIComponent(window.__WA_MSG__);
      window.open('https://wa.me/${telefone}?text=' + msg, '_blank');
    });
  });
  // Beacon de tracking (visita registrada no CRM quando há endpoint público)
  // O site de demo roda no Vercel; o backend pode rodar em localhost. Para tracking
  // automático, configure SITES_TRACKER_URL (ex: https://seu-backend.com/api).
  // Sem endpoint público, o dono usa o botão "Marcar como visto" no painel.
  (function () {
    try {
      var siteId = ${JSON.stringify(siteId)};
      var tracker = ${JSON.stringify(trackerUrl)};
      if (siteId && tracker) {
        navigator.sendBeacon(tracker + '/sites/' + siteId + '/visita', JSON.stringify({ origem: 'site-demo' }));
      }
    } catch (e) {}
  })();
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${nomeSite} — ${servico} em ${cidade}</title>
  <meta name="description" content="${nomeSite} — ${servico} em ${cidade}. Fale conosco pelo WhatsApp." />
  <style>${css}</style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <div class="brand">${nomeSite.split(' ')[0]}<span>.</span></div>
      <ul class="nav-links">
        <li><a href="#servicos">Serviços</a></li>
        <li><a href="#sobre">Sobre</a></li>
        <li><a href="#contato">Contato</a></li>
      </ul>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <h1>${secoes.heroTitulo}</h1>
      <p>${secoes.heroSub}</p>
      <button class="hero-cta" data-wa>💬 ${secoes.heroCta}</button>
      <div class="hero-social">
        ${instagram ? `<a href="https://instagram.com/${instagram.replace('@', '')}" target="_blank" rel="noreferrer">📸 @${instagram.replace('@', '')}</a>` : ''}
        ${cidade ? `<span class="selo">📍 ${cidade}</span>` : ''}
      </div>
    </div>
  </section>

  <!-- Serviços -->
  <section class="section" id="servicos">
    <div class="container">
      <h2 class="section-title">${secoes.servicosTitulo}</h2>
      <p class="section-sub">${secoes.servicosSub}</p>
      <div class="grid grid-3">
        ${secoes.servicos.map((s) => `
          <div class="card">
            <div class="icone">${s.icone}</div>
            <h3>${s.nome}</h3>
            <p>${s.desc}</p>
            ${s.preco ? `<div class="preco">${s.preco}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- Sobre -->
  <section class="section section-alt" id="sobre">
    <div class="container">
      <div class="sobre">
        <div>
          <h2>${secoes.sobreTitulo}</h2>
          <p>${secoes.sobreTexto}</p>
          <div>
            ${secoes.selos.map((s) => `<span class="selo">${s}</span>`).join('')}
          </div>
        </div>
        <div class="grid">
          ${secoes.depoimentos.map((d) => `
            <div class="depoimento">
              <div class="estrelas">★★★★★</div>
              <p>"${d.texto}"</p>
              <div class="autor">— ${d.autor}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </section>

  <!-- Contato -->
  <section class="cta-final" id="contato">
    <h2>${secoes.ctaTitulo}</h2>
    <p>${secoes.ctaTexto}</p>
    <button class="btn-branco" data-wa>📲 ${secoes.ctaBotao}</button>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <p><strong>${nomeSite}</strong> — ${servico} em ${cidade}</p>
    <p style="margin-top:6px;">© ${new Date().getFullYear()} · Todos os direitos reservados</p>
  </footer>

  <!-- Botão flutuante WhatsApp -->
  <button class="wa-float" data-wa aria-label="Falar no WhatsApp">
    <svg viewBox="0 0 32 32"><path d="M16.004 3C8.834 3 3 8.834 3 16.004c0 2.293.6 4.532 1.74 6.502L3 29l6.638-1.726a12.94 12.94 0 0 0 6.366 1.624h.005c7.17 0 13.004-5.834 13.004-13.004C28.99 8.834 23.174 3 16.004 3zm0 23.66h-.004a10.7 10.7 0 0 1-5.45-1.493l-.39-.232-3.94 1.024 1.05-3.842-.254-.39a10.65 10.65 0 0 1-1.635-5.702c0-5.923 4.82-10.743 10.75-10.743 2.87 0 5.567 1.118 7.594 3.148a10.68 10.68 0 0 1 3.145 7.605c-.001 5.924-4.82 10.625-10.866 10.625zm5.894-8.05c-.323-.162-1.91-.943-2.207-1.05-.297-.108-.513-.162-.73.162-.216.323-.836 1.05-1.026 1.265-.189.216-.378.243-.701.081-.323-.162-1.363-.502-2.596-1.602-.96-.856-1.608-1.914-1.796-2.237-.189-.323-.02-.498.142-.659.145-.145.324-.378.486-.567.162-.189.216-.324.324-.54.108-.216.054-.405-.027-.567-.081-.162-.73-1.76-1-2.41-.263-.633-.53-.547-.73-.557l-.62-.011c-.216 0-.567.081-.864.405-.297.323-1.134 1.108-1.134 2.703s1.161 3.135 1.323 3.352c.162.216 2.285 3.49 5.537 4.893.774.335 1.377.535 1.848.684.776.248 1.482.213 2.04.13.622-.094 1.91-.78 2.179-1.535.269-.754.269-1.4.188-1.535-.081-.135-.297-.216-.62-.378z"/></svg>
  </button>

  <script>${js}</script>
</body>
</html>`;
}

// ============ CONTEÚDO POR RAMO ============

const TEMPLATE_SECTIONS = {
  barbearia: {
    build(ctx) {
      return {
        heroTitulo: `Estilo de verdade para <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `Corte, barba e cuidado de primeira em ${ctx.cidade}. Agende seu horário agora mesmo.`,
        heroCta: 'Agendar pelo WhatsApp',
        servicosTitulo: 'Nossos serviços',
        servicosSub: 'Tudo para você sair renovado',
        servicos: [
          { icone: '✂️', nome: 'Corte de cabelo', desc: 'Corte moderno e tradicional com finalização completa.', preco: 'R$ 45' },
          { icone: '🪒', nome: 'Barba completa', desc: 'Navalha, toalha quente e alinhamento impecável.', preco: 'R$ 35' },
          { icone: '🧔', nome: 'Corte + Barba', desc: 'Combinação completa com desconto especial.', preco: 'R$ 70' },
          { icone: '💈', nome: 'Sobrancelha', desc: 'Alinhamento e desenho para valorizar o visual.', preco: 'R$ 15' },
        ],
        sobreTitulo: 'Sobre a gente',
        sobreTexto: `Somos especialistas em estilo masculino em ${ctx.cidade}. Atendimento agendado, ambiente confortável e produtos de qualidade.`,
        selos: ['💈 Ambiente moderno', '⏱️ Horário agendado', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Melhor corte da cidade, saio sempre renovado!', autor: 'Rafael S.' },
          { texto: 'Atendimento impecável e ambiente muito agradável.', autor: 'Bruno M.' },
        ],
        ctaTitulo: 'Agende seu horário',
        ctaTexto: 'Chame no WhatsApp e garanta seu horário hoje mesmo.',
        ctaBotao: 'Chamar no WhatsApp',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e gostaria de agendar um horário.`;
    },
  },

  restaurante: {
    build(ctx) {
      return {
        heroTitulo: `Comida boa de verdade em <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `Delivery e retirada em ${ctx.cidade}. Peça pelo WhatsApp e receba em casa.`,
        heroCta: 'Pedir pelo WhatsApp',
        servicosTitulo: 'Cardápio',
        servicosSub: 'Os favoritos da casa',
        servicos: [
          { icone: '🍕', nome: 'Pizza especial', desc: 'Massa artesanal e ingredientes selecionados.', preco: 'R$ 49,90' },
          { icone: '🍔', nome: 'Burger artesanal', desc: 'Pão brioche, burger 180g e queijo derretido.', preco: 'R$ 32,90' },
          { icone: '🥗', nome: 'Prato executivo', desc: 'Refeição completa com opções do dia.', preco: 'R$ 28,90' },
          { icone: '🥤', nome: 'Bebidas & sobremesas', desc: 'Sucos naturais, refrigerantes e doces da casa.', preco: 'R$ 8,90' },
        ],
        sobreTitulo: 'Nossa história',
        sobreTexto: `Tradição e sabor em ${ctx.cidade}. Cozinha caseira, ingredientes frescos e entrega rápida.`,
        selos: ['🚴 Delivery', '🥡 Retirada', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Entrega rápida e comida sempre deliciosa!', autor: 'Camila R.' },
          { texto: 'A pizza é simplesmente a melhor da região.', autor: 'Diego T.' },
        ],
        ctaTitulo: 'Peça agora',
        ctaTexto: 'Faça seu pedido pelo WhatsApp e receba em casa.',
        ctaBotao: 'Fazer pedido',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e quero fazer um pedido.`;
    },
  },

  advocacia: {
    build(ctx) {
      return {
        heroTitulo: `Consultoria jurídica de confiança — <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `Atendimento especializado em ${ctx.cidade}. Suporte próximo e transparente em cada etapa.`,
        heroCta: 'Agendar consulta',
        servicosTitulo: 'Áreas de atuação',
        servicosSub: 'Soluções jurídicas sob medida',
        servicos: [
          { icone: '⚖️', nome: 'Direito Civil', desc: 'Contratos, indenizações e relações de consumo.' },
          { icone: '🏢', nome: 'Direito Trabalhista', desc: 'Reclamações, acordos e assessoria ao empregador.' },
          { icone: '👨‍👩‍👧', nome: 'Direito de Família', desc: 'Divórcios, guarda, pensão e inventários.' },
          { icone: '📄', nome: 'Consultoria preventiva', desc: 'Análise de contratos e proteção do seu negócio.' },
        ],
        sobreTitulo: 'Compromisso com você',
        sobreTexto: `Atuação dedicada e ética em ${ctx.cidade}. Atendimento humanizado, prazos respeitados e comunicação clara.`,
        selos: ['🛡️ Sigilo profissional', '⚖️ Ética', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Profissionalismo e atenção em todo o processo.', autor: 'Cliente A.' },
          { texto: 'Resolveu meu caso com rapidez e transparência.', autor: 'Cliente B.' },
        ],
        ctaTitulo: 'Fale com um especialista',
        ctaTexto: 'Agende uma consulta e receba orientação jurídica personalizada.',
        ctaBotao: 'Agendar consulta',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e gostaria de agendar uma consulta.`;
    },
  },

  clinica: {
    build(ctx) {
      return {
        heroTitulo: `Cuidado com a sua saúde em <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `Atendimento especializado em ${ctx.cidade}. Agende sua avaliação e receba o melhor cuidado.`,
        heroCta: 'Agendar avaliação',
        servicosTitulo: 'Especialidades',
        servicosSub: 'Tratamentos e cuidados de qualidade',
        servicos: [
          { icone: '🦷', nome: 'Odontologia', desc: 'Consultas, limpezas e tratamentos completos.', preco: 'a partir de R$ 120' },
          { icone: '💆‍♀️', nome: 'Estética', desc: 'Procedimentos estéticos com profissionais qualificados.', preco: 'a partir de R$ 150' },
          { icone: '🩺', nome: 'Clínica geral', desc: 'Consultas e acompanhamento de saúde.', preco: 'a partir de R$ 180' },
          { icone: '💅', nome: 'Podologia', desc: 'Tratamento de unhas e pés com cuidado especializado.', preco: 'a partir de R$ 90' },
        ],
        sobreTitulo: 'Nossa equipe',
        sobreTexto: `Profissionais qualificados e estrutura moderna em ${ctx.cidade}. Seu bem-estar é a nossa prioridade.`,
        selos: ['👩‍⚕️ Equipe qualificada', '🏥 Estrutura moderna', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Atendimento excelente e muito acolhedor.', autor: 'Mariana L.' },
          { texto: 'Profissionais atenciosos e consultório impecável.', autor: 'Carlos E.' },
        ],
        ctaTitulo: 'Agende seu horário',
        ctaTexto: 'Chame no WhatsApp e agende sua avaliação agora.',
        ctaBotao: 'Agendar avaliação',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e gostaria de agendar uma avaliação.`;
    },
  },

  personal: {
    build(ctx) {
      return {
        heroTitulo: `Transforme seu corpo com <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `Treinos personalizados em ${ctx.cidade}. Resultados de verdade com acompanhamento próximo.`,
        heroCta: 'Começar agora',
        servicosTitulo: 'Planos',
        servicosSub: 'Escolha o que combina com você',
        servicos: [
          { icone: '🏋️', nome: 'Personal presencial', desc: 'Treinos individuais com acompanhamento total.', preco: 'R$ 300/mês' },
          { icone: '📱', nome: 'Consultoria online', desc: 'Treinos e dieta via app com suporte semanal.', preco: 'R$ 150/mês' },
          { icone: '🥗', nome: 'Plano alimentar', desc: 'Cardápio ajustado ao seu objetivo.', preco: 'R$ 200' },
          { icone: '💪', nome: 'Avaliação física', desc: 'Medidas, composição corporal e metas.', preco: 'R$ 80' },
        ],
        sobreTitulo: 'Metodologia que funciona',
        sobreTexto: `Treino inteligente, constância e acompanhamento próximo em ${ctx.cidade}. Seu resultado começa aqui.`,
        selos: ['🎯 Foco em resultado', '📊 Acompanhamento', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Perdi 10kg em 4 meses com acompanhamento!', autor: 'Fernanda P.' },
          { texto: 'Treino personalizado que respeita meu ritmo.', autor: 'Lucas A.' },
        ],
        ctaTitulo: 'Comece sua transformação',
        ctaTexto: 'Chame no WhatsApp e agende sua avaliação gratuita.',
        ctaBotao: 'Começar agora',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e quero começar a treinar.`;
    },
  },

  loja: {
    build(ctx) {
      return {
        heroTitulo: `Compre fácil em <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `Produtos selecionados em ${ctx.cidade}. Peça pelo WhatsApp e receba onde quiser.`,
        heroCta: 'Comprar pelo WhatsApp',
        servicosTitulo: 'Produtos em destaque',
        servicosSub: 'Os queridinhos da loja',
        servicos: [
          { icone: '👗', nome: 'Moda feminina', desc: 'Peças novas toda semana.', preco: 'a partir de R$ 59,90' },
          { icone: '👕', nome: 'Moda masculina', desc: 'Estilo e conforto para o dia a dia.', preco: 'a partir de R$ 49,90' },
          { icone: '🛍️', nome: 'Acessórios', desc: 'Complete seu look com estilo.', preco: 'a partir de R$ 19,90' },
          { icone: '🎁', nome: 'Ofertas da semana', desc: 'Promoções imperdíveis por tempo limitado.', preco: 'até 50% OFF' },
        ],
        sobreTitulo: 'Sobre a loja',
        sobreTexto: `Variedade, qualidade e bom atendimento em ${ctx.cidade}. Compra fácil e entrega rápida.`,
        selos: ['🚚 Entrega', '💳 Parcelamos', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Produtos lindos e entrega super rápida!', autor: 'Juliana C.' },
          { texto: 'Atendimento nota 10, recomendo demais.', autor: 'Pedro V.' },
        ],
        ctaTitulo: 'Garanta já o seu',
        ctaTexto: 'Fale com a gente no WhatsApp e finalize seu pedido.',
        ctaBotao: 'Comprar agora',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e quero saber mais sobre os produtos.`;
    },
  },

  servico: {
    build(ctx) {
      return {
        heroTitulo: `Soluções de qualidade com <em>${ctx.nomeSite.split(' ')[0]}</em>`,
        heroSub: `${ctx.servico} com atendimento de excelência em ${ctx.cidade}. Peça um orçamento sem compromisso.`,
        heroCta: 'Pedir orçamento',
        servicosTitulo: 'O que oferecemos',
        servicosSub: 'Soluções sob medida para você',
        servicos: [
          { icone: '🛠️', nome: 'Atendimento personalizado', desc: 'Cada projeto é único e feito sob medida.' },
          { icone: '⏱️', nome: 'Agilidade', desc: 'Prazos curtos e cumpridos com compromisso.' },
          { icone: '💬', nome: 'Suporte próximo', desc: 'Acompanhamento em todas as etapas.' },
          { icone: '⭐', nome: 'Qualidade garantida', desc: 'Trabalho bem feito e com garantia.' },
        ],
        sobreTitulo: 'Por que escolher a gente',
        sobreTexto: `Experiência e dedicação em ${ctx.cidade}. Atendimento humano, preço justo e resultado garantido.`,
        selos: ['🛡️ Garantia', '🤝 Atendimento humano', '📍 ' + ctx.cidade],
        depoimentos: [
          { texto: 'Serviço de qualidade e prazo cumprido.', autor: 'André M.' },
          { texto: 'Atendimento excelente do início ao fim.', autor: 'Patrícia D.' },
        ],
        ctaTitulo: 'Peça seu orçamento',
        ctaTexto: 'Fale no WhatsApp e receba um orçamento sem compromisso.',
        ctaBotao: 'Pedir orçamento',
      };
    },
    waMensagem(ctx) {
      return `Olá, ${ctx.nomeSite}! Vim pelo site de demonstração e gostaria de um orçamento.`;
    },
  },
};

// ============ UTILITÁRIOS DE COR ============

function hexToRgb(hex) {
  let h = String(hex || '#d4af37').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// ============ API PÚBLICA ============

/**
 * Renderiza o HTML de um template preenchido com os dados do site/lead.
 * @param {string} templateId - barbearia|restaurante|advocacia|clinica|personal|loja|servico
 * @param {object} site - registro SiteDemo (cor, tom, nomeSite, ramo)
 * @param {object} lead - dados do Lead (nome, telefone, cidade, instagram, servico)
 * @param {object} [overrides] - conteúdo personalizado (gerado pela IA) que sobrescreve os defaults
 * @returns {{ html: string, contexto: object }}
 */
function renderTemplate(templateId, site, lead, overrides = {}) {
  const dados = buildContext(site || {}, lead || {});
  const html = buildHtml(templateId, dados, overrides || {});
  return { html, contexto: dados };
}

/**
 * Sanitiza o conteúdo gerado pela IA: garante que cada campo tenha o tipo certo
 * e preenche os obrigatórios com fallbacks dos defaults do template.
 * Evita que a IA injete HTML/JS malicioso nos textos.
 */
function sanitizeOverrides(raw, templateId, dados) {
  const safe = {};
  if (!raw || typeof raw !== 'object') return safe;

  const str = (v, fallback = '') => {
    if (typeof v !== 'string') return fallback;
    // Remove tags HTML/script perigosas dos textos
    return v
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .trim();
  };

  // Campos de texto: só sobrescreve se vier uma string não-vazia
  const camposTexto = [
    'heroTitulo', 'heroSub', 'heroCta',
    'servicosTitulo', 'servicosSub',
    'sobreTitulo', 'sobreTexto',
    'ctaTitulo', 'ctaTexto', 'ctaBotao',
    'waMensagem',
  ];
  for (const campo of camposTexto) {
    const valor = str(raw[campo]);
    if (valor) safe[campo] = valor;
  }

  // selos: array de strings
  if (Array.isArray(raw.selos)) {
    safe.selos = raw.selos.slice(0, 6).map((s) => str(s)).filter(Boolean);
  }
  // depoimentos: array de {texto, autor}
  if (Array.isArray(raw.depoimentos)) {
    safe.depoimentos = raw.depoimentos.slice(0, 4).map((d) => ({
      texto: str(d && d.texto),
      autor: str(d && d.autor),
    })).filter((d) => d.texto);
  }
  // servicos: array de {icone, nome, desc, preco}
  if (Array.isArray(raw.servicos)) {
    safe.servicos = raw.servicos.slice(0, 8).map((s) => ({
      icone: str(s && s.icone, '⭐'),
      nome: str(s && s.nome, 'Serviço'),
      desc: str(s && s.desc, ''),
      preco: str(s && s.preco, ''),
    })).filter((s) => s.nome);
  }

  return safe;
}

/**
 * Lista os templates com metadados (para a UI).
 */
function getTemplatesMeta() {
  return Object.keys(TEMPLATE_SECTIONS).map((id) => ({
    id,
    label: TEMPLATE_LABELS[id].label,
    icone: TEMPLATE_LABELS[id].icone,
    descricao: TEMPLATE_LABELS[id].descricao,
  }));
}

const TEMPLATE_LABELS = {
  barbearia: { label: 'Barbearia / Salão', icone: '🪒', descricao: 'Serviços, preços e agendamento' },
  restaurante: { label: 'Restaurante / Delivery', icone: '🍕', descricao: 'Cardápio e pedido pelo WhatsApp' },
  advocacia: { label: 'Advocacia', icone: '⚖️', descricao: 'Áreas de atuação e consulta' },
  clinica: { label: 'Clínica / Dentista', icone: '🦷', descricao: 'Especialidades e agendamento' },
  personal: { label: 'Personal / Academia', icone: '💪', descricao: 'Planos e matrícula' },
  loja: { label: 'Loja / E-commerce', icone: '🛍️', descricao: 'Vitrine de produtos' },
  servico: { label: 'Serviço geral', icone: '🧰', descricao: 'Serviços e orçamento' },
};

module.exports = {
  renderTemplate,
  sanitizeOverrides,
  getTemplatesMeta,
  buildContext,
  TEMPLATE_LABELS,
};
