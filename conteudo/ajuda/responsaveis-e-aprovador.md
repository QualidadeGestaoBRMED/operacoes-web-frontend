---
titulo: Responsáveis e aprovador
resumo: Defina quem conduz a demanda, quem ajuda e quem aprova, e troque ou remova quando precisar.
modulo: gestao-demandas
telas: [/modulos/gestao-demandas]
ordem: 4
icone: responsaveis
---
## Quem é quem numa demanda

- **Responsável principal**: quem conduz a demanda e responde por ela. Sem um principal, a demanda não sai do Backlog para Em Andamento.
- **Colaborador**: quem ajuda o principal. Uma demanda pode ter vários.
- **Aprovador**: quem confere o trabalho quando a demanda vai para Em Revisão e decide se ela é concluída ou volta para ajustes.

Os responsáveis aparecem no card do quadro e na seção **Responsáveis** da demanda. O aprovador aparece em **Aprovador**.

## Adicionar e trocar responsáveis

![Na demanda, Adicionar responsável como Colaborador; depois Trocar o principal por esse colaborador; o aprovador aparece acima](/ajuda/responsaveis-e-aprovador.webp)

1. Clique no card para abrir a demanda.
2. Em **Responsáveis**, clique em **Adicionar responsável**.
3. Escolha a pessoa em **Selecionar usuário**.
4. Escolha o tipo: **Principal** ou **Colaborador**. Se a demanda ainda não tem principal, o tipo já vem como **Principal**.
5. Clique em **Adicionar**.

Para trocar o principal, clique em **Trocar** ao lado dele, escolha o **Novo principal** e clique em **Confirmar troca**. O novo assume, e o anterior sai da demanda. Se o novo já era colaborador, ele é promovido.

Para tirar alguém, clique no **X** ao lado do nome e confirme em **Remover**. O único principal não pode ser removido: troque-o por outra pessoa.

Quem recebe uma demanda é avisado no sino ("Você foi adicionado como responsável em: ...") e, se tiver ativado, no celular.

## Quem pode ser escolhido

- Em demandas **Operacional** (sem unidade): quem administra a rede.
- Em demandas com **unidade**: quem é daquela unidade ou administra a rede dela.

O perfil Admin Q&G não aparece na lista: ele acompanha a qualidade, não executa demandas.

Quem pode mexer nos responsáveis: quem atende a unidade ou o setor da demanda e quem administra a rede.

## O aprovador

O aprovador é escolhido ao mandar a demanda para revisão:

1. Na demanda, clique em **Mudar status**.
2. Em **Novo status**, escolha **Em Revisão**.
3. Em **Aprovador**, escolha quem vai aprovar. Só aparece quem administra a rede da demanda.
4. Clique em **Confirmar**.

O aprovador recebe um aviso ("Você foi designado aprovador de: ...") no sino e, se tiver ativado, no celular. A partir daí, só ele ou quem administra a rede pode concluir a demanda ou devolvê-la para Em Andamento, com justificativa (veja "Como mudar uma demanda de coluna").

Se a demanda voltar para ajustes e depois for concluída direto de Em Andamento, sem nova revisão, o aprovador anterior sai da demanda.

Toda mudança de responsável e de aprovador fica no **Histórico** da demanda.
