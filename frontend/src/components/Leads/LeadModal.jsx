import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';

const STATUSES = ['novo', 'contatado', 'interessado', 'fechado'];
const ORIGENS = ['site', 'instagram', 'facebook', 'indicacao', 'whatsapp', 'outro'];

const INITIAL_FORM = {
  nome: '',
  telefone: '',
  cidade: '',
  servico: '',
  status: 'novo',
  origem: '',
};

export default function LeadModal({ lead, onClose, onSuccess }) {
  const isEdit = Boolean(lead);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome || '',
        telefone: lead.telefone || '',
        cidade: lead.cidade || '',
        servico: lead.servico || '',
        status: lead.status || 'novo',
        origem: lead.origem || '',
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [lead]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/leads/${lead.id}`, form);
      } else {
        await api.post('/leads', form);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar lead');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Editar Lead' : 'Novo Lead'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Nome *</label>
              <input name="nome" value={form.nome} onChange={handleChange} required className={inputClass} placeholder="Nome completo" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Telefone *</label>
              <input name="telefone" value={form.telefone} onChange={handleChange} required className={inputClass} placeholder="11999999999" />
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input name="cidade" value={form.cidade} onChange={handleChange} className={inputClass} placeholder="São Paulo" />
            </div>
            <div>
              <label className={labelClass}>Serviço</label>
              <input name="servico" value={form.servico} onChange={handleChange} className={inputClass} placeholder="Ex: Website" />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Origem</label>
              <select name="origem" value={form.origem} onChange={handleChange} className={inputClass}>
                <option value="">Selecionar</option>
                {ORIGENS.map((o) => (
                  <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-sm rounded-lg transition-colors"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
