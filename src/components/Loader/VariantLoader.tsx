import { useEffect } from 'react';
import { fetchViaBackground, parseHtml } from '../../utils';
import {ISourceKey} from '../../types';

export interface IVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

interface ISearchResult {
	readonly source: ISourceKey;
	readonly title: string;
	readonly url: string;
}

const INIT_STATE: IVariantModel = { loading: false, error: null, data: [] };

const FORCARE_URL = 'https://24forcare.com';
const ROSMED_URL = 'https://rosmedicinfo.ru';
const ALTERNATIVE_BASE_URL = 'https://testotvet.com';

interface IVariantLoaderProps {
	readonly text: string | null;
	readonly onChange: (state: IVariantModel) => void;
}

const VariantLoader = ({ text, onChange }: IVariantLoaderProps) => {

	useEffect(() => {
		const query = (text ?? '').trim();
		if (!query) return onChange({...INIT_STATE});

		onChange({ loading: true, error: null, data: [] });

		let cancelled = false;

		async function search() {
			const encoded = encodeURIComponent(query);
			const forcareSearchUrl = new URL('/search/', FORCARE_URL);
			forcareSearchUrl.searchParams.set('query', query);

			const [fcRes, rosRes, alternativeRes] = await Promise.all([
				fetchViaBackground(forcareSearchUrl.toString()).catch(() => null),
				fetchViaBackground(ROSMED_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: 'do=search&subaction=search&story=' + encoded,
				}).catch(() => null),
				fetchViaBackground(ALTERNATIVE_BASE_URL + '/api/search/suggestions/categories?query=' + encoded).catch(() => null),
			]);

			if (cancelled) return;

			const results: ISearchResult[] = [];

			// 24forcare всё оки
			if (fcRes && !fcRes.error && fcRes.text) results.push(...parseForcareUrls(fcRes.text));

			// rosmed всё оки доки
			if (rosRes && !rosRes.error && rosRes.text) results.push(...parseRosmedUrls(rosRes.text));

			if (alternativeRes && !alternativeRes.error && alternativeRes.text) {
				results.push(...parseForAlternativeUrl(alternativeRes.text));
			}

			// не судьба
			if (results.length === 0) return onChange({loading: false, error: 'ничего не найдено', data: []});

			onChange({ loading: false, error: null, data: results });
		}

		search();

		return () => { cancelled = true; };
	}, [text]);

	return null;
};

export default VariantLoader;


/**
 * Извлекает варианты страниц с ответами из HTML-результата поиска 24forcare.
 *
 * @param html HTML-разметка страницы с результатами поиска.
 * @returns Найденные варианты с источником, заголовком и абсолютным URL.
 */
function parseForcareUrls(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('a.item-name'));
	links.forEach(a => {
		const href = a.getAttribute('href') || '';
		const title = (a.textContent || '').trim();
		if (!href || !title) return;
		const url = href.startsWith('http') ? href : 'https://24forcare.com/' + href.replace(/^\//, '');
		results.push({ source: '24forcare', title, url });
	});
	return results;
}

/**
 * Извлекает варианты страниц с ответами из HTML-результата поиска rosmedicinfo.
 *
 * @param html HTML-разметка страницы с результатами поиска.
 * @returns Найденные варианты с источником, заголовком и URL.
 */
function parseRosmedUrls(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('.short__title a'));
	links.forEach(a => {
		const href = a.getAttribute('href') || '';
		const title = (a.textContent || '').trim();
		if (!href || !title) return;
		results.push({ source: 'rosmedicinfo', title, url: href });
	});
	return results;
}

/**
 * Извлекает варианты страниц с ответами из JSON-результата поиска alternative.
 *
 * @param response JSON-ответ, содержащий массив `categories`.
 * @returns Найденные варианты с источником, заголовком и абсолютным URL.
 */
function parseForAlternativeUrl(response: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	let data: {readonly categories?: unknown};

	try {
		data = JSON.parse(response) as {readonly categories?: unknown};
	} catch {
		return results;
	}

	if (!Array.isArray(data.categories)) return results;

	data.categories.forEach((category: unknown) => {
		if (!category || typeof category !== 'object') return;

		const {name, slug} = category as Record<string, unknown>;
		const title = typeof name === 'string' ? name.trim() : '';
		const normalizedSlug = typeof slug === 'string' ? slug.trim() : '';
		if (!title || !normalizedSlug) return;

		results.push({
			source: 'nmo-helper',
			title,
			url: ALTERNATIVE_BASE_URL + '/test-medik/nmo/' + encodeURIComponent(normalizedSlug) + '.html',
		});
	});

	return results;
}
