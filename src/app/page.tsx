import { redirect } from "next/navigation";

export default function Home() {
  // Hub fica escondido enquanto so existir um modulo de verdade (Gestao de
  // Demandas) -- ver Sidebar.tsx. Voltar pra "/hub" quando reativar.
  redirect("/modulos/gestao-demandas");
}
