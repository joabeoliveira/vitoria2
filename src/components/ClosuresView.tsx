import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Grid,
  Printer,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  applyClosureMatrix,
  CLOSURE_PRESET_DEFS,
  generateAllCombinations,
  getClosurePreset,
} from '../lib/closures';
import { combinationsCount, formatBRL, padDezena } from '../lib/lotteryMath';
import { exportGamesToCSV, exportGamesToTXT } from '../lib/exporters';
import { VolanteGrid } from './VolanteGrid';
import { PrintA4Modal } from './PrintA4Modal';

interface ClosuresViewProps {
  onSendGamesToBolao: (games: number[][], suggestedTitle: string) => void;
}

export const ClosuresView: React.FC<ClosuresViewProps> = ({ onSendGamesToBolao }) => {
  const [mode, setMode] = useState<'reduced' | 'complete'>('reduced');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('10-quadra-4');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([
    5, 10, 17, 23, 27, 33, 37, 42, 53, 58,
  ]);
  const [page, setPage] = useState(1);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const activePreset = useMemo(() => {
    if (mode !== 'reduced') return null;
    return getClosurePreset(selectedPresetId);
  }, [mode, selectedPresetId]);

  const targetCount = mode === 'reduced' ? activePreset?.selectedCount ?? 10 : 12;

  const handleToggleNumber = (num: number) => {
    setPage(1);
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers((prev) => prev.filter((n) => n !== num));
    } else {
      const maxAllowed = mode === 'reduced' ? targetCount : 12;
      if (selectedNumbers.length < maxAllowed) {
        setSelectedNumbers((prev) => [...prev, num].sort((a, b) => a - b));
      }
    }
  };

  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    setPage(1);
    const presetDef = CLOSURE_PRESET_DEFS.find((d) => d.id === id);
    if (presetDef && selectedNumbers.length > presetDef.selectedCount) {
      setSelectedNumbers((prev) => prev.slice(0, presetDef.selectedCount));
    }
  };

  const handleAutoFill = () => {
    const needed = mode === 'reduced' ? targetCount : Math.max(7, selectedNumbers.length || 8);
    const pool = Array.from({ length: 60 }, (_, i) => i + 1).filter(
      (n) => !selectedNumbers.includes(n)
    );
    const next = [...selectedNumbers];
    while (next.length < needed && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      next.push(pool.splice(idx, 1)[0]);
    }
    setSelectedNumbers(next.sort((a, b) => a - b));
    setPage(1);
  };

  const generatedGames: number[][] = useMemo(() => {
    if (mode === 'complete') {
      if (selectedNumbers.length < 7 || selectedNumbers.length > 12) return [];
      return generateAllCombinations(selectedNumbers, 6);
    }
    if (!activePreset || selectedNumbers.length !== activePreset.selectedCount) return [];
    return applyClosureMatrix(selectedNumbers, activePreset.indicesMatrix);
  }, [mode, selectedNumbers, activePreset]);

  const unitPrice = 5.0;
  const totalCost = generatedGames.length * unitPrice;
  const pageSize = 40;
  const totalPages = Math.max(1, Math.ceil(generatedGames.length / pageSize));
  const pagedGames = generatedGames.slice((page - 1) * pageSize, page * pageSize);

  const completeCombinations =
    selectedNumbers.length >= 6 ? combinationsCount(selectedNumbers.length, 6) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Desdobramentos e Fechamentos
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Combine todas as dezenas em C(n,6) ou aplique matrizes matemáticas reduzidas com garantia condicional
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#11191E] border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => {
              setMode('reduced');
              setPage(1);
              const def = CLOSURE_PRESET_DEFS.find((d) => d.id === selectedPresetId);
              if (def && selectedNumbers.length > def.selectedCount) {
                setSelectedNumbers((prev) => prev.slice(0, def.selectedCount));
              }
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'reduced'
                ? 'bg-[#208494] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Fechamento Reduzido
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('complete');
              setPage(1);
              if (selectedNumbers.length > 12) {
                setSelectedNumbers((prev) => prev.slice(0, 12));
              }
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'complete'
                ? 'bg-[#208494] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Desdobramento Completo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Matrix Selection or Complete Stats */}
        <div className="xl:col-span-5 space-y-4">
          {mode === 'reduced' ? (
            <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Matrizes Matemáticas (8 a 15 dezenas)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Selecione a matriz desejada e marque exatamente a quantidade indicada no volante
                </p>
              </div>

              <div className="space-y-2">
                {CLOSURE_PRESET_DEFS.map((def) => {
                  const preset = getClosurePreset(def.id);
                  const active = selectedPresetId === def.id;
                  return (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => handleSelectPreset(def.id)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#208494]/10 border-[#208494] text-slate-900 dark:text-white'
                          : 'bg-slate-50 dark:bg-[#162127]/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {def.selectedCount} dezenas → {preset?.ticketCount} jogos
                        </span>
                        <span className="text-xs font-mono tabular-nums text-[#208494] dark:text-teal-400 font-semibold">
                          -{preset?.savingsPercent}% custo
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {def.guaranteeLabel} · Economia frente a{' '}
                        <span className="font-mono tabular-nums">
                          {preset?.fullCombinations.toLocaleString('pt-BR')}
                        </span>{' '}
                        jogos completos
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-[#208494]" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Desdobramento Completo C(n, 6)
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Selecione de 7 a 12 dezenas no volante ao lado para gerar todas as combinações de 6
                números possíveis e visualizar o custo exato em apostas simples.
              </p>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 text-xs">
                {[7, 8, 9, 10, 11, 12].map((n) => {
                  const qty = combinationsCount(n, 6);
                  const isCurrent = selectedNumbers.length === n;
                  return (
                    <div
                      key={n}
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded ${
                        isCurrent
                          ? 'bg-[#208494]/15 text-[#208494] dark:text-teal-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="font-mono tabular-nums">
                        C({n}, 6) — {n} dezenas
                      </span>
                      <span className="font-mono tabular-nums">
                        {qty.toLocaleString('pt-BR')} jogos · {formatBRL(qty * unitPrice)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Volante Selector & Summary */}
        <div className="xl:col-span-7 bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Seleção de Dezenas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                {mode === 'reduced'
                  ? `Selecionadas: ${selectedNumbers.length} de ${targetCount} dezenas exigidas`
                  : `Selecionadas: ${selectedNumbers.length} dezenas (mín. 7, máx. 12)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoFill}
                className="px-3 py-1.5 text-xs font-medium text-[#208494] dark:text-teal-400 bg-[#208494]/10 hover:bg-[#208494]/20 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Completar Aleatório
              </button>
              {selectedNumbers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNumbers([]);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <VolanteGrid
            mode="select"
            selectedNumbers={selectedNumbers}
            onToggleNumber={handleToggleNumber}
          />

          {/* Live Summary Strip */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Dezenas Selecionadas</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {selectedNumbers.length > 0
                  ? selectedNumbers.map(padDezena).join(' · ')
                  : 'Nenhuma'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Jogos Gerados</div>
              <div className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                {generatedGames.length.toLocaleString('pt-BR')}
                {mode === 'reduced' && activePreset && generatedGames.length > 0 && (
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    {' '}
                    (vs {completeCombinations.toLocaleString('pt-BR')})
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Custo Total Estimado</div>
              <div className="text-lg font-mono tabular-nums font-bold text-[#208494] dark:text-teal-400 mt-0.5">
                {formatBRL(totalCost)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Tickets Table */}
      {generatedGames.length > 0 ? (
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#208494] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {mode === 'reduced'
                    ? `Matriz Aplicada: ${activePreset?.guaranteeLabel}`
                    : `Desdobramento Completo (${generatedGames.length} combinações)`}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {mode === 'reduced'
                    ? activePreset?.description
                    : `Todas as combinações de 6 dezenas para os ${selectedNumbers.length} números escolhidos.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onSendGamesToBolao(
                    generatedGames,
                    mode === 'reduced'
                      ? `Bolão Fechamento ${selectedNumbers.length} dez.`
                      : `Bolão Desdobramento ${selectedNumbers.length} dez.`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Criar Bolão
              </button>
              <button
                type="button"
                onClick={() => exportGamesToTXT(generatedGames, 'megasena_fechamento')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                TXT
              </button>
              <button
                type="button"
                onClick={() =>
                  exportGamesToCSV(
                    generatedGames.map((dezenas) => ({ dezenas, valorAposta: unitPrice })),
                    'megasena_fechamento'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir A4
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pagedGames.map((dezenas, idx) => {
              const globalIdx = (page - 1) * pageSize + idx + 1;
              const soma = dezenas.reduce((acc, n) => acc + n, 0);
              return (
                <div
                  key={globalIdx}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#162127]/70 border border-slate-200/70 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono tabular-nums text-slate-400 w-7">
                      {String(globalIdx).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {dezenas.map((d) => (
                        <span
                          key={d}
                          className="w-7 h-7 rounded-full bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono tabular-nums text-xs font-semibold flex items-center justify-center"
                        >
                          {padDezena(d)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                    Σ {soma}
                  </span>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Página {page} de {totalPages} ({generatedGames.length} jogos)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {mode === 'reduced'
            ? `Selecione ${targetCount} dezenas no volante acima (ou clique em "Completar Aleatório") para gerar os ${activePreset?.ticketCount} jogos do fechamento.`
            : 'Selecione entre 7 e 12 dezenas no volante acima para visualizar todas as combinações C(n,6).'}
        </div>
      )}

      {showPrintModal && (
        <PrintA4Modal
          title="LotoMetria — Fechamento Lotérico"
          subtitle={`${generatedGames.length} jogo(s) gerados a partir de ${selectedNumbers.length} dezenas`}
          games={generatedGames.map((dezenas) => ({ dezenas, valorAposta: unitPrice }))}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
