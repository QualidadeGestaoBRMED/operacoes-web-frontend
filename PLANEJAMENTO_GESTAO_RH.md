# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Gestão RH (MP003)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001/MP002)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Entrega do desenvolvimento:** 16/10/2026 · **Testes e pente fino:** 19–20/10 · **Apresentação e Go-Live:** 21/10/2026 (cronograma acordado com o Tech Lead em 30/09/2026)
**Fonte:** `Plano de Ação - Gestão RH.md` (raiz do repositório da Plataforma) §4/§6/§8, SRS `docs/Gestão RH/SRS - Gestão RH.md` §3.1 (Regras de Interface), contrato de API em `backend/docs/PLANEJAMENTO_GESTAO_RH.md` e mockups em `docs/Gestão RH/mockup_*.html`.

> **Visual: as telas reais do Atlas mandam, não os mockups.** Os mockups definem conteúdo e regras de cada tela; o desenho segue o que já existe no produto: seções empilhadas na largura toda com título, descrição e separador (Administração: Usuários, Catálogo de Legalização), abas sublinhadas (detalhe do documento da Legalização), tabelas com borda e cabeçalho cinza em maiúsculas, ação principal à direita.

> **A fonte dos dados de ponto ainda não está definida** (API do VR Pontomais x planilha/RPA). Ela afeta só a importação e o absenteísmo. Férias e parâmetros independem dela.

### Situação por issue

| Issue | Pacote | Situação |
| --- | --- | --- |
| STC-597 Seção Parâmetros de Gestão RH (aba Absenteísmo e férias, Importação desligada) | P5.4 | ✅ Mergeada |
| STC-599 Base do módulo (menu, casca do modal, tipos e hooks de férias), Painel de Férias e aba Férias do modal | P5.1/P5.2/P5.3/P5.5 | 🔄 Construída, em revisão |
| STC-596 / STC-598 Painel e aba Absenteísmo | P5.1/P5.3 | ⚠️ Depende do formato dos dados e da fórmula (STC-588) |
| STC-595 Ligar a aba Importação | P5.4 | ⛔ Depende da definição da fonte (STC-587) |

---

## O que já está pronto

- Layout base, NextAuth, middleware, API client autenticado (`lib/api.ts`), `useAuth()` com os flags de perfil (`isAdminOps`, `isAdminQG`, `isCoordenacaoUnidade`, `isSetorLeg`).
- **Entrada "Gestão RH"** em `config/modulos-futuros.ts` com `codigo`, `rota` e o subitem Painel de Férias (STC-599). Continua "em breve" na Sidebar e no Hub até `Modulo.status=ativo` no backend (P7); "em breve" só esconde o menu, a rota direta abre a tela. `/modulos/gestao-rh` redireciona para o Painel de Férias até o Painel de Absenteísmo existir (STC-596).
- **Clique no card do Kanban** redireciona para `demanda.origem_url` (`components/kanban/KanbanBoard.tsx::selecionarDemanda`): sem código novo no Kanban.
- **Seção Parâmetros de Gestão RH (STC-597)**: `components/admin/gestao-rh/`, `hooks/useParametrosGestaoRH.ts`, `lib/gestaoRH.ts` (chamadas, rótulos, `formatarDataISO`, `errosDeCampo`/`errosPorItem` para levar erros do DRF aos campos), `types/gestaoRH.ts`, `components/ui/switch.tsx`.
- **Painel de Férias e modal do colaborador (STC-599)**: `components/gestao-rh/`, `hooks/useFeriasGestaoRH.ts` (`usePainelFerias`, `useColaboradorRH`, `useFeriasColaborador`), `lib/gestaoRHFerias.ts` (chamadas, rótulos e textos de marcos, situação e histórico).
- Motor de ordenação de tabela (`lib/ordenacao.ts`), filtros no padrão do Kanban/Matriz, `useUnidades()`.

---

## Estrutura de diretórios

