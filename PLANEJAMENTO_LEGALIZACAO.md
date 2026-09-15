# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Legalização (MP002)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Início proposto:** 25/08/2026 · **Entrega proposta:** 25/09/2026 · **Go-Live:** 28/09/2026
**Fonte:** `Plano de Ação - Legalização.md` (raiz do repositório da Plataforma) §3/§4/§7/§8, e os 6 mockups refinados em `docs/mockup_*legalizacao*.html` — este documento traduz os protótipos já validados visualmente em plano técnico de implementação.

> **Nasceu como plano prospectivo, sem nenhuma linha de código do módulo — não é mais o caso.** P3 (tipos/hooks, STC-377), P4.1 (Matriz Lista, STC-378), P4.2 (Matriz Mapa, STC-379), P4.3 (Detalhe do Documento, STC-380), P4.4 (Processo de Renovação, STC-381), P4.5 (Movimentação Profissional, STC-382) e P4.7 (Administração do Catálogo, STC-415) já têm implementação real, todas mergeadas em `main`; as seções P3.1/P3.2/P4.1/P4.2/P4.3/P4.4/P4.5/P4.7 abaixo já foram atualizadas pra refletir o contrato real, não mais a especulação original. O mockup HTML estático restante continua valendo como referência visual pro que falta (P4.6).

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
**Status:** 🔄 Em andamento (P4.1, P4.2, P4.3, P4.4, P4.5, P4.6, P4.7 e P4.8 implementados — P4.3/STC-380 (PR #35, 7 rodadas de code review automático, todas corrigidas), P4.4/STC-381 (PR #36, 1 rodada de code review automático, 2 achados corrigidos), P4.5/STC-382 (PR #37, 6 rodadas de code review automático, todas corrigidas), P4.6/STC-416 (fast-follow, depende do backend da STC-441), P4.7/STC-415 (PR #34, 2 rodadas de code review automático), P4.8/STC-434 (branch aberta, ainda sem PR))

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

**Status:** ✅ Implementado e mergeado em `main` (STC-380, PR #35 — 7 rodadas de code review automático, todas corrigidas antes do próximo push). Componente real em `src/components/legalizacao/{DetalheDocumentoModal,ProcessoRenovacaoModal}.tsx`. Ajustes em relação ao plano original abaixo:

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

**Status:** ✅ Implementado e mergeado em `main` (STC-381, PR #36 — 1 rodada de code review automático, 2 achados corrigidos). `ProcessoRenovacaoModal.tsx` (STC-380, P4.3) nasceu como o ponto de entrada — cria o `ProcessoRenovacao` e mostrava só a seção "1. Solicitação". Esta issue estendeu o MESMO componente, sem criar um novo: acrescentou as seções 2 (Protocolo) e 3 (Conclusão) a partir de um processo já criado, e o modal passa a ser reaberto (não só criado) a partir do documento enquanto o processo estiver `em_andamento`/`protocolado` — `DetalheDocumentoModal.tsx` troca o rótulo do botão pra **"Acompanhar Renovação"** nesse caso (renomeado a pedido do responsável do projeto; nome original, "Acompanhar processo de renovação", ficava longo demais pro botão).

- Modal, 3 seções: Solicitação (leitura) / Protocolo (**opcional**, texto explícito "preencha só se houver órgão envolvido") / Conclusão. Como planejado.
- **Conclusão não é bloqueada por Protocolo** — como planejado (a tabela de transição do backend permite `Em andamento/Protocolado → Concluído`, os dois são origem válida).
- Dois botões de ação independentes, cada um contra o mesmo `PATCH /processos-renovacao/{id}/` (`useAtualizarProcessoRenovacao`, um único hook de mutação compartilhado pelos dois):
  - **"Salvar protocolo"** — `status=protocolado` + número/órgão/data/observações. Bloqueado sem número preenchido (client e backend).
  - **"Concluir renovação"** — `status=concluido` + `nova_validade` (write-only no serializer, aplicado em `DocumentoUnidade.validade` pela view) + evidência obrigatória. A evidência é enviada **antes** do PATCH de conclusão, nunca depois: `POST /documentos/{id}/evidencias/` vincula automaticamente ao processo ainda ativo (`documento.processos.exclude(status=concluido).first()`) — invertendo a ordem, a evidência subiria sem vínculo nenhum, porque o processo já teria deixado de ser "ativo".
- **`usuario_responsavel` passa a ser enviado na criação do processo** (`user?.usuarioId` do `useAuth()`) — no P4.3/STC-380 nascia sempre `null`, porque a criação ainda não existia de verdade como fluxo próprio.
- **3 achados de dogfooding corrigidos** (testado ao vivo pelo responsável do projeto, depois de permissão local concedida via troca temporária de perfil/setor — Admin é bloqueado por desenho em `PodeEscreverRecursoDeUnidade`, ver `Plano de Ação §6`):
  - Nome de evidência longo estourava a largura do card em vez de truncar com "…" — causa real não era o `<span>` do nome (já tinha `truncate`), era o `<Tabs>` de `DetalheDocumentoModal.tsx` ser item de um CSS Grid (`sm:grid-cols-[270px_1fr]`) sem `min-w-0` — item de grid tem `min-width: auto` por padrão, que considera o conteúdo intrínseco dos descendentes e estoura a trilha inteira, mesmo com `overflow:hidden`/`truncate` em algo mais profundo na árvore. Corrigido com `min-w-0` no próprio `<Tabs>`.
  - Modal mais estreito/baixo que o mockup (512px/85vh implementado vs. 620px/90vh) — corrigido pra bater com o mockup, mais a barra de rolagem discreta já usada no resto do módulo.
  - Histórico mostrando o código cru do status (`"em_andamento"`) em vez do rótulo traduzido — `LABEL_STATUS_PROCESSO` (exportado deste componente) reaproveitado em `DetalheDocumentoModal.tsx` pra traduzir `HistoricoRegulatorio.valor_anterior/valor_novo` quando `acao=="processo_status"`, mesmo padrão já usado pra `acao=="status"`.
- **3 achados de uma análise própria de falhas críticas**, feita antes do primeiro push, a pedido do responsável do projeto:
  - **Perda silenciosa dos campos de Protocolo** (mais grave) — o PATCH de "Concluir renovação" só mandava `status=concluido`+`nova_validade`; editar Número/Órgão/Observações e clicar direto em "Concluir renovação" (sem passar por "Salvar protocolo" antes) descartava essas edições sem aviso. Corrigido: o PATCH de conclusão agora sempre leva os valores atuais desses campos também — verificado contra `TRANSICOES_PERMITIDAS_PROCESSO` (backend) que só passa a exigir `protocolo_numero` ao mover **para** `protocolado`, nunca ao mover pra `concluido`, então reenviá-los na conclusão é seguro.
  - **Fuso horário errado em "Data da solicitação"** — fatiava a string crua do datetime UTC (`.slice(0,10)`) em vez de converter pro fuso local; um documento criado entre 21h e 23h59 (horário de Brasília) mostrava o dia seguinte. Corrigido com `Intl.DateTimeFormat` sobre um `Date` de verdade (mesmo princípio de `formatarDataHora`, `@/lib/utils`).
  - **`key={processo.id}` prometido em comentário, nunca implementado no JSX** — hoje inofensivo (o `Dialog` do Radix desmonta tudo ao fechar), mas sem essa proteção ficaria vulnerável se esse comportamento mudar no futuro.
- **2 achados do code review automático (PR #36), ambos corrigidos**:
  - Falha ao listar processos (`GET /processos-renovacao/`) era engolida — o componente descartava `error`/`mensagemErro` do hook, e com `processoAtivo` vindo `null` por falta de dado, caía no passo de "Iniciar processo de renovação" como se o documento não tivesse processo nenhum, mesmo sendo alcançável só por "Acompanhar Renovação" (que só aparece quando já existe um processo em curso). Corrigido com um terceiro estado de erro dedicado (mensagem + "Tentar novamente"/"Fechar").
  - "Salvar protocolo" não considerava o upload de evidência de "Concluir renovação" em andamento (`enviandoEvidencia`) — como os dois botões compartilham a mesma instância de `useAtualizarProcessoRenovacao()`, um clique em "Salvar protocolo" durante esse upload disparava um PATCH `status=protocolado` concorrente ao PATCH `status=concluido` que viria em seguida, com o resultado final dependendo de qual chegasse por último no servidor. Corrigido acrescentando `enviandoEvidencia` à condição de desabilitar o botão.
- Suíte de testes final: 17 casos em `ProcessoRenovacaoModal.test.tsx` (inclui os 3 achados de falha crítica e os 2 do code review, cada um com teste dedicado provando a falha antes da correção), mais os ajustes correspondentes em `DetalheDocumentoModal.test.tsx`.
- **Sem verificação em navegador real com login** — mesma limitação já registrada em P4.3 (`chromium-cli` indisponível, sem bypass de login OAuth). Verificado via `tsc`/lint/testes/build e visualmente via RTL renderizado + `google-chrome --headless` (mesma técnica que achou o bug de `min-w-0` do Grid acima); o responsável do projeto testou ao vivo com permissão concedida localmente e reportou os 3 achados de dogfooding.

### P4.5 Reportar Movimentação Profissional — `mockup_movimentacao_profissional_legalizacao.html`

**Status:** ✅ Implementado e mergeado em `main` (STC-382, PR #37 — 6 rodadas de code review automático, todas corrigidas, mais achados de dogfooding e de análise própria de falhas críticas, todos corrigidos antes do primeiro push). Escopo da STC-431 (encadear "Entrada" com "Acompanhar Renovação", decidido na semanal 10/09/2026, ver `Plano de Ação §4/§9`) mesclado no texto da própria STC-382 antes da implementação — não virou issue nem PR separada. Ajustes em relação ao plano original abaixo:

- **`MovimentacaoProfissionalModal.tsx`** (componente novo): toggle Saída/Entrada, Profissional, Função (client-side, só decide a pré-marcação inicial do checklist, nunca enviada ao backend), Data, e checklist "Documentos afetados nesta unidade" (documentos da mesma unidade regulados por movimentação de pessoa — CNES/CRM-RT/Dosimetria, via `CODIGOS_MOVIMENTACAO_PROFISSIONAL`, movida pra `lib/legalizacaoMatriz.ts` — evita import circular com `DetalheDocumentoModal.tsx`, que precisa do mesmo conjunto).
- **Estado dinâmico do modo, como planejado, mas via uma única fonte**: ícone, toggle, callout e botão trocam juntos de cor lendo a mesma CSS custom property `--mode-color` (aplicada no `DialogContent`, valor calculado uma vez a partir do `tipo`) — achado em code review automático: a primeira versão replicava a mesma condição `tipo === "saida" ? ... : ...` em 3 lugares independentes, arriscando divergência futura.
- **Sem endpoint em lote no backend**: uma chamada por documento marcado, concorrente (`Promise.allSettled`), com sucesso parcial tratado por documento — erro só aparece no que falhou, os outros ficam confirmados, e um novo clique em "Tentar novamente" reenvia só os pendentes.
- **RN12 (dosímetro, 30 dias de antecedência pra Entrada) e RN13 (janela do CNES) implementados no client**, este último lendo `regra_aplicada.janela_dia_inicio/fim` (não hardcoded), com fallback genérico quando a regra não tiver esses campos configurados — achado na revisão do texto da issue antes de implementar, ausente do texto original.
- **Campos travados após a 1ª tentativa** (`jaTentouEnviar`: Tipo/Profissional/Função/Data desabilitados assim que há algum documento confirmado ou com erro pendente) — achado em análise própria de falhas críticas: sem isso, um "Tentar novamente" podia representar um evento diferente (pessoa/data/tipo trocados) do que os documentos já confirmados registraram.
- **Fechar o modal no meio de um envio é bloqueado** (Escape/overlay/"X" checam `enviando`, mesma condição que já desabilitava "Cancelar") — achado em code review automático: o componente nunca desmonta entre aberturas, então um `Promise.allSettled` em curso podia resolver depois de um fechamento prematuro e ressuscitar estado já resetado.
- **Confirmar exige que sobre algo novo pra enviar** (`haAlgoParaEnviar`, não só `marcados.size > 0`) — achado em code review automático: desmarcar o único documento com erro (a forma de desistir do retry) deixava o botão com cara de acionável mas virando um clique sem nenhum efeito.
- **Erros e avisos anunciados a leitor de tela**: erro por documento e o aviso de RN12 usam `role="alert"` (bloqueante), o aviso de RN13 usa `role="status"` (não bloqueante), todos ligados ao campo/checkbox correspondente via `aria-describedby`. O grupo do toggle Saída/Entrada tem `role="group"` + `aria-labelledby` associado ao Label.
- **Encadeamento com "Acompanhar Renovação" (escopo da STC-431, mesclado nesta issue)**: confirmar "Entrada" com sucesso total abre automaticamente o `ProcessoRenovacaoModal` do documento que originou o clique em "Reportar Movimentação" (o processo já existe, criado pelo backend na Entrada — ver achado de backend abaixo). "Saída" nunca encadeia nada.
- **Achado real de backend, corrigido direto em `main` fora desta issue/PR (commit `46a2f3a`)**: "Entrada" só escrevia o status do documento, sem criar um `ProcessoRenovacao` de verdade por trás — corrigido criando o processo (idempotente, `IntegrityError` tratado com savepoint) e sincronizando o card espelho do Kanban. Detalhe completo em `Plano de Ação §11`.
- **Achado real de CSS, corrigido nos dois modais de Legalização** (este e `ProcessoRenovacaoModal.tsx`, já mergeado): container com `overflow-y-auto` sem padding próprio cortava o anel de foco de qualquer campo `w-full` rente à borda — `p-1` resolve.
- Texto do callout muda de verdade entre os dois modos (saída → "muda pra Vencido"; entrada → menciona RN12/dosímetro), não é texto estático. Botão "Reportar Movimentação Profissional" (STC-380) encurtado pra "Reportar Movimentação" (testando ao vivo: texto original ficava apertado na coluna lateral).
- **Não oferecer documento já Vencido pra "Saída" (STC-437, 14/09/2026)** -- espelha a restrição de backend da STC-436 (rejeita 400 uma "saída" em documento já Vencido). `documentosElegiveis` (fonte de pré-marcação/envio) e a poda de `marcados` ao trocar de tipo (`trocarTipo`) agora leem da mesma função `filtrarDocumentosAfetados`, achado em análise própria de falhas críticas: a 1ª versão duplicava a regra de "vencido" em dois lugares (o filtro do checklist e o `trocarTipo`), arriscando divergirem se um dos dois mudasse sem o outro no futuro. **2º achado do mesmo review**: `marcados` podia ficar com um id "fantasma" (fora da lista renderizada) sem o usuário nunca trocar de tipo -- ex. o poll de 60s (`useDocumentosLegalizacao`) trazendo um documento que virou Vencido enquanto o modal seguia aberto em "Saída". Corrigido: `confirmar()` e `haAlgoParaEnviar` agora sempre intersectam `marcados` com `documentosElegiveis` atual antes de decidir o que enviar/se o botão fica habilitado. "Entrada" continua oferecendo documentos Vencido normalmente (Vencido -> Em andamento é retomada legítima).
- **3 achados confirmados numa 2ª rodada de code review (auto-revisão, sem PR aberto ainda -- automação de code review não disparou pra esta branch)**: a exclusão por Vencido acima (`filtrarDocumentosAfetados`) rodava de novo a cada revalidação (sucesso de um documento-irmão, ou o próprio poll de 60s), sem nenhuma forma de manter um documento já envolvido (marcado, confirmado ou com erro) visível depois de excluído. (1) Um documento de "Saída" confirmado com sucesso desaparecia da tela (badge "Confirmado" incluído) assim que sua revalidação o devolvia como Vencido -- perdendo o rastro visual de que aquele documento específico já tinha sido reportado, no meio de um envio com sucesso parcial. (2) Um documento marcado com erro pendente (aguardando "Tentar novamente") podia sumir da mesma forma, sem nenhuma ação do usuário -- travando o retry sem explicação visível. (3) A mensagem de estado vazio ("nenhum documento cadastrado nesta unidade") aparecia mesmo quando os documentos existiam, só excluídos pela regra de Vencido -- factualmente errada. Corrigido com `idsEnvolvidos` (união de `marcados`/`confirmados`/`errosPorDocumento`) passado como 3º parâmetro opcional de `filtrarDocumentosAfetados`, que contorna só a exclusão por Vencido pra esses ids: `documentosParaExibir` (usado no checklist e em `alternarMarcado`) mantém a linha visível com um aviso explícito quando o documento não é mais elegível, e `documentosRelevantesNaUnidade` (mesma função com tipoAlvo "entrada", que nunca exclui por Vencido) distingue as duas mensagens de estado vazio. Toda decisão de pré-marcação/envio continua em `documentosElegiveis` (a lista estrita, sem a exceção). Testes novos cobrindo os três casos, incluindo revalidação disparada por um documento-irmão (sem depender de fake timers pro poll de 60s, que se mostrou frágil combinado com userEvent). Suíte completa do frontend passando.

### P4.6 Biblioteca de Documentos — `mockup_biblioteca_documentos_legalizacao.html` (STC-416, fast-follow pós Go-Live)

**Status:** ✅ Implementado (STC-416, depende do backend da STC-441 -- endpoint agregado de evidências vigentes). Cortada do pacote P4 original (Plano de Ação §8), implementada depois como fast-follow.

- **`BibliotecaDocumentos.tsx`** (componente novo) + `app/(app)/modulos/legalizacao/biblioteca/page.tsx`: tela por unidade (seletor na URL, `?unidade=`, mesmo padrão de `MatrizConformidade.tsx` -- sem "todas as unidades" aqui, sempre uma só), documentos agrupados pelas 7 categorias fixas (`ORDEM_CATEGORIA`/`LABEL_CATEGORIA`, reaproveitados de `legalizacaoMatriz.ts`), categoria sem nenhum documento na unidade é omitida (não mostra "0" como o mockup fazia -- decisão desta implementação, o mockup é inspiração, não gabarito).
- **Card por documento** (não linha com borda inferior como o mockup): borda arredondada, tingida de verde quando há evidência vigente e o documento não está vencido, vermelha quando vencido (independente de ter arquivo). Ícone `FileText`/`FileX` (não texto abreviado "PDF"/"!") segue a mesma regra de cor do card. Badge de status só para "Vencido" -- os demais estados de workflow (Em Andamento, Protocolado, Não iniciado) não interessam a quem só vai mostrar o documento numa fiscalização (achado durante a implementação, formalizado na issue).
- **Diferenciação de documento sem evidência vigente** (critério da issue): esmaecido (`opacity-60`, só quando não está vencido -- um vencido sem evidência continua em destaque total), nome não é link nem abre preview, sem botão de baixar, texto "Nenhum arquivo cadastrado".
- **Painel de pré-visualização real, não o esboço estático do mockup**: nasce ao clicar no nome do documento (mesmo comportamento de abrir/fechar do mockup -- clique de novo fecha), embute o PDF de verdade via `<iframe>` apontando pra uma Blob URL local, montada a partir de bytes buscados no proxy same-origin `/api/media/evidencia-vigente` (não a URL do arquivo direto -- X-Frame-Options do backend em dev e Content-Disposition: attachment forçado do R2 em produção bloqueiam isso; CSP `frame-src` passa a permitir `blob:`).
- **Endpoint agregado da STC-441** (`listarEvidenciasVigentes`/`useEvidenciasVigentes`, novo hook em `useDocumentosLegalizacao.ts`) resolve `arquivo`/`nome_original` de cada evidência vigente da unidade numa chamada só -- `documento_unidade` (ID cru) casa com `useDocumentosLegalizacao()` via `Map`, sem N+1 nem tocar no `evidencia_vigente` cru que a Matriz já usa.
- **Ponto de entrada**: não vira item novo na Sidebar nem um 3º item do segmented control Mapa/Lista (paradigma diferente -- leitura de uma unidade só, não outra visão da mesma matriz) -- link "Biblioteca de Documentos →" adicionado em `ToggleMapaLista.tsx` (só a Lista passa `linkBiblioteca`, mutuamente exclusivo com a `dica` que só o Mapa usa), ao lado do segmented control.
- Testes cobrindo: agrupamento por categoria (com omissão de categoria vazia), estado com/sem evidência, abrir/fechar o painel de pré-visualização (nome clicado de novo, e botão de fechar dedicado), troca de unidade (URL + refetch), unidade inválida na URL cai pra 1ª da lista, estados de erro/vazio.
- **Achados numa auto-revisão de código antes do push**: (1) o fetch de documentos/evidências não pausava enquanto um id de unidade vindo da URL ainda esperava confirmação contra a lista real (mesma classe de bug já corrigida em `MatrizConformidade.tsx`) -- corrigido com `aguardandoValidacaoDeUnidade`, mesmo padrão. (2) o painel de pré-visualização (largura fixa 380px) quebrava em mobile por não ter nenhum tratamento responsivo -- corrigido escondendo a lista e deixando o painel ocupar a largura toda abaixo de `sm:` (alternam um de cada vez), em vez de bloquear a tela inteira pra mobile como o Mapa faz. (3) o `<Select>` de unidade alternava entre `undefined` e uma string definida, gerando o aviso do Radix de "uncontrolled to controlled" -- corrigido com `""` como valor inicial. (4) `numeroDaUrl` estava duplicado ao pé da letra em `MatrizConformidade.tsx` -- extraído pra `legalizacaoMatriz.ts`, compartilhado pelos dois. Teste novo cobrindo o achado (1). Suíte completa do frontend passando (434 testes).

### P4.7 Administração do Catálogo — `mockup` inexistente, fora da estimativa original de 24 dias

**Status:** ✅ Implementado e mergeado em `main` (STC-415, PR #34 — 2 rodadas de code review automático, a 2ª com 3 achados já corrigidos, ver `Plano de Ação §11`). Decidido numa sessão dedicada de planejamento (27/08/2026, `Plano de Ação §4`) — não fazia parte do escopo dos 6 mockups nem da estimativa de prazo já negociada (`Plano de Ação §8`). Motivado pela reunião de 26/08: Nathalya Almeida e Iara Martins montando o esqueleto de cada unidade manualmente (começando por Niterói, ~2h por unidade). Ajustes em relação ao plano original abaixo:

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

### P4.8 Botão "Reverter para aplicável" (STC-434) — `mockup` inexistente, mesmo padrão de confirmação simples já usado no módulo

**Status:** ✅ Implementado, branch aberta ainda sem PR (STC-434). Depende do endpoint `documentos/{id}/reverter/` da STC-430 (backend, `PR #36 em revisão`) — implementado e testado contra o contrato já fechado nessa PR, antes do merge.

- Botão em `DetalheDocumentoModal.tsx`, visível só quando `documento.status` é `nao_aplicavel` ou `unidade_encerramento` (`podeReverter`).
- **Confirmação via `ConfirmDialog` (componente compartilhado, já usado em `AnexoList.tsx`/`ResponsavelSection.tsx`)**, não um modal de formulário — sem campo nenhum pra preencher, batendo com o backend não exigir justificativa pra reverter.
- Sem payload: `reverterDocumentoLegalizacao(documentoId)` (novo em `lib/legalizacao.ts`) chama o endpoint sem corpo — o backend recalcula o destino sozinho pela `validade`.
- `useReverterDocumentoLegalizacao` (novo hook, `useDocumentosLegalizacao.ts`) invalida a mesma chave de lista que os outros hooks de mutação do módulo (`ehChaveDeListaDeDocumentos`).
- **Achado em análise própria de falhas críticas, corrigido antes do push**: antes desta issue, "Marcar como Não aplicável" já era oferecido a partir de `unidade_encerramento` (transição coringa válida no backend, `STATUS_CORINGA_COM_JUSTIFICATIVA`) — sem excluir, os dois botões (uma ação que aprofunda a exceção, outra que desfaz) apareciam juntos na mesma tela pro mesmo documento. Corrigido: `podeMarcarNaoAplicavel` agora exclui sempre que `podeReverter` for verdadeiro (nao_aplicavel **ou** unidade_encerramento), não só `nao_aplicavel` como antes.
- Segue o mesmo padrão de "fecha o dialog em qualquer desfecho" já usado em `AnexoList.tsx::confirmarExclusao` (try/catch/finally) — `ConfirmDialog`/`AlertDialogAction` (Radix) fecha sozinho ao clicar, então o estado local precisa fechar junto mesmo se a chamada falhar.
- 6 testes novos em `DetalheDocumentoModal.test.tsx`: botão escondido quando Regular, mostrado nos dois status de origem (e "Marcar como Não aplicável" escondido nesses mesmos dois), confirmação sem payload, sucesso com revalidação de histórico, erro.

### P4.9 Restringir upload de evidência a PDF (STC-433) — sem mockup próprio

**Status:** ✅ Implementado e mergeado em `main` (PR #39). Depende do backend (STC-429, já mergeado em `main`) rejeitar qualquer extensão além de `.pdf`.

- `ACCEPT_EVIDENCIA` (`ProcessoRenovacaoModal.tsx`) e o `accept` do input de evidência em `FormCadastrarDocumento.tsx` (Administração do Catálogo) restritos de `.pdf,.doc,.docx,.pptx,.xlsx,.png,.jpg,.jpeg` pra só `.pdf`.
- Erro amigável quando o backend rejeitar um arquivo não-PDF já era coberto de graça pelo mecanismo existente: os dois componentes já envolvem o upload em `try/catch` com `extrairMensagemErro` (`lib/erros.ts`), que já normaliza o corpo `{"arquivo": ["..."]}` do DRF numa string exibível — nenhum código novo de tratamento de erro foi necessário.
- 2 testes novos (um por componente), cada um confirmando `accept=".pdf"` no único `input[type="file"]` da árvore renderizada.
- Fora de escopo, conforme a issue: qualquer mudança em Gestão de Demandas (`AnexoSerializer`/`ACCEPT` próprios, inalterados).
- Análise própria de falhas críticas não encontrou nenhum achado: mudança mínima, os dois arquivos ficaram consistentes entre si, nenhum outro ponto de upload de evidência no módulo (`DetalheDocumentoModal.tsx` só lista/exibe evidências, não tem input de arquivo).

### P4.10 Dosimetria: cadastro e exibição por profissional (STC-432) — sem mockup próprio

**Status:** ✅ Implementado, branch aberta ainda sem PR. Depende do backend (STC-428, PR aberto, em revisão) aceitar `profissional`/`controlado_por_profissional`.

- `FormCadastrarDocumento.tsx`: campo "Profissional" exibido/exigido só quando o tipo escolhido tem `controlado_por_profissional=True` (schema zod virou uma função do conjunto de tipos controlados, `criarSchema`, montada via `useMemo`). Tipos controlados continuam na lista de tipos disponíveis mesmo já cadastrados na unidade -- cada profissional é uma linha própria, "já tem um documento deste tipo" não esgota a unidade só pra esses tipos.
- Duplicata pra tipos controlados vira "mesmo profissional já tem documento deste tipo/unidade" (escopada por profissional), não mais "qualquer documento deste tipo/unidade" -- reaproveita a `RegraDocumento` já existente de outro profissional do mesmo tipo+unidade (nunca cria uma segunda, que colidiria com a `UniqueConstraint` do backend em `(tipo_documento, unidade, vigente_a_partir)`), com o cleanup de "desfazer regra órfã se o documento falhar" ajustado pra nunca excluir uma regra reaproveitada.
- `MatrizTable.tsx` (Lista de Conformidade) e o checklist de `MovimentacaoProfissionalModal.tsx`: mostram "Tipo — Profissional" quando o documento tem profissional, pra diferenciar linhas do mesmo tipo+unidade.
- `MovimentacaoProfissionalModal.tsx`: documentos controlado_por_profissional nunca entram na pré-marcação automática da Função (com mais de um documento do mesmo tipo, a sugestão não tem como saber qual profissional é o certo); marcar um documento controlado_por_profissional desmarca automaticamente qualquer outro do mesmo grupo já marcado (no máximo 1 por vez, já que profissional/data são compartilhados por todo o envio); em "Saída" com um documento controlado marcado, o campo Profissional trava mostrando o nome já associado a esse documento (o backend, desde um achado de code review da própria STC-428, já ignora esse campo em "saída" -- travar aqui evita só que a UI confunda quem preenche); em "Entrada" o campo continua livre, é como se cadastra/reatribui um profissional novo.
- **5 achados em análise própria/code review, todos corrigidos antes do merge**:
  - `FormNovaVersaoRegra.tsx` ("Corrigir regra existente", tela pré-existente não tocada por esta issue): pegava `documentos[0]` às cegas pra decidir qual documento corrigir -- com mais de um documento na combinação unidade+tipo (controlado_por_profissional), corrigia a regra de um profissional arbitrário sem indicar que os outros existem, e o reaproveitamento de regra em `FormCadastrarDocumento.tsx` ficava dependente de qual documento a API devolvesse primeiro. Corrigido bloqueando esse fluxo com uma mensagem clara quando há mais de um documento, em vez de operar às cegas.
  - Reaproveitar uma regra existente pra um 2º+ profissional ainda exibia os campos de regra como obrigatórios e editáveis, descartando em silêncio qualquer valor digitado neles no submit. Corrigido preenchendo esses campos com os valores reais da regra reaproveitada (via `useEffect`) e desabilitando-os, com uma nota explicando que estão sendo reaproveitados.
  - `profissional` nunca era trimado antes da checagem de duplicata nem do envio -- um espaço a mais no início/fim driblava a checagem e criava uma segunda linha pro mesmo profissional real. Corrigido com `.trim()` no ponto de uso.
  - Trocar "Unidade" ou "Tipo de documento" não limpava o campo Profissional já digitado -- um nome sobrevivia silenciosamente entre seleções diferentes, arriscando cadastrar o documento certo pro profissional errado. Corrigido limpando o campo nos dois `onValueChange`.
  - **Achado no code review automático do PR**: o trim acima só tinha sido aplicado no caminho "Não aplicável" (a exceção) -- o caminho normal (com regra, o majoritário na prática) ainda enviava `valores.profissional` bruto pro `criarDocumento`, deixando o mesmo problema de duplicata por espaço em branco passar batido justamente no caminho mais usado. Corrigido usando `profissionalTrimado` também ali.
  - **Achado num 2º code review automático do PR**: o `useEffect` que preenche os campos de regra ao reaproveitar (achado acima) só cobria o caminho de entrada -- ele nunca limpava esses campos quando `regraExistenteParaTipo` deixava de existir (trocar de unidade ou tipo saindo de um tipo controlado com regra já cadastrada pra outro sem regra). Os campos voltavam a ficar editáveis mas continuavam com os valores da regra anterior, prontos pra ir no submit como se fossem da regra nova. Corrigido com `limparCamposDeRegra()`, chamado nos mesmos dois `onValueChange` que já limpavam o Profissional.
  - **Achado num 3º code review automático do PR**: `DetalheDocumentoModal.tsx` mostrava só `documento.tipo_documento.nome` no título -- com Dosimetria aceitando duas linhas na mesma unidade, abrir qualquer uma delas na Lista (`MatrizTable.tsx`) abria um modal com o mesmo título, sem nada no cabeçalho diferenciando qual documento estava aberto (a diferenciação existia na Lista, mas se perdia no Detalhe). Corrigido com o mesmo formato já usado em `MatrizTable.tsx` ("Tipo — Profissional").
- Fora de escopo, conforme a issue: mudança na Matriz Mapa (agregação já trata múltiplas linhas de Dosimetria como mais documentos na mesma conta).

### P4.11 Alerta regulatório persistente na plataforma (STC-443) — sem mockup próprio

**Status:** PR #45 aberto, em revisão (4 rodadas de code review corrigidas), ainda não mergeado.

Requisito já confirmado, não uma ideia nova (RN22, `Requisitos Funcionais.md`/MP002, e a seção "Canais e persistência" de `Regras de Alertas e Status.md`, ambos no Obsidian): "o alerta permanece visível na plataforma até a resolução" — a STC-373 (P5.1, backend) só cobriu o aviso avulso e dispensável (sino do Topbar), não a persistência. Achado revisando a Biblioteca de Documentos (STC-416): usuário identificou a lacuna citando a intenção original antes de eu confirmar contra a documentação.

- `AlertaPersistenteModal.tsx` (novo), montado uma vez em `AppShell.tsx` (não por tela) — dispara em qualquer lugar da plataforma, não só nas telas de Legalização. Lista todos os `AlertaRegulatorio` com `status_tratamento="pendente"` visíveis ao usuário (RBAC já resolvido por `AlertaRegulatorioViewSet`, sem endpoint novo).
- Reaparece a cada sessão (nunca persistido em localStorage/backend) enquanto houver pendência; fechar ("Ver depois" ou clicar num alerta) só dispensa pra essa sessão. Reabre se chegar um alerta novo (conjunto de ids, não só contagem — ver achados abaixo) mesmo já dispensado.
- Suprime a própria abertura quando já existe `?documento=` ativo na URL (evita empilhar com `DetalheDocumentoModal`, aberto pela Matriz a partir do mesmo parâmetro).
- `useAlertasPendentes.ts` (novo hook) + `listarAlertasPendentes()` (`legalizacao.ts`) seguem a paginação via `?page=N` pelo mesmo cliente axios, nunca o `next` absoluto que o DRF devolve (mesmo padrão já usado em `listarDemandas()`, `demandas.ts`) — um `next` absoluto sairia sem o token do proxy same-origin e bateria na CSP `connect-src 'self'`.
- **`alertaAindaRelevante()` (defesa em profundidade no cliente)**: o backend (STC-447) fecha `status_tratamento` quando o documento é resolvido, mas só a partir da correção — qualquer escrita fora dos 3 pontos cobertos lá (ex. edição direta pelo Django Admin) deixaria passar um alerta obsoleto como "pendente". Replica o mesmo critério fino da migration de backend, não um "documento resolvido = todos os alertas dele somem" ingênuo (documento `Regular` pode ter alerta legítimo de renovação próxima).
- **6 achados corrigidos em 4 rodadas de code review automático do PR**:
  - Ícone do card ficava vermelho em documento regular com evidência (usava só a existência de evidência, não `documento.status`) — corrigido pra seguir a mesma regra de cor da borda do card.
  - Esmaecimento (`opacity-60`) de documento sem evidência, perdido no redesign da Biblioteca de Documentos (STC-416) nesta mesma sessão — reintroduzido, só quando não está vencido.
  - Proxy de preview de PDF (`api/media/evidencia-vigente`) repassava o `Content-Type` da origem em vez de fixar `application/pdf` — corrigido (rota só serve PDF por desenho, não devia depender de validação externa não evidenciada no repo).
  - Reabertura do modal comparava só a contagem total de alertas, não o conjunto de ids — deixava passar batido "um resolvido + um novo no mesmo poll, contagem igual" e reabria à toa numa simples queda de contagem (alerta resolvido). Corrigido comparando o conjunto de ids pendentes.
  - Falha ao buscar os alertas virava "sem alerta nenhum" (`[]`), indistinguível de "tudo em dia" — corrigido: o modal também abre em erro, com mensagem própria.
  - Clicar num alerta com o usuário já na Matriz não abria o documento (deep link `?documento=` só era lido na montagem de `MatrizConformidade.tsx`, pressuposto que valia enquanto esse link só vinha de outra rota, STC-380) — corrigido com `useEffect` resincronizando sempre que o parâmetro diverge do estado local. `router.push` também passou a mesclar a querystring existente (preserva `?unidade=` já ativo), só quando já estamos na própria Matriz.
  - `listarAlertasPendentes()` só aplicava `alertaAindaRelevante()` no caminho raro (múltiplas páginas) — o caminho comum (1 página) devolvia sem filtro nenhum.
- **Agrupamento por documento** (achado no feedback visual, depois do merge da STC-447): um mesmo documento pode ter mais de um `AlertaRegulatorio` pendente ao mesmo tempo e legítimo (ex. imediato de movimentação profissional + de ciclo da varredura diária, os dois válidos enquanto o documento não é resolvido) — contar/listar por alerta fazia o mesmo documento aparecer 2x e o título dizer "4 alertas" quando só 3 documentos precisavam de atenção de verdade. `agruparAlertasPorDocumento()` (`legalizacaoMatriz.ts`, testado à parte) agrupa por `documento_unidade.id`; cada grupo usa a criticidade mais alta e a data mais antiga entre os alertas do documento, com "· N alertas" na linha quando há mais de um. Título/contagem passam a ser "N documentos regulatórios pendentes", não mais "N alertas".
- Fora de escopo: aviso por e-mail (a outra metade do RN22) — pendência própria, travada em avaliação de viabilidade via Mandrill desde 27/08; escalonamento de alertas não tratados — regra de negócio ainda não definida.

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
- **Modo responsivo/mobile** — a Lista já tem tratamento mobile (STC-378): `MatrizFiltros.tsx` colapsa os selects num `Popover` abaixo de 640px, `MatrizTable.tsx` rola na horizontal (`min-w-[820px]`, mesmo padrão de `GerenciarUsuarios.tsx`). O Mapa, por decisão de produto (STC-379), **não** ganhou layout mobile — em vez disso fica indisponível em telas estreitas, redirecionando pra Lista (ver P4.2 acima). O desenho antes cogitado pro Mapa (cards fixos + grade rolável com coluna "Unidade" congelada, mesmo espírito do Kanban mobile) foi descartado — fica só como referência histórica em `projeto_responsivo_mapa_legalizacao.md`, caso a decisão mude no futuro. Segue fast-follow: nenhum dos modais (Detalhe/P4.3, Renovação/P4.4 e Movimentação Profissional/P4.5, todos já implementados) tem consideração de mobile nenhuma ainda. Pré-requisito ainda sem solução, relevante se algum dia o Mapa (ou outro módulo do Atlas) ganhar mobile de verdade: nenhum módulo tem hoje um substituto real de navegação pra quando a sidebar desaparece em telas estreitas.
