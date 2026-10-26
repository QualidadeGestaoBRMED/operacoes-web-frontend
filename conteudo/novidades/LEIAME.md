# Novidades do Atlas

Uma novidade por arquivo, na mesma PR do recurso (STC-875). O nome do arquivo
é o identificador, que dá a ordem: `AAAA-MM-DD-NN-assunto.md`.

- `AAAA-MM-DD`: data de publicação.
- `NN`: dois dígitos, a ordem no mesmo dia (`01`, `02`...).
- `assunto`: minúsculas, números e hífens.

Cabeçalho:

```yaml
---
titulo: Notificações no celular
resumo: Uma ou duas frases. Aparece na janela de destaque e no topo da entrada.
modulos: [gestao-rh]   # opcional; vazio ou ausente: para todos
admin: false           # opcional; true: só para quem administra
destaque: false        # opcional; true: abre sozinha uma vez (raro, grandes lançamentos)
imagem: /novidades/2026-10-26-01-notificacoes-no-celular.webp   # opcional, em public/novidades; .png, .webp ou .gif
ajuda: notificacoes-no-celular   # opcional; artigo da Ajuda em "Ver como usar" (STC-878)
abrir: /modulos/gestao-rh        # opcional; tela do recurso, no botão "Abrir no Atlas"
---
```

`modulos` e `admin` escolhem quem vê a novidade na tela, não guardam
segredo: o texto de todas chega ao navegador de quem está logado. Nada
interno ou ainda não lançado entra aqui; a novidade só entra no
repositório quando o recurso for lançado.

Imagem ou animação: um print, ou o recurso em uso numa animação curta,
gravada fora do Atlas, com dados fictícios. O mais leve possível:

- WebP (estático ou animado); GIF só se não der WebP (fica de 3 a 5 vezes maior).
- Sempre em 2x: o Atlas exibe na metade dos pixels, sem esticar. Tela de
  celular: ~600 px de largura (aparece com 300); print de computador: até
  1360 px (aparece com a largura da coluna).
- De 8 a 10 quadros por segundo, até uns 8 segundos.
- Meta de até 500 KB por arquivo. Acima de 1 MB, o teste do conteúdo falha.

Cada novidade tem página própria em `/novidades/<identificador>`, para
compartilhar o link.

Depois do cabeçalho, o texto em Markdown: o que mudou e por quê. O "como
usar" fica no artigo da Ajuda, não aqui. Prints com dados fictícios, sem
nomes reais.

- Lançamento com vários recursos: uma seção por recurso (`## Título`), cada
  uma com seu texto e, se quiser, sua imagem ou animação numa linha só,
  com uma frase do que ela mostra (lida pelo leitor de tela):
  `![O que a imagem mostra](/novidades/arquivo.webp)`. Cada subtítulo ganha
  um link próprio.
- Links no texto: para telas do Atlas, o caminho (`[Painel](/modulos/gestao-rh)`).
- No fim, se houver, `### Melhorias` e `### Correções`, um item por linha
  com a área em negrito: `- **Gestão RH:** cards lado a lado no celular.`
