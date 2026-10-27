---
titulo: Parâmetros de Gestão RH
resumo: Faixas, avaliação automática, equipes do VR e importação manual.
modulo: gestao-rh
admin: true
telas: [/admin/permissoes/parametros-gestao-rh]
ordem: 6
icone: parametros
---
## Abrir os Parâmetros

1. No menu, abra **Gestão RH** e, dentro dele, **Parâmetros de Gestão RH**. Também dá para chegar por **Administração**, escolhendo **Parâmetros de Gestão RH** no alto da tela.
2. A tela abre na aba **Absenteísmo**. As outras são **Importação** e **Equipes**.

Só quem administra vê esta tela.

![Passagem pelas abas Absenteísmo, Importação e Equipes dos Parâmetros de Gestão RH](/ajuda/parametros-de-gestao-rh-animacao.webp)

## Absenteísmo

![Aba Absenteísmo com a versão vigente, os limites, as faixas, os tipos que contam e a avaliação automática](/ajuda/parametros-de-gestao-rh-absenteismo.webp)

- **Limite de atraso e saída antecipada (minutos)**: atrasos, saídas antecipadas e jornadas incompletas só contam acima dele.
- **Limite de absenteísmo (%)**: só uma referência no Painel. Acima dele, o absenteísmo aparece em vermelho.
- **Faixa de atenção a partir de (%)**: quem chega nela aparece no Painel, sem demanda.
- **Faixa crítica acima de (%)**: quem passa dela gera alerta e demanda para a coordenação. A crítica precisa começar acima da atenção. Sem as duas faixas, ninguém é classificado e nenhuma demanda é gerada.
- **Tipos de ocorrência que contam no absenteísmo**: **Falta**, **Atestado** e **Ausência justificada**. Férias, afastamento e banco de horas nunca contam.

### Avaliação automática

É ela que gera os alertas e as demandas de absenteísmo crítico. Em **Janela de avaliação**, escolha:

- **Mês anterior fechado**: no primeiro dia útil do mês, à noite, avalia o mês que acabou.
- **Últimos N dias**: toda segunda-feira, à noite, avalia os N dias até o domingo. Informe **Quantos dias (N)**, de 7 a 90.
- **Desligada**: nenhum alerta nem demanda é gerado. O Painel continua calculando qualquer período.

A avaliação roda depois da importação do robô. Se a importação atrasar, o período é avaliado no primeiro dia em que estiver completo. Cada período é avaliado uma vez.

### Salvar

Clique em **Salvar nova versão**. Cada alteração cria uma versão nova, que vale para os Painéis em qualquer período. Os alertas e as demandas já gerados mantêm a versão com que foram gerados: o alerta mostra "crítica acima de X% quando gerado". No alto, a etiqueta mostra desde quando vale a versão atual e quem a salvou.

Para desfazer o que mudou antes de salvar, clique em **Cancelar**.

## Equipes

![Aba Equipes com o aviso de equipe sem categoria, os filtros por categoria e a tabela com categoria, unidade do Atlas e turno variável](/ajuda/parametros-de-gestao-rh-equipes.webp)

Cada equipe do VR precisa de uma **Categoria**, que define se os colaboradores dela entram no absenteísmo:

- **Unidade**: entra no indicador e leva uma unidade da rede própria, em **Unidade do Atlas**.
- **Operações Especiais**: pode ser ligada a uma unidade de Operações Especiais. Não entra nos Painéis da rede própria.
- **Fora do indicador**: não entra no absenteísmo.

Equipe nova chega **Sem categoria** na importação, e os colaboradores dela ficam fora do indicador até alguém classificá-la. O aviso no alto diz quantas faltam. Use os filtros (**Sem categoria**, **Unidade** e os outros) e **Buscar equipe** para encontrá-las.

Ao trocar a unidade de uma equipe que tem colaboradores, o Atlas pede confirmação: os colaboradores passam para a nova unidade, e as demandas abertas deles vão para a coordenação dela.

### Turno variável

Ligue para equipes que trabalham fora da escala dentro da carga do dia, como técnico de raio X e motorista de campanha. O absenteísmo do dia passa a ser pela carga horária cumprida, sem atraso nem saída contra a escala. O que faltar da carga aparece como jornada incompleta. Nas horas extras, conta só o que passou da carga do dia.

A mudança vale também para os períodos já importados. Ao ligar, o Atlas pede confirmação: alertas da equipe que deixarem de estar na faixa crítica podem ser encerrados na próxima importação.

## Importação

![Aba Importação com o período, os três relatórios do VR, o botão Importar relatórios e o histórico](/ajuda/parametros-de-gestao-rh-importacao.webp)

O robô envia os relatórios do VR Pontomais todos os dias. Use esta aba só quando ele falhar:

1. No VR, exporte os 3 relatórios do período, com todas as equipes: **Jornada**, **Abonos** e **Pendências**, em XLSX.
2. Em **Início do período** e **Fim do período**, informe o mesmo período da exportação. O padrão é o do robô: do dia 1 do mês anterior até ontem.
3. Clique em **Selecionar** em cada relatório e escolha o arquivo.
4. Clique em **Importar relatórios**.

Reimportar um período substitui os dados dele, só de quem aparece em cada relatório. Os arquivos são processados e não ficam guardados. O texto livre do motivo e das observações, onde podem vir diagnóstico e CID, é descartado na leitura.

Ao terminar, a tela mostra quantas linhas foram processadas. Se aparecer "Importação recusada: nada foi gravado.", confira o motivo, corrija o período ou os arquivos e envie de novo. Se houver linhas rejeitadas, clique em **Ver linhas rejeitadas**: elas não entraram no Atlas e precisam ser corrigidas no VR. Se a importação trouxer equipes novas, o aviso leva direto para a aba **Equipes**.

No **Histórico**, ficam todas as importações, do robô e manuais, com o período, quem enviou, as linhas e a situação.
