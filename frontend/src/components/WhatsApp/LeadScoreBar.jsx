import { Flame } from 'lucide-react';

/**
 * LeadScoreBar — barra de progresso do lead score (sempre visível no painel)
 * Cor: vermelho < 30, amarelo 30-60, verde > 60
 */
export default function LeadScoreBar({ score, label, cor, fatores }) {
  if (score === null || score === undefined) return null;

  const cores = {
    vermelho: {
      bar: 'bg-red-500',
      text: 'text-red-700',
      chip: 'bg-red-100 text-red-700',
      border: 'border-red-200',
    },
    amarelo: {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      chip: 'bg-amber-100 text-amber-700',
      border: 'border-amber-200',
    },
    verde: {
      bar: 'bg-green-500',
      text: 'text-green-700',
      chip: 'bg-green-100 text-green-700',
      border: 'border-green-200',
    },
  };
  const c = cores[cor] || cores.amarelo;

  return (
    <div className={`bg-white border ${c.border} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Flame className={`w-4 h-4 ${c.text}`} />
          <span className="text-xs font-semibold text-gray-700">Lead Score</span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.chip}`}>
          {score}/100 · {label}
        </span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${c.bar} rounded-full transition-all duration-700`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      {fatores && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { k: 'frequencia', label: 'Freq' },
            { k: 'velocidade', label: 'Vel' },
            { k: 'tamanho', label: 'Tam' },
            { k: 'keywords', label: 'Kws' },
            { k: 'historico', label: 'Hist' },
          ].map((f) => (
            <span
              key={f.k}
              className="px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-gray-500 border border-gray-100"
              title={`${f.label}: ${fatores[f.k]}`}
            >
              {f.label} {fatores[f.k]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