```
frontend/src/
├── config/modulos-futuros.ts           → ✅ "Gestão RH" com codigo, rota e subitem Painel de Férias (Absenteísmo entra com a STC-596)
├── app/(app)/modulos/gestao-rh/
│   ├── page.tsx                               → hoje redireciona para Férias; vira o Painel de Absenteísmo (STC-596)
│   └── ferias/page.tsx                        → ✅ Painel de Férias (?colaborador=<id>&periodo=<id> abre o modal)
├── app/(app)/admin/permissoes/parametros-gestao-rh/page.tsx  → ✅ rota da seção (conteúdo no layout.tsx)
├── components/admin/gestao-rh/          → ✅ STC-597
│   ├── ParametrosGestaoRHAdmin.tsx            → abas Importação · Absenteísmo e férias
│   ├── FormParametrosAbsenteismo.tsx · FormReguaFerias.tsx
│   └── AbaImportacao.tsx                      → formulário desligado até a fonte ser definida
├── components/gestao-rh/
│   ├── PainelFerias.tsx · CardsFerias.tsx · TabelaFerias.tsx           → ✅ STC-599
│   ├── DetalheColaboradorModal.tsx            → ✅ modal único; hoje só a aba Férias (carga por aba)
│   ├── AbaFerias.tsx · CardPeriodoFerias.tsx · FormProgramarFerias.tsx · FormAdiarProgramacao.tsx  → ✅
│   ├── PainelAbsenteismo.tsx · TabelaColaboradores.tsx                 → a fazer (STC-596)
│   └── AbaAbsenteismo.tsx · FormRegistrarTratamento.tsx                → a fazer (STC-598)
├── hooks/
│   ├── useParametrosGestaoRH.ts               → ✅ useParametrosAbsenteismo, useReguaFerias
│   ├── useFeriasGestaoRH.ts                   → ✅ usePainelFerias, useColaboradorRH, useFeriasColaborador
│   └── hooks de absenteísmo                   → a fazer
├── lib/gestaoRH.ts · lib/gestaoRHFerias.ts  → ✅ parâmetros · férias
└── types/gestaoRH.ts                     → ✅ parâmetros e férias (absenteísmo a fazer)
```

Tabelas **sem paginação**, rolagem dentro da tabela com cabeçalho fixo (mesmo padrão da Matriz de Conformidade; SRS §3.1).

---

## Contrato de API (prefixo `api/modulos/gestao-rh/`)

| Rota | Método | Uso | Situação |
| --- | --- | --- | --- |
| `parametros/` · `regua-ferias/` | GET, POST | Seção Parâmetros (só Admin). POST devolve 201 com versão nova ou 200 sem mudança | ✅ |
| `ferias/?janela_dias=&unidade=&status=` | GET | Painel de Férias: `linhas` + `cards` | ✅ |
| `colaboradores/{id}/` | GET | Cabeçalho do modal (nome, cargo, unidade, matrícula, admissão, `alertas_pendentes` por aba) | ✅ |
| `colaboradores/{id}/ferias/` | GET | Aba Férias | ✅ |
| `ferias/{id}/` | PATCH | `acao=programar` (`data_inicio`, `data_fim`, `necessita_substituicao`) ou `acao=adiar` (`justificativa`); devolve a aba Férias atualizada | ✅ |
| `ferias/{id}/rh-acionado/` | POST | "RH acionado"; devolve a aba Férias atualizada | ✅ |
| `colaboradores/?inicio=&fim=...` · `indicadores/` · `colaboradores/{id}/absenteismo/` · `colaboradores/{id}/tratamentos/` | | Absenteísmo | a fazer (STC-588/592) |
| `importacoes/` e afins | | Importação | ⛔ depende da fonte (STC-587) |

`{id}` em `ferias/{id}/` é o do período de férias. Acesso: Admin Q&G e Admin Operações tudo; coordenação e OPEX só a própria unidade (fora dela, 404); demais perfis 403. Percentuais chegam como string decimal ("5.00").

---

## Pacote P5 — Frontend: Interface Operacional

### Tipos e hooks

