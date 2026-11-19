import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Database,
  Grid,
  Menu,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type { Bolao, Concurso, Modalidade, SyncResponse } from './types/lottery';
import { MODALITY_CONFIGS } from './lib/lotteryMath';
import { DashboardView } from './components/DashboardView';
import { GeneratorView } from './components/GeneratorView';
import { ClosuresView } from './components/ClosuresView';
import { BoloesView } from './components/BoloesView';
import { DatabaseView } from './components/DatabaseView';
import { TermsModal } from './components/TermsModal';

type ActiveTab = 'dashboard' | 'generator' | 'closures' | 'boloes' | 'database';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'generator', label: 'Gerador', icon: Sparkles },
  { id: 'closures', label: 'Fechamentos', icon: Grid },
  { id: 'boloes', label: 'Bolões', icon: Users },
  { id: 'database', label: 'Base de Dados', icon: Database },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [activeModality, setActiveModality] = useState<Modalidade>('mega-sena');
  const [modalityNotice, setModalityNotice] = useState<string | null>(null);

  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResponse | null>(null);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);

  // Shared generator pre-selections (clickable from Dashboard)
  const [fixedNumbers, setFixedNumbers] = useState<number[]>([]);
  const [excludedNumbers, setExcludedNumbers] = useState<number[]>([]);

  // Pending games sent from Generator or Closures into Bolões
  const [pendingBolaoGames, setPendingBolaoGames] = useState<number[][] | null>(null);
  const [pendingBolaoTitle, setPendingBolaoTitle] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const loadConcursos = useCallback(async () => {
    const res = await fetch('/api/concursos');
    if (res.ok) {
      const data = await res.json();
      setConcursos(data.concursos || []);
      return (data.concursos || []) as Concurso[];
    }
    return [];
  }, []);

  const loadBoloes = useCallback(async () => {
    const res = await fetch('/api/boloes');
    if (res.ok) {
      const data = await res.json();
      setBoloes(data.boloes || []);
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    setSyncBanner(null);
    try {
      const res = await fetch('/api/sync-concursos', { method: 'POST' });
      const data: SyncResponse = await res.json();
      setLastSyncResult(data);
      setSyncBanner(data.message);
      await loadConcursos();
      setTimeout(() => setSyncBanner(null), 5000);
    } catch {
      setSyncBanner('Não foi possível conectar ao serviço de sincronização.');
    } finally {
      setIsSyncing(false);
    }
  }, [loadConcursos]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [loadedConcursos] = await Promise.all([loadConcursos(), loadBoloes()]);
        if (mounted && loadedConcursos.length === 0) {
          // Attempt initial public API sync silently on first launch if DB is empty
          setIsSyncing(true);
          try {
            const res = await fetch('/api/sync-concursos', { method: 'POST' });
            if (res.ok) {
              const data: SyncResponse = await res.json();
              if (mounted) {
                setLastSyncResult(data);
                if (data.totalConcursos > 0) {
                  await loadConcursos();
                }
              }
            }
          } catch {
            // Gracefully fall back to empty state (CSV upload available)
          } finally {
            if (mounted) setIsSyncing(false);
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadConcursos, loadBoloes]);

  const handleSendNumberToGenerator = (num: number, kind: 'fixed' | 'excluded') => {
    if (kind === 'fixed') {
      setExcludedNumbers((prev) => prev.filter((n) => n !== num));
      setFixedNumbers((prev) =>
        prev.includes(num) ? prev : [...prev, num].sort((a, b) => a - b).slice(0, 6)
      );
    } else {
      setFixedNumbers((prev) => prev.filter((n) => n !== num));
      setExcludedNumbers((prev) =>
        prev.includes(num) ? prev : [...prev, num].sort((a, b) => a - b)
      );
    }
    setActiveTab('generator');
  };

  const handleSendGamesToBolao = (games: number[][], suggestedTitle: string) => {
    setPendingBolaoGames(games);
    setPendingBolaoTitle(suggestedTitle);
    setActiveTab('boloes');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B1114] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Header — strict 3-zone contract */}
      <header className="no-print sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0B1114]/95 backdrop-blur">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
              aria-label="Abrir navegação"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              LotoMetria
            </button>
          </div>

          {/* Zone 2: 5 clean single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#208494] text-slate-900 dark:text-white font-semibold'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncNow}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#208494] hover:bg-[#1a6e7c] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Atualizar Resultados'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191E] px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#208494]/15 text-[#208494] dark:text-teal-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162127]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Workspace Container */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* Desktop Sidebar */}
        <aside className="no-print hidden lg:flex flex-col w-56 shrink-0 space-y-6">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#208494] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#11191E] hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
            <div className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Modalidade
            </div>
            <div className="space-y-1">
              {(Object.keys(MODALITY_CONFIGS) as Modalidade[]).map((modKey) => {
                const cfg = MODALITY_CONFIGS[modKey];
                const isSelected = activeModality === modKey;
                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => {
                      if (cfg.active) {
                        setActiveModality(cfg.id);
                        setModalityNotice(null);
                      } else {
                        setModalityNotice(
                          `${cfg.name} (${cfg.description}) está preparada na arquitetura expansível para a próxima etapa.`
                        );
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-200/70 dark:bg-[#162127] text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#11191E]'
                    }`}
                  >
                    <span>{cfg.name}</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      {cfg.active ? 'Ativa' : 'Em breve'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800 rounded-lg hover:border-[#208494] transition-colors cursor-pointer"
            >
              <span>{isDark ? 'Tema Escuro' : 'Tema Claro'}</span>
              {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Mobile quick workspace toolbar (Theme + Modality) */}
          <div className="no-print lg:hidden flex items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Modalidade: <strong className="text-slate-900 dark:text-white">Mega-Sena</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#11191E] border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
            >
              {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              {isDark ? 'Escuro' : 'Claro'}
            </button>
          </div>

          {syncBanner && (
            <div className="no-print bg-[#208494]/15 border border-[#208494]/40 text-teal-900 dark:text-teal-200 rounded-xl px-4 py-2.5 text-xs flex items-center justify-between gap-4">
              <span>{syncBanner}</span>
              <button
                type="button"
                onClick={() => setSyncBanner(null)}
                className="underline cursor-pointer shrink-0"
              >
                Fechar
              </button>
            </div>
          )}

          {modalityNotice && (
            <div className="no-print bg-slate-100 dark:bg-[#11191E] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-4 py-2.5 text-xs flex items-center justify-between gap-4">
              <span>{modalityNotice}</span>
              <button
                type="button"
                onClick={() => setModalityNotice(null)}
                className="underline cursor-pointer shrink-0"
              >
                Fechar
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              concursos={concursos}
              isLoading={isLoading}
              isSyncing={isSyncing}
              onSyncNow={handleSyncNow}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSendNumberToGenerator={handleSendNumberToGenerator}
            />
          )}

          {activeTab === 'generator' && (
            <GeneratorView
              concursos={concursos}
              fixedNumbers={fixedNumbers}
              excludedNumbers={excludedNumbers}
              onChangeFixed={setFixedNumbers}
              onChangeExcluded={setExcludedNumbers}
              onSendGamesToBolao={handleSendGamesToBolao}
            />
          )}

          {activeTab === 'closures' && (
            <ClosuresView onSendGamesToBolao={handleSendGamesToBolao} />
          )}

          {activeTab === 'boloes' && (
            <BoloesView
              boloes={boloes}
              concursos={concursos}
              pendingGames={pendingBolaoGames}
              pendingTitle={pendingBolaoTitle}
              onClearPendingGames={() => {
                setPendingBolaoGames(null);
                setPendingBolaoTitle(null);
              }}
              onRefreshBoloes={loadBoloes}
            />
          )}

          {activeTab === 'database' && (
            <DatabaseView
              concursos={concursos}
              isSyncing={isSyncing}
              lastSyncResult={lastSyncResult}
              onSyncNow={handleSyncNow}
              onReloadConcursos={async () => {
                await loadConcursos();
              }}
            />
          )}
        </main>
      </div>

      {/* Mandatory Compliance Footer */}
      <footer className="no-print border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1114] mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p className="max-w-3xl leading-relaxed">
            Ferramenta independente de apoio estatístico e organização combinatória,{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              sem vínculo com a Caixa Econômica Federal
            </strong>
            . Este sistema não realiza apostas financeiras online e não garante premiações.
          </p>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-[#208494] dark:text-teal-400 hover:underline font-medium cursor-pointer whitespace-nowrap"
            >
              Termos de Uso
            </button>
          </div>
        </div>
      </footer>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
}
