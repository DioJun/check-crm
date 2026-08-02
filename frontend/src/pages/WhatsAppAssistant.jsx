import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Bot, Pause, Play, ClipboardCopy, Check, RefreshCw, AlertCircle, Shield, User, MessageCircle, TrendingUp, XCircle, CheckCircle2, Sparkles, Globe } from 'lucide-react';
import LeadScoreBar from '../components/WhatsApp/LeadScoreBar';
import AlertsSection from '../components/WhatsApp/AlertsSection';
import OfferSection from '../components/WhatsApp/OfferSection';
import WhatsAppConfig from '../components/WhatsApp/WhatsAppConfig';

/**
 * WhatsApp Assistant — Tela dividida
 * ESQUERDA: WhatsApp Web embutido (<webview>)
 * DIREITA: Painel do assistente IA
 * 
 * ⚠️ SEGURANÇA: Este painel NUNCA envia mensagens automaticamente.
 * O envio é sempre manual pelo vendedor no próprio WhatsApp Web.
 * 
 * `active`: o componente fica SEMPRE montado (para o <webview> não ser
 * destruído ao navegar). Quando `active=false` ele só é ocultado via CSS.
 */
export default function WhatsAppAssistant({ active = true }) {
  const navigate = useNavigate();
  const webviewRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentChat, setCurrentChat] = useState(null);
  const [, setChatList] = useState([]);
  const [, setNewMessages] = useState([]);
  const [copied, setCopied] = useState(false);
  const [copiedOfferId, setCopiedOfferId] = useState(null);
  const [suggestion, setSuggestion] = useState('');
  const [editableSuggestion, setEditableSuggestion] = useState('');
  const [leadProfile, setLeadProfile] = useState(null);
  const [log, setLog] = useState([]);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [classification, setClassification] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [transcription, setTranscription] = useState([]);
  const [crmUpdateMsg, setCrmUpdateMsg] = useState('');
  const [leadFound, setLeadFound] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [score, setScore] = useState(null);
  const [suggestionLogId, setSuggestionLogId] = useState(null); // Camada 2: feedback loop
  const [chatSemLead, setChatSemLead] = useState(null); // título da conversa sem lead no CRM

  // Adicionar entrada no log
  const addLog = useCallback((type, msg) => {
    const entry = { time: new Date().toLocaleTimeString('pt-BR'), type, msg };
    setLog((prev) => [entry, ...prev].slice(0, 50));
    // Registrar também no log do Electron (auditoria)
    if (window.electronAPI?.logWhatsAppAction) {
      window.electronAPI.logWhatsAppAction({ type, msg, chat: currentChat?.title });
    }
  }, [currentChat]);

  // Injeta a bridge no webview e inicia o observer
  const injectBridge = useCallback(async (webview) => {
    try {
      let script = window.__waBridgeScript;
      if (!script && window.electronAPI?.getWhatsAppBridgeScript) {
        script = await window.electronAPI.getWhatsAppBridgeScript();
        window.__waBridgeScript = script;
      }
      if (script) {
        await webview.executeJavaScript(script);
        addLog('info', 'Bridge de leitura injetada no WhatsApp');
        setConnected(true);
      }
    } catch (err) {
      addLog('error', `Falha ao injetar bridge: ${err.message}`);
    }
  }, [addLog]);

  // Ref para evitar closures desatualizados
  const currentChatTitleRef = useRef(null);
  const pausedRef = useRef(false);
  const loadingRef = useRef(false);

  // Sincronizar refs com estados
  useEffect(() => { currentChatTitleRef.current = currentChat?.title || null; }, [currentChat]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Anexar eventos do <webview> via ref (Elementos custom do Electron
  // não suportam props de evento do React — anexamos imperativamente)
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => injectBridge(webview);
    const handleDidFailLoad = () => addLog('error', 'Falha ao carregar WhatsApp Web');
    const handleCrashed = () => addLog('error', 'WhatsApp Web travou');

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('crashed', handleCrashed);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('crashed', handleCrashed);
    };
  }, [injectBridge, addLog]);

  // Quando o painel volta a ficar ativo após ter ficado oculto (display:none),
  // o <webview> pode precisar de um "bump" para re-renderizar. Como o webview
  // é um elemento custom (não-HTML), mudar a altura força o reflow interno.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      const webview = webviewRef.current;
      if (!webview) return;
      const prev = webview.style.height;
      webview.style.height = '99.9%';
      // Força reflow e restaura
      requestAnimationFrame(() => {
        webview.style.height = prev || '100%';
      });
    }, 60);
    return () => clearTimeout(t);
  }, [active]);

  // Ler contexto completo da conversa atual
  const readContext = useCallback(async () => {
    const webview = webviewRef.current;
    if (!webview) return null;
    try {
      const ctx = await webview.executeJavaScript('window.__waBridge ? window.__waBridge.readMessages() : null');
      if (ctx?.messages) {
        setTranscription(ctx.messages.slice(-30)); // últimas 30 mensagens
      }
      return ctx;
    } catch {
      return null;
    }
  }, []);

  // Análise via IA (chama backend — também atualiza CRM automaticamente)
  const runAnalysis = useCallback(async (isAuto = false) => {
    const chatTitle = currentChatTitleRef.current;
    if (!chatTitle || pausedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingSuggestion(true);
    if (!isAuto) addLog('ai', 'Gerando sugestão de resposta...');
    try {
      const context = await readContext();
      const res = await fetch('http://localhost:3001/api/whatsapp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatName: chatTitle,
          messages: context?.messages || [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Campo correto é `sugestao` (backend em pt-BR). Fallback para `suggestion` (legado).
        const sugestao = data.sugestao || data.suggestion || '';
        setSuggestion(sugestao);
        setEditableSuggestion(sugestao);
        setClassification(data.classificacao || null);
        setSentiment(data.sentimento || null);
        setLeadFound(!!data.lead || !!data.leadFound);
        if (data.lead) setLeadProfile(data.lead);
        // Registra quando a conversa NÃO tem lead no CRM (para oferecer cadastro)
        if (!data.lead && !data.leadFound) {
          setChatSemLead(chatTitle);
        } else {
          setChatSemLead(null);
        }
        setCrmUpdateMsg(data.logMessage || '');
        // Novos dados: alertas, ofertas e lead score
        setAlertas(data.alertas || []);
        setOfertas(data.ofertas || []);
        if (data.score) setScore(data.score);
        // Camada 2: guardar id da sugestão para o feedback loop
        setSuggestionLogId(data.suggestionLogId || null);
        if (!isAuto) {
          addLog('ai', 'Sugestão de resposta gerada');
          if (data.alertas?.length) addLog('ai', `🔔 ${data.alertas.length} alerta(s) de relacionamento`);
          if (data.ofertas?.length) addLog('ai', `🎁 ${data.ofertas.length} oferta(s) sugerida(s)`);
          if (data.score?.score != null) addLog('ai', `📊 Lead Score: ${data.score.score}/100`);
          if (data.logMessage) addLog('ai', data.logMessage);
        } else {
          addLog('ai', `📥 Mensagem nova → análise automática: ${data.logMessage || ''}`);
        }
      } else {
        if (!isAuto) addLog('error', data.error || 'Erro ao gerar sugestão');
      }
    } catch (err) {
      if (!isAuto) addLog('error', `Erro na IA: ${err.message}`);
    } finally {
      loadingRef.current = false;
      setLoadingSuggestion(false);
    }
  }, [readContext, addLog]);

  // Polling das novas mensagens + troca de conversa (rate limit de 1.5s)
  useEffect(() => {
    if (!connected || paused) return;
    const interval = setInterval(async () => {
      const webview = webviewRef.current;
      if (!webview || webview.isLoading()) return;
      try {
        const newMsgs = await webview.executeJavaScript('window.__waBridge ? window.__waBridge.getNewMessages() : []');
        if (newMsgs && newMsgs.length > 0) {
          setNewMessages((prev) => [...prev, ...newMsgs]);
          newMsgs.forEach((m) => addLog('in', `💬 ${m.text.substring(0, 80)}`));
          // Disparar análise automática (se houver conversa ativa e não pausado)
          if (currentChatTitleRef.current && !pausedRef.current && !loadingRef.current) {
            runAnalysis(true);
          }
        }
        const chat = await webview.executeJavaScript('window.__waBridge ? window.__waBridge.getCurrentChat() : null');
        let tituloAtual = chat && chat.title ? chat.title : null;
        // Fallback: se o getChatTitle falhar, tenta a 1ª conversa da lista (a ativa)
        if (!tituloAtual) {
          try {
            const lista = await webview.executeJavaScript('window.__waBridge ? window.__waBridge.getChatList() : []');
            if (lista && lista[0] && lista[0].name) tituloAtual = lista[0].name;
          } catch { /* ignorar */ }
        }
        if (tituloAtual) {
          const mudouConversa = tituloAtual !== currentChatTitleRef.current;
          // Atualiza o ref IMEDIATAMENTE para a análise usar o título correto
          currentChatTitleRef.current = tituloAtual;
          if (mudouConversa) {
            setCurrentChat(chat || { title: tituloAtual });
            // Troca de conversa → análise automática imediata
            if (active && !pausedRef.current && !loadingRef.current) {
              runAnalysis(true);
            }
          }
        }
      } catch {
        // webview ainda não carregado — ignorar silenciosamente
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [connected, paused, addLog, runAnalysis, active]);

  // Pulso de atualização — mantém o painel sempre fresco enquanto o vendedor
  // mexe no WhatsApp (análise a cada 30s se houver conversa ativa). Só roda
  // quando a tela está visível (`active`) para não gastar tokens em background.
  useEffect(() => {
    if (!connected || paused || !active) return;
    const pulse = setInterval(() => {
      if (currentChatTitleRef.current && !pausedRef.current && !loadingRef.current) {
        runAnalysis(true);
      }
    }, 30000);
    return () => clearInterval(pulse);
  }, [connected, paused, active, runAnalysis]);

  // Análise inicial ao conectar: assim que a bridge injeta e há uma conversa
  // aberta no WhatsApp, dispara a primeira análise automaticamente (sem esperar
  // mensagem nova ou troca de conversa).
  useEffect(() => {
    if (!connected || !active || paused) return;
    let tentativas = 0;
    const t = setInterval(async () => {
      if (loadingRef.current || !currentChatTitleRef.current) {
        // Tenta detectar a conversa ativa pela lista (fallback se o título falhar)
        const webview = webviewRef.current;
        if (webview && !webview.isLoading()) {
          try {
            const lista = await webview.executeJavaScript('window.__waBridge ? window.__waBridge.getChatList() : []');
            const ativa = (lista && lista[0]) ? lista[0].name : null;
            if (ativa && !currentChatTitleRef.current) {
              currentChatTitleRef.current = ativa;
              setCurrentChat({ title: ativa });
            }
          } catch { /* ignorar */ }
        }
        tentativas++;
        if (tentativas > 20) { clearInterval(t); return; } // ~30s máx
        return;
      }
      clearInterval(t);
      if (!pausedRef.current && !loadingRef.current) {
        runAnalysis(true);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [connected, active, paused, runAnalysis]);

  // Carregar lista de conversas
  const refreshChatList = useCallback(async () => {
    const webview = webviewRef.current;
    if (!webview) return;
    try {
      const list = await webview.executeJavaScript('window.__waBridge ? window.__waBridge.getChatList() : []');
      setChatList(list || []);
    } catch { /* ignorar */ }
  }, []);

  // Gerar sugestão (botão manual)
  const handleGenerateSuggestion = useCallback(() => {
    runAnalysis(false);
  }, [runAnalysis]);

  // Copiar sugestão (envia feedback para o loop de aprendizado — Camada 2)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableSuggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addLog('action', 'Sugestão copiada para a área de transferência');

    // Registrar no feedback loop: se o texto foi editado, captura a versão final
    if (suggestionLogId) {
      const foiEditada = editableSuggestion.trim() !== suggestion.trim();
      try {
        await fetch('http://localhost:3001/api/whatsapp/feedback/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: suggestionLogId,
            actionTaken: foiEditada ? 'editou' : 'copiou',
            vendedorText: editableSuggestion,
          }),
        });
        if (foiEditada) addLog('ai', '🔄 Edição da sugestão registrada (a IA vai aprender)');
      } catch (err) {
        addLog('error', `Erro ao registrar feedback: ${err.message}`);
      }
    }
  };

  // Silenciar um alerta (por 7 dias no backend)
  const handleSilenceAlert = async (alerta) => {
    try {
      const res = await fetch(`http://localhost:3001/api/whatsapp/alerts/${alerta.id}/silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 7 }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertas((prev) => prev.filter((a) => a.id !== alerta.id));
        addLog('action', `🔕 Alerta silenciado: ${alerta.titulo}`);
      } else {
        addLog('error', data.error || 'Erro ao silenciar alerta');
      }
    } catch (err) {
      addLog('error', `Erro ao silenciar: ${err.message}`);
    }
  };

  // Ignorar/resolver um alerta (registra no log de ações)
  const handleResolveAlert = async (alerta) => {
    try {
      const res = await fetch(`http://localhost:3001/api/whatsapp/alerts/${alerta.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setAlertas((prev) => prev.filter((a) => a.id !== alerta.id));
        addLog('action', `✅ Alerta resolvido/ignorado: ${alerta.titulo}`);
      } else {
        addLog('error', data.error || 'Erro ao resolver alerta');
      }
    } catch (err) {
      addLog('error', `Erro ao resolver: ${err.message}`);
    }
  };

  // Copiar proposta de oferta + registrar uso
  const handleCopyProposal = async (oferta) => {
    const proposta = oferta.proposta || '';
    await navigator.clipboard.writeText(proposta);
    setCopiedOfferId(oferta.produto.id);
    setTimeout(() => setCopiedOfferId(null), 2000);
    addLog('action', `🎁 Proposta copiada: ${oferta.produto.nome}`);
    // Registrar uso da oferta (alimenta aprendizado futuro)
    if (leadProfile?.id) {
      try {
        await fetch('http://localhost:3001/api/whatsapp/offers/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: leadProfile.id, produtoId: oferta.produto.id, status: 'usou' }),
        });
      } catch { /* silencioso */ }
    }
  };

  // Pausar/retomar assistente
  const handleTogglePause = async () => {
    const webview = webviewRef.current;
    const next = !paused;
    setPaused(next);
    try {
      await webview?.executeJavaScript(`window.__waBridge ? window.__waBridge.setPaused(${next}) : null`);
    } catch { /* ignorar */ }
    addLog(next ? 'info' : 'info', next ? '⏸️ Assistente pausado' : '▶️ Assistente retomado');
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-4rem)] -m-6 lg:-m-8"
      style={active ? undefined : { display: 'none' }}
    >
      {/* Barra superior */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <div>
            <h1 className="text-base font-bold text-gray-900">Assistente de Vendas — WhatsApp</h1>
            <p className="text-xs text-gray-500">
              {connected ? 'Conectado ao WhatsApp Web' : 'Aguardando WhatsApp Web...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            paused ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${paused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`} />
            {paused ? 'Pausado' : 'Ativo'}
          </span>
          <button
            onClick={handleTogglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              paused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? 'Retomar' : 'Pausar'}
          </button>
        </div>
      </div>

      {/* Corpo dividido */}
      <div className="flex flex-1 min-h-0">
        {/* ESQUERDA: WhatsApp Web embutido */}
        <div className="flex-1 bg-white border-r border-gray-200 relative">
          <webview
            ref={webviewRef}
            src="https://web.whatsapp.com"
            partition="persist:whatsapp"
            className="w-full h-full"
            style={{ display: 'inline-flex', width: '100%', height: '100%' }}
            allowpopups="true"
            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
          />
          {/* Overlay de boas-vindas quando não conectado */}
          {!connected && (
            <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-white z-10 pointer-events-none">
              <MessageSquare className="w-12 h-12 text-green-500 mb-4" />
              <p className="text-lg font-semibold">Conecte-se ao WhatsApp</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm text-center px-6">
                Escaneie o QR Code no WhatsApp Web para começar. Sua sessão é mantida localmente.
              </p>
            </div>
          )}
        </div>

        {/* DIREITA: Painel do assistente */}
        <div className="w-[380px] shrink-0 bg-gray-50 flex flex-col min-h-0">
          {/* Chat atual + contexto */}
          <div className="p-4 border-b border-gray-200 bg-white shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversa atual</p>
              {connected && currentChat?.title && !paused && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700">
                  <Sparkles className="w-3 h-3 animate-pulse" /> Analisando em tempo real
                </span>
              )}
            </div>
            {currentChat?.title ? (
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{currentChat.title}</p>
                <button
                  onClick={refreshChatList}
                  className="p-1.5 text-gray-400 hover:text-gold-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Atualizar conversas"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma conversa selecionada</p>
            )}
          </div>

          {/* Classificação + Perfil do lead */}
          <div className="p-4 border-b border-gray-200 bg-white shrink-0">
            {/* Lead Score sempre visível no topo do perfil */}
            {score && (
              <div className="mb-3">
                <LeadScoreBar
                  score={score.score}
                  label={score.label}
                  cor={score.cor}
                  fatores={score.fatores}
                />
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gold-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil do lead no CRM</p>
            </div>

            {/* Badges de classificação */}
            {classification && (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  classification === 'pronto_fechar' ? 'bg-green-100 text-green-800' :
                  classification === 'interessado' ? 'bg-emerald-100 text-emerald-800' :
                  classification === 'objecao' ? 'bg-amber-100 text-amber-800' :
                  classification === 'frio' ? 'bg-gray-100 text-gray-700' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {classification === 'pronto_fechar' ? <CheckCircle2 className="w-3 h-3" /> :
                   classification === 'interessado' ? <TrendingUp className="w-3 h-3" /> :
                   classification === 'objecao' ? <AlertCircle className="w-3 h-3" /> :
                   classification === 'frio' ? <XCircle className="w-3 h-3" /> :
                   <MessageCircle className="w-3 h-3" />}
                  {classification}
                </span>
                {sentiment && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    sentiment === 'positivo' ? 'bg-green-50 text-green-700' :
                    sentiment === 'negativo' ? 'bg-red-50 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {sentiment === 'positivo' ? '🙂' : sentiment === 'negativo' ? '😠' : '😐'} {sentiment}
                  </span>
                )}
                {leadFound && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gold-100 text-gold-800">✓ No CRM</span>
                )}
              </div>
            )}

            {leadProfile ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-gray-800">{leadProfile.nome || 'Sem nome'}</p>
                <p className="text-xs text-gray-500">Status: <span className="font-medium text-gold-700">{leadProfile.status}</span></p>
                <p className="text-xs text-gray-500">Serviço: {leadProfile.servico || '—'}</p>
                {leadProfile.observacoes && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1 line-clamp-3">{leadProfile.observacoes}</p>
                )}
                {crmUpdateMsg && (
                  <p className="text-xs text-green-700 bg-green-50 rounded p-2 mt-1">{crmUpdateMsg}</p>
                )}
                {/* Ação rápida: criar site de demonstração para este lead */}
                {leadProfile.id && (
                  <button
                    onClick={() => navigate(`/sites/novo?leadId=${leadProfile.id}`)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-900 hover:bg-dark-700 text-white text-xs font-medium rounded-lg transition"
                    title="Criar site de demonstração para este lead"
                  >
                    <Globe className="w-3.5 h-3.5" /> Site de amostra
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400">Aguarde uma análise para ver o perfil do lead.</p>
                {crmUpdateMsg && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-1">{crmUpdateMsg}</p>
                )}
                {/* Conversa sem lead no CRM → oferecer cadastro rápido */}
                {chatSemLead && (
                  <button
                    onClick={() => navigate(`/leads?nome=${encodeURIComponent(chatSemLead)}&origem=whatsapp`)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-gold-700 hover:bg-gold-800 text-white text-xs font-medium rounded-lg transition"
                    title={`Cadastrar "${chatSemLead}" como novo lead no CRM`}
                  >
                    <User className="w-3.5 h-3.5" /> Cadastrar como novo lead
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Transcrição da conversa */}
          {transcription.length > 0 && (
            <div className="p-4 border-b border-gray-200 bg-white shrink-0 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transcrição da conversa</p>
              </div>
              <div className="space-y-1.5">
                {transcription.map((m, i) => (
                  <div key={i} className={`text-xs rounded-lg px-2.5 py-1.5 ${
                    m.from === 'lead' ? 'bg-green-50 text-gray-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {m.from === 'lead' ? '📥' : '📤'} {m.text}
                    {m.time && <span className="text-gray-400 ml-1 text-[10px]">{m.time}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sugestões da IA */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Alertas de relacionamento (topo do painel) */}
            {alertas.length > 0 && (
              <AlertsSection
                alertas={alertas}
                onSilence={handleSilenceAlert}
                onResolve={handleResolveAlert}
              />
            )}

            {/* Sugestão de oferta (destaque quando há match) */}
            {ofertas.length > 0 && (
              <OfferSection
                ofertas={ofertas}
                onCopyProposal={handleCopyProposal}
                copiedOfferId={copiedOfferId}
              />
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-violet-600" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sugestão da IA</p>
              </div>
              {editableSuggestion ? (
                <textarea
                  value={editableSuggestion}
                  onChange={(e) => setEditableSuggestion(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-violet-200 bg-violet-50/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              ) : (
                <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Clique em "Gerar sugestão" para a IA analisar a conversa</p>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateSuggestion}
              disabled={loadingSuggestion || !currentChat?.title || paused}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-violet-300 disabled:to-purple-300 text-white text-sm font-medium rounded-lg transition-all"
            >
              {loadingSuggestion ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando...</>
              ) : (
                <><Bot className="w-4 h-4" /> Gerar sugestão de resposta</>
              )}
            </button>

            {editableSuggestion && (
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><ClipboardCopy className="w-4 h-4" /> Copiar sugestão</>}
              </button>
            )}

            {/* Aviso de segurança */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Segurança:</strong> este assistente apenas <strong>sugere</strong> respostas. O envio é sempre manual por você no WhatsApp.
              </p>
            </div>

            {/* Configuração dos thresholds */}
            <WhatsAppConfig onLog={addLog} />

            {/* Log de ações */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Log do assistente</p>
              {log.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhuma ação registrada ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {log.map((entry, i) => (
                    <div key={i} className={`text-xs rounded px-2 py-1.5 ${
                      entry.type === 'error' ? 'bg-red-50 text-red-700' :
                      entry.type === 'ai' ? 'bg-violet-50 text-violet-700' :
                      entry.type === 'action' ? 'bg-blue-50 text-blue-700' :
                      entry.type === 'in' ? 'bg-green-50 text-green-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      <span className="text-gray-400 mr-1">{entry.time}</span>
                      {entry.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
