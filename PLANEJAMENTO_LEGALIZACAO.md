# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Legalização (MP002)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Início proposto:** 25/08/2026 · **Entrega proposta:** 25/09/2026 · **Go-Live:** 28/09/2026
**Fonte:** `Plano de Ação - Legalização.md` (raiz do repositório da Plataforma) §3/§4/§7/§8, e os 6 mockups refinados em `docs/mockup_*legalizacao*.html` — este documento traduz os protótipos já validados visualmente em plano técnico de implementação.

> **Plano prospectivo — nenhuma linha de código deste módulo existe ainda.** Os 6 mockups HTML estáticos já passaram por uma rodada de refinamento completa (design, remoção de sinais de IA, correção de bugs de layout) e servem de referência visual direta pra esta implementação — não é preciso redesenhar nada, só traduzir pra componentes React reais.

---

## O que já está pronto e não entra neste plano

Os pacotes de Infraestrutura e Autenticação do MP001 (`frontend/PLANEJAMENTO.md`, Pacotes 1 e 2) são **100% reaproveitados**: mesmo projeto Next.js, mesmo NextAuth com Google Provider, mesmo middleware de proteção de rotas, mesmo API client autenticado, mesmo layout base (sidebar/topbar/Hub de Módulos). O item "Legalização" da sidebar já existe e já está marcado como `em breve` em todos os mockups — só precisa deixar de apontar pra lugar nenhum.

---

## Visão Geral da Estrutura de Diretórios (novidade em relação ao MP001)

```
frontend/src/
├── app/(app)/modulos/
│   ├── gestao-demandas/         → já existe, sem mudança
│   └── legalizacao/             → NOVO
│       ├── page.tsx                    → Matriz de Conformidade (Lista) — mockup_matriz_legalizacao.html
│       ├── mapa/page.tsx                → Matriz de Conformidade (Mapa) — mockup_matriz_legalizacao_mapa.html
│       └── biblioteca/page.tsx          → Biblioteca de Documentos — FAST-FOLLOW, fora do lançamento (P4)
├── components/legalizacao/
│   ├── MatrizTable.tsx                  → tabela + filtros da Lista
│   ├── MatrizMapaGrid.tsx               → heatmap unidade × categoria (CSS Grid, cabeçalho fixo fora do scroll)
│   ├── ResumoCards.tsx                  → 4 cards de estatística (Vencidos/A vencer/Em andamento/Sem pendência)
│   ├── DetalheDocumentoModal.tsx        → mockup_detalhe_documento_legalizacao.html (sem stepper — não é Kanban)
│   ├── ProcessoRenovacaoModal.tsx       → mockup_processo_renovacao_legalizacao.html
│   ├── MovimentacaoProfissionalModal.tsx → mockup_movimentacao_profissional_legalizacao.html (toggle Saída/Entrada)
│   └── BibliotecaDocumentos.tsx         → FAST-FOLLOW (painel de pré-visualização sob demanda)
├── hooks/
│   ├── useDocumentosLegalizacao.ts      → matriz, filtros, detalhe
│   ├── useProcessoRenovacao.ts
│   ├── useMovimentacaoProfissional.ts
│   └── useIndicadoresLegalizacao.ts     → cards de resumo do Mapa
├── types/
│   └── legalizacao.ts                   → NOVO
```

---

## Pacote P3 (equivalente) — Tipos e Hooks
**Datas:** dentro da janela 01/09 – 09/09, em paralelo ao backend (P3)
**Status:** ⏳ A iniciar

### P3.1 Tipos TypeScript

