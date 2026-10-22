# Planejamento Técnico — Frontend
## Plataforma Web de Operações · Módulo Gestão RH (MP003)

**Stack:** Next.js 15 · React · TypeScript · Tailwind · shadcn/ui (mesmo projeto do MP001/MP002)
**Repositório:** `QualidadeGestaoBRMED/operacoes-web-frontend`
**Entrega do desenvolvimento:** 16/10/2026 · **Testes e pente fino:** 19–20/10 · **Apresentação e Go-Live:** 21/10/2026 (cronograma acordado com o Tech Lead em 30/09/2026)
**Fonte:** `Plano de Ação - Gestão RH.md` (raiz do repositório da Plataforma) §4/§6/§8, SRS `docs/Gestão RH/SRS - Gestão RH.md` §3.1 (Regras de Interface), contrato de API em `backend/docs/PLANEJAMENTO_GESTAO_RH.md` e mockups em `docs/Gestão RH/mockup_*.html`.

> **Visual: as telas reais do Atlas mandam, não os mockups.** Os mockups definem conteúdo e regras de cada tela; o desenho segue o que já existe no produto: seções empilhadas na largura toda com título, descrição e separador (Administração: Usuários, Catálogo de Legalização), abas sublinhadas (detalhe do documento da Legalização), tabelas com borda e cabeçalho cinza em maiúsculas, ação principal à direita.

> **Fonte dos dados de ponto: RPA (07/10/2026).** Um robô no servidor físico baixa 3 relatórios do VR Pontomais (Jornada, Abonos, Pendências) e os envia à rota de importação; o upload manual pela aba Importação é a contingência. O frontend não fala com o robô: só mostra a origem de cada lote (manual ou robô).

> **Férias desligada nesta fase** (STC-687): o módulo mostra só o absenteísmo. A chave é `FERIAS_ATIVA` em `src/config/gestaoRH.ts` (`false`). Desligada: o submenu de Gestão RH tem só o Painel de Absenteísmo (mais os Parâmetros, para Admin; STC-728); `/modulos/gestao-rh/ferias` redireciona para ele, levando o `?colaborador=` dos links antigos do Kanban; o modal mostra só o absenteísmo, sem abas; os Parâmetros ficam com a aba "Absenteísmo", sem a régua de férias. O código de férias segue no repositório e os testes dele rodam com a chave ligada (`vi.mock("@/config/gestaoRH")`); `FeriasDesligada.test.tsx` cobre a chave desligada. Religar: `true` aqui e reativar a agenda da varredura de férias no backend (STC-686).

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
| STC-728 Gestão RH expansível na sidebar, com atalho para os Parâmetros | P5.1/P5.4 | ✅ Mergeada |
| STC-595 Aba Importação: 3 relatórios, um arquivo cada | P5.4 | ✅ Mergeada |
| STC-694 Aba Equipes nos Parâmetros (categoria, unidade) | P5.4 | ✅ Mergeada |
| STC-697 Painel e modal com equipes sem unidade (filtro de categoria) | P5.1/P5.3 | ✅ Mergeada |
| STC-725 Responsável por TMO e Campanha só entre os Admins ativos | P5.4 | ✅ Mergeada |
| STC-726 Janela de avaliação nos Parâmetros e aba Absenteísmo do modal nas rotas reais da STC-592 | P5.3/P5.4 | ✅ Mergeada |
| STC-724 Conversa da demanda na aba Absenteísmo do modal (comentários da STC-723) | P5.3 | ✅ Mergeada |
| STC-736 Justificativas pendentes no VR, cards de faixa como atalho e Ausência justificada (Semanal 14/10) | P5.1/P5.3/P5.4 | ✅ Mergeada |
| STC-737 Comparativo do absenteísmo com o período anterior (Semanal 14/10) | P5.1 | ✅ Mergeada |
| STC-735 Turno variável na aba Equipes e jornada incompleta no Painel e no modal (Semanal 14/10) | P5.1/P5.3/P5.4 | ✅ Mergeada |
| STC-749 Absenteísmo mês a mês pela rota agregada da STC-748 | P5.1 | ✅ Mergeada |
| STC-767 Painel e mês a mês mostram os parâmetros usados (rota da STC-766) | P5.1 | ✅ Mergeada |
| STC-791 Cards sem buraco no celular e selo de faixa alinhado na tabela | P5.1 | ✅ Mergeada |
| STC-740 Painel de Horas Extras (rota da STC-739) | P5.1 | ✅ Mergeada |
| STC-753 Categoria Operações Especiais na aba Equipes e painéis sem o filtro de categoria (Semanal 14/10) | P5.1/P5.4 | ✅ Mergeada |
| STC-850 Anexos no card de absenteísmo (rotas da STC-846) | P5.3 | 🔄 Em andamento |

