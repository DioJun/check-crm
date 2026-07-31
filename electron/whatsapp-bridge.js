/**
 * WhatsApp Bridge — Camada de abstração de LEITURA do WhatsApp Web
 * 
 * ⚠️ SEGURANÇA: Este módulo NUNCA envia mensagens. 
 * Apenas lê o DOM do WhatsApp Web e expõe dados para o assistente.
 * O envio é SEMPRE manual, feito pelo vendedor no próprio WhatsApp Web.
 */

// Script injetado no <webview> do WhatsApp Web (roda no contexto da página)
const BRIDGE_SCRIPT = `
(function () {
  if (window.__waBridge) { console.log('[WA Bridge] já injetado'); return; }

  const state = {
    paused: false,
    lastRead: 0,
    messages: [],       // buffer de novas mensagens recebidas
    chatList: [],
  };

  // ---- Helpers de extração do DOM ----
  function getChatTitle() {
    const el = document.querySelector('header span[title]')
      || document.querySelector('[data-testid="conversation-title"]');
    return el ? (el.getAttribute('title') || el.textContent || '').trim() : null;
  }

  function readMessages() {
    const title = getChatTitle();
    const messages = [];
    const nodes = document.querySelectorAll('div.message-in, div.message-out');
    nodes.forEach((msg) => {
      const textEl = msg.querySelector('span.selectable-text');
      if (!textEl || !textEl.innerText) return;
      const isIncoming = msg.classList.contains('message-in');
      const timeEl = msg.querySelector('span[data-testid="msg-time"], time');
      const fromEl = msg.querySelector('[data-pre-plain-text]');
      let time = timeEl ? timeEl.getAttribute('title') || timeEl.textContent : '';
      if (!time && fromEl) {
        const m = (fromEl.getAttribute('data-pre-plain-text') || '').match(/\\[(.*?)\\]/);
        if (m) time = m[1];
      }
      messages.push({
        from: isIncoming ? 'lead' : 'vendedor',
        text: textEl.innerText,
        time: (time || '').trim(),
      });
    });
    return { title, messages };
  }

  function getChatList() {
    const items = document.querySelectorAll('div[role="listitem"]');
    const list = [];
    items.forEach((item) => {
      const titleEl = item.querySelector('span[title]');
      const name = titleEl ? (titleEl.getAttribute('title') || '').trim() : '';
      const previewEl = item.querySelector('div[role="row"] > div > div span');
      const preview = previewEl ? previewEl.textContent.trim() : '';
      const timeEl = item.querySelector('span[data-testid="last-msg-time"]');
      if (name) {
        list.push({ name, preview, time: timeEl ? timeEl.textContent : '' });
      }
    });
    return list;
  }

  function readNewIncomingMessages() {
    const result = [];
    const title = getChatTitle();
    const nodes = document.querySelectorAll('div.message-in');
    nodes.forEach((msg) => {
      if (msg.dataset.waProcessed === '1') return;
      const textEl = msg.querySelector('span.selectable-text');
      if (!textEl || !textEl.innerText) return;
      msg.dataset.waProcessed = '1';
      const timeEl = msg.querySelector('span[data-testid="msg-time"], time');
      result.push({
        from: 'lead',
        text: textEl.innerText,
        time: timeEl ? (timeEl.getAttribute('title') || timeEl.textContent || '').trim() : '',
        chatTitle: title,
      });
    });
    return result;
  }

  // ---- Observer com rate limit ----
  let observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (state.paused) return;
      const now = Date.now();
      if (now - state.lastRead < 800) return; // rate limit: ~1 leitura/800ms
      state.lastRead = now;
      const newMsgs = readNewIncomingMessages();
      if (newMsgs.length > 0) {
        state.messages = state.messages.concat(newMsgs);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[WA Bridge] Observer de mensagens iniciado');
  }

  function getNewMessages() {
    const msgs = state.messages.slice();
    state.messages = [];
    return msgs;
  }

  function setPaused(p) { state.paused = !!p; }
  function isPaused() { return state.paused; }

  // ---- API pública (somente leitura) ----
  window.__waBridge = {
    readMessages,          // readMessages() -> { title, messages[] }
    getNewMessages,        // getNewMessages() -> mensagens novas desde última leitura
    getChatList,           // getChatList() -> lista de conversas
    getCurrentChat: () => ({ title: getChatTitle(), ...readMessages() }),
    setPaused,
    isPaused,
    start: startObserver,
    // ⛔ NÃO existe sendMessage — envio é sempre manual
  };

  // Iniciar quando DOM estiver pronto
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startObserver, 1500);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(startObserver, 1500));
  }
  console.log('[WA Bridge] Bridge de leitura injetada com sucesso');
})();
`;

/**
 * Configura o webContents do <webview> do WhatsApp.
 * Aqui podemos injetar diretamente ou apenas logar — a injeção principal
 * é feita pelo frontend via webview.executeJavaScript().
 */
function setupWhatsAppBridge(webContents) {
  webContents.on('did-finish-load', () => {
    console.log('[WhatsApp Bridge] Webview do WhatsApp carregado');
    // Pequeno delay para o React DOM do WhatsApp estabilizar
    setTimeout(() => {
      try {
        webContents.executeJavaScript(BRIDGE_SCRIPT);
        console.log('[WhatsApp Bridge] Bridge injetada no webview');
      } catch (err) {
        console.error('[WhatsApp Bridge] Falha ao injetar bridge:', err.message);
      }
    }, 3000);
  });

  webContents.on('console-message', (event, level, message) => {
    if (message && message.includes('[WA Bridge]')) {
      console.log('[webview:console]', message);
    }
  });
}

function getBridgeScript() {
  return BRIDGE_SCRIPT;
}

module.exports = { setupWhatsAppBridge, getBridgeScript, BRIDGE_SCRIPT };
