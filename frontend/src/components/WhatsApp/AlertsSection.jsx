import { AlertTriangle, Clock, Info, Bell, BellOff, X } from 'lucide-react';

/**
 * AlertsSection — lista de alertas de relacionamento no painel
 * Cores por prioridade:
 *   - ALTA (urgencia/risco)  -> vermelho
 *   - MÉDIA (inatividade/oportunidade) -> amarelo
 *   - INFORMATIVA (padrao)   -> azul
 * Cada alerta tem botão de silenciar.
 */
const PRIORIDADE_STYLE = {
  alta: {
    wrapper: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
    label: 'text-red-700',
    chip: 'bg-red-100 text-red-700',
    Icon: AlertTriangle,
  },
  media: {
    wrapper: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-100',
    label: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-700',
    Icon: Clock,
  },
  informativa: {
    wrapper: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
    label: 'text-blue-700',
    chip: 'bg-blue-100 text-blue-700',
    Icon: Info,
  },
};

const TIPO_LABEL = {
  inatividade: 'Inatividade',
  urgencia: 'Urgência',
  risco: 'Risco',
  oportunidade: 'Oportunidade',
  padrao: 'Padrão',
};

export default function AlertsSection({ alertas = [], onSilence, onResolve }) {
  if (!alertas || alertas.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-gold-700" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Alertas ({alertas.length})
        </p>
      </div>
      <div className="space-y-2">
        {alertas.map((alerta) => {
          const st = PRIORIDADE_STYLE[alerta.prioridade] || PRIORIDADE_STYLE.informativa;
          const Icon = st.Icon;
          return (
            <div
              key={alerta.id || alerta.tipo}
              className={`border rounded-lg p-2.5 ${st.wrapper}`}
            >
              <div className="flex items-start gap-2">
                <span className={`p-1 rounded-lg ${st.iconBg} ${st.icon} flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold ${st.label}`}>{alerta.titulo}</p>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${st.chip} flex-shrink-0`}>
                      {TIPO_LABEL[alerta.tipo] || alerta.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{alerta.mensagem}</p>
                </div>
              </div>
              {onSilence && (
                <button
                  onClick={() => onSilence(alerta)}
                  className="mt-1.5 ml-6 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                  title="Silenciar este alerta por 7 dias"
                >
                  <BellOff className="w-3 h-3" />
                  Silenciar
                </button>
              )}
              {onResolve && (
                <button
                  onClick={() => onResolve(alerta)}
                  className="mt-1.5 ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-600 transition-colors"
                  title="Marcar como resolvido / ignorado"
                >
                  <X className="w-3 h-3" />
                  Ignorar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
