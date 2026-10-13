# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Gestão RH (MP003)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001/MP002)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Entrega do desenvolvimento:** 16/10/2026 · **Testes e pente fino:** 19–20/10 · **Apresentação e Go-Live:** 21/10/2026 (cronograma acordado com o Tech Lead em 30/09/2026)
**Fonte:** `Plano de Ação - Gestão RH.md` (raiz do repositório da Plataforma) §4/§6/§8, SRS `docs/Gestão RH/SRS - Gestão RH.md` §3.1 (Regras de Interface), contrato de API em `backend/docs/PLANEJAMENTO_GESTAO_RH.md` e mockups em `docs/Gestão RH/mockup_*.html`.

> **Visual: as telas reais do Atlas mandam, não os mockups.** Os mockups definem conteúdo e regras de cada tela; o desenho segue o que já existe no produto: seções empilhadas na largura toda com título, descrição e separador (Administração: Usuários, Catálogo de Legalização), abas sublinhadas (detalhe do documento da Legalização), tabelas com borda e cabeçalho cinza em maiúsculas, ação principal à direita.

> **Fonte dos dados de ponto: RPA (07/10/2026).** Um robô no servidor físico baixa 3 relatórios do VR Pontomais (Jornada, Abonos, Pendências) e os envia à rota de importação; o upload manual pela aba Importação é a contingência. O frontend não fala com o robô: só mostra a origem de cada lote (manual ou robô).

> **Férias desligada nesta fase** (STC-687): o módulo mostra só o absenteísmo. A chave é `FERIAS_ATIVA` em `src/config/gestaoRH.ts` (`false`). Desligada: Gestão RH é link direto para o Painel de Absenteísmo (sem submenu); `/modulos/gestao-rh/ferias` redireciona para ele, levando o `?colaborador=` dos links antigos do Kanban; o modal mostra só o absenteísmo, sem abas; os Parâmetros ficam com a aba "Absenteísmo", sem a régua de férias. O código de férias segue no repositório e os testes dele rodam com a chave ligada (`vi.mock("@/config/gestaoRH")`); `FeriasDesligada.test.tsx` cobre a chave desligada. Religar: `true` aqui e reativar a agenda da varredura de férias no backend (STC-686).

### Situação por issue

| Issue | Pacote | Situação |
| --- | --- | --- |
| STC-597 Seção Parâmetros de Gestão RH (aba Absenteísmo e férias, Importação desligada) | P5.4 | ✅ Mergeada |
| STC-599 Base do módulo (menu, casca do modal, tipos e hooks de férias), Painel de Férias e aba Férias do modal | P5.1/P5.2/P5.3/P5.5 | ✅ Mergeada |
| STC-596 Painel de Absenteísmo, sobre o contrato da STC-588 com dados de exemplo locais | P5.1 | ✅ Mergeada |
| STC-598 Aba Absenteísmo do modal, com registro de tratamento, sobre o contrato da STC-592 | P5.3/P5.5 | ✅ Mergeada |
| STC-679 Aviso "Acionar o RH até" no formulário de programar férias | P5.3 | ✅ Mergeada |
| STC-601 Testes e verificação visual do módulo | P6 | ✅ Concluída |
| STC-684 Modal e tabelas dos painéis no celular | P5.1/P5.3 | ✅ Mergeada |
| STC-687 Férias escondida por `FERIAS_ATIVA` | P5 | ✅ Mergeada |
| STC-595 Aba Importação: 3 relatórios, um arquivo cada | P5.4 | ⏳ Destravada (rodada RPA), depende da STC-587 |
| Aba Equipes nos Parâmetros (categoria, unidade, responsável por categoria) | P5.4 | ⏳ Nova (rodada RPA) |
| Painel e modal com equipes sem unidade (filtro de categoria) | P5.1/P5.3 | ⏳ Nova (rodada RPA), depende da STC-588 |

---

## O que já está pronto

