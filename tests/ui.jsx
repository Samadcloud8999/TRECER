import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Element: dom.window.Element,
  SVGElement: dom.window.SVGElement,
  HTMLElement: dom.window.HTMLElement,
  HTMLCanvasElement: dom.window.HTMLCanvasElement,
  localStorage: dom.window.localStorage,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.requestAnimationFrame = (cb) =>
  setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = clearTimeout;
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = clearTimeout;
window.matchMedia = globalThis.matchMedia = () => ({
  matches: true,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLCanvasElement.prototype.getContext = () => null;
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
const React = await import("react");
const { render, screen, waitFor, cleanup } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { BrowserRouter } = await import("react-router-dom");
const { default: App } = await import("../src/App.jsx");
const { readData } = await import("../src/store.js");
const assert = (await import("node:assert/strict")).default;
const user = userEvent.setup();
render(React.createElement(BrowserRouter, null, React.createElement(App)));
await screen.findByRole("heading", { name: /Всё под контролем/ });
await user.click(screen.getByRole("button", { name: "Записать расход" }));
await user.type(screen.getByLabelText("Сумма, сом"), "125,50");
await user.type(screen.getByLabelText("Что записать?"), "Тестовый хлеб");
await user.click(screen.getByRole("button", { name: "Добавить запись" }));
await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
assert.equal((await readData()).records[0].amount, 125.5);
await user.click(screen.getByRole("link", { name: "Расходы" }));
await user.click(
  screen.getByRole("button", { name: "Изменить Тестовый хлеб" }),
);
await user.clear(screen.getByLabelText("Сумма, сом"));
await user.type(screen.getByLabelText("Сумма, сом"), "200");
await user.click(screen.getByRole("button", { name: "Сохранить изменения" }));
await waitFor(async () =>
  assert.equal((await readData()).records[0].amount, 200),
);
await user.click(screen.getByRole("link", { name: "Накопления" }));
await user.click(screen.getByRole("button", { name: "Пополнить" }));
await user.type(screen.getByLabelText("Сумма, сом"), "500");
await user.click(screen.getByRole("button", { name: "Добавить запись" }));
await waitFor(async () => assert.equal((await readData()).records.length, 2));
cleanup();
render(React.createElement(BrowserRouter, null, React.createElement(App)));
await screen.findByRole("heading", { name: /Накопления/ });
assert.equal(
  (await readData()).records.find((r) => r.kind === "saving").amount,
  500,
);
await user.click(screen.getByRole("link", { name: "Друзья" }));
await screen.findByRole("heading", { name: "Подключи облачный аккаунт" });
await user.click(screen.getByRole("link", { name: "Аккаунт" }));
await screen.findByRole("heading", { name: "Google-вход пока не настроен" });
cleanup();
console.log("PASS: account and friends setup states");
console.log("PASS: decimal input, edit, savings, persisted reload");
process.exit(0);
