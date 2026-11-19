import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addGamesToBolao,
  addParticipantToBolao,
  checkBolaoResults,
  createBolao,
  createManualConcurso,
  deleteBolao,
  getAllBoloes,
  getAllConcursos,
  importConcursosFromCSV,
  removeGameFromBolao,
  removeParticipantFromBolao,
  syncConcursosFromPublicApi,
  updateBolao,
  updateParticipantInBolao,
} from './server/lotteryService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.text({ limit: '25mb', type: ['text/csv', 'text/plain'] }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // --- Concursos & Ingestion Endpoints ---
  app.get('/api/concursos', (_req, res) => {
    const concursos = getAllConcursos();
    res.json({
      total: concursos.length,
      concursos,
    });
  });

  app.post('/api/concursos/import-csv', (req, res) => {
    try {
      const csvText =
        typeof req.body === 'string'
          ? req.body
          : typeof req.body?.csv === 'string'
            ? req.body.csv
            : '';

      if (!csvText.trim()) {
        return res.status(400).json({ error: 'Conteúdo CSV não fornecido.' });
      }

      const result = importConcursosFromCSV(csvText);
      res.json(result);
    } catch (error: any) {
      console.error('CSV import error:', error);
      res.status(500).json({ error: error?.message || 'Erro ao importar arquivo CSV.' });
    }
  });

  app.post('/api/concursos/manual', (req, res) => {
    try {
      const { concurso, data_sorteio, dezenas } = req.body || {};
      if (!concurso || !Array.isArray(dezenas) || dezenas.length !== 6) {
        return res
          .status(400)
          .json({ error: 'Informe número do concurso e exatamente 6 dezenas válidas.' });
      }
      const saved = createManualConcurso(req.body);
      res.json({ concurso: saved, total: getAllConcursos().length });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro ao salvar concurso manual.' });
    }
  });

  app.post('/api/sync-concursos', async (_req, res) => {
    try {
      const result = await syncConcursosFromPublicApi();
      res.json(result);
    } catch (error: any) {
      console.error('Sync concursos error:', error);
      res.status(500).json({ error: error?.message || 'Erro ao sincronizar concursos.' });
    }
  });

  // --- Bolões Management Endpoints ---
  app.get('/api/boloes', (_req, res) => {
    res.json({ boloes: getAllBoloes() });
  });

  app.post('/api/boloes', (req, res) => {
    try {
      const { titulo, concurso_alvo, qtd_cotas_totais, valor_cota, jogos, participantes } =
        req.body || {};
      const bolao = createBolao({
        titulo: titulo || `Bolão Concurso #${concurso_alvo || 3088}`,
        concurso_alvo: Number(concurso_alvo) || 3088,
        qtd_cotas_totais: Number(qtd_cotas_totais) || 10,
        valor_cota: valor_cota !== undefined ? Number(valor_cota) : undefined,
        jogos: Array.isArray(jogos) ? jogos : [],
        participantes: Array.isArray(participantes) ? participantes : [],
      });
      res.status(201).json({ bolao });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro ao criar bolão.' });
    }
  });

  app.patch('/api/boloes/:id', (req, res) => {
    const updated = updateBolao(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ bolao: updated });
  });

  app.delete('/api/boloes/:id', (req, res) => {
    const removed = deleteBolao(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ ok: true });
  });

  app.post('/api/boloes/:id/jogos', (req, res) => {
    const { jogos } = req.body || {};
    if (!Array.isArray(jogos)) {
      return res.status(400).json({ error: 'Lista de jogos inválida.' });
    }
    const updated = addGamesToBolao(req.params.id, jogos);
    if (!updated) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ bolao: updated });
  });

  app.delete('/api/boloes/:id/jogos/:jid', (req, res) => {
    const updated = removeGameFromBolao(req.params.id, req.params.jid);
    if (!updated) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ bolao: updated });
  });

  app.post('/api/boloes/:id/participantes', (req, res) => {
    const { nome, telefone, cotas_compradas, pago } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: 'Nome do participante é obrigatório.' });
    }
    const updated = addParticipantToBolao(req.params.id, {
      nome: String(nome),
      telefone: telefone ? String(telefone) : '',
      cotas_compradas: Number(cotas_compradas) || 1,
      pago: Boolean(pago),
    });
    if (!updated) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ bolao: updated });
  });

  app.patch('/api/boloes/:id/participantes/:pid', (req, res) => {
    const updated = updateParticipantInBolao(req.params.id, req.params.pid, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Bolão ou participante não encontrado.' });
    res.json({ bolao: updated });
  });

  app.delete('/api/boloes/:id/participantes/:pid', (req, res) => {
    const updated = removeParticipantFromBolao(req.params.id, req.params.pid);
    if (!updated) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ bolao: updated });
  });

  app.post('/api/boloes/:id/conferir', (req, res) => {
    const { dezenas, concurso_numero, rateios } = req.body || {};
    let drawn: number[] = [];
    let prizeRates = rateios;

    if (concurso_numero) {
      const found = getAllConcursos().find((c) => c.concurso === Number(concurso_numero));
      if (!found) {
        return res.status(404).json({ error: `Concurso #${concurso_numero} não encontrado na base.` });
      }
      drawn = found.dezenas;
      prizeRates = {
        sena: found.rateio_sena,
        quina: found.rateio_quina,
        quadra: found.rateio_quadra,
      };
    } else if (Array.isArray(dezenas)) {
      drawn = dezenas
        .map((n: any) => parseInt(String(n), 10))
        .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 60);
    }

    if (new Set(drawn).size !== 6) {
      return res.status(400).json({ error: 'Informe exatamente 6 dezenas distintas entre 01 e 60.' });
    }

    const updated = checkBolaoResults(req.params.id, drawn, prizeRates);
    if (!updated) return res.status(404).json({ error: 'Bolão não encontrado.' });
    res.json({ bolao: updated, dezenasSorteadas: [...drawn].sort((a, b) => a - b) });
  });

  // --- Vite / Static Frontend Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // The production server is bundled into /app/server-dist while the Vite
    // output is copied to /app/dist in the Docker image.
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
