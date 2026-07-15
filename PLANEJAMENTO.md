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
- `GET/POST /api/modulos/gestao-demandas/demandas/{id}/comentarios/`
- `GET/POST /api/modulos/gestao-demandas/demandas/{id}/anexos/`
- `GET /api/modulos/gestao-demandas/demandas/{id}/anexos/{anexo_id}/presigned-url/`
- `GET /api/modulos/gestao-demandas/demandas/{id}/historico/`

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

> ✅ **Backend concluído (STC-156)** — `demandas` app completo: models, serializers, ViewSets com RBAC, transições do Kanban, e `GET /api/modulos/gestao-demandas/resumo/` no formato exato que a Hub (STC-164) já espera. PR aberto, aguardando review do Tech Lead. Nada foi feito no frontend nesta issue (era 100% backend) — `useDemandas`, os tipos `Demanda`/`Comentario`/`Anexo`/etc. e a troca do mock do Hub pela chamada real seguem para o Pacote 4.

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

---

## Pacote 5 — Colaboração, Anexos e Auditoria
**Datas:** 28/07 – 30/07 · 3 dias úteis

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

### 5.3 Aba Anexos (`AnexoList.tsx`)

- Lista de arquivos: ícone por tipo (PDF, DOC, IMG), nome, tamanho, data, botão download
- Download: `GET /api/modulos/gestao-demandas/demandas/{id}/anexos/{anexo_id}/presigned-url/` → `window.open(url)`
- Upload: dropzone (`input type="file"` estilizado) + preview da fila
  - Tipos aceitos: PDF, DOC, DOCX, PNG, JPG, JPEG (máx 35 MB)
  - Submit: `POST /api/modulos/gestao-demandas/demandas/{id}/anexos/` multipart/form-data

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

### 5.5 Badge de Notificações

`NotificacaoBadge.tsx` na Topbar:
- Poll de `GET /api/plataforma/notificacoes/?lida=false` a cada 60s (SWR `refreshInterval`)
- Dropdown ao clicar: lista das últimas 10 notificações
- Cada item: ícone de tipo, título, tempo relativo, indicador se não lida
- Ao clicar no item: marcar como lida + navegar para a demanda

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
- [ ] Kanban rola horizontalmente entre colunas
- [ ] Formulário de nova demanda é utilizável
- [ ] Modal de detalhe mantém ações essenciais visíveis

### 6.2 Testes Automatizados (Playwright)

Fluxo principal end-to-end:
1. Login com conta Google de teste
2. Navegar para Gestão de Demandas
3. Criar demanda com todos os campos obrigatórios
4. Verificar aparição no Kanban (coluna Backlog)
5. Atribuir responsável
6. Mover para Em Andamento
7. Adicionar comentário
8. Fazer upload de anexo
9. Mover para Em Revisão (selecionando aprovador)
10. Mover para Concluído

### 6.3 Ajustes Pós-Homologação

- Priorizar por impacto: crítico (bloqueia uso) → médio (prejudica UX) → baixo (cosmético)
- Re-testar após cada correção
- Documentar issues que ficam em aberto para pós-entrega
