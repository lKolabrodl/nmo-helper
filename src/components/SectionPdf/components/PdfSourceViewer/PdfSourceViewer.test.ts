import {createElement} from 'react';
import {fireEvent, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AnswerSources, PredictionSources, SourceExcerpt, SourcePage} from 'med-pdf-nmo/browser';
import HighlightedText, {type IPdfSourceTextLine} from './HighlightedText';
import PdfSourceDialog from './PdfSourceDialog';
import {ensurePdfSourceHost, PDF_SOURCE_HOST_ID, removePdfSourceHost} from './dom';
import {
	getPageSourceMarks,
	getRelevantSourcePages,
	splitPdfSourceText,
} from './source-text';

beforeEach(() => {
	document.body.innerHTML = '';
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
		const lines = new HighlightedText(text, [{
			start: highlightStart,
			end: highlightStart + highlightedText.length,
			role: 'answer',
		}]).init();

		expect(lines.map(getHighlightedLineText)).toEqual([
			'Первое предложение.',
			'Второе выделено!',
			'Третье предложение?',
		]);
		expect(lines[1].segments.some(
			segment => segment.text === highlightedText && segment.role === 'answer',
		)).toBe(true);
	});

	it('не разрывает распространённые сокращения и инициалы', () => {
		const lines = new HighlightedText(
			'Пациент осмотрен проф. А. Б. Ивановым. Назначено лечение.',
			[],
		).init();

		expect(lines.map(getHighlightedLineText)).toEqual([
			'Пациент осмотрен проф. А. Б. Ивановым.',
			'Назначено лечение.',
		]);
	});

	it('переносит каждый пункт нумерованного списка на новую строку', () => {
		const text = '1) пищеводная грыжа пищеводного отверстия диафрагмы; '
			+ '2) кардиальная грыжа пищеводного отверстия диафрагмы; '
			+ '3) кардиально-фундальная грыжа пищеводного отверстия диафрагмы.';

		const lines = new HighlightedText(text, []).init();

		expect(lines.map(getHighlightedLineText)).toEqual([
			'1) пищеводная грыжа пищеводного отверстия диафрагмы;',
			'2) кардиальная грыжа пищеводного отверстия диафрагмы;',
			'3) кардиально-фундальная грыжа пищеводного отверстия диафрагмы.',
		]);
	});

	it('переносит каждый пункт списка с маркером • на новую строку', () => {
		const text = 'На исход заболевания или состояния могут оказывать влияние: '
			+ '• поливалентная аллергия; '
			+ '• наличие в анамнезе лейкоза, онкологических заболеваний, туберкулеза '
			+ 'или положительной реакции на ВИЧ-инфекцию, гепатит В и С, сифилис; '
			+ '• выраженные врожденные дефекты, под';

		const lines = new HighlightedText(text, []).init();

		expect(lines.map(getHighlightedLineText)).toEqual([
			'На исход заболевания или состояния могут оказывать влияние:',
			'• поливалентная аллергия;',
			'• наличие в анамнезе лейкоза, онкологических заболеваний, туберкулеза '
				+ 'или положительной реакции на ВИЧ-инфекцию, гепатит В и С, сифилис;',
			'• выраженные врожденные дефекты, под',
		]);
	});

	it('помечает отдельное слово, римский номер и число как заголовки', () => {
		const text = 'Грыжа пищеводного отверстия диафрагмы. IV. Короткий пищевод.\n'
			+ 'Раздел.\n2024.\nПродолжение текста';
		const lines = new HighlightedText(text, []).init();
		const headings = lines.filter(line => line.isHeading).map(getHighlightedLineText);

		expect(headings).toEqual(['IV.', 'Раздел.', '2024.']);
	});

	it('не считает заголовком отдельное слово без точки', () => {
		const text = 'Классификация заболевания или состояния (группы заболеваний и\nсостояний)';
		const lines = new HighlightedText(text, []).init();

		expect(lines.some(line => line.isHeading)).toBe(false);
	});

	it('удаляет числовые ссылки в конце предложения и одиночную точку', () => {
		const text = 'У пациентов после пластики пищеводного отверстия диафрагмы '
			+ 'рекомендуется выполнить фундопликацию [5, 30, 32, 37, 39, 40, 43, 49, 58, 62, 73, 76, 84].\n.';
		const lines = new HighlightedText(text, []).init();

		expect(lines.map(getHighlightedLineText)).toEqual([
			'У пациентов после пластики пищеводного отверстия диафрагмы рекомендуется выполнить фундопликацию.',
		]);
	});

	it('помечает все последовательности цифр для курсивного отображения', () => {
		const lines = new HighlightedText('В 2024 году выделено 3 типа и 12 подтипов.', []).init();
		const numbers = lines.flatMap(line => line.segments)
			.filter(segment => segment.isNumber)
			.map(segment => segment.text);

		expect(numbers).toEqual(['2024', '3', '12']);
	});
});

describe('PDF source dialog', () => {
	it('рисует PDF-содержимое для общего модального окна', () => {
		const onClose = vi.fn();
		const {container} = render(createElement(PdfSourceDialog, {
			sources: makeSources({pages: [{page: 1, text: 'Вводный текст. IV. Страница 1 в 2024 году.'}]}),
			onClose,
		}));

		const header = container.querySelector<HTMLElement>('.nmo-pdf-source-header');
		const closeButton = container.querySelector<HTMLButtonElement>('.nmo-pdf-source-close');
		expect(header).toHaveAttribute('data-nmo-modal-window-drag-handle');
		expect(container.querySelector('.nmo-pdf-source-page-text')).toHaveTextContent('Страница 1');
		expect(container.querySelector('.nmo-pdf-source-sentence--heading')).toHaveTextContent('IV.');
		expect([...container.querySelectorAll('.nmo-pdf-source-number')].map(item => item.textContent)).toEqual(['1', '2024']);

		fireEvent.click(closeButton!);
		expect(onClose).toHaveBeenCalledOnce();
	});
});

function getHighlightedLineText(line: IPdfSourceTextLine): string {
	return line.segments.map(segment => segment.text).join('').trim();
}

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
