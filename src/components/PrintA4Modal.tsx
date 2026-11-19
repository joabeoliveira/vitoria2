import React from 'react';
import { Printer, X } from 'lucide-react';
import { formatBRL, padDezena } from '../lib/lotteryMath';

interface PrintGameItem {
  dezenas: number[];
  valorAposta?: number;
}

interface PrintA4ModalProps {
  title: string;
  subtitle?: string;
  games: PrintGameItem[];
  onClose: () => void;
}

export const PrintA4Modal: React.FC<PrintA4ModalProps> = ({
  title,
  subtitle,
  games,
  onClose,
}) => {
  const totalCost = games.reduce((acc, g) => acc + (g.valorAposta ?? 5.0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="bg-white text-slate-900 w-full max-w-4xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Non-printable action bar */}
        <div className="no-print flex items-center justify-between gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Visualização de Impressão A4
            </h3>
            <p className="text-xs text-slate-500">
              {games.length} jogo(s) · Total estimado: {formatBRL(totalCost)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir A4
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              aria-label="Fechar visualização de impressão"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div className="p-8 space-y-6 bg-white text-slate-900">
          <div className="flex items-end justify-between border-b border-slate-300 pb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
            </div>
            <div className="text-right text-xs text-slate-600 font-mono tabular-nums">
              <div>{games.length} volante(s)</div>
              <div>Custo ref.: {formatBRL(totalCost)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {games.map((g, index) => {
              const set = new Set(g.dezenas);
              return (
                <div
                  key={index}
                  className="print-break-inside-avoid border border-slate-300 rounded-lg p-3.5"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
                    <span className="font-mono">
                      Jogo {String(index + 1).padStart(2, '0')} ({g.dezenas.length} dezenas)
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {g.dezenas.map(padDezena).join(' · ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 60 }, (_, i) => {
                      const n = i + 1;
                      const marked = set.has(n);
                      return (
                        <div
                          key={n}
                          className={`h-6 text-[11px] font-mono tabular-nums flex items-center justify-center rounded border ${
                            marked
                              ? 'bg-slate-900 text-white border-slate-900 font-bold'
                              : 'bg-white text-slate-400 border-slate-200'
                          }`}
                        >
                          {padDezena(n)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500">
            LotoMetria · Folha de conferência e marcação auxiliar sem vínculo com a Caixa Econômica Federal.
          </div>
        </div>
      </div>
    </div>
  );
};
