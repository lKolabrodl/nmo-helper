/** Popup: кнопки экспорта кеша ответов */

const phrases = [
	'Привет, я кот',
	'Большую роль сыграл в твоей судьбе',
	'Я толстый кот',
	'И должен знать всю правду обо мне',
	'Я расскажу тебе секрет один',
	'Ты мой слуга, а я твой господин',
	'И хозяин твой, а ты мой раб навечно',
	'Ведь я твой кот, а ты мой человек',
	'Мяу, мяу, мяу, мяу, мяу',
	'Мяу, Мяу, Мяу, мяу, мяу',
	'Мяу, Мяу, Мяу, Мяу, Мяу',
	'Мяу, мяу, ааа, ааа, ааа',
	'Играй со мной',
	'И может погладить разрешу',
	'Корми меня',
	'И может на тебя я погляжу',
	'На свет родился, чтоб повелевать',
	'Тебе со мной покоя не видать',
	'И всё что захочу, могу я натворить',
	'Ты будешь всё равно меня любить',
	'Мяу, мяу, мяу, мяу, мяу',
	'Мяу, Мяу, Мяу, мяу, мяу',
	'Мяу, Мяу, Мяу, Мяу, Мяу',
	'Мяу, мяу, ааа, ааа, ааа',
	'Прости меня',
	'Лови меня',
	'Найди меня',
	'Люби меня',
	'Ведь я твой кот',
	'Я здесь король',
	'Я властелин',
	'И твой герой',
	'Прости меня',
	'Лови меня',
	'Найди меня',
	'Люби меня',
	'Ведь я твой кот',
	'Я здесь король',
	'Я властелин',
	'И твой герой',
	'Привет, я кот',
];
let phraseIndex = 0;
let singInterval = null;

document.querySelector('.popup-mascot').addEventListener('click', () => {
	const bubble = document.getElementById('speech-bubble');
	if (singInterval) {
		clearInterval(singInterval);
		singInterval = null;
		bubble.classList.remove('visible');
		phraseIndex = 0;
		return;
	}
	bubble.textContent = phrases[0];
	bubble.classList.add('visible');
	singInterval = setInterval(() => {
		phraseIndex = (phraseIndex + 1) % phrases.length;
		bubble.textContent = phrases[phraseIndex];
	}, 2500);
});

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
