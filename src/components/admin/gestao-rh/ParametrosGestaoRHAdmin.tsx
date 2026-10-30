"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FERIAS_ATIVA } from "@/config/gestaoRH";
import { useAuth } from "@/hooks/useAuth";
import { useRedeDoGestaoRH } from "@/hooks/useRedeDoGestaoRH";
import { AbaEquipes } from "./AbaEquipes";
import { AbaImportacao } from "./AbaImportacao";
import { FormParametrosAbsenteismo } from "./FormParametrosAbsenteismo";
import { FormReguaFerias } from "./FormReguaFerias";

const CLASSE_ABA = "flex-none rounded-none px-1 text-sm data-[state=active]:shadow-none";

/**
 * Seção "Parâmetros de Gestão RH" da Administração (só Admin). Abre na aba
 * de parâmetros (absenteísmo e, com FERIAS_ATIVA, a régua de férias). A de
 * Equipes classifica as equipes do VR; a de Importação é o envio manual dos
 * relatórios do VR, contingência do robô, só de quem administra a rede
 * própria (o robô é um só). Parâmetros e régua são da rede escolhida no
 * cabeçalho da Administração (STC-907). Abas sublinhadas,
 * como no detalhe do documento da Legalização; seções empilhadas na largura
 * toda, como as outras seções da Administração.
 */
type AbaParametros = "importacao" | "equipes" | "absenteismo-ferias";

export function ParametrosGestaoRHAdmin({ hidden }: { hidden?: boolean }) {
  const [aba, setAba] = useState<AbaParametros>("absenteismo-ferias");
  const { administraRedePadrao } = useAuth();
  const { rede } = useRedeDoGestaoRH();

  // Aba inativa só escondida (forceMount + hidden), não desmontada: trocar
  // de aba não descarta uma edição em andamento, mesmo motivo do `hidden`
  // das seções da Administração.
  return (
    // overflow-y-auto também corta na horizontal: sem a folga de 1 (px-1,
    // compensada por -mx-1), o anel de foco dos campos encostados nas bordas
    // (limite de atraso à esquerda, faixa crítica à direita) era cortado.
    // relative: prende os elementos de posição absoluta lá de baixo (o
    // <select> nativo escondido de cada Select do Radix); sem isso, a página
    // inteira crescia até eles e rolava para uma área vazia.
    <div hidden={hidden} className="relative -mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
      <Tabs
        value={aba}
        onValueChange={(valor) => setAba(valor as AbaParametros)}
        // Do sm para cima as abas ocupam a altura que sobra: a tabela de
        // Equipes rola por dentro sem passar do fim da tela. As outras abas,
        // mais altas, continuam rolando pelo contêiner de cima.
        className="gap-6 sm:min-h-0 sm:flex-1"
      >
        <TabsList
          variant="line"
          className="h-11 w-full justify-start gap-5 rounded-none border-b border-border bg-transparent"
        >
          {administraRedePadrao && (
            <TabsTrigger value="importacao" className={CLASSE_ABA}>
              Importação
            </TabsTrigger>
          )}
          <TabsTrigger value="equipes" className={CLASSE_ABA}>
            Equipes
          </TabsTrigger>
          <TabsTrigger value="absenteismo-ferias" className={CLASSE_ABA}>
            {FERIAS_ATIVA ? "Absenteísmo e férias" : "Absenteísmo"}
          </TabsTrigger>
        </TabsList>

        {administraRedePadrao && (
          <TabsContent value="importacao" forceMount hidden={aba !== "importacao"}>
            <AbaImportacao aoIrParaEquipes={() => setAba("equipes")} />
          </TabsContent>
        )}

        <TabsContent
          value="equipes"
          forceMount
          hidden={aba !== "equipes"}
          className="sm:flex sm:min-h-0 sm:flex-col"
        >
          <AbaEquipes />
        </TabsContent>

        <TabsContent
          value="absenteismo-ferias"
          forceMount
          hidden={aba !== "absenteismo-ferias"}
          className="space-y-7"
        >
          {/* key: trocar de rede remonta o formulário, sem levar uma edição
              em andamento para a versão da outra rede. */}
          <FormParametrosAbsenteismo key={rede} rede={rede} />
          {FERIAS_ATIVA && (
            <>
              <Separator />
              <FormReguaFerias key={rede} rede={rede} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
