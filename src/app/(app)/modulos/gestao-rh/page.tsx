import { redirect } from "next/navigation";

// O Painel de Absenteísmo (STC-596) ocupa esta rota; até lá, o módulo abre
// no Painel de Férias.
export default function GestaoRHPage() {
  redirect("/modulos/gestao-rh/ferias");
}
