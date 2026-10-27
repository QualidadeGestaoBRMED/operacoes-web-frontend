# Ajuda do Atlas

O "como usar" do Atlas (STC-878): um artigo por tarefa, em Markdown. As
Novidades contam o que mudou e apontam para cá ("Ver como usar"). O nome do
arquivo é o endereço do artigo: `como-abrir-uma-demanda.md` vira
`/ajuda/como-abrir-uma-demanda`. Minúsculas, números e hífens; uma vez
publicado, não renomear (links compartilhados e novidades apontam para ele).

Cabeçalho:

```yaml
---
titulo: Como abrir uma demanda
resumo: Uma frase. Aparece no card da Ajuda e no topo do artigo.
modulo: gestao-demandas            # opcional; ausente: geral, em "Primeiros passos"
admin: false                       # opcional; true: só para quem administra
telas: [/modulos/gestao-demandas]  # opcional; telas em que o botão (?) abre o artigo
ordem: 1                           # opcional; posição no grupo (menor primeiro)
popular: true                      # opcional; true: também em "Mais usados" (até 4), no topo da Ajuda
icone: nova-demanda                # opcional; ícone do card (lista em src/components/ajuda/iconesDaAjuda.ts); sem ele, o do módulo
---
```

- `telas`: o botão (?) no topo abre o artigo num painel lateral nas telas
  listadas, só nelas: `/modulos/gestao-rh` não vale para
  `/modulos/gestao-rh/horas-extras`. Com `/*` no fim, vale também para as
  telas de baixo (`/modulos/legalizacao/*`). Vale a mais específica: um
  artigo de `/modulos/legalizacao/mapa` ganha de um de
  `/modulos/legalizacao/*` no Mapa.
  Com mais de um artigo na mesma tela, o painel mostra a lista. Tela sem
  artigo: o (?) leva à Ajuda, no grupo do módulo.
- `modulo` e `admin` escolhem quem vê o artigo na tela, não guardam segredo:
  o texto chega ao navegador de quem está logado. Nada interno aqui.

Texto:

- Uma seção por etapa (`## Abrir o formulário`, `## Preencher`...), cada uma
  com link próprio na página do artigo.
- Passos em lista numerada (`1.`), um por linha, com o nome do botão ou do
  campo em negrito e escrito como na tela: `1. Clique em **Nova Demanda**.`
- Frases curtas, para quem não é da área técnica. Sem travessão.
- Links para telas do Atlas pelo caminho (`[Mapa](/modulos/legalizacao/mapa)`)
  e para outros artigos por `/ajuda/<assunto>`.

Imagens: as mesmas regras das Novidades (`conteudo/novidades/LEIAME.md`),
em `public/ajuda/`: WebP em 2x, dados fictícios ou desfocados, meta de até
500 KB (o teste falha acima de 1 MB) e sempre com a frase do que mostra:
`![O que a imagem mostra](/ajuda/arquivo.webp)`. Uma animação já publicada
nas Novidades pode ser citada daqui, sem copiar o arquivo.
