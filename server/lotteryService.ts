import fs from 'fs';
import path from 'path';
import type {
  Bolao,
  BolaoJogo,
  BolaoParticipante,
  Concurso,
  CsvImportResponse,
  SyncResponse,
} from '../src/types/lottery.ts';
import { calculateBetCost, comboSignature, evaluateTicketHits } from '../src/lib/lotteryMath.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONCURSOS_FILE = path.join(DATA_DIR, 'concursos.json');
const BOLOES_FILE = path.join(DATA_DIR, 'boloes.json');

let concursosCache: Concurso[] | null = null;
let boloesCache: Bolao[] | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureDataDir();
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function getAllConcursos(): Concurso[] {
  if (!concursosCache) {
    concursosCache = readJsonFile<Concurso[]>(CONCURSOS_FILE, []);
  }
  return concursosCache;
}

function saveConcursos(list: Concurso[]) {
  list.sort((a, b) => a.concurso - b.concurso);
  concursosCache = list;
  writeJsonFile(CONCURSOS_FILE, list);
}

export function getAllBoloes(): Bolao[] {
  if (!boloesCache) {
    boloesCache = readJsonFile<Bolao[]>(BOLOES_FILE, []);
  }
  return boloesCache;
}

function saveBoloes(list: Bolao[]) {
  boloesCache = list;
  writeJsonFile(BOLOES_FILE, list);
}

export function getMaxConcursoNumber(): number {
  const list = getAllConcursos();
  if (list.length === 0) return 0;
  let max = 0;
  for (const c of list) {
    if (c.concurso > max) max = c.concurso;
  }
  return max;
}

export function sanitizeCurrencyBR(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Number(raw.toFixed(2)) : 0;
  }
  if (!raw) return 0;
  const str = String(raw).trim();
  if (!str) return 0;

  // Strip "R$", whitespace, etc.
  let cleaned = str.replace(/R\$/gi, '').replace(/\s+/g, '');
  // If Brazilian format with comma decimal (e.g. "1.234.567,89" or "45,00")
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  cleaned = cleaned.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

