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
import type { Rede } from "@/types";

const ROTULO: Record<Rede, string> = {
  padrao: "Rede própria",
  opex: "Operações Especiais",
};

/** Escolha da rede nas telas da Legalização (STC-894). Só aparece para
 * quem acompanha as duas redes. */
export function SeletorRedeLegalizacao() {
  const { rede, redes, podeEscolher, escolherRede } = useRedeDaLegalizacao();
  if (!podeEscolher) return null;
  return (
    <Select value={rede} onValueChange={(valor) => escolherRede(valor as Rede)}>
      <SelectTrigger size="sm" className="w-[190px]" aria-label="Rede">
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
