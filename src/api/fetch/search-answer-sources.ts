/**
 * Поиск вариантов в базах ответов.
 *
 * Каждый источник принимает строку запроса и возвращает общую модель результата,
 * чтобы вызывающий код не зависел от формата конкретного сайта.
 *
 * @module api/fetch/search-answer-sources
 */

import type {ISearchResult} from '../../types';
import {ALTERNATIVE_ANSWER_SOURCE_HOST,	NMO_API_HOST,	PRIMARY_ANSWER_SOURCE_HOST,	SECONDARY_ANSWER_SOURCE_HOST} from '../../utils/constants';
import {parseNmoApiSearchResults, parsePrimarySourceResults, parseSecondarySourceResults, parseThirdSourceResults} from '../../utils/html';
import {fetchViaBackground} from './fetch';

const FIRST_SOURCE_URL = `https://${PRIMARY_ANSWER_SOURCE_HOST}`;
const SECONDARY_SOURCE_URL = `https://${SECONDARY_ANSWER_SOURCE_HOST}`;
const THIRD_SOURCE_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}`;
const NMO_API_SEARCH_URL = `https://${NMO_API_HOST}/api/nmo/topics`;

/** Ищет варианты в серверной базе NMO Helper. */
export async function searchNmoSource(query: string): Promise<ISearchResult[]> {
	const normalizedQuery = query.trim();
	if (normalizedQuery.length < 3) return [];

	const url = new URL(NMO_API_SEARCH_URL);
	url.searchParams.set('q', normalizedQuery);

	const response = await fetchViaBackground(url.toString(), {
		headers: {'Accept': 'application/json'},
		credentials: 'omit',
	});

	if (response.error || !response.text) return [];

	return parseNmoApiSearchResults(response.text);
}

/** Ищет варианты в первой базе ответов. */
export async function searchFirstSource(query: string): Promise<ISearchResult[]> {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) return [];

	const response = await fetchViaBackground(FIRST_SOURCE_URL, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: 'do=search&subaction=search&story=' + encodeURIComponent(normalizedQuery),
	});

	if (response.error || !response.text) return [];

	return parsePrimarySourceResults(response.text);
}

/** Ищет варианты во второй базе ответов. */
export async function searchSecondarySource(query: string): Promise<ISearchResult[]> {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) return [];

	const url = new URL('/search/', SECONDARY_SOURCE_URL);
	url.searchParams.set('query', normalizedQuery);

	const response = await fetchViaBackground(url.toString());

	if (response.error || !response.text) return [];

	return parseSecondarySourceResults(response.text);
}

/** Ищет варианты в третьей базе ответов. */
export async function searchThirdSource(query: string): Promise<ISearchResult[]> {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) return [];

	const url = THIRD_SOURCE_URL+ '/api/search/suggestions/categories?query='+ encodeURIComponent(normalizedQuery);
	const response = await fetchViaBackground(url);

	if (response.error || !response.text) return [];

	return parseThirdSourceResults(response.text);
}