export function sanitizeIntBR(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : 0;
  if (!raw) return 0;
  const cleaned = String(raw).replace(/\./g, '').replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function convertDateBRToISO(raw: string | undefined | null): string {
  if (!raw) return '';
  const str = String(raw).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or D/M/YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return str;
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs >= semicolons && tabs >= commas && tabs > 0) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

export function upsertConcursos(incoming: Concurso[]): { imported: number; updated: number; total: number } {
  const current = getAllConcursos();
  const byConcurso = new Map<number, Concurso>();
  for (const c of current) {
    byConcurso.set(c.concurso, c);
  }

  let imported = 0;
  let updated = 0;

  for (const item of incoming) {
    if (byConcurso.has(item.concurso)) {
      byConcurso.set(item.concurso, { ...byConcurso.get(item.concurso)!, ...item, id: item.concurso });
      updated++;
    } else {
      byConcurso.set(item.concurso, { ...item, id: item.concurso });
      imported++;
    }
  }

  const merged = Array.from(byConcurso.values());
  saveConcursos(merged);
  return { imported, updated, total: merged.length };
}

export function importConcursosFromCSV(csvText: string): CsvImportResponse {
  const cleanedText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanedText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      total: getAllConcursos().length,
      minConcurso: null,
      maxConcurso: null,
      errors: ['O arquivo CSV está vazio ou não contém linhas de dados após o cabeçalho.'],
    };
  }

  // Find header line (first line containing "concurso" and "bola" or "dezena")
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const norm = normalizeHeader(lines[i]);
    if (norm.includes('concurso') && (norm.includes('bola') || norm.includes('dezena'))) {
      headerIndex = i;
      break;
    }
  }

  const delimiter = detectDelimiter(lines[headerIndex]);
  const rawHeaders = parseCsvLine(lines[headerIndex], delimiter);
  const headers = rawHeaders.map(normalizeHeader);

  const findCol = (candidates: string[]): number => {
    for (const c of candidates) {
      const exact = headers.indexOf(c);
      if (exact !== -1) return exact;
    }
    for (const c of candidates) {
      const partial = headers.findIndex((h) => h.includes(c));
      if (partial !== -1) return partial;
    }
    return -1;
  };

  const colConcurso = findCol(['concurso']);
  const colData = findCol(['data do sorteio', 'data sorteio', 'data']);
  const colBolas = [
    findCol(['bola1', 'bola 1', '1 dezena', 'dezena1', 'dezena 1']),
    findCol(['bola2', 'bola 2', '2 dezena', 'dezena2', 'dezena 2']),
    findCol(['bola3', 'bola 3', '3 dezena', 'dezena3', 'dezena 3']),
    findCol(['bola4', 'bola 4', '4 dezena', 'dezena4', 'dezena 4']),
    findCol(['bola5', 'bola 5', '5 dezena', 'dezena5', 'dezena 5']),
    findCol(['bola6', 'bola 6', '6 dezena', 'dezena6', 'dezena 6']),
  ];
  const colDezenasCombined = findCol(['dezenas']);
  const colGanhadores6 = findCol(['ganhadores 6 acertos', 'ganhadores sena', 'ganhadores 6']);
  const colCidade = findCol(['cidade uf', 'cidade', 'uf']);
  const colRateio6 = findCol(['rateio 6 acertos', 'rateio sena', 'premio 6 acertos']);
  const colGanhadores5 = findCol(['ganhadores 5 acertos', 'ganhadores quina', 'ganhadores 5']);
  const colRateio5 = findCol(['rateio 5 acertos', 'rateio quina', 'premio 5 acertos']);
  const colGanhadores4 = findCol(['ganhadores 4 acertos', 'ganhadores quadra', 'ganhadores 4']);
  const colRateio4 = findCol(['rateio 4 acertos', 'rateio quadra', 'premio 4 acertos']);
  const colAcumulado6 = findCol(['acumulado 6 acertos', 'acumulado sena', 'valor acumulado']);
  const colArrecadacao = findCol(['arrecadacao total', 'arrecadacao']);
  const colEstimativa = findCol(['estimativa premio', 'estimativa proximo premio', 'estimativa']);
  const colObservacao = findCol(['observacao', 'obs']);

  if (colConcurso === -1 || (colBolas.some((c) => c === -1) && colDezenasCombined === -1)) {
    return {
      imported: 0,
      updated: 0,
      skipped: lines.length - headerIndex - 1,
      total: getAllConcursos().length,
      minConcurso: null,
      maxConcurso: null,
      errors: [
        'Cabeçalho CSV não reconhecido. Esperado colunas "Concurso", "Data do Sorteio" e "Bola1".."Bola6".',
      ],
    };
  }

  const parsed: Concurso[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const concursoNum = sanitizeIntBR(cols[colConcurso]);
    if (!concursoNum || concursoNum <= 0) {
      skipped++;
      continue;
    }

    let dezenas: number[] = [];
    if (colBolas.every((idx) => idx !== -1)) {
      dezenas = colBolas.map((idx) => sanitizeIntBR(cols[idx]));
    } else if (colDezenasCombined !== -1) {
      dezenas = (cols[colDezenasCombined] || '')
        .split(/[\s,\-;]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));
    }

    const validDezenas = dezenas
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60)
      .sort((a, b) => a - b);

    if (validDezenas.length !== 6 || new Set(validDezenas).size !== 6) {
      skipped++;
      if (errors.length < 5) {
        errors.push(`Linha ${i + 1} (Concurso ${concursoNum}): dezenas inválidas.`);
      }
      continue;
    }

    const dataISO = colData !== -1 ? convertDateBRToISO(cols[colData]) : '';
    const soma_dezenas = validDezenas.reduce((acc, n) => acc + n, 0);
    const qtd_pares = validDezenas.filter((n) => n % 2 === 0).length;

    parsed.push({
      id: concursoNum,
      modalidade: 'mega-sena',
      concurso: concursoNum,
      data_sorteio: dataISO,
      dezenas: validDezenas,
      soma_dezenas,
      qtd_pares,
      ganhadores_sena: colGanhadores6 !== -1 ? sanitizeIntBR(cols[colGanhadores6]) : 0,
      rateio_sena: colRateio6 !== -1 ? sanitizeCurrencyBR(cols[colRateio6]) : 0,
      ganhadores_quina: colGanhadores5 !== -1 ? sanitizeIntBR(cols[colGanhadores5]) : 0,
      rateio_quina: colRateio5 !== -1 ? sanitizeCurrencyBR(cols[colRateio5]) : 0,
      ganhadores_quadra: colGanhadores4 !== -1 ? sanitizeIntBR(cols[colGanhadores4]) : 0,
      rateio_quadra: colRateio4 !== -1 ? sanitizeCurrencyBR(cols[colRateio4]) : 0,
      acumulado_sena: colAcumulado6 !== -1 ? sanitizeCurrencyBR(cols[colAcumulado6]) : 0,
      estimativa_premio: colEstimativa !== -1 ? sanitizeCurrencyBR(cols[colEstimativa]) : 0,
      arrecadacao_total: colArrecadacao !== -1 ? sanitizeCurrencyBR(cols[colArrecadacao]) : 0,
      cidade_uf: colCidade !== -1 ? (cols[colCidade] || '').trim() : '',
      observacao: colObservacao !== -1 ? (cols[colObservacao] || '').trim() : '',
    });
  }

  const { imported, updated, total } = upsertConcursos(parsed);
  const nums = parsed.map((p) => p.concurso);

  return {
    imported,
    updated,
    skipped,
    total,
    minConcurso: nums.length ? Math.min(...nums) : null,
    maxConcurso: nums.length ? Math.max(...nums) : null,
    errors,
  };
}

