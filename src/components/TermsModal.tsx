import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface TermsModalProps {
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#208494] shrink-0" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Termos de Uso e Aviso Legal
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
            aria-label="Fechar termos de uso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            <strong>1. Natureza Independente:</strong> A plataforma <strong>LotoMetria</strong> é
            uma ferramenta independente de análise estatística, geração combinatória e organização
            de bolões entre grupos privados, <strong>sem qualquer vínculo com a Caixa Econômica Federal</strong>.
          </p>
          <p>
            <strong>2. Ausência de Apostas Financeiras:</strong> Este aplicativo{' '}
            <strong>não realiza apostas online</strong>, não intermedia pagamentos oficiais e não
            emite bilhetes válidos em casas lotéricas. Os volantes gerados e exportados servem
            exclusivamente como apoio para registro presencial ou pelos canais oficiais autorizados.
          </p>
          <p>
            <strong>3. Sem Garantia de Premiação:</strong> Filtros heurísticos, estatísticas
            históricas e fechamentos combinatórios reduzem redundâncias e organizam combinações com
            critérios matemáticos condicionais, porém <strong>não garantem premiações</strong> em
            sorteios aleatórios futuros.
          </p>
          <p>
            <strong>4. Responsabilidade dos Bolões:</strong> A arrecadação, guarda de comprovantes e
            rateio de eventuais prêmios entre participantes são de exclusiva responsabilidade do
            organizador do grupo.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
