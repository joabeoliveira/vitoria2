import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  MessageSquare,
  Plus,
  Printer,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import type { Bolao, Concurso } from '../types/lottery';
import { formatBRL, formatDateBR, padDezena } from '../lib/lotteryMath';
import {
  exportGamesToCSV,
  exportGamesToTXT,
  formatWhatsAppSummary,
} from '../lib/exporters';
import { PrintA4Modal } from './PrintA4Modal';

interface BoloesViewProps {
  boloes: Bolao[];
  concursos: Concurso[];
  pendingGames: number[][] | null;
  pendingTitle: string | null;
  onClearPendingGames: () => void;
  onRefreshBoloes: () => Promise<void>;
}

export const BoloesView: React.FC<BoloesViewProps> = ({
  boloes,
  concursos,
  pendingGames,
  pendingTitle,
  onClearPendingGames,
  onRefreshBoloes,
}) => {
  const latestConcursoNum = useMemo(() => {
    if (concursos.length === 0) return 3088;
    return Math.max(...concursos.map((c) => c.concurso)) + 1;
  }, [concursos]);

  const [selectedId, setSelectedId] = useState<string | null>(boloes[0]?.id ?? null);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newTitulo, setNewTitulo] = useState('');
  const [newConcursoAlvo, setNewConcursoAlvo] = useState<number>(latestConcursoNum);
  const [newCotasTotais, setNewCotasTotais] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Participant form
  const [partNome, setPartNome] = useState('');
  const [partTelefone, setPartTelefone] = useState('');
  const [partCotas, setPartCotas] = useState(1);
  const [partPago, setPartPago] = useState(false);

  // Manual games paste form
  const [manualGamesText, setManualGamesText] = useState('');

  // Conferidor state
  const [checkMode, setCheckMode] = useState<'db' | 'manual'>('db');
  const [checkConcursoNum, setCheckConcursoNum] = useState<string>('');
  const [manualDrawnInput, setManualDrawnInput] = useState<string>('');
  const [checkedDrawnNumbers, setCheckedDrawnNumbers] = useState<number[]>([]);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    if (pendingGames && pendingGames.length > 0) {
      setShowCreateForm(true);
      setNewTitulo(pendingTitle || `Bolão Concurso #${latestConcursoNum}`);
      setNewConcursoAlvo(latestConcursoNum);
    }
  }, [pendingGames, pendingTitle, latestConcursoNum]);

  useEffect(() => {
    if (!selectedId && boloes.length > 0) {
      setSelectedId(boloes[0].id);
    } else if (selectedId && !boloes.some((b) => b.id === selectedId)) {
      setSelectedId(boloes[0]?.id ?? null);
    }
  }, [boloes, selectedId]);

  const selectedBolao = useMemo(
    () => boloes.find((b) => b.id === selectedId) ?? null,
    [boloes, selectedId]
  );

  useEffect(() => {
    if (selectedBolao) {
      setCheckConcursoNum(String(selectedBolao.concurso_alvo));
      const matched = concursos.find((c) => c.concurso === selectedBolao.concurso_alvo);
      if (matched) {
        setCheckedDrawnNumbers(matched.dezenas);
      } else {
        setCheckedDrawnNumbers([]);
      }
    }
  }, [selectedBolao?.id, selectedBolao?.concurso_alvo, concursos]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateBolao = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/boloes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: newTitulo.trim() || `Bolão Concurso #${newConcursoAlvo}`,
          concurso_alvo: Number(newConcursoAlvo) || latestConcursoNum,
          qtd_cotas_totais: Number(newCotasTotais) || 10,
          jogos: pendingGames ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar bolão');

      await onRefreshBoloes();
      setSelectedId(data.bolao.id);
      setShowCreateForm(false);
      setNewTitulo('');
      onClearPendingGames();
      showToast('Bolão criado com sucesso.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar bolão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppendPendingToExisting = async () => {
    if (!selectedBolao || !pendingGames || pendingGames.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/boloes/${selectedBolao.id}/jogos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jogos: pendingGames }),
      });
      if (!res.ok) throw new Error('Erro ao importar jogos.');
      await onRefreshBoloes();
      onClearPendingGames();
      setShowCreateForm(false);
      showToast(`${pendingGames.length} jogo(s) importado(s) para "${selectedBolao.titulo}".`);
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBolao = async (id: string) => {
    const res = await fetch(`/api/boloes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await onRefreshBoloes();
      showToast('Bolão removido.');
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBolao || !partNome.trim()) return;
    const res = await fetch(`/api/boloes/${selectedBolao.id}/participantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: partNome.trim(),
        telefone: partTelefone.trim(),
        cotas_compradas: partCotas,
        pago: partPago,
      }),
    });
    if (res.ok) {
      setPartNome('');
      setPartTelefone('');
      setPartCotas(1);
      setPartPago(false);
      await onRefreshBoloes();
    }
  };

  const handleTogglePaid = async (pid: string, currentPago: boolean) => {
    if (!selectedBolao) return;
    const res = await fetch(`/api/boloes/${selectedBolao.id}/participantes/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago: !currentPago }),
    });
    if (res.ok) await onRefreshBoloes();
  };

  const handleRemoveParticipant = async (pid: string) => {
    if (!selectedBolao) return;
    const res = await fetch(`/api/boloes/${selectedBolao.id}/participantes/${pid}`, {
      method: 'DELETE',
    });
    if (res.ok) await onRefreshBoloes();
  };

  const handleAddManualGames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBolao || !manualGamesText.trim()) return;

    const lines = manualGamesText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsedGames: number[][] = [];
    for (const line of lines) {
      const nums = line
        .split(/[\s,;\-]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
      const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
      if (unique.length >= 6 && unique.length <= 15) {
        parsedGames.push(unique);
      }
    }

    if (parsedGames.length === 0) {
      showToast('Nenhum jogo válido encontrado. Informe de 6 a 15 dezenas por linha (01 a 60).');
      return;
    }

    const res = await fetch(`/api/boloes/${selectedBolao.id}/jogos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogos: parsedGames }),
    });
    if (res.ok) {
      setManualGamesText('');
      await onRefreshBoloes();
      showToast(`${parsedGames.length} jogo(s) adicionado(s) ao bolão.`);
    }
  };

  const handleRemoveGame = async (jid: string) => {
    if (!selectedBolao) return;
    const res = await fetch(`/api/boloes/${selectedBolao.id}/jogos/${jid}`, {
      method: 'DELETE',
    });
    if (res.ok) await onRefreshBoloes();
  };

  const handleRunConferidor = async () => {
    if (!selectedBolao) return;

    let payload: any = {};
    if (checkMode === 'db') {
      const num = Number(checkConcursoNum);
      if (!num) {
        showToast('Informe o número do concurso para buscar na base.');
        return;
      }
      payload = { concurso_numero: num };
    } else {
      const nums = manualDrawnInput
        .split(/[\s,;\-]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
      const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
      if (unique.length !== 6) {
        showToast('Informe exatamente 6 dezenas distintas (01 a 60) para conferir.');
        return;
      }
      payload = { dezenas: unique };
    }

    const res = await fetch(`/api/boloes/${selectedBolao.id}/conferir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao conferir jogos.');
      return;
    }
    setCheckedDrawnNumbers(data.dezenasSorteadas || []);
    await onRefreshBoloes();
    showToast('Conferência concluída em todos os bilhetes.');
  };

  const handleCopyWhatsApp = async () => {
    if (!selectedBolao) return;
    const text = formatWhatsAppSummary(selectedBolao);
    await navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const totalCost = selectedBolao
    ? selectedBolao.jogos.reduce((acc, j) => acc + j.valor_aposta, 0)
    : 0;
  const soldQuotas = selectedBolao
    ? selectedBolao.participantes.reduce((acc, p) => acc + p.cotas_compradas, 0)
    : 0;
  const paidQuotas = selectedBolao
    ? selectedBolao.participantes
        .filter((p) => p.pago)
        .reduce((acc, p) => acc + p.cotas_compradas, 0)
    : 0;

  const hitsSummary = useMemo(() => {
    if (!selectedBolao) return { senas: 0, quinas: 0, quadras: 0, totalPremio: 0 };
    let senas = 0;
    let quinas = 0;
    let quadras = 0;
    let totalPremio = 0;
    for (const j of selectedBolao.jogos) {
      senas += j.senas ?? (j.acertos === 6 ? 1 : 0);
      quinas += j.quinas ?? (j.acertos === 5 ? 1 : 0);
      quadras += j.quadras ?? (j.acertos === 4 ? 1 : 0);
      totalPremio += j.premio_estimado || 0;
    }
    return { senas, quinas, quadras, totalPremio };
  }, [selectedBolao]);

  const sortedJogos = useMemo(() => {
    if (!selectedBolao) return [];
    return [...selectedBolao.jogos].sort(
      (a, b) => (b.acertos ?? -1) - (a.acertos ?? -1)
    );
  }, [selectedBolao]);

  const drawnSet = new Set(checkedDrawnNumbers);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Gestão de Bolões & Conferidor em Lote
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Rateio automático de cotas, controle de pagamentos, compartilhamento no WhatsApp e conferência oficial
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Bolão
        </button>
      </div>

      {feedback && (
        <div className="bg-[#208494]/15 border border-[#208494]/40 text-teal-800 dark:text-teal-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Create / Pending Import Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateBolao}
          className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Criar Novo Bolão
              </h2>
              {pendingGames && pendingGames.length > 0 && (
                <p className="text-xs text-[#208494] dark:text-teal-400 mt-0.5 font-medium">
                  {pendingGames.length} jogo(s) prontos para importação do Gerador/Fechamento
                </p>
              )}
            </div>
            {pendingGames && pendingGames.length > 0 && selectedBolao && (
              <button
                type="button"
                onClick={handleAppendPendingToExisting}
                className="px-3 py-1.5 text-xs font-medium text-[#208494] dark:text-teal-400 bg-[#208494]/10 hover:bg-[#208494]/20 rounded-lg transition-colors cursor-pointer"
              >
                Adicionar ao bolão &ldquo;{selectedBolao.titulo}&rdquo;
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nome do Bolão
              </label>
              <input
                type="text"
                required
                placeholder="Ex.: Bolão da Firma - Mega"
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Concurso Alvo
              </label>
              <input
                type="number"
                required
                min={1}
                value={newConcursoAlvo}
                onChange={(e) => setNewConcursoAlvo(Number(e.target.value) || latestConcursoNum)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Total de Cotas
              </label>
              <input
                type="number"
                required
                min={1}
                max={500}
                value={newCotasTotais}
                onChange={(e) => setNewCotasTotais(Math.max(1, Number(e.target.value) || 10))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                onClearPendingGames();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Criar Bolão'}
            </button>
          </div>
        </form>
      )}

      {boloes.length === 0 ? (
        <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-10 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-[#208494]/15 text-[#208494] flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Nenhum bolão cadastrado
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
            Crie um bolão agora ou gere combinações no Gerador / Fechamentos para importar diretamente.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Criar Primeiro Bolão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar list of Bolões */}
          <div className="lg:col-span-4 space-y-2.5">
            {boloes.map((b) => {
              const active = b.id === selectedBolao?.id;
              const cost = b.jogos.reduce((acc, j) => acc + j.valor_aposta, 0);
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#208494]/10 border-[#208494]'
                      : 'bg-white dark:bg-[#11191E] border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {b.titulo}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-1">
                        Concurso #{b.concurso_alvo} · {b.jogos.length} jogos · {formatBRL(cost)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBolao(b.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                      aria-label={`Excluir bolão ${b.titulo}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                      Cota: {formatBRL(b.valor_cota)} ({b.qtd_cotas_totais}x)
                    </span>
                    <span
                      className={`font-medium capitalize ${
                        b.status === 'conferido'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : b.status === 'fechado'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#208494] dark:text-teal-400'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Bolão Workspace */}
          {selectedBolao && (
            <div className="lg:col-span-8 space-y-6">
              {/* Summary & Export Bar */}
              <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedBolao.titulo}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      Mega-Sena · Concurso #{selectedBolao.concurso_alvo} · Criado em{' '}
                      {formatDateBR(selectedBolao.created_at.slice(0, 10))}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyWhatsApp}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedWhatsApp ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedWhatsApp ? 'Resumo Copiado' : 'Copiar WhatsApp'}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        formatWhatsAppSummary(selectedBolao)
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        exportGamesToTXT(
                          selectedBolao.jogos.map((j) => j.dezenas),
                          `bolao_${selectedBolao.concurso_alvo}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      TXT
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportGamesToCSV(
                          selectedBolao.jogos.map((j) => ({
                            dezenas: j.dezenas,
                            valorAposta: j.valor_aposta,
                            acertos: j.acertos,
                          })),
                          `bolao_${selectedBolao.concurso_alvo}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPrintModal(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      A4
                    </button>
                  </div>
                </div>

                {/* 4 KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Custo Total das Apostas
                    </div>
                    <div className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatBRL(totalCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Valor por Cota ({selectedBolao.qtd_cotas_totais}x)
                    </div>
                    <div className="text-lg font-mono tabular-nums font-bold text-[#208494] dark:text-teal-400 mt-0.5">
                      {formatBRL(selectedBolao.valor_cota)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Cotas Vendidas / Pagas
                    </div>
                    <div className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                      {soldQuotas}/{selectedBolao.qtd_cotas_totais}{' '}
                      <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                        ({paidQuotas} pagas)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Arrecadação Paga
                    </div>
                    <div className="text-lg font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatBRL(paidQuotas * selectedBolao.valor_cota)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conferidor Automático em Lote */}
              <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#208494]" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Conferidor Automático em Lote
                    </h3>
                  </div>

                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#162127] border border-slate-200 dark:border-slate-800 rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => setCheckMode('db')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        checkMode === 'db'
                          ? 'bg-[#208494] text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Buscar da Base
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckMode('manual')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        checkMode === 'manual'
                          ? 'bg-[#208494] text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Digitar Resultado
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {checkMode === 'db' ? (
                    <input
                      type="number"
                      min={1}
                      placeholder="Nº do Concurso (ex: 3087)"
                      value={checkConcursoNum}
                      onChange={(e) => setCheckConcursoNum(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="6 dezenas separadas por espaço (ex: 05 10 22 37 44 53)"
                      value={manualDrawnInput}
                      onChange={(e) => setManualDrawnInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleRunConferidor}
                    disabled={selectedBolao.jogos.length === 0}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Conferir {selectedBolao.jogos.length} Jogos
                  </button>
                </div>

                {selectedBolao.status === 'conferido' && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-4 font-mono tabular-nums">
                      <span>
                        Senas (6):{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {hitsSummary.senas}
                        </strong>
                      </span>
                      <span>
                        Quinas (5):{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {hitsSummary.quinas}
                        </strong>
                      </span>
                      <span>
                        Quadras (4):{' '}
                        <strong className="text-[#208494] dark:text-teal-400">
                          {hitsSummary.quadras}
                        </strong>
                      </span>
                    </div>
                    {hitsSummary.totalPremio > 0 && (
                      <div className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        Prêmio Estimado: {formatBRL(hitsSummary.totalPremio)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Participantes & Cotas */}
              <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#208494]" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Participantes e Controle de Pagamentos
                  </h3>
                </div>

                <form
                  onSubmit={handleAddParticipant}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
                >
                  <input
                    type="text"
                    required
                    placeholder="Nome do participante"
                    value={partNome}
                    onChange={(e) => setPartNome(e.target.value)}
                    className="sm:col-span-4 px-3 py-2 text-xs bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp (opcional)"
                    value={partTelefone}
                    onChange={(e) => setPartTelefone(e.target.value)}
                    className="sm:col-span-3 px-3 py-2 text-xs bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={1}
                    max={selectedBolao.qtd_cotas_totais}
                    value={partCotas}
                    onChange={(e) => setPartCotas(Math.max(1, Number(e.target.value) || 1))}
                    className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    title="Quantidade de cotas"
                  />
                  <label className="sm:col-span-1 flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={partPago}
                      onChange={(e) => setPartPago(e.target.checked)}
                      className="accent-[#208494]"
                    />
                    Pago
                  </label>
                  <button
                    type="submit"
                    className="sm:col-span-2 px-3 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors cursor-pointer"
                  >
                    Adicionar
                  </button>
                </form>

                {selectedBolao.participantes.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="text-left font-medium py-2">Participante</th>
                          <th className="text-right font-medium py-2 px-2">Cotas</th>
                          <th className="text-right font-medium py-2 px-2">Valor</th>
                          <th className="text-right font-medium py-2 px-2">Status</th>
                          <th className="text-right font-medium py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {selectedBolao.participantes.map((p) => (
                          <tr key={p.id} className="h-10">
                            <td className="py-1.5">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {p.nome}
                              </div>
                              {p.telefone && (
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {p.telefone}
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {p.cotas_compradas}x
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {formatBRL(p.cotas_compradas * selectedBolao.valor_cota)}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleTogglePaid(p.id, p.pago)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                                  p.pago
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {p.pago ? 'Pago' : 'Pendente'}
                              </button>
                            </td>
                            <td className="py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveParticipant(p.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                aria-label={`Remover ${p.nome}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Jogos do Bolão */}
              <div className="bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Bilhetes do Bolão ({selectedBolao.jogos.length})
                  </h3>
                </div>

                <form onSubmit={handleAddManualGames} className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Adicionar jogos manualmente (1 jogo por linha, ex: 04 12 23 35 48 59)"
                    value={manualGamesText}
                    onChange={(e) => setManualGamesText(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#162127] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162127] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Adicionar Jogos
                    </button>
                  </div>
                </form>

                {sortedJogos.length > 0 && (
                  <div className="space-y-2">
                    {sortedJogos.map((jogo, idx) => (
                      <div
                        key={jogo.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#162127]/70 border border-slate-200/70 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-mono tabular-nums text-slate-400 w-6">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {jogo.dezenas.map((d) => {
                              const hit = drawnSet.has(d);
                              return (
                                <span
                                  key={d}
                                  className={`w-7 h-7 rounded-full font-mono tabular-nums text-xs font-semibold flex items-center justify-center ${
                                    hit
                                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                                      : 'bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  {padDezena(d)}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                          {jogo.acertos !== null && (
                            <span
                              className={`font-semibold ${
                                jogo.acertos >= 4
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {jogo.acertos} acerto{jogo.acertos === 1 ? '' : 's'}
                            </span>
                          )}
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatBRL(jogo.valor_aposta)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGame(jogo.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            aria-label="Remover jogo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showPrintModal && selectedBolao && (
        <PrintA4Modal
          title={selectedBolao.titulo}
          subtitle={`Concurso Alvo #${selectedBolao.concurso_alvo} · Cota: ${formatBRL(
            selectedBolao.valor_cota
          )}`}
          games={selectedBolao.jogos.map((j) => ({
            dezenas: j.dezenas,
            valorAposta: j.valor_aposta,
          }))}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
