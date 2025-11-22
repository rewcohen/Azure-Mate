import '@testing-library/jest-dom';

// Mock window APIs that aren't available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Electron API
Object.defineProperty(window, 'electronAPI', {
  value: {
    checkPowerShell: () => Promise.resolve({}),
    installAzModule: () => Promise.resolve(),
    connectAzure: () => Promise.resolve(),
    executePowerShell: () => Promise.resolve(),
    stopPowerShell: () => Promise.resolve(true),
    platform: 'win32',
    isElectron: true,
  },
});
