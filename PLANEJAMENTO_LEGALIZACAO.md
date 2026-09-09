# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Legalização (MP002)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Início proposto:** 25/08/2026 · **Entrega proposta:** 25/09/2026 · **Go-Live:** 28/09/2026
**Fonte:** `Plano de Ação - Legalização.md` (raiz do repositório da Plataforma) §3/§4/§7/§8, e os 6 mockups refinados em `docs/mockup_*legalizacao*.html` — este documento traduz os protótipos já validados visualmente em plano técnico de implementação.

> **Nasceu como plano prospectivo, sem nenhuma linha de código do módulo — não é mais o caso.** P3 (tipos/hooks, STC-377), P4.1 (Matriz Lista, STC-378), P4.2 (Matriz Mapa, STC-379), P4.3 (Detalhe do Documento, STC-380) e P4.7 (Administração do Catálogo, STC-415) já têm implementação real (STC-377/378/379 mergeadas; STC-380 com PR #35 e STC-415 com PR #34 abertas em revisão); as seções P3.1/P3.2/P4.1/P4.2/P4.3/P4.7 abaixo já foram atualizadas pra refletir o contrato real, não mais a especulação original. Os 6 mockups HTML estáticos continuam valendo como referência visual pro que falta (P4.4–P4.6).

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
│   └── useMovimentacaoProfissional.ts
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
```

**`useIndicadoresLegalizacao.ts` planejado aqui, removido na STC-379** (achado em
code review, PR #32): a ideia original era um hook próprio alimentando `GET
.../dashboard/indicadores/` pros cards de resumo do Mapa, mas esse endpoint só
agrupa por status literal, sem noção de "a vencer" — a STC-379 optou por
agregação 100% client-side (`legalizacaoMapa.ts`, ver P4.2 abaixo),
reaproveitando `useDocumentosLegalizacao()` sem filtro, sem endpoint dedicado
nenhum. O hook chegou a ser escrito na STC-377 mas nunca teve consumidor —
removido junto com `buscarIndicadoresLegalizacao`/`IndicadoresLegalizacao`
(`lib/legalizacao.ts`, `types/legalizacao.ts`).

---

## Pacote P4 — Interface Operacional
**Datas:** 10/09 – 17/09 · 6 dias úteis
**Status:** 🔄 Em andamento (P4.1, P4.2, P4.3 e P4.7 implementados — P4.3 com PR #35 aberta em revisão (7 rodadas de code review automático, todas corrigidas), P4.7 com PR #34 aberta em revisão; P4.4–P4.6 a iniciar)

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
- **Mapa não tem versão mobile — decisão de produto** (não estava no plano original nem no desenho de responsivo previamente cogitado pro Mapa, ver Fast-follow abaixo): em telas `<= 639px`, `MapaConformidade.tsx` redireciona pra `/modulos/legalizacao` (Lista) em vez de renderizar a grade; `ToggleMapaLista.tsx` fica `hidden sm:flex` nas duas telas (o toggle some inteiro, não só o link do Mapa). Cobre tanto quem navega pelo toggle quanto quem chega direto por um link salvo/compartilhado de uma célula do Mapa em mobile.

### P4.3 Detalhe do Documento — `mockup_detalhe_documento_legalizacao.html`

**Status:** ✅ Implementado (STC-380, PR #35 aberta em revisão — 7 rodadas de code review automático, todas corrigidas antes do próximo push). Componente real em `src/components/legalizacao/{DetalheDocumentoModal,ProcessoRenovacaoModal}.tsx`. Ajustes em relação ao plano original abaixo:

- Modal, `max-h-[88vh]` sem altura fixa — como planejado, mas a primeira versão implementada copiava `h-[85vh] max-h-[720px]` de `DetalheCard.tsx` (Gestão de Demandas) sem ajustar ao critério desta issue (achado em code review, corrigido).
- **Sem stepper de progresso** — só o badge de status, como planejado.
- Abas Evidências (só a vigente por padrão + ação explícita "Ver histórico de evidências") / Histórico (log cronológico) — como planejado. **Evidência vigente lida de `documento.evidencia_vigente`** (o FK denormalizado que o backend mantém sincronizado atomicamente pra esse fim, `legalizacao/models.py`), não de `EvidenciaRegulatoria.vigente` (flag por-item, de uma chamada separada) — achado em code review: as duas fontes podem divergir, o FK é a fonte de verdade. Esqueleto de carregamento dedicado nas duas abas (achado em code review: sem isso, "nenhum registro" aparecia por um instante enquanto a requisição ainda estava em voo, mesmo quando havia dados).
- "Reportar Movimentação Profissional" visível quando `tipo_documento.codigo` for CNES/dosimetria/CRM-RT (RN11) **e o status não for `nao_aplicavel`/`unidade_encerramento`** — o segundo critério não estava no plano original (achado em code review: os outros dois botões do grupo já escondiam nesses status, e o backend rejeita movimentação profissional neles via `STATUS_CORINGA_COM_JUSTIFICATIVA`). Só a visibilidade condicional está implementada aqui — o `onClick` é a STC-382.
- **Sem aba de comentários** — como planejado.
- Abre via deep link `?documento=<id>` — como planejado (lido uma vez no `useState` inicial de `MatrizConformidade.tsx`, sem depender do carregamento da Lista/Matriz por trás). É o alvo do clique no card espelho do Kanban de Gestão de Demandas (`Plano de Ação §4`, ver `backend/docs/PLANEJAMENTO_LEGALIZACAO.md` P3.5).
- **Dois botões de ação novos, não previstos nesta seção do plano original** — adicionados numa revisão de texto da issue (contra o mockup e o RF-009 da SRS) antes de começar a implementação:
  - "Marcar como Não aplicável" — reaproveita o `PATCH /documentos/{id}/` já existente, justificativa obrigatória.
  - "Registrar renovação" — **não chama o POST direto no clique.** A issue exige que o botão abra o modal de Processo de Renovação, por ser "o ponto de entrada" da STC-381 (achado em code review contra o texto literal da issue, corrigindo uma primeira versão que criava o processo direto). Abre `ProcessoRenovacaoModal.tsx` (novo componente): passo de confirmação, só cria o `ProcessoRenovacao` ao confirmar (POST já é o "iniciar", RF-009) e então mostra a seção "1. Solicitação" do mockup de Processo de Renovação — Protocolo/Conclusão ficam pra STC-381, que estende este mesmo componente. Escondido quando já existe um processo em curso (`em_andamento`/`protocolado` — achado em code review, o botão continuava visível e deixava criar um segundo processo pro mesmo documento).
- **Linha da Matriz (P4.1) ativada de verdade nesta issue** (antes só afordância visual). Acessível por teclado sem sobrescrever a semântica de tabela: `<tr>`/`<td>` mantêm seus papéis implícitos (`row`/`cell`) intactos, um `<button>` real dentro da célula Unidade é o único caminho de teclado — achado em code review: uma primeira versão usava `role="button"`/`tabIndex` na própria `<tr>`, o que sobrescrevia `role="row"` e quebrava a navegação por tabela de leitores de tela (a linha inteira virava um botão genérico, perdendo a associação célula↔cabeçalho).
- Aba Histórico revalida junto com o documento depois de "Marcar como Não aplicável"/"Registrar renovação" (achado em code review: as duas ações gravam `HistoricoRegulatorio` de verdade, mas só invalidavam a chave do documento — o registro da própria ação só aparecia depois de fechar e reabrir o modal).
- **Sem verificação em navegador real com login** (`chromium-cli` indisponível no ambiente, sem bypass de login OAuth) — verificado via `tsc`/lint/testes/build, e visualmente via RTL renderizado + `google-chrome --headless` (técnica usada pra achar o bug de largura do modal). O responsável do projeto testou ao vivo e pediu 2 rodadas de ajuste visual (largura do modal, cabeçalho, abas reais) antes de aprovar.

### P4.4 Processo de Renovação — `mockup_processo_renovacao_legalizacao.html`

**Já existe um começo desta tela**: `ProcessoRenovacaoModal.tsx` (STC-380, P4.3) nasceu como o ponto de entrada — cria o `ProcessoRenovacao` e mostra só a seção "1. Solicitação" (a única que já existe de verdade nesse momento). Esta issue estende o MESMO componente, não cria um novo: adiciona as seções 2 (Protocolo) e 3 (Conclusão) a partir de um processo já criado, e passa a ser reaberto (não só criado) a partir do documento enquanto o processo estiver `em_andamento`/`protocolado`.

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

### P4.7 Administração do Catálogo — `mockup` inexistente, fora da estimativa original de 24 dias

**Status:** ✅ Implementado (STC-415, PR #34 aberta em revisão — 2 rodadas de code review automático, a 2ª com 3 achados já corrigidos, ver `Plano de Ação §11`). Decidido numa sessão dedicada de planejamento (27/08/2026, `Plano de Ação §4`) — não fazia parte do escopo dos 6 mockups nem da estimativa de prazo já negociada (`Plano de Ação §8`). Motivado pela reunião de 26/08: Nathalya Almeida e Iara Martins montando o esqueleto de cada unidade manualmente (começando por Niterói, ~2h por unidade). Ajustes em relação ao plano original abaixo:

- **Não é uma rota nova, é uma aba dentro da tela "Administração" já existente** (`/admin/permissoes`, `components/admin/PermissoesAdmin.tsx`) — "Usuários" (já existia) e "Catálogo de Legalização" (novo, componente `components/admin/legalizacao/CatalogoLegalizacaoAdmin.tsx`), trocadas por um `Select` (não `Tabs`, como o resto da tela usa — trocado durante a implementação, achado de dogfooding: `Tabs` ficava apertado ao lado do título em telas médias). A aba fica sempre montada (`hidden` via CSS, não desmontagem condicional) pra não perder filtro/formulário em andamento ao trocar de aba e voltar — achado de code review próprio.
- **3 blocos, como planejado, com nomes reais**: `TabelaTiposDocumento.tsx` + `FormNovoTipoDocumento.tsx` (Bloco 1 — Tipos de Documento, categoria continua fixa nos 7 valores de `CategoriaDocumento`, sem tela de cadastro própria); `FormCadastrarDocumento.tsx` (Bloco 2 — Cadastrar documento na unidade); `FormNovaVersaoRegra.tsx` (Bloco 3 — "Corrigir regra existente": `RegraDocumento` é append-only, então não existe "editar regra", só criar versão nova e reaplicar no documento).
- **Cadastro em 2 passos no backend (regra, depois documento com `regra_aplicada` apontando pra ela), atômico do ponto de vista do usuário**: se o 2º passo falhar depois do 1º ter sucesso, o frontend desfaz a regra recém-criada (`excluirRegraDocumento`) em vez de deixar órfã — mesmo tratamento em "Cadastrar documento" e em "Corrigir regra existente". Achado de code review próprio, não estava no plano original.
- **Evidência com retry dedicado**: se só o upload falhar depois de regra+documento já criados com sucesso, um novo clique em "Cadastrar documento" reenvia só o arquivo, sem tentar recriar nada.
- **Filtragem proativa**: o seletor de Tipo de documento em "Cadastrar documento" já esconde tipos que a unidade escolhida já tem cadastrado, em vez de deixar escolher e falhar só no submit.
- **"Vencido" incluído como 5ª opção de status inicial**, além dos 4 do critério de aceite original (Não iniciado/Em andamento/Protocolado/Regular) — decisão deliberada: ao montar o esqueleto de uma unidade já existente, é comum que um documento já esteja vencido no dia do cadastro. Exige `validade` no client (mesma regra do backend).
- **Marcação explícita de "Não aplicável"** (não ausência silenciosa) e **evidência opcional dentro do mesmo formulário** (não etapa obrigatória separada) — como planejado.
- **RBAC resolvido**: o plano original deixava em aberto "quem tem acesso de escrita a essa tela" — resolvido durante o dogfooding (08/09/2026): a tela é admin-only, mas "Admin é só-leitura em `documentos/`" (STC-372) deixava o próprio dono da tela sem conseguir usá-la. `PodeEscreverDocumentoUnidade` (`legalizacao/permissions.py`, backend, commit `36b2617`, direto em `main` com aval explícito do responsável do projeto) libera Admin em 3 ações estreitas: `create` (cadastro inicial), `partial_update` só quando o payload mexe exclusivamente em `regra_aplicada`, e `evidencias`. Editar status/validade/justificativa de um documento já em andamento continua exclusivo de Setor Legalização/Unidade — não é bypass geral da STC-372. Detalhe completo em `backend/docs/PLANEJAMENTO_LEGALIZACAO.md`.
- **Pendência aberta, achada durante essa correção de RBAC**: o carve-out de `evidencias` em `PodeEscreverDocumentoUnidade` libera Admin a fazer POST de evidência em **qualquer** documento, a qualquer momento — não só no cadastro inicial que motivou a exceção. Ainda não corrigido (é backend, fora do escopo da revisão de código desta issue, que cobriu só o frontend) — ver `Plano de Ação §9`.
- **Cobertura de teste**: suíte RTL dos 3 blocos, incluindo os fluxos de rollback/retry acima; suíte completa do frontend em 298 testes depois da correção dos achados de code review.
- **Ponto de contato fora de `legalizacao/`, ainda não verificado nesta issue**: o card espelho travado contra arraste manual (backend P3.5) precisa de um ajuste correspondente no Kanban do MP001 (`components/gestao-demandas/KanbanBoard`/`DemandaCard`) — não foi tocado por esta issue, que mexeu só na tela de Administração, não no Kanban.

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
- **Modo responsivo/mobile** — a Lista já tem tratamento mobile (STC-378): `MatrizFiltros.tsx` colapsa os selects num `Popover` abaixo de 640px, `MatrizTable.tsx` rola na horizontal (`min-w-[820px]`, mesmo padrão de `GerenciarUsuarios.tsx`). O Mapa, por decisão de produto (STC-379), **não** ganhou layout mobile — em vez disso fica indisponível em telas estreitas, redirecionando pra Lista (ver P4.2 acima). O desenho antes cogitado pro Mapa (cards fixos + grade rolável com coluna "Unidade" congelada, mesmo espírito do Kanban mobile) foi descartado — fica só como referência histórica em `projeto_responsivo_mapa_legalizacao.md`, caso a decisão mude no futuro. Segue fast-follow: os modais ainda não implementados (Detalhe, Renovação, Movimentação Profissional, P4.3–P4.5) não têm consideração de mobile nenhuma ainda. Pré-requisito ainda sem solução, relevante se algum dia o Mapa (ou outro módulo do Atlas) ganhar mobile de verdade: nenhum módulo tem hoje um substituto real de navegação pra quando a sidebar desaparece em telas estreitas.
