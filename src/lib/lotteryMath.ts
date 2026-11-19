import type {
  Concurso,
  DashboardStats,
  GeneratedGame,
  GenerationResult,
  GeneratorFilters,
  Modalidade,
  ModalityConfig,
  NumberFrequency,
  ParityBucket,
  ParityPattern,
  SumBucket,
} from '../types/lottery';

export const MODALITY_CONFIGS: Record<Modalidade, ModalityConfig> = {
  'mega-sena': {
    id: 'mega-sena',
    name: 'Mega-Sena',
    totalNumbers: 60,
    columns: 10,
    minPerBet: 6,
    maxPerBet: 15,
    drawSize: 6,
    basePrice: 5.0,
    active: true,
    description: 'Volante 01 a 60 · Apostas de 6 a 15 dezenas',
  },
  lotofacil: {
    id: 'lotofacil',
    name: 'Lotofácil',
    totalNumbers: 25,
    columns: 5,
    minPerBet: 15,
    maxPerBet: 20,
    drawSize: 15,
    basePrice: 3.0,
    active: false,
    description: 'Arquitetura expansível · Volante 01 a 25',
  },
  quina: {
    id: 'quina',
    name: 'Quina',
    totalNumbers: 80,
    columns: 10,
    minPerBet: 5,
    maxPerBet: 15,
    drawSize: 5,
    basePrice: 2.5,
    active: false,
    description: 'Arquitetura expansível · Volante 01 a 80',
  },
};

export function padDezena(n: number): string {
  return n.toString().padStart(2, '0');
}

export function comboSignature(dezenas: number[]): string {
  return [...dezenas]
    .sort((a, b) => a - b)
    .map(padDezena)
    .join('-');
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function combinationsCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const r = Math.min(k, n - k);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= r; i++) {
    num *= n - r + i;
    den *= i;
  }
  return Math.round(num / den);
}

export function calculateBetCost(
  dezenasCount: number,
  modalidade: Modalidade = 'mega-sena',
  unitPrice?: number
): number {
  const cfg = MODALITY_CONFIGS[modalidade];
  const base = unitPrice ?? cfg.basePrice;
  return combinationsCount(dezenasCount, cfg.drawSize) * base;
}

export const DEFAULT_GENERATOR_FILTERS: GeneratorFilters = {
  allowedParities: ['3P/3I', '4P/2I', '2P/4I'],
  useParityFilter: true,
  useSumFilter: true,
  minSum: 150,
  maxSum: 215,
  antiSequence: true,
  maxConsecutive: 2,
  lineQuadrantBalance: true,
  uniqueHistorical: true,
};

