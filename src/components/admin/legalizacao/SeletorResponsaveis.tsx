"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCandidatosResponsaveis } from "@/hooks/useDocumentosLegalizacao";
import { nomeExibicao } from "@/lib/utils";

// STC-516/STC-517: mesmo padrão de multi-seleção em Popover+Checkbox já
// usado em SeletorEtiquetas.tsx (Demandas) e PermissoesAdmin.tsx -- aqui
// sem "criar novo" (candidato vem só do backend, união unidade+setor de
// apoio) e com busca (a unidade pode ter dezenas de usuários).
//
// Compartilhado entre FormCadastrarDocumento.tsx e
// FormCadastrarDocumentosEmLote.tsx -- os dois precisam do mesmo campo
// obrigatório reagindo à unidade/tipo escolhidos.
export function SeletorResponsaveis({
  id,
  unidadeId,
  tipoDocumentoId,
  value,
  onChange,
}: {
  // STC-517 (achado em code review): id do gatilho, pra cada formulário
  // poder apontar o próprio <Label htmlFor> pra cá -- sem isso, o rótulo
  // "Responsável(is)" não tinha associação programática com o controle
  // (clique no label não focava o botão, leitor de tela não anunciava o
  // rótulo ao focar).
  id: string;
  unidadeId: number | undefined;
  tipoDocumentoId: number | undefined;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const { candidatos, isLoading, mensagemErro, tentarNovamente } = useCandidatosResponsaveis(
    unidadeId,
    tipoDocumentoId,
  );
  const [busca, setBusca] = useState("");

  const selecionados = candidatos.filter((usuario) => value.includes(usuario.id));
  const candidatosFiltrados = candidatos.filter((usuario) =>
    nomeExibicao(usuario).toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const habilitado = !!unidadeId && !!tipoDocumentoId;

  function alternar(id: number) {
    onChange(value.includes(id) ? value.filter((existente) => existente !== id) : [...value, id]);
  }

  return (
    <div className="space-y-1.5">
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selecionados.map((usuario) => (
            <span
              key={usuario.id}
              className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {nomeExibicao(usuario)}
              <button
                type="button"
                onClick={() => alternar(usuario.id)}
                aria-label={`Remover responsável ${nomeExibicao(usuario)}`}
                className="opacity-70 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover
        onOpenChange={(aberto) => {
          if (!aberto) setBusca("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={!habilitado}
            className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:text-muted-foreground"
          >
            {!habilitado
              ? "Escolha a unidade e o tipo de documento primeiro"
              : selecionados.length > 0
                ? `${selecionados.length} selecionado(s) -- adicionar/remover`
                : "Selecionar responsável(is)..."}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-1.5">
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome..."
            className="mb-1.5 h-7 text-xs"
            autoFocus
          />
          <div className="scrollbar-discreta max-h-48 overflow-y-auto">
            {isLoading ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>
            ) : mensagemErro ? (
              // STC-517 (achado em code review): sem distinguir erro de
              // "ninguém elegível", a mesma tela vazia aparecia nos dois
              // casos -- o campo é obrigatório, então uma falha de rede
              // aqui travava o formulário inteiro sem explicação nem jeito
              // de tentar de novo.
              <div className="flex flex-col items-start gap-1 px-2 py-1.5">
                <p className="text-xs text-destructive">{mensagemErro}</p>
                <Button variant="outline" size="xs" onClick={tentarNovamente}>
                  Tentar novamente
                </Button>
              </div>
            ) : candidatosFiltrados.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Nenhum candidato encontrado para esta unidade/tipo de documento.
              </p>
            ) : (
              candidatosFiltrados.map((usuario) => (
                <label
                  key={usuario.id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={value.includes(usuario.id)}
                    onCheckedChange={() => alternar(usuario.id)}
                    className="shrink-0"
                  />
                  <span className="truncate">{nomeExibicao(usuario)}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
