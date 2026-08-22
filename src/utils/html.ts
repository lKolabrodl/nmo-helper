import type {ISearchResult} from '../types';
import {NMO_API_TOPIC_ENDPOINT, SECOND_ANSWER_SOURCE_HOST, THIRD_ANSWER_SOURCE_HOST} from './constants';

const SECONDARY_SOURCE_URL = `https://${SECOND_ANSWER_SOURCE_HOST}`;
const THIRD_SOURCE_URL = `https://${THIRD_ANSWER_SOURCE_HOST}`;

interface INmoApiSearchItem {
	readonly title: string;
	readonly uid: string;
}

interface INmoApiSearchResponse {
	readonly items?: INmoApiSearchItem[];
}

/** Удаляет опасные теги и event-handler атрибуты из DOM. */
function sanitizeDocument(doc: Document): void {
	doc.querySelectorAll('script,iframe,object,embed,form,svg,math,link,meta,base,template,style')
		.forEach(el => el.remove());
	doc.querySelectorAll('*').forEach(el => {
		for (const attr of [...el.attributes]) {
			if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
				el.removeAttribute(attr.name);
			}
		}
	});
}

/**
 * Очищает HTML-строку от навигации, скриптов, меню и прочих лишних элементов.
 */
function cleanHtml(html: string): string {
	const normalized = html.replace(/\s+/g, ' ');
	const rowStart = normalized.indexOf('<div class="row">');
	const content = rowStart >= 0 ? normalized.slice(rowStart) : normalized;

	return content
		.replace(/<footer.*?>.*/, '')
		.replace(/<script[^>]*>.*?<\/script>/gs, '')
		.replace(/<a[^>]*>(.*?)<\/a>/gs, '$1')
		.replace(/<div class="menu"[^>]*>.*?<\/div>/gs, '')
		.replace(/<div class="search-form"[^>]*>.*?<\/div>/gs, '')
		.replace(/<div class="info-donat-bg"[^>]*>.*?<\/div>/gs, '')
		.replace(/<div class="sticky"[^>]*>.*?<\/div>/gs, '')
		.replace(/<nav[^>]*>.*?<\/nav>/gs, '')
		.replace(/<ul[^>]*>.*?<\/ul>/gs, '');
}

/**
 * Парсит HTML-строку в DOM-элемент с санитизацией.
 * @param html — сырой HTML
 * @param full — true: дополнительно прогнать через cleanHtml (удалить nav/footer/menu и т.п.)
 */
export function parseHtml(html: string, full = false): HTMLElement {
	const doc = new DOMParser().parseFromString(full ? cleanHtml(html) : html, 'text/html');
	sanitizeDocument(doc);
	return doc.body;
}

/**
 * Преобразует HTML поисковой выдачи дополнительного источника в общую модель.
 *
 * Перед разбором HTML проходит через {@link parseHtml}, поэтому опасные теги,
 * обработчики событий и `javascript:`-ссылки удаляются. Функция читает только
 * элементы `a.item-name`, сохраняет их исходный порядок и отбрасывает ссылки
 * без `href` либо без непустого текста. Относительные пути дополняются origin
 * дополнительного источника, а абсолютные URL возвращаются без изменений.
 *
 * @param html Сырая HTML-строка страницы поисковой выдачи.
 * @returns Валидные результаты с ключом источника `second`; пустой массив,
 * если подходящих ссылок в разметке нет.
 */
export function parseSecondarySourceResults(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('a.item-name'));

	links.forEach(link => {
		const href = link.getAttribute('href') || '';
		const title = (link.textContent || '').trim();
		if (!href || !title) return;

		const url = href.startsWith('http')
			? href
			: `${SECONDARY_SOURCE_URL}/${href.replace(/^\//, '')}`;
		results.push({source: 'second', title, url});
	});

	return results;
}

/**
 * Преобразует HTML поисковой выдачи основного источника в общую модель.
 *
 * HTML санитизируется функцией {@link parseHtml}. Из выдачи выбираются только
 * ссылки `.short__title a`; заголовок берётся из `textContent` и очищается от
 * пробелов по краям. Элементы без `href` или заголовка пропускаются. Адрес из
 * `href` сохраняется как есть, поскольку основной источник сам возвращает
 * готовые URL результатов.
 *
 * @param html Сырая HTML-строка страницы поисковой выдачи.
 * @returns Валидные результаты с ключом источника `first` в порядке выдачи;
 * пустой массив, если подходящих ссылок нет.
 */
export function parsePrimarySourceResults(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('.short__title a'));

	links.forEach(link => {
		const href = link.getAttribute('href') || '';
		const title = (link.textContent || '').trim();
		if (!href || !title) return;

		results.push({source: 'first', title, url: href});
	});

	return results;
}

/**
 * Преобразует JSON поисковых подсказок третьего источника в общую модель.
 *
 * Ожидается объект с массивом `categories`. У каждого результата должны быть
 * непустые строковые поля `name` и `slug`; остальные элементы пропускаются.
 * `name` становится заголовком, а нормализованный `slug` кодируется как один
 * сегмент URL и подставляется в адрес страницы теста. Повреждённый JSON,
 * отсутствие массива `categories` и полностью невалидная выдача безопасно
 * превращаются в пустой массив.
 *
 * @param text Сырое JSON-тело ответа третьего источника.
 * @returns Валидные результаты в порядке массива `categories` с ключом
 * источника `third`.
 */
export function parseThirdSourceResults(text: string): ISearchResult[] {
	let payload: unknown;

	try {
		payload = JSON.parse(text) as unknown;
	} catch {
		return [];
	}

	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];

	const categories = (payload as Record<string, unknown>).categories;
	if (!Array.isArray(categories)) return [];

	return categories.flatMap((category: unknown) => {
		if (!category || typeof category !== 'object') return [];

		const {name, slug} = category as Record<string, unknown>;
		const title = typeof name === 'string' ? name.trim() : '';
		const normalizedSlug = typeof slug === 'string' ? slug.trim() : '';
		if (!title || !normalizedSlug) return [];

		return [{
			source: 'third' as const,
			title,
			url: THIRD_SOURCE_URL
				+ '/test-medik/nmo/'
				+ encodeURIComponent(normalizedSlug)
				+ '.html',
		}];
	});
}

/**
 * Преобразует JSON поисковой выдачи NMO API в общую модель результатов.
 *
 * Ожидается объект с массивом `items`. Повреждённый JSON или отсутствие массива
 * безопасно превращаются в пустой результат. Поля элементов не проверяются
 * повторно и считаются соответствующими серверному контракту NMO API; заголовок
 * и короткоживущий UID очищаются от пробелов по краям.
 *
 * @param text Сырое JSON-тело ответа поиска NMO API.
 * @returns Результаты NMO API с UID в последнем сегменте URL.
 */
export function parseNmoApiSearchResults(text: string): ISearchResult[] {
	let payload: INmoApiSearchResponse | null;

	try {
		payload = JSON.parse(text) as INmoApiSearchResponse;
	} catch {
		return [];
	}

	if (!Array.isArray(payload?.items)) return [];

	return payload.items.map(item => ({
		source: 'nmo-helper',
		title: item.title.trim(),
		url: `${NMO_API_TOPIC_ENDPOINT}/${encodeURIComponent(item.uid.trim())}`,
	}));
}