- Layout base, NextAuth, middleware, API client autenticado (`lib/api.ts`), `useAuth()` com os flags de perfil (`isAdminOps`, `isAdminQG`, `isCoordenacaoUnidade`, `isSetorLeg`).
- **Entrada "Gestão RH"** em `config/modulos-futuros.ts` com `codigo`, `rota` e os subitens Painel de Absenteísmo (STC-596) e Painel de Férias (STC-599). Continua "em breve" na Sidebar e no Hub até `Modulo.status=ativo` no backend (P7), que só acontece depois da rota real de absenteísmo (STC-588); "em breve" só esconde o menu, a rota direta abre a tela.
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
│   ├── page.tsx                               → ✅ Painel de Absenteísmo (?colaborador=<id> abre o modal)
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
│   ├── PainelAbsenteismo.tsx · CardsAbsenteismo.tsx · TabelaAbsenteismo.tsx  → ✅ STC-596
│   ├── CardIndicador.tsx                      → ✅ card de indicador dos dois painéis
│   ├── AbaAbsenteismo.tsx · FormRegistrarTratamento.tsx                → ✅ STC-598
│   └── CampoPeriodo.tsx · HistoricoRH.tsx     → ✅ período e histórico compartilhados (painel e abas)
├── hooks/
│   ├── useParametrosGestaoRH.ts               → ✅ useParametrosAbsenteismo, useReguaFerias
│   ├── useFeriasGestaoRH.ts                   → ✅ usePainelFerias, useColaboradorRH, useFeriasColaborador
│   └── useAbsenteismoGestaoRH.ts              → ✅ usePainelAbsenteismo
├── lib/gestaoRH.ts · lib/gestaoRHFerias.ts · lib/gestaoRHAbsenteismo.ts  → ✅ parâmetros · férias · absenteísmo
├── lib/gestaoRHAbsenteismoExemplo.ts      → dados de exemplo do painel, só no ambiente local (ver P5.1)
└── types/gestaoRH.ts                     → ✅ parâmetros, férias e painel de absenteísmo
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
| `absenteismo/?inicio=&fim=&unidade=&faixa=&ocorrencia=&com_pendencias=` | GET | Painel de Absenteísmo: `periodo`, `parametros`, `cards`, `linhas`. Contrato fixado na STC-588 (faixa e ocorrência repetem: `faixa=a&faixa=b`) | contrato ✅ · rota a fazer (STC-588) |
| `colaboradores/{id}/absenteismo/?inicio=&fim=` | GET | Aba Absenteísmo: `periodo`, `parametros`, `indicadores`, `ocorrencias`, `alertas`, `historico`. Contrato fixado na STC-592 | contrato ✅ · rota a fazer (STC-592) |
| `colaboradores/{id}/tratamentos/` | POST | `alerta`, `acao` (`feedback`, `advertencia`, `desligamento`, `sem_medida`, proposta do SRS), `justificativa`; devolve a aba no período do alerta | contrato ✅ · rota a fazer (STC-592) |
| `importacoes/` e afins | | Importação | ⛔ depende da fonte (STC-587) |

`{id}` em `ferias/{id}/` é o do período de férias. Acesso: Admin Q&G e Admin Operações tudo; coordenação e OPEX só a própria unidade (fora dela, 404); demais perfis 403. Percentuais chegam como string decimal ("5.00").

---

## Pacote P5 — Frontend: Interface Operacional

### Tipos e hooks

- `types/gestaoRH.ts` espelha os serializers (snake_case, lição da STC-377). Férias: `LinhaPainelFerias`, `CardsFerias`, `CabecalhoColaborador`, `FeriasColaborador` (períodos pendentes com `marcos`, `programacao`, `adiamento`, `pode_programar`/`pode_adiar`/`pode_registrar_rh_acionado`; férias tiradas; período em andamento; histórico).
- Hooks SWR com chave por filtro (padrão de `useDocumentosLegalizacao.ts`). As ações de férias devolvem a aba atualizada: trocar o cache pela resposta, sem segunda requisição (mesmo padrão de `useParametrosGestaoRH.ts`).

### P5.1 Menu Gestão RH e Painel de Absenteísmo — `mockup_painel_absenteismo_gestao_rh.html`

