import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Database,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type { Concurso } from '../types/lottery';
import {
  calculateDashboardStats,
  formatBRL,
  formatDateBR,
  padDezena,
} from '../lib/lotteryMath';

interface DashboardViewProps {
  concursos: Concurso[];
  isLoading: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onNavigateTab: (tab: 'generator' | 'closures' | 'boloes' | 'database') => void;
  onSendNumberToGenerator: (num: number, kind: 'fixed' | 'excluded') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  concursos,
  isLoading,
  isSyncing,
  onSyncNow,
  onNavigateTab,
  onSendNumberToGenerator,
}) => {
  const [period, setPeriod] = useState<'10' | '50' | '100' | 'all'>('all');
  const [hoveredSumIdx, setHoveredSumIdx] = useState<number | null>(null);

  const stats = useMemo(
    () => calculateDashboardStats(concursos, period),
    [concursos, period]
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80"
            />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80" />
      </div>
    );
  }

  if (concursos.length === 0) {
    return (
      <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-[#208494]/15 text-[#208494] flex items-center justify-center mx-auto mb-4">
          <Database className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Nenhum concurso carregado na base histórica
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
          Importe o arquivo oficial <span className="font-mono">resultados_ate_3087.csv</span> ou
          sincronize diretamente com a API pública de resultados para habilitar o ranking de
          frequência, mapa de atraso e curvas de distribuição.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => onNavigateTab('database')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Importar CSV (1 a 3087)
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSyncNow}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar API Pública'}
          </button>
        </div>
      </div>
    );
  }

  const latest = stats.latestConcurso;
  const maxSumCount = Math.max(1, ...stats.sumDistribution.map((b) => b.count));
  const maxHotCount = Math.max(1, stats.hotNumbers[0]?.count ?? 1);
  const balancedTotalPct = stats.parityDistribution
    .filter((p) => p.balanced)
    .reduce((acc, p) => acc + p.percentage, 0);

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Dashboard Estatístico Histórico
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Análise baseada em {stats.periodConcursos.toLocaleString('pt-BR')} de{' '}
            {stats.totalConcursos.toLocaleString('pt-BR')} concursos sincronizados
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#11191E] border border-slate-200 dark:border-slate-800 rounded-lg self-start"
          role="tablist"
          aria-label="Filtro de período histórico"
        >
          {(
            [
              { id: '10', label: 'Últimos 10' },
              { id: '50', label: 'Últimos 50' },
              { id: '100', label: 'Últimos 100' },
              { id: 'all', label: 'Todo o Histórico' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={period === opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                period === opt.id
                  ? 'bg-[#208494] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Último Concurso
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              #{latest?.concurso}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {formatDateBR(latest?.data_sorteio ?? '')}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {latest?.dezenas.map((d) => (
              <span
                key={d}
                className="w-7 h-7 rounded-full bg-[#208494] text-white font-mono tabular-nums text-xs font-semibold flex items-center justify-center"
              >
                {padDezena(d)}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Próximo Prêmio Estimado
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#208494] dark:text-teal-400">
            {formatBRL(latest?.estimativa_premio ?? 0)}
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <span
              className={`font-medium ${
                (latest?.ganhadores_sena ?? 0) === 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {(latest?.ganhadores_sena ?? 0) === 0
                ? 'Acumulado'
                : `${latest?.ganhadores_sena} ganhador(es) na Sena`}
            </span>
            {(latest?.acumulado_sena ?? 0) > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Acum.: {formatBRL(latest?.acumulado_sena ?? 0)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Faixa Interquartil da Soma
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {stats.q1Sum} – {stats.q3Sum}
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            Média: {stats.meanSum} · Mediana: {stats.medianSum}
          </div>
        </div>

        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Equilíbrio Par/Ímpar
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {balancedTotalPct.toFixed(1)}%
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            Cobertura de 3P/3I, 4P/2I e 2P/4I no período
          </div>
        </div>
      </div>

      {/* Latest Draw Rateio Breakdown */}
      {latest && (
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Rateio Concurso #{latest.concurso}
            </span>
            {latest.cidade_uf && (
              <span className="text-slate-500 dark:text-slate-400"> · {latest.cidade_uf}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Sena (6 acertos)</div>
              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {latest.ganhadores_sena} · {formatBRL(latest.rateio_sena)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Quina (5 acertos)</div>
              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {latest.ganhadores_quina.toLocaleString('pt-BR')} · {formatBRL(latest.rateio_quina)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Quadra (4 acertos)</div>
              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {latest.ganhadores_quadra.toLocaleString('pt-BR')} · {formatBRL(latest.rateio_quadra)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row: Sum Distribution & Parity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Curva de Soma das Dezenas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Destaque em verde-petróleo para a faixa interquartil padrão (155 a 211 · Média{' '}
                {stats.meanSum})
              </p>
            </div>
          </div>

          <div className="relative h-56 flex items-end gap-2 pt-6 pb-1">
            {stats.sumDistribution.map((bucket, idx) => {
              const heightPct = Math.max(4, Math.round((bucket.count / maxSumCount) * 100));
              const sharePct =
                stats.periodConcursos > 0
                  ? ((bucket.count / stats.periodConcursos) * 100).toFixed(1)
                  : '0.0';
              return (
                <div
                  key={bucket.label}
                  onMouseEnter={() => setHoveredSumIdx(idx)}
                  onMouseLeave={() => setHoveredSumIdx(null)}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative"
                >
                  {hoveredSumIdx === idx && (
                    <div className="absolute -top-2 z-10 px-2 py-1 rounded bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-mono tabular-nums whitespace-nowrap shadow">
                      {bucket.count} jogos ({sharePct}%)
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center h-40">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[38px] rounded-t-md transition-opacity ${
                        bucket.inIQR
                          ? 'bg-[#208494] group-hover:opacity-90'
                          : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-600'
                      }`}
                    />
                  </div>
                  <span className="mt-2 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 text-center leading-tight">
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Proporção Pares / Ímpares
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Padrões de equilíbrio (2P/4I, 3P/3I, 4P/2I) destacados em teal
            </p>
          </div>

          <div className="space-y-3">
            {stats.parityDistribution.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-mono tabular-nums font-medium ${
                      row.balanced
                        ? 'text-[#208494] dark:text-teal-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {row.label}
                  </span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {row.count.toLocaleString('pt-BR')} ({row.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#162127] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, row.percentage * 2.2)}%` }}
                    className={`h-full rounded-full ${
                      row.balanced ? 'bg-[#208494]' : 'bg-slate-400 dark:bg-slate-600'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hot, Cold, and Delay Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 10 Quentes */}
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Dezenas Quentes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mais sorteadas · Clique para fixar no gerador
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#208494]" />
          </div>
          <div className="space-y-2.5">
            {stats.hotNumbers.map((item) => (
              <button
                key={item.dezena}
                type="button"
                onClick={() => onSendNumberToGenerator(item.dezena, 'fixed')}
                className="w-full flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-[#162127] p-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="w-8 h-8 rounded-full bg-[#208494] text-white font-mono tabular-nums text-xs font-semibold flex items-center justify-center shrink-0">
                  {padDezena(item.dezena)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {item.count} sorteios
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#162127] overflow-hidden">
                    <div
                      style={{ width: `${Math.round((item.count / maxHotCount) * 100)}%` }}
                      className="h-full bg-[#208494] rounded-full"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Top 10 Frias */}
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Dezenas Frias
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Menos sorteadas · Clique para excluir no gerador
              </p>
            </div>
            <ArrowDownRight className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-2.5">
            {stats.coldNumbers.map((item) => (
              <button
                key={item.dezena}
                type="button"
                onClick={() => onSendNumberToGenerator(item.dezena, 'excluded')}
                className="w-full flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-[#162127] p-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono tabular-nums text-xs font-semibold flex items-center justify-center shrink-0">
                  {padDezena(item.dezena)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {item.count} sorteios
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#162127] overflow-hidden">
                    <div
                      style={{ width: `${Math.round((item.count / maxHotCount) * 100)}%` }}
                      className="h-full bg-slate-400 dark:bg-slate-600 rounded-full"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mapa de Atraso */}
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Mapa de Atraso
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dezenas há mais concursos consecutivos sem sair
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium pb-2">Dezena</th>
                  <th className="text-right font-medium pb-2">Atraso</th>
                  <th className="text-right font-medium pb-2">Último Conc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stats.mostDelayed.map((item) => (
                  <tr
                    key={item.dezena}
                    className="h-9 hover:bg-slate-50 dark:hover:bg-[#162127]/70 transition-colors"
                  >
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => onSendNumberToGenerator(item.dezena, 'fixed')}
                        className="inline-flex items-center gap-2 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 hover:text-[#208494] cursor-pointer"
                        title="Fixar no Gerador"
                      >
                        <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                          {padDezena(item.dezena)}
                        </span>
                      </button>
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                      {item.delay} conc.
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.lastConcurso ? `#${item.lastConcurso}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
