import { vi } from 'vitest';

// Mock chrome API
const mockStorage: Record<string, unknown> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn((key: string, cb: (result: Record<string, unknown>) => void) => {
        cb({ [key]: mockStorage[key] });
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn((_msg: unknown, cb: (response: unknown) => void) => {
      cb({ error: false, status: 200, text: '' });
    }),
  },
};
