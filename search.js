/**
 * Автопоиск тестов на сайтах 24forcare.com и rosmedicinfo.ru.
 * Пользователь вводит название теста, расширение ищет подходящие страницы
 * на обоих сайтах и предлагает выбрать результат.
 */

/**
 * Инициализирует автопоиск: обработчик кнопки поиска,
 * отображение результатов, выбор URL.
 */
function initSearch() {
    /** Обновляет статус поиска в панели */
    const searchStatus = (msg, cls = '') => {
        const el = document.getElementById('nmo-search-status');
        el.textContent = msg;
        el.className = 'nmo-status ' + cls;
    };

    const searchBtn = document.getElementById('nmo-search-btn');
    const searchResultsContainer = document.getElementById('nmo-search-results');

    searchBtn.addEventListener('click', async () => {
        const query = document.getElementById('nmo-search-query').value.trim();
        if (!query) {
            searchStatus('введите название теста', 'err');
            return;
        }

        searchStatus('ищу на обоих сайтах...', 'loading');
        searchBtn.disabled = true;
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';

        const allResults = [];

        // --- Поиск на 24forcare.com (GET) ---
        try {
            const res = await fetchViaBackground('https://24forcare.com/search/?query=' + encodeURIComponent(query));
            if (res && !res.error && res.text) {
                const div = document.createElement('div');
                div.innerHTML = res.text;
                const links = Array.from(div.querySelectorAll('a.item-name'));
                links.forEach(a => {
                    const href = a.getAttribute('href') || '';
                    const title = (a.textContent || '').trim();
                    if (!href || !title) return;
                    const fullUrl = href.startsWith('http') ? href : 'https://24forcare.com/' + href.replace(/^\//, '');
                    allResults.push({ source: '24forcare', title, url: fullUrl });
                });
            }
        } catch (e) {
            console.error('24forcare search error:', e);
        }

        // --- Поиск на rosmedicinfo.ru (POST) ---
        try {
            const res = await fetchViaBackground('https://rosmedicinfo.ru/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'do=search&subaction=search&story=' + encodeURIComponent(query),
            });
            if (res && !res.error && res.text) {
                const div = document.createElement('div');
                div.innerHTML = res.text;
                const titles = Array.from(div.querySelectorAll('.short__title a'));
                titles.forEach(a => {
                    const href = a.getAttribute('href') || '';
                    const title = (a.textContent || '').trim();
                    if (!href || !title) return;
                    allResults.push({ source: 'rosmedicinfo', title, url: href });
                });
            }
        } catch (e) {
            console.error('rosmedicinfo search error:', e);
        }

        searchBtn.disabled = false;

        if (allResults.length === 0) {
            searchStatus('ничего не найдено :(', 'warn');
            return;
        }

        searchStatus(`найдено ${allResults.length} результат(ов)`, 'ok');
        searchResultsContainer.style.display = 'flex';

        allResults.forEach(r => {
            const item = document.createElement('div');
            item.className = 'nmo-result-item';
            item.innerHTML = `
                <span class="nmo-result-src ${r.source === '24forcare' ? 'src-24' : 'src-ros'}">${r.source === '24forcare' ? '24fc' : 'rosmed'}</span>
                <span class="nmo-result-title">${r.title}</span>
            `;
            item.addEventListener('click', () => {
                document.getElementById('nmo-url').value = r.url;
                storageSet('customUrl', r.url);
                searchStatus(`выбрано \u2022 ${r.source}`, 'ok');
                searchResultsContainer.style.display = 'none';
            });
            searchResultsContainer.appendChild(item);
        });
    });

    // Enter в поле поиска
    document.getElementById('nmo-search-query').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });
}
