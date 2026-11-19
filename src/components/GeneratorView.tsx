import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Lock,
  Printer,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  Concurso,
  GeneratedGame,
  GeneratorFilters,
  ParityPattern,
} from '../types/lottery';
import {
  calculateBetCost,
  comboSignature,
  combinationsCount,
  DEFAULT_GENERATOR_FILTERS,
  formatBRL,
  generateSmartCombinations,
  padDezena,
} from '../lib/lotteryMath';
import { exportGamesToCSV, exportGamesToTXT } from '../lib/exporters';
import { VolanteGrid } from './VolanteGrid';
import { PrintA4Modal } from './PrintA4Modal';

interface GeneratorViewProps {
  concursos: Concurso[];
  fixedNumbers: number[];
  excludedNumbers: number[];
  onChangeFixed: (nums: number[]) => void;
  onChangeExcluded: (nums: number[]) => void;
  onSendGamesToBolao: (games: number[][], suggestedTitle: string) => void;
}

const ALL_PARITIES: ParityPattern[] = [
  '3P/3I',
  '4P/2I',
  '2P/4I',
  '5P/1I',
  '1P/5I',
  '6P/0I',
  '0P/6I',
];

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  concursos,
  fixedNumbers,
  excludedNumbers,
  onChangeFixed,
  onChangeExcluded,
  onSendGamesToBolao,
}) => {
  const [brushMode, setBrushMode] = useState<'cycle' | 'fixed' | 'excluded'>('cycle');
  const [gameCount, setGameCount] = useState<number>(10);
  const [dezenasPerGame, setDezenasPerGame] = useState<number>(6);
  const [unitPrice, setUnitPrice] = useState<number>(5.0);
  const [filters, setFilters] = useState<GeneratorFilters>(DEFAULT_GENERATOR_FILTERS);
  const [generated, setGenerated] = useState<GeneratedGame[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [attemptsCount, setAttemptsCount] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const historicalSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const c of concursos) {
      set.add(comboSignature(c.dezenas));
    }
    return set;
  }, [concursos]);

  const handleToggleVolante = (num: number) => {
    const isFixed = fixedNumbers.includes(num);
    const isExcluded = excludedNumbers.includes(num);

    if (brushMode === 'fixed') {
      if (isFixed) {
        onChangeFixed(fixedNumbers.filter((n) => n !== num));
      } else if (fixedNumbers.length < dezenasPerGame) {
        onChangeExcluded(excludedNumbers.filter((n) => n !== num));
        onChangeFixed([...fixedNumbers, num].sort((a, b) => a - b));
      }
      return;
    }

    if (brushMode === 'excluded') {
      if (isExcluded) {
        onChangeExcluded(excludedNumbers.filter((n) => n !== num));
      } else if (60 - excludedNumbers.length - 1 >= dezenasPerGame) {
        onChangeFixed(fixedNumbers.filter((n) => n !== num));
        onChangeExcluded([...excludedNumbers, num].sort((a, b) => a - b));
      }
      return;
    }

    // Cycle: neutral -> fixed -> excluded -> neutral
    if (!isFixed && !isExcluded) {
      if (fixedNumbers.length < dezenasPerGame) {
        onChangeFixed([...fixedNumbers, num].sort((a, b) => a - b));
      } else if (60 - excludedNumbers.length - 1 >= dezenasPerGame) {
        onChangeExcluded([...excludedNumbers, num].sort((a, b) => a - b));
      }
    } else if (isFixed) {
      onChangeFixed(fixedNumbers.filter((n) => n !== num));
      if (60 - excludedNumbers.length - 1 >= dezenasPerGame) {
        onChangeExcluded([...excludedNumbers, num].sort((a, b) => a - b));
      }
    } else {
      onChangeExcluded(excludedNumbers.filter((n) => n !== num));
    }
  };

  const toggleParity = (p: ParityPattern) => {
    setFilters((prev) => {
      const exists = prev.allowedParities.includes(p);
      const next = exists
        ? prev.allowedParities.filter((x) => x !== p)
        : [...prev.allowedParities, p];
      return { ...prev, allowedParities: next };
    });
  };

  const handleGenerate = () => {
    const result = generateSmartCombinations({
      count: gameCount,
      dezenasPerGame,
      fixedNumbers,
      excludedNumbers,
      filters,
      historicalSignatures,
      unitPrice,
    });
    setGenerated(result.games);
    setElapsedMs(result.elapsedMs);
    setAttemptsCount(result.attempts);
    setWarning(result.warning);
  };

  const singleBetCost = calculateBetCost(dezenasPerGame, 'mega-sena', unitPrice);
  const simpleEquiv = combinationsCount(dezenasPerGame, 6);
  const batchTotalCost = generated.reduce((acc, g) => acc + g.valorAposta, 0);
  const plannedBatchCost = gameCount * singleBetCost;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Gerador Inteligente de Combinações
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Trave dezenas fixas, bloqueie indesejadas e aplique filtros estatísticos em tempo real
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onChangeFixed([]);
            onChangeExcluded([]);
            setFilters(DEFAULT_GENERATOR_FILTERS);
            setWarning(undefined);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-[#11191E] hover:bg-slate-100 dark:hover:bg-[#162127] border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar Padrão
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Volante & Batch Configuration */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Volante Interativo (01 a 60)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  Fixas: {fixedNumbers.length}/{dezenasPerGame} · Excluídas:{' '}
                  {excludedNumbers.length} · Disponíveis:{' '}
                  {60 - fixedNumbers.length - excludedNumbers.length}
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-800 rounded-lg self-start">
                {(
                  [
                    { id: 'cycle', label: 'Alternar' },
                    { id: 'fixed', label: 'Fixar' },
                    { id: 'excluded', label: 'Excluir' },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBrushMode(b.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      brushMode === b.id
                        ? 'bg-[#208494] text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <VolanteGrid
              mode="fix-exclude"
              fixedNumbers={fixedNumbers}
              excludedNumbers={excludedNumbers}
              onToggleNumber={handleToggleVolante}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#208494] inline-block" />
                  Fixa (obrigatória)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/60 inline-block" />
                  Excluída
                </span>
              </div>
              {(fixedNumbers.length > 0 || excludedNumbers.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeFixed([]);
                    onChangeExcluded([]);
                  }}
                  className="text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
                >
                  Limpar marcações
                </button>
              )}
            </div>
          </div>

          {/* Batch Size & Cost Configuration */}
          <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label
                htmlFor="gen-count"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Quantidade de Jogos (1–50)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="gen-count"
                  type="range"
                  min={1}
                  max={50}
                  value={gameCount}
                  onChange={(e) => setGameCount(Number(e.target.value))}
                  className="flex-1 accent-[#208494]"
                />
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={gameCount}
                  onChange={(e) =>
                    setGameCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                  }
                  className="w-16 px-2.5 py-1.5 text-sm font-mono tabular-nums text-center bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="gen-dezenas"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Dezenas por Jogo (6–15)
              </label>
              <select
                id="gen-dezenas"
                value={dezenasPerGame}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setDezenasPerGame(next);
                  if (fixedNumbers.length > next) {
                    onChangeFixed(fixedNumbers.slice(0, next));
                  }
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                {Array.from({ length: 10 }, (_, i) => i + 6).map((k) => (
                  <option key={k} value={k}>
                    {k} dezenas ({combinationsCount(k, 6).toLocaleString('pt-BR')}x)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="gen-unit-price"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Aposta Simples (6 dez.)
              </label>
              <div className="flex items-center justify-between gap-2">
                <input
                  id="gen-unit-price"
                  type="number"
                  step="0.5"
                  min="1"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Math.max(1, Number(e.target.value) || 5))}
                  className="w-24 px-2.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total ({simpleEquiv}x/jogo)
                  </div>
                  <div className="text-sm font-mono tabular-nums font-semibold text-[#208494] dark:text-teal-400">
                    {formatBRL(plannedBatchCost)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Heuristic Filters */}
        <div className="xl:col-span-5 bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Filtros Heurísticos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Presets estatísticos recomendados pré-selecionados
            </p>
          </div>

          {/* Parity Filter */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/70">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Equilíbrio Par / Ímpar
              </span>
              <input
                type="checkbox"
                checked={filters.useParityFilter}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, useParityFilter: e.target.checked }))
                }
                className="w-4 h-4 accent-[#208494] rounded cursor-pointer"
              />
            </label>
            {filters.useParityFilter && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_PARITIES.map((pat) => {
                  const active = filters.allowedParities.includes(pat);
                  return (
                    <button
                      key={pat}
                      type="button"
                      onClick={() => toggleParity(pat)}
                      className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#208494] text-white border-[#238B8B]'
                          : 'bg-slate-50 dark:bg-[#162127] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {pat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sum Range Filter */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/70">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Faixa de Soma (base 6 dezenas)
              </span>
              <input
                type="checkbox"
                checked={filters.useSumFilter}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, useSumFilter: e.target.checked }))
                }
                className="w-4 h-4 accent-[#208494] rounded cursor-pointer"
              />
            </label>
            {filters.useSumFilter && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Soma Mínima
                  </span>
                  <input
                    type="number"
                    min={21}
                    max={345}
                    value={filters.minSum}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        minSum: Math.max(21, Number(e.target.value) || 21),
                      }))
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Soma Máxima
                  </span>
                  <input
                    type="number"
                    min={21}
                    max={345}
                    value={filters.maxSum}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        maxSum: Math.min(345, Number(e.target.value) || 345),
                      }))
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Boolean Heuristic Toggles */}
          <div className="space-y-3">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Anti-Sequência (máx. 2 consecutivas)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Bloqueia trios ou quadras seguidas (ex.: 12-13-14)
                </div>
              </div>
              <input
                type="checkbox"
                checked={filters.antiSequence}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, antiSequence: e.target.checked }))
                }
                className="w-4 h-4 mt-1 accent-[#208494] rounded cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Distribuição por Linhas e Quadrantes
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Evita concentração excessiva em uma única linha ou quadrante
                </div>
              </div>
              <input
                type="checkbox"
                checked={filters.lineQuadrantBalance}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, lineQuadrantBalance: e.target.checked }))
                }
                className="w-4 h-4 mt-1 accent-[#208494] rounded cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Filtro Inédito na História
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Descarta combinações já sorteadas nos {concursos.length.toLocaleString('pt-BR')}{' '}
                  concursos da base
                </div>
              </div>
              <input
                type="checkbox"
                checked={filters.uniqueHistorical}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, uniqueHistorical: e.target.checked }))
                }
                className="w-4 h-4 mt-1 accent-[#208494] rounded cursor-pointer shrink-0"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Gerar {gameCount} {gameCount === 1 ? 'Combinação' : 'Combinações'}
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      {warning && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 rounded-xl px-4 py-3 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      {/* Generated Games Output */}
      {generated.length > 0 && (
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Lote Gerado ({generated.length} jogos)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                Custo total: {formatBRL(batchTotalCost)} · Tempo: {elapsedMs}ms ({attemptsCount?.toLocaleString('pt-BR')}{' '}
                amostras)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onSendGamesToBolao(
                    generated.map((g) => g.dezenas),
                    `Bolão Gerador (${generated.length} jogos)`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Criar Bolão
              </button>
              <button
                type="button"
                onClick={() =>
                  exportGamesToTXT(
                    generated.map((g) => g.dezenas),
                    'megasena_gerador'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                TXT
              </button>
              <button
                type="button"
                onClick={() => exportGamesToCSV(generated, 'megasena_gerador')}
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

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium py-2 pr-3">#</th>
                  <th className="text-left font-medium py-2 pr-3">Dezenas</th>
                  <th className="text-right font-medium py-2 px-3">Soma</th>
                  <th className="text-right font-medium py-2 px-3">Par/Ímpar</th>
                  <th className="text-right font-medium py-2 px-3">Inédito</th>
                  <th className="text-right font-medium py-2 pl-3">Aposta</th>
                  <th className="text-right font-medium py-2 pl-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {generated.map((game, idx) => (
                  <tr
                    key={game.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#162127]/60 transition-colors"
                  >
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {game.dezenas.map((d) => {
                          const isFixed = fixedNumbers.includes(d);
                          return (
                            <span
                              key={d}
                              className={`w-7 h-7 rounded-full font-mono tabular-nums text-xs font-semibold flex items-center justify-center ${
                                isFixed
                                  ? 'bg-[#208494] text-white ring-2 ring-[#208494]/30'
                                  : 'bg-slate-100 dark:bg-[#162127] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                              }`}
                              title={isFixed ? 'Dezena fixa' : undefined}
                            >
                              {padDezena(d)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                      {game.soma}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                      {game.pares}P/{game.impares}I
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {game.inedito ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          Já saiu
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-slate-100">
                      {formatBRL(game.valorAposta)}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setGenerated((prev) => prev.filter((item) => item.id !== game.id))
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                        aria-label={`Remover jogo ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fixedNumbers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <Lock className="w-3.5 h-3.5 text-[#208494]" />
              <span>
                Dezenas fixas aplicadas em todos os jogos:{' '}
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {fixedNumbers.map(padDezena).join(', ')}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {showPrintModal && (
        <PrintA4Modal
          title="LotoMetria — Volantes Gerados"
          subtitle={`${generated.length} jogo(s) de ${dezenasPerGame} dezenas`}
          games={generated.map((g) => ({ dezenas: g.dezenas, valorAposta: g.valorAposta }))}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
