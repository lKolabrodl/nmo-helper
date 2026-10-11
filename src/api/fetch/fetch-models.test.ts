import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {storageGet, storageSet} from '../storage';
import {fetchViaBackground, type IRequestResponse} from './fetch';
import {AI_MODELS_CACHE_KEY, AI_MODELS_CATALOG_URL, AI_MODELS_URL, fetchModels, getCachedModels, mergeModels, parseModelCatalog} from './fetch-models';

vi.mock('./fetch', () => ({fetchViaBackground: vi.fn()}));

beforeAll(() => vi.stubGlobal('crypto', {
	subtle: {digest: vi.fn(async (_algorithm: string, data: Uint8Array) => Uint8Array.from(data, byte => byte ^ 0xaa).buffer)},
}));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
	vi.clearAllMocks();
	storageSet(AI_MODELS_CACHE_KEY, null);
});

function row(key: string, overrides: Record<string, unknown> = {}) {
	return {
		key,
		displayName: key.split('/')[1],
		category: 'text',
		contextTokens: 256_000,
		capabilities: ['reasoning', 'structured'],
		publishedAt: Date.now() - 24 * 60 * 60 * 1000,
		breakdown: [
			{key: 'input_tokens', price: 100, hint: 'за 1М токенов'},
			{key: 'output_tokens', price: 300, hint: 'за 1М токенов'},
			{key: 'cache_read_input_tokens', price: 10, hint: 'за 1М токенов'},
		],
		...overrides,
	};
}

function flight(rows: unknown[]): string {
	return `0:["$","div",null,{"children":"Каталог"}]\na:["$","$L1",null,${JSON.stringify({rows})}]\n`;
}

function response(text: string, status = 200): IRequestResponse {
	return {error: false, status, text};
}

function serve(rows: unknown[], ids: string[] = ['provider/model']) {
	vi.mocked(fetchViaBackground).mockImplementation(async url =>
		url === AI_MODELS_CATALOG_URL ? response(flight(rows)) : response(JSON.stringify({data: ids.map(id => ({id}))})),
	);
}

