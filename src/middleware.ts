export { auth as middleware } from "@/auth";

// Faltava excluir assets estáticos de public/ (ex.: /brand/*) -- sem isso,
// o self-fetch interno do next/image pra otimizar uma imagem local passava
// pelo middleware de auth e voltava sem corpo ("received null"). O padrão
// abaixo exclui qualquer caminho com extensão de arquivo, não só os fixos
// de antes (api/_next/favicon.ico) -- cobre qualquer asset futuro em
// public/ sem precisar atualizar este matcher de novo.
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.[\\w]+$).*)"],
};