function mapCaixaApiRecord(raw: any): Concurso | null {
  const num = Number(raw?.numero ?? raw?.concurso);
  if (!Number.isFinite(num) || num <= 0) return null;

  const rawDezenas: any[] = raw?.listaDezenas ?? raw?.dezenas ?? [];
  const dezenas = rawDezenas
    .map((d) => parseInt(String(d), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60)
    .sort((a, b) => a - b);

  if (dezenas.length !== 6) return null;

  const dateRaw = raw?.dataApuracao ?? raw?.data ?? '';
  const dataISO = convertDateBRToISO(dateRaw);

  let ganhadores_sena = 0;
  let rateio_sena = 0;
  let ganhadores_quina = 0;
  let rateio_quina = 0;
  let ganhadores_quadra = 0;
  let rateio_quadra = 0;

  const rateios: any[] = raw?.listaRateioPremio ?? raw?.premiacoes ?? [];
  for (const r of rateios) {
    const desc = String(r?.descricaoFaixa ?? r?.descricao ?? '').toLowerCase();
    const faixa = Number(r?.faixa);
    const ganhadores = Number(r?.numeroDeGanhadores ?? r?.ganhadores ?? 0);
    const valor = sanitizeCurrencyBR(r?.valorPremio ?? 0);

    if (faixa === 1 || desc.includes('6 acertos') || desc.includes('sena')) {
      ganhadores_sena = ganhadores;
      rateio_sena = valor;
    } else if (faixa === 2 || desc.includes('5 acertos') || desc.includes('quina')) {
      ganhadores_quina = ganhadores;
      rateio_quina = valor;
    } else if (faixa === 3 || desc.includes('4 acertos') || desc.includes('quadra')) {
      ganhadores_quadra = ganhadores;
      rateio_quadra = valor;
    }
  }

  let cidade_uf = '';
  if (Array.isArray(raw?.listaMunicipioUFGanhadores) && raw.listaMunicipioUFGanhadores.length > 0) {
    cidade_uf = raw.listaMunicipioUFGanhadores
      .slice(0, 3)
      .map((m: any) => `${m.municipio}/${m.uf}`)
      .join(', ');
  } else if (Array.isArray(raw?.localGanhadores) && raw.localGanhadores.length > 0) {
    cidade_uf = raw.localGanhadores
      .slice(0, 3)
      .map((m: any) => m.local || `${m.municipio}/${m.uf}`)
      .join(', ');
  }

  const soma_dezenas = dezenas.reduce((acc, n) => acc + n, 0);
  const qtd_pares = dezenas.filter((n) => n % 2 === 0).length;

  return {
    id: num,
    modalidade: 'mega-sena',
    concurso: num,
    data_sorteio: dataISO,
    dezenas,
    soma_dezenas,
    qtd_pares,
    ganhadores_sena,
    rateio_sena,
    ganhadores_quina,
    rateio_quina,
    ganhadores_quadra,
    rateio_quadra,
    acumulado_sena: sanitizeCurrencyBR(raw?.valorAcumuladoProximoConcurso ?? raw?.valorAcumulado ?? 0),
    estimativa_premio: sanitizeCurrencyBR(raw?.valorEstimadoProximoConcurso ?? 0),
    arrecadacao_total: sanitizeCurrencyBR(raw?.valorArrecadado ?? 0),
    cidade_uf,
    observacao: raw?.acumulado ? 'Acumulou!' : '',
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; LotoMetria/1.0)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

export async function syncConcursosFromPublicApi(): Promise<SyncResponse> {
  const currentMax = getMaxConcursoNumber();
  const fetched: Concurso[] = [];
  let source = '';

  // Strategy 1: Public Loterias Caixa Heroku mirror (supports full array or /latest)
  try {
    if (currentMax === 0) {
      const allData = await fetchJsonWithTimeout(
        'https://loteriascaixa-api.herokuapp.com/api/megasena',
        12000
      );
      if (Array.isArray(allData)) {
        source = 'Loterias Caixa API (Histórico Completo)';
        for (const item of allData) {
          const mapped = mapCaixaApiRecord(item);
          if (mapped) fetched.push(mapped);
        }
      }
    } else {
      const latestRaw = await fetchJsonWithTimeout(
        'https://loteriascaixa-api.herokuapp.com/api/megasena/latest',
        8000
      );
      const latest = mapCaixaApiRecord(latestRaw);
      if (latest) {
        source = 'Loterias Caixa API (Incremental)';
        if (latest.concurso >= currentMax) {
          fetched.push(latest);
        }
        if (latest.concurso > currentMax + 1) {
          const gap = Math.min(latest.concurso - currentMax - 1, 50);
          for (let n = currentMax + 1; n < currentMax + 1 + gap; n++) {
            try {
              const itemRaw = await fetchJsonWithTimeout(
                `https://loteriascaixa-api.herokuapp.com/api/megasena/${n}`,
                6000
              );
              const mapped = mapCaixaApiRecord(itemRaw);
              if (mapped) fetched.push(mapped);
            } catch {
              // Skip individual missing draw
            }
          }
        }
      }
    }
  } catch {
    // Fallback to Strategy 2
  }

  // Strategy 2: Official Caixa ServiceBus API
  if (fetched.length === 0) {
    try {
      const latestRaw = await fetchJsonWithTimeout(
        'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/',
        10000
      );
      const latest = mapCaixaApiRecord(latestRaw);
      if (latest) {
        source = 'Portal Loterias Caixa (Oficial)';
        fetched.push(latest);

        const startFrom =
          currentMax > 0 ? currentMax + 1 : Math.max(1, latest.concurso - 29);
        const endAt = Math.min(latest.concurso - 1, startFrom + 49);

        for (let n = startFrom; n <= endAt; n++) {
          try {
            const itemRaw = await fetchJsonWithTimeout(
              `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/${n}`,
              6000
            );
            const mapped = mapCaixaApiRecord(itemRaw);
            if (mapped) fetched.push(mapped);
          } catch {
            // Continue on transient error
          }
        }
      }
    } catch {
      // Both external APIs unreachable
    }
  }

  if (fetched.length === 0) {
    const existing = getAllConcursos();
    const sorted = [...existing].sort((a, b) => b.concurso - a.concurso);
    return {
      syncedCount: 0,
      updatedCount: 0,
      totalConcursos: existing.length,
      maxConcurso: currentMax,
      source: 'Indisponível',
      message:
        'Não foi possível alcançar a API pública das Loterias Caixa neste momento. Utilize o upload de CSV ou tente novamente.',
      latestConcurso: sorted[0] ?? null,
    };
  }

  const { imported, updated, total } = upsertConcursos(fetched);
  const sorted = [...getAllConcursos()].sort((a, b) => b.concurso - a.concurso);
  const newMax = sorted[0]?.concurso ?? currentMax;

  return {
    syncedCount: imported,
    updatedCount: updated,
    totalConcursos: total,
    maxConcurso: newMax,
    source,
    message:
      imported > 0
        ? `${imported} novo(s) concurso(s) sincronizado(s) até o concurso #${newMax}.`
        : `Base atualizada sem duplicidades (último concurso: #${newMax}).`,
    latestConcurso: sorted[0] ?? null,
  };
}

export function createManualConcurso(payload: {
  concurso: number;
  data_sorteio: string;
  dezenas: number[];
  estimativa_premio?: number;
  acumulado_sena?: number;
  rateio_sena?: number;
  rateio_quina?: number;
  rateio_quadra?: number;
  ganhadores_sena?: number;
  ganhadores_quina?: number;
  ganhadores_quadra?: number;
  cidade_uf?: string;
}): Concurso {
  const dezenas = [...payload.dezenas].sort((a, b) => a - b);
  const record: Concurso = {
    id: payload.concurso,
    modalidade: 'mega-sena',
    concurso: payload.concurso,
    data_sorteio: convertDateBRToISO(payload.data_sorteio),
    dezenas,
    soma_dezenas: dezenas.reduce((acc, n) => acc + n, 0),
    qtd_pares: dezenas.filter((n) => n % 2 === 0).length,
    ganhadores_sena: payload.ganhadores_sena ?? 0,
    rateio_sena: payload.rateio_sena ?? 0,
    ganhadores_quina: payload.ganhadores_quina ?? 0,
    rateio_quina: payload.rateio_quina ?? 0,
    ganhadores_quadra: payload.ganhadores_quadra ?? 0,
    rateio_quadra: payload.rateio_quadra ?? 0,
    acumulado_sena: payload.acumulado_sena ?? 0,
    estimativa_premio: payload.estimativa_premio ?? 0,
    arrecadacao_total: 0,
    cidade_uf: payload.cidade_uf ?? '',
    observacao: (payload.ganhadores_sena ?? 0) === 0 ? 'Acumulou!' : '',
  };
  upsertConcursos([record]);
  return record;
}

// --- Bolões Persistence & Logic ---

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBolao(input: {
  titulo: string;
  concurso_alvo: number;
  qtd_cotas_totais: number;
  valor_cota?: number;
  jogos?: number[][];
  participantes?: Array<{ nome: string; telefone?: string; cotas_compradas: number; pago?: boolean }>;
}): Bolao {
  const boloes = getAllBoloes();
  const bolaoId = uid();

  const jogos: BolaoJogo[] = (input.jogos ?? []).map((dezenas) => {
    const sorted = [...dezenas].sort((a, b) => a - b);
    return {
      id: uid(),
      bolao_id: bolaoId,
      dezenas: sorted,
      valor_aposta: calculateBetCost(sorted.length, 'mega-sena'),
      acertos: null,
      premio_estimado: 0,
    };
  });

  const totalCost = jogos.reduce((acc, j) => acc + j.valor_aposta, 0);
  const cotas = Math.max(1, input.qtd_cotas_totais || 10);
  const autoQuota = totalCost > 0 ? Number((totalCost / cotas).toFixed(2)) : 0;

  const participantes: BolaoParticipante[] = (input.participantes ?? []).map((p) => ({
    id: uid(),
    bolao_id: bolaoId,
    nome: p.nome.trim(),
    telefone: (p.telefone ?? '').trim(),
    cotas_compradas: Math.max(1, p.cotas_compradas || 1),
    pago: Boolean(p.pago),
  }));

  const newBolao: Bolao = {
    id: bolaoId,
    user_id: 'local-organizer',
    titulo: input.titulo.trim() || `Bolão Concurso #${input.concurso_alvo}`,
    modalidade: 'mega-sena',
    concurso_alvo: input.concurso_alvo,
    valor_cota: input.valor_cota !== undefined && input.valor_cota > 0 ? input.valor_cota : autoQuota,
    qtd_cotas_totais: cotas,
    status: 'aberto',
    created_at: new Date().toISOString(),
    participantes,
    jogos,
  };

  saveBoloes([newBolao, ...boloes]);
  return newBolao;
}

export function recalculateQuotaIfZeroOrAuto(bolao: Bolao, forceAuto = true): Bolao {
  const totalCost = bolao.jogos.reduce((acc, j) => acc + j.valor_aposta, 0);
  if (forceAuto && bolao.qtd_cotas_totais > 0) {
    bolao.valor_cota = Number((totalCost / bolao.qtd_cotas_totais).toFixed(2));
  }
  return bolao;
}

export function updateBolao(
  id: string,
  patch: Partial<Pick<Bolao, 'titulo' | 'concurso_alvo' | 'qtd_cotas_totais' | 'valor_cota' | 'status'>>
): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const updated: Bolao = { ...boloes[idx], ...patch };
  if (patch.qtd_cotas_totais !== undefined && patch.valor_cota === undefined) {
    recalculateQuotaIfZeroOrAuto(updated, true);
  }
  boloes[idx] = updated;
  saveBoloes(boloes);
  return updated;
}

export function deleteBolao(id: string): boolean {
  const boloes = getAllBoloes();
  const filtered = boloes.filter((b) => b.id !== id);
  if (filtered.length === boloes.length) return false;
  saveBoloes(filtered);
  return true;
}

export function addGamesToBolao(id: string, gamesList: number[][]): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const bolao = { ...boloes[idx] };
  const existingSigs = new Set(bolao.jogos.map((j) => comboSignature(j.dezenas)));

  const additions: BolaoJogo[] = [];
  for (const raw of gamesList) {
    const sorted = Array.from(new Set(raw))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60)
      .sort((a, b) => a - b);
    if (sorted.length < 6 || sorted.length > 15) continue;
    const sig = comboSignature(sorted);
    if (existingSigs.has(sig)) continue;
    existingSigs.add(sig);
    additions.push({
      id: uid(),
      bolao_id: bolao.id,
      dezenas: sorted,
      valor_aposta: calculateBetCost(sorted.length, 'mega-sena'),
      acertos: null,
      premio_estimado: 0,
    });
  }

  bolao.jogos = [...bolao.jogos, ...additions];
  recalculateQuotaIfZeroOrAuto(bolao, true);
  boloes[idx] = bolao;
  saveBoloes(boloes);
  return bolao;
}

