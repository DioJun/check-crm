import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSquare, Bot, Pause, Play, ClipboardCopy, Check, RefreshCw, AlertCircle, Shield, User, MessageCircle, TrendingUp, XCircle, CheckCircle2, Sparkles } from 'lucide-react';

/**
 * WhatsApp Assistant — Tela dividida
 * ESQUERDA: WhatsApp Web embutido (<webview>)
 * DIREITA: Painel do assistente IA
 * 
 * ⚠️ SEGURANÇA: Este painel NUNCA envia mensagens automaticamente.
 * O envio é sempre manual pelo vendedor no próprio WhatsApp Web.
 */
export default function WhatsAppAssistant() {
  const webviewRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentChat, setCurrentChat] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [newMessages, setNewMessages] = useState([]);
  const [copied, setCopied] = useState(false);
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
      const res = await fetch('http://localhost:3001/api/whatsapp/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatName: chatTitle,
          messages: context?.messages || [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestion(data.suggestion || '');
        setEditableSuggestion(data.suggestion || '');
        setClassification(data.classificacao || null);
        setSentiment(data.sentimento || null);
        setLeadFound(!!data.lead);
        if (data.lead) setLeadProfile(data.lead);
        setCrmUpdateMsg(data.logMessage || '');
        if (!isAuto) {
          addLog('ai', 'Sugestão de resposta gerada');
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

  // Polling das novas mensagens (rate limit de 1.5s)
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
        if (chat && chat.title && chat.title !== currentChatTitleRef.current) {
          setCurrentChat(chat);
        }
      } catch {
        // webview ainda não carregado — ignorar silenciosamente
      }
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, paused, addLog, runAnalysis]);

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

  // Copiar sugestão
  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableSuggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addLog('action', 'Sugestão copiada para a área de transferência');
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
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 lg:-m-8">
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
            allowpopups
            onDomReady={(e) => injectBridge(e.currentTarget)}
            onDidFailLoad={() => addLog('error', 'Falha ao carregar WhatsApp Web')}
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Conversa atual</p>
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
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400">Aguarde uma análise para ver o perfil do lead.</p>
                {crmUpdateMsg && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-1">{crmUpdateMsg}</p>
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