- ✅ STC-596, **construída sobre o contrato antes do backend** (06/10/2026): a fonte dos dados de ponto segue indefinida, mas o que a tela mostra já está definido pela SRS e pelo mockup. O contrato de `GET /absenteismo/` está no texto da STC-588; mudança nele precisa ser combinada com a tela.
- Subitem Painel de Absenteísmo no menu; rota `/modulos/gestao-rh`. Período livre (padrão: mês anterior fechado; com o fim antes do início, não busca e mantém o último válido), cards (absenteísmo com a meta, faixa crítica, faixa de atenção, pendências de ponto, colaboradores), filtros unidade (só Admin) · faixa · ocorrência · com pendências + busca, tabela com ordenação pelo cabeçalho. Mesmo visual do Painel de Férias (`CardIndicador` compartilhado).
- Abre filtrando "Crítica e atenção" (como no mockup), já na primeira busca; escolher outra opção, inclusive "Todas", vale até sair da tela. Sem faixas cadastradas a API ignora o filtro (contrato da STC-588): a tela esconde os cards, o filtro e o selo de faixa, mas continua enviando o filtro (trocá-lo custaria uma busca a mais com o mesmo resultado). Troca de filtro esmaece cards e tabela até a resposta chegar, nos dois painéis (mesmo sinal do Kanban). Sem meta, o card não mostra meta ("no período selecionado"). Percentual com "provisório · N pendências"; sem dia previsto no período, traço em dias, percentual e conformidade.
- Período no mesmo formato do filtro de data da Matriz (rótulos e datas numa borda só).
- Coluna "Ocorrências" em texto ("2 faltas · 1 atestado" / "1 atraso · 1 saída antecipada >15min") no lugar das colunas "Faltas · Atestados" e "Atrasos · Saídas" do mockup: os pares de números não diziam qual era qual. Afastamentos e ausências ficam na aba do modal.
- Linha clicável abre o modal do colaborador (`?colaborador=`).
- **Dados de exemplo locais**: `NEXT_PUBLIC_GESTAO_RH_DADOS_EXEMPLO=1` no `.env.local` faz a aba Absenteísmo do modal (`buscarAbsenteismoColaborador`, `registrarTratamento`) devolver `lib/gestaoRHAbsenteismoExemplo.ts` enquanto as rotas da STC-592 não existem (ids dos colaboradores fictícios do banco local). O Painel já usa a rota real (STC-588); as linhas de exemplo seguem como dados de teste. A condição também exige `NODE_ENV !== "production"`: no build de produção o ramo some e o módulo de exemplo não entra no pacote, mesmo com a variável ligada (conferido no build).
- **Equipes sem unidade (rodada RPA, STC-697)**: TMO e Campanha não têm unidade do Atlas; o colaborador vem com `unidade` nula. A coluna "Unidade / equipe" do Painel e o cabeçalho do modal mostram a equipe do VR (`equipe`, no cabeçalho pela STC-721). Filtro de categoria (Unidades · TMO · Campanhas · Todas) só para Admin: Coordenação e OPEX já recebem só a própria unidade. Faixa "dados desatualizados" no topo do Painel quando `cards.importacao_parada`, para todos que veem o Painel. O Painel de Férias mostra "Sem unidade" para eles, porque a linha de Férias não traz a equipe (Férias desligado nesta fase).

### P5.2 Painel de Férias — `mockup_painel_ferias_gestao_rh.html`

- ✅ STC-599. Rota `/modulos/gestao-rh/ferias`. "Marcos nos próximos" 30, 60, 90 (padrão) ou 180 dias, com a legenda "Quem tem demanda aberta ou limite vencido aparece sempre"; busca por nome (sem acento) ou matrícula; filtro de status; filtro de unidade só para Admin (coordenação e OPEX já recebem só a própria unidade).
- Cards (de `cards`), no desenho dos cards da Matriz: limite vencido · perto do limite ("a menos de `dias_perto_do_limite` dias") · sem programação · acionar o RH · programação adiada; "N alertas e N demandas geradas nos últimos N dias · Última importação" (ou "Nenhuma importação ainda").
- Uma linha por colaborador: colaborador (matrícula · cargo) · unidade · período de direito (com "+N período pendente") · limite · próximo marco em duas linhas (o evento e a data; "Nenhum / limite vencido há N dias") · status · situação (programação, adiada ou demandas abertas). Ordem do backend.
- No celular, a página rola inteira (cards e filtros não deixam altura para a tabela travada). Nos dois painéis, a coluna Colaborador fica congelada ao rolar a tabela para o lado, como nas tabelas da Administração (`colunaFixa.ts`, STC-684).

