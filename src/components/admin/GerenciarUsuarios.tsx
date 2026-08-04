"use client";

import { useState } from "react";
import { ListFilter, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePerfis } from "@/hooks/usePerfis";
import { useSetores } from "@/hooks/useSetores";
import { useUnidades } from "@/hooks/useUnidades";
import { useAtualizarUsuario, useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { nomeExibicao } from "@/lib/utils";
import type { Usuario } from "@/types";

// Espelha accounts/permissions.py (NIVEL_ADMIN_OPERACOES = 2). Regra do
// produto (não do backend): esta tela nunca lista nem edita quem já é Admin
// Q&G/Admin Operações, e nunca oferece esses dois níveis como opção pra
// ninguém -- promover ou rebaixar alguém de/pra um nível admin continua
// exclusivo do Django Admin. O backend (UsuarioSerializer) ainda aceita mais
// que isso via API, mas essa tela deliberadamente não expõe.
const NIVEL_ADMIN_OPERACOES = 2;

// Sentinel: Radix Select não aceita value="" num SelectItem (colide com o
// estado interno "sem valor selecionado"). "nenhum" representa null nos três
// selects (perfil/unidade/setor podem ser desvinculados).
const SEM_VALOR = "nenhum";

// Exportada pra PermissoesAdmin conseguir contar quantas linhas essa seção
// vai renderizar (ver "peso" de altura das duas seções) sem duplicar a regra
// de quem entra na lista.
export function usuariosGerenciaveis(usuarios: Usuario[]): Usuario[] {
  return usuarios.filter(
    (usuario) => !usuario.perfil || usuario.perfil.nivel > NIVEL_ADMIN_OPERACOES,
  );
}

export function GerenciarUsuarios({
  expandido,
  onAlternarExpandir,
}: {
  expandido: boolean;
  onAlternarExpandir: () => void;
}) {
  const { usuarios } = useUsuarios();
  const { perfis } = usePerfis();
  const { unidades } = useUnidades();
  const { setores } = useSetores();
  const { atualizar } = useAtualizarUsuario();
  // Mesmo critério do KanbanFiltros (STC-186): abaixo de 640px, os selects
  // de filtro saem de linha e vão pra dentro de um Popover atrás de um
  // botão só, com badge de contagem.
  const ehMobile = useMediaQuery("(max-width: 639px)");

  const perfisDisponiveis = perfis.filter((perfil) => perfil.nivel > NIVEL_ADMIN_OPERACOES);
  const usuariosListados = usuariosGerenciaveis(usuarios);

  // Filtros -- só do lado do cliente: useUsuarios() já carrega tudo de uma
  // vez (sem paginação), então filtrar em memória é suficiente.
  const [filtroPerfil, setFiltroPerfil] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todas");

  const usuariosFiltrados = usuariosListados.filter((usuario) => {
    if (filtroPerfil !== "todos") {
      const valorPerfil = usuario.perfil ? String(usuario.perfil.id) : SEM_VALOR;
      if (valorPerfil !== filtroPerfil) return false;
    }
    if (filtroUnidade !== "todas") {
      const valorUnidade = usuario.unidade_id ? String(usuario.unidade_id) : SEM_VALOR;
      if (valorUnidade !== filtroUnidade) return false;
    }
    return true;
  });
  const contagemFiltros = [filtroPerfil !== "todos", filtroUnidade !== "todas"].filter(
    Boolean,
  ).length;

  function limparFiltros() {
    setFiltroPerfil("todos");
    setFiltroUnidade("todas");
  }

  function camposDeFiltro() {
    return (
      <>
        <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
          <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Filtrar por perfil">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            <SelectItem value={SEM_VALOR}>Sem perfil</SelectItem>
            {perfisDisponiveis.map((perfil) => (
              <SelectItem key={perfil.id} value={String(perfil.id)}>
                {perfil.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Filtrar por unidade"
          >
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            <SelectItem value={SEM_VALOR}>Sem unidade</SelectItem>
            {unidades.map((unidade) => (
              <SelectItem key={unidade.id} value={String(unidade.id)}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contagemFiltros > 0 && (
          <button
            type="button"
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        )}
      </>
    );
  }

  async function aoMudarPerfil(usuario: Usuario, valor: string) {
    try {
      await atualizar({
        id: usuario.id,
        payload: { perfil_id: valor === SEM_VALOR ? null : Number(valor) },
      });
      toast.success("Perfil atualizado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function aoMudarUnidade(usuario: Usuario, valor: string) {
    try {
      await atualizar({
        id: usuario.id,
        payload: { unidade_id: valor === SEM_VALOR ? null : Number(valor) },
      });
      toast.success("Unidade atualizada.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function aoMudarSetor(usuario: Usuario, valor: string) {
    try {
      await atualizar({
        id: usuario.id,
        payload: { setor_id: valor === SEM_VALOR ? null : Number(valor) },
      });
      toast.success("Setor atualizado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">Perfil, unidade e setor</h2>
        <p className="text-sm text-muted-foreground">
          Define o cargo e a lotação base de cada pessoa -- diferente das permissões
          individuais abaixo, isso vale enquanto não for alterado de novo (sem período).
        </p>
      </div>

      {/* Achado no dogfooding: filtros e botão de expandir numa linha só
          (não cabeçalho+botão numa linha e filtros noutra) -- mesmo
          critério do KanbanFiltros (o "Nova Demanda" mora na própria
          linha dos filtros, não no cabeçalho da página) e economiza uma
          linha inteira de altura, principalmente em mobile. */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {usuariosListados.length > 0 &&
          (ehMobile ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0">
                  <ListFilter className="size-4" />
                  <span className="sr-only">Filtros</span>
                  {contagemFiltros > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]"
                    >
                      {contagemFiltros}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="flex flex-col gap-2">
                {camposDeFiltro()}
              </PopoverContent>
            </Popover>
          ) : (
            camposDeFiltro()
          ))}
        <Button
          variant="outline"
          size="icon"
          onClick={onAlternarExpandir}
          aria-label={
            expandido ? "Recolher Perfil, unidade e setor" : "Expandir Perfil, unidade e setor"
          }
          className="ml-auto shrink-0"
        >
          {expandido ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      {usuariosListados.length > 0 && usuariosFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada com esses filtros.</p>
      ) : (
        /* min-w-0: mesmo achado de PermissoesAdmin -- sem isso, o
            min-w-[640px] da tabela abaixo vaza pro pai e força a coluna
            inteira mais larga que a viewport em telas estreitas, em vez de
            só essa caixa rolar horizontalmente. */
        <div className="scrollbar-discreta scroll-fade-x min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border">
          <table
            aria-label="Perfil, unidade e setor"
            className="w-full min-w-[640px] text-left text-sm"
          >
            {/* sticky: mesmo achado de PermissoesAdmin -- sem isso, rolar a
                tabela escondia os rótulos das colunas junto com as linhas.
                bg-muted sólido (não /40): translúcido deixaria as linhas
                por baixo aparecerem por trás do header ao rolar. */}
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Pessoa</th>
                <th className="px-4 py-2.5">Perfil</th>
                <th className="px-4 py-2.5">Unidade</th>
                <th className="px-4 py-2.5">Setor</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {nomeExibicao(usuario)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={usuario.perfil ? String(usuario.perfil.id) : SEM_VALOR}
                      onValueChange={(valor) => void aoMudarPerfil(usuario, valor)}
                    >
                      <SelectTrigger
                        aria-label={`Alterar perfil de ${nomeExibicao(usuario)}`}
                        className="w-full min-w-[10rem]"
                      >
                        <SelectValue placeholder="Sem perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VALOR}>Sem perfil</SelectItem>
                        {perfisDisponiveis.map((perfil) => (
                          <SelectItem key={perfil.id} value={String(perfil.id)}>
                            {perfil.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={usuario.unidade_id ? String(usuario.unidade_id) : SEM_VALOR}
                      onValueChange={(valor) => void aoMudarUnidade(usuario, valor)}
                    >
                      <SelectTrigger
                        aria-label={`Alterar unidade de ${nomeExibicao(usuario)}`}
                        className="w-full min-w-[10rem]"
                      >
                        <SelectValue placeholder="Sem unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VALOR}>Sem unidade</SelectItem>
                        {unidades.map((unidade) => (
                          <SelectItem key={unidade.id} value={String(unidade.id)}>
                            {unidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={usuario.setor_id ? String(usuario.setor_id) : SEM_VALOR}
                      onValueChange={(valor) => void aoMudarSetor(usuario, valor)}
                    >
                      <SelectTrigger
                        aria-label={`Alterar setor de ${nomeExibicao(usuario)}`}
                        className="w-full min-w-[10rem]"
                      >
                        <SelectValue placeholder="Sem setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VALOR}>Sem setor</SelectItem>
                        {setores.map((setor) => (
                          <SelectItem key={setor.id} value={String(setor.id)}>
                            {setor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
