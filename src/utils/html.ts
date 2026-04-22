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
 * @param full — true: дополнительно прогнать через cleanHtml (удалить nav/footer/menu и т.п.)
 */
export function parseHtml(html: string, full = false): HTMLElement {
	const div = document.createElement('div');
	div.innerHTML = sanitizeHtml(full ? cleanHtml(html) : html);
	return div;
}