function hasExcessiveConsecutive(sorted: number[], maxConsecutive: number): boolean {
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
      if (run > maxConsecutive) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

function isRowAndQuadrantBalanced(sorted: number[]): boolean {
  // Mega-Sena volante: 6 rows (1-10, 11-20, ..., 51-60) and 4 quadrants (15 numbers each)
  const rowCounts = [0, 0, 0, 0, 0, 0];
  const quadCounts = [0, 0, 0, 0];
  const maxPerRow = sorted.length <= 6 ? 3 : Math.ceil(sorted.length * 0.5);
  const maxPerQuad = sorted.length <= 6 ? 3 : Math.ceil(sorted.length * 0.55);

  for (const n of sorted) {
    const row = Math.floor((n - 1) / 10); // 0..5
    const col = (n - 1) % 10; // 0..9
    rowCounts[row]++;
    if (rowCounts[row] > maxPerRow) return false;

    const topHalf = row < 3;
    const leftHalf = col < 5;
    const quad = (topHalf ? 0 : 2) + (leftHalf ? 0 : 1);
    quadCounts[quad]++;
    if (quadCounts[quad] > maxPerQuad) return false;
  }

  return true;
}

function matchesParityFilter(
  evenCount: number,
  totalCount: number,
  allowedParities: ParityPattern[]
): boolean {
  if (allowedParities.length === 0) return true;
  if (totalCount === 6) {
    const pattern = `${evenCount}P/${6 - evenCount}I` as ParityPattern;
    return allowedParities.includes(pattern);
  }
  // For k > 6, map allowed 6-ball even ratios into proportional bounds
  const allowedRatios = allowedParities.map((p) => parseInt(p[0], 10) / 6);
  const minRatio = Math.min(...allowedRatios) - 0.05;
  const maxRatio = Math.max(...allowedRatios) + 0.05;
  const actualRatio = evenCount / totalCount;
  return actualRatio >= minRatio && actualRatio <= maxRatio;
}

export interface GenerateOptions {
  count: number;
  dezenasPerGame: number;
  fixedNumbers: number[];
  excludedNumbers: number[];
  filters: GeneratorFilters;
  historicalSignatures: Set<string>;
  unitPrice?: number;
}

export function generateSmartCombinations(options: GenerateOptions): GenerationResult {
  const start = performance.now();
  const {
    count,
    dezenasPerGame,
    fixedNumbers,
    excludedNumbers,
    filters,
    historicalSignatures,
    unitPrice = 5.0,
  } = options;

  const fixedSet = new Set(fixedNumbers);
  const excludedSet = new Set(excludedNumbers);

  const pool: number[] = [];
  for (let n = 1; n <= 60; n++) {
    if (!fixedSet.has(n) && !excludedSet.has(n)) {
      pool.push(n);
    }
  }

  const fixedArr = Array.from(fixedSet).sort((a, b) => a - b);
  const needed = dezenasPerGame - fixedArr.length;

  if (needed < 0) {
    return {
      games: [],
      elapsedMs: Math.round(performance.now() - start),
      attempts: 0,
      warning: 'Quantidade de dezenas fixas excede o tamanho selecionado para o jogo.',
    };
  }

  if (pool.length < needed) {
    return {
      games: [],
      elapsedMs: Math.round(performance.now() - start),
      attempts: 0,
      warning: 'Não há dezenas disponíveis suficientes após aplicar fixas e excluídas.',
    };
  }

  // Scale sum bounds proportionally when generating >6 dezenas
  const sumScale = dezenasPerGame / 6;
  const effectiveMinSum = Math.round(filters.minSum * sumScale);
  const effectiveMaxSum = Math.round(filters.maxSum * sumScale);

  const games: GeneratedGame[] = [];
  const seenBatch = new Set<string>();
  const maxAttempts = Math.min(80000, Math.max(8000, count * 2000));
  let attempts = 0;

  const workPool = [...pool];
  const valorAposta = calculateBetCost(dezenasPerGame, 'mega-sena', unitPrice);

  while (games.length < count && attempts < maxAttempts) {
    attempts++;

    // Partial Fisher-Yates shuffle for `needed` elements
    for (let i = 0; i < needed; i++) {
      const j = i + Math.floor(Math.random() * (workPool.length - i));
      const tmp = workPool[i];
      workPool[i] = workPool[j];
      workPool[j] = tmp;
    }

    const candidate = fixedArr.concat(workPool.slice(0, needed)).sort((a, b) => a - b);

    let soma = 0;
    let pares = 0;
    for (let i = 0; i < candidate.length; i++) {
      soma += candidate[i];
      if ((candidate[i] & 1) === 0) pares++;
    }

    if (filters.useSumFilter && (soma < effectiveMinSum || soma > effectiveMaxSum)) {
      continue;
    }

    if (
      filters.useParityFilter &&
      !matchesParityFilter(pares, candidate.length, filters.allowedParities)
    ) {
      continue;
    }

    if (filters.antiSequence && hasExcessiveConsecutive(candidate, filters.maxConsecutive)) {
      continue;
    }

    if (filters.lineQuadrantBalance && !isRowAndQuadrantBalanced(candidate)) {
      continue;
    }

    const sig = comboSignature(candidate);
    if (seenBatch.has(sig)) {
      continue;
    }

    const alreadyDrawn = candidate.length === 6 ? historicalSignatures.has(sig) : false;
    if (filters.uniqueHistorical && alreadyDrawn) {
      continue;
    }

    seenBatch.add(sig);
    games.push({
      id: `${Date.now()}-${games.length}-${Math.random().toString(36).slice(2, 7)}`,
      dezenas: candidate,
      soma,
      pares,
      impares: candidate.length - pares,
      valorAposta,
      inedito: !alreadyDrawn,
    });
  }

  const elapsedMs = Math.max(1, Math.round(performance.now() - start));
  let warning: string | undefined;
  if (games.length < count) {
    warning =
      games.length === 0
        ? 'Nenhuma combinação satisfez todos os filtros simultaneamente. Relaxe a faixa de soma, paridade ou dezenas fixas/excluídas.'
        : `Gerados ${games.length} de ${count} jogos solicitados após ${attempts.toLocaleString('pt-BR')} tentativas (filtros muito restritivos).`;
  }

  return {
    games,
    elapsedMs,
    attempts,
    warning,
  };
}

export function calculateDashboardStats(
  allConcursos: Concurso[],
  period: '10' | '50' | '100' | 'all'
): DashboardStats {
  const sortedDesc = [...allConcursos].sort((a, b) => b.concurso - a.concurso);
  const latestConcurso = sortedDesc[0] ?? null;

  const limit =
    period === '10' ? 10 : period === '50' ? 50 : period === '100' ? 100 : sortedDesc.length;
  const slice = sortedDesc.slice(0, limit);

  const counts = new Array(61).fill(0);
  const lastSeen = new Array<number | null>(61).fill(null);

  // Track last seen across entire available dataset for accurate delay map
  for (const c of sortedDesc) {
    for (const d of c.dezenas) {
      if (d >= 1 && d <= 60 && lastSeen[d] === null) {
        lastSeen[d] = c.concurso;
      }
    }
  }

  const sums: number[] = [];
  const parityCounts: Record<ParityPattern, number> = {
    '0P/6I': 0,
    '1P/5I': 0,
    '2P/4I': 0,
    '3P/3I': 0,
    '4P/2I': 0,
    '5P/1I': 0,
    '6P/0I': 0,
  };

  for (const c of slice) {
    sums.push(c.soma_dezenas);
    const p = Math.max(0, Math.min(6, c.qtd_pares));
    const pat = `${p}P/${6 - p}I` as ParityPattern;
    parityCounts[pat]++;

    for (const d of c.dezenas) {
      if (d >= 1 && d <= 60) {
        counts[d]++;
      }
    }
  }

  const maxConcursoNum = latestConcurso?.concurso ?? 0;
  const frequencies: NumberFrequency[] = [];
  for (let d = 1; d <= 60; d++) {
    const seenAt = lastSeen[d];
    const delay =
      latestConcurso === null
        ? 0
        : seenAt === null
          ? sortedDesc.length
          : Math.max(0, maxConcursoNum - seenAt);
    frequencies.push({
      dezena: d,
      count: counts[d],
      percentage: slice.length > 0 ? Number(((counts[d] / slice.length) * 100).toFixed(1)) : 0,
      delay,
      lastConcurso: seenAt,
    });
  }

  const hotNumbers = [...frequencies]
    .sort((a, b) => b.count - a.count || a.dezena - b.dezena)
    .slice(0, 10);

  const coldNumbers = [...frequencies]
    .sort((a, b) => a.count - b.count || a.dezena - b.dezena)
    .slice(0, 10);

  const mostDelayed = [...frequencies]
    .sort((a, b) => b.delay - a.delay || a.dezena - b.dezena)
    .slice(0, 12);

  // Sum quartiles & mean
  const sortedSums = [...sums].sort((a, b) => a - b);
  const quantile = (q: number) => {
    if (sortedSums.length === 0) return 0;
    const pos = (sortedSums.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedSums[base + 1] !== undefined) {
      return Math.round(sortedSums[base] + rest * (sortedSums[base + 1] - sortedSums[base]));
    }
    return Math.round(sortedSums[base]);
  };

  const meanSum =
    sums.length > 0 ? Math.round(sums.reduce((acc, s) => acc + s, 0) / sums.length) : 183;
  const q1Sum = sums.length > 0 ? quantile(0.25) : 155;
  const medianSum = sums.length > 0 ? quantile(0.5) : 183;
  const q3Sum = sums.length > 0 ? quantile(0.75) : 211;

  // Build sum distribution histogram buckets
  const bucketDefs: Array<{ label: string; min: number; max: number }> = [
    { label: '≤119', min: 0, max: 119 },
    { label: '120–139', min: 120, max: 139 },
    { label: '140–154', min: 140, max: 154 },
    { label: '155–169', min: 155, max: 169 },
    { label: '170–183', min: 170, max: 183 },
    { label: '184–197', min: 184, max: 197 },
    { label: '198–211', min: 198, max: 211 },
    { label: '212–229', min: 212, max: 229 },
    { label: '230–249', min: 230, max: 249 },
    { label: '≥250', min: 250, max: 999 },
  ];

  const sumDistribution: SumBucket[] = bucketDefs.map((b) => ({
    ...b,
    count: sums.filter((s) => s >= b.min && s <= b.max).length,
    inIQR: b.min >= 155 && b.max <= 211,
  }));

  const balancedSet = new Set<ParityPattern>(['3P/3I', '4P/2I', '2P/4I']);
  const parityOrder: ParityPattern[] = [
    '0P/6I',
    '1P/5I',
    '2P/4I',
    '3P/3I',
    '4P/2I',
    '5P/1I',
    '6P/0I',
  ];

  const parityDistribution: ParityBucket[] = parityOrder.map((label) => {
    const pares = parseInt(label[0], 10);
    const count = parityCounts[label];
    return {
      label,
      pares,
      impares: 6 - pares,
      count,
      percentage: slice.length > 0 ? Number(((count / slice.length) * 100).toFixed(1)) : 0,
      balanced: balancedSet.has(label),
    };
  });

  return {
    totalConcursos: sortedDesc.length,
    periodConcursos: slice.length,
    latestConcurso,
    meanSum,
    q1Sum,
    medianSum,
    q3Sum,
    frequencies,
    hotNumbers,
    coldNumbers,
    mostDelayed,
    sumDistribution,
    parityDistribution,
  };
}

export interface TicketEvaluation {
  acertos: number;
  matchedNumbers: number[];
  senas: number;
  quinas: number;
  quadras: number;
  premioEstimado: number;
}

export function evaluateTicketHits(
  ticketDezenas: number[],
  drawnDezenas: number[],
  rateios?: { sena: number; quina: number; quadra: number }
): TicketEvaluation {
  const drawnSet = new Set(drawnDezenas);
  const matchedNumbers = ticketDezenas.filter((n) => drawnSet.has(n));
  const h = matchedNumbers.length;
  const k = ticketDezenas.length;

  // Combinatorial prize multiplicity for Mega-Sena bets of size k >= 6
  const senas = h >= 6 ? combinationsCount(h, 6) * combinationsCount(k - h, 0) : 0;
  const quinas = h >= 5 ? combinationsCount(h, 5) * combinationsCount(k - h, 1) : 0;
  const quadras = h >= 4 ? combinationsCount(h, 4) * combinationsCount(k - h, 2) : 0;

  const senaVal = rateios?.sena || 0;
  const quinaVal = rateios?.quina || 0;
  const quadraVal = rateios?.quadra || 0;

  const premioEstimado = Number(
    (senas * senaVal + quinas * quinaVal + quadras * quadraVal).toFixed(2)
  );

  return {
    acertos: h,
    matchedNumbers,
    senas,
    quinas,
    quadras,
    premioEstimado,
  };
}
