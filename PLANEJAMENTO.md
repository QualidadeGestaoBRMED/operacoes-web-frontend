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

---

## Pacote 1 — Infraestrutura e Configuração de Ambiente
**Datas:** 08/07 – 09/07 · 2 dias úteis

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
  - `next-auth`
  - `axios`
  - `swr` (ou `@tanstack/react-query`)
  - `react-hook-form`
  - `zod`
  - `@hookform/resolvers`
  - `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities`
  - `lucide-react`
  - dependências geradas pelo `shadcn/ui`

### 1.2 Deploy na Vercel

- Criar projeto na Vercel apontando para o repositório `operacoes-web-frontend`
- Framework preset: Next.js
- Build command: `npm run build`
- Output/Start: padrão da Vercel para Next.js
- Configurar variáveis de ambiente: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_API_URL`

---

## Pacote 2 — Autenticação e Controle de Acesso
**Datas:** 10/07 – 14/07 · 3 dias úteis

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

---

## Pacote 3 — Módulo de Demandas (Backend)
**Datas:** 15/07 – 21/07 · 5 dias úteis

> Pacote predominantemente backend. Ver `PLANEJAMENTO.md` do backend.
> No frontend: preparar o hook `useDemandas` e os tipos para que o Pacote 4 
> (Kanban) possa começar integrado desde o início.

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

### 4.2 Hub de Módulos

`src/app/hub/page.tsx` — cards de módulos:
- **Gestão de Demandas** (ativo — link para `/modulos/gestao-demandas`)
- Legalização, Gestão RH, Manutenção, Indicadores (badges "Em breve", desabilitados)

> ✅ **Adiantado e implementado (STC-164), com escopo maior que o descrito aqui.** Fica em `src/app/(app)/hub/page.tsx`. Diferenças:
> - Grade uniforme (todos os cards do mesmo tamanho, não um destaque maior), scrollável — mais módulos entram como novas linhas, sem redesenhar o layout.
> - Lista de módulos maior e ajustada: Gestão de Demandas, Legalização, Gestão RH, Arquitetura, Diário de Bordo, Gestão de Calibração de Equipamentos (substituindo "Manutenção"/"Indicadores" do exemplo original).
> - Card do módulo ativo mostra **estatísticas com cor de urgência** (ex.: "14 atrasadas" em âmbar), não só um número positivo — decisão tomada depois de comparar com a referência de "central de operações" que a gerente pediu.
> - Painel **"Ocorrências que precisam de decisão hoje"** no topo da página (`src/components/hub/OcorrenciasPanel.tsx`), cruzando os módulos ativos — não estava neste plano original.
> - Hoje tudo roda com dado mockado. O contrato real (`GET /api/modulos/{codigo}/resumo/`, por módulo — nunca centralizado) está documentado no Plano de Ação (seção 4) e no `PLANEJAMENTO.md` do backend (Pacote 3, seção 3.6). Trocar o mock pela chamada real é o que falta quando a STC-156 (models de Demanda) existir.

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