```ts
export type StatusDocumento =
  | 'regular' | 'nao_aplicavel' | 'nao_iniciado'
  | 'em_andamento' | 'protocolado' | 'vencido' | 'unidade_encerramento';

export type CategoriaDocumento =
  | 'regularizacao' | 'registros_tecnicos' | 'capacitacao'
  | 'infraestrutura' | 'equipamentos' | 'programas' | 'residuos';

export interface TipoDocumento {
  id: number;
  codigo: string;
  nome: string;
  categoria: CategoriaDocumento;
  areaResponsavel: 'legalizacao' | 'coordenacao';  // ⚠️ fonte não confiável, tratar como provisório — ver backend/docs/PLANEJAMENTO_LEGALIZACAO.md P2.1 e Plano de Ação §9
}

export interface RegraDocumento {
  id: number;
  tipoDocumentoId: number;
  unidade: Unidade;               // obrigatória — regra é por documento E por clínica, não existe regra "geral"
  antecedenciaDias: number;
  periodicidadeMeses: number | null;
  janelaDiaInicio: number | null;
  janelaDiaFim: number | null;
  criticidade: 'baixa' | 'media' | 'alta';
  vigenteAPartir: string;
  ativa: boolean;
  geraCardDemanda: boolean;       // controla se o alerta desse documento nessa clínica gera card espelho no Kanban — ver seção nova "Administração do Catálogo" abaixo
}

export interface DocumentoUnidade {
  id: number;
  tipoDocumento: TipoDocumento;
  unidade: Unidade;                 // reaproveita o tipo já existente de plataforma
  status: StatusDocumento;
  validade: string | null;
  justificativaExcecao: string;
  responsaveis: ResponsavelDocumento[];
  criticidade: 'baixa' | 'media' | 'alta' | null;
  prazoTexto: string;                // "vencido há 12 dias" / "em 8 dias" — calculado no backend, não no frontend
}

export interface AlertaRegulatorio {
  id: number;
  documentoUnidadeId: number;
  imediato: boolean;
}

export interface EvidenciaRegulatoria {
  id: number;
  arquivoUrl: string;                // URL assinada, mesmo padrão do MP001
  nomeOriginal: string;
  vigente: boolean;
  emitidoEm: string | null;
}
```

### P3.2 Hooks de Dados

```ts
// useDocumentosLegalizacao.ts — SWR, mesmo padrão de useDemandas.ts do MP001
export function useDocumentosLegalizacao(filtros: FiltrosMatriz) { ... }
export function useDocumentoLegalizacao(id: number) { ... }
export function useIndicadoresLegalizacao() { ... }   // cards de resumo do Mapa
```

---

## Pacote P4 — Interface Operacional
**Datas:** 10/09 – 17/09 · 6 dias úteis
**Status:** ⏳ A iniciar

Base visual: os 6 mockups já refinados. Trabalho real aqui é integração com API + estado, não desenho.

### P4.1 Matriz de Conformidade (Lista) — `mockup_matriz_legalizacao.html`

- Rota `/modulos/legalizacao`.
- Tabela com filtros de interface: unidade, documento, status, responsável, criticidade, prazo (RF07) — mesmo padrão de filtro do Kanban de Gestão de Demandas (já citado como referência na SRS, §3.1 "Regras de Interface").
- Linha clicável → abre `DetalheDocumentoModal`.
- Coluna "Alerta" reflete `AlertaRegulatorio.imediato` quando aplicável.

### P4.2 Matriz de Conformidade (Mapa) — `mockup_matriz_legalizacao_mapa.html`

- Rota `/modulos/legalizacao/mapa`.
- `ResumoCards` (4 cards fixos) + `MatrizMapaGrid` (heatmap 12 unidades × 7 categorias).
- **Estrutura de grid confirmada no mockup**: cabeçalho de categorias é um bloco separado, fora da área de scroll — **não usar `<table>` com `position: sticky` no `<th>`**, esse desenho já se mostrou bugado (vazamento de conteúdo através do `border-spacing` ao rolar, corrigido nos mockups substituindo por dois CSS Grids irmãos). Reaproveitar exatamente essa estrutura na versão React, não reintroduzir o bug.
- Clique numa célula → navega pra Lista com os filtros de unidade+categoria aplicados via querystring.
- Unidades: as 12 reais da rede (Angra dos Reis, Barra da Tijuca, Cabo Frio, Campos, Duque de Caxias, Macaé, Niterói, Nova Iguaçu, Rio de Janeiro (PV), Santos, São Paulo, Vitória) — vêm da API, não hardcoded (isso é só o exemplo do mockup).

