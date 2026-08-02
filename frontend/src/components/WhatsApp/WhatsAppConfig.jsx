import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, X } from 'lucide-react';

/**
 * WhatsAppConfig — painel de configuração dos thresholds dos alertas
 * Permite ajustar:
 *  - Dias de inatividade por status (novo/contatado/interessado/fechado)
 *  - Proposta pendente (dias sem resposta)
 *  - Silêncio de alerta (dias)
 * Salva via PUT /api/whatsapp/config
 */
export default function WhatsAppConfig({ onSaved, onLog }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!open || config) return;
    fetch('http://localhost:3001/api/whatsapp/config')
      .then((r) => r.json())
      .then((d) => { if (d.success) setConfig(d.config); })
      .catch(() => onLog?.('error', 'Erro ao carregar configurações'));
  }, [open, config, onLog]);

  const setField = (campo, valor) => {
    setConfig((prev) => ({ ...prev, [campo]: parseInt(valor, 10) || 0 }));
  };
  const setInatividade = (status, valor) => {
    setConfig((prev) => ({
      ...prev,
      inatividadeDias: { ...prev.inatividadeDias, [status]: parseInt(valor, 10) || 0 },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSavedMsg('Configurações salvas ✓');
        setTimeout(() => setSavedMsg(''), 2500);
        onLog?.('action', '⚙️ Thresholds dos alertas atualizados');
        onSaved?.(data.config);
      } else {
        onLog?.('error', data.error || 'Erro ao salvar');
      }
    } catch (err) {
      onLog?.('error', `Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/config/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSavedMsg('Configurações restauradas para o padrão ✓');
        setTimeout(() => setSavedMsg(''), 2500);
        onLog?.('action', '⚙️ Thresholds restaurados para o padrão');
        onSaved?.(data.config);
      }
    } catch (err) {
      onLog?.('error', `Erro ao resetar: ${err.message}`);
    }
  };

  const inputClass = 'w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gold-500';

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        {open ? 'Fechar configurações' : 'Configurar alertas'}
      </button>

      {open && config && (
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Thresholds dos alertas</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">
            Inatividade (dias sem interação)
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { k: 'novo', label: 'Novo' },
              { k: 'contatado', label: 'Contatado' },
              { k: 'interessado', label: 'Interessado' },
              { k: 'fechado', label: 'Fechado' },
            ].map((s) => (
              <label key={s.k} className="text-xs text-gray-600">
                {s.label}
                <input
                  type="number"
                  min="0"
                  value={config.inatividadeDias?.[s.k] ?? 0}
                  onChange={(e) => setInatividade(s.k, e.target.value)}
                  className={inputClass}
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="text-xs text-gray-600">
              Proposta pendente (dias)
              <input
                type="number"
                min="0"
                value={config.propostaPendenteDias ?? 0}
                onChange={(e) => setField('propostaPendenteDias', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-gray-600">
              Silêncio do alerta (dias)
              <input
                type="number"
                min="0"
                value={config.silencioDias ?? 0}
                onChange={(e) => setField('silencioDias', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gold-700 hover:bg-gold-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors"
              title="Restaurar padrão"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {savedMsg && <p className="text-xs text-green-600 mt-2">{savedMsg}</p>}
        </div>
      )}
    </div>
  );
}
