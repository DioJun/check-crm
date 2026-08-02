import { useState, useEffect } from 'react';
import { BarChart3, ThumbsUp, ThumbsDown, Clock, Target, Lightbulb, TrendingUp } from 'lucide-react';

const API = 'http://localhost:3001/api/whatsapp';

export default function AIAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/analytics?days=${days}`);
        const json = await res.json();
        if (json.success) setData(json.dashboard);
        else setError(json.error || 'Erro ao carregar analytics');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  if (loading) return <div className="text-center py-20 text-gray-400">Carregando analytics...</div>;
  if (error) return <div className="text-center py-20 text-red-600">Erro: {error}</div>;
  if (!data) return null;

  const fb = data.feedback;
  const stats = [
    { label: 'Sugestões', value: fb.total, icon: Target, color: 'text-blue-600 bg-blue-100' },
    { label: 'Taxa de uso', value: `${fb.taxaUso}%`, icon: TrendingUp, color: 'text-violet-600 bg-violet-100' },
    { label: 'Aceitas (sem edição)', value: `${fb.taxaAceite}%`, icon: ThumbsUp, color: 'text-green-600 bg-green-100' },
    { label: 'Resposta positiva', value: `${fb.taxaRespostaPositiva}%`, icon: ThumbsDown, color: 'text-emerald-600 bg-emerald-100' },
  ];

  const melhorComprimento = (data.approach?.curta?.taxaConversao ?? 0) >= (data.approach?.longa?.taxaConversao ?? 0) ? 'curtas' : 'detalhadas';
  const melhorPergunta = (data.approach?.comPergunta?.taxaConversao ?? 0) >= (data.approach?.semPergunta?.taxaConversao ?? 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-gold-100 text-gold-700">
            <BarChart3 className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Performance da IA</h1>
            <p className="text-sm text-gray-500">A IA aprende com os resultados reais das suas conversas.</p>
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`inline-flex p-2 rounded-lg ${s.color} mb-2`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {data.insights?.insights?.length > 0 && (
        <div className="bg-gradient-to-r from-gold-700 to-gold-500 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-5 h-5" />
            <h3 className="font-semibold">Insights aprendidos com seus dados</h3>
          </div>
          <ul className="space-y-1 text-sm">
            {data.insights.insights.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-white rounded-full" /> {i}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Melhor abordagem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Conversão por abordagem</h3>
          <div className="space-y-3">
            {[
              { label: 'Respostas curtas', d: data.approach.curta },
              { label: 'Respostas longas', d: data.approach.longa },
              { label: 'Terminando com pergunta', d: data.approach.comPergunta },
              { label: 'Sem pergunta no final', d: data.approach.semPergunta },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-semibold text-gray-900">
                    {row.d.taxaConversao === null ? '—' : `${row.d.taxaConversao}%`}
                    <span className="text-xs text-gray-400 font-normal"> ({row.d.pos}✓/{row.d.neg}✗)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(row.d.taxaConversao ?? 0) >= 50 ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ width: `${row.d.taxaConversao ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Melhor padrão: respostas <strong>{melhorComprimento}</strong>
            {melhorPergunta ? ' terminando com pergunta' : ' sem pergunta'}.
          </p>
        </div>

        {/* Palavras que geram resposta */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Palavras que geram resposta</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                <ThumbsUp className="w-3.5 h-3.5" /> Positivas ({data.words.totalPositivas})
              </p>
              <div className="space-y-1">
                {data.words.palavrasPositivas.slice(0, 8).map(([w, c]) => (
                  <div key={w} className="flex justify-between text-xs">
                    <span className="text-gray-600">{w}</span>
                    <span className="text-gray-400">{c}x</span>
                  </div>
                ))}
                {data.words.palavrasPositivas.length === 0 && <p className="text-xs text-gray-400">Sem dados ainda</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                <ThumbsDown className="w-3.5 h-3.5" /> Negativas ({data.words.totalNegativas})
              </p>
              <div className="space-y-1">
                {data.words.palavrasNegativas.slice(0, 8).map(([w, c]) => (
                  <div key={w} className="flex justify-between text-xs">
                    <span className="text-gray-600">{w}</span>
                    <span className="text-gray-400">{c}x</span>
                  </div>
                ))}
                {data.words.palavrasNegativas.length === 0 && <p className="text-xs text-gray-400">Sem dados ainda</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Melhor horário + tempo de fechamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold-700" /> Melhor horário por segmento
          </h3>
          {data.bestHours.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados de horário ainda (precisa de conversas analisadas).</p>
          ) : (
            <div className="space-y-2">
              {data.bestHours.map((b) => (
                <div key={b.segmento} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{b.segmento}</span>
                  <span className="font-semibold text-gold-700">{b.melhorHorario || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-700" /> Tempo médio até fechamento
          </h3>
          {data.timeToClose.mediaDias === null ? (
            <p className="text-sm text-gray-400">Sem leads fechados ainda.</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{data.timeToClose.mediaDias} dias</p>
              <p className="text-xs text-gray-500">entre o primeiro contato e o fechamento ({data.timeToClose.amostra} leads)</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
