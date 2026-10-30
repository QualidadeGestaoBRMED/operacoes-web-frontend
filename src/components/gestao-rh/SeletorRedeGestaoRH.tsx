"use client";

import { SeletorRede } from "@/components/rede/SeletorRede";
import { useRedeDoGestaoRH } from "@/hooks/useRedeDoGestaoRH";

/** Escolha da rede nas telas do Gestão RH (STC-907). Só aparece para quem
 * administra as duas redes. */
export function SeletorRedeGestaoRH(props: { size?: "sm" | "default"; className?: string }) {
  return <SeletorRede {...useRedeDoGestaoRH()} {...props} />;
}