- `types/gestaoRH.ts` espelha os serializers (snake_case, lição da STC-377). Férias: `LinhaPainelFerias`, `CardsFerias`, `CabecalhoColaborador`, `FeriasColaborador` (períodos pendentes com `marcos`, `programacao`, `adiamento`, `pode_programar`/`pode_adiar`/`pode_registrar_rh_acionado`; férias tiradas; período em andamento; histórico).
- Hooks SWR com chave por filtro (padrão de `useDocumentosLegalizacao.ts`). As ações de férias devolvem a aba atualizada: trocar o cache pela resposta, sem segunda requisição (mesmo padrão de `useParametrosGestaoRH.ts`).

### P5.1 Menu Gestão RH e Painel de Absenteísmo — `mockup_painel_absenteismo_gestao_rh.html`

- Acrescentar o subitem Painel de Absenteísmo à entrada que a STC-599 criou em `modulos-futuros.ts`.
- Rota `/modulos/gestao-rh`. Período obrigatório (início/fim livres, RF-003), cards de indicadores, filtros unidade · faixa · ocorrência · com pendências + busca por colaborador/matrícula.
- Coluna de faixa só aparece quando o backend devolve faixa (critérios cadastrados); meta só com valor cadastrado. Percentual com "provisório · N pendências" quando houver pendência.
- **Depende do cálculo (STC-588)**, que depende do formato real dos dados e da fórmula da Gestão de RH.

### P5.2 Painel de Férias — `mockup_painel_ferias_gestao_rh.html`

- ✅ STC-599. Rota `/modulos/gestao-rh/ferias`. "Marcos nos próximos" 30, 60, 90 (padrão) ou 180 dias, com a legenda "Quem tem demanda aberta ou limite vencido aparece sempre"; busca por nome (sem acento) ou matrícula; filtro de status; filtro de unidade só para Admin (coordenação e OPEX já recebem só a própria unidade).
- Cards (de `cards`), no desenho dos cards da Matriz: limite vencido · perto do limite ("a menos de `dias_perto_do_limite` dias") · sem programação · acionar o RH · programação adiada; "N alertas e N demandas geradas nos últimos N dias · Última importação" (ou "Nenhuma importação ainda").
- Uma linha por colaborador: colaborador (matrícula · cargo) · unidade · período de direito (com "+N período pendente") · limite · próximo marco em duas linhas (o evento e a data; "Nenhum / limite vencido há N dias") · status · situação (programação, adiada ou demandas abertas). Ordem do backend.
- No celular, a página rola inteira (cards e filtros não deixam altura para a tabela travada).

### P5.3 Modal do Colaborador — `mockup_detalhe_colaborador_{absenteismo,ferias,ferias_acumuladas}.html`

- ✅ Casca e aba Férias na STC-599. Modal único, no desenho do detalhe do documento da Legalização: nome, cargo e unidade no topo; unidade, cargo, matrícula e admissão na coluna da esquerda; abas sublinhadas à direita, **carga só da aba aberta** (cabeçalho de `colaboradores/{id}/`, aba Férias de `colaboradores/{id}/ferias/`, aba Absenteísmo de `colaboradores/{id}/absenteismo/`, a fazer). Cada aba mostra o próprio histórico no fim. Colaborador desligado: só leitura.
- **Aba Férias**: um card por período pendente, do mais antigo para o mais recente, aviso quando houver mais de um; marcos com a situação (`alerta_gerado`, `tratado`, `proximo`, `futuro`, `sem_alerta`, `vencido`); ações "Programar férias" e "Não programar agora" abrindo uma por vez dentro do card, conforme `pode_programar`/`pode_adiar`/`pode_registrar_rh_acionado`.
  - Programar (ou "Reprogramar férias", preenchido com a programação atual): início/fim, dias calculados, toggle de substituição. As regras do backend são conferidas também na tela antes de enviar (início a partir de hoje, no máximo 30 dias, **terminar até o limite para tirar**; com limite vencido aceita, com aviso de pagamento em dobro); a mensagem do 400 vai para o campo. O prazo "Acionar o RH até <data>" aparece depois de registrar: os dias da régua só são visíveis para Admin.
  - Com as férias programadas, marcos ainda à frente aparecem como "sem alerta: férias programadas" (o motor não dispara marcos de período programado).
  - Adiar: justificativa obrigatória; só período pendente e dentro do limite. Mostrar "adiada em <data> por <quem>" (`adiamento`).
  - "RH acionado" junto do aviso de substituição, com confirmação (não pode ser desfeito); depois de registrado, "RH acionado em <data> por <responsável>".
  - Férias já tiradas recolhidas; período em andamento como linha informativa.
