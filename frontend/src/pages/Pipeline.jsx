import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import api from '../services/api';
import WhatsAppButton from '../components/ui/WhatsAppButton';

const COLUMNS = [
  { id: 'novo', label: 'Novo', color: 'bg-blue-500', light: 'bg-blue-50 border-blue-200' },
  { id: 'contatado', label: 'Contatado', color: 'bg-yellow-500', light: 'bg-yellow-50 border-yellow-200' },
  { id: 'interessado', label: 'Interessado (Negociação)', color: 'bg-orange-500', light: 'bg-orange-50 border-orange-200' },
  { id: 'fechado', label: 'Fechado', color: 'bg-green-500', light: 'bg-green-50 border-green-200' },
];

function LeadCard({ lead, isDragging = false }) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm ${
        isDragging ? 'opacity-50 rotate-1' : 'hover:shadow-md'
      } transition-shadow cursor-grab active:cursor-grabbing`}
    >
      <p className="font-semibold text-gray-900 text-sm">{lead.nome}</p>
      {lead.servico && <p className="text-xs text-gray-500 mt-0.5">{lead.servico}</p>}
      {lead.cidade && <p className="text-xs text-gray-400">{lead.cidade}</p>}
      <div className="mt-2">
        <WhatsAppButton telefone={lead.telefone} nome={lead.nome} className="!py-1 !px-2 !text-xs" />
      </div>
    </div>
  );
}

function SortableCard({ lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} isDragging={isDragging} />
    </div>
  );
}

function Column({ column, leads }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col min-w-[260px] flex-1 max-w-sm">
      <div className={`rounded-t-xl px-4 py-3 flex items-center justify-between ${column.light} border`}>
        <span className="font-semibold text-gray-800 text-sm">{column.label}</span>
        <span className={`${column.color} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center`}>
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-xl border border-t-0 ${column.light} p-2 min-h-[200px]`}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leads.map((lead) => (
              <SortableCard key={lead.id} lead={lead} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    api.get('/leads')
      .then((res) => setLeads(res.data?.leads || res.data || []))
      .catch(() => setError('Erro ao carregar leads'))
      .finally(() => setLoading(false));
  }, []);

  const getLeadById = useCallback((id) => leads.find((l) => l.id === id), [leads]);

  function findColumnForLead(leadId) {
    const lead = leads.find((l) => l.id === leadId);
    return lead?.status;
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeLeadId = active.id;
    const overId = over.id;

    // Determine target status (coluna)
    let targetStatus = overId;
    
    // Se o over é um lead, encontrar a coluna desse lead
    if (!COLUMNS.find((c) => c.id === overId)) {
      targetStatus = findColumnForLead(overId);
    }

    if (!targetStatus) return;

    const activeLead = getLeadById(activeLeadId);
    if (!activeLead) return;

    // Se o status é o mesmo, não fazer nada
    if (activeLead.status === targetStatus) return;

    // Optimistic update
    const oldStatus = activeLead.status;
    setLeads((prev) =>
      prev.map((l) => (l.id === activeLeadId ? { ...l, status: targetStatus } : l))
    );

    try {
      await api.put(`/leads/${activeLeadId}`, { status: targetStatus });
    } catch {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => (l.id === activeLeadId ? { ...l, status: oldStatus } : l))
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const activeLead = activeId ? getLeadById(activeId) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">Arraste os cards para mover entre etapas</p>
      </div>

      {error && (
        <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colLeads = leads.filter((l) => l.status === col.id);
            return <Column key={col.id} column={col} leads={colLeads} />;
          })}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
