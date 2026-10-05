import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { decode, encode } from "next-auth/jwt";
import { caminhoDoPython } from "./python-bin";

// STC-611 (issue-pai STC-609): voltar pra aba depois que o access expirava
// deslogava a pessoa em ~2s -- o SWR revalidava tudo de uma vez e as
// requisições que chegavam depois da primeira renovação renovavam com um
// refresh já revogado. Cada teste monta a própria sessão com um access de
// validade controlada (em vez da sessão do auth.setup.ts, de 1h) e, no fim,
// confere que o refresh guardado no cookie ainda vale: uma sessão que
// "parece viva" com refresh revogado no cookie cairia na próxima renovação.

const BACKEND_DIR = path.resolve(__dirname, "../../backend");
const PYTHON = caminhoDoPython(BACKEND_DIR);
const EMAIL_E2E = "e2e-tester@grupobrmed.com.br";
// Build de produção sobre HTTP (ver auth.setup.ts): o proxy BFF e a rota de
// renovação leem e escrevem o cookie com prefixo __Secure-; o auth() do
// middleware lê o sem prefixo. Os dois são gravados; o que importa pra
// renovação é o com prefixo.
const COOKIE_DO_PROXY = "__Secure-authjs.session-token";
const COOKIE_DO_MIDDLEWARE = "authjs.session-token";
const PAGINA = "/modulos/gestao-demandas";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

function shellDjango(codigo: string) {
  return execFileSync(PYTHON, ["manage.py", "shell", "--settings=core.settings.e2e", "-c", codigo], {
    cwd: BACKEND_DIR,
    encoding: "utf-8",
  })
    .trim()
    .split("\n")
    .pop()!;
}

function segredo(): string {
  const doAmbiente = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (doAmbiente) return doAmbiente;
  const linha = readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("NEXTAUTH_SECRET="));
  if (!linha) throw new Error("NEXTAUTH_SECRET não encontrado (ambiente ou .env.local).");
  return linha.slice("NEXTAUTH_SECRET=".length).trim();
}

function jtiDe(jwt: string): string {
  return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).jti;
}

/** Sessão nova do usuário seedado, emitida como no login (com família de
 * refresh, STC-631), com o access valendo `accessTtlSegundos`
 * (negativo = já expirado). `revogada`: refresh já na blacklist (sessão
 * inválida de verdade). */
async function abrirSessao(
  context: BrowserContext,
  opcoes: { accessTtlSegundos: number; revogada?: boolean },
) {
  const saida = shellDjango(`
import json
from datetime import timedelta
from accounts.familia_refresh import emitir_refresh
from accounts.models import Usuario
from accounts.serializers import UsuarioSerializer
u = Usuario.objects.get(email="${EMAIL_E2E}")
r = emitir_refresh(u)
a = r.access_token
a.set_exp(lifetime=timedelta(seconds=${opcoes.accessTtlSegundos}))
${opcoes.revogada ? "r.blacklist()" : ""}
print(json.dumps({"access": str(a), "refresh": str(r), "user": UsuarioSerializer(u).data}))
`);
  const { access, refresh, user } = JSON.parse(saida);
  const token = {
    sub: String(user.id),
    email: user.email,
    name: `${user.first_name} ${user.last_name}`.trim(),
    backendAccessToken: access,
    backendRefreshToken: refresh,
    backendUser: user,
  };
  const cookies = await Promise.all(
    [COOKIE_DO_MIDDLEWARE, COOKIE_DO_PROXY].map(async (nome) => ({
      name: nome,
      value: await encode({ token, secret: segredo(), salt: nome, maxAge: 60 * 60 * 24 * 7 }),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: nome === COOKIE_DO_PROXY,
      sameSite: "Lax" as const,
    })),
  );
  await context.addCookies(cookies);
  return { access: access as string, refresh: refresh as string };
}

/** O refresh guardado agora no cookie que o proxy usa ainda vale? */
async function refreshDoCookieAindaVale(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) => c.name === COOKIE_DO_PROXY);
  if (!cookie) return false;
  const token = await decode({ token: cookie.value, secret: segredo(), salt: COOKIE_DO_PROXY });
  const jti = jtiDe(token!.backendRefreshToken as string);
  return (
    shellDjango(`
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
print(BlacklistedToken.objects.filter(token__jti="${jti}").exists())
`) === "False"
  );
}

/** Simula outra requisição renovando este refresh devagar: segura a trava
 * da janela de tolerância do backend, espera `segundos` e só então rotaciona
 * e guarda o par -- como uma renovação lenta de verdade. Resolve quando a
 * trava já está presa; `terminou` resolve quando a renovação acaba. */
function renovacaoLentaDeOutraRequisicao(refresh: string, segundos: number) {
  const jti = jtiDe(refresh);
  const processo = spawn(
    PYTHON,
    [
      "manage.py",
      "shell",
      "--settings=core.settings.e2e",
      "-c",
      `
import time
from django.core.cache import cache
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from accounts import janela_refresh
trava = "refresh-janela-trava:${jti}"
cache.add(trava, 1, 30)
print("trava-presa", flush=True)
time.sleep(${segundos})
serializer = TokenRefreshSerializer(data={"refresh": "${refresh}"})
serializer.is_valid(raise_exception=True)
janela_refresh.guardar("${jti}", serializer.validated_data)
cache.delete(trava)
`,
    ],
    { cwd: BACKEND_DIR },
  );
  const terminou = new Promise<void>((resolver, rejeitar) =>
    processo.on("exit", (codigo) =>
      codigo === 0 ? resolver() : rejeitar(new Error(`renovação lenta saiu com ${codigo}`)),
    ),
  );
  return new Promise<{ terminou: Promise<void> }>((resolver) =>
    processo.stdout.on("data", (dados) => {
      if (String(dados).includes("trava-presa")) resolver({ terminou });
    }),
  );
}

