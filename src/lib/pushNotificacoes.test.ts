import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import {
  ativarPush,
  cancelarPushAoSair,
  chaveParaBytes,
  desativarPush,
  ehAparelhoApple,
  estadoDoPush,
  sincronizarPush,
} from "./pushNotificacoes";

vi.mock("./api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const INSCRICAO_JSON = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "chave", auth: "segredo" },
};

/** Inscrição do navegador, feita com a chave atual ("BAEC") ou outra. */
function inscricaoFalsa(chave = "BAEC") {
  return {
    endpoint: INSCRICAO_JSON.endpoint,
    options: { applicationServerKey: chaveParaBytes(chave).buffer },
    toJSON: () => INSCRICAO_JSON,
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

/** Navegador com service worker, push e notificações, como o Chrome do Android. */
function simularNavegador({
  userAgent = ANDROID,
  permissao = "default" as NotificationPermission,
  respostaDaPermissao = "granted" as NotificationPermission,
  inscricao = null as ReturnType<typeof inscricaoFalsa> | null,
} = {}) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(inscricao),
    subscribe: vi.fn().mockResolvedValue(inscricaoFalsa()),
  };
  const registro = { pushManager };
  const serviceWorker = {
    register: vi.fn().mockResolvedValue(registro),
    getRegistration: vi.fn().mockResolvedValue(inscricao ? registro : undefined),
    ready: Promise.resolve(registro),
  };
  vi.stubGlobal("navigator", { userAgent, maxTouchPoints: 5, serviceWorker });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal(
    "Notification",
    Object.assign(function Notification() {}, {
      permission: permissao,
      requestPermission: vi.fn().mockResolvedValue(respostaDaPermissao),
    }),
  );
  return { pushManager, serviceWorker };
}

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: { chave_publica: "BAEC" } });
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
});

const SESSAO_VER_COMO = {
  id: "6f1c2a7e-0000-4000-8000-000000000001",
  usuario: { id: 7, nome: "Coordenação" },
  admin: { id: 1, nome: "Admin" },
  iniciada_em: "2026-10-19T15:00:00Z",
  expira_em: "2099-10-19T16:00:00Z",
};

describe("chaveParaBytes", () => {
  it("decodifica a chave em base64url", () => {
    expect(Array.from(chaveParaBytes("-_8"))).toEqual([251, 255]);
  });
});

