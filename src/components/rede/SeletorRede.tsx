"use client";

import { Network } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RedeDoModulo } from "@/hooks/useRedeDoModulo";
import { cn } from "@/lib/utils";
import type { Rede } from "@/types";

const ROTULO: Record<Rede, string> = {
  padrao: "Rede própria",
  opex: "Operações Especiais",
};

/** Escolha da rede nas telas de um módulo. Só aparece para quem acompanha
 * mais de uma rede. `size` acompanha os controles ao lado (o cabeçalho da
 * Administração usa o tamanho padrão). */
export function SeletorRede({
  rede,
  redes,
  podeEscolher,
  escolherRede,
  size = "sm",
  className,
}: RedeDoModulo & { size?: "sm" | "default"; className?: string }) {
  if (!podeEscolher) return null;
  return (
    <Select value={rede} onValueChange={(valor) => escolherRede(valor as Rede)}>
      {/* 210px: "Operações Especiais" inteiro, com o ícone e a seta. */}
      <SelectTrigger size={size} className={cn("w-[210px]", className)} aria-label="Rede">
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
