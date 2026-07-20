export const PDF_SOURCE_HOST_ID = 'nmo-pdf-source-trigger-host';

const QUESTION_INFO_SELECTOR = '.question-info';
const QUESTION_COUNTER_SELECTOR = '.question-info-questionCounter';

/** Создаёт host с кнопкой непосредственно после текста счётчика вопроса. */
export function ensurePdfSourceHost(root: ParentNode = document): HTMLElement | null {
	const questionInfo = root.querySelector<HTMLElement>(QUESTION_INFO_SELECTOR);
	const questionCounter = questionInfo?.querySelector<HTMLElement>(QUESTION_COUNTER_SELECTOR);
	if (!questionCounter) return null;

	const ownerDocument = questionCounter.ownerDocument;
	let host = ownerDocument.getElementById(PDF_SOURCE_HOST_ID);
	if (!host) {
		host = ownerDocument.createElement('span');
		host.id = PDF_SOURCE_HOST_ID;
		host.className = 'nmo-pdf-source-trigger-host';
	}

	if (host.parentElement !== questionCounter || questionCounter.lastElementChild !== host) {
		questionCounter.append(host);
	}
	return host;
}

export function removePdfSourceHost(ownerDocument: Document = document): void {
	ownerDocument.getElementById(PDF_SOURCE_HOST_ID)?.remove();
}
