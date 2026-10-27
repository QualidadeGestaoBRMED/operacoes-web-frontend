---
titulo: Como cadastrar um documento
resumo: Cadastre um documento regulatório para uma unidade, com responsável, status, validade e o PDF, ou vários de uma vez em lote.
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

Para tipos com várias instâncias por unidade (ex.: a calibração de cada equipamento), cadastre todas de uma vez:

![Janela Cadastrar documentos em lote, com unidade, tipo, responsáveis e a regra da unidade](/ajuda/como-cadastrar-um-documento-lote.webp)

1. Em **Cadastrar documento na unidade**, clique em **Cadastrar em lote**.
2. Escolha a **Unidade** e o **Tipo de documento**. Só aparecem os tipos que permitem várias instâncias.
3. Escolha os **Responsável(is)**: valem para todos os documentos do lote.
4. Confira a **Regra desta unidade**: ela vale para todos os itens.
5. Em **Identificadores**, escreva um por linha (ex.: Balança 01, Balança 02, Balança 03). Cada linha vira um documento.
6. Clique em **Cadastrar documentos**. Os documentos são criados como **Não iniciado**.
7. Na janela **Anexar evidências** que abre em seguida, para cada item, clique em **Anexar** para enviar o PDF, escolha o **Status inicial** e informe a **Validade**.
8. Clique em **Concluir**.

Dá para cadastrar até 200 identificadores de uma vez. Se preferir, complete as evidências depois, um por um, na lista da Matriz de Conformidade.
