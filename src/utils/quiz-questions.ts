import type {IPageQuestion} from '../patch/subscribePageState';

export interface IQuizQuestionsSnapshot {
	readonly topic: string;
	readonly questions: readonly IPageQuestion[];
}

const TEXT_LINE_WIDTH = 100;

/** Форматирует только загруженные вопросы текущего теста, сохраняя абзацы. */
export function formatQuizQuestionsText(snapshot: IQuizQuestionsSnapshot): string {
	const lines = [
		...wrapText(snapshot.topic, 'Тема: ', '      '),
		`Количество вопросов: ${snapshot.questions.length}`,
	];

	snapshot.questions.forEach((question, index) => {
		const heading = `Вопрос ${index + 1}`;
		lines.push(
			'',
			'',
			heading,
			'-'.repeat(heading.length),
			...wrapText(question.question, '  '),
			'',
			`  Варианты ответа (${question.isSingle ? 'один вариант' : 'несколько вариантов'}):`,
		);
		question.variants.forEach((variant, variantIndex) => {
			const prefix = `    ${variantIndex + 1}) `;
			lines.push(...wrapText(variant, prefix, ' '.repeat(prefix.length)));
		});
	});

	return `${lines.join('\n')}\n`;
}

/** Скачивает читаемый UTF-8 TXT, не обращаясь к внешним источникам. */
export function downloadQuizQuestions(snapshot: IQuizQuestionsSnapshot): void {
	const text = formatQuizQuestionsText(snapshot).replace(/\n/g, '\r\n');
	const blob = new Blob(['\uFEFF', text], {type: 'text/plain;charset=utf-8'});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = createFilename(snapshot.topic);
	link.hidden = true;

	try {
		document.body.appendChild(link);
		link.click();
	} finally {
		link.remove();
		// Даём браузеру начать загрузку до освобождения Blob URL.
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}

function createFilename(topic: string): string {
	const title = topic
		.replace(/[<>:"/\\|?*]|\p{Cc}/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 140)
		.replace(/[. ]+$/g, '');
	return `${title || 'Тест'} - вопросы.txt`;
}

function wrapText(text: string, firstPrefix: string, continuationPrefix = firstPrefix): string[] {
	const result: string[] = [];
	const sourceLines = text.replace(/\r\n?/g, '\n').trim().split('\n');
	let prefix = firstPrefix;

	for (const sourceLine of sourceLines) {
		const trimmed = sourceLine.trim();
		if (!trimmed) {
			result.push('');
			continue;
		}

		let line = prefix;
		for (const word of trimmed.split(/\s+/)) {
			const separator = line.length > prefix.length ? ' ' : '';
			if (separator && line.length + separator.length + word.length > TEXT_LINE_WIDTH) {
				result.push(line);
				prefix = continuationPrefix;
				line = prefix + word;
			} else {
				line += separator + word;
			}
		}
		result.push(line);
		prefix = continuationPrefix;
	}

	return result;
}
