// Service worker do Atlas (STC-851): só as notificações no celular (web
// push). Não guarda páginas nem dados em cache: sem handler de "fetch", toda
// requisição segue direto para a rede, como sem service worker.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

// Só caminhos do próprio Atlas: um link de outro endereço vira a página inicial.
function destinoSeguro(link) {
  try {
    const url = new URL(link || "/", self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + "/";
  } catch {
    return self.location.origin + "/";
  }
}

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = {};
  }
  const link = destinoSeguro(dados.link);
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "Atlas", {
      body: dados.texto || "",
      icon: "/icons/icone-192.png",
      // Mesma demanda: a notificação nova substitui a anterior em vez de
      // empilhar, e ainda avisa.
      tag: link,
      renotify: true,
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = destinoSeguro(evento.notification.data && evento.notification.data.link);
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aberta = janelas.find((janela) => new URL(janela.url).origin === self.location.origin);
      if (aberta) {
        await aberta.focus();
        try {
          await aberta.navigate(destino);
          return;
        } catch {
          // Janela que o service worker não controla não aceita navigate.
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
