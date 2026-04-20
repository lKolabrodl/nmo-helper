/** Popup: кнопки экспорта кеша ответов (блок временно отключён, см. popup.html) */

/*
function download(filename, content, type) {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function setStatus(text, isError) {
	const el = document.getElementById('export-status');
	el.textContent = text;
	el.className = 'export-status' + (isError ? ' error' : '');
}

async function sendToContent(type) {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id) { setStatus('нет активной вкладки', true); return null; }

	return new Promise((resolve) => {
		chrome.tabs.sendMessage(tab.id, { type }, (response) => {
			if (chrome.runtime.lastError) {
				setStatus('откройте страницу НМО', true);
				resolve(null);
				return;
			}
			resolve(response);
		});
	});
}

document.getElementById('export-json').addEventListener('click', async () => {
	const data = await sendToContent('EXPORT_JSON');
	if (!data) return setStatus('кеш пуст', true);
	download('nmo-export.json', JSON.stringify(data, null, 2), 'application/json');
	setStatus('JSON сохранён');
});

document.getElementById('export-csv').addEventListener('click', async () => {
	const data = await sendToContent('EXPORT_CSV');
	if (!data) return setStatus('кеш пуст', true);
	download('nmo-export.csv', '\uFEFF' + data, 'text/csv;charset=utf-8');
	setStatus('CSV сохранён');
});
*/
