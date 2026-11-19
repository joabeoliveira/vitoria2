import { combinationsCount } from './lotteryMath';

export interface ClosurePreset {
  id: string;
  selectedCount: number;
  ticketCount: number;
  guaranteeLabel: string;
  description: string;
  fullCombinations: number;
  savingsPercent: number;
  indicesMatrix: number[][];
}

export function generateAllCombinations(numbers: number[], k = 6): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const result: number[][] = [];
  const current: number[] = [];

  function backtrack(start: number) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    const needed = k - current.length;
    for (let i = start; i <= sorted.length - needed; i++) {
      current.push(sorted[i]);
      backtrack(i + 1);
      current.pop();
    }
  }

  backtrack(0);
  return result;
}

// Deterministic greedy set-cover builder for guaranteed (n, 6, t, m) covering matrices
// Guarantees that if `m` drawn numbers lie inside the `n` chosen numbers,
// at least one ticket of 6 shares >= `t` numbers with them.
function buildCoveringMatrix(
  n: number,
  targetMatch: number,
  hitCondition: number,
  maxTickets?: number
): number[][] {
  const baseIndices = Array.from({ length: n }, (_, i) => i);
  const all6 = generateAllCombinations(baseIndices, 6);
  const subsetsToCover = generateAllCombinations(baseIndices, hitCondition);

  // Precompute bitmasks for fast coverage checks (n <= 15 fits in 15-bit integer!)
  const subsetMasks = subsetsToCover.map((sub) =>
    sub.reduce((mask, idx) => mask | (1 << idx), 0)
  );
  const ticketMasks = all6.map((t) =>
    t.reduce((mask, idx) => mask | (1 << idx), 0)
  );

  const uncovered = new Uint8Array(subsetMasks.length).fill(1);
  let remaining = subsetMasks.length;
  const chosenIndices: number[] = [];
  const usedTicket = new Uint8Array(ticketMasks.length);

  while (remaining > 0 && (!maxTickets || chosenIndices.length < maxTickets)) {
    let bestIdx = -1;
    let bestGain = -1;

    for (let ti = 0; ti < ticketMasks.length; ti++) {
      if (usedTicket[ti]) continue;
      const tMask = ticketMasks[ti];
      let gain = 0;
      for (let si = 0; si < subsetMasks.length; si++) {
        if (uncovered[si]) {
          // popcount(tMask & subsetMasks[si]) >= targetMatch
          let inter = tMask & subsetMasks[si];
          let bits = 0;
          while (inter) {
            inter &= inter - 1;
            bits++;
          }
          if (bits >= targetMatch) {
            gain++;
          }
        }
      }
      if (gain > bestGain) {
        bestGain = gain;
        bestIdx = ti;
      }
    }

    if (bestIdx === -1 || bestGain <= 0) break;
    usedTicket[bestIdx] = 1;
    chosenIndices.push(bestIdx);

    const bestMask = ticketMasks[bestIdx];
    for (let si = 0; si < subsetMasks.length; si++) {
      if (uncovered[si]) {
        let inter = bestMask & subsetMasks[si];
        let bits = 0;
        while (inter) {
          inter &= inter - 1;
          bits++;
        }
        if (bits >= targetMatch) {
          uncovered[si] = 0;
          remaining--;
        }
      }
    }
  }

  return chosenIndices.map((idx) => all6[idx]);
}

// Compute coverage stats for any matrix
export function measureMatrixCoverage(
  matrix: number[][],
  n: number,
  targetMatch: number,
  hitCondition: number
): number {
  const baseIndices = Array.from({ length: n }, (_, i) => i);
  const subsets = generateAllCombinations(baseIndices, hitCondition);
  const subsetMasks = subsets.map((s) => s.reduce((m, i) => m | (1 << i), 0));
  const ticketMasks = matrix.map((t) => t.reduce((m, i) => m | (1 << i), 0));

  let covered = 0;
  for (const sMask of subsetMasks) {
    let ok = false;
    for (const tMask of ticketMasks) {
      let inter = sMask & tMask;
      let bits = 0;
      while (inter) {
        inter &= inter - 1;
        bits++;
      }
      if (bits >= targetMatch) {
        ok = true;
        break;
      }
    }
    if (ok) covered++;
  }

  return subsetMasks.length > 0 ? Number(((covered / subsetMasks.length) * 100).toFixed(1)) : 100;
}

