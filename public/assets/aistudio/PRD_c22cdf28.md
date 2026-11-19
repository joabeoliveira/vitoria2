# PRD — Plataforma Inteligente de Geração de Jogos e Gestão de Bolões (Mega-Sena e Loterias)

## 1. Visão Geral do Produto
**Objetivo:** Desenvolver uma aplicação web moderna e responsiva para geração inteligente de combinações da Mega-Sena (com arquitetura expansível para Lotofácil e Quina), análise estatística baseada no histórico oficial de concursos, fechamentos combinatórios e gestão completa de bolões entre amigos/grupos.

**Público-Alvo:**
* Apostadores individuais que buscam filtros matemáticos e estatísticos para montar jogos mais equilibrados.
* Organizadores de bolões que precisam ratear custos, gerenciar participantes, gerar volantes e conferir dezenas ou centenas de bilhetes automaticamente.

**Premissa de Compliance (Obrigatória):**
A aplicação é uma ferramenta independente de apoio estatístico e organização combinatória, **sem vínculo com a Caixa Econômica Federal**. O sistema **não realiza apostas financeiras online** e **não garante premiações**, exibindo aviso claro no rodapé e nos termos de uso.

---

## 2. Arquitetura de Dados e Ingestão
### 2.1. Carga Inicial (Seed via CSV)
* O sistema deve permitir a importação inicial via arquivo CSV (`resultados_ate_3087.csv`, contendo os concursos `1` a `3087` até `17/11/2026`).
* **Regras de Parser do CSV:**
  * Converter `Data do Sorteio` de `DD/MM/AAAA` para `YYYY-MM-DD`.
  * Sanitizar campos monetários (`Rateio 6 acertos`, `Acumulado 6 acertos`, `Estimativa prêmio`, `Arrecadação Total`) removendo `"R$"`, pontos de milhar e substituindo vírgula por ponto decimal (`NUMERIC(14,2)`).
  * Armazenar `Bola1`..`Bola6` como array de inteiros ordenados (`SMALLINT[]`).

### 2.2. Atualização Incremental via API
* Implementar endpoint/serviço de sincronização (`POST /api/sync-concursos`) que consulta o maior número de concurso salvo no banco (`MAX(concurso)`), busca os novos concursos em API pública de resultados das Loterias Caixa e realiza `UPSERT` (`ON CONFLICT DO UPDATE`) para manter rateios e acumulados sempre atualizados.
* Botão manual de "Atualizar Resultados" no painel administrativo + suporte a chamada via webhook/cron externo.

### 2.3. Esquema Principal do Banco de Dados (PostgreSQL / Supabase)
* **`concursos`**: `id`, `modalidade` (`mega-sena`), `concurso` (UNIQUE), `data_sorteio`, `dezenas` (`int[]`), `soma_dezenas` (`int`), `qtd_pares` (`int`), `ganhadores_sena`, `rateio_sena`, `ganhadores_quina`, `rateio_quina`, `ganhadores_quadra`, `rateio_quadra`, `acumulado_sena`, `estimativa_premio`, `cidade_uf`, `observacao`.
* **`boloes`**: `id`, `user_id`, `titulo`, `modalidade`, `concurso_alvo`, `valor_cota`, `qtd_cotas_totais`, `status` (`aberto`, `fechado`, `conferido`), `created_at`.
* **`bolao_participantes`**: `id`, `bolao_id`, `nome`, `telefone`, `cotas_compradas`, `pago` (`boolean`).
* **`bolao_jogos`**: `id`, `bolao_id`, `dezenas` (`int[]`), `valor_aposta`, `acertos` (`int`), `premio_estimado`.

---

## 3. Funcionalidades Principais (Escopo do MVP)

### 3.1. Dashboard Estatístico Histórico
* Exibição do último concurso sincronizado, valor estimado do próximo prêmio e status acumulado.
* **Ranking de Frequência:** Dezenas mais sorteadas ("Quentes" — ex.: `10`, `53`, `05`, `37`, `27`) e menos sorteadas ("Frias" — ex.: `26`, `21`, `55`, `15`, `22`), com filtro por período (Últimos 10, 50, 100 concursos ou Todo o histórico).
* **Mapa de Atraso:** Lista das dezenas que estão há mais concursos consecutivos sem sair.
* **Distribuição Histórica:** Gráficos exibindo a curva de soma das dezenas (destacando a faixa interquartil padrão de `155` a `211`, média `183`) e proporção de pares/ímpares.