describe("ehAparelhoApple", () => {
  it("reconhece iPhone e o iPad que se apresenta como Mac", () => {
    expect(ehAparelhoApple(IPHONE)).toBe(true);
    expect(ehAparelhoApple("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5)).toBe(true);
    expect(ehAparelhoApple("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0)).toBe(false);
    expect(ehAparelhoApple(ANDROID)).toBe(false);
  });
});

describe("estadoDoPush", () => {
  it("iPhone fora do app instalado: precisa instalar", async () => {
    simularNavegador({ userAgent: IPHONE });
    expect(await estadoDoPush(false)).toBe("precisa-instalar");
  });

  it("iPhone com o app instalado segue as outras regras", async () => {
    simularNavegador({ userAgent: IPHONE });
    expect(await estadoDoPush(true)).toBe("desativado");
  });

  it("sem suporte a push: não suportado", async () => {
    vi.stubGlobal("navigator", { userAgent: ANDROID, maxTouchPoints: 0 });
    expect(await estadoDoPush(false)).toBe("nao-suportado");
  });

  it("permissão recusada: bloqueado", async () => {
    simularNavegador({ permissao: "denied" });
    expect(await estadoDoPush(false)).toBe("bloqueado");
  });

  it("servidor sem chave: indisponível", async () => {
    simularNavegador();
    vi.mocked(api.get).mockResolvedValue({ data: { chave_publica: null } });
    expect(await estadoDoPush(false)).toBe("indisponivel");
  });

  it("com inscrição no aparelho: ativado; sem: desativado", async () => {
    simularNavegador({ permissao: "granted", inscricao: inscricaoFalsa() });
    expect(await estadoDoPush(false)).toBe("ativado");

    simularNavegador({ permissao: "granted" });
    expect(await estadoDoPush(false)).toBe("desativado");
  });
});

describe("ativarPush", () => {
  it("com permissão: registra o service worker, inscreve com a chave e envia ao backend", async () => {
    const { pushManager, serviceWorker } = simularNavegador();

    expect(await ativarPush()).toBe("ativado");

    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes("BAEC"),
    });
    expect(api.post).toHaveBeenCalledWith("/plataforma/push/inscricoes/", INSCRICAO_JSON);
  });

  it("backend falhou: desfaz a inscrição do navegador, para não parecer ativado", async () => {
    const { pushManager } = simularNavegador();
    const nova = inscricaoFalsa();
    pushManager.subscribe.mockResolvedValue(nova);
    vi.mocked(api.post).mockRejectedValue(new Error("rede"));

    await expect(ativarPush()).rejects.toThrow("rede");

    expect(nova.unsubscribe).toHaveBeenCalled();
  });

  it("inscrição antiga com outra chave: refaz com a atual", async () => {
    const antiga = inscricaoFalsa("AQID");
    const { pushManager } = simularNavegador({ inscricao: antiga });

    await ativarPush();

    expect(antiga.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("inscrição com a chave atual: reaproveita", async () => {
    const atual = inscricaoFalsa();
    const { pushManager } = simularNavegador({ inscricao: atual });

    await ativarPush();

    expect(atual.unsubscribe).not.toHaveBeenCalled();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith("/plataforma/push/inscricoes/", INSCRICAO_JSON);
  });

  it("permissão recusada: bloqueado, sem inscrever", async () => {
    const { pushManager } = simularNavegador({ respostaDaPermissao: "denied" });

    expect(await ativarPush()).toBe("bloqueado");

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("desativarPush", () => {
  it("cancela no backend e no navegador", async () => {
    const inscricao = inscricaoFalsa();
    simularNavegador({ inscricao });

    await desativarPush();

    expect(api.post).toHaveBeenCalledWith("/plataforma/push/inscricoes/cancelar/", {
      endpoint: INSCRICAO_JSON.endpoint,
    });
    expect(inscricao.unsubscribe).toHaveBeenCalled();
  });
});

describe("cancelarPushAoSair", () => {
  it("cancela no backend e no navegador", async () => {
    const inscricao = inscricaoFalsa();
    simularNavegador({ inscricao });

    await cancelarPushAoSair();

    expect(api.post).toHaveBeenCalledWith("/plataforma/push/inscricoes/cancelar/", {
      endpoint: INSCRICAO_JSON.endpoint,
    });
    expect(inscricao.unsubscribe).toHaveBeenCalled();
  });

  it("desfaz no navegador antes de avisar o backend", async () => {
    const inscricao = inscricaoFalsa();
    simularNavegador({ inscricao });
    const ordem: string[] = [];
    inscricao.unsubscribe.mockImplementation(async () => {
      ordem.push("navegador");
      return true;
    });
    vi.mocked(api.post).mockImplementation(async () => {
      ordem.push("backend");
      return { data: undefined };
    });

    await cancelarPushAoSair();

    expect(ordem).toEqual(["navegador", "backend"]);
  });

  it("sem rede: cancela no navegador e não trava o logout", async () => {
    const inscricao = inscricaoFalsa();
    simularNavegador({ inscricao });
    vi.mocked(api.post).mockRejectedValue(new Error("rede"));

    await expect(cancelarPushAoSair()).resolves.toBeUndefined();
    expect(inscricao.unsubscribe).toHaveBeenCalled();
  });

  it("backend que não responde: segue depois de 3 segundos", async () => {
    vi.useFakeTimers();
    simularNavegador({ inscricao: inscricaoFalsa() });
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));

    const saida = cancelarPushAoSair();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(saida).resolves.toBeUndefined();
  });
});

describe("sincronizarPush", () => {
  it("aparelho com notificações ativadas: reenvia a inscrição para quem está logado", async () => {
    simularNavegador({ permissao: "granted", inscricao: inscricaoFalsa() });

    await sincronizarPush();

    expect(api.post).toHaveBeenCalledWith("/plataforma/push/inscricoes/", INSCRICAO_JSON);
  });

  it("chave trocada no servidor: refaz a inscrição antes de reenviar", async () => {
    const antiga = inscricaoFalsa("AQID");
    const { pushManager } = simularNavegador({ permissao: "granted", inscricao: antiga });

    await sincronizarPush();

    expect(antiga.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(api.post).toHaveBeenCalled();
  });

  it("sem inscrição, sem permissão ou no ver como: não faz nada", async () => {
    simularNavegador({ permissao: "granted" });
    await sincronizarPush();

    simularNavegador({ permissao: "default", inscricao: inscricaoFalsa() });
    await sincronizarPush();

    simularNavegador({ permissao: "granted", inscricao: inscricaoFalsa() });
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO_VER_COMO));
    await sincronizarPush();

    expect(api.post).not.toHaveBeenCalled();
  });

  it("erro não chega à tela", async () => {
    simularNavegador({ permissao: "granted", inscricao: inscricaoFalsa() });
    vi.mocked(api.post).mockRejectedValue(new Error("rede"));

    await expect(sincronizarPush()).resolves.toBeUndefined();
  });
});
