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
| `ATLAS_PROXY_SEGREDO` | Só de servidor (nunca `NEXT_PUBLIC_`). O mesmo valor de `ATLAS_PROXY_SEGREDO` no backend (Render), gerado com `openssl rand -hex 32`. Configurar na Vercel em Production e Preview. Vai no cabeçalho `X-Atlas-Proxy` de toda chamada ao backend: com ele, o backend confia no IP do usuário que o proxy repassa (limites por IP e trilha de auditoria). Vazia em dev |
| `NEXT_PUBLIC_R2_URL_BUCKET` | Só onde o backend usa R2 (produção, staging): `https://<conta>.r2.cloudflarestorage.com/<bucket>/`, o mesmo bucket de anexos do backend. Libera na CSP o envio e a pré-visualização direto do bucket (ver "Arquivos", abaixo). Vazia em dev |

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

## Sessão e erros

* **Renovação da sessão:** quem renova o access do backend é o navegador, não o proxy (`src/lib/renovarSessao.ts`): no 401, uma renovação por vez pela rota `/api/sessao/renovar`, que lê o cookie atual, e a requisição é repetida uma vez antes do `signOut`. Falha passageira (sem rede, 429, 5xx) não desloga; só o refresh recusado pelo backend leva ao login. Detalhes e decisões: STC-611 no `PLANEJAMENTO.md`.
* **IP e navegador do usuário:** toda chamada do servidor do frontend ao backend (proxy, renovação, login, logout) repassa `X-Forwarded-For` (o IP que a Vercel recebeu) e `User-Agent` do navegador (`src/lib/cabecalhosDoCliente.ts`), mais o segredo `X-Atlas-Proxy` (`ATLAS_PROXY_SEGREDO`). O backend só confia no IP repassado quando o segredo confere; sem ele, usa o IP da conexão, que aqui é o da função da Vercel. Em dev, sem `x-forwarded-for` nem a variável, só o navegador vai.
* **Erro 500:** o backend responde `{"detail": "Erro interno. Código de rastreio: <id>"}`, e a tela mostra essa mensagem como veio. O código é o `request_id` do log do backend: filtrar por ele no Render mostra as linhas daquela requisição, inclusive o traceback.

## Arquivos

Com R2 no backend, anexos e evidências vão do navegador direto para o bucket, por URL assinada (`src/lib/uploadDireto.ts`), e a pré-visualização da evidência abre o PDF direto do bucket: a função da Vercel recusa corpo e resposta acima de 4,5 MB, e o limite do Atlas é 35 MB. Precisa de três coisas fora do código:

* `NEXT_PUBLIC_R2_URL_BUCKET` nas variáveis da Vercel, com novo deploy depois de criar ou mudar (o valor entra no build). Sem ela, a CSP bloqueia o envio direto: arquivo até 4 MB segue pelo proxy, acima disso falha; a pré-visualização segue pelo proxy, até 4,5 MB;
* a regra de CORS no bucket e a regra de ciclo de vida de `_uploads_pendentes/`, no painel da Cloudflare (`docs/UPLOAD_DIRETO.md` no backend).

Sem R2 (dev, E2E), o backend indica o envio multipart e a pré-visualização pelo proxy `/api/media/evidencia-vigente`, como antes.

## Documentação

- [`PLANEJAMENTO.md`](PLANEJAMENTO.md) — planejamento técnico detalhado do módulo Gestão de Demandas, pacote por pacote, com o estado real de cada issue.
- [`PLANEJAMENTO_LEGALIZACAO.md`](PLANEJAMENTO_LEGALIZACAO.md) — mesmo formato, módulo Legalização (MP002).
