import {createElement} from 'react';
import {fireEvent, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AnswerSources, PredictionSources, SourceExcerpt, SourcePage} from 'med-pdf-nmo/browser';
import PdfSourceDialog from './PdfSourceDialog';
import {
	constrainPdfSourceDialogLayout,
	loadPdfSourceDialogLayout,
	PDF_SOURCE_DIALOG_STORAGE_KEY,
	savePdfSourceDialogLayout,
} from './dialog-layout';
import {ensurePdfSourceHost, PDF_SOURCE_HOST_ID, removePdfSourceHost} from './dom';
import {
	getPageSourceMarks,
	getRelevantSourcePages,
	splitPdfSourceText,
	splitPdfSourceTextIntoLines,
} from './source-text';

beforeEach(() => {
	document.body.innerHTML = '';
	window.localStorage.removeItem(PDF_SOURCE_DIALOG_STORAGE_KEY);
});

describe('PdfSourceViewer DOM host', () => {
	it('вставляет кнопку непосредственно рядом со счётчиком вопроса', () => {
		document.body.innerHTML = `
			<div class="question-info">
				<div class="question-info-questionCounter">Вопрос 7 из 30</div>
				<div class="question-info-countDownTimer">0:38:45</div>
			</div>
		`;

		const host = ensurePdfSourceHost();
		const questionCounter = document.querySelector('.question-info-questionCounter');

		expect(host).not.toBeNull();
		expect(questionCounter?.lastElementChild).toBe(host);
		expect(questionCounter?.textContent).toBe('Вопрос 7 из 30');
		expect(ensurePdfSourceHost()).toBe(host);

		removePdfSourceHost();
		expect(document.getElementById(PDF_SOURCE_HOST_ID)).toBeNull();
	});

	it('ничего не вставляет без контейнера вопроса', () => {
		document.body.innerHTML = '<div>Нет вопроса</div>';
		expect(ensurePdfSourceHost()).toBeNull();
	});
});

describe('PDF source text mapping', () => {
	it('открывает сначала страницы выбранного ответа, затем страницу вопроса', () => {
		const sources = makeSources({
			question: makeExcerpt({page: 2}),
			answers: [
				makeAnswerSource('A', false, [makeExcerpt({page: 7})]),
				makeAnswerSource('B', true, [makeExcerpt({page: 5})]),
			],
			pages: [makePage(2), makePage(5), makePage(7)],
		});

		expect(getRelevantSourcePages(sources).map(page => page.page)).toEqual([5, 2]);
	});

	it('переносит question/answer highlights на полный текст страницы через пробелы и переносы строк', () => {
		const page: SourcePage = {
			page: 5,
			text: 'Вводная строка\nВопрос   пациента?\nПравильный\nответ расположен здесь.\nКонец',
		};
		const excerptText = 'Вопрос пациента? Правильный ответ расположен здесь.';
		const answerStart = excerptText.indexOf('Правильный ответ');
		const excerpt = makeExcerpt({
			page: 5,
			text: excerptText,
			lineStart: 1,
			lineEnd: 3,
			highlights: [
				{start: 0, end: 'Вопрос пациента?'.length, role: 'question'},
				{start: answerStart, end: answerStart + 'Правильный ответ'.length, role: 'answer'},
			],
		});
		const sources = makeSources({
			answers: [makeAnswerSource('B', true, [excerpt])],
			pages: [page],
		});

		const marks = getPageSourceMarks(sources, page);
		const questionMark = marks.find(mark => mark.role === 'question');
		const answerMark = marks.find(mark => mark.role === 'answer');

		expect(page.text.slice(questionMark?.start, questionMark?.end).replace(/\s+/g, ' ')).toBe('Вопрос пациента?');
		expect(page.text.slice(answerMark?.start, answerMark?.end).replace(/\s+/g, ' ')).toBe('Правильный ответ');
	});

	it('помечает пересечение вопроса и ответа ролью both', () => {
		const segments = splitPdfSourceText('abcdef', [
			{start: 1, end: 4, role: 'question'},
			{start: 3, end: 5, role: 'answer'},
		]);

		expect(segments).toEqual([
			{text: 'a', role: null},
			{text: 'bc', role: 'question'},
			{text: 'd', role: 'both'},
			{text: 'e', role: 'answer'},
			{text: 'f', role: null},
		]);
	});

	it('выводит каждое предложение с новой строки и сохраняет подсветку', () => {
		const text = 'Первое предложение. Второе выделено! Третье предложение?';
		const highlightedText = 'Второе выделено';
		const highlightStart = text.indexOf(highlightedText);
		const lines = splitPdfSourceTextIntoLines(text, [{
			start: highlightStart,
			end: highlightStart + highlightedText.length,
			role: 'answer',
		}]);

		expect(lines.map(line => line.map(segment => segment.text).join('').trim())).toEqual([
			'Первое предложение.',
			'Второе выделено!',
			'Третье предложение?',
		]);
		expect(lines[1].some(segment => segment.text === highlightedText && segment.role === 'answer')).toBe(true);
	});

	it('не разрывает распространённые сокращения и инициалы', () => {
		const lines = splitPdfSourceTextIntoLines(
			'Пациент осмотрен проф. А. Б. Ивановым. Назначено лечение.',
			[],
		);

		expect(lines.map(line => line.map(segment => segment.text).join('').trim())).toEqual([
			'Пациент осмотрен проф. А. Б. Ивановым.',
			'Назначено лечение.',
		]);
	});
});

