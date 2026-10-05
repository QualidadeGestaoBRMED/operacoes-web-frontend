import { Button } from "@/components/ui/button";

/** Erro de validação ligado ao campo pelo `id` (use em `aria-describedby`). */
export function MensagemErro({ id, texto }: { id?: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {texto}
    </p>
  );
}

/** Falha ao carregar uma seção que ainda não tem dado nenhum em tela. */
export function ErroAoCarregar({
  mensagem,
  aoTentarNovamente,
}: {
  mensagem: string;
  aoTentarNovamente: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-destructive">{mensagem}</p>
      <Button type="button" variant="outline" size="sm" onClick={aoTentarNovamente}>
        Tentar novamente
      </Button>
    </div>
  );
}
