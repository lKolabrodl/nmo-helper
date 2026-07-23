import { useEffect } from 'react';
import { fetchViaBackground, parseHtml } from '../../utils';
import {ISourceKey} from '../../types';
import {ALTERNATIVE_ANSWER_SOURCE_HOST, PRIMARY_ANSWER_SOURCE_HOST, SECONDARY_ANSWER_SOURCE_HOST} from '../../utils/constants';

export interface IVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

export interface ISearchResult {
	readonly source: ISourceKey;
	readonly title: string;
	readonly url: string;
}

const INIT_STATE: IVariantModel = { loading: false, error: null, data: [] };

const SECONDARY_SOURCE_URL = `https://${SECONDARY_ANSWER_SOURCE_HOST}`;
const PRIMARY_SOURCE_URL = `https://${PRIMARY_ANSWER_SOURCE_HOST}`;
const ALTERNATIVE_BASE_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}`;

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
			const secondarySearchUrl = new URL('/search/', SECONDARY_SOURCE_URL);
			secondarySearchUrl.searchParams.set('query', query);

			const [secondaryRes, primaryRes, alternativeRes] = await Promise.all([
				fetchViaBackground(secondarySearchUrl.toString()).catch(() => null),
				fetchViaBackground(PRIMARY_SOURCE_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: 'do=search&subaction=search&story=' + encoded,
				}).catch(() => null),
				fetchViaBackground(ALTERNATIVE_BASE_URL + '/api/search/suggestions/categories?query=' + encoded).catch(() => null),
			]);

			if (cancelled) return;

			const results: ISearchResult[] = [];

			// Результаты дополнительной базы
			if (secondaryRes && !secondaryRes.error && secondaryRes.text) results.push(...parseSecondarySourceUrls(secondaryRes.text));

			// Результаты основной базы
			if (primaryRes && !primaryRes.error && primaryRes.text) results.push(...parsePrimarySourceUrls(primaryRes.text));

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
 * Извлекает варианты страниц с ответами из HTML-выдачи дополнительной базы.
 *
 * @param html HTML-разметка страницы с результатами поиска.
 * @returns Найденные варианты с источником, заголовком и абсолютным URL.
 */
function parseSecondarySourceUrls(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('a.item-name'));
	links.forEach(a => {
		const href = a.getAttribute('href') || '';
		const title = (a.textContent || '').trim();
		if (!href || !title) return;
		const url = href.startsWith('http') ? href : `${SECONDARY_SOURCE_URL}/${href.replace(/^\//, '')}`;
		results.push({ source: 'secondary', title, url });
	});
	return results;
}

/**
 * Извлекает варианты страниц с ответами из HTML-выдачи основной базы.
 *
 * @param html HTML-разметка страницы с результатами поиска.
 * @returns Найденные варианты с источником, заголовком и URL.
 */
function parsePrimarySourceUrls(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('.short__title a'));
	links.forEach(a => {
		const href = a.getAttribute('href') || '';
		const title = (a.textContent || '').trim();
		if (!href || !title) return;
		results.push({ source: 'primary', title, url: href });
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
