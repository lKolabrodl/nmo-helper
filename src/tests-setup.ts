import '@testing-library/jest-dom/vitest';

// Мок chrome.storage.local
const store: Record<string, unknown> = {};

globalThis.chrome = {
	storage: {
		local: {
			get: (key: string | string[], cb: (result: Record<string, unknown>) => void) => {
				const keys = Array.isArray(key) ? key : [key];
				const result: Record<string, unknown> = {};
				keys.forEach(k => { if (k in store) result[k] = store[k]; });
				cb(result);
			},
			set: (data: Record<string, unknown>, cb?: () => void) => {
				Object.assign(store, data);
				cb?.();
			},
		},
	},
	runtime: {
		sendMessage: (_msg: unknown, cb: (res: unknown) => void) => {
			cb({ error: false, status: 200, text: '{}' });
		},
	},
} as unknown as typeof chrome;