const cachedPresets: Map<string, ClosurePreset> = new Map();

export interface PresetDefinition {
  id: string;
  selectedCount: number;
  targetMatch: number;
  hitCondition: number;
  maxTickets?: number;
  guaranteeLabel: string;
  description: string;
}

export const CLOSURE_PRESET_DEFS: PresetDefinition[] = [
  {
    id: '8-quadra-5',
    selectedCount: 8,
    targetMatch: 4,
    hitCondition: 5,
    guaranteeLabel: 'Quadra garantida se acertar 5',
    description: 'Fechamento ultra-econômico de 8 dezenas com garantia matemática de Quadra acertando 5.',
  },
  {
    id: '8-quadra-4',
    selectedCount: 8,
    targetMatch: 4,
    hitCondition: 4,
    guaranteeLabel: 'Quadra garantida se acertar 4',
    description: 'Cobertura de 100% para Quadra caso 4 das 6 dezenas sorteadas estejam entre as 8.',
  },
  {
    id: '9-quadra-4',
    selectedCount: 9,
    targetMatch: 4,
    hitCondition: 4,
    guaranteeLabel: 'Quadra garantida se acertar 4',
    description: 'Reduz 84 combinações mantendo garantia matemática de Quadra ao acertar 4 dezenas.',
  },
  {
    id: '10-quadra-4',
    selectedCount: 10,
    targetMatch: 4,
    hitCondition: 4,
    guaranteeLabel: 'Quadra garantida se acertar 4',
    description: 'Clássico fechamento de 10 dezenas com economia expressiva sobre os 210 jogos completos.',
  },
  {
    id: '10-quina-5',
    selectedCount: 10,
    targetMatch: 5,
    hitCondition: 6,
    guaranteeLabel: 'Quina garantida se acertar 6',
    description: 'Se as 6 dezenas sorteadas estiverem entre as 10 escolhidas, garante pelo menos Quina.',
  },
  {
    id: '12-quadra-4',
    selectedCount: 12,
    targetMatch: 4,
    hitCondition: 4,
    guaranteeLabel: 'Quadra garantida se acertar 4',
    description: 'Fecha 12 dezenas reduzindo 924 jogos completos para uma matriz enxuta garantida.',
  },
  {
    id: '12-quina-5',
    selectedCount: 12,
    targetMatch: 5,
    hitCondition: 6,
    maxTickets: 48,
    guaranteeLabel: 'Alta cobertura de Quina/Quadra (48 jogos)',
    description: 'Matriz balanceada de 48 jogos para bolões com 12 dezenas selecionadas.',
  },
  {
    id: '15-quadra-5',
    selectedCount: 15,
    targetMatch: 4,
    hitCondition: 5,
    maxTickets: 45,
    guaranteeLabel: 'Matriz econômica 15 dezenas (45 jogos)',
    description: 'Reduz 5.005 jogos para 45 apostas simples com foco em Quadras múltiplas.',
  },
];

export function getClosurePreset(id: string): ClosurePreset | null {
  if (cachedPresets.has(id)) {
    return cachedPresets.get(id)!;
  }
  const def = CLOSURE_PRESET_DEFS.find((d) => d.id === id);
  if (!def) return null;

  const matrix = buildCoveringMatrix(
    def.selectedCount,
    def.targetMatch,
    def.hitCondition,
    def.maxTickets
  );
  const full = combinationsCount(def.selectedCount, 6);
  const savingsPercent = Number((((full - matrix.length) / full) * 100).toFixed(1));

  const preset: ClosurePreset = {
    id: def.id,
    selectedCount: def.selectedCount,
    ticketCount: matrix.length,
    guaranteeLabel: def.guaranteeLabel,
    description: def.description,
    fullCombinations: full,
    savingsPercent,
    indicesMatrix: matrix,
  };

  cachedPresets.set(id, preset);
  return preset;
}

export function applyClosureMatrix(selectedNumbers: number[], matrix: number[][]): number[][] {
  const sorted = [...selectedNumbers].sort((a, b) => a - b);
  return matrix.map((row) => row.map((idx) => sorted[idx]).sort((a, b) => a - b));
}
