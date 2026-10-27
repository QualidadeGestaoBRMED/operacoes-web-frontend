import { Button } from "@/components/ui/button";

/**
 * Sem a lista de módulos (falha na busca), não dá para saber o que a pessoa
 * vê: nas Novidades e na Ajuda, avisa e deixa tentar de novo.
 */
export function FalhaNosModulos({ onTentarDeNovo, texto }: { onTentarDeNovo: () => void; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-[15px] text-muted-foreground">{texto}</p>
      <Button variant="outline" onClick={onTentarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  );
}