/** Simula a aba ficando escondida ou voltando a ter foco. Com a aba
 * escondida o SWR pausa o polling; ao voltar, revalida tudo de uma vez. */
async function visibilidade(page: Page, estado: "hidden" | "visible") {
  await page.evaluate((e) => {
    Object.defineProperty(document, "visibilityState", { value: e, configurable: true });
    Object.defineProperty(document, "hidden", { value: e === "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (e === "visible") window.dispatchEvent(new Event("focus"));
  }, estado);
}

function contarSignOut(page: Page) {
  const chamadas: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/api/auth/signout")) chamadas.push(req.url());
  });
  return chamadas;
}

async function esperarTelaLogada(page: Page) {
  await expect(page.getByRole("button", { name: "Nova Demanda" })).toBeVisible();
}

test.beforeEach(() => {
  // Throttle do /api/auth/refresh/ é 20/min por usuário, e todos os testes
  // usam o mesmo usuário seedado.
  shellDjango("from django.core.cache import cache; cache.clear(); print('ok')");
});

test("abrir o Atlas com o access já expirado não desloga", async ({ context, page }) => {
  test.setTimeout(60_000);
  await abrirSessao(context, { accessTtlSegundos: -60 });
  const signOuts = contarSignOut(page);

  await page.goto(PAGINA);
  await esperarTelaLogada(page);
  await page.waitForTimeout(4_000);

  expect(new URL(page.url()).pathname).toBe(PAGINA);
  expect(signOuts).toHaveLength(0);
  expect(await refreshDoCookieAindaVale(context)).toBe(true);
});

test("voltar para a aba depois que o access expirou não desloga", async ({ context, page }) => {
  test.setTimeout(60_000);
  await abrirSessao(context, { accessTtlSegundos: 6 });
  const signOuts = contarSignOut(page);
  await page.goto(PAGINA);
  await esperarTelaLogada(page);

  await visibilidade(page, "hidden");
  await page.waitForTimeout(9_000);
  await visibilidade(page, "visible");
  await page.waitForTimeout(5_000);

  await esperarTelaLogada(page);
  expect(new URL(page.url()).pathname).toBe(PAGINA);
  expect(signOuts).toHaveLength(0);
  expect(await refreshDoCookieAindaVale(context)).toBe(true);
});

test("duas abas voltando ao mesmo tempo não deslogam", async ({ context }) => {
  test.setTimeout(60_000);
  await abrirSessao(context, { accessTtlSegundos: 6 });
  const abas = [await context.newPage(), await context.newPage()];
  const signOuts = abas.map(contarSignOut);
  for (const aba of abas) {
    await aba.goto(PAGINA);
    await esperarTelaLogada(aba);
  }

  await Promise.all(abas.map((aba) => visibilidade(aba, "hidden")));
  await abas[0].waitForTimeout(9_000);
  // As duas renovam ao mesmo tempo, cada uma com o seu single-flight: é a
  // janela de tolerância do backend (STC-610) que dá o mesmo par às duas.
  await Promise.all(abas.map((aba) => visibilidade(aba, "visible")));
  await abas[0].waitForTimeout(5_000);

  for (const aba of abas) {
    await esperarTelaLogada(aba);
    expect(new URL(aba.url()).pathname).toBe(PAGINA);
  }
  expect(signOuts.flat()).toHaveLength(0);
  expect(await refreshDoCookieAindaVale(context)).toBe(true);
});

test("sessão inválida de verdade leva ao login, com um único signOut", async ({ context, page }) => {
  test.setTimeout(60_000);
  await abrirSessao(context, { accessTtlSegundos: -60, revogada: true });
  const signOuts = contarSignOut(page);

  await page.goto(PAGINA);
  await page.waitForURL(/\/login/);
  await page.waitForTimeout(2_000);

  expect(signOuts).toHaveLength(1);
});

test("renovação concorrente lenta (503 no backend enquanto espera) não desloga", async ({
  context,
  page,
}) => {
  test.setTimeout(60_000);
  const { refresh } = await abrirSessao(context, { accessTtlSegundos: -60 });
  // Outra requisição segura a trava deste refresh e só termina a renovação
  // 6s depois. Quem chega enquanto isso espera até o teto do backend (5s),
  // recebe 503 e tenta de novo depois do Retry-After -- e então encontra o
  // par que a outra guardou.
  const outra = await renovacaoLentaDeOutraRequisicao(refresh, 6);
  const signOuts = contarSignOut(page);

  await page.goto(PAGINA);
  await esperarTelaLogada(page);
  await outra.terminou;
  await page.waitForTimeout(4_000);

  await esperarTelaLogada(page);
  expect(signOuts).toHaveLength(0);
  expect(new URL(page.url()).pathname).toBe(PAGINA);
  expect(await refreshDoCookieAindaVale(context)).toBe(true);
});

test('"Sair" revoga a sessão no backend', async ({ context, page }) => {
  test.setTimeout(60_000);
  const { refresh } = await abrirSessao(context, { accessTtlSegundos: 3600 });
  await page.goto(PAGINA);
  await esperarTelaLogada(page);

  await page.getByRole("button", { name: /^Olá,/ }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL(/\/login/);

  await expect
    .poll(() =>
      shellDjango(`
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
print(BlacklistedToken.objects.filter(token__jti="${jtiDe(refresh)}").exists())
`),
    )
    .toBe("True");
});
