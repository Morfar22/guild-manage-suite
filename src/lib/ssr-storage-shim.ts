/**
 * The generated Supabase browser client reads `localStorage` at module scope.
 * During SSR that global does not exist, which crashes every route. This shim
 * installs a harmless in-memory stand-in on the server only.
 *
 * NOTE: this must be invoked as a function (not a bare side-effect import) —
 * the package is marked `sideEffects: false`, so an import-only module gets
 * tree-shaken out of the production SSR bundle.
 */
export function installSsrStorageShim(): void {
  if (typeof globalThis.localStorage !== 'undefined') return;

  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
  if (typeof (globalThis as { sessionStorage?: unknown }).sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: memoryStorage,
      configurable: true,
    });
  }
}
