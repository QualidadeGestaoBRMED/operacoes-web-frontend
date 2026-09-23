# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Gestão de Demandas

**Stack:** Next.js 15 (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui · NextAuth
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Início:** 08/07/2026 · **Entrega:** 05/08/2026

---

## Visão Geral da Estrutura de Diretórios

```
frontend/
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   └── login/
    │   │       └── page.tsx            → Tela de login Google
    │   ├── hub/
    │   │   └── page.tsx                → Hub de Módulos
    │   ├── modulos/
    │   │   └── gestao-demandas/
    │   │       └── page.tsx            → Kanban
    │   ├── api/
    │   │   └── auth/[...nextauth]/
    │   │       └── route.ts            → Handler do NextAuth
    │   ├── layout.tsx                  → Layout raiz com Providers
    │   └── middleware.ts               → Proteção de rotas autenticadas
    ├── components/
    │   ├── ui/                         → Componentes base shadcn/ui (Button, Input, Badge, Dialog, Select, Tooltip, Skeleton)
    │   ├── layout/                     → Sidebar, Topbar, NotificacaoBadge
    │   ├── kanban/
    │   │   ├── KanbanBoard.tsx
    │   │   ├── KanbanColumn.tsx
    │   │   └── DemandaCard.tsx
    │   └── demanda/
    │       ├── FormNovaDemanda.tsx     → Modal de criação
    │       ├── DetalheCard.tsx         → Modal de detalhe
    │       ├── ComentarioFeed.tsx      → Aba Comentários
    │       ├── AnexoList.tsx           → Aba Anexos
    │       └── HistoricoTimeline.tsx   → Aba Histórico
    ├── lib/
    │   └── api.ts                      → Axios client com interceptors de auth
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useDemandas.ts
    │   ├── useComentarios.ts
    │   ├── useAnexos.ts
    │   └── useNotificacoes.ts
    └── types/
        └── index.ts                    → Interfaces TypeScript para todas as entidades
```

> ✅ **Correções à árvore acima, conforme implementado na STC-163:**
> - `middleware.ts` fica em `src/middleware.ts` (irmão de `app/`), não dentro de `app/`.
> - `src/auth.ts` (novo, não estava na árvore): config do NextAuth. `app/api/auth/[...nextauth]/route.ts` só reexporta os handlers dele.
> - `src/app/providers.tsx` (novo): wrapper Client Component do `SessionProvider`, usado em `layout.tsx`.
> - `src/types/next-auth.d.ts` (novo): augmentation de tipos do NextAuth.
> - `src/app/hub/page.tsx` e `src/app/modulos/gestao-demandas/page.tsx` já existem desde a STC-162 (placeholders); ainda não são o Hub/Kanban finais.

> ✅ **Correções à árvore acima, conforme implementado na STC-165/STC-166 (estado em 17/07/2026):**
> - `src/app/(app)/` é um route group (não aparece na URL) — `hub/` e `modulos/` ficam dentro dele, ao lado de um `layout.tsx` próprio que monta o `AppShell`. `src/app/(auth)/login/` segue o mesmo padrão pro login.
> - `src/app/(app)/hub/page.tsx` hoje só redireciona pra `/modulos/gestao-demandas` — conteúdo real preservado em `HubContent.tsx`, ao lado (ver 4.2).
> - `src/components/kanban/` ganhou `KanbanFiltros.tsx` e `ResumoCards.tsx`, além dos 3 já previstos.
> - `src/components/demanda/` (formulário, modal de detalhe, abas) **ainda não existe** — Pacotes 4.5/5, não iniciados.
> - `src/lib/` tem mais arquivos que só `api.ts`: `demandas.ts` (chamadas HTTP do módulo), `erros.ts` (parser de erro do DRF), `plataforma.ts` (unidades), `kanban.ts` (lógica de negócio pura do board, testável), `utils.ts` (`cn`, `nomeExibicao`, `iniciaisDe`).
> - `src/hooks/` tem mais que os 5 previstos: `useDemandas.ts`, `useDemandaMutations.ts`, `useResumoDemandas.ts`, `useUnidades.ts`, `useCategorias.ts`. `useComentarios`/`useAnexos`/`useNotificacoes` ainda não existem (Pacote 5).
> - `src/config/` (novo, não estava na árvore): `modulos-futuros.ts` e `paginas.ts` — fontes únicas de verdade consumidas por mais de uma tela (Sidebar/Hub/Topbar), pra não duplicar a mesma lista em vários lugares.
> - `public/brand/` (novo): logo real da marca (`logo-brmed.webp`).
> - `vitest.config.ts`/`vitest.setup.ts` (novos, raiz do projeto): infraestrutura de teste — ver 6.2.

> ✅ **Correções à árvore acima, estado em 28/07/2026 (Pacote 7, STC-186):**
> - `src/components/ui/` ganhou `popover.tsx` (wrapper do `Popover` do pacote `radix-ui`, mesmo padrão de `dialog.tsx`/`dropdown-menu.tsx` — sem dependência nova).
> - `src/hooks/` ganhou `useMediaQuery.ts` — hook genérico (`matchMedia` + listener de `change`, `useLayoutEffect` isomorfo pra evitar flash de layout errado no 1º paint), usado hoje só por `KanbanFiltros.tsx` mas escrito pra ser reaproveitável.
> - `src/test-utils/fixtures.ts` (novo, STC-171 — ver 6.2): fixtures de `Demanda`/`DemandaResponsavel` compartilhadas entre `kanban.test.ts` e os testes de componente novos.

---

## Pacote 1 — Infraestrutura e Configuração de Ambiente
**Datas:** 08/07 – 09/07 · 2 dias úteis
**Status:** ✅ Concluído (STC-162)

### 1.1 Inicialização do Projeto

```bash
npx create-next-app@latest . \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*"
```

- Criar estrutura de diretórios conforme acima
- Configurar `tsconfig.json` com path aliases: `@/components`, `@/lib`, `@/hooks`, `@/types`
- Configurar `tailwind.config.ts` com tokens de design BR MED:
  ```js
  colors: {
    brmed: {
      primary:   '#193B4F',
      secondary: '#007891',
      card:      '#F3F3F3',
      border:    '#BFC3C6',
    },
    prio: {
      urgente: '#C0392B',
      alta:    '#D4600A',
      media:   '#9A7300',
      baixa:   '#2CAD6E',
    }
  }
  ```
- Configurar `shadcn/ui` como base de componentes do frontend
- Manter componentes gerados em `src/components/ui`
- Instalar componentes iniciais do `shadcn/ui`:
  - `button`
  - `input`
  - `textarea`
  - `badge`
  - `card`
  - `dialog`
  - `dropdown-menu`
  - `tabs`
  - `tooltip`
  - `select`
  - `separator`
  - `skeleton`
- Ajustar tokens de tema para seguir a identidade BR MED/Atlas
- Instalar dependências:
  - `next-auth` — **adiado de propósito para a STC-163** (fundação não deve trazer autenticação); instalado lá como `next-auth@beta` (v5)
  - `axios`
  - `swr` (ou `@tanstack/react-query`)
  - `react-hook-form`
  - `zod`
  - `@hookform/resolvers`
  - `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities` — **ainda adiado**, só entra na STC-166 (Kanban)
  - `lucide-react`
  - dependências geradas pelo `shadcn/ui`

### 1.2 Deploy na Vercel

- Criar projeto na Vercel apontando para o repositório `operacoes-web-frontend`
- Framework preset: Next.js
- Build command: `npm run build`
- Output/Start: padrão da Vercel para Next.js
- Configurar variáveis de ambiente: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_API_URL`

> ⚠️ **Pendente.** Projeto ainda não foi criado na Vercel — o frontend só rodou localmente até agora.

---

## Pacote 2 — Autenticação e Controle de Acesso
**Datas:** 10/07 – 14/07 · 3 dias úteis
**Status:** ✅ Concluído — STC-163 **aprovada e mergeada em `main`**. Backend (STC-155, entidades compartilhadas) com PR aberto, aguardando review do Tech Lead, mas não bloqueia nada aqui.

### 2.1 NextAuth com Google Provider

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    signIn({ profile }) {
      // Restrição de domínio
      return profile?.email?.endsWith('@grupobrmed.com.br') ?? false
    },
    session({ session, token }) {
      // Adicionar perfil do backend na sessão
      session.user.perfil = token.perfil as string
      return session
    },
  }
})
```

> ✅ **Implementado com adaptações (STC-163).** Código real em `src/auth.ts` (não direto no route handler — `src/app/api/auth/[...nextauth]/route.ts` só faz `export const { GET, POST } = handlers`). Diferenças:
> - `perfil` **não é string** (`'admin_qg'`) — é o objeto `Perfil` completo vindo do backend, com `nivel` numérico (1–4). O exemplo acima está desatualizado nesse ponto.
> - O callback `jwt` (não só `session`) é quem faz a troca do `id_token` pelo JWT do Django, chamando `POST /api/auth/google/` e guardando `backendAccessToken`, `backendRefreshToken` e os dados do usuário no token.
> - Em caso de falha na troca com o backend, o token guarda `error: "BackendAuthError"`, propagado pra sessão — permite mostrar erro na UI sem quebrar o fluxo do NextAuth.
> - Callback `authorized` adicional (usado pelo middleware — ver 2.2), liberando sempre `/login` e exigindo sessão pra tudo o mais.
> - **Mesmo app OAuth do Google (Client ID + Secret) do backend** é reutilizado aqui — não são credenciais separadas.
> - `SessionProvider` precisa de um wrapper Client Component (`src/app/providers.tsx`) porque `src/app/layout.tsx` é Server Component.

### 2.2 Middleware de Proteção de Rotas

```typescript
// src/middleware.ts
import { auth } from '@/app/api/auth/[...nextauth]/route'

export default auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith('/login')) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = { matcher: ['/((?!api|_next|favicon).*)'] }
```

> ✅ **Implementado de forma mais simples (STC-163).** Em vez do `if` manual, usa o padrão idiomático do NextAuth v5: `export { auth as middleware } from "@/auth"`, delegando a decisão pro callback `authorized` definido em `src/auth.ts` (seção 2.1). Testado: `GET /hub` sem sessão → `307` para `/login?callbackUrl=...`.

### 2.3 Hook `useAuth`

```typescript
// src/hooks/useAuth.ts
export function useAuth() {
  const { data: session, status } = useSession()
  return {
    user: session?.user,
    perfil: session?.user?.perfil,
    isLoading: status === 'loading',
    isAdminQG: session?.user?.perfil === 'admin_qg',
    isAdminOps: ['admin_qg', 'admin_ops'].includes(session?.user?.perfil ?? ''),
  }
}
```

> ✅ **Implementado com a correção de contrato (STC-163).** `perfil` é numérico (`nivel`), não string — o exemplo acima nunca teria funcionado contra o backend real:
> ```typescript
> const NIVEL_ADMIN_QG = 1
> const NIVEL_ADMIN_OPERACOES = 2
> const nivel = session?.user?.perfil?.nivel
> // isAdminQG: nivel === NIVEL_ADMIN_QG
> // isAdminOps: nivel !== undefined && nivel <= NIVEL_ADMIN_OPERACOES
> ```
> Bate exatamente com `accounts/permissions.py` do backend.

### 2.4 API Client com Autenticação

```typescript
// src/lib/api.ts
import axios from 'axios'
import { getSession } from 'next-auth/react'

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL })

api.interceptors.request.use(async (config) => {
  const session = await getSession()
  if (session?.backendAccessToken) {
    config.headers.Authorization = `Bearer ${session.backendAccessToken}`
  }
  return config
})

export default api
```

> ✅ **Implementado, mais um interceptor (STC-163).** Igual ao exemplo, mais um interceptor de **response**: em qualquer `401`, chama `signOut({ redirectTo: "/login" })`. Não há renovação silenciosa de token via refresh — ver nota sobre isso no `PLANEJAMENTO.md` do backend (seção 2.2).

### 2.5 Contrato de Rotas Consumidas

Padrão oficial da API:
- Autenticação: `/api/auth/...`
- Recursos compartilhados do hub: `/api/plataforma/...`
- Recursos exclusivos de módulos: `/api/modulos/{codigo-do-modulo}/...`
- Para Gestão de Demandas: `/api/modulos/gestao-demandas/...`
- Todas as rotas DRF usam barra final (`/`)
- Nomes compostos usam kebab-case, exemplo: `/api/plataforma/permissoes-usuario/`

Rotas principais consumidas pelo frontend:
- `POST /api/auth/google/`
- `GET /api/auth/me/`
- `POST /api/auth/logout/` — faltava nessa lista; implementado na STC-154, já consumido pelo interceptor de 401 (seção 2.4)
- `GET /api/plataforma/unidades/`
- `GET /api/plataforma/setores/`
- `GET/POST /api/plataforma/permissoes-usuario/`
- `GET /api/plataforma/notificacoes/`
- `PATCH /api/plataforma/notificacoes/{id}/marcar-lida/`
- `GET/POST /api/modulos/gestao-demandas/demandas/`
- `GET/PATCH/DELETE /api/modulos/gestao-demandas/demandas/{id}/`
- `PATCH /api/modulos/gestao-demandas/demandas/{id}/status/`
- `GET/POST /api/modulos/gestao-demandas/demandas/{id}/comentarios/` — ✅ backend pronto (STC-159)
- `GET/POST /api/modulos/gestao-demandas/demandas/{id}/anexos/`
- `GET /api/modulos/gestao-demandas/demandas/{id}/anexos/{anexo_id}/presigned-url/`
- `GET /api/modulos/gestao-demandas/demandas/{id}/historico/` — ✅ backend pronto (STC-159)
- `GET /api/modulos/gestao-demandas/demandas/{id}/timeline/` — ✅ backend pronto (STC-159), **não previsto neste plano**: junta `historico` + `comentarios` num feed só, ordenado por `created_at` (mais antigo primeiro). Cada item vem com `tipo` ("historico" ou "comentario") e `chave` (string única pro item, tipo+id — os dois models têm sequências de id independentes, então um `HistoricoAlteracao` e um `Comentario` podem ter o mesmo `id` numérico)

### 2.6 Tipos TypeScript

```typescript
// src/types/index.ts
export interface Perfil { id: number; nome: string; nivel: number }
export interface Unidade { id: number; nome: string; codigo: string; cidade: string }
export interface Setor { id: number; nome: string; codigo: string; modulo_id: number }
export interface Usuario { id: number; nome: string; email: string; perfil: Perfil; unidade?: Unidade; setor?: Setor }

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type Status = 'backlog' | 'em_andamento' | 'em_revisao' | 'concluido' | 'lixeira'

export interface Demanda {
  id: number
  titulo: string
  descricao: string
  tipo_operacao: string
  prioridade: Prioridade
  status: Status
  unidade: Unidade
  setor?: Setor
  solicitante: Usuario
  aprovador?: Usuario
  responsaveis: DemandaResponsavel[]
  etiquetas: Etiqueta[]
  categoria?: Categoria
  data_prevista: string
  data_conclusao?: string
  confidencial: boolean
  pode_editar: boolean
  created_at: string
}

export interface DemandaResponsavel { usuario: Usuario; tipo: 'principal' | 'colaborador' }
export interface Categoria { id: number; nome: string; modulo_id: number }
export interface Etiqueta { id: number; nome: string; cor: string }
export interface Comentario { id: number; autor: Usuario; conteudo: string; created_at: string }
export interface Anexo { id: number; nome_arquivo: string; tipo_mime: string; enviado_por: Usuario; created_at: string }
export interface HistoricoAlteracao { id: number; usuario: Usuario; campo_alterado: string; valor_anterior: string; valor_novo: string; created_at: string }
export interface Notificacao { id: number; tipo: string; titulo: string; lida: boolean; created_at: string }
```

> ✅ **Só `Usuario`/`Perfil` criados por enquanto (STC-163)**, e com campos batendo com o `UsuarioSerializer` real do backend (`username`, `first_name`/`last_name` em vez de `nome`, `unidade_id`/`setor_id` em vez de objetos aninhados). O resto (`Demanda`, `Comentario`, `Anexo`, `HistoricoAlteracao`, `Notificacao`, `Unidade`, `Setor`) fica pra **STC-165**, quando o módulo de Demandas existir no backend — tipar contra uma API que não existe ainda não faz sentido.
>
> Também foi preciso criar `src/types/next-auth.d.ts` (não estava nesse plano) pra estender `Session`/`JWT` do NextAuth com `backendAccessToken` e afins. **Pegadinha da v5 beta:** a augmentation tem que ser em `declare module "@auth/core/types"` e `"@auth/core/jwt"` — `"next-auth"` e `"next-auth/jwt"` não funcionam pra isso nessa versão (são só reexport, a interface de verdade mora em `@auth/core`). E o `id` do `Usuario` do Django é exposto como `session.user.usuarioId`, não `session.user.id` — esse já é o `sub` (string) do Google, tipos incompatíveis (`number` vs `string`).

---

## Pacote 3 — Módulo de Demandas (Backend)
**Datas:** 15/07 – 21/07 · 5 dias úteis

> Pacote predominantemente backend. Ver `PLANEJAMENTO.md` do backend.
> No frontend: preparar o hook `useDemandas` e os tipos para que o Pacote 4 
> (Kanban) possa começar integrado desde o início.

> ✅ **Backend concluído (STC-156)** — `demandas` app completo: models, serializers, ViewSets com RBAC, transições do Kanban, e `GET /api/modulos/gestao-demandas/resumo/` no formato exato que a Hub (STC-164) já espera. Mergeado em `main`.
>
> ✅ **Frontend concluído (STC-165)** — tipos/serviços/hooks de Gestão de Demandas, verificados campo a campo contra o contrato real do backend (não contra este documento, que já estava desatualizado em alguns pontos — ver 2.6). `src/types/index.ts` ganhou `Unidade`, `Setor`, `TipoGestao`, `Categoria`, `Etiqueta`, `Demanda`, `DemandaPayload`, `DemandaStatusPayload`, `DemandaFiltros`, `ResumoDemandas`. `src/lib/erros.ts` (novo) normaliza os 3 formatos de erro do DRF numa string exibível. `src/lib/demandas.ts` (novo) concentra as chamadas HTTP do módulo; `src/hooks/useDemandas.ts`/`useDemandaMutations.ts` (novos) envolvem isso em SWR. PR aberto (`origin/STC-165-...`).
>
> **Bug de backend achado durante a STC-165, corrigido à parte (STC-177):** `?search=`/`?ordering=` no `DemandaViewSet` eram aceitos e ignorados silenciosamente — `filter_backends` declarado na view substitui por completo o `DEFAULT_FILTER_BACKENDS` global em vez de somar a ele, e faltava `SearchFilter`/`OrderingFilter` na lista. Branch própria off `main`, mergeada.

### 3.1 Hook `useDemandas`

```typescript
// src/hooks/useDemandas.ts
import useSWR from 'swr'
import api from '@/lib/api'

export function useDemandas(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters)
  const { data, error, mutate } = useSWR(
    `/modulos/gestao-demandas/demandas/?${params}`,
    (url) => api.get(url).then(r => r.data)
  )
  return { demandas: data ?? [], isLoading: !error && !data, mutate }
}

export async function criarDemanda(payload: Partial<Demanda>) {
  const res = await api.post('/modulos/gestao-demandas/demandas/', payload)
  return res.data
}

export async function atualizarStatus(id: number, status: Status, extra?: object) {
  const res = await api.patch(`/modulos/gestao-demandas/demandas/${id}/status/`, { status, ...extra })
  return res.data
}
```

---

## Pacote 4 — Interface Kanban e Formulários
**Datas:** 22/07 – 27/07 · 4 dias úteis

### 4.1 Layout Base

Componentes em `src/components/layout/`:
- `Sidebar.tsx`: logo BR MED, links de módulos, avatar do usuário logado
- `Topbar.tsx`: título da página, botão "Nova Demanda", badge de notificações
- `NotificacaoBadge.tsx`: círculo vermelho com contagem de não lidas

Layout em `src/app/layout.tsx`:
```tsx
<SessionProvider>
  <div className="flex h-screen">
    <Sidebar />
    <main className="flex-1 overflow-y-auto bg-gray-50">
      <Topbar />
      {children}
    </main>
  </div>
</SessionProvider>
```

> ✅ **Adiantado e implementado (STC-164, antes do prazo do Pacote 4).** `Sidebar.tsx`/`Topbar.tsx` em `src/components/layout/`, mas o layout real usa `AppShell.tsx` (client component) em vez do `<SessionProvider>` direto no `layout.tsx` — precisa de estado (`useState`) pra sidebar recolhível, que só funciona em client component. Fica em `src/app/(app)/layout.tsx`, aplicado via route group (não afeta a URL). `NotificacaoBadge.tsx` ainda não existe — o sino no Topbar é só visual por enquanto.
>
> **Bug achado e corrigido depois do merge com a STC-163:** a STC-164 foi criada antes da STC-163 (autenticação) existir, então `AppShell` nunca tinha sido conectado à sessão real — `Topbar` sempre recebia `usuario=undefined`, mostrando avatar "?" e "Não autenticado" pra qualquer usuário logado de verdade. Corrigido: `AppShell` agora chama `useAuth()` e deriva nome/iniciais da sessão real.
>
> **Reestruturado de novo durante a STC-166**, comparando lado a lado com as telas reais do ProntuAI (outro produto BR MED, mesma identidade visual): a logo (`public/brand/logo-brmed.webp`) voltou pra dentro da `Sidebar` (não fica mais numa faixa de topo separada — inspecionar o DOM real do ProntuAI mostrou que a "costura visual" entre header e sidebar é só as duas cores baterem, não um componente único); `Topbar` virou uma faixa escura (`bg-sidebar`) com título de página dinâmico (`src/config/paginas.ts`, mesmo padrão de fonte única já usado em `modulos-futuros.ts`) em vez do bloco claro com busca global original; a busca global foi removida (cada módulo/tela decide se precisa de busca própria — o Kanban tem a sua, escopada); `main` ganhou cantos arredondados do lado esquerdo (`rounded-tl-3xl rounded-bl-3xl`, só com a sidebar visível) e a sidebar passou a animar largura ao invés de montar/desmontar (`AppShell.tsx`).
>
> **Pegadinha de layout achada e corrigida duas vezes:** dar a `main` `overflow-hidden` (pra impedir que o scroll dela "roubasse" o scroll por coluna do Kanban) causava um corte sem nenhum jeito de alcançar o conteúdo em telas baixas (celular em paisagem, janela pequena) quando o cabeçalho do Kanban não cabia. Resolvido restaurando `overflow-y-auto`, mas com segurança desta vez: a cadeia `min-h-0` completa (`KanbanBoard` → fileira de colunas → lista de cards) garante que no caso normal nada extravasa `main`, então esse scroll fica dormente e cada coluna continua rolando por conta própria — só entra em ação no caso extremo.
>
> ✅ **STC-192 — Logout e foto de perfil na Topbar (Pacote 7, pós-planejamento original).** Não existia nenhum jeito de sair da conta pela interface — o único `signOut` do projeto era automático, disparado só em resposta a um 401 (`src/lib/api.ts`). Avatar+nome na Topbar virou o trigger de um `DropdownMenu` (shadcn/radix, já existia em `components/ui`) com um item "Sair". `AvatarUsuario` (novo) usa a foto real da conta Google quando existe (`session.user.image`, já preenchido pelo Auth.js antes do callback `session()` rodar — nenhuma mudança de tipo necessária), com fallback automático pro círculo de iniciais se não houver foto ou ela falhar ao carregar (`onError`); `referrerPolicy="no-referrer"` porque o Google recusa servir a imagem sem isso. Mergeada em `main`.
>
> **STC-208 — Renovação automática do token de acesso (Pacote 7).** Fecha a lacuna registrada desde a STC-163 (seção 2.4): access token expirado (1h) forçava logout completo mesmo com o refresh (7 dias, backend STC-194) ainda válido. Renovação silenciosa fica no **proxy BFF** (`src/app/api/backend/[...path]/route.ts`), reativa a um `401` — decisão de arquitetura: não dá pra fazer no callback `jwt` de `src/auth.ts`, porque `getToken()` (usado pelo proxy) não dispara esse callback, e o `middleware.ts` (que dispara) exclui `/api` do matcher. Fluxo: encaminha com o access atual; em `401`, renova via `POST /api/auth/refresh/`, reenvia a requisição original (corpo já bufferizado) e reescreve o cookie de sessão. Dedupe de renovação concorrente via `Map` em memória (chave = refresh antigo) — limitação documentada: só evita corrida dentro do mesmo processo Node, não é lock distribuído entre instâncias serverless. `events.signOut` do NextAuth passou a invalidar o refresh no backend (`POST /api/auth/logout/`) — nem o `signOut` automático (401) nem o botão manual da STC-192 faziam isso, deixando o refresh válido por até 7 dias após o usuário já ter "saído". Achado próprio: `encode()` que reescreve o cookie sem try/catch derrubava com 500 uma resposta que já tinha renovado certo. Mergeada em `main`.
>
> **STC-210 — Página de login redesenhada, split-screen (Pacote 7).** Painel esquerdo decorativo inspirado no ProntuAI (outro produto BR MED). Achado no review: `background-image` via CSS perdia a otimização do `next/image` (formato automático, srcset responsivo) — trocado por `<Image fill>` com wrapper `relative z-10` no conteúdo (sem isso, o `Image` de fundo, `position:absolute`, pintava por cima do conteúdo estático — regra de stacking do CSS: elemento posicionado pinta depois do conteúdo em fluxo normal, mesmo vindo antes no DOM). Sem achado crítico no review do Tech Lead. Mergeada em `main`.

### 4.2 Hub de Módulos

`src/app/hub/page.tsx` — cards de módulos:
- **Gestão de Demandas** (ativo — link para `/modulos/gestao-demandas`)
- Legalização, Gestão RH, Manutenção, Indicadores (badges "Em breve", desabilitados)

> ✅ **Adiantado e implementado (STC-164), com escopo maior que o descrito aqui.** Fica em `src/app/(app)/hub/page.tsx`. Diferenças:
> - Grade uniforme (todos os cards do mesmo tamanho, não um destaque maior), scrollável — mais módulos entram como novas linhas, sem redesenhar o layout.
> - Lista de módulos maior e ajustada: Gestão de Demandas, Legalização, Gestão RH, Arquitetura, Diário de Bordo, Gestão de Calibração de Equipamentos (substituindo "Manutenção"/"Indicadores" do exemplo original).
> - Card do módulo ativo mostra **estatísticas com cor de urgência** (ex.: "14 atrasadas" em âmbar), não só um número positivo — decisão tomada depois de comparar com a referência de "central de operações" que a gerente pediu.
> - Painel **"Ocorrências que precisam de decisão hoje"** no topo da página (`src/components/hub/OcorrenciasPanel.tsx`), cruzando os módulos ativos — não estava neste plano original.
> - Hoje tudo roda com dado mockado. O contrato real (`GET /api/modulos/{codigo}/resumo/`, por módulo — nunca centralizado) está documentado no Plano de Ação (seção 4) e no `PLANEJAMENTO.md` do backend (Pacote 3, seção 3.6). **O backend já existe (STC-156, concluído)** — trocar o mock pela chamada real fica para o Pacote 4, quando a branch for mergeada.
>
> **⚠️ Hub desativado da navegação (decisão pós-implementação, ainda na STC-164).** Com um módulo só ativo (Gestão de Demandas), um painel agregador cross-módulo não tem o que agregar ainda — só deixaria a tela mais confusa pro piloto. Mudanças: "Hub" virou item bloqueado "em breve" na `Sidebar` (mesmo tratamento visual dos outros módulos futuros); `src/app/page.tsx` (raiz) e o fallback de `redirectTo` no botão de login (`src/app/(auth)/login/page.tsx`) apontam pra `/modulos/gestao-demandas` em vez de `/hub`. **Nada foi apagado** — página, rota e componentes do Hub continuam intactos em `src/app/(app)/hub/`, só sem porta de entrada pela navegação. Reativar: mover "Hub" de volta pro topo da `Sidebar` como `SidebarLink` e trocar os dois redirects de volta pra `/hub`.

### 4.3 Kanban Board

**`KanbanBoard.tsx`**:
```tsx
const COLUNAS: { key: Status; label: string }[] = [
  { key: 'backlog',      label: 'Backlog' },
  { key: 'em_andamento', label: 'Em Andamento' },
  { key: 'em_revisao',   label: 'Em Revisão' },
  { key: 'concluido',    label: 'Concluído' },
  { key: 'lixeira',      label: 'Lixeira' },
]
```

- Usar `@dnd-kit` para drag-and-drop entre colunas
- Ao soltar em nova coluna: identificar transições que exigem dados extras, abrir modal quando necessário e chamar `atualizarStatus(id, novoStatus, extra)`
- Backend é a fonte de verdade: se `PATCH /api/modulos/gestao-demandas/demandas/{id}/status/` retornar `400` ou `403`, desfazer o movimento visual, chamar `mutate()` e exibir a mensagem retornada pela API
- Transições com aprovador, responsável, justificativa ou permissão administrativa: abrir modal de confirmação antes de chamar a API
- Não esconder a coluna como forma de segurança; permissões reais e bloqueios de transição ficam no backend
- Animação: `transform` CSS na coluna que recebe o card (highlight de 300ms)

**`KanbanColumn.tsx`**:
- Header: nome da coluna + badge com contagem de cards
- Lista de `DemandaCard` com scroll interno
- Estado vazio: ícone + mensagem "Nenhuma demanda aqui"

**`DemandaCard.tsx`**:
```tsx
// Chip de prioridade colorido conforme design tokens
const PRIO_COLORS = {
  urgente: 'bg-red-600 text-white',
  alta:    'bg-orange-600 text-white',
  media:   'bg-yellow-700 text-white',
  baixa:   'bg-green-600 text-white',
}
```

Campos visíveis no card: chip de prioridade, título (max 2 linhas), unidade, avatar do responsável principal, data prevista (vermelho se atrasado), contadores de comentários e anexos.

Ao clicar no card → abre `DetalheCard` modal.

> ✅ **Concluído (STC-166).** `src/components/kanban/{KanbanBoard,KanbanColumn,DemandaCard,KanbanFiltros,ResumoCards}.tsx` + lógica pura extraída pra `src/lib/kanban.ts` (testável, ver 6.2). Implementado como no mockup de referência (`docs/mockup_kanban_gestao_demandas.html`) com diferenças importantes em relação a este plano:
>
> - **Sem modal de confirmação pra transições que exigem dado extra** (aprovador, justificativa) — essa é a rota "completa", ainda não construída. Em vez disso, o board já sabe de antemão quais transições vão falhar (aprovador_id/justificativa não são coletados pelo drag) e bloqueia ANTES de tentar, com uma mensagem de erro (toast) explicando o motivo — evita o floop visual de mover o card e desfazer segundos depois. Backend continua sendo a fonte de verdade pra tudo o mais (permissão administrativa, responsável principal ausente).
> - **Drag-and-drop acessível por teclado**, não previsto neste plano original: `@dnd-kit`'s `KeyboardSensor` com `coordinateGetter` customizado (Tab até o card, espaço pega, setas trocam de coluna uma por vez, espaço solta, esc cancela) + anúncios de leitor de tela localizados em português. `@dnd-kit/sortable` (citado na seção 1.1) acabou não sendo necessário — não há reordenação manual dentro de uma coluna, só `@dnd-kit/core`.
> - **Destaque da coluna-alvo é durante o arraste** (`ring` na coluna sob o cursor via `isOver` do `useDroppable`), não uma animação de "flash" de 300ms pós-solta como descrito aqui.
> - **Cartão sendo arrastado usa `DragOverlay`** (portalado pro `document.body`) em vez do `transform` aplicado no lugar — necessário porque um card transformado dentro de um container com `overflow` conta pra área de scroll do ancestral e ficava atrás das colunas vizinhas.
> - **Ordenação dentro da coluna**: prazo mais próximo primeiro, desempatado por prioridade — não estava definido neste plano (o padrão do backend, `-created_at`, ficaria "mais recente primeiro", menos operacional).
> - **Etiquetas** (`Demanda.etiquetas`) aparecem no card ao lado da tag de unidade. **Contadores de comentários/anexos implementados depois** (junto com o filtro de Setor da 4.4, sem issue própria — ver nota no fim desta seção): ícone de mensagem + `comentarios_count` e clipe + `anexos_count` no rodapé do card, ao lado do avatar. Backend anota os dois via `Subquery` (não `Count()` direto — inflaria com o `JOIN` de `responsaveis` que a queryset RBAC já faz pra usuário não-admin).
> - **Cards de KPI acima do board** (`ResumoCards.tsx`, "Atrasadas"/"Sem responsável"), não previstos neste plano — inspirados nas telas do ProntuAI, reaproveitando o `/resumo/` que já existia pra Hub. Clicáveis: funcionam como atalho de filtro rápido do board (client-side, sem endpoint novo). Respeitam os mesmos filtros do board (unidade/prioridade/categoria/busca) — achado e corrigido à parte (ver nota de bug abaixo). **Condensados numa linha compacta em mobile depois (Pacote 7, STC-186)**: `grid-cols-2` sempre (nunca empilha, mesmo em 375px), com padding/ícone/fonte menores por padrão, restaurados ao tamanho original a partir de `sm:` — os 2 cards, empilhados, tomavam uma tela inteira de altura antes do usuário ver qualquer demanda.
> - **Clicar no card não abre nenhum modal ainda** — `selecionarDemanda` é um no-op de propósito, aguardando a STC-168 (ver Pacote 5).
>
> **3 bugs de backend pré-existentes, achados durante o trabalho manual/visual e corrigidos em branches próprias (fora do escopo da STC-166):**
> - **STC-178**: não existia nenhum jeito de listar demandas na lixeira — `DemandaViewSet.get_queryset()` sempre excluía soft-deletadas, mesmo com `?status=lixeira`. Corrigido no backend.
> - **STC-179**: `getToken()` do proxy BFF (`src/app/api/backend/[...path]/route.ts`) não detectava o secret sozinho, lançando `MissingSecret` em qualquer request real (nunca exercitado ponta a ponta localmente até então). Corrigido passando o secret explicitamente.
> - **Middleware bloqueava assets estáticos**: o matcher de `src/middleware.ts` só excluía `/api`, `/_next` e `/favicon.ico` — qualquer outro arquivo de `public/` (como a logo) passava pelo middleware de auth antes de chegar no arquivo, quebrando o self-fetch interno do `next/image`. Matcher agora exclui qualquer caminho com extensão de arquivo.
> - **`/resumo/` ignorava os filtros do board**: os cards de KPI sempre mostravam a contagem global, mesmo com o board filtrado — `ResumoView` é um `APIView` puro (sem a maquinaria de filtro de `GenericAPIView`), corrigido aplicando `DjangoFilterBackend` manualmente. Frontend (`buscarResumoDemandas`/`useResumoDemandas`) atualizado em conjunto.
>
> **Code review final (multi-ângulo) encontrou e corrigiu 6 problemas reais** antes de considerar a STC-166 pronta: navegação por teclado entre colunas só alcançava 1 passo de distância da origem (o `coordinateGetter` recalculava sempre a partir da coluna original, não da posição virtual atual); erro da busca da Lixeira sendo descartado podia travar o board inteiro em "carregando"; corrida de closure obsoleta no debounce da busca podia reverter um filtro recém-escolhido; campo de busca não ressincronizava com navegação do navegador; campo de busca sem rótulo acessível; conteúdo do board podia cortar sem scroll em telas baixas (ver nota na 4.1).
>
> **Pendências conhecidas, não tratadas nesta issue:** ~~filtro por `tipo_gestao` (o board hoje só enxerga demandas do único tipo cadastrado, "Operacional" — cadastrar outros tipos e construir o seletor viraram 2 issues separadas, uma de decisão de negócio + cadastro, outra de engenharia de frontend)~~ **fechada — ver STC-181 (backend, cadastro real de "Operacional"/"Unidades") e STC-182 (frontend, abas de seleção acima da barra de filtros) logo abaixo**; ~~auditoria de responsividade/toque dedicada (issue separada, ainda não iniciada)~~ **fechada — ver STC-186 logo abaixo**; otimização de performance (memoização do agrupamento de colunas já feita; `React.memo` nos cards fica pra quando o volume de dados justificar).
>
> ✅ **STC-182 — Seletor de tipo de gestão no Kanban (Pacote 7, pós-planejamento original).** Abas acima da barra de filtros, uma por `TipoGestao` cadastrado — diferente de Unidade/Setor/Prioridade (que combinam com "E" e têm opção "todas"), aqui a troca é exclusiva e sempre há exatamente 1 tipo selecionado, já que `tipo_gestao` reformula o board inteiro. O primeiro tipo (por `ordem`) vira padrão ao carregar, gravado na URL como os demais filtros; some sozinho com 1 tipo só cadastrado (mesmo critério do filtro de Categoria). Mergeado em `main`, com 2 fixes de review: "Limpar filtros" zerava `tipo_gestao` junto com os outros (devia preservar, já que não é bem um "filtro" removível); `useSetores()` derivava o módulo da posição no array (`tiposGestao[0]?.modulo`) em vez do tipo realmente ativo.
>
> ✅ **STC-203 — Drag-and-drop bloqueado abre o modal na seção certa (Pacote 7).** Antes, um drop bloqueado (falta aprovador/justificativa) só mostrava um toast de erro, deixando o usuário refazer tudo manualmente pelo modal. Reaproveita o `TransicaoStatusSection` que já existia (STC-195, seção 5.1) — `moverDemanda` (`KanbanBoard.tsx`) passa a abrir o `DetalheCard` já com a seção "Mudar status" pré-selecionada e o status-alvo preenchido, em vez de só um toast. 2 achados de review próprio: `window.confirm()` nativo trocado por `ConfirmDialog` (shadcn `AlertDialog`, já usado em outro lugar do app); texto de notificação quase ilegível no hover. Mergeada em `main`.
>
> ✅ **STC-197 — Etiquetas: criar e associar a demandas (Pacote 7).** Fecha a lacuna registrada desde a STC-166/167: `Etiqueta` existia desde a STC-156, sem nenhum fluxo de uso. Consome o backend STC-196 (`DemandaWriteSerializer.etiquetas`). `SeletorEtiquetas` no `FormNovaDemanda.tsx` (seção 4.5) recebe o `modulo` da demanda via `useWatch({control, name: "tipo_gestao"})` — antes usava só `tiposGestao[0]?.modulo` (funcionava por coincidência enquanto só existia 1 tipo cadastrado por módulo; STC-181 já tinha 2). Trocar `tipo_gestao` limpa a seleção de etiquetas (`setValue("etiquetas", [])`). 2 achados de review próprio corrigidos. Mergeada em `main`.
>
> ✅ **STC-186 — Auditoria de responsividade do Kanban (Pacote 7).** Primeira passada dedicada de telas estreitas e toque desde a STC-166 — tudo antes só tinha sido verificado em desktop. Testado com Playwright + sessão forjada + toque emulado (CDP) em 3 larguras (~375/768/1440px), não só DevTools visual. 4 achados reais corrigidos:
> - **Coluna Backlog parcialmente inacessível por scroll**: `justify-center` comum, com as 5 colunas não cabendo mais (basta a sidebar estar aberta num notebook comum — acontecia já em 1440px), deixava a 1ª coluna fora da área de scroll sem jeito de alcançar (`scrollLeft` não vai abaixo de 0). Trocado por `[justify-content:safe_center]` — centraliza quando cabe, cai pra alinhamento ao início quando não cabe, sem nunca cortar conteúdo.
> - **Overflow horizontal real da página em 375px**: a saudação do usuário na Topbar (seção 4.1) sem limite de largura empurrava a página inteira pra fora da viewport — confirmado medindo `scrollWidth` > `clientWidth`, não só "parecia apertado". Texto escondido abaixo de `sm`, mantendo avatar + `aria-label`.
> - **Drag-and-drop por toque**: 2 rodadas até acertar. `touch-action: none` no card ativava o drag mas quebrava o scroll da coluna por completo (qualquer toque num card virava tentativa de drag, `scrollTop` nunca mudava — confirmado com um card cheio de itens). Correção final: `touch-pan-y` (não `touch-none`) — deixa o navegador decidir pela **direção** do gesto (não por tempo, como um `activationConstraint` de delay faria): vertical vira scroll nativo sempre, horizontal/diagonal fica livre pro `PointerSensor` de sempre (voltou a ser um único sensor, sem precisar separar mouse de toque).
> - **Modal de detalhe cortava conteúdo em mobile**: grid fixo `270px+1fr` sem variante responsiva (`DetalheCard.tsx`, seção 5.1) deixava a coluna de abas com ~70px úteis num dialog de ~340px em 375px — texto/input de comentário cortados de verdade. Empilha em `flex-col` abaixo de `sm` (metadados com scroll próprio limitado a `35vh`, abas ocupando o resto); desktop sem nenhuma mudança.
>
> **Melhoria de UX mobile adicional, mesma branch** (avaliação visual pós-auditoria, não pedida no ticket original — decisão do responsável do projeto de manter na mesma PR): os 2 cards de KPI (`ResumoCards.tsx`) e a barra de filtros (`KanbanFiltros.tsx`, seção 4.4) empilhados tomavam uma tela inteira antes do usuário ver qualquer card — ver seção 4.4 e nota de UX mobile logo abaixo. Achado na autochecagem: `useMediaQuery` (novo hook, ver árvore de diretórios) corrigia o layout só depois do 1º paint (`useEffect` roda depois do navegador já ter pintado a tela) — todo carregamento em mobile piscava um frame com o layout desktop antes de reajustar. Trocado por `useLayoutEffect` isomorfo.
>
> Branch com 10 commits, push feito, texto de PR entregue — aguardando o responsável do projeto abrir o PR.

### 4.4 Barra de Filtros

```tsx
// src/app/modulos/gestao-demandas/page.tsx
const [filters, setFilters] = useSearchParams()  // Next.js useSearchParams

// Controles: Select Unidade, Select Setor, Select Prioridade, DateRange
// Busca textual com debounce de 300ms
// Limpar filtros: botão "Limpar"
```

- Persistir filtros na URL: `?unidade=1&prioridade=urgente`
- Revalidar dados ao mudar filtros (SWR re-fetch automático)

> ✅ **Concluído (STC-166), em `KanbanFiltros.tsx`.** Controles reais: Unidade, Prioridade, Categoria (só aparece com mais de 1 cadastrada — hoje só existe 1, então fica escondido) e busca textual — **sem Setor nem DateRange** na entrega original, que não estavam no mockup de referência e não foram pedidos. Filtros persistem na URL como planejado; `useDemandas`/`useResumoDemandas` usam `keepPreviousData` do SWR pra trocar de filtro sem o board inteiro sumir e reaparecer (achado nesta sessão: `isLoading` do SWR é por chave de cache, não é afetado por `keepPreviousData` — o critério certo pra saber se já existe dado pra mostrar é o retorno bruto ainda ser `undefined`, não `isLoading`).
>
> **Filtro por Setor adicionado depois** (sem issue própria, pedido direto): backend já aceitava (`DEMANDA_FILTERSET_FIELDS` inclui `setor`), só faltava o controle. Reaproveita `useSetores()` escopado por módulo (mesmo critério do formulário de Nova Demanda, 4.5 — Setor não é module-scoped por URL como tipos-gestao/categorias, então o hook recebe o id do módulo derivado de `TipoGestao.modulo`).
>
> Botão "Nova Demanda" existe na barra e agora abre o formulário de verdade — ver 4.5.
>
> **Filtros colapsáveis em mobile (Pacote 7, STC-186 — avaliação de UX pós-auditoria, mesma branch).** Busca + 4 selects + "Limpar filtros" + "Nova Demanda", tudo empilhado abaixo de 640px (cada select quase full-width numa linha própria), virava uma tela inteira de "moldura" antes do usuário ver qualquer card do board. Busca continua sempre visível (controle mais usado); os selects de Unidade/Setor/Prioridade/Categoria + "Limpar filtros" somem abaixo de `sm` e viram um `Popover` (novo em `components/ui`) atrás de um botão "Filtros" com `Badge` de contagem. `useMediaQuery("(max-width: 639px)")` decide qual das duas árvores monta — não dá pra resolver só com CSS/`flex-wrap`, já que os mesmos campos precisam aparecer inline no desktop e dentro de um painel flutuante no mobile (reposicionamento estrutural, não só visibilidade; CSS puro exigiria duplicar `<Select>`/`<label htmlFor>` no DOM, gerando id repetido). Os 4 selects ficam numa função local (`camposDeFiltro()`), reaproveitada nos dois branches. Acima de 640px, layout idêntico ao de sempre.

### 4.5 Formulário de Nova Demanda (`FormNovaDemanda.tsx`)

Modal em 3 seções (conforme mockup já existente):

**Seção 1 — Identificação:**
- Título (obrigatório, max 329 chars)
- Chips de Prioridade: Urgente / Alta / Média / Baixa

**Seção 2 — Informações:**
- Unidade (Select, obrigatório para AdminQG/AdminOps; auto-preenchido para Unidade/Setor)
- Setor (Select, opcional)
- Prazo (DatePicker, obrigatório)
- Responsável (multi-select de usuários)

**Seção 3 — Detalhes:**
- Tipo de Operação (Select)
- Descrição (Textarea, obrigatório)
- Categoria (Select)
- Etiquetas (multi-select com chips coloridos)
- Anexos (drag-and-drop ou clique)

Schema de validação `zod`:
```typescript
const schema = z.object({
  titulo:        z.string().min(3).max(329),
  prioridade:    z.enum(['baixa','media','alta','urgente']),
  data_prevista: z.string().min(1, 'Data prevista é obrigatória'),
  descricao:     z.string().min(10, 'Descrição é obrigatória'),
  tipo_operacao: z.string().min(1),
})
```

Submit: `POST /api/modulos/gestao-demandas/demandas/` → fechar modal → `mutate()` do board.

> ✅ **Implementado (STC-167), com escopo menor que o descrito aqui — 2 seções removidas de propósito, não esquecidas:**
> - **Sem Responsável no formulário.** `GET /api/plataforma/usuarios/` é restrito a `IsAdminOperacoes` — a maioria dos usuários (nível Unidade/Setor) tomaria 403 tentando listar pessoas pro multi-select. Atribuir responsável continua disponível depois, no modal de detalhe (`DetalheCard`, seção 5.1).
> - **Sem upload de Anexos no formulário.** O endpoint (`POST .../demandas/{id}/anexos/`) exige uma demanda já existente — não dá pra anexar antes de criar. Anexar continua no modal de detalhe, logo após criar.
> - **Sem Etiquetas** (multi-select) — não pedido, `Etiqueta` já existe no model mas não tem fluxo de atribuição em lugar nenhum ainda (nem no modal de detalhe).
> - Campos reais: Título, Prioridade (chips reaproveitando `COR_PRIORIDADE`/`LABEL_PRIORIDADE` de `lib/kanban.ts`), Unidade, Setor (opcional), **Tipo de Gestão** (obrigatório — não estava neste plano, mas o backend exige; só existe "Operacional" cadastrado hoje), Categoria (mesmo critério condicional da 4.4), Prazo, Descrição, Confidencial (checkbox).
> - **Primeiro uso de `react-hook-form` + `zod` no projeto** (instalados desde o Pacote 1, nunca usados até aqui) — `zodResolver`, com o cuidado de separar tipo de entrada/saída do schema (`z.input`/`z.output`) por causa de `z.coerce.number()` nos selects, que o TypeScript não casa sozinho com o `Resolver` do `zodResolver`.
> - Usa `useCriarDemanda` (STC-165), que já invalida o cache da lista via matcher (achado do Tech Lead na própria STC-165).
>
> **4 achados de review corrigidos antes do push, nenhum do Tech Lead ainda (autochecagem própria):**
> - Campos coeridos (Unidade/Tipo de Gestão) vazios mostravam o erro cru do zod ("Invalid input: expected number, received NaN") em vez da mensagem em português — a mensagem customizada estava presa no `.positive()` em vez do `z.coerce.number()` base, que falha primeiro na coerção.
> - `--input` (cor de borda de `Input`/`Select`/`Textarea`/`Checkbox` via `border-input`) era idêntico a `--background`/`--card` (`#F3F3F3`) no tema claro — borda existia no CSS mas ficava invisível, só o `shadow-xs` dava algum indício do contorno do campo. Trocado pra reaproveitar `--border` (`#BFC3C6`) — correção de token **global**, afeta todo campo de formulário do app, não só este.
> - Modal só limitava a largura a partir do breakpoint `sm:` (≥640px) — numa janela não maximizada, caía no fallback padrão do Dialog (quase edge-to-edge). Trocado pra `max-w-[min(32rem,calc(100%-2rem))]`, sempre com margem.
> - "Tipo de gestão" sozinho numa grid de 2 colunas (quando Categoria não aparece) deixava um vão vazio do lado direito — grid vira 1 coluna nesse caso.
>
> **Nota de processo:** esta issue acabou mergeada em `main` sem passar por PR/review do Tech Lead — uma branch menor (contadores de comentário/anexo + filtro de Setor, sem issue própria) foi criada em cima da branch da STC-167 pra reaproveitar hooks já prontos, e o merge dessa branch menor arrastou os 5 commits da STC-167 junto. Decisão consciente do responsável do projeto ao ser avisado (não desfazer o já pushado), mas registrado aqui pra próximas issues numeradas sempre abrirem PR próprio, mesmo quando outra coisa pequena depender delas.

---

## Pacote 5 — Colaboração, Anexos e Auditoria
**Datas:** 28/07 – 30/07 · 3 dias úteis

> ✅ **Modal de detalhe concluído (STC-168)** — clicar num card do Kanban abre `DetalheCard` com as 3 abas reais (Comentários/Anexos/Histórico). `DemandaCard` ganhou os contadores depois, junto com o filtro de Setor (ver 4.3/4.4). Só falta o **Badge de Notificações (5.5)** — não iniciado, depende do backend de Notificações (5.4 do `PLANEJAMENTO.md` do backend), também não iniciado.
>
> ✅ **Backend de Comentários, Anexos e Histórico pronto (STC-159/STC-160).** `Comentario`/`Anexo`/`HistoricoAlteracao` existem, com `GET/POST .../comentarios/`, `GET/POST/DELETE .../anexos/`, `GET .../historico/` e `GET .../timeline/` (combina histórico+comentários, não previsto neste plano — ver seção 2.5). Histórico cobre criação/edição/status/responsável/anexo, tanto pela API quanto pelo Django admin.

### 5.1 Modal de Detalhe (`DetalheCard.tsx`)

Layout em duas colunas:
- **Esquerda (2/3):** header (título, prioridade, status), stepper de status, abas (Comentários / Anexos / Histórico)
- **Direita (1/3):** metadados (unidade, setor, solicitante, responsáveis, data prevista, categoria, etiquetas, confidencial)

Header do modal:
- Título editável inline (double-click)
- Chip de prioridade editável
- Botões de ação: Editar, Mover status, Rejeitar (se em revisão)

**Stepper de Status:**
```
Backlog → Em Andamento → Em Revisão → Concluído
```
- Etapa atual destacada
- Clique em etapa posterior/anterior → coleta dados extras quando necessário → chama `atualizarStatus()` → respeita resposta do backend
- Se a API negar a transição, manter o status anterior e exibir o erro retornado
- Se `em_andamento → em_revisao`: modal pedindo seleção do aprovador
- Se `em_revisao → em_andamento` (rejeitar): modal pedindo justificativa
- Se `em_andamento → backlog`: modal pedindo justificativa
- Se `concluido → em_andamento` ou `concluido → backlog`: apenas admins, modal pedindo justificativa

> ✅ **Implementado (STC-168), com diferenças em relação ao planejado:**
> - **Sem título editável inline, sem stepper de status clicável.** O modal ficou focado em leitura + colaboração (comentar/anexar) — mudar status continua só pelo drag-and-drop do board. Header mostra badge de status (não editável) ao lado da prioridade, não um stepper de 4 etapas. ~~Mudar status continua só pelo drag-and-drop~~ **fechado pela STC-195 (Pacote 7) — ver nota abaixo.**
> - Layout 2 colunas como planejado, mas proporção diferente: esquerda fixa (270px, metadados), direita ocupa o resto (abas).
> - **2 falhas críticas achadas em review próprio antes do push:** comentário/anexo/histórico de um autor com conta excluída (`usuario` é `SET_NULL` de propósito nesses 3 models, mas os tipos TypeScript declaravam `Usuario` não-nulável) causava crash real da página inteira — confirmado simulando o cenário (criar usuário, gerar registro, excluir a conta) antes de corrigir com `nomeOuRemovido()`; e o modal ficava preso em "carregando" pra sempre em caso de erro real (`isLoading || !demanda` engolia o branch de erro).
> - **Achado testando upload de anexo num navegador real:** o proxy BFF (`route.ts`) forçava `Content-Type: application/json` e lia o corpo via `.text()` em toda requisição não-GET — quebrava upload multipart. Corrigido repassando o `Content-Type` original e bufferizando via `arrayBuffer()` (uma tentativa inicial com o corpo como stream parecia certa no código mas esvaziava a requisição silenciosamente — só descoberto testando de ponta a ponta, não só lendo o código).
>
> ✅ **STC-193 — Atribuir responsáveis à demanda (Pacote 7, pós-planejamento original).** O endpoint (`GET/POST/DELETE /demandas/{id}/responsaveis/`) já existia desde a STC-156, mas não havia nenhuma UI que o usasse — sem isso, nenhuma demanda saía do Backlog (a transição pra "Em Andamento" exige responsável principal). `ResponsavelSection` substitui a exibição somente-leitura por adicionar/remover de verdade, com seletor de usuário escopado à unidade da demanda (mesmo critério que o backend aplica em `validate_usuario_id`) + seletor de tipo (Principal/Colaborador). 4 achados de review (Tech Lead + próprio): admin sem `unidade_id` sumia do seletor (filtro no cliente não replicava a regra real do backend, que permite explicitamente um admin sem unidade como responsável de qualquer demanda); promover um colaborador já atribuído a principal não era possível (candidatos de "trocar" excluíam todo mundo já em `responsaveis` — separado em `candidatosParaAdicionar`/`candidatosParaTrocarPrincipal`); os 2 formulários (trocar/adicionar) abriam juntos, empilhados na coluna. Dependência de backend, sem issue própria: o backend passou a recusar remover o único responsável principal de uma demanda (guard novo), então o botão de remover virou "Trocar" quando a pessoa é a única principal — adiciona o novo primeiro, remove o antigo depois. Mergeada em `main`.
>
> ✅ **STC-195 — Modal de transição de status com aprovador/justificativa (Pacote 7, pós-planejamento original).** Fecha a lacuna deixada de propósito na STC-166/168: a única forma de mudar status era o drag-and-drop, que não tem como coletar `aprovador_id`/`justificativa` — essas transições só eram bloqueadas no cliente antes de tentar, sem nenhuma forma de completar de verdade. `TransicaoStatusSection` embute o formulário dentro do próprio `DetalheCard` (sem `Dialog` novo, mesmo padrão inline-expansível do `ResponsavelSection`): botão "Mudar status" abre um seletor mostrando só as opções que o usuário atual pode de fato executar (esconde admin-only/só-aprovador-ou-admin pra quem não é admin nem o aprovador designado, mesmo padrão já usado em `AnexoList.tsx`); Select de aprovador (candidatos = Admin Q&G/Admin Operações) e Textarea de justificativa aparecem só quando a transição exige. `DetalheCard` ganha um `CampoMeta` "Aprovador" (só quando definido). 100% frontend — `atualizarStatusDemanda`/`useAtualizarStatusDemanda` já existiam prontos. 2 achados de review próprio (`TransicaoStatusSection`/`ResponsavelSection` abertos ao mesmo tempo — unificados num único estado "qual seção está aberta" no `DetalheCard`, reaproveitado depois pela STC-205; comparação de aprovador vulnerável a `undefined === undefined` durante o carregamento da sessão, não explorável na prática hoje mas corrigido). Achado do Tech Lead: `useAtualizarStatusDemanda` não invalidava `["demanda", id, "historico"]` — justificativa e novo evento só apareciam após refresh manual. Mergeada em `main`.

### 5.2 Aba Comentários (`ComentarioFeed.tsx`)

```tsx
// Feed com overflow-y-auto; altura fixa para não crescer o modal
<div className="flex flex-col h-full">
  <div className="flex-1 overflow-y-auto space-y-3 p-4">
    {comentarios.map(c => <ComentarioItem key={c.id} comentario={c} />)}
  </div>
  <div className="border-t p-3 flex gap-2">
    <textarea placeholder="Adicionar comentário..." />
    <button onClick={handleSubmit}>Enviar</button>
  </div>
</div>
```

`ComentarioItem`: avatar (iniciais), nome em negrito, data/hora relativa (ex: "há 2h"), texto do comentário.

> ✅ **Implementado (STC-168).** Data/hora **absoluta** (`dd/mm/aaaa · hh:mm`), não relativa como planejado — mais previsível numa timeline de auditoria. Enter envia, Shift+Enter quebra linha.
>
> **Achado do Tech Lead:** a `<div>` que renderiza o texto do comentário não tinha `whitespace-pre-wrap` — como o textarea aceita Shift+Enter, um comentário multilinha enviado aparecia tudo numa linha só pra quem lê (CSS padrão colapsa `\n` em espaço). Corrigido.

### 5.3 Aba Anexos (`AnexoList.tsx`)

- Lista de arquivos: ícone por tipo (PDF, DOC, IMG), nome, tamanho, data, botão download
- Download: `GET /api/modulos/gestao-demandas/demandas/{id}/anexos/{anexo_id}/presigned-url/` → `window.open(url)`
- Upload: dropzone (`input type="file"` estilizado) + preview da fila
  - Tipos aceitos: PDF, DOC, DOCX, PNG, JPG, JPEG (máx 35 MB)
  - Submit: `POST /api/modulos/gestao-demandas/demandas/{id}/anexos/` multipart/form-data

> ✅ **Implementado (STC-168), com remoção adicionada depois** (sem issue própria, pedido direto): botão de excluir, visível só pra quem enviou o anexo ou é admin (mesma regra do backend), com `window.confirm()` nativo antes de excluir — irreversível de verdade (arquivo some do storage), diferente do soft delete de Demanda, mas não justificou construir um `AlertDialog` novo só pra isso ainda. `urlAbsolutaDoAnexo()` normaliza a URL do arquivo: relativa em dev local (`FileSystemStorage`, sem host) e absoluta em produção (R2, já vem completa).

### 5.4 Aba Histórico (`HistoricoTimeline.tsx`)

Timeline vertical com separador por dia:
```
● 01/07/2026 — Felipe Claudino alterou "status": Backlog → Em Andamento
● 01/07/2026 — Felipe Claudino alterou "prioridade": Média → Alta
```

Campos humanos para `campo_alterado`:
```typescript
const CAMPO_LABELS: Record<string, string> = {
  status:        'status',
  prioridade:    'prioridade',
  aprovador:     'aprovador',
  data_prevista: 'prazo',
}
```

> ✅ **Implementado (STC-168).** Frases completas em português por tipo de evento (`criacao`/`status`/`responsavel`/`anexo`/campo editado), não só rótulo de campo + valores brutos — ex.: "Felipe Claudino moveu de Backlog para Em Andamento", "Felipe Claudino anexou \"laudo.pdf\"". Ícone + cor por tipo de evento (verde criação, azul mudança de status, âmbar o resto). Sem separador por dia — lista corrida, mais recente primeiro (`HistoricoAlteracao.Meta.ordering`).

### 5.5 Badge de Notificações

`NotificacaoBadge.tsx` na Topbar:
- Poll de `GET /api/plataforma/notificacoes/?lida=false` a cada 60s (SWR `refreshInterval`)
- Dropdown ao clicar: lista das últimas 10 notificações
- Cada item: ícone de tipo, título, tempo relativo, indicador se não lida
- Ao clicar no item: marcar como lida + navegar para a demanda

> ✅ **Implementado (STC-169), consumindo os gatilhos do STC-161 (backend).** `NotificacoesMenu` (não `NotificacaoBadge`) substitui o sino estático que já existia na Topbar (ícone sem função) por um dropdown de verdade. Diferenças: contagem de não lidas vem de uma chave SWR **separada** (`?lida=false`), não de filtrar a lista local — `Notificacao` é o único recurso paginado de `plataforma` (20/página), então derivar a contagem só da lista visível subcontaria a partir de 20 acumuladas; marcar como lida/todas como lidas usa atualização otimista (local antes do round-trip) com revalidação das duas chaves ao final; poll reduzido depois pra 10s junto com o resto do polling do STC-206 (Pacote 7). Clicar numa notificação marca como lida e navega pro link genérico que o STC-161 passou a gravar (`Notificacao.link`).
>
> **Achado testando no navegador:** o clique já navegava a URL pra `?demanda=<id>`, mas nada no `KanbanBoard` lia esse parâmetro — o modal não abria. Corrigido; a limpeza do parâmetro fica só no fechamento do modal (não na abertura), porque um `router.replace()` disparado na mesma janela do `router.push()` que trouxe o parâmetro não "pegava" — a URL ficava presa em `?demanda=X`, reabrindo o modal sozinho num F5 depois de fechar. Achado do Tech Lead, depois: essa mesma limpeza deixava a URL como `"?"` sozinho quando não sobrava nenhum outro parâmetro — corrigido montando a partir de `usePathname()`. Fix de acessibilidade: o número de não lidas era anunciado 2x pro leitor de tela (`aria-label` do botão já dizia "Notificações (N não lidas)", faltava `aria-hidden` no `Badge`). Mergeada em `main`. **Fecha o Pacote 5 por completo.**

---

## Pacote 6 — Testes, Correções e Homologação
**Datas:** 31/07 – 05/08 · 4 dias úteis

### 6.1 Verificação Visual e Funcional

Checklist por tela:

**Login:**
- [ ] Botão "Entrar com Google" redireciona para OAuth
- [ ] E-mail fora de `@grupobrmed.com.br` é bloqueado com mensagem clara
- [ ] Após login bem-sucedido: redirect para `/hub`

**Hub:**
- [ ] Módulo Gestão de Demandas aparece como ativo
- [ ] Outros módulos aparecem como "Em breve"

**Kanban:**
- [ ] Cards aparecem na coluna correta
- [ ] Chips de prioridade com cores corretas
- [ ] Drag-and-drop funciona entre colunas
- [ ] Transição `backlog → em_andamento` sem responsável mostra erro
- [ ] Filtros e busca retornam resultados corretos
- [ ] Cards confidenciais ocultos para perfis sem permissão

**Formulário de Nova Demanda:**
- [ ] Botão "Criar Demanda" só habilita com campos obrigatórios preenchidos
- [ ] Submit cria a demanda e atualiza o board sem reload de página
- [ ] Validação de campos mostra mensagens de erro inline

**Modal de Detalhe:**
- [ ] Abas (Comentários / Anexos / Histórico) alternam corretamente
- [ ] Comentários enviados aparecem sem reload do modal
- [ ] Upload de anexo funciona e aparece na lista
- [ ] Download via presigned URL abre o arquivo corretamente
- [ ] Histórico de alterações aparece cronologicamente

**Mobile (≤ 480px):**
- [x] Kanban rola horizontalmente entre colunas — auditado na STC-186 (seção 4.3): scroll das colunas confirmado sem cortar nada verticalmente
- [x] Modal de detalhe mantém ações essenciais visíveis — STC-186 corrigiu o grid fixo que cortava conteúdo em 375px (seção 5.1)
- [x] Board utilizável sem overflow horizontal de página, drag-and-drop funcional por toque, filtros/KPIs sem tomar a tela inteira — auditoria dedicada, STC-186 (seções 4.3/4.4), testada em 375/768/1440px via Playwright + toque emulado
- [ ] Formulário de nova demanda em mobile — não incluído no escopo da STC-186 (auditoria focou no board/Kanban), ainda não auditado dedicadamente

### 6.2 Testes Automatizados (Playwright)

> ✅ **Testes unitários/de lógica adicionados adiantado, na STC-166 (não estava previsto para o Pacote 4).** Frontend não tinha nenhuma infraestrutura de teste até então. Adicionado **Vitest** + Testing Library + jsdom, com resolução de path alias via `vite-tsconfig-paths`. `npm run test` / `npm run test:watch`.
>
> A lógica de negócio pura do Kanban (`compararDemandas`, `mensagemBloqueioConhecido`, `passaNoFoco`, `filtrosDaUrl`) foi extraída de `KanbanBoard.tsx` pra `src/lib/kanban.ts` especificamente pra ficar testável. 31 testes cobrindo essa lógica, o parser de erro do DRF (`extrairMensagemErro`) e os helpers de nome/iniciais (`nomeExibicao`/`iniciaisDe`).
>
> ✅ **Primeira suíte de teste de componente (STC-171, mergeada — seção 7.4).** `HubContent.test.tsx`, `KanbanBoard.test.tsx`, `FormNovaDemanda.test.tsx` + `src/test-utils/fixtures.ts`, 6 gaps reais de infraestrutura jsdom/RTL/SWR/Radix corrigidos em `vitest.setup.ts`. Continua sendo Vitest — testes de componente, mockando as chamadas HTTP, não E2E contra backend real.

✅ **STC-216 — Suíte E2E automatizada com Playwright, mergeada.** Fecha de vez o item que ficava "planejamento, não implementação" desde o início do Pacote 6: até aqui o fluxo de ponta a ponta só era validado manualmente, sempre com um script Playwright descartável (sessão forjada + navegador real) nunca versionado.

**Decisão de escopo (era um ponto em aberto do próprio ticket): suíte roda contra backend local, não um ambiente de staging dedicado.** Não existe hoje nenhum ambiente de staging — `docs/custos-necessarios-hoje-atlas.md` (29/07) já deixou claro que a infra atual mal cobre um ambiente de produção único; um segundo ambiente só pra testes não se paga agora. É também o único jeito de bater o critério de aceite "roda localmente sem configuração manual prévia" sem depender de infra externa.

**Arquitetura:**
- Backend: `core/settings/e2e.py` (novo) — SQLite em arquivo dedicado (`db.e2e.sqlite3`, não `:memory:` como `core/settings/test.py`, porque aqui precisa de um `runserver` real de pé pro Playwright bater via HTTP) + `FileSystemStorage` forçado (nunca toca o bucket R2 real). `accounts/management/commands/seed_e2e_usuario.py` (novo) — comando idempotente que garante um usuário Admin Q&G de teste e imprime em stdout o mesmo par de tokens JWT + dado de usuário que `GoogleLoginView` devolveria num login real (via `RefreshToken.for_user()`, SimpleJWT) — a suíte nunca depende do Google OAuth de verdade.
- `playwright.config.ts` (raiz do frontend): dois `webServer` (backend na porta 8001, frontend na 3100 — portas dedicadas, `reuseExistingServer:false`, nunca reaproveita/colide com um ambiente de dev manual aberto em paralelo). Projeto `setup` (`e2e/auth.setup.ts`) roda a `seed_e2e_usuario`, monta o cookie de sessão do NextAuth com `encode()` (mesma receita usada manualmente a sessão inteira) e grava em `playwright/.auth/user.json` via `storageState` — só depois disso o projeto principal (`e2e/fluxo-principal.spec.ts`) roda, com a sessão pronta.
- **Frontend roda como build de produção (`next build && next start`), não `next dev`.** Achado rodando a suíte pela 1ª vez: em dev/Turbopack, a compilação sob demanda de uma rota ainda não visitada (ex.: `/api/auth/[...nextauth]`, acionada pelo primeiro `GET /api/auth/session`) dispara um Fast Refresh no cliente mesmo sem nenhum arquivo mudar — se isso cai bem no instante de um clique, o remount descarta o estado React local (ex.: o `open` do modal de Nova Demanda), e o clique some sem erro nenhum no console. `next build` elimina compilação sob demanda em runtime. `next.config.ts` ganhou um `distDir` condicional (`.next-e2e` via env `PLAYWRIGHT_E2E=1`, só durante a suíte) — sem isso, um `npm run dev` manual aberto em paralelo corrompe o manifest do Turbopack (mesmo bug de 2 processos escrevendo no mesmo `.next/` já visto antes nesta sessão, em outro contexto).
- **Achado de segurança de cookie, específico da combinação "build de produção + HTTP" (só acontece em E2E, nunca em ambiente real):** `NODE_ENV` é `"production"` de verdade sob `next start`, então o proxy BFF (`route.ts`, heurística `NODE_ENV==="production"`) passa a exigir o cookie `__Secure-authjs.session-token`. Mas o `auth()` do middleware autodetecta `secureCookie` pelo protocolo da requisição — e a suíte roda em HTTP puro (`localhost:3100`, sem TLS), então ele continua esperando o cookie **sem** prefixo. As duas heurísticas só concordam nos ambientes reais (Vercel prod = sempre HTTPS; dev local = sempre HTTP+`development`); a suíte é a primeira situação onde divergem. `auth.setup.ts` contorna gravando os dois cookies (mesmo payload, dois `encode()` com `salt` diferente cada um) em vez de tentar forçar `NODE_ENV`, que o `next start` já sobrescreve sozinho.
- **Drag-and-drop real via `page.mouse`** (não HTML5 drag) — dnd-kit usa `PointerSensor` com `activationConstraint:{distance:6}` (`KanbanBoard.tsx`). Pausas curtas (`waitForTimeout`) entre os passos do movimento são necessárias: sem elas, o sensor às vezes não termina de "armar" o drag antes do salto até a coluna de destino, e o gesto inteiro degenera num clique comum.
- **Achado de cache real, não relacionado a teste (bug de produto):** `useResponsaveis.ts` (`useAdicionarResponsavel`/`useRemoverResponsavel`) invalidava só `["demanda", id, "historico"]`, nunca a chave de lista (`ehChaveDeListaDemandas`, já usada por `useAtualizarDemanda`/`useAtualizarStatusDemanda` desde achados anteriores). Resultado: o board (`KanbanBoard`) continuava com o dado velho — "sem responsável" — até o próximo poll de 10s (STC-206). Como sair do Backlog exige responsável principal, validado no cliente contra esse mesmo dado da lista antes de chamar o backend, um usuário real que atribuísse responsável e tentasse mover o card **na sequência** via drag-and-drop via o movimento "bloqueado" silenciosamente por até 10s — achado direto pela suíte E2E (o teste falhava de forma intermitente exatamente nesse ponto), não por inspeção manual. Corrigido replicando o mesmo `mutate(ehChaveDeListaDemandas)` já usado nos outros hooks de mutação.

**Fluxo coberto** (`e2e/fluxo-principal.spec.ts`, sessão já autenticada, sem passar por `/login`): criar demanda (`FormNovaDemanda`, campos obrigatórios) → atribuir responsável principal (`ResponsavelSection`) → mover Backlog→Em Andamento via drag real → comentar (`ComentarioFeed`) → mudar status até Concluído via `TransicaoStatusSection` (com aprovador quando exigido). Um único usuário Admin Q&G cobre solicitante/responsável/aprovador ao mesmo tempo (nível 1 passa em todos os gates de permissão do fluxo).

**Como rodar:** `npx playwright test` — sobe os dois servidores sozinho, sem nenhuma configuração manual prévia (critério de aceite do ticket). `vitest.config.ts` ganhou `exclude: ["e2e/**"]` pra não colidir com o `test()` global do Playwright.

### 6.3 Ajustes Pós-Homologação

- Priorizar por impacto: crítico (bloqueia uso) → médio (prejudica UX) → baixo (cosmético)
- Re-testar após cada correção
- Documentar issues que ficam em aberto para pós-entrega

---

## Pacote 7 — Extensões Pós-Planejamento Original

Não estava no planejamento original (SRS/Plano de Pacotes) — pacote criado depois que o Pacote 5 fechou adiantado, pra agrupar trabalho que foi surgindo por dogfooding e pedido direto do responsável do projeto. Detalhe cronológico completo em `Plano de Ação - Gestão de Demandas.md` (§8/§11); aqui só o que é tecnicamente relevante pro frontend.

**Já coberto nas seções acima** (por fecharem lacunas de issues já documentadas): STC-181/182 (tipo de gestão — 4.3), STC-192/208/210 (logout/avatar, refresh automático, login split-screen — 4.1), STC-193/195/203/196/197 (responsáveis, transição de status, drag bloqueado, etiquetas — 4.3/4.5), STC-186 — filtros/KPIs colapsáveis em mobile (4.4), STC-169 (notificações — 5.5).

### 7.1 STC-206 — Polling pra manter dados atualizados entre usuários

✅ **Mergeada em `main`.** Decisão de produto: polling via SWR `refreshInterval`, não WebSockets — complexidade menor, e o app não precisa de latência sub-segundo. `refreshInterval` de 10s em: comentários/anexos/histórico/demanda aberta (só com o modal aberto), board/KPIs (`useDemandas`/`useResumoDemandas`, pausado durante o arraste **e** durante a mutação do drop em si — achado próprio, `movimentoPendente`: o estado visual de arraste terminava antes da mutação assíncrona começar, deixando uma janela de corrida onde um poll podia disparar no meio do `PATCH .../status/`); notificações (reduzido de 30s pra 10s, mesmo padrão).

**Achado do próprio usuário testando ao vivo:** o board/KPIs piscavam cinza (`opacity-60`) a cada 10s, mesmo sem nenhuma mudança visível — causa raiz é `isValidating` do SWR não distinguir revalidação por polling silencioso de uma troca de filtro real. Corrigido com um hook novo, `useValidandoPorTrocaDeChave(chave, isValidating)`: só reporta "carregando" quando a chave de cache settled é diferente da atual (ajusta o "settled" via `useState` durante a própria renderização, não em `useEffect`, pra não introduzir 1 frame de atraso) — sem tocar em nenhum componente consumidor.

### 7.2 STC-204/STC-205 — Editar campos gerais da demanda

Até aqui, só título/descrição/prazo/prioridade/setor/categoria/confidencial eram definidos na criação (`FormNovaDemanda`) e nunca mais editáveis. **STC-204 (backend)**: `PodeEditarDemanda`, nova permission de objeto — solicitante, qualquer responsável ou admin (nível ≤2); aprovador sozinho fica de fora de propósito (papel dele é decidir a revisão, não editar conteúdo). Plugada só em `update`/`partial_update` do `DemandaViewSet`. Mergeada em `main` (achado do Tech Lead: ignorava `PermissaoUsuario` individual ativa, corrigido).

**STC-205 (frontend)**: um único formulário "Editar demanda" (não campo-a-campo) — `EditarDemandaSection.tsx`, novo — no topo do painel esquerdo do `DetalheCard`. Originalmente, sua visibilidade era inferida no cliente via `useAuth()`. Após a integração da STC-266, `DetalheCard` passou a usar exclusivamente `demanda.pode_editar`, capacidade devolvida pelo backend pela mesma regra que protege o `PATCH`; assim, uma permissão individual temporária de edição é reconhecida sem duplicar no navegador a lógica de escopo e vigência. Reaproveita o padrão `react-hook-form`+`zod` da `FormNovaDemanda.tsx`. Fix de cache reaproveitado: `useAtualizarDemanda` não invalidava `["demanda", id, "historico"]` — 3ª vez que esse mesmo bug aparece no projeto (depois de `useResponsaveis`/`useAtualizarStatusDemanda`).

2 achados de review próprio, corrigidos antes do push:
- **Select de Setor/Categoria não voltava visualmente pra "Nenhum"** depois de escolher, mesmo com o dado real já correto por baixo (confirmado via inspeção de rede + teste direto contra o backend). Causa: `value` do Radix Select derivado por ternário (`field.value ? String(...) : SEM_SELECAO`) a cada render é instável. Corrigido mantendo o campo do formulário como `string` sempre (sentinela `"__nenhum__"` ou id-como-string), `value`/`onValueChange` ligados direto no field sem nenhuma derivação; a sentinela só vira `null`/número no submit, nunca é tratada como valor de negócio real (não pode virar, por exemplo, um "tipo de setor" de verdade).
- **Formulário aberto não resincronizava se a demanda mudasse por baixo dele** via polling do STC-206 (outra pessoa editando ao mesmo tempo) — um `Salvar` sobrescreveria essa mudança concorrente com um retrato desatualizado. Corrigido com um `useEffect` adicional que resincroniza só se o usuário ainda não tiver mexido em nada (`!isDirty`), sem descartar edição em andamento.

Implementado e verificado (`tsc`/lint/vitest/build); commitado em partes. Mergeada em `main`.

### 7.3 Ajustes de UI/infra ad hoc (sem issue própria)

- Logo da BR MED alinhada com os ícones dos módulos na Sidebar; remoção do ícone do módulo do título na Topbar (redundante com o já visível na Sidebar).
- Mensagem técnica crua do SimpleJWT (`token_not_valid` + `detail`+`code`+`messages` concatenados por `extrairMensagemErro`) aparecendo por um instante antes do logout automático em qualquer 401 — trocada por uma mensagem amigável fixa (403 não precisou de mudança, já usa a mensagem real do backend).
- Proxy BFF nunca achava a sessão em produção (HTTPS): `getToken()` não autodetecta `secureCookie` a partir do protocolo — sem o sinal explícito (`NODE_ENV === "production"`), todo request virava 401 mesmo logado. Só apareceu ao testar com login Google real pela primeira vez (sessões forjadas em dev sempre mascararam isso).
- Build de produção com `--turbopack` ignorava o `matcher` customizado do middleware, caindo no padrão genérico e bloqueando até asset estático (`_next/static/**`) — página sem nenhum estilo em produção. `next build` (produção) não usa mais `--turbopack`; o dev mantém.
- Favicon padrão do `create-next-app` (nunca trocado desde a fundação) substituído pelo símbolo da marca BR MED (recorte quadrado da marca vertical oficial, sem o texto — ilegível no tamanho de favicon); título da aba trocado de "Atlas — Plataforma de Operações" pra "Atlas - BR MED".

### 7.4 STC-171 — Testes automatizados do fluxo principal

✅ **Mergeada em `main`.** Primeira suíte de **teste de componente** do projeto (Vitest + Testing Library) — até aqui só existiam os 3 arquivos de função pura citados na seção 6.2 (`kanban.test.ts`, `erros.test.ts`, `utils.test.ts`). 3 arquivos novos: `HubContent.test.tsx` (renderiza o componente direto, não a rota — `hub/page.tsx` só redireciona, seção 4.2), `KanbanBoard.test.tsx` (render/loading/vazio/erro/abrir modal/mover card) e `FormNovaDemanda.test.tsx` (criar/validação/erro) + `src/test-utils/fixtures.ts` compartilhado (ver árvore de diretórios).

6 gaps reais de infraestrutura jsdom/RTL/SWR/Radix descobertos empiricamente (não teorizados) e corrigidos de forma geral em `vitest.setup.ts`, não caso a caso: falta de `afterEach(cleanup())` (RTL não limpa sozinho entre testes sem `test.globals` no config); `ResizeObserver`/Pointer Events/`scrollIntoView` ausentes no jsdom (Radix `Select` precisa até pra montar); cache global do SWR vazando entre testes do mesmo arquivo (resolvido com `SWRConfig` de cache novo por `render()`); side-effects do Radix `Dialog` (`data-scroll-locked`) sobrevivendo a um unmount abrupto entre testes. Mover card testado mockando só `DndContext` de `@dnd-kit/core` (não o pacote inteiro) — geometria real de drag não é confiável em jsdom (`getBoundingClientRect()` sempre zero), então captura o `onDragEnd` real e invoca com um evento sintético, exercitando a lógica de verdade do `moverDemanda` (update otimista, mock de API, rollback em erro). 2 achados de autochecagem: teste com `getByText` não-escopado (provava só que o texto existe em algum lugar do documento, não na coluna certa — corrigido com `within()`); `clearAllMocks()` trocado por `resetAllMocks()` (risco latente de mock-implementation vazando entre testes).

Depois de mergeada junto com a STC-186 (nunca tinham sido testadas juntas antes), 2 bugs de infraestrutura de teste pré-existentes apareceram — ver STC-215 (7.6) abaixo.

### 7.5 STC-216 — Suíte de testes E2E com Playwright

✅ **Mergeada em `main`.** Formaliza como suíte committada o que até aqui só existia como script Playwright descartável (sessão forjada, nunca versionado). Detalhe técnico completo na seção 6.2. Resumo: roda contra backend local (sem staging — decisão registrada em 6.2), build de produção (`next build`/`next start`, não dev — evita um Fast Refresh espúrio que quebrava cliques em testes), sessão via `RefreshToken.for_user()` + `encode()` do NextAuth (sem Google OAuth real), cobrindo criar → atribuir responsável → mover (drag real) → comentar → concluir. Achou e corrigiu um bug de cache real (não de teste): `useResponsaveis.ts` não invalidava a lista do board, deixando o Kanban com dado velho por até 10s depois de atribuir responsável.

### 7.6 STC-215 — Corrigir labels dos Selects sem associação técnica

✅ **Mergeada em `main`.** Achado dos reviews de acessibilidade da STC-171/STC-186: vários `Select` (Radix) não tinham nome acessível estável — ou dependiam só do `placeholder` do `SelectValue` (que some do DOM assim que um valor é selecionado) ou não tinham nenhum `<Label>` associado tecnicamente ao campo. `htmlFor`/`id` (`Label`↔`SelectTrigger`) em `FormNovaDemanda`/`EditarDemandaSection`; `aria-label` direto no `SelectTrigger` em `KanbanFiltros`/`TransicaoStatusSection`/`ResponsavelSection` (sem `<Label>` visível nesses).

Autochecagem própria achou e corrigiu 2 bugs de infraestrutura de teste pré-existentes em `main`, sem relação direta com o escopo da issue mas necessários pra suíte voltar a passar — só visíveis porque STC-171 e STC-186 nunca tinham sido testadas juntas antes de mergear: `window.matchMedia` ausente no jsdom (`useMediaQuery` da STC-186 quebrava qualquer teste que renderizasse `KanbanBoard`/`KanbanFiltros`) e `KanbanBoard.test.tsx` sem mock de `@/lib/plataforma` (vazava chamada de rede real). Checagem crítica própria descartou um risco hipotético de ambiguidade de nome acessível entre o Select "Unidade" do modal `FormNovaDemanda` e o do filtro de fundo (`KanbanFiltros`) — verificado ao vivo via Playwright que o Radix `Dialog` já aplica `aria-hidden` no fundo enquanto aberto, sem necessidade de nenhuma mudança.

### 7.7 Fechadas nesta rodada (já cobertas nas seções acima)

STC-192/STC-208/STC-210 (4.1), STC-203/STC-196/STC-197 (4.3), STC-186 — filtros/KPIs mobile (4.4), STC-204/STC-205 (7.2), STC-206 (7.1), STC-171 (7.4), STC-216 (7.5), STC-215 (7.6) — todas mergeadas em `main`. Nenhum item "rascunhado, não iniciado" sobrando no momento.

### 7.8 STC-266 — Tela de administração para conceder/gerenciar permissões individuais

✅ **Mergeada em `main`** (PR #25 + 3 commits de review depois). Nova tela `/admin/permissoes` (link na Sidebar, visível só pra Admin Q&G/Admin Operações), com duas seções independentes: "Perfil, unidade e setor" (`GerenciarUsuarios.tsx`) — edita `perfil_id`/`unidade_id`/`setor_id` de cada pessoa via `PATCH /plataforma/usuarios/{id}/`, nunca lista nem oferece nível admin (nível ≤2) como opção, mesmo o backend aceitando mais que isso via API (ver achado de review abaixo) — e "Permissões individuais" (`PermissoesAdmin.tsx` + `FormNovaPermissao.tsx`) — CRUD de `PermissaoUsuario` (`/plataforma/permissoes-usuario/`), concessão/revogação com escopo (global/unidade/setor/próprio) e período opcional. `hooks/usePermissoes.ts`, `usePerfis.ts`, `useModulos.ts` novos; `useUsuarios.ts` ganhou `useAtualizarUsuario`; `lib/plataforma.ts` estendido (mesmo app Django que já hospedava Unidade/Setor).

Decisões de UI notáveis: `PermissaoUsuario` possui uma ação por registro, então
o formulário também permite uma única escolha (`Visualizar` ou `Editar`) e
faz somente uma chamada de criação. `Editar` já implica leitura no backend.
Cada registro da API permanece uma linha independente na tabela e a revogação
usa apenas seu ID real; timestamps não são usados como identidade de lote.
Filtros (Status/Pessoa/Ação numa seção, Perfil/Unidade na outra) seguem o padrão já estabelecido em `KanbanFiltros` (STC-186): inline no desktop, Popover+Badge atrás de um ícone abaixo de 640px. Altura das duas seções é proporcional ao número de linhas de cada uma (`pesoSecao`, com piso mínimo pra nenhuma sumir), cada uma com scroll próprio — `useAlturaSemLinhaCortada.ts` (novo hook genérico, mesmo espírito de `useMediaQuery.ts`) mede a altura real de uma linha em runtime e trava a tabela num múltiplo exato, garantindo que a última linha visível nunca apareça cortada pela metade.

Sidebar/AppShell: o menu lateral em mobile deixou de "empurrar" o conteúdo (`width` 0↔16rem) e virou overlay flutuante (`position: fixed`, backdrop, trava de scroll do body) — achado direto do responsável do projeto ("a página principal não pode ser impactada pela presença do menu lateral").

**Backend companion de notificações** (branch separada,
`STC-266-backend-notificacoes-perfil-e-permissao`, ainda não mergeada):
`plataforma/notificacoes.py` (mesmo padrão de `demandas/notificacoes.py`)
notifica o usuário quando o próprio perfil muda ou uma permissão é
concedida/revogada. Esse companion não bloqueia o CRUD nem a aplicação das
permissões da tela; enquanto não for integrado, fica ausente somente o envio
dessas notificações.

**Correção de contrato após revisão:** o formulário do recurso
`gestao-demandas.kanban` oferece uma escolha entre `Visualizar` e `Editar`,
que são as ações realmente consumidas pelo backend. `Editar` inclui leitura
sem criar um segundo registro `Visualizar`; lixeira, aprovação e configurações permanecem regidas pelas
regras administrativas próprias, sem criar permissões individuais sem efeito.
As respostas de demanda trazem `pode_editar: boolean`, calculado pelo backend
com a mesma regra que autoriza a atualização. O valor é `true` para
administradores, solicitante, responsáveis e usuários cobertos por uma
permissão individual `Editar` vigente e dentro do escopo; é `false` para
permissões apenas de visualização, revogadas, agendadas, expiradas, fora do
escopo ou quando a demanda está na lixeira. `DetalheCard` apenas repassa esse
valor para `EditarDemandaSection`: não tenta reconstruir autorização com perfil,
vínculos ou datas no navegador. A proteção efetiva continua no backend; ocultar
o formulário é somente a representação correta dessa capacidade na interface.

**Achados da autorevisão de segurança/estrutura** (feita depois de fechar o pacote, sem issue própria):
- Corrigido: `statusPermissao()` calculava "hoje" no fuso do navegador (`getFullYear()/getMonth()/getDate()` de `new Date()`), podendo divergir do critério real do backend (`PermissaoUsuarioManager.ativas()`, fuso fixo `America/Sao_Paulo`) pra quem acessa de outro fuso — a badge Ativa/Agendada/Expirada podia mostrar um estado que o backend não concordava. Trocado pelo utilitário já existente `hojeNoFusoDoServidor()` (`lib/kanban.ts`), em vez de duplicar a lógica.
- **Corrigido no backend (`main`, commit `aa7fce9`):** a validação em
  `accounts/serializers.py` passou a tratar Admin Q&G e Admin Operações como
  níveis administrativos protegidos. Admin Operações não pode promover outra
  pessoa (nem a própria conta) a Admin Operações, alterar outro usuário desse
  nível ou contornar pela API o filtro aplicado pela tela. Os cenários de
  criação, promoção, alteração e tentativa de autoelevação possuem cobertura
  automatizada no backend.
- Cosmético, tentado e revertido: as duas tabelas usam `<thead>` com `position: sticky`, o que faz a scrollbar nativa (vertical) passar visualmente por cima do cabeçalho ao rolar. Uma tentativa de separar `<thead>`/`<tbody>` em containers de scroll independentes (técnica de "block display hack") introduziu regressões piores em telas pequenas (scroll duplo, seção inteira empurrando a página) sem forma de validação visual direta a cada iteração — revertida por completo. Fica registrado como problema cosmético conhecido, não como algo a reabrir sem uma forma de testar visualmente antes de cada tentativa.

Validação final da branch: `tsc --noEmit`, ESLint, build de produção e suíte
completa do Vitest passando (13 arquivos, 108 testes), incluindo o contrato de
`pode_editar` no `DetalheCard`. O deploy de preview da Vercel para o commit
`8d6835d` também concluiu com sucesso. Durante o desenvolvimento, 15 permissões
de exemplo foram semeadas apenas no ambiente local (Django shell) para
dogfooding visual; elas não fazem parte do código nem dos dados de produção.

### 7.9 Concluir demanda sem revisão (pedido direto do responsável do projeto, sem issue própria)

✅ **Mergeada em `main`.** Pedido direto: nem toda demanda tem um revisor disponível — faltava um jeito de fechar essas sem forçar a passagem por Em Revisão. Em vez de um pseudo-valor "Sem Revisão" dentro da coluna Em Revisão (ambíguo — o card ficaria sentado numa coluna que significa "esperando revisor" sem ter nenhum), a transição direta **Em Andamento → Concluído** foi liberada, restrita a Admin Q&G/Admin Operações (mesmo par de níveis já usado nas outras transições admin-only). `TRANSICOES_PERMITIDAS`/`TRANSICOES_ADMIN_ONLY` (`lib/kanban.ts`) espelham a liberação equivalente do backend (`demandas/views.py`) — `TransicaoStatusSection.tsx` não precisou de nenhuma mudança, já é inteiramente orientado pelos dados desses dois mapas.

**Achado em autorevisão, corrigido na mesma leva:** `bloqueioDetalhado` (usado tanto pelo toast quanto pelo drag-and-drop do `KanbanBoard`) checava permissão de QUEM pode fazer uma transição, mas nunca se ela EXISTE — um par fora de `TRANSICOES_PERMITIDAS` (ex.: Backlog → Concluído, "pula tudo") não estava em nenhum dos sets de permissão, então passava sem bloqueio nenhum nessa função. O Select de "Mudar status" nunca teve esse problema (já filtra por `proximosStatusValidos`), mas o drag-and-drop chamava `bloqueioDetalhado` direto — um drag pra uma coluna não-adjacente só falhava depois, na resposta 400 do backend, sem feedback imediato. Corrigido com uma checagem de validade antes da checagem de permissão; "lixeira" fica de fora de propósito (mover pra lá é soft-delete via `excluirDemanda`, nunca uma transição de status de verdade).

**Achado no backend na mesma revisão (sem alteração de frontend):** `EM_REVISAO → EM_ANDAMENTO` (rejeição) nunca limpava o campo `aprovador` — uma demanda que já tinha passado por um ciclo de revisão rejeitado chegava em Em Andamento com um aprovador residual, e "concluir sem revisão" sem tratar isso deixaria a demanda concluída exibindo esse aprovador antigo (o campo é sempre serializado pro frontend, sem condicionar ao status). Corrigido no backend, limpando `aprovador` explicitamente nesse caminho.

### 7.10 STC-423 — Sidebar lê o status do módulo pela API

✅ **Implementado e mergeado em `main`.** `MODULOS_FUTUROS` (`config/modulos-futuros.ts`) era um array hardcoded consumido pela Sidebar e pela Hub -- Legalização permanecia nele como "em breve" mesmo já tendo rotas reais e funcionais, porque ninguém editava o array. Ativar ou bloquear um módulo exigia um pull request de frontend, embora `Modulo.status` já existisse no banco (STC-420, `choices` fechados: `ativo`/`em_breve`/`inativo`) e não fosse consultado.

- `ModuloFuturo` ganha `codigo`/`rota` opcionais -- só os módulos que já têm página construída no frontend (hoje, só Legalização) recebem os dois; os demais (Gestão RH, Arquitetura, Diário de Bordo, Calibração de Equipamentos) continuam sem, e por isso ficam bloqueados pra sempre, não importa o que `Modulo.status` diga. É o mapeamento "código → rota, ícone" que a issue pede pra manter em código, nunca vindo do backend.
- Novo hook `useModulosNavegacao()` (`hooks/useModulosNavegacao.ts`) cruza `MODULOS_FUTUROS` com o `Modulo[]` real (`useModulos()`, já existente): `ativo = !!rota && moduloReal?.status === "ativo"`. Exige as duas coisas -- rota configurada no frontend E status "ativo" no banco.
- `Sidebar.tsx`: módulos com `ativo=true` viram `SidebarLink` de verdade (com estado ativo calculado por `pathname.startsWith(rota)`, mesmo critério já usado pra Gestão de Demandas); o resto continua como `SidebarLinkBloqueado` ("em breve"). "Hub" continua sempre bloqueado e sempre primeiro na lista -- não é um `Modulo` real do backend, fica de fora do cruzamento.
- Critério de aceite direto: com `Modulo(codigo="legalizacao").status == "em_breve"` (ou nenhum `Modulo` ainda cadastrado), a Sidebar mostra Legalização bloqueada; com `status == "ativo"`, mostra o link real pra `/modulos/legalizacao`, sem precisar de deploy de frontend.

**Decisão consciente de escopo, não implementada**: a Hub (`HubContent.tsx`, rota `/hub`) não foi tocada. A rota `/hub` já é código morto por decisão anterior (`page.tsx` só redireciona pra `/modulos/gestao-demandas`, comentário "código morto de propósito", STC-171) -- `HubContent.tsx` não tem nenhum hook de dado hoje, é testado direto com dados 100% mockados. Fazer a Hub também reagir ao status exigiria decidir como seria um `ModuleTileAtivo` de Legalização ali (que estatísticas mostrar -- não existe endpoint agregado pra isso ainda), trabalho de desenho de produto fora do que esta issue pede (o critério de aceite descrito nela só fala da Sidebar). Fica registrado pra quando a Hub for reativada de verdade.

**Achado em análise própria, decidido e não corrigido**: no primeiro carregamento da página, antes do `useModulos()` (SWR) resolver, todo módulo nasce bloqueado por padrão (`modulos` começa como `[]`) -- mesmo um módulo já `ativo` no banco aparece bloqueado por uma fração de segundo até o fetch responder, depois "pula" pra link real. Mesmo padrão que toda outra tela do Atlas já aceita com SWR (nenhuma tem skeleton/estado de loading dedicado pra essa janela curta) -- não tratado aqui por consistência com o resto do app, não por descuido.

Suíte completa do frontend em 406 testes, `tsc --noEmit`/`eslint` limpos.

### 7.11 STC-422 — Recurso de permissão dinâmico em Conceder permissão

✅ **Implementado.** `RECURSOS` em `FormNovaPermissao.tsx` (§7.8 acima) era um array hardcoded -- cada recurso novo exigia um pull request de frontend, embora o backend já tivesse um catálogo consultável (`RecursoPermissao`, STC-421, aninhado em `Modulo.recursos_permissao`). Achado ao usar o próprio Admin depois de criar a primeira permissão de Legalização: a tabela "Permissões individuais" (`PermissoesAdmin.tsx`) nunca mostrava qual recurso/módulo cada permissão cobre -- fazia sentido enquanto só existia um recurso no sistema inteiro, deixou de fazer com um segundo módulo em uso.

- Novo hook `useRecursosPermissao()` (`hooks/useModulos.ts`), reaproveitando `useModulos()` por baixo (mesma chave SWR, sem fetch novo): achata `Modulo.recursos_permissao` numa lista só, carregando `moduloId`/`moduloCodigo`/`moduloNome` junto em cada item.
- `FormNovaPermissao.tsx`: Select de Recurso passa a vir do catálogo (`"<módulo> -- <rótulo>"`); `aoSubmeter` resolve `modulo` direto do item achatado, sem mais inferir pelo prefixo de `recurso` antes do `.`. Ação (`visualizar`/`editar`) passa a ser a interseção entre o teto que este formulário sabe conceder (`ACOES_KANBAN`) e `recurso.acoes_suportadas` do recurso escolhido -- trocar de recurso que deixa a ação já escolhida inválida reseta pra a primeira disponível.
- `PermissoesAdmin.tsx`: nova coluna "Recurso" na tabela, resolvendo `permissao.recurso` pro rótulo do catálogo; cai pra chave crua se o recurso não estiver (mais) no catálogo, pra não sumir a linha nem quebrar o render.
- **Achados em análise própria de falhas críticas, todos corrigidos antes do push**: (1) `useRecursosPermissao` fazia `modulo.recursos_permissao.map(...)` sem guarda -- um `Modulo` que chegasse sem esse campo (contrato quebrado em runtime, já que TypeScript não valida resposta de API) derrubava a página inteira de Administração com `TypeError`, não só o catálogo de permissões; corrigido com `?? []`. (2) O `useEffect` que reseta uma Ação inválida ao trocar de recurso só dependia de `recursoSelecionado` -- no fluxo "Renovar" (abre pré-preenchido a partir de uma permissão existente), se o catálogo ainda estivesse carregando quando `reset()` já tivesse preenchido os campos, uma ação incompatível pré-existente nunca era revalidada; corrigido incluindo `recursos` (agora memoizado via `useMemo`, ver achado 3) nas deps do efeito. (3) O achatamento do catálogo (`flatMap`) rodava em todo render, sem `useMemo` -- além do custo à toa, dava um array de referência nova a cada vez, o que também tornava o achado 2 impossível de resolver de forma limpa via dependências de efeito; corrigido memoizando por `modulos`. (4) `Renovar` numa permissão cujo `recurso` saiu do catálogo depois deixava o Select em branco (nem placeholder, nem o valor real) -- corrigido injetando um item desabilitado mostrando a chave órfã, em vez de escondê-la. Esse achado (4) só corrigia a aparência, não o submit -- ver achado do code review abaixo.
- **Decisão inicial revista pelo code review**: a versão original deste PR deixava conscientemente sem tratamento o caso de um recurso sem nenhuma interseção entre `acoes_suportadas` e `ACOES_KANBAN` (ex.: só `["configurar"]`), por não existir ainda um recurso real nesse caso. O code review apontou que isso é exatamente o cenário central da issue ("recurso novo cadastrado no backend, sem PR de frontend") -- o Select de Ação ficava vazio, mas o valor padrão ("visualizar") sobrevivia por baixo e ia pro submit sem aviso, gerando uma permissão com uma ação que o próprio catálogo diz não suportar. Corrigido: `acaoIndisponivel` bloqueia o botão de submit e mostra uma mensagem explícita quando o recurso escolhido cai nesse caso, com uma segunda checagem em `aoSubmeter` (mesmo padrão do achado de `catalogoCarregando`).
- Lógica de "achar recurso pelo `chave`" extraída pra `encontrarRecursoPorChave()` (`hooks/useModulos.ts`), compartilhada entre `FormNovaPermissao.tsx` e `PermissoesAdmin.tsx` -- achado em code review: as duas telas reimplementavam o mesmo `.find()`.
- **Achado no code review automático do PR**: o achado (4) acima resolvia só a exibição -- `aoSubmeter` continuava resolvendo `modulo` exclusivamente via `encontrarRecursoPorChave(recursos, valores.recurso)`, que só acha o módulo se aquele recurso específico ainda estiver listado no catálogo atual. Reativar/renovar uma permissão cujo recurso saiu do catálogo, sem tocar no campo Recurso (o próprio caso de uso do botão "Reativar"), enviava `modulo: null`, mesmo o módulo dono daquele recurso continuando a existir -- só o recurso específico é que não está mais no catálogo, não o módulo. Corrigido com um fallback em `aoSubmeter`: se o recurso não for achado no catálogo achatado, busca o `Modulo` pelo prefixo de `recurso` antes do `.` contra `Modulo.codigo` (mesmo mecanismo que existia antes desta issue trocar a fonte de dados, mantido só como rede de segurança pra esse caminho específico). Teste novo cobrindo o payload de `criarPermissao` nesse cenário (o teste anterior só verificava a exibição, nunca o valor enviado).
- **Achado numa 3ª rodada de code review**: `recursos=[]` durante o carregamento do catálogo (`useRecursosPermissao()`/`useModulos()` ainda sem resposta) é visualmente idêntico a "recurso de fato removido" -- sem distinguir os dois estados, `recursoOrfao` acendia o aviso "não está mais no catálogo" pra um recurso perfeitamente válido (ex. `gestao-demandas.kanban`) só porque o fetch ainda não tinha voltado, e submeter nessa janela reintroduzia o mesmo `modulo: null` do achado anterior -- agora por timing, não por remoção real (o fallback por prefixo também falha enquanto `modulos` está vazio). Corrigido com `catalogoCarregando` (`isLoading` de `useModulos()`): `recursoOrfao` só é considerado órfão quando o catálogo já carregou, o botão de submit fica desabilitado enquanto carrega, e `aoSubmeter` tem uma segunda checagem (defesa em profundidade, caso o form seja submetido de outro jeito antes do React re-renderizar o botão). Teste novo com uma Promise controlada manualmente pra simular a janela de carregamento.
- **Achado numa 5ª rodada de code review**: a correção acima (3ª rodada) só olhava `isLoading`, não `error` -- os dois vêm de `useModulos()`, mas quando o fetch de módulos falha (timeout, 5xx), o SWR volta `isLoading: false` com `data` undefined, deixando `recursos`/`modulos` em `[]` de forma *permanente* (não só numa janela curta), o mesmo estado que o código tratava como "carregado com sucesso e vazio". Corrigido combinando os dois em `catalogoIndisponivel` (`catalogoCarregando || !!catalogoComErro`), usado em todo lugar que antes só checava `catalogoCarregando`: `recursoOrfao`, o guard de `aoSubmeter` (com mensagem distinta pra erro vs. carregando) e o `disabled` do botão de submit. Teste novo mockando `listarModulos` rejeitado.
- **Achado numa 6ª rodada de code review**: `acoesDisponiveis` acessava `recursoAtual.acoes_suportadas.includes(...)` sem guarda -- `acoes_suportadas` é obrigatório só pro TypeScript, `listarModulos()` faz cast direto da resposta do axios, sem validação em runtime. Um recurso vindo de uma resposta com contrato quebrado (backend antigo, cache de cliente durante rollout) sem esse campo derrubava a página inteira de Administração com `TypeError` -- exatamente o que a mesma defesa (`?? []`) já evita hoje pro campo irmão, `recursos_permissao` (achado (1) acima). Corrigido com o mesmo `?? []`. Teste novo simulando o recurso com `acoes_suportadas: undefined` e selecionando-o.

Suíte completa do frontend em 417 testes, `tsc --noEmit`/`eslint` limpos.

### 7.12 STC-506 — Rota dev-only pra logar sem o Google OAuth localmente

✅ **Implementado e mergeado em `main` (PR #54).** Nova rota `GET /api/dev-login?email=...`, ativa só quando `NODE_ENV=development` -- existe porque testar pelo celular via IP da rede local esbarra no Google Console recusando IP cru como redirect URI, e testar via navegador automatizado não tem sessão Google real disponível.

- Reaproveita a mesma receita já provada em `e2e/auth.setup.ts` (forja o cookie de sessão do NextAuth com `encode()`/`AUTH_SECRET`), mas busca os tokens de um usuário já existente no backend de dev em tempo real (`DevLoginView`, backend STC-507) em vez de rodar offline via management command.
- Dupla trava: `NODE_ENV !== "development"` devolve 404 (não 403 -- não dá nenhum sinal de que a rota existe fora de dev), e o backend (`settings.DEBUG`) recusa de qualquer jeito mesmo se a rota vazasse pra produção por engano.
- **Achado em análise de falhas críticas**: um GET com efeito colateral (loga sozinho ao ser visitado) podia ser disparado às cegas por uma página de terceiro (`<img src="http://localhost:3000/api/dev-login?...">` já bastava) enquanto o servidor de dev estivesse de pé. Bloqueado verificando o header `Sec-Fetch-Site` -- só o valor explícito `"cross-site"` bloqueia (403); navegação direta (digitar a URL, favorito) ou link interno passam.
- Testado ao vivo pelo celular, sem esbarrar no bloqueio do Google Console.

### 7.13 STC-505 — Tabelas da Administração ilegíveis no mobile

✅ **Implementado e mergeado em `main` (PR #55).** Coluna "Pessoa"/"Nome" fixa (`sticky left-0`) nas 3 tabelas de Administração (`GerenciarUsuarios`, Permissões individuais, Tipos de documento) -- mesmo espírito do `sticky top-0` já usado no cabeçalho, agora também no eixo horizontal, pra não perder o contexto de qual linha é qual ao rolar. Testado ao vivo em celular real (Poco X7 Pro), não só emulador/headless.

- Fallback de rolagem vertical que faltava na aba "Usuários" (diferente de Catálogo de Legalização, que já tinha) -- as duas tabelas travavam a própria altura mesmo no mobile, sem scroll de página pra compensar.
- `AppShell.tsx`: `h-screen` (100vh) → `h-svh` -- achado real, sem relação direta com as tabelas: 100vh não desconta a barra de navegação do Android, cortando o rodapé de qualquer tela atrás dela; `h-dvh` corrigia o corte mas quebrava o gesto de rolar (recalcula em tempo real durante o scroll); `h-svh` resolve os dois. Mesmo fix em `app/docs/api/page.tsx`.
- **Ciclo fix → revert → refix, tudo no mesmo PR**: uma 1ª correção pro corte residual (listas maiores ainda cortavam por dentro) partiu de `overflow-y: visible` explícito -- não resolveu (o motor do navegador recomputa `overflow-y` de "visible" pra "auto" por especificação assim que `overflow-x: auto` está presente, CSS Overflow Module Level 3 §3.3, independente do valor declarado), então foi revertida. A correção de verdade: `flex-1` → `shrink-0` nas tabelas de "Perfil, unidade e setor" e "Permissões individuais" -- sem `flex-1`, a div deixa de ter altura definida pela cadeia flex (que virava scroll container vertical implícito, cortando a tabela dentro dela mesma com listas grandes, reproduzido injetando 30 linhas via DOM: `scrollHeight` 2547px preso a um `clientHeight` de 178px), tornando `overflow: auto` inofensivo. `TabelaTiposDocumento.tsx` não muda -- mobile ali mantém scroll interno de propósito (pedido explícito do usuário testando esta issue).
- **2 achados de code review automático, corrigidos com testes novos**: (1) nenhum teste das 3 tabelas mockava `useMediaQuery` pra cobrir o ramo mobile introduzido pelo fix -- nenhuma asserção quebraria se alguém reintroduzisse o `maxHeight`/`overflow-y-auto` incondicional que causou o bug original; corrigido nos 3 arquivos de teste. (2) os testes de regressão cobriam só o efeito colateral (altura não trava mais no mobile), nenhum cobria o fix central (coluna sticky) -- um teste por tabela checa `sticky`/`left-0` no cabeçalho e numa célula da coluna âncora.
- Removido o mecanismo de "sobra de altura" (`sobraPerfil`/`onSobraAltura`, `bonusPx` em `useAlturaSemLinhaCortada`) -- existia só pro modo mobile, mas com o fix acima deixando de aplicar `maxHeight` no mobile, o valor calculado nunca mais chegava a afetar o DOM em nenhum modo. Código morto removido.

### 7.14 STC-510 — Filtros/Selects de Unidade respeitam a rede OPEX vs. normal

✅ **Implementado e mergeado em `main` (PR #57).** Depende da STC-509 (backend): `Unidade` ganhou o campo `rede` (`"padrao"`/`"opex"`) e `/plataforma/unidades/` passou a aceitar `?rede=`.

- `useUnidades()`/`listarUnidades()` ganham parâmetro opcional `rede`, incluído na chave do SWR (mesmo padrão de `useSetores`) pra não colidir com a variante sem filtro no cache. Os 11 lugares que listam unidades passam a pedir `"padrao"` explicitamente -- comportamento de hoje preservado (nada muda visualmente até existir uma unidade `"opex"` cadastrada), só deixa de vazar unidades de Operações Especiais pras telas normais quando essas unidades passarem a existir. `PermissoesAdmin.tsx` continua sem filtro de propósito (só resolve nome de qualquer unidade que uma permissão aponte).
- **`KanbanFiltros.tsx`/`FormNovaDemanda.tsx` são exceção ao "sempre padrao"**: os dois já sabem qual Tipo de Gestão está ativo/selecionado, então a rede pedida acompanha esse tipo (`visibilidade_padrao` `"opex"` → unidades `"opex"`, senão `"padrao"`) -- achado testando ao vivo a aba "OPEX" do Kanban, que mostrava as filiais normais no filtro em vez das unidades de Operações Especiais.
- `VisibilidadePadrao` (frontend) ganha o valor `"opex"`, que faltava desde a STC-509 (só existia no backend).
- **Achado no code review**: `KanbanFiltros.tsx` e `FormNovaDemanda.tsx` implementam a mesma lógica, mas só o Kanban tinha teste de regressão -- o formulário é o caminho com mais risco (fica aberto enquanto o usuário troca de tipo de gestão, diferente da aba do Kanban, já fixada). Teste novo mocka `listarUnidades` devolvendo listas DIFERENTES por rede, provando que o Select de Unidade reflete de verdade a rede pedida ao trocar de tipo de gestão dentro do form.
