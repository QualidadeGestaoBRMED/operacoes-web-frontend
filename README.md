# Operações Web Frontend

Frontend Next.js da Plataforma Web de Operações — módulo Gestão de Demandas.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000). Depende do [backend](../backend) rodando local (`http://localhost:8000` por padrão) — sem ele, login e qualquer chamada à API falham.

## Variáveis de ambiente

Ver `.env.example`. Resumo:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL do backend (local: `http://localhost:8000`) |
| `NEXTAUTH_URL` | URL do próprio frontend (local: `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Segredo do NextAuth — gerar com `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Mesmo app OAuth do Google usado pelo backend (não são credenciais separadas) |

Login só funciona com conta `@grupobrmed.com.br`.

## Comandos

```bash
npm run dev         # servidor de desenvolvimento (Turbopack)
npm run build        # build de produção
npm run lint          # eslint
npm run test           # vitest run
npm run test:watch      # vitest em modo watch
```

## Documentação

- [`PLANEJAMENTO.md`](PLANEJAMENTO.md) — planejamento técnico detalhado, pacote por pacote, com o estado real de cada issue.
- [`../Plano de Ação - Gestão de Demandas.md`](<../Plano de Ação - Gestão de Demandas.md>) — plano de ação do projeto como um todo (backend + frontend), decisões tomadas, log de execução.
