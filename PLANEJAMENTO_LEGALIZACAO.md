# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Legalização (MP002)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Início proposto:** 25/08/2026 · **Entrega proposta:** 25/09/2026 · **Go-Live:** 28/09/2026
**Fonte:** `Plano de Ação - Legalização.md` (raiz do repositório da Plataforma) §3/§4/§7/§8, e os 6 mockups refinados em `docs/mockup_*legalizacao*.html` — este documento traduz os protótipos já validados visualmente em plano técnico de implementação.

> **Nasceu como plano prospectivo, sem nenhuma linha de código do módulo — não é mais o caso.** P3 (tipos/hooks, STC-377), P4.1 (Matriz Lista, STC-378) e P4.2 (Matriz Mapa, STC-379) já têm implementação real (todas com PR aberto); as seções P3.1/P3.2/P4.1/P4.2 abaixo já foram atualizadas pra refletir o contrato real, não mais a especulação original. Os 6 mockups HTML estáticos continuam valendo como referência visual pro que falta (P4.3 em diante).

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
│   ├── MatrizConformidade.tsx           → orquestrador da Lista (STC-378): estado de filtro/busca/ordenação
│   ├── MatrizFiltros.tsx                → barra de filtros da Lista (unidade/documento/categoria/status/responsável/criticidade/prazo)
│   ├── MatrizTable.tsx                  → tabela + legenda de status da Lista
│   ├── MapaConformidade.tsx             → orquestrador do Mapa (STC-379): busca documentos+unidades, agrega grade+resumo
│   ├── ToggleMapaLista.tsx              → segmented control Mapa/Lista (rotas reais via <Link>, não Tabs client-side) — compartilhado pelas duas telas, com "dica" de instrução opcional só no Mapa
│   ├── MatrizMapaGrid.tsx               → heatmap unidade × categoria (CSS Grid, cabeçalho fixo fora do scroll) + legenda de buckets
│   ├── ResumoCards.tsx                  → 4 cards de estatística (Vencidos/A vencer/Em andamento/Sem pendência)
│   ├── DetalheDocumentoModal.tsx        → mockup_detalhe_documento_legalizacao.html (sem stepper — não é Kanban)
│   ├── ProcessoRenovacaoModal.tsx       → mockup_processo_renovacao_legalizacao.html
│   ├── MovimentacaoProfissionalModal.tsx → mockup_movimentacao_profissional_legalizacao.html (toggle Saída/Entrada)
│   └── BibliotecaDocumentos.tsx         → FAST-FOLLOW (painel de pré-visualização sob demanda)
├── hooks/
│   ├── useDocumentosLegalizacao.ts      → matriz, filtros, detalhe (reaproveitado sem filtro nenhum pelo Mapa — grade/resumo são agregados no cliente)
│   ├── useProcessoRenovacao.ts
│   ├── useMovimentacaoProfissional.ts
│   └── useIndicadoresLegalizacao.ts     → cards de resumo do Mapa
├── lib/
│   ├── legalizacaoMatriz.ts             → cores/labels/prazo/ordenação da Lista
│   └── legalizacaoMapa.ts               → agregação client-side unidade×categoria (bucket por célula, resumo de KPIs) — NOVO (STC-379)
├── types/
│   └── legalizacao.ts                   → NOVO
```

---

## Pacote P3 (equivalente) — Tipos e Hooks
**Datas:** dentro da janela 01/09 – 09/09, em paralelo ao backend (P3)
**Status:** ✅ Implementado (STC-377, PR aberto) -- shapes abaixo atualizados pra bater com o
contrato real dos serializers do backend (a versão anterior desta seção era especulativa,
escrita antes de qualquer código do módulo existir, e divergia em vários pontos: camelCase
em vez de snake_case, `prazoTexto` que não existe em nenhum serializer, `criticidade` como
campo direto de `DocumentoUnidade` quando só existe aninhado em `regra_aplicada`). Fonte da
verdade real: `src/types/legalizacao.ts` e `src/lib/legalizacaoMatriz.ts`.

### P3.1 Tipos TypeScript

```ts
export type StatusDocumento =
  | 'regular' | 'nao_aplicavel' | 'nao_iniciado'
  | 'em_andamento' | 'protocolado' | 'vencido' | 'unidade_encerramento';

export type CategoriaDocumento =
  | 'regularizacao' | 'registros_tecnicos' | 'capacitacao'
  | 'infraestrutura' | 'equipamentos' | 'programas' | 'residuos';

export type AreaResponsavelDocumento = 'legalizacao' | 'coordenacao';

