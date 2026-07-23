import {splitPdfSourceText,	type IPdfSourceTextMark, type IPdfSourceTextSegment, type PdfSourceMarkRole} from './source-text';

/** Сегмент строки с дополнительным признаком числового фрагмента. */
export interface IPdfSourceDisplaySegment extends IPdfSourceTextSegment {
	readonly isNumber: boolean;
}

/** Готовая к отрисовке строка PDF-текста. */
export interface IPdfSourceTextLine {
	readonly segments: readonly IPdfSourceDisplaySegment[];
	readonly isHeading: boolean;
}

interface IStandaloneHeadings {
	readonly texts: ReadonlySet<string>;
	readonly breakPositions: readonly number[];
}

/** Знаки конца предложения вместе с закрывающими кавычками/скобками и последующим пробелом. */
const SENTENCE_END_PATTERN = /([.!?…]+["'»”’)\]}]*)(\s+)/gu;

/** Нумерованный пункт вида «1) », перед которым можно добавить перенос строки. */
const NUMBERED_LIST_ITEM_PATTERN = /\d+\)(?=\s)/gu;

/** Маркер маркированного списка, перед которым нужно начать новую строку. */
const BULLET_LIST_ITEM_PATTERN = /•(?=\s)/gu;

/** Физические строки исходного PDF с учётом LF и CRLF. */
const PHYSICAL_LINE_PATTERN = /([^\r\n]*)(\r\n|\r|\n|$)/gu;

/** Одиночное слово или число, которое обязательно заканчивается точкой. */
const STANDALONE_HEADING_PATTERN = /^[\p{L}\p{N}]+(?:[-‐‑–—][\p{L}\p{N}]+)*\.$/u;

/** Числовые ссылки в квадратных скобках, расположенные в конце предложения. */
const TRAILING_REFERENCE_PATTERN = /\s*(?:\[\s*\d+(?:\s*[,;–—-]\s*\d+)*\s*\]\s*)+(?=[.!?…]*\s*$)/u;

/** Отдельная строка, содержащая только служебную пунктуацию. */
const ORPHAN_PUNCTUATION_PATTERN = /^[.,;:!?…]+$/u;

/** Любая последовательность цифр, которую нужно визуально выделить. */
const NUMBER_PATTERN = /\p{N}+/gu;

/** Сокращения, точка после которых не завершает предложение. */
const NON_TERMINAL_ABBREVIATIONS = new Set([
	'г', 'гг', 'д', 'др', 'е', 'им', 'к', 'мин', 'мл', 'н', 'п', 'пп', 'пр',
	'проф', 'ред', 'рис', 'с', 'сек', 'см', 'стр', 'т', 'табл', 'ч',
	'dr', 'e.g', 'fig', 'i.e', 'mr', 'mrs', 'no', 'p', 'pp', 'prof', 'vs',
]);

/**
 * Подготавливает текст PDF-страницы для отрисовки с подсветкой.
 *
 * Класс не зависит от React: он получает исходный текст и marks,
 * а {@link init} возвращает готовые строки с сегментами.
 */
class HighlightedText {

	/**
	 * Создаёт обработчик для одной PDF-страницы.
	 *
	 * @param text Полный исходный текст страницы.
	 * @param marks Диапазоны подсветки в координатах исходного текста.
	 */
	public constructor(
		private readonly text: string,
		private readonly marks: readonly IPdfSourceTextMark[],
	) {}

	/**
	 * Последовательно выполняет все этапы подготовки текста.
	 *
	 * @returns Непустые строки, содержащие обычные, подсвеченные и числовые сегменты.
	 */
	public init(): IPdfSourceTextLine[] {
		const standaloneHeadings = this.getStandaloneHeadings();
		const segments = this.splitText();
		const breakPositions = this.getBreakPositions(standaloneHeadings.breakPositions);
		const lines = this.splitIntoLines(segments, breakPositions);
		const linesWithoutReferences = this.removeTrailingReferences(lines);
		const visibleLines = this.removeEmptyLines(linesWithoutReferences);
		return this.createDisplayLines(visibleLines, standaloneHeadings.texts);
	}

	/**
	 * Разбивает исходный текст по границам marks, сохраняя исходные offsets.
	 *
	 * @returns Последовательность сегментов с ролью подсветки или без неё.
	 */
	private splitText(): IPdfSourceTextSegment[] {
		return splitPdfSourceText(this.text, this.marks);
	}

	/**
	 * Собирает все виды смысловых переносов и удаляет повторяющиеся позиции.
	 *
	 * @param headingBreakPositions Границы отдельных строк-заголовков.
	 * @returns Отсортированные абсолютные позиции переносов.
	 */
	private getBreakPositions(headingBreakPositions: readonly number[]): number[] {
		return [...new Set([
			...this.getSentenceBreakPositions(),
			...this.getNumberedListBreakPositions(),
			...this.getBulletListBreakPositions(),
			...headingBreakPositions,
		])]
			.filter(position => position > 0 && position < this.text.length)
			.sort((left, right) => left - right);
	}

	/**
	 * Находит позиции нумерованных пунктов вида «1)», «2)» и далее.
	 *
	 * Маркер внутри круглых скобок, например «(1)», списком не считается.
	 *
	 * @returns Позиции, перед которыми нужно начать новую строку.
	 */
	private getNumberedListBreakPositions(): number[] {
		const result: number[] = [];

		for (const match of this.text.matchAll(NUMBERED_LIST_ITEM_PATTERN)) {
			if (typeof match.index !== 'number') continue;

			const previousCharacter = this.text[match.index - 1] ?? '';
			if (previousCharacter && /[\p{L}\p{N}(]/u.test(previousCharacter)) continue;
			result.push(match.index);
		}

		return result;
	}

	/**
	 * Находит пункты маркированного списка с символом «•».
	 *
	 * @returns Позиции маркеров, перед которыми нужно начать новую строку.
	 */
	private getBulletListBreakPositions(): number[] {
		const result: number[] = [];

		for (const match of this.text.matchAll(BULLET_LIST_ITEM_PATTERN)) {
			if (typeof match.index === 'number') result.push(match.index);
		}

		return result;
	}

	/**
	 * Ищет физические строки, состоящие из одного слова или числа.
	 *
	 * Для каждой такой строки сохраняются её текст и границы. Границы нужны,
	 * чтобы заголовок не склеился с соседними предложениями.
	 *
	 * @returns Тексты заголовков и позиции переносов вокруг них.
	 */
	private getStandaloneHeadings(): IStandaloneHeadings {
		const texts = new Set<string>();
		const breakPositions: number[] = [];

		for (const match of this.text.matchAll(PHYSICAL_LINE_PATTERN)) {
			if (!match[0] || typeof match.index !== 'number') continue;

			const physicalLine = match[1];
			const heading = physicalLine.trim();
			if (!this.isStandaloneHeading(heading)) continue;

			texts.add(heading);
			const leadingWhitespaceLength = physicalLine.length - physicalLine.trimStart().length;
			const contentStart = match.index + leadingWhitespaceLength;
			const nextLineStart = match.index + match[0].length;

			breakPositions.push(contentStart, nextLineStart);
		}

		return {texts, breakPositions};
	}

	/**
	 * Проверяет, может ли отдельная физическая строка быть коротким заголовком.
	 *
	 * @param value Текст строки без внешних пробелов.
	 * @returns `true` для одного слова/числа с точкой, например «II.» или «2.».
	 */
	private isStandaloneHeading(value: string): boolean {
		return Boolean(value) && STANDALONE_HEADING_PATTERN.test(value);
	}

	/**
	 * Находит абсолютные позиции, после которых должна начинаться новая строка.
	 *
	 * @returns Позиции в координатах полного исходного текста.
	 */
	private getSentenceBreakPositions(): number[] {
		const result: number[] = [];

		for (const match of this.text.matchAll(SENTENCE_END_PATTERN)) {
			if (typeof match.index !== 'number') continue;

			const nextPosition = match.index + match[0].length;
			// После последнего предложения новая пустая строка не нужна.
			if (!this.text.slice(nextPosition).trim()) continue;

			const punctuation = match[1].match(/[.!?…]+/u)?.[0] ?? '';
			// Точки в сокращениях и инициалах не являются границами предложений.
			if (punctuation === '.' && this.isNonTerminalPeriod(match.index)) continue;
			result.push(nextPosition);
		}

		return result;
	}

	/**
	 * Проверяет, относится ли точка к сокращению или одиночному инициалу.
	 *
	 * @param periodPosition Абсолютная позиция точки в исходном тексте.
	 * @returns `true`, если перенос строки после точки добавлять не нужно.
	 */
	private isNonTerminalPeriod(periodPosition: number): boolean {
		const token = this.text.slice(0, periodPosition).match(/[\p{L}.]+$/u)?.[0].toLocaleLowerCase('ru') ?? '';
		if (!token) return false;
		if (NON_TERMINAL_ABBREVIATIONS.has(token)) return true;
		return /^\p{Lu}$/u.test(this.text.slice(0, periodPosition).match(/\p{L}+$/u)?.[0] ?? '');
	}

	/**
	 * Делит сегменты подсветки по найденным границам предложений.
	 *
	 * @param segments Сегменты, offsets которых соответствуют исходному тексту.
	 * @param breakPositions Абсолютные позиции переносов между предложениями.
	 * @returns Строки с сохранёнными ролями подсветки.
	 */
	private splitIntoLines(
		segments: readonly IPdfSourceTextSegment[],
		breakPositions: readonly number[],
	): IPdfSourceTextSegment[][] {
		if (!segments.length) return [];
		if (!breakPositions.length) return [[...segments]];

		const lines: IPdfSourceTextSegment[][] = [[]];
		let absoluteOffset = 0;
		let breakIndex = 0;

		segments.forEach(segment => {
			// absoluteOffset связывает локальную позицию внутри сегмента с исходным текстом.
			const segmentEnd = absoluteOffset + segment.text.length;
			let localOffset = 0;

			// Один длинный сегмент может пересекать сразу несколько границ предложений.
			while (breakIndex < breakPositions.length && breakPositions[breakIndex] <= segmentEnd) {
				const breakPosition = breakPositions[breakIndex];
				const breakOffset = Math.max(localOffset, breakPosition - absoluteOffset);
				this.appendTextSegment(
					lines[lines.length - 1],
					segment.text.slice(localOffset, breakOffset),
					segment.role,
				);
				lines.push([]);
				localOffset = breakOffset;
				breakIndex += 1;
			}

			this.appendTextSegment(lines[lines.length - 1], segment.text.slice(localOffset), segment.role);
			absoluteOffset = segmentEnd;
		});

		return lines;
	}

	/**
	 * Удаляет цифровые ссылки в квадратных скобках из конца предложений.
	 *
	 * Финальная пунктуация предложения сохраняется. Ссылки внутри предложения
	 * не изменяются.
	 *
	 * @param lines Строки с исходными ролями подсветки.
	 * @returns Строки без конечных ссылок вида «[5, 30, 32]».
	 */
	private removeTrailingReferences(
		lines: readonly (readonly IPdfSourceTextSegment[])[],
	): IPdfSourceTextSegment[][] {
		return lines.map(line => {
			const lineText = line.map(segment => segment.text).join('');
			const match = lineText.match(TRAILING_REFERENCE_PATTERN);
			if (!match || typeof match.index !== 'number') return [...line];

			return this.removeTextRange(line, match.index, match.index + match[0].length);
		});
	}

	/**
	 * Вырезает диапазон из последовательности сегментов, не теряя роли подсветки.
	 *
	 * @param segments Исходные сегменты одной строки.
	 * @param rangeStart Начало удаляемого диапазона внутри строки.
	 * @param rangeEnd Конец удаляемого диапазона внутри строки.
	 * @returns Сегменты без указанного диапазона.
	 */
	private removeTextRange(
		segments: readonly IPdfSourceTextSegment[],
		rangeStart: number,
		rangeEnd: number,
	): IPdfSourceTextSegment[] {
		const result: IPdfSourceTextSegment[] = [];
		let absoluteOffset = 0;

		segments.forEach(segment => {
			const segmentStart = absoluteOffset;
			const segmentEnd = segmentStart + segment.text.length;

			if (segmentEnd <= rangeStart || segmentStart >= rangeEnd) {
				this.appendTextSegment(result, segment.text, segment.role);
			} else {
				// Диапазон может занимать только середину сегмента, поэтому сохраняем обе стороны.
				const beforeEnd = Math.max(0, rangeStart - segmentStart);
				const afterStart = Math.min(segment.text.length, rangeEnd - segmentStart);
				this.appendTextSegment(result, segment.text.slice(0, beforeEnd), segment.role);
				this.appendTextSegment(result, segment.text.slice(afterStart), segment.role);
			}

			absoluteOffset = segmentEnd;
		});

		return result;
	}

	/**
	 * Формирует публичную модель строк и выделяет числовые фрагменты.
	 *
	 * @param lines Очищенные строки с ролями подсветки.
	 * @param headingTexts Тексты, найденные в отдельных физических строках.
	 * @returns Строки, готовые для непосредственной отрисовки.
	 */
	private createDisplayLines(
		lines: readonly (readonly IPdfSourceTextSegment[])[],
		headingTexts: ReadonlySet<string>,
	): IPdfSourceTextLine[] {
		return lines.map(segments => {
			const lineText = segments.map(segment => segment.text).join('').trim();
			return {
				segments: this.splitNumberSegments(segments),
				// Строка могла стать отдельной уже после смыслового разбиения предложений.
				isHeading: headingTexts.has(lineText) || this.isStandaloneHeading(lineText),
			};
		});
	}

	/**
	 * Разбивает каждый текстовый сегмент на обычные и числовые части.
	 *
	 * @param segments Сегменты с уже рассчитанной ролью подсветки.
	 * @returns Сегменты с признаком `isNumber` для каждой последовательности цифр.
	 */
	private splitNumberSegments(
		segments: readonly IPdfSourceTextSegment[],
	): IPdfSourceDisplaySegment[] {
		const result: IPdfSourceDisplaySegment[] = [];

		segments.forEach(segment => {
			let localOffset = 0;

			for (const match of segment.text.matchAll(NUMBER_PATTERN)) {
				if (typeof match.index !== 'number') continue;

				this.appendDisplaySegment(
					result,
					segment.text.slice(localOffset, match.index),
					segment.role,
					false,
				);
				this.appendDisplaySegment(result, match[0], segment.role, true);
				localOffset = match.index + match[0].length;
			}

			this.appendDisplaySegment(result, segment.text.slice(localOffset), segment.role, false);
		});

		return result;
	}

	/**
	 * Добавляет отображаемый сегмент, пропуская пустые значения.
	 *
	 * @param result Массив, в который добавляется сегмент.
	 * @param text Текст сегмента.
	 * @param role Роль подсветки или `null`.
	 * @param isNumber Является ли сегмент числовым.
	 */
	private appendDisplaySegment(
		result: IPdfSourceDisplaySegment[],
		text: string,
		role: PdfSourceMarkRole | null,
		isNumber: boolean,
	): void {
		if (text) result.push({text, role, isNumber});
	}

	/**
	 * Добавляет фрагмент в строку и объединяет соседние части с одинаковой ролью.
	 *
	 * @param line Строка, которая сейчас собирается.
	 * @param text Добавляемая часть текста.
	 * @param role Роль подсветки или `null` для обычного текста.
	 */
	private appendTextSegment(
		line: IPdfSourceTextSegment[],
		text: string,
		role: PdfSourceMarkRole | null,
	): void {
		if (!text) return;
		const previous = line[line.length - 1];
		if (previous?.role === role) {
			line[line.length - 1] = {text: previous.text + text, role};
		} else {
			line.push({text, role});
		}
	}

	/**
	 * Удаляет строки, в которых остались только пробелы или служебная пунктуация.
	 *
	 * @param lines Собранные строки текста.
	 * @returns Только строки с отображаемым содержимым.
	 */
	private removeEmptyLines(
		lines: readonly (readonly IPdfSourceTextSegment[])[],
	): IPdfSourceTextSegment[][] {
		return lines
			.map(line => [...line])
			.filter(line => {
				const lineText = line.map(segment => segment.text).join('').trim();
				return Boolean(lineText) && !ORPHAN_PUNCTUATION_PATTERN.test(lineText);
			});
	}
}

export default HighlightedText;
