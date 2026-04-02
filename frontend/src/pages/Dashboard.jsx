import { useEffect, useState } from 'react';
import { Users, TrendingUp, Star, UserPlus } from 'lucide-react';
import api from '../services/api';

const STATUS_COLORS = {
  novo: 'bg-blue-500',
  contatado: 'bg-yellow-500',
  interessado: 'bg-orange-500',
  fechado: 'bg-green-500',
};

const STATUS_LABELS = {
  novo: 'Novo',
  contatado: 'Contatado',
  interessado: 'Interessado',
  fechado: 'Fechado',
};

function StatCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorMap[color]}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/leads/stats')
      .then((res) => setStats(res.data))
      .catch(() => setError('Erro ao carregar estatísticas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>;
  }

  const total = stats?.total || 0;
  const hoje = stats?.hoje || 0;
  const novos = stats?.byStatus?.novo || 0;
  const fechados = stats?.byStatus?.fechado || 0;
  const taxa = total > 0 ? ((fechados / total) * 100).toFixed(1) : '0.0';

  const statuses = ['novo', 'contatado', 'interessado', 'fechado'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral dos seus leads</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total de Leads" value={total} icon={Users} color="blue" />
        <StatCard label="Leads Hoje" value={hoje} icon={UserPlus} color="green" />
        <StatCard label="Taxa de Conversão" value={`${taxa}%`} icon={TrendingUp} color="purple" />
        <StatCard label="Leads Novos" value={novos} icon={Star} color="orange" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Leads por Status</h2>
        <div className="space-y-4">
          {statuses.map((status) => {
            const count = stats?.byStatus?.[status] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700">{STATUS_LABELS[status]}</span>
                  <span className="text-sm text-gray-500">{count} leads</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${STATUS_COLORS[status]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