describe('каталог моделей ProxyAPI', () => {
	it('разбирает RSC, тарифы ввода и вывода и оставляет текстовые модели', () => {
		const catalog = parseModelCatalog(flight([
			row('provider/model'),
			row('provider/image', {category: 'image'}),
			row('provider/embedding', {category: 'embedding'}),
			row('provider/decision', {category: 'decisions'}),
			{category: 'text', key: 42},
		]));

		expect(catalog).toHaveLength(1);
		expect(catalog[0]).toMatchObject({id: 'provider/model', vendor: 'provider', inputPrice: 100, outputPrice: 300, reasoning: true});
		expect(catalog[0]).not.toHaveProperty('cacheReadPrice');
	});

	it('убирает генераторы изображений из категории text и сохраняет текстовые модели с vision', () => {
		const catalog = parseModelCatalog(flight([
			row('provider/chat-vision', {inputModalities: ['text', 'image'], capabilities: ['vision', 'reasoning', 'structured']}),
			row('provider/chat-image'),
			row('provider/render', {outputModalities: ['text', 'image']}),
			row('provider/painter', {capabilities: ['image_generation']}),
			row('provider/gpt-audio'),
			row('provider/renderer', {breakdown: [{key: 'image_output_tokens', price: 1000, hint: 'за 1М токенов'}]}),
		]));

		expect(catalog.map(model => model.id)).toEqual(['provider/chat-vision']);
	});

	it('понимает вынесенный массив rows и HTML со встроенными RSC-данными', () => {
		const payload = `1:["$","$L1",null,{"rows":"$a"}]\na:${JSON.stringify([row('provider/model')])}\n`;
		const html = `<html><script>throw new Error('Этот скрипт нельзя выполнять')</script><script>self.__next_f.push(${JSON.stringify([1, payload])})</script></html>`;

		expect(parseModelCatalog(payload)[0].id).toBe('provider/model');
		expect(parseModelCatalog(html)[0].id).toBe('provider/model');
	});

	it('не выдаёт некорректные тарифы или цены за другую единицу за цену миллиона токенов', () => {
		const catalog = parseModelCatalog(flight([row('provider/model', {breakdown: [
			{key: 'input_tokens', price: -1, hint: 'за 1М токенов'},
			{key: 'output_tokens', price: 20, hint: 'за 1 секунду'},
			{key: 'cache_read_input_tokens', price: '10', hint: 'за 1М токенов'},
		]})]));

		expect(catalog[0]).toMatchObject({inputPrice: undefined, outputPrice: undefined});
		expect(mergeModels(catalog, null)).toEqual([]);
	});

	it('отклоняет изменившийся или повреждённый формат вместо пустого успешного кэша', () => {
		expect(() => parseModelCatalog('1:not-json\n')).toThrow('некорректный каталог');
		expect(() => parseModelCatalog(flight([row('provider/image', {category: 'image'})]))).toThrow('некорректный каталог');
	});

	it('соединяет доступные ID с каталогом, убирая дубли и неподходящие модели', () => {
		const catalog = parseModelCatalog(flight([row('a/one'), row('b/two'), row('a/one')]));
		const models = mergeModels(catalog, ['b/two', 'b/two', 'other/image']);

		expect(models.map(model => model.id)).toEqual(['b/two']);
	});

	it('рекомендует свежие модели по возможностям и помечает заметно дорогие', () => {
		const catalog = parseModelCatalog(flight([
			row('a/older', {publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000}),
			row('a/current'),
			row('b/current'),
			row('c/preview'),
			row('d/small', {contextTokens: 8_000}),
			row('e/premium', {breakdown: [
				{key: 'input_tokens', price: 500, hint: 'за 1М токенов'},
				{key: 'output_tokens', price: 1500, hint: 'за 1М токенов'},
			]}),
		]));
		const models = mergeModels(catalog, null);

		expect(models.filter(model => model.tag === 'rec').map(model => model.id)).toEqual(['a/current', 'b/current']);
		expect(models.find(model => model.id === 'e/premium')).toMatchObject({tag: 'pricey', tier: 'ultra'});
		expect(models.find(model => model.id === 'c/preview')?.tag).toBeUndefined();
	});

	it('оставляет Astra на границе 4,424 ₽, исключая более дорогие модели и неизвестные тарифы', () => {
		const prices = (input: number, output: number) => ({breakdown: [
			{key: 'input_tokens', price: input, hint: 'за 1М токенов'},
			{key: 'output_tokens', price: output, hint: 'за 1М токенов'},
		]});
		const catalog = parseModelCatalog(flight([
			row('budget/cheap'),
			row('openai/gpt-6-astra', prices(1580, 7900)),
			row('future/over-limit', prices(1580, 7901)),
			row('openai/o1-pro', prices(16106, 80527)),
			row('openai/gpt-5.5-pro', prices(4740, 28400)),
			row('future/unknown-price', {breakdown: []}),
		]));

		expect(mergeModels(catalog, null).map(model => model.id)).toEqual(['budget/cheap', 'openai/gpt-6-astra']);
	});

	it('сравнивает стоимость вопроса, а не сумму тарифов за миллион токенов', () => {
		const catalog = parseModelCatalog(flight([
			...['one', 'two', 'three'].map(name => row(`budget/${name}`, {capabilities: ['structured'], breakdown: [
				{key: 'input_tokens', price: 1, hint: 'за 1М токенов'},
				{key: 'output_tokens', price: 1000, hint: 'за 1М токенов'},
			]})),
			row('premium/input-heavy', {capabilities: ['structured'], breakdown: [
				{key: 'input_tokens', price: 1000, hint: 'за 1М токенов'},
				{key: 'output_tokens', price: 1, hint: 'за 1М токенов'},
			]}),
		]));
		const models = mergeModels(catalog, null);

		expect(models[models.length - 1]).toMatchObject({id: 'premium/input-heavy', tag: 'pricey', tier: 'ultra'});
		expect(models.filter(model => model.tag === 'pricey')).toHaveLength(1);
	});
});

