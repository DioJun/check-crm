import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  pointerWithin,
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
import { ChevronRight, X, MoreVertical, Trash2, Eye } from 'lucide-react';
import api from '../services/api';
import WhatsAppButton from '../components/ui/WhatsAppButton';

const COLUMNS = [
  { id: 'novo', label: 'Novo', color: 'bg-blue-500', light: 'bg-blue-50 border-blue-200' },
  { id: 'sem_contato', label: 'Sem Contato', color: 'bg-red-500', light: 'bg-red-50 border-red-200' },
  { id: 'contatado', label: 'Contatado', color: 'bg-yellow-500', light: 'bg-yellow-50 border-yellow-200' },
  { id: 'interessado', label: 'Interessado (Negociação)', color: 'bg-orange-500', light: 'bg-orange-50 border-orange-200' },
  { id: 'fechado', label: 'Fechado', color: 'bg-green-500', light: 'bg-green-50 border-green-200' },
];

function LeadCard({ lead, isDragging = false, onMoveClick, onDeleteClick, onViewClick }) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm ${
        isDragging ? 'opacity-50 rotate-1' : 'hover:shadow-md'
      } transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">{lead.nome}</p>
          {lead.servico && <p className="text-xs text-gray-500 mt-0.5">{lead.servico}</p>}
          {lead.cidade && <p className="text-xs text-gray-400">{lead.cidade}</p>}
          <div className="mt-2">
            <WhatsAppButton telefone={lead.telefone} nome={lead.nome} className="!py-1 !px-2 !text-xs" />
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewClick(lead);
            }}
            className="p-1 hover:bg-blue-50 rounded-lg transition-colors text-gray-400 hover:text-blue-600 pointer-events-auto z-10 relative"
            title="Visualizar detalhes"
            type="button"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteClick(lead);
            }}
            className="p-1 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600 pointer-events-auto z-10 relative"
            title="Deletar lead"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveClick(lead);
            }}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 pointer-events-auto z-10 relative"
            title="Mover para outro status"
            type="button"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableCard({ lead, onMoveClick, onDeleteClick, onViewClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <LeadCard lead={lead} isDragging={isDragging} onMoveClick={onMoveClick} onDeleteClick={onDeleteClick} onViewClick={onViewClick} />
    </div>
  );
}

function Column({ column, leads, onMoveClick, onDeleteClick, onViewClick }) {
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
              <SortableCard key={lead.id} lead={lead} onMoveClick={onMoveClick} onDeleteClick={onDeleteClick} onViewClick={onViewClick} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [viewedLead, setViewedLead] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 20,
      },
    })
  );

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

  async function handleMoveToStatus(newStatus) {
    if (!selectedLead || selectedLead.status === newStatus) {
      setSelectedLead(null);
      return;
    }

    setUpdatingStatus(true);
    try {
      const oldStatus = selectedLead.status;
      
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, status: newStatus } : l))
      );
      
      await api.put(`/leads/${selectedLead.id}`, { status: newStatus });
      setSelectedLead(null);
    } catch {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, status: selectedLead.status } : l))
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeleteLead(lead) {
    if (!window.confirm(`Tem certeza que deseja deletar o lead "${lead.nome}"?`)) {
      return;
    }

    setDeletingId(lead.id);
    try {
      await api.delete(`/leads/${lead.id}`);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setError('');
    } catch (err) {
      setError(`Erro ao deletar lead: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeletingId(null);
    }
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

      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => {
              const colLeads = leads.filter((l) => l.status === col.id);
              return <Column key={col.id} column={col} leads={colLeads} onMoveClick={setSelectedLead} onDeleteClick={handleDeleteLead} onViewClick={setViewedLead} />;
            })}
          </div>

          <DragOverlay>
            {activeLead ? <LeadCard lead={activeLead} onMoveClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* View Lead Modal/Popup */}
      {viewedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{viewedLead.nome}</h2>
              <button
                onClick={() => setViewedLead(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Telefone</p>
                  <p className="text-sm text-gray-900">{viewedLead.telefone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Cidade</p>
                  <p className="text-sm text-gray-900">{viewedLead.cidade || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Serviço</p>
                  <p className="text-sm text-gray-900">{viewedLead.servico || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Status</p>
                  <p className="text-sm text-gray-900 capitalize">{viewedLead.status || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Origem</p>
                  <p className="text-sm text-gray-900">{viewedLead.origem || '-'}</p>
                </div>
                {viewedLead.avaliacao && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Avaliação</p>
                    <p className="text-sm text-yellow-600">⭐ {viewedLead.avaliacao}</p>
                  </div>
                )}
              </div>
              {viewedLead.site && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Site</p>
                  <a href={viewedLead.site} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline">
                    {viewedLead.site}
                  </a>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setViewedLead(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setViewedLead(null);
                  navigate(`/leads/${viewedLead.id}`);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Ver Completo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Move Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl p-0">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">{selectedLead.nome}</h3>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-2 max-h-96 overflow-y-auto">
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleMoveToStatus(col.id)}
                  disabled={updatingStatus || selectedLead.status === col.id}
                  className={`w-full px-4 py-3 rounded-lg flex items-center justify-between text-sm font-medium transition-colors ${
                    selectedLead.status === col.id
                      ? 'bg-gray-100 text-gray-600'
                      : `${col.light} text-gray-900 hover:opacity-80`
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>{col.label}</span>
                  {selectedLead.status !== col.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedLead(null)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

