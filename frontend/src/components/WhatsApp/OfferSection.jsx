import { Gift, ClipboardCopy, Check } from 'lucide-react';

/**
 * OfferSection — bloco de sugestão de oferta (destaque)
 * Mostra o produto, preço, motivo do match e botão "Copiar proposta".
 */
export default function OfferSection({ ofertas = [], onCopyProposal, copiedOfferId }) {
  if (!ofertas || ofertas.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-4 h-4 text-gold-700" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Sugestão de oferta
        </p>
      </div>
      <div className="space-y-2">
        {ofertas.map((oferta) => (
          <div key={oferta.produto.id} className="border border-gold-200 bg-gold-50/40 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">{oferta.produto.nome}</p>
                <p className="text-sm font-semibold text-gold-700">
                  R$ {Number(oferta.produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {oferta.produto.condicoes && (
                    <span className="text-xs font-normal text-gray-500"> · {oferta.produto.condicoes}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{oferta.motivo}</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{oferta.produto.descricao}</p>
            {onCopyProposal && (
              <button
                onClick={() => onCopyProposal(oferta)}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gold-700 hover:bg-gold-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {copiedOfferId === oferta.produto.id ? (
                  <><Check className="w-3.5 h-3.5" /> Proposta copiada!</>
                ) : (
                  <><ClipboardCopy className="w-3.5 h-3.5" /> Copiar proposta</>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
