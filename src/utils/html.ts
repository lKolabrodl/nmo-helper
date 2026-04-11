/**
 * Обработка HTML: санитизация, очистка, парсинг.
 * @module utils/html
 */

/**
 * Исправляет смешанные кириллические/латинские символы-двойники в тексте.
 */
function fixMixedChars(text: string): string {
	return text
		.replace(/\b[a-zA-Z]*[\u0430\u0410]\w*\b/g, m => m.replace(/\u0430/g, 'a'))
		.replace(/\b[a-zA-Z]*[\u043E\u041E]\w*\b/g, m => m.replace(/\u043E/g, 'o'))
		.replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[aA]\w*/g, m => m.replace(/a/gi, '\u0430'))
		.replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[oO]\w*/g, m => m.replace(/o/gi, '\u043E'));
}

/**
 * Исправляет смешанные символы во всех текстовых элементах внутри контейнера.
 */
function fixAllTextNodes(div: HTMLElement): void {
	const fix = (sel: string) => {
		div.querySelectorAll<HTMLElement>(sel).forEach(el => {
			if (!(el.innerText || '').match(/[aAoO]/)) return;
			el.innerText = fixMixedChars(el.innerText);
		});
	};
	fix('h3'); fix('strong'); fix('span');
}

/**
 * Удаляет опасные теги и event-handler атрибуты из HTML через DOMParser.
 */
function sanitizeHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.querySelectorAll('script,iframe,object,embed,form,svg,math,link,meta,base,template,style')
		.forEach(el => el.remove());
	doc.querySelectorAll('*').forEach(el => {
		for (const attr of [...el.attributes]) {
			if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
				el.removeAttribute(attr.name);
			}
		}
	});
	return doc.body.innerHTML;
}

/**
 * Очищает HTML-строку от навигации, скриптов, меню и прочих лишних элементов.
 */
function cleanHtml(html: string): string {
	return html.replace(/\s+/g, ' ')
		.replace(/.*?(<div class="row">)/, '$1')
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
 * @param full — true: полная обработка (cleanHtml + fixAllTextNodes), false: только sanitize
 */
export function parseHtml(html: string, full = false): HTMLElement {
	const div = document.createElement('div');
	div.innerHTML = sanitizeHtml(full ? cleanHtml(html) : html);
	if (full) fixAllTextNodes(div);
	return div;
}
