/**
 * Vitest setup — runs before every test file. Add jest-dom matchers,
 * polyfills, or global mocks here as the test suite grows.
 */
import "@testing-library/jest-dom/vitest";

// jsdom has no layout engine: `clientHeight` / `clientWidth` are 0 for
// every element, and `ResizeObserver` is missing. `@tanstack/react-virtual`
// reads both to decide which rows to mount, so under jsdom it would
// otherwise render zero rows. Shim the scroll-container dimensions to a
// generous viewport and stub `ResizeObserver` so virtualized DataTable
// renders all rows in tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

for (const prop of ["clientHeight", "clientWidth", "offsetHeight", "offsetWidth"] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get() {
      return 2000;
    },
  });
}
