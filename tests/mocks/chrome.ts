/**
 * Chrome API mocks for testing
 */

const mockStorage: Record<string, any> = {};

const chromeMock = {
  storage: {
    sync: {
      get: jest.fn((keys: string | string[] | null) => {
        return new Promise((resolve) => {
          if (keys === null) {
            resolve(mockStorage);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage[keys] });
          } else {
            const result: Record<string, any> = {};
            keys.forEach(key => {
              result[key] = mockStorage[key];
            });
            resolve(result);
          }
        });
      }),
      set: jest.fn((items: Record<string, any>) => {
        return new Promise<void>((resolve) => {
          Object.assign(mockStorage, items);
          resolve();
        });
      }),
      clear: jest.fn(() => {
        return new Promise<void>((resolve) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
          resolve();
        });
      })
    },
    local: {
      get: jest.fn((keys: string | string[] | null) => {
        return new Promise((resolve) => {
          if (keys === null) {
            resolve(mockStorage);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage[keys] });
          } else {
            const result: Record<string, any> = {};
            keys.forEach(key => {
              result[key] = mockStorage[key];
            });
            resolve(result);
          }
        });
      }),
      set: jest.fn((items: Record<string, any>) => {
        return new Promise<void>((resolve) => {
          Object.assign(mockStorage, items);
          resolve();
        });
      })
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
    openOptionsPage: jest.fn()
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://example.com' }])),
    sendMessage: jest.fn(() => Promise.resolve({})),
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// @ts-ignore
global.chrome = chromeMock;

// Mock indexedDB
const mockIDBData: Record<string, Record<string, any>> = {
  classifications: {},
  sources: {},
  keywords: {}
};

class MockIDBObjectStore {
  name: string;
  data: Record<string, any>;

  constructor(name: string) {
    this.name = name;
    this.data = mockIDBData[name] || {};
  }

  get(key: string) {
    return {
      result: this.data[key],
      onsuccess: null as any,
      onerror: null as any
    };
  }

  put(value: any) {
    const key = value.urlHash || value.domain || value.id;
    this.data[key] = value;
    return { onsuccess: null as any, onerror: null as any };
  }

  getAll() {
    return {
      result: Object.values(this.data),
      onsuccess: null as any,
      onerror: null as any
    };
  }

  count() {
    return {
      result: Object.keys(this.data).length,
      onsuccess: null as any,
      onerror: null as any
    };
  }

  createIndex() {
    return {};
  }
}

class MockIDBTransaction {
  objectStore(name: string) {
    return new MockIDBObjectStore(name);
  }
  oncomplete: any = null;
}

class MockIDBDatabase {
  objectStoreNames = {
    contains: () => false
  };

  createObjectStore(name: string) {
    mockIDBData[name] = {};
    return new MockIDBObjectStore(name);
  }

  transaction(storeNames: string | string[], mode?: string) {
    return new MockIDBTransaction();
  }
}

// @ts-ignore
global.indexedDB = {
  open: jest.fn(() => ({
    result: new MockIDBDatabase(),
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any
  }))
};

export { chromeMock, mockStorage, mockIDBData };
