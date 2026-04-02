const STATUS_CONFIG = {
  novo: { label: 'Novo', classes: 'bg-blue-100 text-blue-800' },
  contatado: { label: 'Contatado', classes: 'bg-yellow-100 text-yellow-800' },
  interessado: { label: 'Interessado', classes: 'bg-orange-100 text-orange-800' },
  fechado: { label: 'Fechado', classes: 'bg-green-100 text-green-800' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, classes: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {config.label}
    </span>
  );
}