- **Aba Absenteísmo**: período livre, aviso de pendências, indicadores, ocorrências com "conta/não conta" e "em aprovação", card do alerta com "Registrar tratamento". **Condicional** à STC-592.
- Rótulos da interface: "período de direito", "limite para tirar", "férias tiradas" (SRS §3.1).

### P5.4 Parâmetros (Importação e regras) — `mockup_parametros_gestao_rh.html` · STC-597 construída

- Rota `/admin/permissoes/parametros-gestao-rh`, terceira opção do seletor "Seção" de `PermissoesAdmin`, só Admin (Q&G e Operações). Coordenação e setor de Legalização não veem nem pela rota (e a tela nem busca os parâmetros para eles).
- Abas sublinhadas, abre em **Absenteísmo e férias**:
  - parâmetros de absenteísmo numa linha (limite de atraso e saída antecipada, meta, faixa de atenção, faixa crítica), tipos que contam, selo "Versão vigente desde dd/mm/aaaa, por Fulano" ou "Versão inicial" (sem lista de versões); aviso informativo quando não há faixas; limite vazio é obrigatório (não vira 0);
  - régua de férias: "completou o período" só com liga/desliga; "antes do limite" e "antes do início (substituição)" com dias e liga/desliga; "limite vencido" não aparece; erro da API na linha do marco;
  - "Cancelar" e "Salvar" de cada seção desabilitados até haver alteração; recarregar a versão vigente não apaga uma edição em andamento;
  - **janela de avaliação não aparece**: entra junto com a STC-592.
- Aba **Importação** (abre normalmente, tudo desligado, sem chamar a API, aviso "A importação será ativada quando a fonte dos dados for definida"): período, cartões dos **2 relatórios usados hoje** (espelho de ponto e pendências, em XLS; o espelho sai um centro de custo por vez, as pendências ainda a confirmar), cada um aceitando vários arquivos; histórico de lotes vazio.
- **STC-595**: ativa a aba Importação, liga à API (STC-587) e ajusta à fonte definida (validação de layout por arquivo, ou sincronização no lugar do upload se for API).

### P5.5 Abertura pelo card do Kanban

- Sem mudança no Kanban. O backend grava `origem_url`: férias `/modulos/gestao-rh/ferias?colaborador=<id>&periodo=<id>` (gravada pelo motor da STC-590); absenteísmo `/modulos/gestao-rh?colaborador=<id>&inicio=&fim=` (STC-592).
- O Painel de Férias deriva o modal aberto da querystring a cada renderização (abrir e fechar só trocam a URL), abre na aba certa e rola até o card do período, destacado. Clique na linha do painel abre só com `?colaborador=`, sem período em foco.

---

## Pacote P6 — Testes e Homologação
**Datas:** 19–20/10 · 2 dias úteis

- Já cobertos (STC-597): seção só para Admin, faixas as duas ou nenhuma, estado sem faixas, limite vazio, "completou o período" sem dias, "limite vencido" ausente, versão inicial, botões só com alteração, erro da API no campo e na linha do marco, edição preservada ao recarregar, aba Importação desligada.
- A fazer: coluna de faixa escondida sem critérios, "provisório", ações de férias conforme `pode_*`, justificativa obrigatória, abertura por querystring na aba e período certos.
- `tsc`, lint e testes limpos; conferência visual contra as telas reais do Atlas.

## Pacote P7 — Go-Live

- Entrada "Gestão RH" de `modulos-futuros.ts` já com `codigo`/`rota`; liberação real por `Modulo.status=ativo` no backend, sem deploy de frontend (mecanismo da STC-423).

## Fast-follow (pós Go-Live, sem prazo definido)

- Fase 2 da importação (API do VR Pontomais): a aba Importação passa a mostrar a sincronização automática e deixa o upload manual como contingência.
- Férias divididas em partes, se a Gestão de RH confirmar (pergunta 10).
- Modo responsivo dos painéis (mesmo desenho decidido para o Mapa de Conformidade).
