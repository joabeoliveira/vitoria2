<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# LotoMetria

Aplicação para análise de concursos da Mega-Sena e gerenciamento de bolões.

View your app in AI Studio: https://ai.studio/apps/d22b45a7-eeda-4eef-a98d-a8b8d86aa851

## Rodar localmente

**Pré-requisito:** Node.js 22 ou superior.


1. Instale as dependências: `npm install`
2. Inicie em desenvolvimento: `npm run dev`

## Deploy no EasyPanel via Docker

O projeto inclui um `Dockerfile` multi-stage. No EasyPanel, crie um serviço conectado ao repositório GitHub e configure:

- Branch: `main`
- Build: Dockerfile na raiz do projeto
- Porta do container: `3000`
- Variável: `NODE_ENV=production`
- Health check: `GET /api/health`

Os dados editáveis são salvos em `/app/data`. Configure um volume persistente do EasyPanel apontando para esse caminho; sem o volume, os concursos e bolões serão perdidos quando o container for recriado.

O fluxo de atualização fica: alterar código → `git commit` → `git push origin main` → redeploy no EasyPanel.
