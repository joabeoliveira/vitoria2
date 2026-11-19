import type { Bolao } from '../types/lottery';
import { formatBRL, padDezena } from './lotteryMath';

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportGamesToTXT(games: number[][], filenamePrefix = 'jogos_megasena') {
  const lines = games.map((g) => g.map(padDezena).join(' '));
  triggerDownload(lines.join('\n'), `${filenamePrefix}.txt`, 'text/plain;charset=utf-8');
}

export function exportGamesToCSV(
  games: Array<{ dezenas: number[]; soma?: number; valorAposta?: number; acertos?: number | null }>,
  filenamePrefix = 'jogos_megasena'
) {
  const header = ['Jogo', 'Dezenas', 'Qtd_Dezenas', 'Soma', 'Valor_Aposta', 'Acertos'];
  const rows = games.map((g, idx) => {
    const soma = g.soma ?? g.dezenas.reduce((acc, n) => acc + n, 0);
    const val = g.valorAposta ?? 5.0;
    const acertos = g.acertos ?? '';
    return [
      String(idx + 1),
      `"${g.dezenas.map(padDezena).join(' - ')}"`,
      String(g.dezenas.length),
      String(soma),
      val.toFixed(2).replace('.', ','),
      String(acertos),
    ].join(';');
  });

  triggerDownload(
    '\uFEFF' + [header.join(';'), ...rows].join('\n'),
    `${filenamePrefix}.csv`,
    'text/csv;charset=utf-8'
  );
}

export function formatWhatsAppSummary(bolao: Bolao): string {
  const totalJogosCost = bolao.jogos.reduce((acc, j) => acc + j.valor_aposta, 0);
  const cotasVendidas = bolao.participantes.reduce((acc, p) => acc + p.cotas_compradas, 0);
  const cotasPagas = bolao.participantes
    .filter((p) => p.pago)
    .reduce((acc, p) => acc + p.cotas_compradas, 0);

  const lines: string[] = [
    `*BOLÃO: ${bolao.titulo}*`,
    `Modalidade: Mega-Sena · Concurso Alvo: #${bolao.concurso_alvo}`,
    `Total em Apostas: ${formatBRL(totalJogosCost)} (${bolao.jogos.length} jogo${bolao.jogos.length === 1 ? '' : 's'})`,
    `Cotas: ${cotasVendidas}/${bolao.qtd_cotas_totais} reservadas (${cotasPagas} pagas)`,
    `Valor da Cota: ${formatBRL(bolao.valor_cota)}`,
    '',
    '*Participantes:*',
  ];

  if (bolao.participantes.length === 0) {
    lines.push('Nenhum participante cadastrado ainda.');
  } else {
    bolao.participantes.forEach((p) => {
      const status = p.pago ? 'PAGO' : 'PENDENTE';
      lines.push(`- ${p.nome} (${p.cotas_compradas}x) — ${status}`);
    });
  }

  lines.push('');
  lines.push('*Jogos do Bolão:*');
  bolao.jogos.forEach((j, idx) => {
    const hits = j.acertos !== null ? ` [${j.acertos} acertos]` : '';
    lines.push(
      `${String(idx + 1).padStart(2, '0')}. ${j.dezenas.map(padDezena).join(' - ')}${hits}`
    );
  });

  lines.push('');
  lines.push('_Ferramenta independente de apoio estatístico. Não garante premiações._');
  return lines.join('\n');
}

export function generateSampleCaixaCSV(): string {
  const headers = [
    'Concurso',
    'Data do Sorteio',
    'Bola1',
    'Bola2',
    'Bola3',
    'Bola4',
    'Bola5',
    'Bola6',
    'Ganhadores 6 acertos',
    'Cidade / UF',
    'Rateio 6 acertos',
    'Ganhadores 5 acertos',
    'Rateio 5 acertos',
    'Ganhadores 4 acertos',
    'Rateio 4 acertos',
    'Acumulado 6 acertos',
    'Arrecadação Total',
    'Estimativa prêmio',
    'Observação',
  ].join(';');

  const rows = [
    '3085;10/11/2026;04;15;27;36;48;59;0;;R$ 0,00;64;R$ 48.210,45;4.512;R$ 976,30;R$ 42.300.000,00;R$ 68.500.000,00;R$ 50.000.000,00;Acumulou!',
    '3086;14/11/2026;05;10;22;37;44;53;1;São Paulo/SP;R$ 51.420.890,15;89;R$ 39.112,80;5.840;R$ 851,20;R$ 0,00;R$ 74.120.000,00;R$ 3.500.000,00;',
    '3087;17/11/2026;07;13;28;33;46;58;0;;R$ 0,00;41;R$ 54.901,10;3.120;R$ 1.032,55;R$ 3.890.000,00;R$ 41.200.000,00;R$ 8.500.000,00;Acumulou!',
  ];

  return '\uFEFF' + [headers, ...rows].join('\n');
}
