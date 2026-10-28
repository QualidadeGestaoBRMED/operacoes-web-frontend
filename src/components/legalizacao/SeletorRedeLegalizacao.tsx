"use client";

import { Network } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { cn } from "@/lib/utils";
import type { Rede } from "@/types";

const ROTULO: Record<Rede, string> = {
  padrao: "Rede própria",
  opex: "Operações Especiais",
};

/** Escolha da rede nas telas da Legalização (STC-894). Só aparece para
 * quem acompanha as duas redes. `size` acompanha os controles ao lado (o
 * cabeçalho da Administração usa o tamanho padrão). */
export function SeletorRedeLegalizacao({
  size = "sm",
  className,
}: {
  size?: "sm" | "default";
  className?: string;
}) {
  const { rede, redes, podeEscolher, escolherRede } = useRedeDaLegalizacao();
  if (!podeEscolher) return null;
  return (
    <Select value={rede} onValueChange={(valor) => escolherRede(valor as Rede)}>
      <SelectTrigger size={size} className={cn("w-[190px]", className)} aria-label="Rede">
        <Network className="size-4 text-secondary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {redes.map((opcao) => (
          <SelectItem key={opcao} value={opcao}>
            {ROTULO[opcao]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
