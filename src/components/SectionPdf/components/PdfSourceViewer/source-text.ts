import type {
	PredictionSources,
	SourceExcerpt,
	SourceHighlight,
	SourcePage,
} from 'med-pdf-nmo/browser';

export type PdfSourceMarkRole = SourceHighlight['role'] | 'both';

export interface IPdfSourceTextMark {
	readonly start: number;
	readonly end: number;
	readonly role: SourceHighlight['role'];
}

export interface IPdfSourceTextSegment {
	readonly text: string;
	readonly role: PdfSourceMarkRole | null;
}

export interface IPdfSourceExcerptView {
	readonly key: string;
	readonly label: string;
	readonly excerpt: SourceExcerpt;
	readonly fallbackRole: SourceHighlight['role'];
}

/**
 * Возвращает только страницы, относящиеся к выбранным ответам и вопросу.
 * Страницы выбранных ответов идут первыми, чтобы диалог сразу открывал
 * наиболее полезный пользователю источник.
 */
export function getRelevantSourcePages(sources: PredictionSources): SourcePage[] {
	const pageByNumber = new Map(sources.pages.map(page => [page.page, page]));
	const result: SourcePage[] = [];
	const seen = new Set<number>();

	const append = (pageNumber: number): void => {
		const page = pageByNumber.get(pageNumber);
		if (!page || seen.has(pageNumber)) return;
		seen.add(pageNumber);
		result.push(page);
	};

	sources.answers
		.filter(answer => answer.selected)
		.forEach(answer => answer.excerpts.forEach(excerpt => append(excerpt.page)));

	if (sources.question) append(sources.question.page);
	if (!result.length) sources.pages.forEach(page => append(page.page));

	return result;
}

/** Возвращает отображаемые фрагменты вопроса и выбранных ответов для страницы. */
export function getSourceExcerptsForPage(sources: PredictionSources, pageNumber: number): IPdfSourceExcerptView[] {
	const result: IPdfSourceExcerptView[] = [];

	if (sources.question?.page === pageNumber) {
		result.push({
			key: `question-${pageNumber}-${sources.question.lineStart}`,
			label: 'Вопрос',
			excerpt: sources.question,
			fallbackRole: 'question',
		});
	}

	sources.answers
		.filter(answer => answer.selected)
		.forEach(answer => {
			answer.excerpts.forEach((excerpt, index) => {
				if (excerpt.page !== pageNumber) return;
				result.push({
					key: `answer-${answer.id}-${pageNumber}-${index}`,
					label: `Ответ: ${answer.variant}`,
					excerpt,
					fallbackRole: 'answer',
				});
			});
		});

	return result;
}

/**
 * Переносит offsets из display-ready excerpts на полный текст страницы.
 * Сначала локализует весь excerpt в указанном диапазоне строк, затем
 * использует отдельный highlighted-текст как безопасный fallback.
 */
export function getPageSourceMarks(sources: PredictionSources, page: SourcePage): IPdfSourceTextMark[] {
	const marks: IPdfSourceTextMark[] = [];
	const excerpts = getSourceExcerptsForPage(sources, page.page);

	excerpts.forEach(({excerpt, fallbackRole}) => {
		const highlights: SourceHighlight[] = excerpt.highlights.length
			? excerpt.highlights
			: [{start: 0, end: excerpt.text.length, role: fallbackRole}];

		highlights.forEach(highlight => {
			const mapped = mapExcerptHighlight(page.text, excerpt, highlight);
			if (mapped) marks.push(mapped);
		});
	});

	const unique = new Map<string, IPdfSourceTextMark>();
	marks.forEach(mark => unique.set(`${mark.start}:${mark.end}:${mark.role}`, mark));
	return [...unique.values()].sort((left, right) => left.start - right.start || left.end - right.end);
}

/** Разбивает текст на обычные и подсвеченные React-friendly сегменты. */
export function splitPdfSourceText(text: string, marks: readonly IPdfSourceTextMark[]): IPdfSourceTextSegment[] {
	const valid = marks
		.map(mark => ({
			...mark,
			start: Math.max(0, Math.min(text.length, mark.start)),
			end: Math.max(0, Math.min(text.length, mark.end)),
		}))
		.filter(mark => mark.end > mark.start);

	if (!valid.length) return text ? [{text, role: null}] : [];

	const boundaries = [...new Set([0, text.length, ...valid.flatMap(mark => [mark.start, mark.end])])]
		.sort((left, right) => left - right);
	const result: IPdfSourceTextSegment[] = [];

	for (let index = 0; index < boundaries.length - 1; index += 1) {
		const start = boundaries[index];
		const end = boundaries[index + 1];
		if (end <= start) continue;

		const activeRoles = new Set(valid
			.filter(mark => mark.start < end && mark.end > start)
			.map(mark => mark.role));
		const role: PdfSourceMarkRole | null = activeRoles.size > 1
			? 'both'
			: activeRoles.values().next().value ?? null;
		const part = text.slice(start, end);
		const previous = result[result.length - 1];

		if (previous?.role === role) {
			result[result.length - 1] = {text: previous.text + part, role};
		} else {
			result.push({text: part, role});
		}
	}

	return result;
}

