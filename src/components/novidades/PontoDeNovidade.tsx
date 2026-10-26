/** Ponto no item "Novidades" do menu: há novidade que a pessoa ainda não viu. */
export function PontoDeNovidade() {
  return (
    <>
      <span aria-hidden className="ml-auto size-2 shrink-0 rounded-full bg-amber-400" />
      <span className="sr-only">(há novidades)</span>
    </>
  );
}