export interface TipoDocumentoRegulatorio {
  id: number;
  codigo: string;
  nome: string;
  categoria: CategoriaDocumento;
  area_responsavel: AreaResponsavelDocumento;
  setor_apoio: string;
  exige_validade: boolean;
  exige_protocolo: boolean;
  exige_evidencia: boolean;
  ativo: boolean;
  created_at: string;
}

export type Criticidade = 'baixa' | 'media' | 'alta';

// tipo_documento/unidade vêm como ID cru (número), não aninhados -- só
// quando esta interface aparece embutida em DocumentoUnidade.regra_aplicada
// (RegraDocumentoSerializer real não aninha os dois).
export interface RegraDocumento {
  id: number;
  tipo_documento: number;
  unidade: number;                // obrigatória — regra é por documento E por clínica, não existe regra "geral"
  antecedencia_dias: number;
  periodicidade_meses: number | null;
  janela_dia_inicio: number | null;
  janela_dia_fim: number | null;
  criticidade: Criticidade;
  vigente_a_partir: string;
  ativa: boolean;
  gera_card_demanda: boolean;     // controla se o alerta desse documento nessa clínica gera card espelho no Kanban — ver seção nova "Administração do Catálogo" abaixo
  created_at: string;
}

export interface ResponsavelDocumento {
  id: number;
  usuario: Usuario;
  principal: boolean;
  created_at: string;
}

// criticidade NÃO é campo direto aqui -- só existe via regra_aplicada?.criticidade
// (achado real: DocumentoUnidadeReadSerializer não expõe criticidade solta).
// evidencia_vigente vem como ID cru (number | null), FK não aninhada nesse serializer.
export interface DocumentoUnidade {
  id: number;
  tipo_documento: TipoDocumentoRegulatorio;
  unidade: Unidade;                 // reaproveita o tipo já existente de plataforma
  status: StatusDocumento;
  justificativa_excecao: string;
  validade: string | null;
  evidencia_vigente: number | null;
  regra_aplicada: RegraDocumento | null;
  responsaveis: ResponsavelDocumento[];
  created_at: string;
  updated_at: string;
}

// prazo ("vencido há 12 dias" / "em 8 dias") é calculado no FRONTEND (não no
// backend, que não expõe esse campo em nenhum serializer real) -- ver
// prazoDocumento()/diasParaPrazo() em src/lib/legalizacaoMatriz.ts.

// 100% leitura -- nasce só pela varredura diária ou pela movimentação
// profissional (imediato=true). Endpoint paginado (STC-398).
export interface AlertaRegulatorio {
  id: number;
  documento_unidade: DocumentoUnidade;
  ciclo_referencia: string;
  antecedencia_usada_dias: number;
  criticidade: Criticidade | '';  // pode vir vazio -- blank=True no model, formato de escalonamento ainda não definido
  imediato: boolean;
  status_tratamento: string;
  data_geracao: string;
}

export interface EvidenciaRegulatoria {
  id: number;
  usuario: Usuario;
  arquivo: string;                // não "arquivoUrl" -- esse é o nome real do campo
  nome_original: string;
  tamanho_bytes: number;
  vigente: boolean;
  emitido_em: string | null;
  validade_comprovada: string | null;
  processo_renovacao: number | null;
  created_at: string;
}
```

### P3.2 Hooks de Dados

```ts
// useDocumentosLegalizacao.ts — SWR, mesmo padrão de useDemandas.ts/useResumoDemandas.ts do MP001
export function useDocumentosLegalizacao(
  filtros?: DocumentoUnidadeFiltros,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) { ... }
export function useDocumentoLegalizacao(id: number | null) { ... }