describe('запросы и кэш моделей ProxyAPI', () => {
	it('старый кэш также скрывает генераторы и пересчитывает цену с учётом рассуждений', async () => {
		const model = parseModelCatalog(flight([row('provider/model')]))[0];
		storageSet(AI_MODELS_CACHE_KEY, {version: 1, keyHash: '', availableIds: null, catalog: [
			{...model, reasoning: undefined},
			{...model, id: 'provider/chat-image', name: 'Chat Image'},
		]});

		const cached = await getCachedModels('');
		expect(cached).toHaveLength(1);
		expect(cached[0]).toMatchObject({id: 'provider/model', reasoning: true});
	});

	it('делает оба запроса, не передаёт секрет каталогу и сохраняет кэш по отпечатку ключа', async () => {
		serve([row('provider/model')]);
		const fresh = await fetchModels('private-api-key');

		expect(fetchViaBackground).toHaveBeenCalledWith(AI_MODELS_URL, expect.objectContaining({headers: {Authorization: 'Bearer private-api-key'}}));
		expect(fetchViaBackground).toHaveBeenCalledWith(AI_MODELS_CATALOG_URL, expect.objectContaining({headers: {RSC: '1'}}));
		expect(await getCachedModels('private-api-key')).toEqual(fresh.models);
		expect(await getCachedModels('different-key')).toEqual([]);
		expect(JSON.stringify(await storageGet(AI_MODELS_CACHE_KEY, null))).not.toContain('private-api-key');
		expect(fetchViaBackground).toHaveBeenCalledTimes(2);
	});

	it('без ключа загружает только публичный каталог', async () => {
		serve([row('provider/model')]);
		const result = await fetchModels('');

		expect(result.models[0].id).toBe('provider/model');
		expect(fetchViaBackground).toHaveBeenCalledTimes(1);
		expect(await getCachedModels('')).toEqual(result.models);
	});

	it('объединяет одновременные запросы, но следующий переход снова обновляет данные', async () => {
		serve([row('provider/model')]);
		await Promise.all([fetchModels('key'), fetchModels('key')]);
		expect(fetchViaBackground).toHaveBeenCalledTimes(2);

		await fetchModels('key');
		expect(fetchViaBackground).toHaveBeenCalledTimes(4);
	});

	it('при сбое каталога соединяет свежие ID с последними тарифами и предупреждает', async () => {
		serve([row('provider/old'), row('provider/model')], ['provider/old']);
		await fetchModels('key');
		vi.mocked(fetchViaBackground).mockImplementation(async url =>
			url === AI_MODELS_CATALOG_URL ? response('Gateway timeout', 503) : response(JSON.stringify({data: [{id: 'provider/model'}]})),
		);

		const result = await fetchModels('key');
		expect(result.models.map(model => model.id)).toEqual(['provider/model']);
		expect(result.models[0].inputPrice).toBe(100);
		expect(result.warning).toContain('сохранённые тарифы');
	});

	it('при ошибке авторизации не заменяет хороший кэш публичным каталогом', async () => {
		serve([row('provider/model')]);
		const fresh = await fetchModels('key');
		vi.mocked(fetchViaBackground).mockImplementation(async url =>
			url === AI_MODELS_CATALOG_URL ? response(flight([row('provider/new')])) : response('Unauthorized', 401),
		);

		await expect(fetchModels('key')).rejects.toThrow('не принял API-ключ');
		expect(await getCachedModels('key')).toEqual(fresh.models);
	});

	it('поздний ответ со старым ключом не перезаписывает кэш нового ключа', async () => {
		let finishOld!: (value: IRequestResponse) => void;
		const oldResponse = new Promise<IRequestResponse>(resolve => { finishOld = resolve; });
		vi.mocked(fetchViaBackground).mockImplementation(async (url, options) => {
			if (url === AI_MODELS_CATALOG_URL) return response(flight([row('provider/old'), row('provider/new')]));
			if (options?.headers?.Authorization === 'Bearer old-key') return oldResponse;
			return response(JSON.stringify({data: [{id: 'provider/new'}]}));
		});
		const oldRequest = fetchModels('old-key');
		await vi.waitFor(() => expect(fetchViaBackground).toHaveBeenCalledWith(AI_MODELS_URL, expect.objectContaining({headers: {Authorization: 'Bearer old-key'}})));
		const fresh = await fetchModels('new-key');
		finishOld(response(JSON.stringify({data: [{id: 'provider/old'}]})));
		await oldRequest;

		expect(await getCachedModels('new-key')).toEqual(fresh.models);
		expect(await getCachedModels('old-key')).toEqual([]);
	});

	it('при первой загрузке сообщает о сбое вместо использования фиксированных моделей', async () => {
		vi.mocked(fetchViaBackground).mockResolvedValue(response('Unavailable', 503));
		await expect(fetchModels('')).rejects.toThrow('каталог с ценами');
		expect(await getCachedModels('')).toEqual([]);
	});
});