### P4.3 Detalhe do Documento — `mockup_detalhe_documento_legalizacao.html`

- Modal, `max-height: 88vh` (não `height` fixo — bug de espaço vazio já corrigido no mockup, não reintroduzir).
- **Sem stepper de progresso** — decisão explícita, não é um Kanban, mostrar só o status atual (badge).
- Abas Evidências (arquivos anexados, só a vigente por padrão + ação explícita "ver histórico") / Histórico (log cronológico).
- Botão "Reportar Movimentação Profissional" visível condicionalmente quando `tipoDocumento` for CRM/RT, CNES ou dosimetria.
- **Sem aba de comentários** — decisão explícita (não faz sentido comentário em registro de documento).
- **Precisa abrir via deep link** (rota/query param, ex.: `?documento=123`) — é o alvo do clique no card espelho do Kanban de Gestão de Demandas (`Plano de Ação §4`, ver `backend/docs/PLANEJAMENTO_LEGALIZACAO.md` P3.5). Card não navega pra Lista/Matriz, abre este modal direto.

### P4.4 Processo de Renovação — `mockup_processo_renovacao_legalizacao.html`

- Modal, 3 seções: Solicitação (leitura) / Protocolo (**opcional**, texto explícito "preencha só se houver órgão envolvido") / Conclusão.
- **Conclusão não é bloqueada por Protocolo** — bug de lock corrigido no mockup (a tabela de transição permite `Em andamento/Protocolado → Regular`, os dois são origem válida). Não reintroduzir o lock.
- Dois botões de ação independentes: "Salvar protocolo" / "Concluir renovação".

### P4.5 Reportar Movimentação Profissional — `mockup_movimentacao_profissional_legalizacao.html`

- Modal com toggle Saída/Entrada — **estado dinâmico via CSS custom property** (`--mode-color`), não duas telas separadas: cor, ícone, texto do callout e label do botão trocam juntos.
- Atenção ao bug já corrigido no mockup: o toggle deve casar pelo atributo `data-modo`, não por `textContent` (acentuação "Saída" quebrava a comparação direta).
- Texto do callout muda de verdade entre os dois modos (saída → "muda pra Vencido"; entrada → menciona RN12/dosímetro), não é texto estático.

### P4.6 Biblioteca de Documentos — FAST-FOLLOW, fora do lançamento (P4)

- `mockup_biblioteca_documentos_legalizacao.html` já está pronto e refinado, mas **fica de fora desta fase** — corte de escopo explícito (Plano de Ação §8), não bloqueia P4.6 nem o Go-Live.
- Quando entrar: painel de pré-visualização nasce só ao clicar num documento (não reservar espaço vazio permanentemente); clique de novo no mesmo documento fecha; lista ocupa 100% da largura quando nada está selecionado.

### P4.7 Administração do Catálogo — NOVO, sem mockup ainda, fora da estimativa original de 24 dias

**Decidido numa sessão dedicada de planejamento (27/08/2026, `Plano de Ação §4`)** — não fazia parte do escopo dos 6 mockups nem da estimativa de prazo já negociada (`Plano de Ação §8`). Motivado pela reunião de 26/08: Nathalya Almeida e Iara Martins vão montar o esqueleto de cada unidade manualmente (começando por Niterói, ~2h por unidade) — o cadastro deixa de ser uma tela de manutenção ocasional e vira ferramenta de uso pesado.

