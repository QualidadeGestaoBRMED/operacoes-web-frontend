"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { visiveisPara } from "@/lib/novidades";
import { FalhaNosModulos } from "@/components/conteudo/FalhaNosModulos";
import { useModulos } from "@/hooks/useModulos";
import { useNavegacao } from "@/hooks/useNavegacao";
import { cn } from "@/lib/utils";
import {
  EntradaDaNovidade,
  LinhaDoTempo,
  type NovidadeComTexto,
} from "./EntradaDaNovidade";
import { useNovidades } from "./NovidadesProvider";

const TODAS = "todas";

/** Sem acento e sem diferença de maiúscula: "notificacoes" acha "Notificações". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Página de Novidades (STC-877), em linha do tempo, como o changelog do
 * Linear: abas por módulo (quando mais de um tem novidade) e busca no título,
 * no resumo e no texto. Só as entradas que a pessoa vê: até chegar a lista
 * de módulos, nem lista nem "nenhuma novidade". Abrir a página marca a mais
 * nova como vista (some o ponto).
 */
export function ListaDeNovidades({ novidades }: { novidades: NovidadeComTexto[] }) {
  const { modulos, temAdministracao, redes } = useNavegacao();
  const {
    isLoading: carregandoModulos,
    error: falhaNosModulos,
    recarregar: recarregarModulos,
  } = useModulos();
  const { marcarComoVistas } = useNovidades();
  const [aba, setAba] = useState(TODAS);
  const [busca, setBusca] = useState("");
  const visiveis = visiveisPara(
    novidades,
    modulos.map((modulo) => modulo.codigo),
    temAdministracao,
    redes,
  );
  // Abas: só os módulos da pessoa que têm novidade; as gerais ficam em "Todas".
  const abas = modulos.filter((modulo) =>
    visiveis.some((novidade) => novidade.modulos.includes(modulo.codigo)),
  );
  const termo = normalizar(busca.trim());
  const filtradas = visiveis.filter(
    (novidade) =>
      (aba === TODAS || novidade.modulos.includes(aba)) &&
      (!termo ||
        normalizar(`${novidade.titulo} ${novidade.resumo} ${novidade.busca}`).includes(termo)),
  );

  useEffect(() => {
    void marcarComoVistas();
  }, [marcarComoVistas]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="space-y-5 border-b border-border pb-6">
        <p className="text-[15px] text-muted-foreground">
          O que mudou no Atlas, da novidade mais recente para a mais antiga.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {abas.length > 1 ? (
            <div role="group" aria-label="Módulo" className="flex flex-wrap gap-1.5">
              {[{ codigo: TODAS, nome: "Todas" }, ...abas].map((opcao) => (
                <button
                  key={opcao.codigo}
                  type="button"
                  aria-pressed={aba === opcao.codigo}
                  onClick={() => setAba(opcao.codigo)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    aba === opcao.codigo
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {opcao.nome}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="relative sm:w-72">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar novidades..."
              aria-label="Buscar novidades"
              className="h-10 rounded-full pl-9"
            />
          </div>
        </div>
      </header>

      {carregandoModulos ? null : falhaNosModulos ? (
        <FalhaNosModulos
          texto="Não foi possível carregar as novidades."
          onTentarDeNovo={() => void recarregarModulos()}
        />
      ) : filtradas.length === 0 ? (
        <p className="py-16 text-center text-[15px] text-muted-foreground">
          {termo ? `Nenhuma novidade encontrada para "${busca.trim()}".` : "Nenhuma novidade por enquanto."}
        </p>
      ) : (
        <div className="mt-10">
          <LinhaDoTempo>
            {filtradas.map((novidade) => (
              <EntradaDaNovidade key={novidade.id} novidade={novidade} comLinkNoTitulo />
            ))}
          </LinhaDoTempo>
        </div>
      )}
    </div>
  );
}