### 3.2. Gerador Inteligente de Combinações
Interface com **volante interativo (01 a 60)** onde o usuário pode configurar:
* **Quantidade de jogos a gerar:** de 1 a 50 jogos por lote.
* **Quantidade de dezenas por jogo:** de 6 a 15 dezenas (com cálculo automático do custo oficial da aposta).
* **Dezenas Fixas e Excluídas:** Permitir clicar no volante para **travar** dezenas obrigatórias em todos os jogos ou **bloquear** dezenas indesejadas.
* **Filtros Heurísticos (com presets recomendados pré-marcados):**
  * **Equilíbrio Par/Ímpar:** Permitir restringir para `3P/3I`, `4P/2I` ou `2P/4I` (que cobrem ~79% dos resultados históricos).
  * **Faixa de Soma:** Definir mínimo e máximo para a soma das 6 dezenas (padrão sugerido: `150` a `215`).
  * **Anti-Sequência:** Bloquear mais de 2 dezenas consecutivas no mesmo jogo (ex.: evitar `12-13-14`).
  * **Distribuição por Linhas/Quadrantes:** Evitar jogos concentrados em uma única linha ou quadrante do volante.
  * **Filtro Inédito:** Verificar automaticamente no banco se a combinação de 6 dezenas já foi sorteada exatamente igual na história e descartar se positivo.

### 3.3. Desdobramentos e Fechamentos Lotéricos
* **Desdobramento Completo:** O usuário seleciona de 7 a 12 dezenas e visualiza todas as combinações $C(n,6)$ e o custo total.
* **Fechamento Reduzido (Matrizes):** Selecionar de 8 a 15 dezenas e aplicar matrizes matemáticas pré-configuradas (ex.: *10 dezenas garantindo Quadra se acertar 4*, *12 dezenas garantindo Quina/Quadra*) para reduzir drasticamente o custo mantendo garantia matemática condicional.

### 3.4. Módulo de Gestão de Bolões & Conferidor em Lote
* **Criação de Bolão:** Nome do bolão, concurso alvo, importação direta dos jogos gerados no Gerador/Fechamento.
* **Rateio e Cotas:** Cálculo automático do custo total das apostas, divisão por número de cotas, lista de participantes com controle de status (`Pago` / `Pendente`) e botão de compartilhamento de resumo formatado para WhatsApp.
* **Conferidor Automático:** Ao informar ou sincronizar o resultado oficial do concurso, o sistema cruza todos os jogos do bolão, destaca as dezenas acertadas em cada volante e contabiliza total de Quadras, Quinas e Senas ganhas.
* **Exportação:** Exportar lista de jogos em CSV, TXT limpo ou layout de impressão A4 otimizado para marcação.

---

## 4. Requisitos Não-Funcionais e UI/UX
* **Stack Recomendada:** Next.js (App Router) + TypeScript + Tailwind CSS + Shadcn/UI + PostgreSQL (Supabase).
* **Identidade Visual:** Interface moderna em **Dark Mode** por padrão (com opção Light Mode), utilizando paleta sóbria e profissional em tons de verde-petróleo/teal (`#208494` / `#238B8B`) para destaques, estados ativos e volantes, garantindo alto contraste e legibilidade.
* **Performance:** O motor combinatório de geração com filtros deve rodar em menos de `300ms` para lotes de até 100 jogos, utilizando algoritmos de amostragem rejeitada (*rejection sampling*) com limite máximo de iterações para evitar loops infinitos caso o usuário aplique filtros contraditórios.
* **Responsividade:** Totalmente funcional em mobile (foco em conferência rápida e compartilhamento no WhatsApp) e desktop (foco em análise estatística e montagem de fechamentos).

---

## 5. Critérios de Aceite do MVP
1. Upload/seed do CSV `resultados_ate_3087.csv` importa os 3.087 concursos sem erros de formatação de data ou moeda.
2. Endpoint de sincronização busca concursos posteriores ao `3087` sem duplicar registros já existentes.
3. Gerador aplica corretamente dezenas fixas, excluídas, paridade, faixa de soma e checagem de combinação inédita no banco.
4. Bolão calcula corretamente o valor por cota e confere automaticamente acertos (4, 5 e 6 pontos) em todos os bilhetes cadastrados.