- **Evolui a tela "Administração" já existente** (`app/(app)/admin/permissoes/page.tsx`, `components/admin/PermissoesAdmin.tsx`) — não é uma rota nova isolada nem um Django Admin, é a mesma tela ganhando um cadastro novo. Nome de rota/aba a definir na implementação (ex.: `app/(app)/admin/catalogo-legalizacao/`).
- **Categoria continua fixa** (os 7 valores de `CategoriaDocumento`, sem tela de cadastro — confirmado suficiente cruzando planilha real + estrutura de pastas, `Plano de Ação §4`).
- **Cadastro de Tipo de Documento** (`TipoDocumento`): global, reutilizável entre unidades — nome, categoria (dropdown fixo), área responsável, exigências (validade/protocolo/evidência). Sem tela nova de "categoria".
- **Cadastro de Regra por Clínica** (`RegraDocumento`): a parte com mais nuance — precisa deixar claro na UI que **cada unidade tem sua própria regra**, sem herança nem valor "padrão" implícito (nada de pré-preencher achando que é herança — é só um valor sugerido, sempre salvo explicitamente por clínica). Campos: unidade, antecedência em dias, janela (quando aplicável), criticidade, e o toggle `geraCardDemanda` (default ligado).
- **Fluxo de cadastro num único formulário, evidência opcional dentro dele** — não duas etapas obrigatórias separadas. Ao cadastrar o esqueleto de um documento pra uma unidade, dá pra já anexar a evidência se ela estiver em mãos, mas não é obrigatório (muitos documentos reais estão "em andamento"/protocolo pendente, sem arquivo final disponível no momento do cadastro — confirmado na planilha oficial de controle).
- **Marcação explícita de "Não aplicável"** (não ausência silenciosa) — ao revisar um tipo de documento pra uma unidade que não se aplica, marca explicitamente com justificativa (`DocumentoUnidade.Status.NAO_APLICAVEL`, já existe no backend), em vez de simplesmente pular. Fecha, na prática, a pendência antiga da matriz de aplicabilidade nunca validada.
- **Cuidado de UX derivado da tensão de RBAC** (ver `backend/docs/PLANEJAMENTO_LEGALIZACAO.md` P3.3): quem efetivamente vai ter acesso de escrita a essa tela (Admin Q&G, Admin Operações, ou os dois) ainda não está resolvido — não travar a tela numa suposição de permissão antes disso ficar claro.
- **Ponto de contato fora de `legalizacao/`**: o card espelho travado contra arraste manual (backend P3.5) precisa de um ajuste correspondente no Kanban do MP001 (`components/gestao-demandas/KanbanBoard`/`DemandaCard`, nomes a confirmar) — UI precisa reconhecer que um card vinculado a documento regulatório não aceita drag-and-drop livre (feedback visual/toast quando a tentativa é rejeitada pelo backend). Não é trabalho de `legalizacao/`, mas é dependência real pro P3.5 funcionar de ponta a ponta.

---

## Pacote P6 — Testes e Homologação
**Datas:** 23/09 – 25/09 · 3 dias úteis
**Status:** ⏳ A iniciar

- Verificação visual e funcional manual das 5 telas do lançamento, golden path + casos de borda (documento "Não aplicável" sem justificativa deve bloquear confirmação; matriz com as 12 unidades reais carregando).
- **Suíte completa de testes automatizados (Playwright E2E) fica fast-follow** — mesmo padrão que o MP001 seguiu de fato (a suíte E2E dele, STC-216, só veio no Pacote 7, bem depois do prazo "oficial").

---

## Pacote P7 — Go-Live
**Data:** 28/09/2026 · 1 dia útil
**Status:** ⏳ A iniciar

- Deploy real na Vercel — mesmo projeto do MP001, sem serviço novo.
- Item "Legalização" da sidebar deixa de ficar `em breve`.

---

## Fast-follow (pós Go-Live, sem prazo definido)

- Tela Biblioteca de Documentos (P4.6 acima).
- Suíte completa de testes automatizados/E2E.
- **Modo responsivo/mobile** — nenhuma tela do módulo tem breakpoint hoje. Desenho já decidido especificamente pro Mapa (cards de resumo fixos + grade rolável na horizontal com a coluna "Unidade" congelada, mesmo espírito do board Kanban mobile que já está em produção) — ver memória de sessão `projeto_responsivo_mapa_legalizacao.md`, reaproveitar em vez de redesenhar. Pré-requisito ainda sem solução: nenhum módulo do Atlas (nem o MP001) tem hoje um substituto real de navegação pra quando a sidebar desaparece no mobile.