### P5.3 Modal do Colaborador — `mockup_detalhe_colaborador_{absenteismo,ferias,ferias_acumuladas}.html`

- ✅ Casca e aba Férias na STC-599. Modal único, no desenho do detalhe do documento da Legalização: nome, cargo e unidade no topo; unidade, cargo, matrícula e admissão na coluna da esquerda (no celular essa coluna some e matrícula e admissão vão para a linha do cabeçalho, para as abas ganharem a altura do modal, STC-684); abas sublinhadas à direita, **carga só da aba aberta** (cabeçalho de `colaboradores/{id}/`, aba Férias de `colaboradores/{id}/ferias/`, aba Absenteísmo de `colaboradores/{id}/absenteismo/`). Abas na ordem do mockup (Absenteísmo, Férias), abrindo na de quem chamou o modal; cada aba carrega na primeira visita e depois fica montada, escondida quando inativa (trocar de aba não perde formulário nem período). Cada aba mostra o próprio histórico no fim. Colaborador desligado: só leitura.
- **Aba Férias**: um card por período pendente, do mais antigo para o mais recente, aviso quando houver mais de um; marcos com a situação (`alerta_gerado`, `tratado`, `proximo`, `futuro`, `sem_alerta`, `vencido`); ações "Programar férias" e "Não programar agora" abrindo uma por vez dentro do card, conforme `pode_programar`/`pode_adiar`/`pode_registrar_rh_acionado`.
  - Programar (ou "Reprogramar férias", preenchido com a programação atual): início/fim, dias calculados, toggle de substituição. As regras do backend são conferidas também na tela antes de enviar (início a partir de hoje, no máximo 30 dias, **terminar até o limite para tirar**; com limite vencido aceita, com aviso de pagamento em dobro); a mensagem do 400 vai para o campo. Com substituição ligada e início preenchido, o formulário mostra "Acionar o RH até <data> (N dias antes do início das férias)" antes de registrar, pela antecedência que a rota de férias devolve (`dias_antes_do_inicio_substituicao`, STC-678/679): "hoje" quando o prazo é o dia atual, em vermelho quando já passou (o registro segue permitido), "no dia do início" com 0 dias; com o marco desativado, sem aviso.
  - Com as férias programadas, marcos ainda à frente aparecem como "sem alerta: férias programadas" (o motor não dispara marcos de período programado).
  - Adiar: justificativa obrigatória; só período pendente e dentro do limite. Mostrar "adiada em <data> por <quem>" (`adiamento`).
  - "RH acionado" junto do aviso de substituição, com confirmação (não pode ser desfeito); depois de registrado, "RH acionado em <data> por <responsável>".
  - Férias já tiradas recolhidas; período em andamento como linha informativa.
- **Aba Absenteísmo** (✅ STC-598, sobre o contrato da STC-592, com os mesmos dados de exemplo locais do painel): período livre (o do painel, o do alerta pelo Kanban ou o mês anterior fechado), aviso de pendências, indicadores numa faixa compacta (não os cards dos painéis), ocorrências com "conta/não conta", "em aprovação" e "acima de N min" (atestado sem dado clínico), card do alerta ("Alerta de setembro/2026") com "Registrar tratamento" abrindo no card (ação da lista proposta do SRS + justificativa obrigatória) e, depois, o tratamento registrado; histórico. A resposta do tratamento vem no período do alerta: só substitui o cache se for o período na tela, senão busca de novo.
- **Abertura**: pelo Painel de Absenteísmo, aba Absenteísmo no período do painel (`?colaborador=`); pelo card do Kanban (`?colaborador=&inicio=&fim=`, `origem_url` da STC-592), no período do alerta, rolando e levando o foco ao card do alerta; pelo Painel de Férias, aba Férias.
- Rótulos da interface: "período de direito", "limite para tirar", "férias tiradas" (SRS §3.1).