---

## O que já está pronto

- Layout base, NextAuth, middleware, API client autenticado (`lib/api.ts`), `useAuth()` com os flags de perfil (`isAdminOps`, `isAdminQG`, `isCoordenacaoUnidade`, `isSetorLeg`).
- **Entrada "Gestão RH"** em `config/modulos-futuros.ts` com `codigo`, `rota` e os subitens Painel de Absenteísmo (STC-596) e Painel de Férias (STC-599, só com `FERIAS_ATIVA`). A Sidebar acrescenta "Parâmetros de Gestão RH" (`/admin/permissoes/parametros-gestao-rh`) para Admin, como o "Catálogo de Legalização"; com um subitem só (coordenação e OPEX, férias desligada), o item é link direto (STC-728). Continua "em breve" na Sidebar e no Hub até `Modulo.status=ativo` no backend (P7), que só acontece depois da rota real de absenteísmo (STC-588); "em breve" só esconde o menu, a rota direta abre a tela.
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
│   └── useAbsenteismoGestaoRH.ts              → ✅ usePainelAbsenteismo, useAbsenteismoColaborador
├── lib/gestaoRH.ts · lib/gestaoRHFerias.ts · lib/gestaoRHAbsenteismo.ts  → ✅ parâmetros · férias · absenteísmo
├── test-utils/painelAbsenteismoExemplo.ts → linhas de exemplo do Painel de Absenteísmo, só para os testes
└── types/gestaoRH.ts                     → ✅ parâmetros, férias e painel de absenteísmo
```

Tabelas **sem paginação**, rolagem dentro da tabela com cabeçalho fixo (mesmo padrão da Matriz de Conformidade; SRS §3.1).

---

## Contrato de API (prefixo `api/modulos/gestao-rh/`)

| Rota | Método | Uso | Situação |
| --- | --- | --- | --- |
| `parametros/` · `regua-ferias/` | GET, POST | Seção Parâmetros (só Admin). POST devolve 201 com versão nova ou 200 sem mudança. `janela_avaliacao`: `{tipo, dias}` (`dias` nulo no mês anterior fechado, 7 a 90 nos últimos N dias); ausente no POST mantém a atual, `null` desliga | ✅ |
| `ferias/?janela_dias=&unidade=&status=` | GET | Painel de Férias: `linhas` + `cards` | ✅ |
| `colaboradores/{id}/` | GET | Cabeçalho do modal (nome, cargo, unidade, matrícula, admissão, `alertas_pendentes` por aba) | ✅ |
| `colaboradores/{id}/ferias/` | GET | Aba Férias | ✅ |
| `ferias/{id}/` | PATCH | `acao=programar` (`data_inicio`, `data_fim`, `necessita_substituicao`) ou `acao=adiar` (`justificativa`); devolve a aba Férias atualizada | ✅ |
| `ferias/{id}/rh-acionado/` | POST | "RH acionado"; devolve a aba Férias atualizada | ✅ |
| `absenteismo/?inicio=&fim=&unidade=&faixa=&ocorrencia=&com_pendencias=` | GET | Painel de Absenteísmo: `periodo`, `parametros`, `cards`, `linhas`. Contrato fixado na STC-588 (faixa e ocorrência repetem: `faixa=a&faixa=b`) | ✅ |
| `colaboradores/{id}/absenteismo/?inicio=&fim=` | GET | Aba Absenteísmo: `periodo`, `parametros`, `indicadores`, `ocorrencias`, `alertas`, `historico`. Contrato fixado na STC-592; cada alerta traz também `provisorio`, e `responsavel` é quem está com a demanda hoje | ✅ |
| `colaboradores/{id}/tratamentos/` | POST | `alerta`, `acao` (`feedback`, `advertencia`, `desligamento`, `sem_medida`, proposta do SRS), `justificativa`; devolve a aba no período do alerta. Alerta já tratado ou encerrado: 400 `{"alerta": "..."}` | ✅ |
| `importacoes/` e afins | | Importação | ✅ (STC-587) |

`{id}` em `ferias/{id}/` é o do período de férias. Acesso: Admin Q&G e Admin Operações tudo; coordenação e OPEX só a própria unidade (fora dela, 404); demais perfis 403. Percentuais chegam como string decimal ("5.00").

---

## Pacote P5 — Frontend: Interface Operacional

### Tipos e hooks

- `types/gestaoRH.ts` espelha os serializers (snake_case, lição da STC-377). Férias: `LinhaPainelFerias`, `CardsFerias`, `CabecalhoColaborador`, `FeriasColaborador` (períodos pendentes com `marcos`, `programacao`, `adiamento`, `pode_programar`/`pode_adiar`/`pode_registrar_rh_acionado`; férias tiradas; período em andamento; histórico).
- Hooks SWR com chave por filtro (padrão de `useDocumentosLegalizacao.ts`). As ações de férias devolvem a aba atualizada: trocar o cache pela resposta, sem segunda requisição (mesmo padrão de `useParametrosGestaoRH.ts`).

### P5.1 Menu Gestão RH e Painel de Absenteísmo — `mockup_painel_absenteismo_gestao_rh.html`

- ✅ STC-596, **construída sobre o contrato antes do backend** (06/10/2026): a fonte dos dados de ponto segue indefinida, mas o que a tela mostra já está definido pela SRS e pelo mockup. O contrato de `GET /absenteismo/` está no texto da STC-588; mudança nele precisa ser combinada com a tela.
- Subitem Painel de Absenteísmo no menu; rota `/modulos/gestao-rh`. Período livre (padrão: mês anterior fechado; com o fim antes do início, não busca e mantém o último válido), cards (absenteísmo com o limite, faixa crítica, faixa de atenção, justificativas pendentes no VR, colaboradores), filtros unidade (só Admin) · faixa · ocorrência · com justificativa pendente + busca, tabela com ordenação pelo cabeçalho. Mesmo visual do Painel de Férias (`CardIndicador` compartilhado).
- Abre filtrando "Crítica e atenção" (como no mockup), já na primeira busca; escolher outra opção, inclusive "Todas", vale até sair da tela. Sem faixas cadastradas a API ignora o filtro (contrato da STC-588): a tela esconde os cards, o filtro e o selo de faixa, mas continua enviando o filtro (trocá-lo custaria uma busca a mais com o mesmo resultado). Troca de filtro esmaece cards e tabela até a resposta chegar, nos dois painéis (mesmo sinal do Kanban). Sem limite, o card não mostra limite ("no período selecionado"). "Limite", não "meta": o objetivo é ficar abaixo dele (campo `meta_percentual` na API). Percentual com "provisório · N pendentes" (dica com "N justificativas pendentes no VR": a coluna é estreita); sem dia previsto no período, traço em dias, percentual e conformidade.
- **Cards de faixa como atalho** (STC-736): "Faixa crítica" e "Faixa de atenção" são botões (`aria-pressed`). O clique mantém período, unidade e categoria (os cards contam só a unidade e a categoria filtradas), aplica "Só crítica" ou "Só atenção", limpa ocorrência, justificativa pendente e busca (para a tabela bater com o número do card) e rola até a tabela; clicar no card selecionado volta para "Crítica e atenção". Os rótulos dos cards do absenteísmo quebram em até duas linhas, com a altura reservada para os números ficarem alinhados (`rotuloEmDuasLinhas` no `CardIndicador`; os de Férias seguem cortando). **Grade sem buraco (STC-791):** o card Absenteísmo ocupa 2 colunas onde a grade não fecharia (`LARGURA_DO_ABSENTEISMO`): no celular (2 colunas) sempre, e no tablet (3 colunas) só com os 5 cards; no computador (5 colunas), uma. O esqueleto de carregamento segue a mesma grade. Na tabela, o percentual tem a largura do maior valor (`6ch`) e fica alinhado à direita, para os selos de faixa formarem uma coluna reta.
- **Comparativo com o período anterior** (STC-737): segunda busca à mesma rota (`GET /absenteismo/`), com a unidade e a categoria do Painel e sem os filtros de linha (os cards contam todos). Período anterior: mês inteiro compara com o mês inteiro anterior; qualquer outro período, com o mesmo número de dias logo antes (`periodoAnterior`). A legenda do card de Absenteísmo mostra a diferença em pontos percentuais ("▲ +0,8 p.p. vs. setembro", com dica explicando p.p., vermelho ao subir, verde ao cair), com "(parcial)" quando o fim do período ainda não passou; sem percentual em um dos lados, ou com um dos lados ainda do filtro antigo, fica como antes. A diferença é calculada em centésimos, arredondando para longe do zero. Clicar no card abre **"Absenteísmo mês a mês"** (`AbsenteismoMensalModal`, carregado sob demanda com `next/dynamic` para o Recharts não pesar na abertura do Painel): seletor de ano (de 2026, primeiro ano com dados, ao atual; abre no ano do período do Painel), uma busca por ano à rota agregada `GET /absenteismo/mensal/` (STC-748, STC-749), com a unidade e a categoria do Painel, só com o modal aberto (`useAbsenteismoMensal`): reabrir mostra na hora o que já tinha e busca a versão atual em segundo plano (mudança de importação, parâmetros ou turno variável em outra tela da sessão aparece sem recarregar); voltar à aba não busca de novo; os meses sem dado e os futuros já vêm marcados pelo backend, gráfico de linha (Recharts pelo `components/ui/chart.tsx` do shadcn) com o limite tracejado e o trecho até o mês em andamento tracejado, com ponto vazado; tabela dos meses com dado: o mês em andamento como "out · até 12/10" (data dos dados, no lugar de selo), percentual, variação para o mês anterior em p.p. (vazia sem mês anterior com dado), crítica e atenção ("sem faixas" quando a versão dos parâmetros usada não tem faixas); mais "Sem dados: jan a ago" (sequências agrupadas). Sem selo de provisório: as justificativas pendentes ficam no card do Painel. O gráfico fica oculto para leitor de tela: a tabela traz os mesmos números. Limitação: considera os colaboradores ativos hoje (o Painel não traz desligados), dito na dica da visão.
- Período no mesmo formato do filtro de data da Matriz (rótulos e datas numa borda só).
- Coluna "Ocorrências" em texto ("2 faltas · 1 atestado" / "1 atraso · 1 saída antecipada >15min") no lugar das colunas "Faltas · Atestados" e "Atrasos · Saídas" do mockup: os pares de números não diziam qual era qual. Afastamentos e ausências ficam na aba do modal. Nas equipes de turno variável (STC-735), "N jornadas incompletas" na mesma linha de atraso e saída, e "Jornada incompleta" no filtro de ocorrência; contagem ausente na resposta (backend anterior à STC-734) não aparece.
- Linha clicável abre o modal do colaborador (`?colaborador=`).
- **Dados de exemplo**: o Painel e a aba Absenteísmo do modal usam só as rotas reais (STC-588, STC-592). As linhas de exemplo do Painel ficam em `test-utils/painelAbsenteismoExemplo.ts`, só como dados de teste.
- **Só a rede própria (STC-753, rota da STC-752):** os painéis contam só a categoria Unidade, e o filtro de categoria saiu do Painel de Absenteísmo, do mês a mês e do Painel de Horas Extras; a coluna se chama "Unidade". Colaborador ainda sem unidade do Atlas (`unidade` nula) mostra a equipe do VR na coluna e no cabeçalho do modal (`equipe`, no cabeçalho pela STC-721). Faixa "dados desatualizados" no topo do Painel quando `cards.importacao_parada`, para todos que veem o Painel. O Painel de Férias mostra "Sem unidade" para eles, porque a linha de Férias não traz a equipe (Férias desligado nesta fase).
- **Parâmetros das telas (STC-767, rota da STC-766):** Painel, mês a mês e aba Absenteísmo do modal usam a versão dos parâmetros vigente hoje para qualquer período. O cabeçalho do Painel ganha "· parâmetros vigentes desde dd/mm/aaaa" e o mês a mês, "Todos os meses com os parâmetros vigentes desde dd/mm/aaaa." (`parametros.vigente_a_partir_de`; nada na versão inicial, sem data). A linha de limite do gráfico é a da versão usada (`parametros.meta_percentual` da resposta), não mais a do último mês com dado. Cada alerta da aba diz com que régua foi gerado ("crítica acima de 10% quando gerado", `critica_acima_de`), porque os indicadores do período, com a régua de hoje, podem não estar mais em crítica. O texto da tela de Parâmetros diz a regra nova: a versão vale para os painéis em qualquer período; alertas e demandas já gerados mantêm a deles. Resposta sem os campos novos (backend anterior à STC-766, se o front subir antes): o modal mês a mês abre com o limite do último mês com dado e sem a data, e o alerta fica sem a régua, em vez de quebrar ou mostrar "NaN%".

### Painel de Horas Extras (STC-740)

- Subitem **"Horas Extras"** no submenu do Gestão RH (para todos que veem o módulo); rota `/modulos/gestao-rh/horas-extras` (`PainelHorasExtras`), uma busca a `GET /horas-extras/` (STC-739) por filtro (`usePainelHorasExtras`). Mesmo visual do Painel de Absenteísmo: período livre (padrão: mês anterior fechado), filtro de unidade só para Admin, abaixo dos cards. O filtro de unidade dos três painéis (Absenteísmo, Férias e Horas Extras) lista só a rede própria (`useUnidades("padrao")`, padrão da STC-510): as unidades de Operações Especiais têm o próprio ambiente; a aba Equipes dos Parâmetros lista a rede da categoria (rede própria em Unidade, OPEX em Operações Especiais).
- Cards: total, um por fator com o percentual que a rota leu do VR ("Horas extras 50%", "Horas extras 100%"; sem percentual, "Fator 1"), com a parte do total na legenda ("88% do total"; nas pontas, "menos de 1%" e "mais de 99%"), e colaboradores com hora extra. Dica no card de total: horas além da jornada, como o VR classifica; para quem tem banco de horas, o VR também credita essas horas no saldo (nos dados de 01/09 a 14/10, em 1.293 dos 1.355 dias com hora extra o saldo subiu o mesmo valor; a regra de pagamento do banco segue com o DP, encaminhamento da Semanal 14/10). Horas em horas:minutos:segundos, com ponto de milhar nas horas ("97:55:00", "1.355:52:00", `formatarHoras`; os segundos são sempre "00", porque o VR conta em minutos; o eixo dos gráficos, em horas inteiras, "1.500h"); o painel anterior da Nathalya usava horas decimais ("105.7 h"), que parecem minutos e não batem com o VR.
- Gráficos (`GraficosHorasExtras`, carregado sob demanda com `next/dynamic`, como o mês a mês): barras horizontais empilhadas por fator, top 10 por colaborador e por unidade / equipe ("Top 10 colaboradores em horas extras"). A legenda de cada gráfico ("50%", "100%") é também o seletor de fator (`aria-pressed`): com um fator escolhido, o gráfico mostra só ele, o ranking passa a ser por ele (sem quem tem zero nele) e o título ganha o percentual ("Top 10 colaboradores em horas extras 100%"); clicar de novo volta aos dois. Os dois fatores ficam sempre montados, o não escolhido com `hide` (STC-764): o Recharts empilha na ordem em que as barras montam, e remontar o de 50% depois do de 100% invertia as cores ao tirar o filtro. Cada gráfico escolhe o seu; sem ninguém no fator, "Nenhuma hora extra 100% no período." Nome no eixo cortado com reticências (menos caracteres no celular) e inteiro na dica; a dica da barra traz os dois fatores e o total. Clicar na barra do colaborador o **seleciona**: a barra dele fica em destaque (as outras esmaecem), a tabela mostra só ele ("Mostrando só ..." com "Mostrar todos") e o gráfico ao lado mostra só o cargo dele (ou a unidade / equipe, quando o gráfico ao lado é o por unidade), com o título "Cargo do colaborador em horas extras"; clicar de novo na barra, ou em "Mostrar todos", limpa. A mesma seleção pelo teclado: botão de filtro em cada linha da tabela ("Mostrar só {nome}", `aria-pressed`; no computador aparece no hover e no foco, no celular sempre), já que o gráfico é oculto para leitor de tela. A seleção fica guardada com os filtros em que foi feita: trocar período, unidade ou categoria a descarta, sem ela voltar se o filtro anterior voltar. O modal abre pela linha da tabela. Lado a lado (telas largas), os dois gráficos têm a altura do que tem mais barras, com os eixos na mesma linha; o de menos barras as espaça, com a mesma espessura, em vez de deixar um vazio embaixo. Empilhados (telas estreitas), cada um tem a sua altura. Com uma unidade só na resposta (Admin com a unidade filtrada, coordenação e OPEX, que só recebem a própria), o gráfico por unidade (que teria uma barra só) dá lugar ao **por cargo**; a decisão é pelos dados (`por_unidade` com até uma), não pelo filtro, que só o Admin tem: soma, no próprio front, os colaboradores com hora extra de cada cargo (o cargo como vem do VR; vazio vira "Sem cargo"), no mesmo estilo e com o mesmo seletor de fator; a dica traz quantos colaboradores do cargo fizeram hora extra e a média por colaborador (muita gente com pouca hora extra ou pouca gente com muita). Atende à pergunta da Semanal 14/10: por que uma unidade faz muita hora extra. Ocultos para leitor de tela: a tabela traz os mesmos números.
- Tabela só de quem fez hora extra: colaborador, unidade / equipe, os dois fatores, total e dias com hora extra, ordenável; busca por nome ou matrícula (só na tabela). Tabela numa moldura de 10 linhas inteiras (alturas medidas no navegador), com o cabeçalho fixo e a rolagem por dentro, para a página não ficar imensa com 200 colaboradores; sem paginação, que nenhuma tabela do Atlas tem (a busca e a ordenação acham a pessoa). No celular, sem a moldura: a página rola inteira, como no Painel de Absenteísmo. Linha abre o modal do colaborador na aba Absenteísmo, no período da tela (aba de hora extra no modal fora de escopo).
- Estados: "Sem hora extra no período" (com dado, ninguém fez hora extra); "Sem dado de hora extra neste período" (`com_dado` falso: período importado antes de o VR trazer as horas extras), com os cards em traço em vez de zero; aviso "Período parcial" (`parcial`) acima dos cards.

- **Code review automático (1ª rodada):** 5 pontos. Corrigidos: seleção do colaborador só pelo mouse (botão de filtro na linha da tabela) e seleção guardada depois de trocar o filtro (presa aos filtros em que foi feita). Sem ação, com justificativa: gráfico por cargo decidido pelos dados (cobre coordenação e OPEX), título "Top N" com o número real e contrato da rota garantido pela STC-739.

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
- **Aba Absenteísmo** (✅ STC-598, nas rotas reais pela STC-726): período livre (o do painel, o do alerta pelo Kanban ou o mês anterior fechado), aviso "N justificativas pendentes no VR, aguardando aprovação no SuperApp", indicadores numa faixa compacta (não os cards dos painéis), ocorrências com "conta/não conta", "pendente no VR" e "acima de N min" (atraso, saída antecipada e, no turno variável, "Jornada incompleta de 1h45") (atestado sem dado clínico), card do alerta ("Alerta de setembro/2026") com selo "Provisório" quando havia pendência na geração e "Demanda aberta em dd/mm/aaaa · responsável: …" (coordenação, Admin da categoria ou "Admins"); "Registrar tratamento" abre no card (ação da lista proposta do SRS + justificativa obrigatória) e, depois, mostra o tratamento registrado; alerta sem tratamento e sem como registrar aparece como "Encerrado: saiu da faixa crítica depois de uma nova importação"; histórico. A resposta do tratamento vem no período do alerta: só substitui o cache se for o período na tela, senão busca de novo. Tratar um alerta que outra pessoa ou a importação já fechou devolve 400 `alerta`: a mensagem vira toast e a aba, o painel e o cabeçalho do modal são buscados de novo.
- **Conversa da demanda** (STC-724): cada alerta com `demanda_id` tem o botão "Conversa" com a quantidade de comentários; ele abre um painel sobre a área de conteúdo do modal (a coluna de dados do colaborador continua à esquerda; no celular, o modal inteiro), com "Voltar", o título do alerta e o `ComentarioFeed` do Gestão de Demandas no mesmo visual da aba Comentários do Kanban (lista na altura toda, campo fixo embaixo, rota `demandas/{id}/comentarios/` liberada pela STC-723). Aviso fixo "Não registre diagnóstico, CID ou outros dados de saúde." acima do campo. A aba fica montada por baixo, fora do foco (`inert`): ao voltar, período e rolagem estão como estavam e o foco volta ao botão. Fechar o modal (ou trocar de colaborador) fecha a conversa; com ela aberta, Esc volta à aba. A situação (aberta ou só leitura) vem da própria demanda (`useDemanda`, com polling), não da foto do clique. Demanda concluída: só leitura. Alerta sem demanda: sem botão.
- **Anexos da demanda** (STC-850): ao lado de "Conversa", o botão "Anexos" com a quantidade abre um painel no mesmo formato (`PainelSobreposto`, extraído de `PainelComentarios`), com a orientação fixa "Não anexe atestado ou documento com informação de saúde." e o `AnexoList` do Gestão de Demandas: enviar (inclusive direto ao storage), listar, baixar e remover (quem enviou ou Admin da rede), pelas rotas `demandas/{id}/anexos/` liberadas no card de absenteísmo pela STC-846. É o caminho da carta de advertência ou de desligamento: o card do Kanban abre este modal (`origem_url`), não o detalhe da demanda. Ao contrário da conversa, a demanda concluída continua aceitando anexo, porque registrar o tratamento conclui a demanda e a carta costuma vir depois. Fora do "Ver como" e da lixeira.
- **Abertura**: pelo Painel de Absenteísmo, aba Absenteísmo no período do painel (`?colaborador=`); pelo card do Kanban (`?colaborador=&inicio=&fim=`, `origem_url` da STC-592), no período do alerta, rolando e levando o foco ao card do alerta; pelo Painel de Férias, aba Férias.
- Rótulos da interface: "período de direito", "limite para tirar", "férias tiradas" (SRS §3.1).

### P5.4 Parâmetros (Importação e regras) — `mockup_parametros_gestao_rh.html` · STC-597 construída

- Rota `/admin/permissoes/parametros-gestao-rh`, terceira opção do seletor "Seção" de `PermissoesAdmin`, só Admin (Q&G e Operações). Coordenação e setor de Legalização não veem nem pela rota (e a tela nem busca os parâmetros para eles).
- Abas sublinhadas, abre em **Absenteísmo e férias**:
  - parâmetros de absenteísmo numa linha (limite de atraso e saída antecipada, limite de absenteísmo, faixa de atenção, faixa crítica), tipos que contam (falta, atestado, ausência justificada), selo "Versão vigente desde dd/mm/aaaa, por Fulano" ou "Versão inicial" (sem lista de versões); aviso informativo quando não há faixas; limite vazio é obrigatório (não vira 0);
  - régua de férias: "completou o período" só com liga/desliga; "antes do limite" e "antes do início (substituição)" com dias e liga/desliga; "limite vencido" não aparece; erro da API na linha do marco;
  - "Cancelar" e "Salvar" de cada seção desabilitados até haver alteração; recarregar a versão vigente não apaga uma edição em andamento;
  - **avaliação automática** (STC-726): janela "Desligada" (padrão, com aviso de que nenhum alerta nem demanda é gerado), "Mês anterior fechado" ou "Últimos N dias" com N de 7 a 90; o texto de ajuda diz quando roda (primeiro dia útil do mês, STC-838, ou segunda-feira, à noite, depois da importação do robô). Só vai no envio se mudou, como os responsáveis; "Desligada" envia `null`.
- Aba **Importação** (hoje desligada, sem chamar a API, com o aviso "A importação será ativada quando a fonte dos dados for definida").
- **STC-595 (rodada RPA):** ativa a aba e liga à API (STC-587): período (padrão dia 1 do mês anterior até ontem), **três cartões (Jornada, Abonos, Pendências), um arquivo cada, com todas as equipes**, XLSX; recusa de layout com a coluna faltante; histórico de lotes com a origem (manual ou robô), linhas rejeitadas ("N · ver") e equipes novas sem categoria. É a contingência do robô.
- **Aba Equipes (rodada RPA):** as equipes do VR com categoria (Unidade, Operações Especiais, Fora do indicador) e unidade do Atlas editáveis, destaque para as "Sem categoria". Cada categoria só oferece unidades da sua rede (STC-753): Unidade, a rede própria, obrigatória (trocar para Unidade espera a escolha); Operações Especiais, a rede OPEX, opcional ("Sem unidade OPEX"), fora dos painéis da rede própria até o ambiente de Operações Especiais. Os responsáveis por TMO e Campanha saíram da aba de parâmetros (a demanda vai para a coordenação da unidade). Coluna **"Turno variável"** (STC-735): interruptor por equipe (`PATCH` só com `turno_variavel`), com toast, erro na linha (o inválido marca só o campo que falhou) e o texto acima da tabela explicando o efeito (absenteísmo pela carga horária do dia, jornada incompleta, retroativo). Ligar pede confirmação, porque recalcula os períodos já importados e pode encerrar alertas da equipe na próxima importação; desligar salva direto.

### P5.5 Abertura pelo card do Kanban

- Sem mudança no Kanban. O backend grava `origem_url`: férias `/modulos/gestao-rh/ferias?colaborador=<id>&periodo=<id>` (gravada pelo motor da STC-590); absenteísmo `/modulos/gestao-rh?colaborador=<id>&inicio=&fim=` (STC-592).
- O Painel de Férias deriva o modal aberto da querystring a cada renderização (abrir e fechar só trocam a URL), abre na aba certa e rola até o card do período, destacado. Clique na linha do painel abre só com `?colaborador=`, sem período em foco.

---

## Pacote P6 — Testes e Homologação
**Datas:** 19–20/10 · 2 dias úteis
**Status:** ✅ Concluído (homologação na STC-600, 19/10/2026)

- Já cobertos (STC-597): seção só para Admin, faixas as duas ou nenhuma, estado sem faixas, limite vazio, "completou o período" sem dias, "limite vencido" ausente, versão inicial, botões só com alteração, erro da API no campo e na linha do marco, edição preservada ao recarregar, aba Importação desligada.
- Já cobertos também (STC-596/598/599/601): faixa escondida sem critérios, "provisório", ações de férias, justificativa obrigatória, abertura por querystring.
- Já cobertos também (rodada RPA e STC-726): aba Importação com os 3 relatórios, aba Equipes, filtro de categoria e unidade nula, responsável só Admin, janela de avaliação (padrão desligada, N de 7 a 90, `null` ao desligar), alerta provisório e encerrado, erro 400 ao tratar alerta já fechado.
- `tsc`, lint e testes limpos; conferência visual contra as telas reais do Atlas.

## Pacote P7 — Go-Live
**Status:** ✅ Concluído (STC-602, 21/10/2026): módulo ativo em produção e apresentado aos coordenadores.

- Entrada "Gestão RH" de `modulos-futuros.ts` já com `codigo`/`rota`; liberação real por `Modulo.status=ativo` no backend, sem deploy de frontend (mecanismo da STC-423).

## Fast-follow (pós Go-Live, sem prazo definido)

- Gestão de férias inteira (telas prontas atrás de `FERIAS_ATIVA`), quando a fonte de férias for definida.
- Férias divididas em partes, se a Gestão de RH confirmar (pergunta 10).
- Modo responsivo dos painéis (mesmo desenho decidido para o Mapa de Conformidade).
