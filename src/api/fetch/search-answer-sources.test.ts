import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
	ALTERNATIVE_ANSWER_SOURCE_HOST,
	NMO_API_HOST,
	PRIMARY_ANSWER_SOURCE_HOST,
	SECONDARY_ANSWER_SOURCE_HOST,
} from '../../utils/constants';
import {fetchViaBackground} from './fetch';
import {NMO_API_TOPIC_ENDPOINT} from './fetch-nmo-api';
import {
	searchFirstSource,
	searchNmoSource,
	searchSecondarySource,
	searchThirdSource,
} from './search-answer-sources';

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(),
	fetchViaBackground: vi.fn(),
}));

const mockFetch = vi.mocked(fetchViaBackground);

beforeEach(() => {
	mockFetch.mockReset();
});

describe('searchSecondarySource', () => {
	it('сериализует query и возвращает абсолютные ссылки', async () => {
		mockFetch.mockResolvedValue(ok(`
			<a class="item-name" href="/answer/42"> Диагностика заболевания </a>
			<a class="item-name" href="/without-title"></a>
		`));

		await expect(searchSecondarySource('  Тема (тест) - 2026  ')).resolves.toEqual([{
			source: 'secondary',
			title: 'Диагностика заболевания',
			url: `https://${SECONDARY_ANSWER_SOURCE_HOST}/answer/42`,
		}]);

		const expectedUrl = new URL('/search/', `https://${SECONDARY_ANSWER_SOURCE_HOST}`);
		expectedUrl.searchParams.set('query', 'Тема (тест) - 2026');
		expect(mockFetch).toHaveBeenCalledWith(expectedUrl.toString());
	});
});

describe('searchFirstSource', () => {
	it('отправляет query в формате поисковой формы и разбирает HTML', async () => {
		const resultUrl = `https://${PRIMARY_ANSWER_SOURCE_HOST}/topic/42`;
		mockFetch.mockResolvedValue(ok(`
			<div class="short__title"><a href="${resultUrl}"> Основная тема </a></div>
		`));

		await expect(searchFirstSource('  Инфаркт миокарда  ')).resolves.toEqual([{
			source: 'primary',
			title: 'Основная тема',
			url: resultUrl,
		}]);

		expect(mockFetch).toHaveBeenCalledWith(`https://${PRIMARY_ANSWER_SOURCE_HOST}`, {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: 'do=search&subaction=search&story=' + encodeURIComponent('Инфаркт миокарда'),
		});
	});
});

describe('searchThirdSource', () => {
	it('формирует варианты из categories и пропускает неполные элементы', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			categories: [
				{name: 'Особенности реабилитации', slug: 'topic/42'},
				{name: '', slug: 'without-title'},
				{name: 'Без ссылки', slug: null},
			],
		})));

		await expect(searchThirdSource('  КОВИД  ')).resolves.toEqual([{
			source: 'foo',
			title: 'Особенности реабилитации',
			url: `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}/test-medik/nmo/topic%2F42.html`,
		}]);

		expect(mockFetch).toHaveBeenCalledWith(
			`https://${ALTERNATIVE_ANSWER_SOURCE_HOST}/api/search/suggestions/categories?query=${encodeURIComponent('КОВИД')}`,
		);
	});

	it('возвращает пустой массив при невалидном JSON', async () => {
		mockFetch.mockResolvedValue(ok('not json'));

		await expect(searchThirdSource('Тема')).resolves.toEqual([]);
	});
});

describe('searchNmoApi', () => {
	it('возвращает результаты с короткоживущими UID', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			items: [{
				title: ' Диагностика заболевания ',
				uid: ' short-lived.uid ',
			}],
		})));

		await expect(searchNmoSource('  диагностика  ')).resolves.toEqual([{
			source: 'nmo-helper',
			title: 'Диагностика заболевания',
			url: `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`,
		}]);

		const expectedUrl = new URL(`https://${NMO_API_HOST}/api/nmo/topics`);
		expectedUrl.searchParams.set('q', 'диагностика');
		expect(mockFetch).toHaveBeenCalledWith(expectedUrl.toString(), {
			headers: {'Accept': 'application/json'},
			credentials: 'omit',
		});
	});

	it('не отправляет запрос короче трёх символов', async () => {
		await expect(searchNmoSource(' Я ')).resolves.toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it.each([
		'not json',
		'{}',
		'{"items":{}}',
	])('возвращает пустой массив для неожиданного ответа: %s', async text => {
		mockFetch.mockResolvedValue(ok(text));

		await expect(searchNmoSource('Тема')).resolves.toEqual([]);
	});
});

function ok(text: string) {
	return {error: false, status: 200, text};
}
