"use client";

import { SeletorRede } from "@/components/rede/SeletorRede";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";

/** Escolha da rede nas telas da Legalização (STC-894). Só aparece para
 * quem acompanha as duas redes. */
export function SeletorRedeLegalizacao(props: { size?: "sm" | "default"; className?: string }) {
  return <SeletorRede {...useRedeDaLegalizacao()} {...props} />;
}