### P5.4 Parâmetros (Importação e regras) — `mockup_parametros_gestao_rh.html` · STC-597 construída

- Rota `/admin/permissoes/parametros-gestao-rh`, terceira opção do seletor "Seção" de `PermissoesAdmin`, só Admin (Q&G e Operações). Coordenação e setor de Legalização não veem nem pela rota (e a tela nem busca os parâmetros para eles).
- Abas sublinhadas, abre em **Absenteísmo e férias**:
  - parâmetros de absenteísmo numa linha (limite de atraso e saída antecipada, meta, faixa de atenção, faixa crítica), tipos que contam, selo "Versão vigente desde dd/mm/aaaa, por Fulano" ou "Versão inicial" (sem lista de versões); aviso informativo quando não há faixas; limite vazio é obrigatório (não vira 0);
  - régua de férias: "completou o período" só com liga/desliga; "antes do limite" e "antes do início (substituição)" com dias e liga/desliga; "limite vencido" não aparece; erro da API na linha do marco;
  - "Cancelar" e "Salvar" de cada seção desabilitados até haver alteração; recarregar a versão vigente não apaga uma edição em andamento;
  - **janela de avaliação não aparece**: entra junto com a STC-592.
- Aba **Importação** (hoje desligada, sem chamar a API, com o aviso "A importação será ativada quando a fonte dos dados for definida").
- **STC-595 (rodada RPA):** ativa a aba e liga à API (STC-587): período (padrão dia 1 do mês anterior até ontem), **três cartões (Jornada, Abonos, Pendências), um arquivo cada, com todas as equipes**, XLSX; recusa de layout com a coluna faltante; histórico de lotes com a origem (manual ou robô), linhas rejeitadas ("N · ver") e equipes novas sem categoria. É a contingência do robô.
- **Aba Equipes (rodada RPA):** as equipes do VR com categoria (Unidade, TMO, Campanha, Fora do indicador) e unidade do Atlas editáveis, destaque para as "Sem categoria"; responsável por categoria (TMO, Campanha) na aba de parâmetros.

### P5.5 Abertura pelo card do Kanban

- Sem mudança no Kanban. O backend grava `origem_url`: férias `/modulos/gestao-rh/ferias?colaborador=<id>&periodo=<id>` (gravada pelo motor da STC-590); absenteísmo `/modulos/gestao-rh?colaborador=<id>&inicio=&fim=` (STC-592).
- O Painel de Férias deriva o modal aberto da querystring a cada renderização (abrir e fechar só trocam a URL), abre na aba certa e rola até o card do período, destacado. Clique na linha do painel abre só com `?colaborador=`, sem período em foco.

---

## Pacote P6 — Testes e Homologação
**Datas:** 19–20/10 · 2 dias úteis

- Já cobertos (STC-597): seção só para Admin, faixas as duas ou nenhuma, estado sem faixas, limite vazio, "completou o período" sem dias, "limite vencido" ausente, versão inicial, botões só com alteração, erro da API no campo e na linha do marco, edição preservada ao recarregar, aba Importação desligada.
- Já cobertos também (STC-596/598/599/601): faixa escondida sem critérios, "provisório", ações de férias, justificativa obrigatória, abertura por querystring.
- A fazer (rodada RPA): aba Importação com os 3 relatórios, aba Equipes, filtro de categoria e unidade nula.
- `tsc`, lint e testes limpos; conferência visual contra as telas reais do Atlas.

## Pacote P7 — Go-Live

- Entrada "Gestão RH" de `modulos-futuros.ts` já com `codigo`/`rota`; liberação real por `Modulo.status=ativo` no backend, sem deploy de frontend (mecanismo da STC-423).

## Fast-follow (pós Go-Live, sem prazo definido)

- Gestão de férias inteira (telas prontas atrás de `FERIAS_ATIVA`), quando a fonte de férias for definida.
- Férias divididas em partes, se a Gestão de RH confirmar (pergunta 10).
- Modo responsivo dos painéis (mesmo desenho decidido para o Mapa de Conformidade).
