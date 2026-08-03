"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const perfisDisponiveis = perfis.filter((perfil) => perfil.nivel > NIVEL_ADMIN_OPERACOES);
  const usuariosListados = usuarios.filter(
    (usuario) => !usuario.perfil || usuario.perfil.nivel > NIVEL_ADMIN_OPERACOES,
  );

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Perfil, unidade e setor</h2>
          <p className="text-sm text-muted-foreground">
            Define o cargo e a lotação base de cada pessoa -- diferente das permissões
            individuais abaixo, isso vale enquanto não for alterado de novo (sem período).
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onAlternarExpandir}
          aria-label={
            expandido ? "Recolher Perfil, unidade e setor" : "Expandir Perfil, unidade e setor"
          }
          className="shrink-0"
        >
          {expandido ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      <div className="scrollbar-discreta min-h-0 flex-1 overflow-auto rounded-lg border border-border">
        <table
          aria-label="Perfil, unidade e setor"
          className="w-full min-w-[640px] text-left text-sm"
        >
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5">Pessoa</th>
              <th className="px-4 py-2.5">Perfil</th>
              <th className="px-4 py-2.5">Unidade</th>
              <th className="px-4 py-2.5">Setor</th>
            </tr>
          </thead>
          <tbody>
            {usuariosListados.map((usuario) => (
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
    </div>
  );
}
