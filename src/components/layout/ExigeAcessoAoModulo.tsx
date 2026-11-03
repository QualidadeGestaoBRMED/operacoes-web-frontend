"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAcessoAosModulos } from "@/hooks/useModulosNavegacao";
import { useNavegacao } from "@/hooks/useNavegacao";

/**
 * Rota de um módulo a que a pessoa não tem acesso (link salvo, endereço
 * digitado, STC-973) leva ao primeiro módulo que ela pode usar, sem mostrar
 * a tela vazia (ou o Mapa com "Sem pendência" de quem não vê nada). Sem
 * nenhum módulo, um aviso no lugar: redirecionar ali voltaria para cá.
 */
export function ExigeAcessoAoModulo({
  codigo,
  children,
}: {
  codigo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { carregando, temAcesso } = useAcessoAosModulos();
  const { modulos } = useNavegacao();
  const liberado = temAcesso(codigo);
  const destino = modulos.find((modulo) => modulo.codigo !== codigo)?.rota;

  useEffect(() => {
    if (!carregando && !liberado && destino) router.replace(destino);
  }, [carregando, liberado, destino, router]);

  if (carregando) return <div role="status" aria-label="Carregando" />;
  if (liberado) return children;
  if (destino) return null;
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Você ainda não tem acesso a nenhum módulo do Atlas. Fale com o Admin da sua área para
        liberar o que você precisa.
      </p>
    </div>
  );
}