describe('PDF source dialog', () => {
	it('перетаскивается за шапку и остаётся в пределах экрана', () => {
		savePdfSourceDialogLayout({left: 100, top: 80, width: 600, height: 520});
		const {container} = render(createElement(PdfSourceDialog, {
			sources: makeSources({pages: [makePage(1)]}),
			onClose: vi.fn(),
		}));
		const dialog = container.querySelector<HTMLElement>('.nmo-pdf-source-dialog');
		const header = container.querySelector<HTMLElement>('.nmo-pdf-source-header');
		expect(dialog).not.toBeNull();
		expect(header).not.toBeNull();

		vi.spyOn(dialog!, 'getBoundingClientRect').mockReturnValue({
			x: 100,
			y: 80,
			left: 100,
			top: 80,
			right: 700,
			bottom: 600,
			width: 600,
			height: 520,
			toJSON: () => ({}),
		});

		fireEvent.pointerDown(header!, {button: 0, pointerId: 1, clientX: 200, clientY: 150});
		fireEvent.pointerMove(header!, {pointerId: 1, clientX: 260, clientY: 190});

		expect(dialog).toHaveClass('nmo-pdf-source-dialog--dragging');
		expect(dialog).toHaveStyle({left: '160px', top: '120px'});

		fireEvent.pointerMove(header!, {pointerId: 1, clientX: 2000, clientY: 2000});
		expect(dialog).toHaveStyle({left: '416px', top: '240px'});
		fireEvent.pointerUp(header!, {pointerId: 1});
		expect(dialog).not.toHaveClass('nmo-pdf-source-dialog--dragging');
	});
});

describe('PDF source dialog layout', () => {
	it('ограничивает минимальный размер и максимальный размер viewport', () => {
		expect(constrainPdfSourceDialogLayout(
			{left: -100, top: 900, width: 100, height: 1200},
			{width: 1000, height: 700},
		)).toEqual({
			left: 8,
			top: 8,
			width: 400,
			height: 684,
		});
	});

	it('сохраняет и восстанавливает размер и абсолютную позицию', () => {
		const layout = {left: 120, top: 90, width: 640, height: 480};
		savePdfSourceDialogLayout(layout);
		expect(loadPdfSourceDialogLayout()).toEqual(layout);
	});
});

function makeSources(overrides: Partial<PredictionSources> = {}): PredictionSources {
	return {
		question: null,
		answers: [],
		pages: [],
		...overrides,
	};
}

function makeAnswerSource(id: string, selected: boolean, excerpts: SourceExcerpt[]): AnswerSources {
	return {id, variant: `Ответ ${id}`, selected, excerpts};
}

function makePage(page: number): SourcePage {
	return {page, text: `Страница ${page}`};
}

function makeExcerpt(overrides: Partial<SourceExcerpt> = {}): SourceExcerpt {
	return {
		page: 1,
		text: 'Фрагмент',
		lineStart: 0,
		lineEnd: 0,
		blockKind: 'paragraph',
		stance: 'support',
		highlights: [],
		origin: 'scoring_evidence',
		localizationMatch: 'exact',
		contentMatch: 'exact',
		evidenceKinds: [],
		score: 1,
		truncated: false,
		...overrides,
	};
}