export function removeGameFromBolao(bolaoId: string, gameId: string): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === bolaoId);
  if (idx === -1) return null;

  const bolao = {
    ...boloes[idx],
    jogos: boloes[idx].jogos.filter((j) => j.id !== gameId),
  };
  recalculateQuotaIfZeroOrAuto(bolao, true);
  boloes[idx] = bolao;
  saveBoloes(boloes);
  return bolao;
}

export function addParticipantToBolao(
  bolaoId: string,
  participant: { nome: string; telefone?: string; cotas_compradas: number; pago?: boolean }
): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === bolaoId);
  if (idx === -1) return null;

  const newPart: BolaoParticipante = {
    id: uid(),
    bolao_id: bolaoId,
    nome: participant.nome.trim(),
    telefone: (participant.telefone ?? '').trim(),
    cotas_compradas: Math.max(1, participant.cotas_compradas || 1),
    pago: Boolean(participant.pago),
  };

  const bolao = {
    ...boloes[idx],
    participantes: [...boloes[idx].participantes, newPart],
  };
  boloes[idx] = bolao;
  saveBoloes(boloes);
  return bolao;
}

export function updateParticipantInBolao(
  bolaoId: string,
  participantId: string,
  patch: Partial<Pick<BolaoParticipante, 'nome' | 'telefone' | 'cotas_compradas' | 'pago'>>
): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === bolaoId);
  if (idx === -1) return null;

  const bolao = {
    ...boloes[idx],
    participantes: boloes[idx].participantes.map((p) =>
      p.id === participantId ? { ...p, ...patch } : p
    ),
  };
  boloes[idx] = bolao;
  saveBoloes(boloes);
  return bolao;
}

export function removeParticipantFromBolao(bolaoId: string, participantId: string): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === bolaoId);
  if (idx === -1) return null;

  const bolao = {
    ...boloes[idx],
    participantes: boloes[idx].participantes.filter((p) => p.id !== participantId),
  };
  boloes[idx] = bolao;
  saveBoloes(boloes);
  return bolao;
}

export function checkBolaoResults(
  bolaoId: string,
  drawnDezenas: number[],
  rateios?: { sena: number; quina: number; quadra: number }
): Bolao | null {
  const boloes = getAllBoloes();
  const idx = boloes.findIndex((b) => b.id === bolaoId);
  if (idx === -1) return null;

  const bolao = { ...boloes[idx] };
  bolao.jogos = bolao.jogos.map((j) => {
    const evalResult = evaluateTicketHits(j.dezenas, drawnDezenas, rateios);
    return {
      ...j,
      acertos: evalResult.acertos,
      premio_estimado: evalResult.premioEstimado,
      senas: evalResult.senas,
      quinas: evalResult.quinas,
      quadras: evalResult.quadras,
    };
  });
  bolao.status = 'conferido';
  boloes[idx] = bolao;
  saveBoloes(boloes);
  return bolao;
}
