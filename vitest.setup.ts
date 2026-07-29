import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// STC-171: sem "globals: true" no vitest.config.ts, o auto-cleanup do RTL
// (que depende de um afterEach global) não dispara sozinho -- o DOM de um
// render() ficava vivo entre testes do mesmo arquivo, fazendo o segundo
// teste "encontrar" elementos duplicados do primeiro.
afterEach(() => {
  cleanup();
});

// jsdom não implementa ResizeObserver -- componentes do Radix (Select, via
// @radix-ui/react-use-size) usam pra medir o trigger e quebram no mount
// sem isso, mesmo sem o dropdown chegar a abrir.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

// Radix Select (interação de abrir/escolher opção via ponteiro) chama esses
// 3 métodos de Pointer Events que o jsdom não implementa -- sem eles,
// clicar pra abrir o Select derruba o teste com "not a function".
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
