# Operações Web Frontend

Frontend Next.js da Plataforma Web de Operações (Atlas) — módulos Gestão de Demandas e Legalização.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000). Depende do backend ([`QualidadeGestaoBRMED/operacoes-web-backend`](https://github.com/QualidadeGestaoBRMED/operacoes-web-backend)) rodando local em `http://localhost:8000` — sem ele, login e qualquer chamada à API falham.

## Variáveis de ambiente

Ver `.env.example`. Resumo:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL do backend (local: `http://localhost:8000`) |
| `NEXTAUTH_URL` | URL do próprio frontend (local: `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Segredo do NextAuth — gerar com `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Mesmo app OAuth do Google usado pelo backend (não são credenciais separadas) — pedir ao responsável do projeto |

Login só funciona com conta `@grupobrmed.com.br`.

### Login local sem Google OAuth

Em `NODE_ENV=development`, `GET /api/dev-login?email=...` loga como um usuário já existente no banco de dev (sem senha, sem passar pelo Google) — útil pra testar pelo IP da rede local, onde o Google Console recusa IP cru como redirect URI. Precisa ser acessado por navegação direta (digitar a URL/favorito), não um link de outra origem. Não existe fora de desenvolvimento (404) e o backend também recusa (`settings.DEBUG`).

## Comandos

```bash
npm run dev        # servidor de desenvolvimento (Turbopack)
npm run build      # build de produção
npm run lint       # eslint
npm run test       # vitest run
npm run test:watch # vitest em modo watch
```

## Documentação

- [`PLANEJAMENTO.md`](PLANEJAMENTO.md) — planejamento técnico detalhado do módulo Gestão de Demandas, pacote por pacote, com o estado real de cada issue.
- [`PLANEJAMENTO_LEGALIZACAO.md`](PLANEJAMENTO_LEGALIZACAO.md) — mesmo formato, módulo Legalização (MP002).
