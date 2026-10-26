import api from "./api";

/**
 * Notificações no celular (web push, STC-851). O service worker (public/sw.js)
 * só recebe o push; a inscrição do navegador vai para o backend (STC-847),
 * que manda os avisos que pedem ação, fora do horário silencioso (STC-874).
 */

export type EstadoPush =
  /** Navegador sem service worker, push ou notificações. */
  | "nao-suportado"
  /** iPhone e iPad: só recebem push com o Atlas instalado na tela de início. */
  | "precisa-instalar"
  /** Servidor sem as chaves configuradas. */
  | "indisponivel"
  /** O usuário recusou a permissão: só ele libera, nas configurações. */
  | "bloqueado"
  | "desativado"
  | "ativado";

const CAMINHO_DO_SERVICE_WORKER = "/sw.js";

export function navegadorSuportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone e iPad (o iPadOS se apresenta como Mac; o toque o distingue). */
export function ehAparelhoApple(userAgent: string, pontosDeToque = 0): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && pontosDeToque > 1);
}

export async function obterChavePublicaPush(): Promise<string | null> {
  const { data } = await api.get<{ chave_publica: string | null }>("/plataforma/push/chave-publica/");
  return data.chave_publica;
}

/** A chave VAPID vem em base64url; o navegador quer os bytes. */
export function chaveParaBytes(chave: string): Uint8Array<ArrayBuffer> {
  const base64 = (chave + "=".repeat((4 - (chave.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration(CAMINHO_DO_SERVICE_WORKER);
  return registro ? registro.pushManager.getSubscription() : null;
}

export async function estadoDoPush(appInstalado: boolean): Promise<EstadoPush> {
  if (ehAparelhoApple(navigator.userAgent, navigator.maxTouchPoints) && !appInstalado) {
    return "precisa-instalar";
  }
  if (!navegadorSuportaPush()) return "nao-suportado";
  if (Notification.permission === "denied") return "bloqueado";
  if (!(await obterChavePublicaPush())) return "indisponivel";
  return (await inscricaoAtual()) ? "ativado" : "desativado";
}

/**
 * Pede a permissão e inscreve o navegador. Precisa vir de um clique: o
 * navegador recusa o pedido de permissão fora de um gesto do usuário.
 * Devolve o estado final ("ativado", "bloqueado" se a pessoa recusou).
 */
export async function ativarPush(): Promise<EstadoPush> {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desativado";
  const chave = await obterChavePublicaPush();
  if (!chave) return "indisponivel";
  const registro = await navigator.serviceWorker.register(CAMINHO_DO_SERVICE_WORKER);
  await navigator.serviceWorker.ready;
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(chave),
    }));
  await api.post("/plataforma/push/inscricoes/", inscricao.toJSON());
  return "ativado";
}

/** Cancela no backend e no navegador. Sem inscrição, não faz nada. */
export async function desativarPush(): Promise<void> {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return;
  await api.post("/plataforma/push/inscricoes/cancelar/", { endpoint: inscricao.endpoint });
  await inscricao.unsubscribe();
}

const LIMITE_NO_LOGOUT_MS = 3000;

/**
 * Ao sair do Atlas: num celular compartilhado, quem entra depois não pode
 * receber os avisos de quem saiu. Nunca impede o logout: sem rede, ou se
 * demorar, segue em frente (o navegador ainda tenta cancelar a inscrição).
 */
export async function cancelarPushAoSair(): Promise<void> {
  if (!navegadorSuportaPush()) return;
  const cancelar = (async () => {
    const inscricao = await inscricaoAtual();
    if (!inscricao) return;
    try {
      await api.post("/plataforma/push/inscricoes/cancelar/", { endpoint: inscricao.endpoint });
    } finally {
      await inscricao.unsubscribe();
    }
  })().catch(() => undefined);
  await Promise.race([
    cancelar,
    new Promise((resolver) => setTimeout(resolver, LIMITE_NO_LOGOUT_MS)),
  ]);
}
