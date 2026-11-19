import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FileUp,
  Plus,
  RefreshCw,
  Search,
  Webhook,
} from 'lucide-react';
import type { Concurso, CsvImportResponse, SyncResponse } from '../types/lottery';
import { formatBRL, formatDateBR, padDezena } from '../lib/lotteryMath';
import { generateSampleCaixaCSV } from '../lib/exporters';

interface DatabaseViewProps {
  concursos: Concurso[];
  isSyncing: boolean;
  lastSyncResult: SyncResponse | null;
  onSyncNow: () => Promise<void>;
  onReloadConcursos: () => Promise<void>;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  concursos,
  isSyncing,
  lastSyncResult,
  onSyncNow,
  onReloadConcursos,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Manual concurso form
  const [manualConcurso, setManualConcurso] = useState('');
  const [manualData, setManualData] = useState('17/11/2026');
  const [manualDezenas, setManualDezenas] = useState('');
  const [manualEstimativa, setManualEstimativa] = useState('8500000');
  const [manualSavedMsg, setManualSavedMsg] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/concursos/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar CSV.');
      }
      setImportResult(data);
      await onReloadConcursos();
    } catch (err: any) {
      setImportError(err.message || 'Erro ao importar arquivo CSV.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadSampleCsv = () => {
    const csv = generateSampleCaixaCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_resultados_caixa.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSavedMsg(null);
    const nums = manualDezenas
      .split(/[\s,;\-]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
    const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
    if (unique.length !== 6) {
      setManualSavedMsg('Informe exatamente 6 dezenas distintas de 01 a 60.');
      return;
    }
    const res = await fetch('/api/concursos/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concurso: Number(manualConcurso),
        data_sorteio: manualData,
        dezenas: unique,
        estimativa_premio: Number(manualEstimativa) || 0,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setManualSavedMsg(`Concurso #${data.concurso.concurso} salvo com sucesso.`);
      setManualConcurso('');
      setManualDezenas('');
      await onReloadConcursos();
    } else {
      setManualSavedMsg(data.error || 'Erro ao salvar concurso.');
    }
  };

  const filtered = useMemo(() => {
    const desc = [...concursos].sort((a, b) => b.concurso - a.concurso);
    const q = searchTerm.trim();
    if (!q) return desc;
    return desc.filter(
      (c) =>
        String(c.concurso).includes(q) ||
        c.data_sorteio.includes(q) ||
        c.dezenas.some((d) => padDezena(d) === q.padStart(2, '0'))
    );
  }, [concursos, searchTerm]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Base de Dados & Ingestão
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Carga inicial via CSV (concursos 1 a 3087) e sincronização incremental via API das Loterias
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadSampleCsv}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#11191E] hover:bg-slate-100 dark:hover:bg-[#162127] border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar CSV Modelo (Caixa)
        </button>
      </div>

      {/* Ingestion Grid: CSV Upload + Incremental API Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Seed Card */}
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <FileUp className="w-5 h-5 text-[#208494]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Carga Inicial via CSV (resultados_ate_3087.csv)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Converte datas DD/MM/AAAA, higieniza moedas R$ e ordena Bola1..Bola6
              </p>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileUpload(f);
            }}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#208494] rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/70 dark:bg-[#162127]/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
              className="hidden"
            />
            <FileUp className="w-8 h-8 text-[#208494] mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {isImporting
                ? 'Processando e importando concursos...'
                : 'Clique ou arraste seu arquivo CSV aqui'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Suporta delimitadores ponto-e-vírgula (;) ou vírgula (,) com padrão oficial Caixa
            </div>
          </div>

          {importError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              {importError}
            </div>
          )}

          {importResult && (
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Importação concluída
              </div>
              <div className="font-mono tabular-nums">
                Novos: {importResult.imported} · Atualizados: {importResult.updated} · Ignorados:{' '}
                {importResult.skipped} · Total na base: {importResult.total}
              </div>
              {importResult.minConcurso && importResult.maxConcurso && (
                <div className="font-mono tabular-nums">
                  Faixa importada: #{importResult.minConcurso} até #{importResult.maxConcurso}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Incremental API Sync Card */}
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-[#208494]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Sincronização Incremental (API Pública)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Busca concursos posteriores ao maior número salvo sem duplicar registros
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#162127]/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Estado Atual</div>
              <div className="text-base font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                {concursos.length.toLocaleString('pt-BR')} concurso(s)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Maior concurso:{' '}
                {concursos.length > 0
                  ? `#${Math.max(...concursos.map((c) => c.concurso))}`
                  : 'Nenhum'}
              </div>
            </div>

            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncNow}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Atualizar Resultados'}
            </button>
          </div>

          {lastSyncResult && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-medium">{lastSyncResult.message}</div>
              <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Fonte: {lastSyncResult.source} · Novos: {lastSyncResult.syncedCount} · Atualizados:{' '}
                {lastSyncResult.updatedCount}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
            <Webhook className="w-4 h-4 shrink-0 mt-0.5 text-[#208494]" />
            <div>
              Suporte a chamada via webhook ou cron externo:{' '}
              <code className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] px-1.5 py-0.5 rounded">
                POST /api/sync-concursos
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Entry for Offline / Quick Testing */}
      <form
        onSubmit={handleSaveManual}
        className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#208494]" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Cadastrar / Atualizar Concurso Manualmente
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="number"
            required
            min={1}
            placeholder="Concurso (ex: 3088)"
            value={manualConcurso}
            onChange={(e) => setManualConcurso(e.target.value)}
            className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            required
            placeholder="Data (DD/MM/AAAA)"
            value={manualData}
            onChange={(e) => setManualData(e.target.value)}
            className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            required
            placeholder="6 dezenas (ex: 05 10 22 37 44 53)"
            value={manualDezenas}
            onChange={(e) => setManualDezenas(e.target.value)}
            className="sm:col-span-4 px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            min={0}
            placeholder="Estimativa prêmio (R$)"
            value={manualEstimativa}
            onChange={(e) => setManualEstimativa(e.target.value)}
            className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="sm:col-span-2 px-3 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors cursor-pointer"
          >
            Salvar Concurso
          </button>
        </div>
        {manualSavedMsg && (
          <div className="text-xs text-[#208494] dark:text-teal-400 font-medium">
            {manualSavedMsg}
          </div>
        )}
      </form>

      {/* Historical Table */}
      <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#208494]" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Histórico de Concursos ({filtered.length.toLocaleString('pt-BR')})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar concurso, data ou dezena..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {paged.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum concurso encontrado. Importe o CSV ou sincronize com a API pública acima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium py-2.5 pr-3">Concurso</th>
                  <th className="text-left font-medium py-2.5 px-3">Data</th>
                  <th className="text-left font-medium py-2.5 px-3">Dezenas</th>
                  <th className="text-right font-medium py-2.5 px-3">Soma</th>
                  <th className="text-right font-medium py-2.5 px-3">Par/Ímp.</th>
                  <th className="text-right font-medium py-2.5 px-3">Sena</th>
                  <th className="text-right font-medium py-2.5 pl-3">Rateio Sena / Acum.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paged.map((c) => (
                  <tr
                    key={c.concurso}
                    className="h-11 hover:bg-slate-50 dark:hover:bg-[#162127]/60 transition-colors"
                  >
                    <td className="py-2 pr-3 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      #{c.concurso}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatDateBR(c.data_sorteio)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        {c.dezenas.map((d) => (
                          <span
                            key={d}
                            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center"
                          >
                            {padDezena(d)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {c.soma_dezenas}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {c.qtd_pares}P/{6 - c.qtd_pares}I
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {c.ganhadores_sena}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {c.ganhadores_sena > 0
                        ? formatBRL(c.rateio_sena)
                        : formatBRL(c.acumulado_sena)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Página {page} de {totalPages}
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
    </div>
  );
};