// useIndicadoresLegalizacao.ts — arquivo próprio, não junto do de cima
// (mesma separação de useResumoDemandas.ts vs useDemandas.ts no MP001)
export function useIndicadoresLegalizacao(opcoes?: { pausado?: boolean }) { ... }   // cards de resumo do Mapa
```

---

## Pacote P4 — Interface Operacional
**Datas:** 10/09 – 17/09 · 6 dias úteis
**Status:** ⏳ Em andamento (P4.1 e P4.2 implementados, P4.3–P4.7 a iniciar)

Base visual: os 6 mockups já refinados. Trabalho real aqui é integração com API + estado, não desenho.

### P4.1 Matriz de Conformidade (Lista) — `mockup_matriz_legalizacao.html`

**Status:** ✅ Implementado (STC-378, PR aberto) — componente real em
`src/components/legalizacao/{MatrizConformidade,MatrizFiltros,MatrizTable}.tsx`. Ajustes em
relação ao plano original abaixo:

- Rota `/modulos/legalizacao`.
- Tabela com filtros de interface: unidade, documento, status, responsável, criticidade, prazo (RF07) — mesmo padrão de filtro do Kanban de Gestão de Demandas (já citado como referência na SRS, §3.1 "Regras de Interface").
- **Linha clicável ainda não abre nada** — é só afordância visual por enquanto. `DetalheDocumentoModal` é a P4.3/STC-380, ainda não implementada.
- **Coluna "Alerta" ficou de fora desta entrega** — mostrar `AlertaRegulatorio.imediato` por linha exigiria buscar todas as páginas do endpoint de alertas (paginado desde STC-398) e cruzar com cada documento, fora do escopo original da STC-378. Fica pra uma issue própria.
- **Busca por texto adicionada** (não estava no plano original): client-side, sobre a lista já carregada — o endpoint de documentos não pagina nem tem `SearchFilter`.
- **Ordenação por coluna clicável adicionada** (não estava no plano original): motor genérico em `src/lib/ordenacao.ts`, reaproveitável por qualquer tabela futura do Atlas.
- Toggle Mapa/Lista do mockup: implementado junto com a P4.2 (`ToggleMapaLista.tsx`, compartilhado pelas duas telas) — ver abaixo.

### P4.2 Matriz de Conformidade (Mapa) — `mockup_matriz_legalizacao_mapa.html`

**Status:** ✅ Implementado (STC-379, PR aberto) — componente real em
`src/components/legalizacao/{MapaConformidade,MatrizMapaGrid,ResumoCards,ToggleMapaLista}.tsx` +
`src/lib/legalizacaoMapa.ts`. Ajustes em relação ao plano original abaixo:

- Rota `/modulos/legalizacao/mapa`.
- `ResumoCards` (4 cards fixos) + `MatrizMapaGrid` (heatmap unidade × categoria).
- **Estrutura de grid confirmada no mockup**: cabeçalho de categorias é um bloco separado, fora da área de scroll — **não usar `<table>` com `position: sticky` no `<th>`**, esse desenho já se mostrou bugado (vazamento de conteúdo através do `border-spacing` ao rolar, corrigido nos mockups substituindo por dois CSS Grids irmãos). Reaproveitada exatamente essa estrutura na versão React (dois grids irmãos com a mesma `grid-template-columns`), sem reintroduzir o bug.
- Clique numa célula → navega pra Lista com os filtros de unidade+categoria aplicados via querystring (`?unidade=<id>&categoria=<categoria>`); células "pendente" (sem documento cadastrado) não são clicáveis.
- **Agregação 100% client-side** (não estava explícito no plano original): `DocumentoUnidadeViewSet` não pagina, então o Mapa reaproveita `useDocumentosLegalizacao()` sem filtro nenhum (lista completa) e calcula a grade (bucket por célula unidade×categoria, prioridade vencido > atenção > andamento > encerramento > regular) e o resumo dos 4 cards no cliente, em `lib/legalizacaoMapa.ts` — mesmo espírito da Lista (STC-378), sem endpoint novo no backend.
- **Bucket "atenção" funde dois motivos do mockup** (status `protocolado` OU prazo de validade próximo do vencimento) num rótulo só — decisão registrada em comentário no código: decidir qual dos dois exibir por célula exigiria rastrear qual documento específico disparou o bucket, não só a contagem agregada.
- **Legenda de cores adicionada** (não estava no plano original, achado em review de UX própria) — sem ela, "Atenção" sozinho numa célula não deixava óbvio que é o mesmo conceito do card "A vencer / Protocolado" lá em cima.
- **Texto de instrução adicionado ao lado do toggle** (não estava no plano original), só na visão Mapa: "Panorama por unidade e categoria regulatória · clique numa célula pra ver a lista filtrada" — texto do próprio mockup, que não tinha sido migrado na primeira versão da tela.
- **Cores das células seguem a mesma paleta Tailwind pura já usada em `COR_STATUS_BADGE` (Lista)**, não os tokens de marca (`secondary`/`destructive`) — decisão preexistente do módulo (severidade de status fica fora dos tokens de marca, reservados pro chrome da UI). Os 4 cards de resumo usam a mesma cor, com fundo tingido a 10% (mesmo padrão visual do `ResumoCards` de Gestão de Demandas), pra reforçar a leitura entre os cards e a grade abaixo.
- Unidades: as 12 reais da rede (Angra dos Reis, Barra da Tijuca, Cabo Frio, Campos, Duque de Caxias, Macaé, Niterói, Nova Iguaçu, Presidente Vargas, Santos, São Paulo, Vitória) — vêm da API (`useUnidades()`), não hardcoded. Das 12, só Niterói/Presidente Vargas/Vitória são as unidades piloto reais já em produção (`backend/plataforma/migrations/0003_seed_unidades.py`); as outras 9 foram cadastradas em ambiente local pra ambientar o teste da tela com o mesmo volume do mockup, replicando os nomes reais das clínicas da rede.

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