function mapExcerptHighlight(pageText: string, excerpt: SourceExcerpt, highlight: SourceHighlight): IPdfSourceTextMark | null {
	const highlightStart = Math.max(0, Math.min(excerpt.text.length, highlight.start));
	const highlightEnd = Math.max(0, Math.min(excerpt.text.length, highlight.end));
	if (highlightEnd <= highlightStart) return null;

	const {start: blockStart, end: blockEnd} = getLineBounds(pageText, excerpt.lineStart, excerpt.lineEnd);
	const blockText = pageText.slice(blockStart, blockEnd);
	const normalizedBlock = normalizeWithOffsets(blockText);
	const normalizedExcerpt = normalizeWithOffsets(excerpt.text);
	const excerptIndex = normalizedExcerpt.text
		? normalizedBlock.text.indexOf(normalizedExcerpt.text)
		: -1;

	if (excerptIndex >= 0) {
		const normalizedRange = normalizedIndexesForOriginalRange(normalizedExcerpt, highlightStart, highlightEnd);
		if (normalizedRange) {
			const startIndex = excerptIndex + normalizedRange.start;
			const endIndex = excerptIndex + normalizedRange.end - 1;
			const start = normalizedBlock.starts[startIndex];
			const end = normalizedBlock.ends[endIndex];
			if (typeof start === 'number' && typeof end === 'number') {
				return {start: blockStart + start, end: blockStart + end, role: highlight.role};
			}
		}
	}

	const needle = excerpt.text.slice(highlightStart, highlightEnd);
	const fallback = locateNormalizedText(blockText, needle);
	return fallback
		? {start: blockStart + fallback.start, end: blockStart + fallback.end, role: highlight.role}
		: null;
}

interface INormalizedText {
	readonly text: string;
	readonly starts: number[];
	readonly ends: number[];
}

function normalizeWithOffsets(value: string): INormalizedText {
	let text = '';
	const starts: number[] = [];
	const ends: number[] = [];

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (/\s/u.test(character)) {
			if (!text || text.endsWith(' ')) {
				if (text.endsWith(' ')) ends[ends.length - 1] = index + 1;
				continue;
			}
			text += ' ';
			starts.push(index);
			ends.push(index + 1);
			continue;
		}

		for (const normalizedCharacter of character.toLowerCase()) {
			text += normalizedCharacter;
			starts.push(index);
			ends.push(index + 1);
		}
	}

	if (text.endsWith(' ')) {
		text = text.slice(0, -1);
		starts.pop();
		ends.pop();
	}

	return {text, starts, ends};
}

function normalizedIndexesForOriginalRange(value: INormalizedText, start: number, end: number): {start: number; end: number} | null {
	let normalizedStart = -1;
	let normalizedEnd = -1;

	for (let index = 0; index < value.text.length; index += 1) {
		if (value.ends[index] <= start || value.starts[index] >= end) continue;
		if (normalizedStart < 0) normalizedStart = index;
		normalizedEnd = index + 1;
	}

	return normalizedStart >= 0 && normalizedEnd > normalizedStart
		? {start: normalizedStart, end: normalizedEnd}
		: null;
}

function locateNormalizedText(haystack: string, needle: string): {start: number; end: number} | null {
	const normalizedHaystack = normalizeWithOffsets(haystack);
	const normalizedNeedle = normalizeWithOffsets(needle).text;
	if (!normalizedNeedle) return null;

	const index = normalizedHaystack.text.indexOf(normalizedNeedle);
	if (index < 0) return null;

	const start = normalizedHaystack.starts[index];
	const end = normalizedHaystack.ends[index + normalizedNeedle.length - 1];
	return typeof start === 'number' && typeof end === 'number' ? {start, end} : null;
}

function getLineBounds(text: string, lineStart: number, lineEnd: number): {start: number; end: number} {
	const starts = [0];
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] === '\n' || (text[index] === '\r' && text[index + 1] !== '\n')) {
			starts.push(index + 1);
		}
	}

	const firstLine = Math.max(0, Math.floor(lineStart));
	const lastLine = Math.max(firstLine, Math.floor(lineEnd));
	const start = starts[firstLine];
	if (typeof start !== 'number') return {start: 0, end: text.length};

	return {
		start,
		end: starts[lastLine + 1] ?? text.length,
	};
}
