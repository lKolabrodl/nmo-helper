import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageGet, storageSet } from './storage';

type GetFn = (key: string | string[], cb: (result: Record<string, unknown>) => void) => void;
type SetFn = (data: Record<string, unknown>, cb?: () => void) => void;

describe('fn storageGet', () => {
	it('возвращает сохранённое значение из chrome.storage.local', async () => {
		chrome.storage.local.set({ test_key_a: 'hello' });
		const v = await storageGet<string>('test_key_a', 'default');
		expect(v).toBe('hello');
	});

	it('возвращает defaultValue, если ключа нет', async () => {
		const v = await storageGet<string>('test_key_missing', 'fallback');
		expect(v).toBe('fallback');
	});

	it('возвращает объект как есть, не мутируя', async () => {
		const obj = { nested: { a: 1 } };
		chrome.storage.local.set({ test_key_obj: obj });
		const v = await storageGet<typeof obj>('test_key_obj', { nested: { a: 0 } });
		expect(v).toEqual(obj);
	});

	it('ложные значения (false/0/"") возвращаются как есть, а не подменяются defaultValue', async () => {
		chrome.storage.local.set({ test_key_false: false, test_key_zero: 0, test_key_empty: '' });
		expect(await storageGet<boolean>('test_key_false', true)).toBe(false);
		expect(await storageGet<number>('test_key_zero', 42)).toBe(0);
		expect(await storageGet<string>('test_key_empty', 'x')).toBe('');
	});

	it('null сохранённый как значение возвращается (а не подменяется default)', async () => {
		chrome.storage.local.set({ test_key_null: null });
		const v = await storageGet<string | null>('test_key_null', 'def');
		expect(v).toBeNull();
	});

	it('передаёт именно запрошенный ключ в chrome.storage.local.get', async () => {
		const spy = vi.fn<GetFn>((_key, cb) => cb({}));
		const original = chrome.storage.local.get;
		chrome.storage.local.get = spy as unknown as typeof chrome.storage.local.get;
		await storageGet('my_key', 'def');
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0]).toBe('my_key');
		chrome.storage.local.get = original;
	});
});

describe('fn storageSet', () => {
	it('записывает значение по ключу', async () => {
		storageSet('test_set_a', 'value');
		const v = await storageGet<string>('test_set_a', 'default');
		expect(v).toBe('value');
	});

	it('перезаписывает существующее значение', async () => {
		storageSet('test_set_b', 'first');
		storageSet('test_set_b', 'second');
		const v = await storageGet<string>('test_set_b', 'default');
		expect(v).toBe('second');
	});

	it('сохраняет объекты целиком', async () => {
		const obj = { a: 1, b: [1, 2, 3] };
		storageSet('test_set_obj', obj);
		const v = await storageGet<typeof obj>('test_set_obj', { a: 0, b: [] });
		expect(v).toEqual(obj);
	});

	it('вызывает chrome.storage.local.set с объектом { key: value }', () => {
		const spy = vi.fn<SetFn>();
		const original = chrome.storage.local.set;
		chrome.storage.local.set = spy as unknown as typeof chrome.storage.local.set;
		storageSet('some_key', 123);
		expect(spy).toHaveBeenCalledWith({ some_key: 123 });
		chrome.storage.local.set = original;
	});
});

describe('storage round-trip', () => {
	beforeEach(() => {
		// используем разные ключи в каждом тесте, но на всякий пусть будет
	});

	it('storageSet → storageGet возвращает то же значение', async () => {
		storageSet('rt_number', 42);
		storageSet('rt_string', 'abc');
		storageSet('rt_array', [1, 'two', null]);

		expect(await storageGet<number>('rt_number', 0)).toBe(42);
		expect(await storageGet<string>('rt_string', '')).toBe('abc');
		expect(await storageGet<unknown[]>('rt_array', [])).toEqual([1, 'two', null]);
	});
});
