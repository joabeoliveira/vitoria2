export type Modalidade = 'mega-sena' | 'lotofacil' | 'quina';

export interface ModalityConfig {
  id: Modalidade;
  name: string;
  totalNumbers: number;
  columns: number;
  minPerBet: number;
  maxPerBet: number;
  drawSize: number;
  basePrice: number;
  active: boolean;
  description: string;
}

export interface Concurso {
  id: number;
  modalidade: Modalidade;
  concurso: number;
  data_sorteio: string; // YYYY-MM-DD
  dezenas: number[];
  soma_dezenas: number;
  qtd_pares: number;
  ganhadores_sena: number;
  rateio_sena: number;
  ganhadores_quina: number;
  rateio_quina: number;
  ganhadores_quadra: number;
  rateio_quadra: number;
  acumulado_sena: number;
  estimativa_premio: number;
  arrecadacao_total: number;
  cidade_uf: string;
  observacao: string;
}

export type BolaoStatus = 'aberto' | 'fechado' | 'conferido';

export interface BolaoParticipante {
  id: string;
  bolao_id: string;
  nome: string;
  telefone: string;
  cotas_compradas: number;
  pago: boolean;
}

export interface BolaoJogo {
  id: string;
  bolao_id: string;
  dezenas: number[];
  valor_aposta: number;
  acertos: number | null;
  premio_estimado: number;
  senas?: number;
  quinas?: number;
  quadras?: number;
}

export interface Bolao {
  id: string;
  user_id: string;
  titulo: string;
  modalidade: Modalidade;
  concurso_alvo: number;
  valor_cota: number;
  qtd_cotas_totais: number;
  status: BolaoStatus;
  created_at: string;
  participantes: BolaoParticipante[];
  jogos: BolaoJogo[];
}

export type ParityPattern =
  | '0P/6I'
  | '1P/5I'
  | '2P/4I'
  | '3P/3I'
  | '4P/2I'
  | '5P/1I'
  | '6P/0I';

export interface GeneratorFilters {
  allowedParities: ParityPattern[];
  useParityFilter: boolean;
  useSumFilter: boolean;
  minSum: number;
  maxSum: number;
  antiSequence: boolean;
  maxConsecutive: number;
  lineQuadrantBalance: boolean;
  uniqueHistorical: boolean;
}

export interface GeneratedGame {
  id: string;
  dezenas: number[];
  soma: number;
  pares: number;
  impares: number;
  valorAposta: number;
  inedito: boolean;
}

export interface GenerationResult {
  games: GeneratedGame[];
  elapsedMs: number;
  attempts: number;
  warning?: string;
}

export interface NumberFrequency {
  dezena: number;
  count: number;
  percentage: number;
  delay: number;
  lastConcurso: number | null;
}

export interface SumBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  inIQR: boolean;
}

export interface ParityBucket {
  label: ParityPattern;
  pares: number;
  impares: number;
  count: number;
  percentage: number;
  balanced: boolean;
}

export interface DashboardStats {
  totalConcursos: number;
  periodConcursos: number;
  latestConcurso: Concurso | null;
  meanSum: number;
  q1Sum: number;
  medianSum: number;
  q3Sum: number;
  frequencies: NumberFrequency[];
  hotNumbers: NumberFrequency[];
  coldNumbers: NumberFrequency[];
  mostDelayed: NumberFrequency[];
  sumDistribution: SumBucket[];
  parityDistribution: ParityBucket[];
}

export interface SyncResponse {
  syncedCount: number;
  updatedCount: number;
  totalConcursos: number;
  maxConcurso: number;
  source: string;
  message: string;
  latestConcurso: Concurso | null;
}

export interface CsvImportResponse {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  minConcurso: number | null;
  maxConcurso: number | null;
  errors: string[];
}
