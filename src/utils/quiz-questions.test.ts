import {afterEach, describe, expect, it, vi} from 'vitest';
import {downloadQuizQuestions, formatQuizQuestionsText, type IQuizQuestionsSnapshot} from './quiz-questions';

const snapshot: IQuizQuestionsSnapshot = {
	topic: 'Тестовая тема - 2026 - Контрольное тестирование',
	questions: [
		{question: 'Какой вариант выбрать?', variants: ['Первый', 'Второй'], isSingle: true},
		{question: 'Какие варианты выбрать?', variants: ['Третий', 'Четвёртый', 'Пятый'], isSingle: false},
	],
};

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('formatQuizQuestionsText', () => {
	it('сохраняет тему целиком и все вопросы с нумерацией и вариантами в исходном порядке', () => {
		expect(formatQuizQuestionsText(snapshot)).toBe([
			'Тема: Тестовая тема - 2026 - Контрольное тестирование',
			'Количество вопросов: 2',
			'',
			'',
			'Вопрос 1',
			'--------',
			'  Какой вариант выбрать?',
			'',
			'  Варианты ответа (один вариант):',
			'    1) Первый',
			'    2) Второй',
			'',
			'',
			'Вопрос 2',
			'--------',
			'  Какие варианты выбрать?',
			'',
			'  Варианты ответа (несколько вариантов):',
			'    1) Третий',
			'    2) Четвёртый',
			'    3) Пятый',
			'',
		].join('\n'));
	});

	it('сохраняет абзацы и переносы, выравнивает продолжения вариантов и убирает лишние пробелы', () => {
		const text = formatQuizQuestionsText({
			topic: '  Многострочная\r\nтема  ',
			questions: [{
				question: '  Анамнез:  первая\tстрока\r\n\r\n Вторая строка.\rЗадание.  ',
				variants: ['  Первая часть\r\nвторая часть\n\nновый абзац  ', 'Нет'],
				isSingle: true,
			}],
		});

		expect(text).toContain('Тема: Многострочная\n      тема\n');
		expect(text).toContain('  Анамнез: первая строка\n\n  Вторая строка.\n  Задание.\n');
		expect(text).toContain('    1) Первая часть\n       вторая часть\n\n       новый абзац\n    2) Нет\n');
		expect(text).not.toMatch(/\r|[ \t]+\n/);
	});

	it('переносит длинные строки по словам и не теряет текст при переносе', () => {
		const longText = Array.from({length: 60}, (_, index) => `слово${index + 1}`).join(' ');
		const text = formatQuizQuestionsText({
			topic: 'Тема',
			questions: [{question: longText, variants: [longText], isSingle: false}],
		});
		const questionText = text.split('--------\n')[1].split('\n\n')[0];
		const variantText = text.split('    1) ')[1].trimEnd();

		expect(text.split('\n').every(line => line.length <= 100)).toBe(true);
		expect(questionText.replace(/\s+/g, ' ').trim()).toBe(longText);
		expect(variantText.replace(/\s+/g, ' ')).toBe(longText);
		expect(variantText).toContain('\n       ');
	});

	it('не разрывает длинное слово или URL внутри варианта', () => {
		const url = `https://example.test/${'a'.repeat(120)}`;
		expect(formatQuizQuestionsText({
			topic: 'Тема',
			questions: [{question: 'Ссылка', variants: [url], isSingle: true}],
		})).toContain(`    1) ${url}\n`);
	});
});

describe('downloadQuizQuestions', () => {
	it('скачивает TXT с UTF-8 BOM, кириллицей и CRLF, затем освобождает URL', async () => {
		let downloadedBlob: Blob | undefined;
		const createObjectURL = vi.fn((blob: Blob) => {
			downloadedBlob = blob;
			return 'blob:quiz-test';
		});
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', {createObjectURL, revokeObjectURL});
		const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			expect(this.isConnected).toBe(true);
			expect(this.href).toBe('blob:quiz-test');
			expect(this.download).toBe(`${snapshot.topic} - вопросы.txt`);
		});

		downloadQuizQuestions(snapshot);

		expect(clickSpy).toHaveBeenCalledOnce();
		expect(document.querySelector('a[download]')).toBeNull();
		expect(downloadedBlob?.type).toBe('text/plain;charset=utf-8');
		expect(revokeObjectURL).not.toHaveBeenCalled();
		const buffer = await readBlob(downloadedBlob!);
		expect(Array.from(new Uint8Array(buffer).slice(0, 3))).toEqual([0xEF, 0xBB, 0xBF]);
		const text = new TextDecoder().decode(buffer);
		expect(text).toBe(formatQuizQuestionsText(snapshot).replace(/\n/g, '\r\n'));
		expect(text).not.toMatch(/(?<!\r)\n/);

		const timerIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 1000);
		expect(timerIndex).toBeGreaterThanOrEqual(0);
		window.clearTimeout(setTimeoutSpy.mock.results[timerIndex].value);
		(setTimeoutSpy.mock.calls[timerIndex][0] as () => void)();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:quiz-test');
	});

	it('очищает запрещённые символы в имени файла и ограничивает его длину', () => {
		vi.useFakeTimers();
		vi.stubGlobal('URL', {createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn()});
		const filenames: string[] = [];
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			filenames.push(this.download);
		});

		downloadQuizQuestions({...snapshot, topic: 'Тема: <пример> / раздел\\тест? * | "\u0001'});
		downloadQuizQuestions({...snapshot, topic: 'Т'.repeat(500)});
		downloadQuizQuestions({...snapshot, topic: '... '});

		expect(filenames[0]).toBe('Тема пример раздел тест - вопросы.txt');
		expect(filenames[1]).toBe(`${'Т'.repeat(140)} - вопросы.txt`);
		expect(filenames[2]).toBe('Тест - вопросы.txt');
		vi.runAllTimers();
	});

	it('убирает ссылку и освобождает URL, даже если клик завершился ошибкой', () => {
		vi.useFakeTimers();
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', {createObjectURL: () => 'blob:failed', revokeObjectURL});
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
			throw new Error('Скачивание недоступно');
		});

		expect(() => downloadQuizQuestions(snapshot)).toThrow('Скачивание недоступно');
		expect(document.querySelector('a[download]')).toBeNull();
		vi.runAllTimers();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed');
	});
});

function readBlob(blob: Blob): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(blob);
	});
}
