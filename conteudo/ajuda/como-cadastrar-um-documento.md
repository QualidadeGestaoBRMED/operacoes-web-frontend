---
titulo: Como cadastrar um documento
resumo: Cadastre um documento com validade e PDF, um por vez ou em lote.
modulo: legalizacao
telas: [/admin/permissoes/catalogo-legalizacao]
ordem: 8
icone: novo-documento
---
## Antes de começar

O documento é a ligação de um tipo do catálogo com uma unidade: o Alvará de Funcionamento de Niterói, a Dedetização de Cabo Frio. Se o tipo ainda não existe, cadastre-o primeiro (veja "Como cadastrar um tipo de documento").

Quem pode cadastrar: o Setor de Legalização, quem administra a rede e a coordenação, nas suas próprias unidades.

## Cadastrar um documento

![Clique em Cadastrar documento, escolha da unidade, do tipo e do responsável, status Regular, validade, envio do PDF e o aviso Documento cadastrado](/ajuda/como-cadastrar-um-documento.webp)

1. No menu, abra **Legalização** e, dentro dela, **Catálogo de Legalização**.
2. Em **Cadastrar documento na unidade**, clique em **Cadastrar documento**.
3. Escolha a **Unidade**. Quem coordena só vê as suas e, se for uma só, ela já vem escolhida.
4. Escolha o **Tipo de documento**. A lista mostra só os tipos ativos que a unidade ainda não tem.
5. Em **Responsável(is)**, marque quem vai cuidar do documento. Dá para buscar pelo nome.
6. Se o tipo é controlado por profissional (ex.: Dosimetria) ou tem várias instâncias, preencha o **Profissional** ou o **Identificador** (ex.: Balança 01).
7. Escolha o **Status inicial**: **Não iniciado**, **Em andamento**, **Protocolado**, **Regular** ou **Vencido**.
8. Em **Validade**, informe a data em que o documento vence. Ela é obrigatória para **Vencido**.
9. Em **Evidência**, clique em **Anexar evidência** e escolha o PDF do documento. Ela é obrigatória para **Regular** e **Protocolado**.
10. Clique em **Cadastrar documento**. Aparece o aviso "Documento cadastrado.".

O documento passa a aparecer na lista e no Mapa da Matriz de Conformidade e, com o PDF, na Biblioteca de Documentos.

## A regra desta unidade

Embaixo, em **Regra desta unidade**, ficam os prazos do documento nesta unidade:

- **Data de início dos alertas**: a partir de quando o Atlas acompanha o vencimento (já vem com a data de hoje).
- **Antecedência (dias)**: com quantos dias antes do vencimento o Atlas avisa. Vem do tipo de documento.
- **Início da janela** e **Fim da janela (dia)**: só para documentos com uma janela fixa de atualização no mês (ex.: CNES).
- **Gerar card em Gestão de Demandas quando o processo de renovação começar**: já vem marcado. Assim, cada renovação abre um card no quadro.

Se a unidade já tem uma regra para este tipo, os campos aparecem travados com os valores em vigor. Para mudar, use **Corrigir regra**, mais abaixo na página.

## Documento que não se aplica à unidade

Se o tipo não se aplica àquela unidade, marque **Não aplicável a esta unidade** e escreva o motivo em **Justificativa**. O documento entra como **Não aplicável**.

## Cadastrar em lote

Para tipos com várias instâncias por unidade, como a calibração de cada equipamento, dá para cadastrar todos de uma vez. O cadastro em lote tem duas janelas: na primeira, você diz a unidade, o tipo e a lista de itens; na segunda, completa cada item com o PDF, o status e a validade.

Só aparecem os tipos marcados com **Permite múltiplas instâncias** no catálogo (veja "Como cadastrar um tipo de documento").

### 1. Dizer a unidade, o tipo e os itens

![Janela Cadastrar documentos em lote: escolha da unidade, do tipo e do responsável, um identificador por linha e clique em Cadastrar documentos](/ajuda/como-cadastrar-um-documento-lote-cadastrar.webp)

1. No menu, abra **Legalização** e, dentro dela, **Catálogo de Legalização**.
2. Em **Cadastrar documento na unidade**, clique em **Cadastrar em lote**.
3. Escolha a **Unidade**.
4. Escolha o **Tipo de documento**.
5. Em **Responsável(is)**, marque quem vai cuidar dos documentos. Os responsáveis valem para todos os itens do lote.
6. Confira a **Regra desta unidade**. Ela vale para todos os itens. Se a unidade já tem uma regra para este tipo (de um cadastro anterior), os campos aparecem travados com os valores em vigor: o lote reaproveita essa regra. Para mudar, use **Corrigir regra**, mais abaixo na página.
7. Em **Identificadores**, escreva um item por linha, do jeito que ele é conhecido na unidade (ex.: Autoclave 01, Estufa 02, Centrífuga 03). Cada linha vira um documento. Os nomes aparecem em letras maiúsculas.
8. Deixe marcado **Gerar card em Gestão de Demandas quando o processo de renovação começar** se cada renovação deve abrir um card no quadro.
9. Clique em **Cadastrar documentos**. Os documentos são criados na hora, como **Não iniciado**, e a janela **Anexar evidências** abre.

Dá para cadastrar até 200 itens de uma vez. Cada linha precisa ser diferente das outras (o Atlas avisa "Identificadores duplicados") e de um item que já exista na unidade para o mesmo tipo (o Atlas avisa que o documento já existe).

### 2. Anexar as evidências e concluir

![Janela Anexar evidências: para cada item, envio do PDF, status Regular e validade, e clique em Concluir](/ajuda/como-cadastrar-um-documento-lote-evidencias.webp)

Status e validade são por item: cada equipamento pode ter a própria data de calibração. Para cada item:

1. Clique em **Anexar** e escolha o PDF do certificado daquele item. O item mostra **Enviando...** e depois **Enviado**. Se o envio falhar, aparece **Falhou** e o botão **Tentar de novo**.
2. Em **Status inicial**, escolha o status do item: **Regular**, **Protocolado**, **Em andamento**, **Vencido** ou **Não iniciado**.
3. Em **Validade**, informe a data em que o documento daquele item vence. Ela é obrigatória para **Vencido**.

Depois de completar todos, clique em **Concluir**. Ele salva o status de todos os itens de uma vez.

- **Concluir** só libera quando todos os itens têm um status, e os que estão como **Regular** ou **Protocolado** têm o PDF enviado.
- Para os status **Não iniciado**, **Em andamento** e **Vencido**, o PDF é opcional: dá para completar depois, um por um, no detalhe do documento, na Matriz de Conformidade.
- Se algum item não puder ser salvo, a janela avisa embaixo dele. Corrija e clique em **Concluir** de novo.

Os documentos passam a aparecer na lista e no Mapa da Matriz de Conformidade, um por item, com o identificador junto do nome do tipo (ex.: "Calibração de Equipamentos — AUTOCLAVE 01"). Na hora de renovar, eles podem ser renovados juntos (veja "Como renovar um documento").
