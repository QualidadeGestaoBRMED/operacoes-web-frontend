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
---
```

Imagem ou animação: um print, ou o recurso em uso numa animação curta,
gravada fora do Atlas, com dados fictícios. O mais leve possível:

- WebP (estático ou animado); GIF só se não der WebP (fica de 3 a 5 vezes maior).
- Até ~720 px de largura, de 8 a 10 quadros por segundo, até uns 8 segundos.
- Meta de até 500 KB por arquivo. Acima de 1 MB, o teste do conteúdo falha.

Cada novidade tem página própria em `/novidades/<identificador>`, para
compartilhar o link.

Depois do cabeçalho, o texto em Markdown: o que mudou e por quê, e, se
houver, as seções `### Melhorias` e `### Correções`. O "como usar" fica no
artigo da Ajuda, não aqui. Prints com dados fictícios, sem nomes reais.
